import { closedClassWords } from './lexicon.ts'
import type { Field, Schema } from './types.ts'

const MIN_LENGTH_FOR_STEMMING = 4
const MIN_LENGTH_FOR_TYPOS = 4
const CLOSED_CLASS = closedClassWords()

export type TermType = 'field' | 'value' | 'adj' | 'entity'

export interface Hit {
  type: TermType
  field?: Field
  canonical?: string
  fuzzy: boolean
}

interface Term {
  term: string
  type: TermType
  field?: Field
  canonical?: string
}

export function norm(text: string): string {
  const word = text.toLowerCase()
  if (word.length < MIN_LENGTH_FOR_STEMMING) return word
  if (/(ies|ie|y)$/.test(word)) return word.replace(/(ies|ie|y)$/, 'i')
  if (/(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

export function oneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false

  let same = 0
  while (same < a.length && same < b.length && a[same] === b[same]) same++

  if (a.length === b.length) {
    const substituted = a.slice(same + 1) === b.slice(same + 1)
    const swapped =
      a[same] === b[same + 1] && a[same + 1] === b[same] && a.slice(same + 2) === b.slice(same + 2)
    return substituted || swapped
  }
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a]
  return longer.slice(same + 1) === shorter.slice(same)
}

function fieldTerms(field: Field): Term[] {
  const names = [field.name, ...(field.aliases ?? [])].map(
    (name): Term => ({ term: norm(name), type: 'field', field }),
  )
  const values = Object.entries(field.values ?? {}).flatMap(([canonical, aliases]) =>
    [canonical, ...aliases].map(
      (alias): Term => ({ term: norm(alias), type: 'value', field, canonical }),
    ),
  )
  const adjectives = Object.entries(field.adjectives ?? {}).map(
    ([adjective, direction]): Term => ({
      term: norm(adjective),
      type: 'adj',
      field,
      canonical: direction,
    }),
  )
  return [...names, ...values, ...adjectives]
}

const termCache = new WeakMap<Schema, Term[]>()

function schemaTerms(schema: Schema): Term[] {
  const cached = termCache.get(schema)
  if (cached) return cached

  const entities = (schema.entity ?? []).map((word): Term => ({ term: norm(word), type: 'entity' }))
  const terms = [...entities, ...schema.fields.flatMap(fieldTerms)]
  termCache.set(schema, terms)
  return terms
}

function toHit(term: Term, fuzzy: boolean): Hit {
  return { type: term.type, field: term.field, canonical: term.canonical, fuzzy }
}

export function matchToken(token: string, schema: Schema): Hit[] {
  const word = norm(token)
  const terms = schemaTerms(schema)

  const exact = terms.filter(term => term.term === word)
  if (exact.length) return exact.map(term => toHit(term, false))
  if (word.length < MIN_LENGTH_FOR_TYPOS || CLOSED_CLASS.has(token.toLowerCase())) return []

  return terms
    .filter(term => term.term.length >= MIN_LENGTH_FOR_TYPOS && oneEdit(term.term, word))
    .map(term => toHit(term, true))
}
