import { writeFileSync } from 'node:fs'
import {
  compile,
  DEFAULT_THRESHOLD,
  parse,
  pretty,
  ROLES,
  type Role,
  spanLength,
} from '../packages/core/src/index.ts'
import { DOMAINS } from '../training/domains.ts'
import { type Example, generate, goldTokens, mulberry32 } from '../training/gen.ts'
import { Random } from '../training/random.ts'
import { readResult, today, writeResult } from './report.ts'

const TEAMMATES = ['zed', 'kai', 'uma', 'lev', 'noor', 'jude', 'remy', 'sora']
const TEAM_SLANG = ['lol', 'fyi', 'tbh', 'yo', 'gonna']
const TRAFFIC_QUERIES = 3000
const LOGGED_TRAFFIC_SEED = 101
const FRESH_TRAFFIC_SEED = 202
const SIMULATED_JEV_ACCURACY = 0.9
const MAX_WORDS = 24
const IGNORED_LABEL = -1
const RESULT_FILE = 'm6.json'

interface TrainingRow {
  f: number[][]
  y: number[]
}

interface CalibrationReport {
  chosen: string
  transfer: {
    accuracy: number
    methods: Record<string, { ece: number; escalationRateAt: Record<string, number> }>
  }
}

function withTeamHabits(ex: Example, random: Random): Example {
  const personField = ex.schema.fields.find(field => field.kind === 'person')
  const lead: [string, Role][] = []

  if (random.chance(0.3)) lead.push([random.pick(TEAM_SLANG), 'O'])
  if (personField && random.chance(0.6)) {
    const teammate = random.pick(TEAMMATES)
    lead.push([teammate, 'VAL_PERSON'])
    ex.filter.where.unshift({ field: personField.name, op: 'eq', value: teammate })
  }
  if (ex.tokens.length + lead.length > MAX_WORDS) return ex

  const leadWords = lead.map(([word]) => word)
  return {
    ...ex,
    q: [...leadWords, ex.q].join(' '),
    tokens: [...leadWords, ...ex.tokens],
    roles: [...lead.map(([, role]) => role), ...ex.roles],
  }
}

function traffic(seed: number): Example[] {
  const rng = mulberry32(seed)
  const random = new Random(rng)
  return Array.from({ length: TRAFFIC_QUERIES }, () =>
    withTeamHabits(generate(DOMAINS[0], rng), random),
  )
}

function measure(examples: Example[]) {
  let queriesEscalated = 0
  let tokens = 0
  let tokensEscalated = 0
  let exactFilters = 0

  for (const ex of examples) {
    const result = parse(ex.q, ex.schema, { threshold: DEFAULT_THRESHOLD })
    if (result.spans.length) queriesEscalated++
    tokens += result.tokens.length
    tokensEscalated += result.spans.reduce((total, span) => total + spanLength(span), 0)
    if (pretty(result.ir) === pretty(compile(goldTokens(ex), ex.schema))) exactFilters++
  }

  return {
    queries: examples.length,
    threshold: DEFAULT_THRESHOLD,
    queriesEscalated: queriesEscalated / examples.length,
    tokensEscalated: tokensEscalated / tokens,
    localExactFilter: exactFilters / examples.length,
  }
}

function logEscalations(examples: Example[]): TrainingRow[] {
  const random = new Random(mulberry32(9))
  const rows: TrainingRow[] = []

  for (const ex of examples) {
    const result = parse(ex.q, ex.schema, { threshold: DEFAULT_THRESHOLD, trace: true })
    if (!result.spans.length || !result.features) continue

    const labels = result.tokens.map(() => IGNORED_LABEL)
    for (const span of result.spans) {
      for (let token = span.start; token < span.end; token++) {
        const jevIsRight = random.chance(SIMULATED_JEV_ACCURACY)
        const role = jevIsRight ? ex.roles[token] : result.tokens[token].role
        labels[token] = ROLES.indexOf(role)
      }
    }
    rows.push({ f: result.features, y: labels })
  }
  return rows
}

function calibration(file: string) {
  const report = readResult<CalibrationReport>(file)
  const shipped = report.transfer.methods[report.chosen]
  return {
    transferAccuracy: report.transfer.accuracy,
    transferEce: shipped.ece,
    rateFor995: shipped.escalationRateAt['0.995'],
  }
}

const freshTraffic = traffic(FRESH_TRAFFIC_SEED)

if (process.argv[2] === 'log') {
  const rows = logEscalations(traffic(LOGGED_TRAFFIC_SEED))
  const lines = rows.map(row => JSON.stringify(row))
  const target = new URL('../training/data/escalations.jsonl', import.meta.url)
  writeFileSync(target, `${lines.join('\n')}\n`)

  const before = measure(freshTraffic)
  writeResult(RESULT_FILE, {
    simulated: true,
    date: today(),
    loggedEscalations: rows.length,
    before,
  })
  console.log(`logged ${rows.length} escalations; before:`, before)
} else {
  const report = {
    ...readResult<object>(RESULT_FILE),
    after: measure(freshTraffic),
    m2Calibration: { before: calibration('m2.json'), after: calibration('m6-after.json') },
  }
  writeResult(RESULT_FILE, report)
  console.log(JSON.stringify(report, null, 1))
}
