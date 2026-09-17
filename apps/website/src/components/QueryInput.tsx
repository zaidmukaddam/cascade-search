import type { TokenResult } from 'cascade-search'
import { Command } from 'cmdk'
import type { ReactNode } from 'react'
import { type State, update } from '@/lib/store'

const TEXT = 'font-sans text-[17px] leading-6 tracking-[-0.01em]'

function needsSecondOpinion(token: TokenResult, threshold: number): boolean {
  return token.tier === 'jev' || token.confidence < threshold
}

function Underlines({ state }: { state: State }) {
  const pieces: ReactNode[] = []
  let cursor = 0
  for (const token of state.result.tokens) {
    pieces.push(state.query.slice(cursor, token.start))
    const flagged = needsSecondOpinion(token, state.threshold)
    pieces.push(
      <span key={token.start} className={flagged ? 'border-b-2 border-tier-jev' : undefined}>
        {state.query.slice(token.start, token.end)}
      </span>,
    )
    cursor = token.end
  }
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-transparent ${TEXT}`}
    >
      {pieces}
    </div>
  )
}

interface QueryInputProps {
  state: State
  accessory: ReactNode
}

export function QueryInput({ state, accessory }: QueryInputProps) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ray-line px-4">
      <div className="relative h-full min-w-0 flex-1">
        <Underlines state={state} />
        <Command.Input
          data-query-input
          autoFocus
          value={state.query}
          onValueChange={query => update({ query })}
          placeholder="Search issues in plain words…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`relative h-full w-full bg-transparent text-ray-text outline-none placeholder:text-ray-faint ${TEXT}`}
        />
      </div>
      {accessory}
    </div>
  )
}
