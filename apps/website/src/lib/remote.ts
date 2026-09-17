import type { Decision, EscalationRequest } from 'cascade-search'

const ENDPOINT = '/api/escalate'

const REASON_BY_KIND: Record<string, string> = {
  budget: 'demo budget spent',
  auth: 'Jev not configured here',
  timeout: 'Jev timed out',
  rate_limit: 'Jev rate-limited',
  overloaded: 'Jev overloaded',
  network: 'Jev unreachable',
  invalid: 'Jev rejected the request',
  no_probabilities: 'Jev sent no probabilities',
}

export interface RemoteStatus {
  available: boolean
  remaining: number | null
}

export interface RemoteAnswer {
  decisions: Decision[]
  remaining: number | null
  inputTokens?: number
}

export class RemoteUnavailable extends Error {
  remaining: number | null

  constructor(kind: string, remaining: number | null) {
    super(REASON_BY_KIND[kind] ?? REASON_BY_KIND.network)
    this.remaining = remaining
  }
}

export async function fetchStatus(): Promise<RemoteStatus> {
  const response = await fetch(ENDPOINT).catch(() => null)
  const body = await response?.json().catch(() => null)
  return { available: Boolean(body?.available), remaining: body?.remaining ?? null }
}

export async function askRemote(request: EscalationRequest): Promise<RemoteAnswer> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  }).catch(() => null)
  const body = await response?.json().catch(() => null)
  const remaining: number | null = body?.remaining ?? null

  if (!response?.ok || !body?.decisions) {
    throw new RemoteUnavailable(body?.error?.kind ?? 'network', remaining)
  }
  return { decisions: body.decisions, remaining, inputTokens: body.inputTokens }
}
