import { BugIcon, type Icon, SparkleIcon, WrenchIcon } from '@phosphor-icons/react'
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import type { Issue } from '@/lib/issues'
import { openIssue } from '@/lib/store'

const VISIBLE = 40

const TYPE_ICON: Record<string, { icon: Icon; color: string }> = {
  bug: { icon: BugIcon, color: 'var(--ray-red)' },
  feature: { icon: SparkleIcon, color: 'var(--ray-blue)' },
  chore: { icon: WrenchIcon, color: 'var(--ray-dim)' },
}

const STATUS_COLOR: Record<string, string> = {
  open: 'text-ray-green',
  closed: 'text-ray-faint',
  blocked: 'text-ray-orange',
}

function TypeTile({ type }: { type: string }) {
  const { icon: TypeIcon, color } = TYPE_ICON[type] ?? TYPE_ICON.chore
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-md"
      style={{ color, background: `color-mix(in srgb, ${color} 18%, transparent)` }}
    >
      <TypeIcon weight="fill" className="size-3.5" />
    </span>
  )
}

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <CommandItem
      value={String(issue.id)}
      onSelect={() => openIssue(issue)}
      className="h-10 cursor-pointer gap-3 rounded-lg px-2 text-[13px] text-ray-text data-selected:bg-ray-selected"
    >
      <TypeTile type={issue.type} />
      <span className="min-w-0 truncate">{issue.title}</span>
      <span className="min-w-0 shrink-[2] truncate text-ray-dim">{issue.author}</span>
      <CommandShortcut className={`shrink-0 text-xs tracking-normal ${STATUS_COLOR[issue.status]}`}>
        {issue.status}
      </CommandShortcut>
    </CommandItem>
  )
}

export function IssueList({ matches, total }: { matches: Issue[]; total: number }) {
  return (
    <CommandList className="h-full max-h-none px-2 pb-2">
      <CommandEmpty className="py-16 text-center text-[13px] text-ray-dim">
        No issues match this filter
      </CommandEmpty>
      {matches.length > 0 && (
        <CommandGroup
          heading={`Results · ${matches.length.toLocaleString()} of ${total.toLocaleString()}`}
          className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-ray-dim"
        >
          {matches.slice(0, VISIBLE).map(issue => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </CommandGroup>
      )}
    </CommandList>
  )
}
