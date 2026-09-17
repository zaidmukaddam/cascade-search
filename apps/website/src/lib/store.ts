import {
  DEFAULT_THRESHOLD,
  type Decision,
  type EscalationRequest,
  type Escalator,
  escalate,
  type ParseResult,
  parse,
  type Schema,
} from 'cascade-search'
import { useEffect, useState } from 'react'
import type { Issue } from './issues.ts'
import { logEscalation } from './log.ts'
import { askRemote, fetchStatus, type RemoteStatus, RemoteUnavailable } from './remote.ts'
import { EXAMPLES, SCHEMA } from './schema.ts'
import type { ViewId } from './views.ts'

const TYPING_PAUSE_MS = 350
const WARMUP_PARSES = 30

export type Phase = 'idle' | 'pending' | 'jev' | 'degraded'

export interface LastCall {
  request: EscalationRequest
  decisions: Decision[]
  ms: number
  inputTokens?: number
}

export interface State {
  query: string
  threshold: number
  schema: Schema
  local: ParseResult
  localMs: number
  result: ParseResult
  phase: Phase
  reason: string
  remoteMs: number
  remote: RemoteStatus
  lastCall: LastCall | null
  view: ViewId
  openIssue: Issue | null
}

type Inputs = Pick<State, 'query' | 'threshold' | 'schema'>

function timedParse({ query, schema, threshold }: Inputs) {
  const started = performance.now()
  const local = parse(query, schema, { threshold, trace: true })
  return { local, localMs: performance.now() - started }
}

function initialState(): State {
  const inputs: Inputs = { query: EXAMPLES[0], threshold: DEFAULT_THRESHOLD, schema: SCHEMA }
  for (let i = 0; i < WARMUP_PARSES; i++) parse(inputs.query, inputs.schema)
  const parsed = timedParse(inputs)
  return {
    ...inputs,
    ...parsed,
    result: parsed.local,
    phase: 'idle',
    reason: '',
    remoteMs: 0,
    remote: { available: false, remaining: null },
    lastCall: null,
    view: 'parse',
    openIssue: null,
  }
}

let state = initialState()
const listeners = new Set<() => void>()
let typingTimer: ReturnType<typeof setTimeout> | undefined
let latestRequest = 0

function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function showView(view: ViewId) {
  setState({ view, openIssue: null })
}

export function openIssue(issue: Issue) {
  setState({ openIssue: issue })
}

export function closeIssue() {
  setState({ openIssue: null })
}

const askAndRecord: Escalator = async request => {
  const started = performance.now()
  try {
    const answer = await askRemote(request)
    setState({
      remote: { ...state.remote, remaining: answer.remaining },
      lastCall: {
        request,
        decisions: answer.decisions,
        ms: performance.now() - started,
        inputTokens: answer.inputTokens,
      },
    })
    return answer.decisions
  } catch (error) {
    if (error instanceof RemoteUnavailable && error.remaining !== null) {
      setState({ remote: { ...state.remote, remaining: error.remaining } })
    }
    throw error
  }
}

async function escalateLatest(local: ParseResult, schema: Schema, requestId: number) {
  const started = performance.now()
  try {
    const result = await escalate(local, schema, askAndRecord)
    if (requestId !== latestRequest) return
    setState({ result, phase: 'jev', remoteMs: performance.now() - started })
    logEscalation(local, result, [...new Set(schema.fields.map(field => field.kind))])
  } catch (error) {
    if (requestId !== latestRequest) return
    setState({ phase: 'degraded', reason: (error as Error).message })
  }
}

export function update(patch: Partial<Inputs>) {
  const inputs: Inputs = { ...state, ...patch }
  const parsed = timedParse(inputs)
  const needsJev = parsed.local.spans.length > 0

  setState({
    ...patch,
    ...parsed,
    result: parsed.local,
    phase: needsJev ? 'pending' : 'idle',
    reason: '',
    openIssue: patch.query === undefined ? state.openIssue : null,
  })

  clearTimeout(typingTimer)
  const requestId = ++latestRequest
  if (!needsJev) return
  typingTimer = setTimeout(
    () => escalateLatest(parsed.local, inputs.schema, requestId),
    TYPING_PAUSE_MS,
  )
}

export async function checkRemote() {
  setState({ remote: await fetchStatus() })
}

export function useStore(): State {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender(count => count + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return state
}
