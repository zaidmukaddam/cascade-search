import { experimental_evaluate as evaluate } from 'ai'
import type { Decision, EscalationRequest, Escalator, Role } from 'cascade-search'
import { JevError, toJevError } from './errors.ts'
import { buildQuestions, buildState, questionId } from './prompt.ts'

const DEFAULT_MODEL = 'typesafe-ai/jev'
const DEFAULT_TIMEOUT_MS = 2500
const DEFAULT_CALLS_PER_MINUTE = 60
const MINUTE_MS = 60_000

export interface JevCall {
  request: EscalationRequest
  decisions: Decision[]
  inputTokens: number | undefined
  ms: number
}

export interface JevOptions {
  model?: string
  timeoutMs?: number
  callsPerMinute?: number
  onCall?: (call: JevCall) => void
  evaluate?: typeof evaluate
}

export interface ChoiceAnswer {
  choice: string
  probabilities?: Record<string, number>
}

export type JevEscalator = Escalator & { remaining(): number }

export function toDecision(answer: ChoiceAnswer): Decision {
  const probability = answer.probabilities?.[answer.choice]
  if (probability === undefined) {
    throw new JevError('no_probabilities', 'Jev answer carried no probability distribution')
  }
  return { role: answer.choice as Role, confidence: probability }
}

function slidingBudget(callsPerMinute: number) {
  let calls: number[] = []
  const remaining = () => {
    const now = Date.now()
    calls = calls.filter(time => now - time < MINUTE_MS)
    return callsPerMinute - calls.length
  }
  const spend = () => {
    if (remaining() <= 0) {
      throw new JevError('budget', `escalation budget of ${callsPerMinute} calls/min is spent`)
    }
    calls.push(Date.now())
  }
  return { remaining, spend }
}

export function createJev(options: JevOptions = {}): JevEscalator {
  const model = options.model ?? DEFAULT_MODEL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const run = options.evaluate ?? evaluate
  const budget = slidingBudget(options.callsPerMinute ?? DEFAULT_CALLS_PER_MINUTE)

  const ask: Escalator = async request => {
    budget.spend()
    const started = performance.now()

    const result = await run({
      model,
      state: buildState(request),
      questions: buildQuestions(request),
      abortSignal: AbortSignal.timeout(timeoutMs),
    }).catch(error => {
      throw toJevError(error)
    })

    const answers = result.answers as Record<string, ChoiceAnswer>
    const decisions = request.ask.map(wordIndex => toDecision(answers[questionId(wordIndex)]))
    options.onCall?.({
      request,
      decisions,
      inputTokens: result.usage.inputTokens,
      ms: performance.now() - started,
    })
    return decisions
  }

  return Object.assign(ask, { remaining: budget.remaining })
}

export { JevError, type JevErrorKind } from './errors.ts'
export { ROLE_GUIDE } from './prompt.ts'
