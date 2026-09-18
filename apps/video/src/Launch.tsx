import { linearTiming, springTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { pushThrough } from '@/components/remocn/push-through'
import { StaggeredFadeUp } from '@/components/remocn/staggered-fade-up'
import { Typewriter } from '@/components/remocn/typewriter'
import { ACCENT, DIM, FAINT, FONT, MONO, PAGE, TEXT } from './theme.ts'
import { Window } from './Window.tsx'

const HOOK = 120
const TYPING = 300
const ESCALATION = 330
const PROOF = 210
const CTA = 150
const PUSH = 36
const FADE = 18

export const LAUNCH_FRAMES = HOOK + TYPING + ESCALATION + PROOF + CTA - PUSH * 2 - FADE * 2

function Caption({ children, from }: { children: string; from: number }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [from, from + 12], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 44,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: 20,
        color: DIM,
        opacity,
      }}
    >
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  from,
  to,
}: {
  label: string
  value?: string
  accent?: boolean
  from?: number
  to?: number
}) {
  const frame = useCurrentFrame()
  const rise = interpolate(frame, [0, 24], [24, 0], { extrapolateRight: 'clamp' })
  const opacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp' })
  const counted =
    from !== undefined && to !== undefined
      ? interpolate(frame, [20, 110], [from, to], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }).toFixed(1)
      : undefined
  return (
    <div
      style={{
        flex: 1,
        padding: '28px 32px',
        borderRadius: 16,
        border: '1px solid rgb(255 255 255 / 0.1)',
        background: 'rgb(32 32 35 / 0.92)',
        transform: `translateY(${rise}px)`,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 64,
          fontWeight: 500,
          color: accent ? ACCENT : TEXT,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}
      >
        {counted ? `${counted}%` : value}
      </div>
      <div style={{ marginTop: 10, fontSize: 18, color: DIM }}>{label}</div>
    </div>
  )
}

function Proof() {
  return (
    <AbsoluteFill style={{ fontFamily: FONT, padding: '0 90px', justifyContent: 'center' }}>
      <div style={{ fontSize: 22, color: DIM, marginBottom: 28 }}>
        On schemas the model never trained on
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <Stat value="27K" label="parameters, 35 KB on the wire" />
        <Stat value="0.25 ms" label="per query, in the browser" />
        <Stat from={93.5} to={97.2} accent label="exact filters, local → with Jev" />
      </div>
      <div style={{ marginTop: 28, fontSize: 18, color: FAINT }}>
        18.5% of queries touch the network · $0.008 per thousand
      </div>
    </AbsoluteFill>
  )
}

function Cta() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill>
      <Typewriter
        text="npm i cascade-search"
        charsPerSecond={18}
        fontSize={56}
        fontWeight={500}
        color={TEXT}
        cursorColor={ACCENT}
        className="mono"
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 430,
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: 24,
          color: DIM,
          opacity,
        }}
      >
        cascade.scira.ai · MIT
      </div>
    </AbsoluteFill>
  )
}

export function Launch() {
  return (
    <AbsoluteFill style={{ background: PAGE }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(40% 40% at 15% 10%, rgb(255 110 70 / 0.16), transparent 70%), radial-gradient(40% 45% at 88% 90%, rgb(70 150 255 / 0.14), transparent 70%)',
        }}
      />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK}>
          <StaggeredFadeUp
            text="A search bar that knows when it doesn't know"
            fontSize={58}
            color={TEXT}
            staggerDelay={4}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={pushThrough()}
          timing={linearTiming({ durationInFrames: PUSH })}
        />

        <TransitionSeries.Sequence durationInFrames={TYPING}>
          <Window query="open bugs from sam since last week" typeFrom={10} />
          <Caption from={150}>Every word gets a role and a calibrated confidence</Caption>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ durationInFrames: FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={ESCALATION}>
          <Window
            query="timeout auth sam kinda recent"
            typeFrom={6}
            escalation={{
              atFrame: 200,
              ms: 588,
              decisions: [
                { token: 'timeout', role: 'VAL_TEXT', confidence: 0.981 },
                { token: 'auth', role: 'VAL_TEXT', confidence: 0.992 },
                { token: 'kinda', role: 'O', confidence: 0.995 },
                { token: 'recent', role: 'VAL_DATE', confidence: 0.974 },
              ],
            }}
          />
          <Caption from={120}>Unsure words, and only those, go to Jev for a typed decision</Caption>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ durationInFrames: FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={PROOF}>
          <Proof />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={pushThrough()}
          timing={linearTiming({ durationInFrames: PUSH })}
        />

        <TransitionSeries.Sequence durationInFrames={CTA}>
          <Cta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  )
}
