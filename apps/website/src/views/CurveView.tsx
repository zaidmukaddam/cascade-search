import { type MouseEvent, useState } from 'react'
import { DetailBody, DetailText, DetailTitle, Metadata, MetadataRow } from '@/components/Detail'
import { percent } from '@/lib/format'
import { calibration, shippedSignal } from '@/lib/results'

const WIDTH = 420
const HEIGHT = 230
const MARGIN = { left: 40, right: 12, top: 12, bottom: 30 }
const LARGEST_SHARE = 0.2
const SHARE_TICKS = [0, 0.1, 0.2]
const TARGET_ACCURACY = '0.995'
const RANKED = 'var(--ray-green)'
const RANDOM = 'var(--ray-faint)'

const SIGNAL_NAMES: Record<string, string> = {
  softmax: 'Scaled softmax',
  entropy: 'Entropy',
  head: 'Learned head',
}

const transfer = calibration.transfer
const shipped = transfer.methods[shippedSignal]
const points = calibration.x
  .map((share, index) => ({
    share,
    ranked: shipped.curve[index],
    random: transfer.random[index],
  }))
  .filter(point => point.share <= LARGEST_SHARE)

type Point = (typeof points)[number]

const floor = Math.floor(transfer.accuracy * 200) / 200
const plotWidth = WIDTH - MARGIN.left - MARGIN.right
const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom

function x(share: number): number {
  return MARGIN.left + (share / LARGEST_SHARE) * plotWidth
}

function y(accuracy: number): number {
  return MARGIN.top + (1 - (accuracy - floor) / (1 - floor)) * plotHeight
}

function linePath(pick: (point: Point) => number): string {
  return points
    .map((point, index) => {
      const command = index ? 'L' : 'M'
      return `${command}${x(point.share).toFixed(1)},${y(pick(point)).toFixed(1)}`
    })
    .join('')
}

function nearestPoint(event: MouseEvent<SVGSVGElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect()
  const svgX = ((event.clientX - bounds.left) / bounds.width) * WIDTH
  const share = ((svgX - MARGIN.left) / plotWidth) * LARGEST_SHARE
  return points.reduce((nearest, point) =>
    Math.abs(point.share - share) < Math.abs(nearest.share - share) ? point : nearest,
  )
}

function Axes() {
  return (
    <g className="fill-ray-dim text-[10px]">
      {[floor, 1].map(tick => (
        <g key={tick}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-ray-line"
          />
          <text x={MARGIN.left - 6} y={y(tick) + 3} textAnchor="end">
            {percent(tick)}
          </text>
        </g>
      ))}
      {SHARE_TICKS.map(tick => (
        <text key={tick} x={x(tick)} y={HEIGHT - 10} textAnchor="middle">
          {percent(tick, 0)}
        </text>
      ))}
    </g>
  )
}

function Crosshair({ point }: { point: Point }) {
  return (
    <g>
      <line
        x1={x(point.share)}
        x2={x(point.share)}
        y1={MARGIN.top}
        y2={HEIGHT - MARGIN.bottom}
        className="stroke-ray-faint"
      />
      <circle cx={x(point.share)} cy={y(point.ranked)} r="3.5" fill={RANKED} />
      <circle cx={x(point.share)} cy={y(point.random)} r="3.5" fill={RANDOM} />
    </g>
  )
}

export function CurveView() {
  const [hovered, setHovered] = useState<Point | null>(null)
  const shown = hovered ?? points[points.length - 1]

  return (
    <>
      <DetailBody>
        <DetailTitle>Escalation Curve</DetailTitle>
        <DetailText>
          On four domains the model never saw, hand the least confident words to a second tier that
          gets them right. Accuracy climbs far faster than picking words at random.
        </DetailText>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Word accuracy against share of words escalated, confidence-ranked versus random"
          onMouseMove={event => setHovered(nearestPoint(event))}
          onMouseLeave={() => setHovered(null)}
        >
          <Axes />
          <path
            d={linePath(point => point.random)}
            fill="none"
            stroke={RANDOM}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d={linePath(point => point.ranked)}
            fill="none"
            stroke={RANKED}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {hovered && <Crosshair point={hovered} />}
        </svg>
      </DetailBody>
      <Metadata>
        <MetadataRow label="Words escalated">{percent(shown.share)}</MetadataRow>
        <MetadataRow label="Least confident first">
          <span style={{ color: RANKED }}>{percent(shown.ranked, 2)}</span>
        </MetadataRow>
        <MetadataRow label="Random words">{percent(shown.random, 2)}</MetadataRow>
        <MetadataRow label="To reach 99.5%">
          {percent(shipped.escalationRateAt[TARGET_ACCURACY], 2)} vs{' '}
          {percent(transfer.randomRateAt[TARGET_ACCURACY], 0)} random
        </MetadataRow>
        {Object.entries(transfer.methods).map(([name, method]) => (
          <MetadataRow key={name} label={`${SIGNAL_NAMES[name]} ECE`}>
            {method.ece.toFixed(4)}
            {name === shippedSignal ? ' · shipped' : ''}
          </MetadataRow>
        ))}
        <MetadataRow label="Computed">{calibration.date}</MetadataRow>
      </Metadata>
    </>
  )
}
