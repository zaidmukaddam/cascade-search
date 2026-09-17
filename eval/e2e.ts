import { compile, parse, pretty } from '../packages/core/src/index.ts'
import type { Domain } from '../training/domains.ts'
import { dataset, goldTokens } from '../training/gen.ts'
import { percentile, today, writeResult } from './report.ts'

const QUERIES = 4000
const WARMUP_QUERIES = 200

function evaluate(split: Domain['split'], seed: number) {
  const examples = dataset(split, QUERIES, seed)
  for (const ex of examples.slice(0, WARMUP_QUERIES)) parse(ex.q, ex.schema)

  let exactFilters = 0
  let tokens = 0
  let correctTokens = 0
  const latencies: number[] = []

  for (const ex of examples) {
    const started = performance.now()
    const result = parse(ex.q, ex.schema)
    latencies.push(performance.now() - started)

    if (pretty(result.ir) === pretty(compile(goldTokens(ex), ex.schema))) exactFilters++
    tokens += result.tokens.length
    correctTokens += result.tokens.filter((token, index) => token.role === ex.roles[index]).length
  }

  latencies.sort((a, b) => a - b)
  return {
    queries: examples.length,
    filterExact: exactFilters / examples.length,
    tokenAccuracy: correctTokens / tokens,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    },
  }
}

const report = {
  date: today(),
  heldout: evaluate('train', 21),
  transfer: evaluate('transfer', 22),
}
console.log(JSON.stringify(report, null, 1))
writeResult('e2e.json', report)
