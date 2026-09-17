import type { Weights } from './weights.ts'

export interface LayerTrace {
  fwd: Float32Array
  bwd: Float32Array
  out: Float32Array
}

export interface Trace {
  embed: Float32Array
  conv: Float32Array
  layers: LayerTrace[]
  logits: Float32Array
  confLogit: Float32Array
}

interface Linear {
  weight: Float32Array
  bias: Float32Array | null
  inputs: number
  outputs: number
}

function linearLayer(weights: Weights, name: string, inputs: number, outputs: number): Linear {
  return {
    weight: weights.tensors[`${name}.weight`],
    bias: weights.tensors[`${name}.bias`] ?? null,
    inputs,
    outputs,
  }
}

function apply(
  layer: Linear,
  input: Float32Array,
  inputStart: number,
  output: Float32Array,
  outputStart: number,
) {
  for (let o = 0; o < layer.outputs; o++) {
    let sum = layer.bias ? layer.bias[o] : 0
    const row = o * layer.inputs
    for (let i = 0; i < layer.inputs; i++) sum += layer.weight[row + i] * input[inputStart + i]
    output[outputStart + o] = sum
  }
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function embed(weights: Weights, features: number[][]): Float32Array {
  const { width, featureCount } = weights
  const table = weights.tensors['embed.weight']
  const embedded = new Float32Array(features.length * width)
  features.forEach((active, token) => {
    for (const feature of active) {
      for (let d = 0; d < width; d++) {
        embedded[token * width + d] += table[d * featureCount + feature]
      }
    }
  })
  return embedded
}

function convolve(weights: Weights, embedded: Float32Array, tokens: number): Float32Array {
  const { width } = weights
  const conv = linearLayer(weights, 'conv', 3 * width, width)
  const window = new Float32Array(3 * width)
  const mixed = new Float32Array(width)
  const hidden = new Float32Array(tokens * width)

  for (let token = 0; token < tokens; token++) {
    const here = token * width
    window.fill(0)
    if (token > 0) window.set(embedded.subarray(here - width, here), 0)
    window.set(embedded.subarray(here, here + width), width)
    if (token < tokens - 1) window.set(embedded.subarray(here + width, here + 2 * width), 2 * width)

    apply(conv, window, 0, mixed, 0)
    for (let d = 0; d < width; d++) hidden[here + d] = embedded[here + d] + Math.max(0, mixed[d])
  }
  return hidden
}

function scan(weights: Weights, prefix: string, hidden: Float32Array, tokens: number) {
  const { width } = weights
  const reverse = prefix.endsWith('.b')
  const gate = linearLayer(weights, `${prefix}.a`, width, width)
  const update = linearLayer(weights, `${prefix}.u`, width, width)
  const gateLogits = new Float32Array(width)
  const candidates = new Float32Array(width)
  const state = new Float32Array(tokens * width)

  for (let step = 0; step < tokens; step++) {
    const token = reverse ? tokens - 1 - step : step
    const previous = reverse ? token + 1 : token - 1
    apply(gate, hidden, token * width, gateLogits, 0)
    apply(update, hidden, token * width, candidates, 0)

    for (let d = 0; d < width; d++) {
      const keep = sigmoid(gateLogits[d])
      const carried = step === 0 ? 0 : state[previous * width + d]
      state[token * width + d] = keep * carried + (1 - keep) * candidates[d]
    }
  }
  return state
}

function scanLayer(weights: Weights, layer: number, hidden: Float32Array, tokens: number) {
  const { width } = weights
  const fwd = scan(weights, `layers.${layer}.f`, hidden, tokens)
  const bwd = scan(weights, `layers.${layer}.b`, hidden, tokens)
  const merge = linearLayer(weights, `layers.${layer}.o`, 2 * width, width)
  const both = new Float32Array(2 * width)
  const mixed = new Float32Array(width)
  const out = new Float32Array(tokens * width)

  for (let token = 0; token < tokens; token++) {
    const here = token * width
    both.set(fwd.subarray(here, here + width), 0)
    both.set(bwd.subarray(here, here + width), width)
    apply(merge, both, 0, mixed, 0)
    for (let d = 0; d < width; d++) out[here + d] = hidden[here + d] + Math.max(0, mixed[d])
  }
  return { fwd, bwd, out }
}

function heads(weights: Weights, hidden: Float32Array, tokens: number) {
  const { width, roleCount } = weights
  const roleHead = linearLayer(weights, 'head', width, roleCount)
  const confidenceHead = linearLayer(weights, 'conf', width + roleCount, 1)
  const logits = new Float32Array(tokens * roleCount)
  const confLogit = new Float32Array(tokens)
  const hiddenAndLogits = new Float32Array(width + roleCount)

  for (let token = 0; token < tokens; token++) {
    apply(roleHead, hidden, token * width, logits, token * roleCount)
    hiddenAndLogits.set(hidden.subarray(token * width, (token + 1) * width), 0)
    hiddenAndLogits.set(logits.subarray(token * roleCount, (token + 1) * roleCount), width)
    apply(confidenceHead, hiddenAndLogits, 0, confLogit, token)
  }
  return { logits, confLogit }
}

export function forward(weights: Weights, features: number[][]): Trace {
  const tokens = features.length
  const embedded = embed(weights, features)
  const conv = convolve(weights, embedded, tokens)

  const layers: LayerTrace[] = []
  let hidden = conv
  for (let layer = 0; layer < weights.layers; layer++) {
    const trace = scanLayer(weights, layer, hidden, tokens)
    layers.push(trace)
    hidden = trace.out
  }

  return { embed: embedded, conv, layers, ...heads(weights, hidden, tokens) }
}
