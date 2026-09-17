import { type EscalationRequest, type FieldKind, KINDS, ROLES, type Role } from 'cascade-search'

const MAX_WORDS = 24
const MAX_WORD_LENGTH = 48
const MAX_MATCHES_PER_WORD = 8
const MAX_MATCH_LENGTH = 32

function isShortString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength
}

function isArrayOf<T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(isItem)
}

function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role)
}

function isKind(value: unknown): value is FieldKind {
  return KINDS.includes(value as FieldKind)
}

function isWord(value: unknown): value is string {
  return isShortString(value, MAX_WORD_LENGTH)
}

function isMatchList(value: unknown): value is string[] {
  const isMatch = (item: unknown): item is string => isShortString(item, MAX_MATCH_LENGTH)
  return isArrayOf(value, isMatch) && value.length <= MAX_MATCHES_PER_WORD
}

export function validateRequest(body: unknown): EscalationRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const { words, ask, localRoles, matches, kinds } = body as Record<string, unknown>

  if (!isArrayOf(words, isWord) || words.length < 1 || words.length > MAX_WORDS) return null
  const isWordIndex = (item: unknown): item is number =>
    Number.isInteger(item) && (item as number) >= 0 && (item as number) < words.length

  if (!isArrayOf(ask, isWordIndex) || ask.length < 1) return null
  if (!isArrayOf(localRoles, isRole) || localRoles.length !== words.length) return null
  if (!isArrayOf(matches, isMatchList) || matches.length !== words.length) return null
  if (!isArrayOf(kinds, isKind)) return null

  return { words, ask: [...new Set(ask)], localRoles, matches, kinds: [...new Set(kinds)] }
}
