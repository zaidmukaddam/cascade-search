import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import type { State } from '@/lib/store'

function Key({ children }: { children: ReactNode }) {
  return (
    <Kbd className="h-5 min-w-5 rounded-[5px] bg-ray-key px-1 text-[11px] text-ray-dim">
      {children}
    </Kbd>
  )
}

function AppMark() {
  return (
    <span className="flex size-5 items-center justify-center rounded-[5px] bg-ray-red">
      <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
        <path
          d="M3.5 4.5h9M3.5 8h6M3.5 11.5h3"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

function statusText(state: State): string {
  const local = `${state.localMs.toFixed(2)} ms`
  if (state.phase === 'jev') return `Escalated to Jev in ${state.remoteMs.toFixed(0)} ms`
  if (state.phase === 'pending') return `Local in ${local}, asking Jev…`
  if (state.phase === 'degraded') return `Local only, ${state.reason}`
  return `Parsed locally in ${local}`
}

interface ActionBarProps {
  state: State
  onOpenActions: () => void
}

export function ActionBar({ state, onOpenActions }: ActionBarProps) {
  const escalated = state.phase !== 'idle'
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-t border-ray-line px-3 text-[13px]">
      <AppMark />
      <span
        className={`min-w-0 truncate tabular-nums ${escalated ? 'text-ray-orange' : 'text-ray-dim'}`}
      >
        {statusText(state)}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-2 sm:flex">
          <span className="font-medium">Open Issue</span>
          <Key>↵</Key>
        </span>
        <span className="hidden h-3 w-px bg-ray-line sm:block" />
        <Button
          variant="ghost"
          size="sm"
          onPointerDown={event => event.stopPropagation()}
          onClick={onOpenActions}
          className="h-7 gap-2 px-1.5 text-[13px] font-normal hover:bg-ray-selected dark:hover:bg-ray-selected"
        >
          <span className="text-ray-dim">Actions</span>
          <span className="hidden gap-0.5 md:flex">
            <Key>⌘</Key>
            <Key>K</Key>
          </span>
        </Button>
      </div>
    </div>
  )
}
