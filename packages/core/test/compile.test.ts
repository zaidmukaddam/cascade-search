import { expect, test } from 'vitest'
import { DOMAINS, type Domain } from '../../../training/domains.ts'
import { dataset, goldTokens, NOISE } from '../../../training/gen.ts'
import { compile } from '../src/compile.ts'
import { pretty } from '../src/ir.ts'
import { closedClassWords } from '../src/lexicon.ts'
import { norm, oneEdit } from '../src/match.ts'
import type { Role, Schema } from '../src/types.ts'

const issues = DOMAINS[0].schema

function compileTagged(tagged: string): string {
  const tokens = tagged.split(' ').map(pair => {
    const [text, role] = pair.split('/')
    return { text, role: role as Role }
  })
  return pretty(compile(tokens, issues))
}

function schemaWords(schema: Schema): string[] {
  const fieldWords = schema.fields.flatMap(field => [
    field.name,
    ...(field.aliases ?? []),
    ...Object.entries(field.values ?? {}).flat(2),
    ...Object.keys(field.adjectives ?? {}),
  ])
  return [...(schema.entity ?? []), ...fieldWords]
}

function vocabulary(split: Domain['split']): Set<string> {
  const closed = closedClassWords()
  const words = DOMAINS.filter(domain => domain.split === split).flatMap(domain => [
    ...NOISE[split],
    ...domain.people,
    ...domain.words,
    ...schemaWords(domain.schema),
  ])
  return new Set(words.map(norm).filter(word => !closed.has(word)))
}

test('alias, plural, and single-char typo tolerance', () => {
  expect(compileTagged('defects/VAL_ENUM')).toBe('type:bug')
  expect(compileTagged('bugs/VAL_ENUM')).toBe('type:bug')
  expect(compileTagged('urgnet/VAL_ENUM')).toBe('priority:urgent')
  expect(compileTagged('staus/FIELD is/OP closd/VAL_ENUM')).toBe('status:closed')
  expect(oneEdit('status', 'statsu')).toBe(true)
  expect(oneEdit('open', 'opn')).toBe(true)
  expect(oneEdit('open', 'on')).toBe(false)
})

test("the plan's example queries", () => {
  expect(compileTagged('open/VAL_ENUM bugs/VAL_ENUM from/FIELD sam/VAL_PERSON')).toBe(
    'status:open type:bug author:sam',
  )
  expect(compileTagged('big/FIELD ones/O first/DIR')).toBe('@sort:-points')
  expect(
    compileTagged('the/O thing/O from/OP last/VAL_DATE week/VAL_DATE about/OP auth/VAL_TEXT'),
  ).toBe('created>="last week" title~auth')
  expect(
    compileTagged(
      'closed/VAL_ENUM by/FIELD anyone/O except/NEG me/VAL_PERSON since/OP tuesday/VAL_DATE',
    ),
  ).toBe('status:closed -author:@me created>=tuesday')
})

test('a preposition mislabelled as a field still bounds the date', () => {
  expect(compileTagged('from/FIELD last/VAL_DATE week/VAL_DATE')).toBe('created>="last week"')
})

test('a number before its field, a limit, and a flipped adjective sort', () => {
  expect(
    compileTagged('top/LIMIT 10/VAL_NUM over/OP 5/VAL_NUM comments/FIELD oldest/FIELD last/DIR'),
  ).toBe('comments>5 @sort:-created @limit:10')
})

test('gold roles compile to the gold filter on every generated query', () => {
  for (const split of ['train', 'transfer'] as const) {
    for (const ex of dataset(split, 4000, 99)) {
      expect(pretty(compile(goldTokens(ex), ex.schema)), ex.q).toBe(pretty(ex.filter))
    }
  }
})

test('transfer domains share no schema word, name, or topic word with train domains', () => {
  const train = vocabulary('train')
  const shared = [...vocabulary('transfer')].filter(word => train.has(word))
  expect(shared).toEqual([])
})

test('within a schema every term means exactly one thing', () => {
  for (const domain of DOMAINS) {
    const terms = schemaWords(domain.schema).map(norm)
    const duplicates = terms.filter((term, index) => terms.indexOf(term) !== index)
    expect(duplicates, domain.name).toEqual([])
  }
})
