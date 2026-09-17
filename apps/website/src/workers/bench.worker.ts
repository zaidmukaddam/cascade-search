import {
  argmax,
  createGpu,
  defaultWeights,
  featurize,
  forward,
  type GpuOutput,
  type Trace,
  tokenize,
  type Weights,
} from 'cascade-search'
import { EXAMPLES, SCHEMA } from '../lib/schema.ts'

const QUERIES = 1024
const WARMUP_QUERIES = 64

export interface BenchResult {
  queries: number
  cpuMs: number
  gpu: {
    ms: number
    largestLogitDifference: number
    roleMismatches: number
    adapter: string
  } | null
}

function compare(weights: Weights, cpu: Trace[], gpu: GpuOutput[]) {
  let largestLogitDifference = 0
  let roleMismatches = 0

  gpu.forEach((output, query) => {
    const reference = cpu[query].logits
    for (let i = 0; i < reference.length; i++) {
      const difference = Math.abs(reference[i] - output.logits[i])
      largestLogitDifference = Math.max(largestLogitDifference, difference)
    }
    for (let start = 0; start < reference.length; start += weights.roleCount) {
      const cpuRole = argmax(reference, start, weights.roleCount)
      const gpuRole = argmax(output.logits, start, weights.roleCount)
      if (cpuRole !== gpuRole) roleMismatches++
    }
  })
  return { largestLogitDifference, roleMismatches }
}

async function adapterName(): Promise<string> {
  const adapter = await navigator.gpu?.requestAdapter()
  return [adapter?.info.vendor, adapter?.info.architecture].filter(Boolean).join(' ')
}

async function run(): Promise<BenchResult> {
  const weights = defaultWeights()
  const batch = Array.from({ length: QUERIES }, (_, index) =>
    featurize(tokenize(EXAMPLES[index % EXAMPLES.length]), SCHEMA),
  )
  for (const features of batch.slice(0, WARMUP_QUERIES)) forward(weights, features)

  const cpuStarted = performance.now()
  const cpu = batch.map(features => forward(weights, features))
  const cpuMs = performance.now() - cpuStarted

  const gpu = await createGpu(weights).catch(() => null)
  if (!gpu) return { queries: QUERIES, cpuMs, gpu: null }

  await gpu.run(batch.slice(0, WARMUP_QUERIES))
  const gpuStarted = performance.now()
  const outputs = await gpu.run(batch)
  const ms = performance.now() - gpuStarted
  gpu.destroy()

  return {
    queries: QUERIES,
    cpuMs,
    gpu: { ms, ...compare(weights, cpu, outputs), adapter: await adapterName() },
  }
}

self.onmessage = async () => self.postMessage(await run())
