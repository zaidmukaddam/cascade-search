import { useEffect, useMemo, useRef, useState } from 'react'
import { Command } from '@/components/ui/command'
import { run } from '@/lib/execute'
import { makeIssues } from '@/lib/issues'
import { closeIssue, showView, useStore } from '@/lib/store'
import { ActionBar } from './ActionBar.tsx'
import { ActionsPanel } from './ActionsPanel.tsx'
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

export function Window() {
  const state = useStore()
  const [actionsOpen, setActionsOpen] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const issues = useMemo(() => makeIssues(NOW), [])
  const filter = state.result.ir
  const matches = useMemo(
    () => run(issues, filter, state.schema, NOW),
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
        className="h-[calc(100svh-7rem)] max-h-[720px] rounded-[14px]! border border-ray-edge bg-ray-window p-0 text-ray-text shadow-ray-window backdrop-blur-[40px] backdrop-saturate-150 md:h-[540px]"
      >
        <QueryInput
          state={state}
          accessory={<ViewDropdown view={state.view} onChange={showView} />}
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[11rem_minmax(0,1fr)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-1">
          <IssueList matches={matches} total={issues.length} />
          <Pane state={state} />
        </div>
        <ActionBar state={state} onOpenActions={toggleActions} />
      </Command>
      {actionsOpen && <ActionsPanel onClose={closeActions} />}
    </div>
  )
}
