export type JevErrorKind =
  | 'budget'
  | 'timeout'
  | 'auth'
  | 'rate_limit'
  | 'overloaded'
  | 'invalid'
  | 'no_probabilities'
  | 'network'

export class JevError extends Error {
  kind: JevErrorKind

  constructor(kind: JevErrorKind, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'JevError'
    this.kind = kind
  }
}

const KIND_BY_STATUS: Record<number, JevErrorKind> = {
  401: 'auth',
  403: 'auth',
  422: 'invalid',
  429: 'rate_limit',
  529: 'overloaded',
}

const ABORT_ERROR_NAMES = ['TimeoutError', 'AbortError']

interface SdkError {
  name?: string
  message?: string
  statusCode?: number
  lastError?: { statusCode?: number }
}

export function toJevError(error: unknown): JevError {
  const sdkError = error as SdkError
  const status = sdkError.statusCode ?? sdkError.lastError?.statusCode
  const timedOut = ABORT_ERROR_NAMES.includes(sdkError.name ?? '')

  let kind: JevErrorKind = 'network'
  if (timedOut) kind = 'timeout'
  else if (status && KIND_BY_STATUS[status]) kind = KIND_BY_STATUS[status]

  return new JevError(kind, sdkError.message ?? String(error), { cause: error })
}
