import { mkdirSync, writeFileSync } from 'node:fs'
import { F, featurize } from '../packages/core/src/features.ts'
import { pretty } from '../packages/core/src/ir.ts'
import { MAX_TOKENS, tokenize } from '../packages/core/src/tokenize.ts'
import {
  type Field,
  type FieldKind,
  type Filter,
  ROLES,
  type Role,
  type Schema,
} from '../packages/core/src/types.ts'
import { ClauseWriter, type Labeled } from './clauses.ts'
import { DOMAINS, type Domain } from './domains.ts'
import { mulberry32, Random, type Rng } from './random.ts'

export { mulberry32, type Rng } from './random.ts'

export interface Example {
  domain: string
  q: string
  tokens: string[]
  roles: Role[]
  schema: Schema
  filter: Filter
}

export const NOISE = {
  train: [
    ...['kinda', 'basically', 'whatever', 'maybe', 'really', 'actually', 'probably'],
    ...['currently', 'somehow', 'anyway', 'roughly', 'mostly', 'pls', 'asap', 'hmm', 'okay'],
    ...['urgently', 'fast', 'random', 'weird'],
  ],
  transfer: [
    ...['sorta', 'literally', 'honestly', 'perhaps', 'definitely', 'possibly', 'presently'],
    ...['somewhere', 'regardless', 'approximately', 'mainly', 'thx', 'swiftly', 'umm'],
    ...['alright', 'odd', 'various', 'certain', 'proper', 'fancy'],
  ],
}

export const SEEDS = { train: 1, val: 2, transfer: 3 }

const MIN_FIELDS = 3
const KEEP_FIELD = 0.85
const KNOWN_PERSON = 0.2
const VIEW_RATE = 0.22

const OPENERS: Labeled[][] = [
  [
    ['show', 'O'],
    ['me', 'O'],
  ],
  [['find', 'O']],
  [
    ['list', 'O'],
    ['all', 'O'],
  ],
  [['get', 'O']],
  [['show', 'O']],
  [['all', 'O']],
  [['search', 'O']],
  [
    ['give', 'O'],
    ['me', 'O'],
    ['the', 'O'],
  ],
]

const CONNECTIVES = ['and', 'that', 'which', 'also']
const RUN_ROLES: Role[] = ['VAL_TEXT', 'VAL_DATE']

function sampleSchema(domain: Domain, random: Random): Schema {
  const kept = domain.schema.fields.filter(() => random.chance(KEEP_FIELD))
  const chosen = kept.length >= MIN_FIELDS ? kept : domain.schema.fields

  const fields: Field[] = chosen.map(field => {
    if (field.kind !== 'person') return field
    const known = domain.people.filter(() => random.chance(KNOWN_PERSON))
    return { ...field, values: Object.fromEntries(known.map(person => [person, []])) }
  })

  const claimed = new Set<string>()
  for (const field of fields) {
    if (field.kind !== 'person') continue
    for (const person of Object.keys(field.values ?? {})) {
      if (claimed.has(person)) delete field.values?.[person]
      else claimed.add(person)
    }
  }
  return { entity: domain.schema.entity, fields }
}

function chooseClauses(writer: ClauseWriter, random: Random): (() => Labeled[])[] {
  const available: [FieldKind, () => Labeled[], number][] = [
    ['enum', () => writer.enumClause(), 0.75],
    ['person', () => writer.personClause(), 0.45],
    ['date', () => writer.dateClause(), 0.35],
    ['number', () => writer.numberClause(), 0.25],
    ['text', () => writer.textClause(), 0.25],
  ]
  const has = (kind: FieldKind) => writer.fieldsOf(kind).length > 0

  const clauses = available
    .filter(([kind, , probability]) => has(kind) && random.chance(probability))
    .map(([, write]) => write)
  if (has('enum') && random.chance(0.3)) clauses.push(available[0][1])
  if (!clauses.length) clauses.push(available.find(([kind]) => has(kind))![1])

  if (random.chance(0.5)) clauses.sort(() => random.next() - 0.5)
  return clauses
}

