import { useState } from 'react'
import {
  DetailBody,
  DetailText,
  DetailTitle,
  Metadata,
  MetadataControl,
  MetadataRow,
} from '@/components/Detail'
import { Slider } from '@/components/ui/slider'
import { compactCount, dollars, percent } from '@/lib/format'
import { sweep } from '@/lib/results'
import type { State } from '@/lib/store'

const DAYS_PER_MONTH = 30
const DEFAULT_QUERIES_PER_DAY = 50_000
const TOKENS_PER_MILLION = 1e6

type SweepRow = (typeof sweep.rows)[number]
type Measure = 'callsPerQuery' | 'queriesEscalated' | 'accuracy'

function surroundingRows(threshold: number): [SweepRow, SweepRow] {
  const above = sweep.rows.findIndex(row => row.threshold >= threshold)
  if (above < 0) {
    const last = sweep.rows[sweep.rows.length - 1]
    return [last, last]
  }
  return [sweep.rows[Math.max(0, above - 1)], sweep.rows[above]]
}

function interpolate(threshold: number, measure: Measure): number {
  const [below, above] = surroundingRows(threshold)
  if (above.threshold === below.threshold) return below[measure]
  const position = (threshold - below.threshold) / (above.threshold - below.threshold)
  return below[measure] + (above[measure] - below[measure]) * position
}

function firstValue(value: number | readonly number[]): number {
  return typeof value === 'number' ? value : value[0]
}

export function CostView({ state }: { state: State }) {
  const { threshold } = state
  const [queriesPerDay, setQueriesPerDay] = useState(DEFAULT_QUERIES_PER_DAY)
  const [price, setPrice] = useState(sweep.cost.jevDollarsPerMillionInputTokens)

  const callsPerMonth = queriesPerDay * DAYS_PER_MONTH * interpolate(threshold, 'callsPerQuery')
  const bill = (callsPerMonth * sweep.inputTokensPerCall * price) / TOKENS_PER_MILLION

  return (
    <>
      <DetailBody>
        <DetailTitle>Cost</DetailTitle>
        <DetailText>
          What the escalation threshold costs. It reads the same threshold as the Parse view, which
          is {threshold.toFixed(3)} right now.
        </DetailText>
        <p className="text-[32px] font-semibold tracking-tight tabular-nums">
          {dollars(bill)}
          <span className="ml-1.5 text-[13px] font-normal text-ray-dim">per month</span>
        </p>
      </DetailBody>
      <Metadata>
        <MetadataRow label={`Queries per day · ${queriesPerDay.toLocaleString()}`}>
          <MetadataControl>
            <Slider
              aria-label="Queries per day"
              min={3}
              max={7}
              step={0.01}
              value={[Math.log10(queriesPerDay)]}
              onValueChange={value => setQueriesPerDay(Math.round(10 ** firstValue(value)))}
            />
          </MetadataControl>
        </MetadataRow>
        <MetadataRow label={`Price per 1M tokens · $${price.toFixed(3)}`}>
          <MetadataControl>
            <Slider
              aria-label="Jev price per million input tokens"
              min={0.01}
              max={0.5}
              step={0.001}
              value={[price]}
              onValueChange={value => setPrice(firstValue(value))}
            />
          </MetadataControl>
        </MetadataRow>
        <MetadataRow label="Jev calls per month">{compactCount(callsPerMonth)}</MetadataRow>
        <MetadataRow label="Queries that wait on Jev">
          {percent(interpolate(threshold, 'queriesEscalated'))}
        </MetadataRow>
        <MetadataRow label="Exact filters">
          {percent(interpolate(threshold, 'accuracy'))}
        </MetadataRow>
        <MetadataRow label="Input tokens per call">
          {Math.round(sweep.inputTokensPerCall).toLocaleString()}
        </MetadataRow>
        <MetadataRow label="Measured">
          {sweep.date} · live Jev · {sweep.queries} queries
        </MetadataRow>
        <MetadataRow label="Failed escalations">
          {sweep.failedEscalations} of {sweep.jevCalls} calls
        </MetadataRow>
      </Metadata>
    </>
  )
}
