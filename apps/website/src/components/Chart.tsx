import type { View } from 'cascade-search'
import type { Slice } from '@/lib/execute'

const PALETTE = [
  'var(--ray-blue)',
  'var(--ray-orange)',
  'var(--ray-green)',
  'var(--ray-purple)',
  'var(--ray-yellow)',
  'var(--ray-magenta)',
]
const MOST_PIE_SLICES = PALETTE.length
const LINE_WIDTH = 320
const LINE_HEIGHT = 96
const PIE_RADIUS = 44

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

function title(view: View): string {
  const what =
    view.agg === 'count' ? 'Count' : `${view.agg === 'sum' ? 'Total' : 'Average'} ${view.of}`
  return view.by ? `${what} by ${view.by}` : what
}

function BigNumber({ slices }: { slices: Slice[] }) {
  return (
    <p className="text-4xl font-semibold tabular-nums tracking-tight">
      {NUMBER_FORMAT.format(slices[0]?.value ?? 0)}
    </p>
  )
}

function Bars({ slices }: { slices: Slice[] }) {
  const largest = Math.max(1e-9, ...slices.map(slice => slice.value))
  return (
    <ul className="space-y-1.5">
      {slices.map(slice => (
        <li key={slice.label} className="flex items-center gap-3 text-[13px]">
          <span className="w-24 shrink-0 truncate text-ray-dim">{slice.label}</span>
          <span className="h-4 min-w-0 flex-1">
            <span
              className="block h-full min-w-[2px] rounded-r-[4px] bg-ray-blue"
              style={{ width: `${(slice.value / largest) * 100}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums">
            {NUMBER_FORMAT.format(slice.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function arc(from: number, to: number): string {
  const point = (turn: number) => {
    const angle = turn * 2 * Math.PI - Math.PI / 2
    return `${50 + PIE_RADIUS * Math.cos(angle)} ${50 + PIE_RADIUS * Math.sin(angle)}`
  }
  const large = to - from > 0.5 ? 1 : 0
  return `M50 50 L${point(from)} A${PIE_RADIUS} ${PIE_RADIUS} 0 ${large} 1 ${point(to)} Z`
}

function Pie({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1
  let turned = 0
  const wedges = slices.map((slice, index) => {
    const from = turned
    turned += slice.value / total
    return { slice, from, to: turned, color: PALETTE[index] }
  })
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0" role="img" aria-label="Pie chart">
        {wedges.map(({ slice, from, to, color }) =>
          to - from >= 0.999 ? (
            <circle key={slice.label} cx="50" cy="50" r={PIE_RADIUS} fill={color} />
          ) : (
            <path
              key={slice.label}
              d={arc(from, to)}
              fill={color}
              stroke="var(--ray-window)"
              strokeWidth="1.5"
            />
          ),
        )}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-[13px]">
        {wedges.map(({ slice, color }) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
            <span className="min-w-0 flex-1 truncate text-ray-dim">{slice.label}</span>
            <span className="font-mono text-xs tabular-nums">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Line({ slices }: { slices: Slice[] }) {
  const largest = Math.max(1e-9, ...slices.map(slice => slice.value))
  const step = slices.length > 1 ? LINE_WIDTH / (slices.length - 1) : 0
  const points = slices.map((slice, index) => ({
    x: index * step,
    y: LINE_HEIGHT - (slice.value / largest) * (LINE_HEIGHT - 8) - 4,
  }))
  const path = points.map(point => `${point.x},${point.y}`).join(' ')
  return (
    <div>
      <svg
        viewBox={`-4 0 ${LINE_WIDTH + 8} ${LINE_HEIGHT}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Line chart"
      >
        <polyline
          points={path}
          fill="none"
          stroke="var(--ray-blue)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ray-faint">
        <span>{slices[0]?.label}</span>
        <span className="tabular-nums">peak {NUMBER_FORMAT.format(largest)}</span>
        <span>{slices.at(-1)?.label}</span>
      </div>
    </div>
  )
}

export function Chart({ view, slices }: { view: View; slices: Slice[] }) {
  const pieFits = slices.length <= MOST_PIE_SLICES
  const kind = view.chart === 'pie' && !pieFits ? 'bar' : view.chart
  return (
    <section className="shrink-0 border-b border-ray-line px-4 pt-3 pb-4">
      <h2 className="mb-3 flex items-baseline justify-between text-xs font-medium text-ray-dim">
        {title(view)}
        {kind !== view.chart && <span className="text-ray-faint">too many slices for a pie</span>}
      </h2>
      {slices.length === 0 && <p className="text-[13px] text-ray-dim">Nothing to chart</p>}
      {slices.length > 0 && kind === 'number' && <BigNumber slices={slices} />}
      {slices.length > 0 && kind === 'bar' && <Bars slices={slices} />}
      {slices.length > 0 && kind === 'pie' && <Pie slices={slices} />}
      {slices.length > 0 && kind === 'line' && <Line slices={slices} />}
    </section>
  )
}
