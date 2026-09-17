import type { ReactNode } from 'react'

export function DetailBody({ children }: { children: ReactNode }) {
  return <div className="space-y-4 p-5">{children}</div>
}

export function DetailTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>
}

export function DetailText({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-ray-dim">{children}</p>
}

export function Metadata({ children }: { children: ReactNode }) {
  return <dl className="border-t border-ray-line px-5">{children}</dl>
}

interface MetadataRowProps {
  label: string
  children: ReactNode
}

export function MetadataControl({ children }: { children: ReactNode }) {
  return <div className="w-40">{children}</div>
}

export function MetadataRow({ label, children }: MetadataRowProps) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-6 border-b border-ray-line py-2 last:border-0">
      <dt className="shrink-0 text-[13px] text-ray-dim">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] tabular-nums">{children}</dd>
    </div>
  )
}
