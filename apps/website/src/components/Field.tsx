import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'

const COLUMNS = 9
const ROWS = 5
const EASE = 0.08
const WARM = [255, 110, 70]
const COOL = [70, 150, 255]

function targetFrom(source: ArrayLike<number> | undefined): Float32Array {
  const cells = new Float32Array(COLUMNS * ROWS)
  for (let i = 0; i < cells.length; i++) {
    if (source?.length) {
      cells[i] = source[(i * 37) % source.length]
    } else {
      cells[i] = Math.sin(i * 0.7) * Math.cos(i * 0.13)
    }
  }
  let largest = 1e-6
  for (const value of cells) largest = Math.max(largest, Math.abs(value))
  for (let i = 0; i < cells.length; i++) cells[i] /= largest
  return cells
}

function paint(context: CanvasRenderingContext2D, cells: Float32Array, glow: number) {
  const image = context.createImageData(COLUMNS, ROWS)
  for (let i = 0; i < cells.length; i++) {
    const value = cells[i]
    const [red, green, blue] = value >= 0 ? WARM : COOL
    const alpha = (0.3 + 0.7 * Math.abs(value)) * glow * 255
    image.data.set([red, green, blue, alpha], i * 4)
  }
  context.putImageData(image, 0, 0)
}

export function Field() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const current = useRef(targetFrom(undefined))
  const state = useStore()
  const source = state.local.trace?.layers.at(-1)?.bwd

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const target = targetFrom(source)
    let frame = 0
    const step = () => {
      const glow = Number(getComputedStyle(document.documentElement).getPropertyValue('--ray-glow'))
      const cells = current.current
      let settled = true
      for (let i = 0; i < cells.length; i++) {
        const delta = target[i] - cells[i]
        if (Math.abs(delta) > 0.002) settled = false
        cells[i] += delta * EASE
      }
      paint(context, cells, glow)
      if (!settled) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [source])

  return (
    <canvas
      ref={canvas}
      width={COLUMNS}
      height={ROWS}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full scale-125 blur-[60px]"
    />
  )
}
