import { pretty, spanLength, type TokenResult } from 'cascade-search'
import {
  DetailBody,
  DetailText,
  DetailTitle,
  Metadata,
  MetadataControl,
  MetadataRow,
} from '@/components/Detail'
import { Tag } from '@/components/Tag'
import { Slider } from '@/components/ui/slider'
import { roleStyle } from '@/lib/roles'
import { type State, update } from '@/lib/store'

const THRESHOLD_STEP = 0.005

function isUnsure(token: TokenResult, threshold: number): boolean {
  return token.tier === 'jev' || token.confidence < threshold
}

function WordRow({ token, threshold }: { token: TokenResult; threshold: number }) {
  const style = roleStyle(token.role)
  const unsure = isUnsure(token, threshold)
  return (
    <li className="flex h-9 items-center gap-3">
      <span className="w-[30%] truncate font-mono text-[13px]">{token.text}</span>
      <span className="w-[26%]">
        <Tag color={style.color}>{style.name}</Tag>
      </span>
      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-ray-selected">
        <span
          className={`block h-full rounded-full ${unsure ? 'bg-ray-orange' : 'bg-ray-green'}`}
          style={{ width: `${token.confidence * 100}%` }}
        />
      </span>
      <span className="w-11 text-right font-mono text-xs tabular-nums text-ray-dim">
        {token.confidence.toFixed(3)}
      </span>
    </li>
  )
}

function TierTag({ state }: { state: State }) {
  if (state.phase === 'jev') return <Tag color="orange">Escalated to Jev</Tag>
  if (state.phase === 'pending') return <Tag color="orange">Asking Jev</Tag>
  if (state.phase === 'degraded') return <Tag color="red">Local only</Tag>
  return <Tag color="green">Local</Tag>
}

function latency(state: State): string {
  const local = `${state.localMs.toFixed(2)} ms`
  return state.phase === 'jev' ? `${local} + ${state.remoteMs.toFixed(0)} ms` : local
}

export function ParseView({ state }: { state: State }) {
  const { tokens, ir, minConfidence } = state.result
  const sent = state.local.spans.reduce((total, span) => total + spanLength(span), 0)

  if (!tokens.length) {
    return (
      <DetailBody>
        <DetailTitle>How it was read</DetailTitle>
        <DetailText>Type a query. Every word gets a role and a confidence.</DetailText>
      </DetailBody>
    )
  }

  return (
    <>
      <DetailBody>
        <DetailTitle>How it was read</DetailTitle>
        <ul>
          {tokens.map(token => (
            <WordRow key={token.start} token={token} threshold={state.threshold} />
          ))}
        </ul>
      </DetailBody>
      <Metadata>
        <MetadataRow label={`Escalate below ${state.threshold.toFixed(3)}`}>
          <MetadataControl>
            <Slider
              aria-label="Escalation threshold"
              min={0}
              max={1}
              step={THRESHOLD_STEP}
              value={[state.threshold]}
              onValueChange={value =>
                update({ threshold: Array.isArray(value) ? value[0] : value })
              }
            />
          </MetadataControl>
        </MetadataRow>
        <MetadataRow label="Tier">
          <TierTag state={state} />
        </MetadataRow>
        <MetadataRow label="Latency">{latency(state)}</MetadataRow>
        <MetadataRow label="Lowest confidence">{minConfidence.toFixed(3)}</MetadataRow>
        <MetadataRow label="Sent to Jev">
          {sent === 0 ? 'Nothing' : `${sent} of ${tokens.length} words`}
        </MetadataRow>
        <MetadataRow label="Filter">
          <span className="font-mono text-xs break-words">{pretty(ir) || '∅'}</span>
        </MetadataRow>
      </Metadata>
    </>
  )
}
