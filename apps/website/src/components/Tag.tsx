import type { ReactNode } from 'react'

export type TagColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'magenta'
  | 'gray'

const COLOR_VARIABLE: Record<TagColor, string> = {
  red: 'var(--ray-red)',
  orange: 'var(--ray-orange)',
  yellow: 'var(--ray-yellow)',
  green: 'var(--ray-green)',
  blue: 'var(--ray-blue)',
  purple: 'var(--ray-purple)',
  magenta: 'var(--ray-magenta)',
  gray: 'var(--ray-dim)',
}

export function Tag({ color, children }: { color: TagColor; children: ReactNode }) {
  const tint = COLOR_VARIABLE[color]
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-md px-1.5 text-xs font-medium"
      style={{ color: tint, background: `color-mix(in srgb, ${tint} 16%, transparent)` }}
    >
      {children}
    </span>
  )
}
