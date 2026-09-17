const MAX_WIDTH_PX = 360
const MIN_CELL_PX = 3
const MAX_CELL_PX = 9
const GAP_PX = 1

const POSITIVE = [234, 120, 40]
const NEGATIVE = [60, 130, 230]

interface HeatmapProps {
  data: ArrayLike<number>
  rows: number
  columns: number
  label: string
  rowLabels?: string[]
}

function cellSize(columns: number): number {
  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(MAX_WIDTH_PX / columns)))
}

function largestMagnitude(data: ArrayLike<number>, count: number): number {
  let largest = 1e-6
  for (let i = 0; i < count; i++) largest = Math.max(largest, Math.abs(data[i]))
  return largest
}

function colorFor(normalized: number): string {
  const [red, green, blue] = normalized >= 0 ? POSITIVE : NEGATIVE
  const strength = 0.08 + 0.92 * Math.abs(normalized)
  return `rgb(${red} ${green} ${blue} / ${strength.toFixed(3)})`
}

function paint(canvas: HTMLCanvasElement, { data, rows, columns }: HeatmapProps) {
  const cell = cellSize(columns)
  canvas.width = columns * cell
  canvas.height = rows * cell
  const context = canvas.getContext('2d')
  if (!context) return

  const scale = largestMagnitude(data, rows * columns)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      context.fillStyle = colorFor(data[row * columns + column] / scale)
      context.fillRect(column * cell, row * cell, cell - GAP_PX, cell - GAP_PX)
    }
  }
}

export function Heatmap(props: HeatmapProps) {
  const rowHeight = `${cellSize(props.columns)}px`
  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs text-ray-dim">
        {props.label}{' '}
        <span className="tabular-nums opacity-60">
          {props.rows}×{props.columns}
        </span>
      </figcaption>
      <div className="flex gap-2">
        {props.rowLabels && (
          <div className="flex w-12 shrink-0 flex-col font-mono text-[9px] leading-none text-ray-dim">
            {props.rowLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="flex items-center justify-end"
                style={{ height: rowHeight }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
        <canvas
          ref={canvas => {
            if (canvas) paint(canvas, props)
          }}
          className="max-w-full"
          style={{ imageRendering: 'pixelated' }}
          role="img"
          aria-label={props.label}
        />
      </div>
    </figure>
  )
}
