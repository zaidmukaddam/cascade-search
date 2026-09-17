import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { DOMAINS } from '../../../training/domains.ts'
import { argmax } from '../src/confidence.ts'
import { createGpu } from '../src/gpu.ts'
import { parse, pretty } from '../src/index.ts'
import { forward } from '../src/model.ts'
import { decode, defaultWeights } from '../src/weights.ts'

interface GoldenQuery {
  q: string
  f: number[][]
  logits: number[][]
  conf: number[]
}

const TOLERANCE = 1e-3
const weights = defaultWeights()

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
}

const golden = readJson<GoldenQuery[]>('./golden.json')

function largestDifference(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let largest = 0
  for (let i = 0; i < a.length; i++) largest = Math.max(largest, Math.abs(a[i] - b[i]))
  return largest
}

test('embedded weights are the exported file', () => {
  const bytes = new Uint8Array(readFileSync(new URL('../weights/weights.bin', import.meta.url)))
  const exported = decode(bytes, readJson('../weights/manifest.json'))
  for (const [name, tensor] of Object.entries(exported.tensors)) {
    expect(largestDifference(tensor, weights.tensors[name]), name).toBe(0)
  }
})

test('TS forward matches PyTorch on the golden queries', () => {
  for (const query of golden) {
    const trace = forward(weights, query.f)
    expect(largestDifference(trace.logits, query.logits.flat()), query.q).toBeLessThan(TOLERANCE)
    expect(largestDifference(trace.confLogit, query.conf), query.q).toBeLessThan(TOLERANCE)
  }
})

test('WGSL batch path matches the TS path', async context => {
  const { create, globals } = await import('webgpu')
  Object.assign(globalThis, globals)
  const flags = process.platform === 'linux' ? ['backend=vulkan'] : []
  const gpu = await createGpu(weights, create(flags))
  if (!gpu) {
    if (process.env.REQUIRE_GPU) throw new Error('no WebGPU adapter')
    return context.skip()
  }

  const outputs = await gpu.run(golden.map(query => query.f))
  gpu.destroy()

  golden.forEach((query, index) => {
    const cpu = forward(weights, query.f)
    const onGpu = outputs[index]
    expect(largestDifference(onGpu.logits, cpu.logits), query.q).toBeLessThan(TOLERANCE)
    expect(largestDifference(onGpu.confLogit, cpu.confLogit), query.q).toBeLessThan(TOLERANCE)

    for (let token = 0; token < query.f.length; token++) {
      const start = token * weights.roleCount
      const gpuRole = argmax(onGpu.logits, start, weights.roleCount)
      const cpuRole = argmax(cpu.logits, start, weights.roleCount)
      expect(gpuRole, `${query.q} token ${token}`).toBe(cpuRole)
    }
  })
})

test('parse() end to end', () => {
  const result = parse('open bugs from sam sorted by created desc', DOMAINS[0].schema)
  expect(pretty(result.ir)).toBe('status:open type:bug author:sam @sort:-created')
  expect(result.tier).toBe('local')
  expect(result.minConfidence).toBeGreaterThan(0.5)
})
