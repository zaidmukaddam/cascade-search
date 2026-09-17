import { useState } from 'react'
import { DetailBody, DetailText, DetailTitle, Metadata, MetadataRow } from '@/components/Detail'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import type { BenchResult } from '@/workers/bench.worker'

const PARITY_LIMIT = 1e-3

function browserName(): string {
  const agent = navigator.userAgent.replace(/Chrome.*Edg/, 'Edg')
  const match = /(Firefox|Edg|Chrome|Safari)\/[\d.]+/.exec(agent)
  return match ? match[0].replace('/', ' ') : 'Unknown browser'
}

function timing(ms: number, queries: number): string {
  const perSecond = Math.round((queries / ms) * 1000).toLocaleString()
  return `${ms.toFixed(1)} ms · ${perSecond}/s`
}

function Results({ result }: { result: BenchResult }) {
  const { gpu } = result
  const parityHolds = gpu && gpu.roleMismatches === 0 && gpu.largestLogitDifference < PARITY_LIMIT
  return (
    <Metadata>
      <MetadataRow label="CPU · TypeScript">{timing(result.cpuMs, result.queries)}</MetadataRow>
      <MetadataRow label="WebGPU · WGSL">
        {gpu ? timing(gpu.ms, result.queries) : 'Not available, CPU is the fallback'}
      </MetadataRow>
      {gpu && (
        <>
          <MetadataRow label="Parity">
            <Tag color={parityHolds ? 'green' : 'red'}>{parityHolds ? 'Holds' : 'Failed'}</Tag>
          </MetadataRow>
          <MetadataRow label="Role mismatches">{gpu.roleMismatches}</MetadataRow>
          <MetadataRow label="Largest score difference">
            {gpu.largestLogitDifference.toExponential(1)} of 1e-3
          </MetadataRow>
          <MetadataRow label="GPU">{gpu.adapter || 'Unknown'}</MetadataRow>
        </>
      )}
      <MetadataRow label="Browser">{browserName()}</MetadataRow>
      <MetadataRow label="Logical cores">{navigator.hardwareConcurrency}</MetadataRow>
    </Metadata>
  )
}

export function BackendsView() {
  const [result, setResult] = useState<BenchResult | null>(null)
  const [running, setRunning] = useState(false)

  const start = () => {
    setRunning(true)
    const script = new URL('../workers/bench.worker.ts', import.meta.url)
    const worker = new Worker(script, { type: 'module' })
    worker.onmessage = (event: MessageEvent<BenchResult>) => {
      setResult(event.data)
      setRunning(false)
      worker.terminate()
    }
    worker.postMessage(null)
  }

  return (
    <>
      <DetailBody>
        <DetailTitle>Backends</DetailTitle>
        <DetailText>
          The same 6-bit weights run as plain TypeScript for single queries and as one WGSL compute
          kernel for batches. This runs 1,024 queries on both, on your machine, in a worker, and
          compares the outputs. GPU time includes upload and readback.
        </DetailText>
        <Button size="sm" variant="secondary" onClick={start} disabled={running}>
          {running ? 'Running…' : 'Run 1,024 Queries on Both'}
        </Button>
      </DetailBody>
      {result && <Results result={result} />}
    </>
  )
}
