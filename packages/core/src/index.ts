import { compile } from './compile.ts'
import { decide } from './confidence.ts'
import { featurize } from './features.ts'
import { forward, type Trace } from './model.ts'
import { buildRequest, type Escalator, extractSpans, merge, type Span } from './spans.ts'
import { tokenize } from './tokenize.ts'
import { type Filter, ROLES, type Schema, type TokenResult } from './types.ts'
import { defaultWeights, type Weights } from './weights.ts'

export const DEFAULT_THRESHOLD = 0.95

export interface ParseOptions {
  threshold?: number
  weights?: Weights
  trace?: boolean
}

export interface ParseResult {
  ir: Filter
  tokens: TokenResult[]
  minConfidence: number
  tier: 'local' | 'jev'
  spans: Span[]
  trace?: Trace
  features?: number[][]
}

function lowestConfidence(tokens: TokenResult[]): number {
  return Math.min(1, ...tokens.map(token => token.confidence))
}

export function parse(phrase: string, schema: Schema, options: ParseOptions = {}): ParseResult {
  const weights = options.weights ?? defaultWeights()
  const words = tokenize(phrase)
  const features = featurize(words, schema)
  const trace = forward(weights, features)
  const decisions = decide(weights, trace.logits, trace.confLogit)

  const tokens: TokenResult[] = decisions.map((decision, index) => ({
    ...words[index],
    role: ROLES[decision.role],
    confidence: decision.confidence,
    tier: 'local',
  }))
  const confidences = tokens.map(token => token.confidence)

  const result: ParseResult = {
    ir: compile(tokens, schema),
    tokens,
    minConfidence: lowestConfidence(tokens),
    tier: 'local',
    spans: extractSpans(confidences, options.threshold ?? DEFAULT_THRESHOLD),
  }
  return options.trace ? { ...result, trace, features } : result
}

export async function escalate(
  local: ParseResult,
  schema: Schema,
  ask: Escalator,
): Promise<ParseResult> {
  if (!local.spans.length) return local

  const requests = local.spans.map(span => buildRequest(local.tokens, span, schema))
  const answers = await Promise.all(requests.map(ask))
  const tokens = local.spans.reduce(
    (merged, span, index) => merge(merged, span, answers[index]),
    local.tokens,
  )

  return {
    ...local,
    ir: compile(tokens, schema),
    tokens,
    tier: 'jev',
    minConfidence: lowestConfidence(tokens),
  }
}

export { compile, type RoleToken } from './compile.ts'
export { argmax, decide, type RoleDecision } from './confidence.ts'
export { F, FEATURE_NAMES, featurize } from './features.ts'
export { createGpu, type GpuModel, type GpuOutput } from './gpu.ts'
export { parseFilter, pretty } from './ir.ts'
export { forward, type LayerTrace, type Trace } from './model.ts'
export {
  buildRequest,
  type Decision,
  type EscalationRequest,
  type Escalator,
  extractSpans,
  merge,
  type Span,
  spanLength,
} from './spans.ts'
export { tokenize } from './tokenize.ts'
export * from './types.ts'
export { decode, defaultWeights, type Manifest, parameterCount, type Weights } from './weights.ts'
