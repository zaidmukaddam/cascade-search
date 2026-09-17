import { useLayoutEffect, useRef, useState } from 'react'

const MIN_CELL_PX = 3
const MAX_CELL_PX = 14
const ROW_PX = 14
const GAP_PX = 1
const RADIUS_PX = 1.5
const DEAD_ZONE = 0.04

const POSITIVE = [255, 122, 40]
const NEGATIVE = [56, 150, 255]

interface HeatmapProps {
  data: ArrayLike<number>
  rows: number
  columns: number
  label?: string
  rowLabels?: string[]
  columnLabels?: string[]
}

function cellSize(available: number, columns: number): number {
  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(available / columns)))
}

function largestMagnitude(data: ArrayLike<number>, count: number): number {
  let largest = 1e-6
  for (let i = 0; i < count; i++) largest = Math.max(largest, Math.abs(data[i]))
  return largest
}

function colorFor(normalized: number): string | null {
  const magnitude = Math.abs(normalized)
  if (magnitude < DEAD_ZONE) return null
  const [red, green, blue] = normalized >= 0 ? POSITIVE : NEGATIVE
  const strength = 0.18 + 0.82 * magnitude ** 0.8
  return `rgb(${red} ${green} ${blue} / ${strength.toFixed(3)})`
}

function paint(canvas: HTMLCanvasElement, cell: number, { data, rows, columns }: HeatmapProps) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = columns * cell * dpr
  canvas.height = rows * ROW_PX * dpr
  canvas.style.width = `${columns * cell}px`
  canvas.style.height = `${rows * ROW_PX}px`
  const context = canvas.getContext('2d')
  if (!context) return
  context.scale(dpr, dpr)

  const scale = largestMagnitude(data, rows * columns)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const color = colorFor(data[row * columns + column] / scale)
      if (!color) continue
      context.fillStyle = color
      context.beginPath()
      context.roundRect(column * cell, row * ROW_PX, cell - GAP_PX, ROW_PX - GAP_PX, RADIUS_PX)
      context.fill()
    }
  }
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export function Heatmap(props: HeatmapProps) {
  const [container, width] = useWidth<HTMLDivElement>()
  const cell = cellSize(width, props.columns)
  const rowHeight = `${ROW_PX}px`
  return (
    <figure>
      {props.label && (
        <figcaption className="mb-2 flex items-baseline gap-2 text-[13px] text-ray-text">
          {props.label}
          <span className="font-mono text-[11px] tabular-nums text-ray-faint">
            {props.rows}×{props.columns}
          </span>
        </figcaption>
      )}
      <div className="flex gap-2.5">
        {props.rowLabels && (
          <div className="flex w-16 shrink-0 flex-col text-right font-mono text-[11px] leading-none text-ray-dim">
            {props.rowLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="flex items-center justify-end truncate"
                style={{ height: rowHeight }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
        <div ref={container} className="min-w-0 flex-1">
          {width > 0 && (
            <canvas
              ref={canvas => {
                if (canvas) paint(canvas, cell, props)
              }}
              className="block rounded-[3px] bg-ray-selected"
              role="img"
              aria-label={props.label ?? 'activations'}
            />
          )}
          {props.columnLabels && (
            <div className="mt-1.5 flex font-mono text-[9px] leading-none text-ray-faint">
              {props.columnLabels.map(name => (
                <span
                  key={name}
                  className="flex justify-center [writing-mode:vertical-lr]"
                  style={{ width: `${cell}px` }}
                >
                  {name.toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </figure>
  )
}
