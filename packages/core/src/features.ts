import { inLexicon, LEXICON_NAMES } from './lexicon.ts'
import { type Hit, matchToken } from './match.ts'
import type { Token } from './tokenize.ts'
import { KINDS, type Schema } from './types.ts'

export const FEATURE_NAMES = [
  'shape:alpha',
  'shape:digit',
  'shape:alnum',
  'shape:symbol',
  'shape:has@',
  'shape:has-.',
  'case:lower',
  'case:Title',
  'case:UPPER',
  'len:1',
  'len:2-3',
  'len:4-6',
  'len:7+',
  'pos:first',
  'pos:last',
  ...LEXICON_NAMES.map(name => `lex:${name}`),
  ...KINDS.map(kind => `field:${kind}`),
  'field:fuzzy',
  'value:exact',
  'value:fuzzy',
  'value:person',
  'match:multi',
  'match:adjective',
  'match:entity',
  'lit:number',
  'lit:date',
  'unknown',
]

export const F = FEATURE_NAMES.length

const INDEX = new Map(FEATURE_NAMES.map((name, index) => [name, index]))

const NUMBER_LITERAL = /^\d+([.,]\d+)?[kKmM]?$/
const DATE_LITERAL =
  /^(\d{4}-\d{1,2}(-\d{1,2})?|\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?|\d{1,2}(st|nd|rd|th)|\d+(d|w|mo|y|h))$/i

function shapeFeature(text: string): string {
  const hasLetter = /[a-z]/i.test(text)
  const hasDigit = /\d/.test(text)
  if (hasLetter && hasDigit) return 'shape:alnum'
  if (hasLetter) return 'shape:alpha'
  if (hasDigit) return 'shape:digit'
  return 'shape:symbol'
}

function caseFeature(text: string): string | null {
  if (!/[a-z]/i.test(text)) return null
  if (text === text.toLowerCase()) return 'case:lower'
  if (text === text.toUpperCase() && text.length > 1) return 'case:UPPER'
  if (text[0] !== text[0].toLowerCase()) return 'case:Title'
  return 'case:lower'
}

function lengthFeature(text: string): string {
  if (text.length === 1) return 'len:1'
  if (text.length <= 3) return 'len:2-3'
  if (text.length <= 6) return 'len:4-6'
  return 'len:7+'
}

function matchFeatures(hit: Hit): string[] {
  if (hit.type === 'adj') return ['match:adjective']
  if (hit.type === 'entity') return ['match:entity']
  if (hit.type === 'field') {
    const kind = `field:${hit.field!.kind}`
    return hit.fuzzy ? [kind, 'field:fuzzy'] : [kind]
  }
  if (hit.field!.kind === 'person') return ['value:person']
  return [hit.fuzzy ? 'value:fuzzy' : 'value:exact']
}

function tokenFeatures(text: string, isFirst: boolean, isLast: boolean, schema: Schema): string[] {
  const word = text.toLowerCase()
  const names = [shapeFeature(text), lengthFeature(text)]

  const letterCase = caseFeature(text)
  if (letterCase) names.push(letterCase)
  if (text.includes('@')) names.push('shape:has@')
  if (/[-.]/.test(text)) names.push('shape:has-.')
  if (isFirst) names.push('pos:first')
  if (isLast) names.push('pos:last')

  const lexicons = LEXICON_NAMES.filter(name => inLexicon(name, word))
  names.push(...lexicons.map(name => `lex:${name}`))

  const hits = matchToken(text, schema)
  names.push(...hits.flatMap(matchFeatures))
  if (hits.length > 1) names.push('match:multi')

  const isNumber = NUMBER_LITERAL.test(text)
  const isDate = !isNumber && DATE_LITERAL.test(text)
  if (isNumber) names.push('lit:number')
  if (isDate) names.push('lit:date')

  const recognised = lexicons.length > 0 || hits.length > 0 || isNumber || isDate
  if (!recognised) names.push('unknown')
  return names
}

export function featurize(tokens: Token[], schema: Schema): number[][] {
  return tokens.map((token, position) => {
    const names = tokenFeatures(token.text, position === 0, position === tokens.length - 1, schema)
    const indices = new Set(names.map(name => INDEX.get(name)!))
    return [...indices].sort((a, b) => a - b)
  })
}
