import { buildShader, type Offsets, SCRATCH_REGIONS, WORKGROUP_SIZE } from './shader.ts'
import { MAX_TOKENS } from './tokenize.ts'
import type { Weights } from './weights.ts'

const BYTES_PER_FLOAT = 4
const WORDS_PER_TOKEN = 2

export interface GpuOutput {
  logits: Float32Array
  confLogit: Float32Array
}

export interface GpuModel {
  run(batch: number[][][]): Promise<GpuOutput[]>
  destroy(): void
}

function flattenWeights(model: Weights): { flat: Float32Array; offsets: Offsets } {
  const offsets: Offsets = {}
  let total = 0
  for (const [name, data] of Object.entries(model.tensors)) {
    offsets[name] = total
    total += data.length
  }
  const flat = new Float32Array(total)
  for (const [name, data] of Object.entries(model.tensors)) flat.set(data, offsets[name])
  return { flat, offsets }
}

function packFeatures(batch: number[][][]): { bits: Uint32Array; lengths: Uint32Array } {
  const bits = new Uint32Array(batch.length * MAX_TOKENS * WORDS_PER_TOKEN)
  const lengths = new Uint32Array(batch.length)
  batch.forEach((query, q) => {
    lengths[q] = query.length
    query.forEach((active, token) => {
      const base = (q * MAX_TOKENS + token) * WORDS_PER_TOKEN
      for (const feature of active) bits[base + (feature >> 5)] |= 1 << (feature & 31)
    })
  })
  return { bits, lengths }
}

function unpackOutput(raw: Float32Array, batch: number[][][], roles: number): GpuOutput[] {
  const stride = roles + 1
  return batch.map((query, q) => {
    const logits = new Float32Array(query.length * roles)
    const confLogit = new Float32Array(query.length)
    for (let token = 0; token < query.length; token++) {
      const start = (q * MAX_TOKENS + token) * stride
      logits.set(raw.subarray(start, start + roles), token * roles)
      confLogit[token] = raw[start + roles]
    }
    return { logits, confLogit }
  })
}

export async function createGpu(
  model: Weights,
  gpu: GPU | undefined = (globalThis.navigator as Navigator | undefined)?.gpu,
): Promise<GpuModel | null> {
  const adapter = await gpu?.requestAdapter()
  if (!adapter) return null
  const device = await adapter.requestDevice()

  const { flat, offsets } = flattenWeights(model)
  const { STORAGE, COPY_DST, COPY_SRC, MAP_READ } = GPUBufferUsage
  const weights = device.createBuffer({ size: flat.byteLength, usage: STORAGE | COPY_DST })
  device.queue.writeBuffer(weights, 0, flat)

  const pipeline = await device.createComputePipelineAsync({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: buildShader(model, offsets) }),
      entryPoint: 'main',
    },
  })

  async function run(batch: number[][][]): Promise<GpuOutput[]> {
    const { bits, lengths } = packFeatures(batch)
    const tokenSlots = batch.length * MAX_TOKENS
    const scratchBytes = tokenSlots * SCRATCH_REGIONS * model.width * BYTES_PER_FLOAT
    const resultBytes = tokenSlots * (model.roleCount + 1) * BYTES_PER_FLOAT

    const featureBuffer = device.createBuffer({ size: bits.byteLength, usage: STORAGE | COPY_DST })
    const lengthBuffer = device.createBuffer({
      size: lengths.byteLength,
      usage: STORAGE | COPY_DST,
    })
    const scratchBuffer = device.createBuffer({ size: scratchBytes, usage: STORAGE })
    const resultBuffer = device.createBuffer({ size: resultBytes, usage: STORAGE | COPY_SRC })
    const readBuffer = device.createBuffer({ size: resultBytes, usage: MAP_READ | COPY_DST })
    device.queue.writeBuffer(featureBuffer, 0, bits)
    device.queue.writeBuffer(lengthBuffer, 0, lengths)

    const bound = [weights, featureBuffer, lengthBuffer, scratchBuffer, resultBuffer]
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: bound.map((buffer, binding) => ({ binding, resource: { buffer } })),
    })

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(batch.length / WORKGROUP_SIZE))
    pass.end()
    encoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, resultBytes)
    device.queue.submit([encoder.finish()])

    await readBuffer.mapAsync(GPUMapMode.READ)
    const raw = new Float32Array(readBuffer.getMappedRange().slice(0))
    readBuffer.unmap()
    for (const buffer of [featureBuffer, lengthBuffer, scratchBuffer, resultBuffer, readBuffer]) {
      buffer.destroy()
    }
    return unpackOutput(raw, batch, model.roleCount)
  }

  return { run, destroy: () => device.destroy() }
}
