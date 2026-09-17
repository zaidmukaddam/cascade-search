import {
  compile,
  type Escalator,
  escalate,
  type ParseResult,
  parse,
  pretty,
  type Role,
  spanLength,
} from '../packages/core/src/index.ts'
import { createJev } from '../packages/jev/src/index.ts'
import { dataset, type Example, goldTokens, mulberry32, type Rng } from '../training/gen.ts'
import { today, writeResult } from './report.ts'

export const COST = {
  jevDollarsPerMillionInputTokens: 0.042,
  estimatedInputTokensPerCall: 1000,
  dollarsPerWrongFilter: 0.002,
  dollarsPerNetworkWait: 0.0002,
}

const DEFAULT_LIVE_QUERIES = 150
const SIMULATED_QUERIES = 4000
const FLAT_MINIMUM_TOLERANCE = 1.02
const ALWAYS_ESCALATES = 0.999
const THRESHOLDS = [
  0, 0.3, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.93, 0.95, 0.97, 0.98, 0.99, 0.995, 0.999,
]

interface Remote {
  label: string
  accuracy: number | null
}

interface Row {
  remote: string
  threshold: number
  accuracy: number
  queriesEscalated: number
  tokensEscalated: number
  callsPerQuery: number
  jevDollarsPer1k: number
  expectedCostPer1k: number
}

function liveQueryCount(): number {
  const flag = process.argv.indexOf('--live')
  if (flag < 0) return 0
  return Number(process.argv[flag + 1]) || DEFAULT_LIVE_QUERIES
}

const liveQueries = liveQueryCount()
const isLive = liveQueries > 0
const examples = dataset('transfer', liveQueries || SIMULATED_QUERIES, 11)
const thresholds = isLive ? THRESHOLDS.filter(t => t < ALWAYS_ESCALATES) : THRESHOLDS
const remotes: Remote[] = isLive
  ? [{ label: 'jev (live)', accuracy: null }]
  : [
      { label: 'oracle', accuracy: 1 },
      { label: '90% right', accuracy: 0.9 },
    ]

const measuredInputTokens: number[] = []
const jev = createJev({
  callsPerMinute: 600,
  timeoutMs: 15000,
  onCall: call => {
    if (call.inputTokens) measuredInputTokens.push(call.inputTokens)
  },
})

const answered = new Map<string, ReturnType<Escalator>>()
const askJevOnce: Escalator = request => {
  const key = JSON.stringify(request)
  if (!answered.has(key)) answered.set(key, jev(request))
  return answered.get(key)!
}

let failedEscalations = 0

function simulatedRemote(ex: Example, local: ParseResult, accuracy: number, rng: Rng): Escalator {
  let spanIndex = 0
  return async request => {
    const span = local.spans[spanIndex++]
    return request.ask.map((_, offset) => {
      const token = span.start + offset
      const role: Role = rng() < accuracy ? ex.roles[token] : local.tokens[token].role
      return { role, confidence: 1 }
    })
  }
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function inputTokensPerCall(): number {
  return measuredInputTokens.length ? mean(measuredInputTokens) : COST.estimatedInputTokensPerCall
}

async function resolve(ex: Example, local: ParseResult, remote: Remote, rng: Rng) {
  const ask =
    remote.accuracy === null ? askJevOnce : simulatedRemote(ex, local, remote.accuracy, rng)
  try {
    return await escalate(local, ex.schema, ask)
  } catch (error) {
    failedEscalations++
    if (failedEscalations <= 3) console.error('escalation failed:', error)
    return local
  }
}

async function sweepRow(remote: Remote, threshold: number): Promise<Row> {
  const rng = mulberry32(5)
  let exact = 0
  let calls = 0
  let queriesEscalated = 0
  let tokensEscalated = 0
  let tokens = 0

  for (const ex of examples) {
    const gold = pretty(compile(goldTokens(ex), ex.schema))
    const local = parse(ex.q, ex.schema, { threshold })
    tokens += local.tokens.length
    let final = local
    if (local.spans.length) {
      queriesEscalated++
      calls += local.spans.length
      tokensEscalated += local.spans.reduce((total, span) => total + spanLength(span), 0)
      final = await resolve(ex, local, remote, rng)
    }
    if (pretty(final.ir) === gold) exact++
  }

  const n = examples.length
  const accuracy = exact / n
  const jevDollarsPerQuery =
    ((calls / n) * inputTokensPerCall() * COST.jevDollarsPerMillionInputTokens) / 1e6
  const expectedDollarsPerQuery =
    jevDollarsPerQuery +
    (1 - accuracy) * COST.dollarsPerWrongFilter +
    (queriesEscalated / n) * COST.dollarsPerNetworkWait

  return {
    remote: remote.label,
    threshold,
    accuracy,
    queriesEscalated: queriesEscalated / n,
    tokensEscalated: tokensEscalated / tokens,
    callsPerQuery: calls / n,
    jevDollarsPer1k: jevDollarsPerQuery * 1000,
    expectedCostPer1k: expectedDollarsPerQuery * 1000,
  }
}

function chooseDefault(rows: Row[]): Row {
  const cheapest = Math.min(...rows.map(row => row.expectedCostPer1k))
  return rows.find(row => row.expectedCostPer1k <= cheapest * FLAT_MINIMUM_TOLERANCE)!
}

const rows: Row[] = []
for (const remote of remotes) {
  for (const threshold of thresholds) rows.push(await sweepRow(remote, threshold))
}

const mostPessimistic = remotes.at(-1)!.label
const chosen = chooseDefault(rows.filter(row => row.remote === mostPessimistic))

console.table(
  rows.map(row => ({
    remote: row.remote,
    threshold: row.threshold,
    'exact filters %': (row.accuracy * 100).toFixed(2),
    'queries escalated %': (row.queriesEscalated * 100).toFixed(1),
    'tokens escalated %': (row.tokensEscalated * 100).toFixed(2),
    'Jev $/1k queries': row.jevDollarsPer1k.toFixed(5),
    'expected $/1k queries': row.expectedCostPer1k.toFixed(4),
  })),
)
console.log(`default threshold: ${chosen.threshold} (basis: ${mostPessimistic})`)

const report = {
  date: today(),
  queries: examples.length,
  jevCalls: answered.size,
  failedEscalations,
  cost: COST,
  inputTokensPerCall: inputTokensPerCall(),
  inputTokensMeasured: measuredInputTokens.length > 0,
  default: chosen.threshold,
  rows,
}
writeResult(isLive ? 'threshold-live.json' : 'threshold.json', report)