function writeQuery(domain: Domain, schema: Schema, random: Random) {
  const writer = new ClauseWriter(random, domain, schema)
  const clauses = chooseClauses(writer, random)
  const view = random.chance(VIEW_RATE) ? writer.viewClause() : null
  const sortFirst = !view && random.chance(0.1)

  const words: Labeled[] = []
  if (random.chance(0.35)) words.push(...random.pick(OPENERS))
  if (view) words.push(...view.before)
  const limitFirst = !view && random.chance(0.12)
  if (limitFirst) words.push(...writer.limitClause())
  if (sortFirst) words.push(...writer.sortClause())
  const entityAfter = random.chance(0.5) ? random.int(0, clauses.length - 1) : -1

  clauses.forEach((write, index) => {
    if (index > 0 && random.chance(0.15)) words.push([random.pick(CONNECTIVES), 'O'])
    const clause = write()
    if (random.chance(0.12)) words.push([random.pick(NOISE[domain.split]), 'O'])

    const previousRole = words.at(-1)?.[1]
    const wouldFuse = previousRole === clause[0][1] && RUN_ROLES.includes(clause[0][1])
    if (wouldFuse) words.push(['and', 'O'])
    words.push(...clause)

    if (index === entityAfter) {
      const noun = random.pick(schema.entity ?? [])
      words.push([random.chance(0.7) ? `${noun}s` : noun, 'O'])
    }
  })

  if (view) words.push(...view.after)
  if (!sortFirst && random.chance(0.25)) words.push(...writer.sortClause())
  if (!limitFirst && random.chance(0.08)) words.push(...writer.limitClause())
  if (random.chance(0.05)) words.push(['please', 'O'])

  const shouting = random.chance(0.06)
  const labeled = shouting
    ? words.map(([word, role]): Labeled => [word.toUpperCase(), role])
    : words
  return { labeled, filter: writer.filter }
}

export function generate(domain: Domain, rng: Rng): Example {
  const random = new Random(rng)
  const schema = sampleSchema(domain, random)
  const { labeled, filter } = writeQuery(domain, schema, random)
  if (labeled.length > MAX_TOKENS) return generate(domain, rng)

  const written = labeled.map(([word]) => word).join(' ')
  const q = written.replace(/ : /g, ': ')
  const tokens = tokenize(q).map(token => token.text)
  if (tokens.join(' ') !== written) {
    throw new Error(`tokenizer disagrees: ${q} -> ${tokens.join('|')}`)
  }
  return { domain: domain.name, q, tokens, roles: labeled.map(([, role]) => role), schema, filter }
}

export function dataset(split: Domain['split'], size: number, seed: number): Example[] {
  const rng = mulberry32(seed)
  const domains = DOMAINS.filter(domain => domain.split === split)
  return Array.from({ length: size }, (_, index) => generate(domains[index % domains.length], rng))
}

export function goldTokens(ex: Example): { text: string; role: Role }[] {
  return ex.tokens.map((text, index) => ({ text, role: ex.roles[index] }))
}

export function toRow(ex: Example) {
  return {
    d: ex.domain,
    q: ex.q,
    f: featurize(tokenize(ex.q), ex.schema),
    y: ex.roles.map(role => ROLES.indexOf(role)),
    ir: pretty(ex.filter),
  }
}

function writeSplit(name: string, examples: Example[]) {
  const lines = examples.map(example => JSON.stringify(toRow(example)))
  writeFileSync(new URL(`./data/${name}.jsonl`, import.meta.url), `${lines.join('\n')}\n`)
  const samples = examples.slice(0, 4).map(example => example.q)
  console.log(name, examples.length, samples)
}

if (import.meta.main) {
  mkdirSync(new URL('./data/', import.meta.url), { recursive: true })
  const meta = { features: F, roles: ROLES }
  writeFileSync(new URL('./data/meta.json', import.meta.url), JSON.stringify(meta))
  writeSplit('train', dataset('train', 60000, SEEDS.train))
  writeSplit('val', dataset('train', 6000, SEEDS.val))
  writeSplit('transfer', dataset('transfer', 8000, SEEDS.transfer))
}
