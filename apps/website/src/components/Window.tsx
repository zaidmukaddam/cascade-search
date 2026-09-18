import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command } from '@/components/ui/command'
import { aggregate, run } from '@/lib/execute'
import { makeIssues } from '@/lib/issues'
import { closeIssue, showView, useStore } from '@/lib/store'
import { viewName } from '@/lib/views'
import { ActionBar } from './ActionBar.tsx'
import { ActionsPanel } from './ActionsPanel.tsx'
import { Chart } from './Chart.tsx'
import { IssueList } from './IssueList.tsx'
import { Pane } from './Pane.tsx'
import { QueryInput } from './QueryInput.tsx'
import { ViewDropdown } from './ViewDropdown.tsx'

const NOW = Date.now()

const QUERY_INPUT = '[data-query-input]'

function useCommandK(toggle: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isCommandK) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <Button
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 flex-1 truncate rounded-lg text-[13px] font-medium ${active ? 'bg-ray-selected text-ray-text' : 'text-ray-dim'}`}
    >
      {children}
    </Button>
  )
}

export function Window() {
  const state = useStore()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [tab, setTab] = useState<'results' | 'pane'>('pane')
  useEffect(() => {
    if (state.openIssue) setTab('pane')
  }, [state.openIssue])
  useEffect(() => {
    if (state.view) setTab('pane')
  }, [state.view])
  const frame = useRef<HTMLDivElement>(null)
  const issues = useMemo(() => makeIssues(NOW), [])
  const filter = state.result.ir
  const matches = useMemo(
    () => run(issues, filter, state.schema, NOW),
    [issues, filter, state.schema],
  )

  const slices = useMemo(
    () => aggregate(issues, filter, state.schema, NOW),
    [issues, filter, state.schema],
  )

  const toggleActions = useMemo(() => () => setActionsOpen(open => !open), [])
  useCommandK(toggleActions)

  const closeActions = () => {
    setActionsOpen(false)
    frame.current?.querySelector<HTMLInputElement>(QUERY_INPUT)?.focus()
  }

  return (
    <div ref={frame} className="relative w-full max-w-[880px]">
      <Command
        shouldFilter={false}
        label="Search issues"
        onKeyDown={event => {
          if (event.key === 'Escape' && state.openIssue) closeIssue()
        }}
        className="h-svh rounded-none! bg-ray-window p-0 pb-[env(safe-area-inset-bottom)] text-ray-text backdrop-blur-[40px] backdrop-saturate-150 md:h-[540px] md:rounded-[14px]! md:border md:border-ray-edge md:pb-0 md:shadow-ray-window"
      >
        <QueryInput
          state={state}
          accessory={<ViewDropdown view={state.view} onChange={showView} />}
        />
        <div className="flex shrink-0 gap-1 border-b border-ray-line p-1.5 md:hidden">
          <TabButton active={tab === 'results'} onClick={() => setTab('results')}>
            Results · {matches.length.toLocaleString()}
          </TabButton>
          <TabButton active={tab === 'pane'} onClick={() => setTab('pane')}>
            {state.openIssue ? 'Issue' : viewName(state.view)}
          </TabButton>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className={`flex min-h-0 flex-col ${tab === 'results' ? '' : 'max-md:hidden'}`}>
            {filter.view && <Chart view={filter.view} slices={slices} />}
            <div className="min-h-0 flex-1">
              <IssueList matches={matches} total={issues.length} />
            </div>
          </div>
          <div className={`min-h-0 ${tab === 'pane' ? '' : 'max-md:hidden'}`}>
            <Pane state={state} />
          </div>
        </div>
        <ActionBar state={state} onOpenActions={toggleActions} />
      </Command>
      {actionsOpen && <ActionsPanel onClose={closeActions} />}
    </div>
  )
}
