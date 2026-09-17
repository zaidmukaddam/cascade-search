import { readFileSync, writeFileSync } from 'node:fs'
import { ROLES, type Role } from '../packages/core/src/types.ts'

const MIN_JEV_CONFIDENCE = 0.8
const IGNORED_LABEL = -1

interface LoggedEscalation {
  features: number[][]
  decisions: { token: number; role: Role; confidence: number }[]
}

function toTrainingRow(entry: LoggedEscalation) {
  const labels = entry.features.map(() => IGNORED_LABEL)
  for (const decision of entry.decisions) {
    if (decision.confidence >= MIN_JEV_CONFIDENCE) {
      labels[decision.token] = ROLES.indexOf(decision.role)
    }
  }
  return { f: entry.features, y: labels }
}

const source = process.argv[2]
if (!source) {
  console.error('usage: node training/from_log.ts <escalations.json exported from the website>')
  process.exit(1)
}

const entries: LoggedEscalation[] = JSON.parse(readFileSync(source, 'utf8'))
const rows = entries.map(toTrainingRow).filter(row => row.y.some(label => label !== IGNORED_LABEL))
const lines = rows.map(row => JSON.stringify(row))
writeFileSync(new URL('./data/escalations.jsonl', import.meta.url), `${lines.join('\n')}\n`)
console.log(`${rows.length} training rows from ${entries.length} logged escalations`)
