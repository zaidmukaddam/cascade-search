import { MAX_TOKENS } from './tokenize.ts'
import type { Weights } from './weights.ts'

export const WORKGROUP_SIZE = 64
export const SCRATCH_REGIONS = 4

export type Offsets = Record<string, number>

function scanLayer(layer: number, offsets: Offsets, width: number): string {
  const at = (name: string) => `${offsets[`layers.${layer}.${name}`]}u`
  const pick = (name: string) => `select(${at(`b.${name}`)}, ${at(`f.${name}`)}, isForward)`

  return `
  for (var tick = 0u; tick < count; tick++) {
    for (var direction = 0u; direction < 2u; direction++) {
      let isForward = direction == 0u;
      let token = select(count - 1u - tick, tick, isForward);
      let previous = select(token + 1u, token - 1u, isForward);
      let stateRegion = select(BACKWARD, FORWARD, isForward);
      let gateWeight = ${pick('a.weight')};
      let gateBias = ${pick('a.bias')};
      let updateWeight = ${pick('u.weight')};
      let updateBias = ${pick('u.bias')};
      for (var d = 0u; d < D; d++) {
        var gateLogit = weights[gateBias + d];
        var candidate = weights[updateBias + d];
        for (var j = 0u; j < D; j++) {
          let inputValue = scratch[base + HIDDEN + token * D + j];
          gateLogit += weights[gateWeight + d * D + j] * inputValue;
          candidate += weights[updateWeight + d * D + j] * inputValue;
        }
        let gate = 1.0 / (1.0 + exp(-gateLogit));
        var carried = 0.0;
        if (tick > 0u) { carried = scratch[base + stateRegion + previous * D + d]; }
        scratch[base + stateRegion + token * D + d] = gate * carried + (1.0 - gate) * candidate;
      }
    }
  }
  for (var token = 0u; token < count; token++) {
    var residual: array<f32, ${width}>;
    for (var d = 0u; d < D; d++) {
      var sum = weights[${at('o.bias')} + d];
      let row = ${at('o.weight')} + d * 2u * D;
      for (var j = 0u; j < D; j++) {
        sum += weights[row + j] * scratch[base + FORWARD + token * D + j];
        sum += weights[row + D + j] * scratch[base + BACKWARD + token * D + j];
      }
      residual[d] = max(sum, 0.0);
    }
    for (var d = 0u; d < D; d++) { scratch[base + HIDDEN + token * D + d] += residual[d]; }
  }`
}

export function buildShader(model: Weights, offsets: Offsets): string {
  const region = MAX_TOKENS * model.width
  const at = (name: string) => `${offsets[name]}u`
  const layers = Array.from({ length: model.layers }, (_, layer) =>
    scanLayer(layer, offsets, model.width),
  )

  return `
const D = ${model.width}u;
const ROLES = ${model.roleCount}u;
const FEATURES = ${model.featureCount}u;
const MAX_TOKENS = ${MAX_TOKENS}u;
const EMBED = 0u;
const HIDDEN = ${region}u;
const FORWARD = ${2 * region}u;
const BACKWARD = ${3 * region}u;

@group(0) @binding(0) var<storage, read> weights: array<f32>;
@group(0) @binding(1) var<storage, read> featureBits: array<u32>;
@group(0) @binding(2) var<storage, read> lengths: array<u32>;
@group(0) @binding(3) var<storage, read_write> scratch: array<f32>;
@group(0) @binding(4) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let query = id.x;
  if (query >= arrayLength(&lengths)) { return; }
  let count = lengths[query];
  let base = query * ${SCRATCH_REGIONS}u * MAX_TOKENS * D;

  for (var token = 0u; token < count; token++) {
    let bits = (query * MAX_TOKENS + token) * 2u;
    for (var d = 0u; d < D; d++) {
      var sum = 0.0;
      for (var f = 0u; f < FEATURES; f++) {
        let isSet = (featureBits[bits + (f >> 5u)] & (1u << (f & 31u))) != 0u;
        if (isSet) { sum += weights[${at('embed.weight')} + d * FEATURES + f]; }
      }
      scratch[base + EMBED + token * D + d] = sum;
    }
  }

  for (var token = 0u; token < count; token++) {
    for (var d = 0u; d < D; d++) {
      var sum = weights[${at('conv.bias')} + d];
      let row = ${at('conv.weight')} + d * 3u * D;
      for (var j = 0u; j < D; j++) {
        if (token > 0u) { sum += weights[row + j] * scratch[base + EMBED + (token - 1u) * D + j]; }
        sum += weights[row + D + j] * scratch[base + EMBED + token * D + j];
        if (token + 1u < count) { sum += weights[row + 2u * D + j] * scratch[base + EMBED + (token + 1u) * D + j]; }
      }
      scratch[base + HIDDEN + token * D + d] = scratch[base + EMBED + token * D + d] + max(sum, 0.0);
    }
  }
${layers.join('\n')}

  for (var token = 0u; token < count; token++) {
    let outBase = (query * MAX_TOKENS + token) * (ROLES + 1u);
    for (var role = 0u; role < ROLES; role++) {
      var logit = weights[${at('head.bias')} + role];
      for (var j = 0u; j < D; j++) {
        logit += weights[${at('head.weight')} + role * D + j] * scratch[base + HIDDEN + token * D + j];
      }
      result[outBase + role] = logit;
    }
    var confidence = weights[${at('conf.bias')}];
    for (var j = 0u; j < D; j++) {
      confidence += weights[${at('conf.weight')} + j] * scratch[base + HIDDEN + token * D + j];
    }
    for (var role = 0u; role < ROLES; role++) {
      confidence += weights[${at('conf.weight')} + D + role] * result[outBase + role];
    }
    result[outBase + ROLES] = confidence;
  }
}`
}
