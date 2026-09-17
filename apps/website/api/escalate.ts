import { createJev, type JevCall, JevError, type JevErrorKind } from 'cascade-search-jev'
import { remainingCalls, spendCall } from './_lib/budget.ts'
import { validateRequest } from './_lib/validate.ts'

export const config = { runtime: 'edge' }

const JEV_TIMEOUT_MS = 4000

const STATUS_BY_KIND: Record<JevErrorKind, number> = {
  budget: 429,
  rate_limit: 429,
  timeout: 504,
  auth: 503,
  overloaded: 503,
  invalid: 502,
  no_probabilities: 502,
  network: 502,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function failure(kind: JevErrorKind, message: string, remaining: number, status?: number) {
  return json({ error: { kind, message }, remaining }, status ?? STATUS_BY_KIND[kind])
}

function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || 'local'
}

function gatewayConfigured(): boolean {
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY)
  const runsOnVercel = Boolean(process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN)
  return hasKey || runsOnVercel
}

export default async function handler(request: Request): Promise<Response> {
  const address = clientAddress(request)
  const available = gatewayConfigured()

  if (request.method === 'GET') return json({ available, remaining: remainingCalls(address) })
  if (request.method !== 'POST')
    return failure('invalid', 'POST only', remainingCalls(address), 405)
  if (!available) {
    return failure('auth', 'no AI Gateway key on this deployment', remainingCalls(address))
  }

  const escalation = validateRequest(await request.json().catch(() => null))
  if (!escalation) {
    return failure('invalid', 'malformed escalation request', remainingCalls(address), 400)
  }
  if (remainingCalls(address) <= 0) {
    return failure('budget', 'demo budget for this address is spent; it refills within the hour', 0)
  }
  spendCall(address)

  let call: JevCall | undefined
  const jev = createJev({
    timeoutMs: JEV_TIMEOUT_MS,
    onCall: finished => {
      call = finished
    },
  })

  try {
    const decisions = await jev(escalation)
    return json({
      decisions,
      remaining: remainingCalls(address),
      ms: call?.ms,
      inputTokens: call?.inputTokens,
    })
  } catch (error) {
    const kind = error instanceof JevError ? error.kind : 'network'
    return failure(kind, (error as Error).message, remainingCalls(address))
  }
}
