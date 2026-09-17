import {
  ChartLineUpIcon,
  CircuitryIcon,
  CodeIcon,
  CoinsIcon,
  CpuIcon,
  DownloadSimpleIcon,
  type Icon,
  MagnifyingGlassIcon,
  MoonIcon,
  TableIcon,
  TargetIcon,
  TextAaIcon,
} from '@phosphor-icons/react'
import { Command as Cmdk } from 'cmdk'
import { useEffect, useRef } from 'react'
import { CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { downloadLog } from '@/lib/log'
import { LABELED_EXAMPLES } from '@/lib/schema'
import { showView, update } from '@/lib/store'
import { toggleTheme } from '@/lib/theme'
import { VIEWS, type ViewId } from '@/lib/views'

const GROUP_HEADING =
  '**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:pt-2.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-ray-dim'

const VIEW_ICON: Record<ViewId, Icon> = {
  parse: TextAaIcon,
  schema: TableIcon,
  model: CircuitryIcon,
  backends: CpuIcon,
  curve: ChartLineUpIcon,
  cost: CoinsIcon,
  accuracy: TargetIcon,
  install: CodeIcon,
}

interface ActionProps {
  icon: Icon
  label: string
  keywords?: string
  onRun: () => void
}

function Action({ icon: ActionIcon, label, keywords, onRun }: ActionProps) {
  return (
    <CommandItem
      value={`${label} ${keywords ?? ''}`}
      onSelect={onRun}
      className="h-9 gap-2.5 rounded-lg px-2 text-[13px] text-ray-text data-selected:bg-ray-selected"
    >
      <ActionIcon className="size-4 text-ray-dim" />
      <span className="truncate">{label}</span>
    </CommandItem>
  )
}

function useDismissOnOutsidePress(onDismiss: () => void) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onDismiss])
  return panel
}

export function ActionsPanel({ onClose }: { onClose: () => void }) {
  const panel = useDismissOnOutsidePress(onClose)
  const run = (action: () => void) => () => {
    action()
    onClose()
  }

  return (
    <div
      ref={panel}
      className="absolute bottom-12 right-2 z-10 w-80 overflow-hidden rounded-xl border border-ray-edge bg-ray-window shadow-ray-window backdrop-blur-[40px]"
    >
      <Cmdk
        label="Actions"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <CommandList className="max-h-72 px-1.5 pb-1.5">
          <Cmdk.Empty className="py-6 text-center text-[13px] text-ray-dim">No actions</Cmdk.Empty>
          <CommandGroup heading="Show" className={GROUP_HEADING}>
            {VIEWS.map(view => (
              <Action
                key={view.id}
                icon={VIEW_ICON[view.id]}
                label={view.name}
                keywords="view show"
                onRun={run(() => showView(view.id))}
              />
            ))}
          </CommandGroup>
          <CommandGroup heading="Try a query" className={GROUP_HEADING}>
            {LABELED_EXAMPLES.map(example => (
              <Action
                key={example.query}
                icon={MagnifyingGlassIcon}
                label={example.query}
                keywords={example.label}
                onRun={run(() => update({ query: example.query }))}
              />
            ))}
          </CommandGroup>
          <CommandGroup heading="Window" className={GROUP_HEADING}>
            <Action
              icon={MoonIcon}
              label="Toggle Appearance"
              keywords="theme dark light"
              onRun={run(() => toggleTheme())}
            />
            <Action
              icon={DownloadSimpleIcon}
              label="Export Escalation Log"
              keywords="download json"
              onRun={run(() => downloadLog())}
            />
          </CommandGroup>
        </CommandList>
        <Cmdk.Input
          autoFocus
          placeholder="Search for actions…"
          className="h-10 w-full border-t border-ray-line bg-transparent px-3.5 text-[13px] text-ray-text outline-none placeholder:text-ray-faint"
        />
      </Cmdk>
    </div>
  )
}
