import { parse, type TokenResult } from 'cascade-search'
import { interpolate, useCurrentFrame } from 'remotion'
import { SCHEMA } from '../../website/src/lib/schema.ts'
import {
  ACCENT,
  DIM,
  EDGE,
  FAINT,
  FONT,
  GREEN,
  LINE,
  MONO,
  ROLE_COLOR,
  ROLE_NAME,
  TEXT,
  TRACK,
  WINDOW,
} from './theme.ts'

const THRESHOLD = 0.97
const CHARS_PER_FRAME = 0.4

export interface JevDecision {
  token: string
  role: string
  confidence: number
}

export interface Escalation {
  atFrame: number
  ms: number
  decisions: JevDecision[]
}

interface WindowProps {
  query: string
  typeFrom?: number
  escalation?: Escalation
}

function Tag({ role }: { role: string }) {
  const tint = ROLE_COLOR[role] ?? DIM
  return (
    <span
      style={{
        display: 'inline-block',
        height: 26,
        lineHeight: '26px',
        padding: '0 8px',
        borderRadius: 7,
        fontSize: 15,
        fontWeight: 500,
        color: tint,
        background: `color-mix(in srgb, ${tint} 16%, transparent)`,
      }}
    >
      {ROLE_NAME[role] ?? role}
    </span>
  )
}

function WordRow({ token, unsure }: { token: TokenResult; unsure: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 38 }}>
      <span style={{ width: 150, fontFamily: MONO, fontSize: 17, color: TEXT }}>{token.text}</span>
      <span style={{ width: 130 }}>
        <Tag role={token.role} />
      </span>
      <span
        style={{ flex: 1, height: 5, borderRadius: 999, background: TRACK, overflow: 'hidden' }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${token.confidence * 100}%`,
            borderRadius: 999,
            background: unsure ? ACCENT : GREEN,
          }}
        />
      </span>
      <span style={{ width: 56, textAlign: 'right', fontFamily: MONO, fontSize: 15, color: DIM }}>
        {token.confidence.toFixed(3)}
      </span>
    </div>
  )
}

function Meta({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 40,
        borderTop: `1px solid ${LINE}`,
        fontSize: 15,
      }}
    >
      <span style={{ color: DIM }}>{label}</span>
      <span style={{ color: tint ?? TEXT, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

export function Window({ query, typeFrom = 0, escalation }: WindowProps) {
  const frame = useCurrentFrame()
  const typed = Math.min(query.length, Math.floor(Math.max(0, frame - typeFrom) * CHARS_PER_FRAME))
  const text = query.slice(0, typed)
  const result = parse(text, SCHEMA, { threshold: THRESHOLD })
  const jevDone = escalation !== undefined && frame >= escalation.atFrame
  const jevPending = escalation !== undefined && typed === query.length && !jevDone

  const tokens = result.tokens.map(token => {
    const decision = jevDone
      ? escalation.decisions.find(candidate => candidate.token === token.text)
      : undefined
    return decision
      ? { ...token, role: decision.role as TokenResult['role'], confidence: decision.confidence }
      : token
  })
  const unsure = (token: TokenResult) => !jevDone && token.confidence < THRESHOLD
  const unsureCount = tokens.filter(unsure).length
  const caretOn = Math.floor(frame / 15) % 2 === 0

  const status = jevDone
    ? `Escalated to Jev in ${escalation.ms} ms`
    : jevPending
      ? 'Local in 0.25 ms, asking Jev…'
      : 'Parsed locally in 0.25 ms'

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 36,
        fontFamily: FONT,
        opacity: enter,
        transform: `scale(${0.96 + enter * 0.04})`,
      }}
    >
      <div
        style={{
          width: 960,
          borderRadius: 16,
          border: `1px solid ${EDGE}`,
          background: WINDOW,
          boxShadow: '0 30px 80px rgb(0 0 0 / 0.5)',
          color: TEXT,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 64,
            padding: '0 22px',
            borderBottom: `1px solid ${LINE}`,
            fontSize: 22,
          }}
        >
          {tokens.map((token, index) => (
            <span
              key={`${token.text}-${index}`}
              style={{
                marginRight: 7,
                textDecoration: unsure(token) ? 'underline' : 'none',
                textDecorationColor: ACCENT,
                textDecorationThickness: 2,
                textUnderlineOffset: 5,
              }}
            >
              {token.text}
            </span>
          ))}
          {text.endsWith(' ') && <span> </span>}
          <span
            style={{
              width: 2,
              height: 26,
              background: TEXT,
              opacity: caretOn ? 1 : 0,
              marginLeft: -4,
            }}
          />
          <span style={{ marginLeft: 'auto', fontSize: 15, color: DIM }}>
            {unsureCount > 0
              ? `unsure about ${unsureCount} of ${tokens.length} words`
              : `${tokens.length} words`}
          </span>
        </div>
        <div style={{ padding: '18px 22px 6px' }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>How it was read</div>
          {tokens.map((token, index) => (
            <WordRow key={`${token.text}-${index}`} token={token} unsure={unsure(token)} />
          ))}
          {tokens.length === 0 && <div style={{ height: 44, color: FAINT }}>Type a query</div>}
        </div>
        <div style={{ padding: '6px 22px 4px' }}>
          <Meta
            label="Tier"
            value={jevDone ? 'Escalated to Jev' : 'Local'}
            tint={jevDone ? ACCENT : GREEN}
          />
          <Meta label="Latency" value={jevDone ? `0.25 ms + ${escalation.ms} ms` : '0.25 ms'} />
          <Meta
            label="Sent to Jev"
            value={
              jevDone
                ? `${escalation.decisions.length} of ${tokens.length} words`
                : unsureCount > 0
                  ? `${unsureCount} of ${tokens.length} words`
                  : 'Nothing'
            }
            tint={jevDone || unsureCount > 0 ? ACCENT : undefined}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 44,
            padding: '0 22px',
            borderTop: `1px solid ${LINE}`,
            fontSize: 15,
            color: jevDone || jevPending ? ACCENT : DIM,
          }}
        >
          {status}
        </div>
      </div>
    </div>
  )
}
