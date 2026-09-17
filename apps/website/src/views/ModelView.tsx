import {
  defaultWeights,
  FEATURE_NAMES,
  parameterCount,
  ROLES,
  type Trace,
  type Weights,
} from 'cascade-search'
import { type ReactNode, useState } from 'react'
import { DetailBody, DetailText, DetailTitle, Metadata, MetadataRow } from '@/components/Detail'
import { Heatmap } from '@/components/Heatmap'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import { roleStyle } from '@/lib/roles'
import type { State } from '@/lib/store'

const TOP_ROLES = 5

function stages(trace: Trace) {
  const list = [
    { name: 'embed', data: trace.embed },
    { name: 'conv', data: trace.conv },
  ]
  trace.layers.forEach((layer, index) => {
    list.push({ name: `scan ${index + 1} →`, data: layer.fwd })
    list.push({ name: `scan ${index + 1} ←`, data: layer.bwd })
  })
  return list
}

function hiddenState(trace: Trace, width: number, token: number): Float32Array {
  const list = stages(trace)
  const rows = new Float32Array(list.length * width)
  list.forEach((stage, row) => {
    const slice = stage.data.subarray(token * width, (token + 1) * width)
    let largest = 1e-6
    for (const value of slice) largest = Math.max(largest, Math.abs(value))
    for (let unit = 0; unit < width; unit++) rows[row * width + unit] = slice[unit] / largest
  })
  return rows
}

function roleProbabilities(trace: Trace, weights: Weights, token: number) {
  const start = token * weights.roleCount
  const scaled = ROLES.map((_, role) => trace.logits[start + role] / weights.temperature)
  const peak = Math.max(...scaled)
  const exps = scaled.map(value => Math.exp(value - peak))
  const total = exps.reduce((sum, value) => sum + value, 0)
  return ROLES.map((role, index) => ({ role, p: exps[index] / total }))
    .sort((a, b) => b.p - a.p)
    .slice(0, TOP_ROLES)
}

function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside: string
  children: ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-baseline justify-between text-[13px] text-ray-text">
        {title}
        <span className="font-mono text-[11px] tabular-nums text-ray-faint">{aside}</span>
      </h3>
      {children}
    </section>
  )
}

export function ModelView({ state }: { state: State }) {
  const { trace, features, tokens } = state.local
  const weights = defaultWeights()
  const [picked, setPicked] = useState(0)
  const token = Math.min(picked, tokens.length - 1)

  if (!tokens.length || !trace || !features) {
    return (
      <DetailBody>
        <DetailTitle>Inside the Model</DetailTitle>
        <DetailText>Type a query to see its activations.</DetailText>
      </DetailBody>
    )
  }

  const fired = features[token]
  const roles = roleProbabilities(trace, weights, token)

  return (
    <>
      <DetailBody>
        <DetailTitle>Inside the Model</DetailTitle>
        <DetailText>
          Pick a word and follow it through the network. Everything below is recomputed on every
          keystroke.
        </DetailText>
        <div className="flex flex-wrap gap-1">
          {tokens.map((item, index) => (
            <Button
              key={`${item.text}-${index}`}
              variant="ghost"
              size="sm"
              aria-pressed={index === token}
              onClick={() => setPicked(index)}
              className={`h-7 rounded-md px-2 font-mono text-[13px] font-normal ${index === token ? 'bg-ray-selected text-ray-text' : 'text-ray-dim'}`}
            >
              {item.text}
            </Button>
          ))}
        </div>
        <div className="space-y-6 pt-2">
          <Section title="Features that fired" aside={`${fired.length} of ${FEATURE_NAMES.length}`}>
            <div className="flex flex-wrap gap-1">
              {fired.map(feature => (
                <span
                  key={feature}
                  className="rounded-md bg-ray-selected px-1.5 py-0.5 font-mono text-[11px] text-ray-dim"
                >
                  {FEATURE_NAMES[feature]}
                </span>
              ))}
            </div>
          </Section>
          <Section title="Hidden state" aside={`${weights.width} units per stage`}>
            <Heatmap
              data={hiddenState(trace, weights.width, token)}
              rows={stages(trace).length}
              columns={weights.width}
              rowLabels={stages(trace).map(stage => stage.name)}
            />
          </Section>
          <Section title="Role scores" aside={`softmax, T ${weights.temperature.toFixed(2)}`}>
            <ul className="space-y-1.5">
              {roles.map(({ role, p }) => (
                <li key={role} className="flex h-6 items-center gap-3">
                  <span className="w-[30%]">
                    <Tag color={roleStyle(role).color}>{roleStyle(role).name}</Tag>
                  </span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ray-selected">
                    <span
                      className="block h-full rounded-full bg-ray-text"
                      style={{ width: `${Math.max(p * 100, 0.5)}%` }}
                    />
                  </span>
                  <span className="w-11 text-right font-mono text-xs tabular-nums text-ray-dim">
                    {p.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </DetailBody>
      <Metadata>
        <MetadataRow label="Parameters">{parameterCount(weights).toLocaleString()}</MetadataRow>
        <MetadataRow label="Weights">6-bit integers</MetadataRow>
        <MetadataRow label="Stages">embed, conv, 2 × bidirectional gated scan</MetadataRow>
      </Metadata>
    </>
  )
}
