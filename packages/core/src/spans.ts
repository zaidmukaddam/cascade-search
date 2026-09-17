import { type Hit, matchToken } from './match.ts'
import type { FieldKind, Role, Schema, TokenResult } from './types.ts'

const CONTEXT_WORDS = 2
const MERGE_GAP = 1

export interface Span {
  start: number
  end: number
  contextStart: number
  contextEnd: number
}

export interface EscalationRequest {
  words: string[]
  ask: number[]
  localRoles: Role[]
  matches: string[][]
  kinds: FieldKind[]
}

export interface Decision {
  role: Role
  confidence: number
}

export type Escalator = (request: EscalationRequest) => Promise<Decision[]>

export function extractSpans(confidence: number[], threshold: number): Span[] {
  const spans: Span[] = []
  confidence.forEach((value, token) => {
    if (value >= threshold) return
    const last = spans.at(-1)
    if (last && token - last.end <= MERGE_GAP) last.end = token + 1
    else spans.push({ start: token, end: token + 1, contextStart: 0, contextEnd: 0 })
  })
  for (const span of spans) {
    span.contextStart = Math.max(0, span.start - CONTEXT_WORDS)
    span.contextEnd = Math.min(confidence.length, span.end + CONTEXT_WORDS)
  }
  return spans
}

export function spanLength(span: Span): number {
  return span.end - span.start
}

function describeMatch(hit: Hit): string {
  if (hit.type === 'entity') return 'row noun'
  if (hit.type === 'adj') return 'sort adjective'
  const typo = hit.fuzzy ? ' (typo?)' : ''
  return `${hit.field!.kind} ${hit.type}${typo}`
}

export function buildRequest(tokens: TokenResult[], span: Span, schema: Schema): EscalationRequest {
  const context = tokens.slice(span.contextStart, span.contextEnd)
  const firstAsked = span.start - span.contextStart
  return {
    words: context.map(token => token.text),
    ask: Array.from({ length: spanLength(span) }, (_, offset) => firstAsked + offset),
    localRoles: context.map(token => token.role),
    matches: context.map(token => [...new Set(matchToken(token.text, schema).map(describeMatch))]),
    kinds: [...new Set(schema.fields.map(field => field.kind))],
  }
}

export function merge(tokens: TokenResult[], span: Span, decisions: Decision[]): TokenResult[] {
  return tokens.map((token, index) => {
    const decision = decisions[index - span.start]
    const inSpan = index >= span.start && index < span.end
    if (!inSpan || !decision || decision.confidence <= token.confidence) return token
    return { ...token, role: decision.role, confidence: decision.confidence, tier: 'jev' }
  })
}
