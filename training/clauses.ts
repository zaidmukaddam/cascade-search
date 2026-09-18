import { matchToken } from '../packages/core/src/match.ts'
import type {
  Aggregate,
  ChartKind,
  Cond,
  Field,
  FieldKind,
  Filter,
  Op,
  Role,
  Schema,
} from '../packages/core/src/types.ts'
import type { Domain } from './domains.ts'
import type { Random } from './random.ts'

export type Labeled = [word: string, role: Role]

type Direction = 'asc' | 'desc'
type Comparison = [words: string[], op: Op]
type DateBound = [word: string, op: Op]

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MONTHS = [
  ...['january', 'february', 'march', 'april', 'june', 'july', 'august', 'october', 'november'],
  ...['jan', 'feb', 'aug', 'sept', 'oct', 'dec'],
]
const TYPO_LETTERS = [...'aeiours']
const EQUALS_WORDS = ['is', ':', '=', 'equals', '']
const NEGATION_WORDS = ['not', 'except', 'excluding', 'without', 'no', 'non']
const PREPOSITION_ALIASES = ['from', 'by', 'for', 'via']
const UNSORTABLE_ALIASES = ['from', 'by', 'for']
const TEXT_PREPOSITIONS = ['about', 'mentioning', 'containing', 'regarding', 'matching', 'like']
const TEXT_VERBS = ['contains', 'containing', 'like', 'mentions']
const LIMIT_WORDS = ['top', 'first', 'limit', 'only', 'just']
const NUMBER_AS_WORD: Record<number, string> = { 3: 'three', 5: 'five', 10: 'ten', 20: 'twenty' }

const DATE_BOUNDS: DateBound[] = [
  ['since', 'gte'],
  ['after', 'gt'],
  ['before', 'lt'],
  ['until', 'lte'],
  ['from', 'gte'],
]

const COMPARISONS: Comparison[] = [
  [['over'], 'gt'],
  [['above'], 'gt'],
  [['more', 'than'], 'gt'],
  [['>'], 'gt'],
  [['under'], 'lt'],
  [['below'], 'lt'],
  [['less', 'than'], 'lt'],
  [['fewer', 'than'], 'lt'],
  [['<'], 'lt'],
  [['at', 'least'], 'gte'],
  [['>='], 'gte'],
  [['at', 'most'], 'lte'],
  [['<='], 'lte'],
  [['with'], 'eq'],
  [['='], 'eq'],
  [[':'], 'eq'],
]

const CHART_WORDS: Record<'bar' | 'pie' | 'line', string[]> = {
  bar: ['bar', 'bar', 'bars', 'histogram'],
  pie: ['pie', 'pie', 'donut'],
  line: ['line', 'line', 'trend'],
}

const COUNT_OPENERS: Labeled[][] = [
  [
    ['how', 'O'],
    ['many', 'AGG'],
  ],
  [['count', 'AGG']],
  [
    ['count', 'AGG'],
    ['of', 'O'],
  ],
  [
    ['count', 'AGG'],
    ['the', 'O'],
  ],
]

const MEASURE_WORDS: [string, Aggregate][] = [
  ['total', 'sum'],
  ['sum', 'sum'],
  ['average', 'avg'],
  ['avg', 'avg'],
  ['mean', 'avg'],
]

const GROUP_WORDS: Labeled[][] = [
  [['by', 'GROUP']],
  [['by', 'GROUP']],
  [['per', 'GROUP']],
  [
    ['grouped', 'GROUP'],
    ['by', 'GROUP'],
  ],
  [
    ['group', 'GROUP'],
    ['by', 'GROUP'],
  ],
  [
    ['for', 'O'],
    ['each', 'GROUP'],
  ],
  [['across', 'GROUP']],
]

const TYPO_MIN_LENGTH = 5
const TYPO_RATE = 0.06

function capitalize(word: string): string {
  return word[0].toUpperCase() + word.slice(1)
}

function opposite(direction: Direction): Direction {
  return direction === 'asc' ? 'desc' : 'asc'
}

function condition(field: Field, op: Op, value: string | number, negated = false): Cond {
  const cond: Cond = { field: field.name, op, value }
  if (negated) cond.not = true
  return cond
}

export class ClauseWriter {
  readonly filter: Filter = { where: [], sort: [], limit: null, view: null }

  private readonly random: Random
  private readonly domain: Domain
  private readonly schema: Schema

  constructor(random: Random, domain: Domain, schema: Schema) {
    this.random = random
    this.domain = domain
    this.schema = schema
  }

  fieldsOf(kind: FieldKind): Field[] {
    return this.schema.fields.filter(field => field.kind === kind)
  }

  private withTypo(word: string, stillResolves: (typo: string) => boolean): string {
    if (word.length < TYPO_MIN_LENGTH || !this.random.chance(TYPO_RATE)) return word
    const at = this.random.int(1, word.length - 2)
    const head = word.slice(0, at)
    const typo = this.random.pick([
      head + word.slice(at + 1),
      head + word[at + 1] + word[at] + word.slice(at + 2),
      head + this.random.pick(TYPO_LETTERS) + word.slice(at + 1),
      head + this.random.pick(TYPO_LETTERS) + word.slice(at),
    ])
    return typo !== word && stillResolves(typo) ? typo : word
  }

  private fieldWord(field: Field, pool = [field.name, ...(field.aliases ?? [])]): string {
    const word = this.random.pick(pool)
    return this.withTypo(word, typo => {
      const hits = matchToken(typo, this.schema)
      return hits.length === 1 && hits[0].type === 'field' && hits[0].field === field
    })
  }

  private enumSurface(field: Field, canonical: string, aliases: string[]): string {
    let word = this.random.pick([canonical, canonical, ...aliases])
    const pluralize = this.random.chance(0.25) && /[a-rt-z]$/.test(word) && word.length > 2
    if (pluralize) word += 's'
    return this.withTypo(word, typo => {
      const values = matchToken(typo, this.schema).filter(hit => hit.type === 'value')
      return values.length === 1 && values[0].canonical === canonical && values[0].field === field
    })
  }

  enumClause(): Labeled[] {
    const { random } = this
    const field = random.pick(this.fieldsOf('enum'))
    const entries = Object.entries(field.values!)
    const [canonical, aliases] = random.pick(entries)
    const words: Labeled[] = []

    const named = random.chance(0.3)
    if (named) {
      words.push([this.fieldWord(field), 'FIELD'])
      const equals = random.pick(EQUALS_WORDS)
      if (equals) words.push([equals, 'OP'])
    }

    const negated = random.chance(0.2)
    if (negated) {
      const negation = named ? random.pick(['not', '!=']) : random.pick(NEGATION_WORDS)
      words.push([negation, 'NEG'])
    }

    words.push([this.enumSurface(field, canonical, aliases), 'VAL_ENUM'])
    const first = condition(field, 'eq', canonical, negated)

    const alternative = !negated && entries.length > 1 && random.chance(0.15)
    if (!alternative) {
      this.filter.where.push(first)
      return words
    }

    const [otherCanonical, otherAliases] = random.pick(
      entries.filter(([value]) => value !== canonical),
    )
    words.push(['or', 'OR'], [this.enumSurface(field, otherCanonical, otherAliases), 'VAL_ENUM'])
    this.filter.where.push({ or: [first, condition(field, 'eq', otherCanonical)] })
    return words
  }

  personClause(): Labeled[] {
    const { random } = this
    const personFields = this.fieldsOf('person')
    const field = random.pick(personFields)
    const isMe = random.chance(0.25)
    const name = isMe ? 'me' : random.pick(this.domain.people)

    let shown: string
    if (isMe) shown = random.pick(['me', 'me', 'myself'])
    else shown = random.chance(0.5) ? capitalize(name) : name

    const bare = random.chance(0.3)
    if (bare) {
      this.filter.where.push(condition(personFields[0], 'eq', isMe ? '@me' : name))
      return [[isMe ? 'my' : shown, 'VAL_PERSON']]
    }

    const fieldWord = this.fieldWord(field)
    const words: Labeled[] = [[fieldWord, 'FIELD']]
    if (fieldWord.endsWith('ed')) {
      words.push([random.pick(['to', 'by']), 'O'])
    } else if (!PREPOSITION_ALIASES.includes(fieldWord)) {
      const equals = random.pick(['is', ':', '', ''])
      if (equals) words.push([equals, 'OP'])
    }

    const negated = random.chance(0.15)
    if (negated) {
      if (random.chance(0.5)) {
        const everyone = random.pick(['anyone', 'everyone', 'anybody'])
        const except = random.pick(['except', 'but', 'excluding'])
        words.push([everyone, 'O'], [except, 'NEG'])
      } else {
        words.push(['not', 'NEG'])
      }
    }

    words.push([shown, 'VAL_PERSON'])
    this.filter.where.push(condition(field, 'eq', isMe ? '@me' : name, negated))
    return words
  }

  private datePhrase(): string[] {
    const { random } = this
    const count = String(random.int(2, 9))
    const twoDigits = (value: number) => String(value).padStart(2, '0')
    return random.pick([
      ['yesterday'],
      ['today'],
      [random.pick(WEEKDAYS)],
      [random.pick(MONTHS)],
      [random.pick(['last', 'this']), random.pick(['week', 'month', 'year', 'quarter'])],
      [count, random.pick(['days', 'weeks', 'months']), 'ago'],
      ['last', count, random.pick(['days', 'weeks', 'months'])],
      [`202${random.int(0, 6)}-${twoDigits(random.int(1, 12))}-${twoDigits(random.int(1, 28))}`],
      [random.pick(MONTHS), String(random.int(1, 28))],
    ])
  }

  dateClause(): Labeled[] {
    const { random } = this
    const dateFields = this.fieldsOf('date')
    const named = random.chance(0.4)
    const field = named ? random.pick(dateFields) : dateFields[0]
    const phrase = this.datePhrase()
    const bound = random.chance(0.55) ? random.pick(DATE_BOUNDS) : null

    const words: Labeled[] = []
    if (named) words.push([this.fieldWord(field), 'FIELD'])

    const isRollingWindow = phrase[0] === 'last' && phrase.length === 3
    if (bound) words.push([bound[0], 'OP'])
    else if (isRollingWindow && random.chance(0.6)) words.push(['in', 'OP'], ['the', 'O'])

    for (const word of phrase) words.push([word, 'VAL_DATE'])
    this.filter.where.push(condition(field, bound?.[1] ?? 'eq', phrase.join(' ')))
    return words
  }

  numberClause(): Labeled[] {
    const { random } = this
    const field = random.pick(this.fieldsOf('number'))
    const value = random.pick([
      random.int(1, 12),
      random.int(1, 12),
      random.int(10, 500),
      random.int(1, 9) * 1000,
    ])
    const abbreviated = value >= 1000 && random.chance(0.5)
    const shown = abbreviated ? `${value / 1000}k` : String(value)
    const [comparisonWords, op] = random.pick(COMPARISONS)

    const comparison: Labeled[] = comparisonWords.map(word => [
      word,
      word === 'than' || word === 'at' ? 'O' : 'OP',
    ])
    this.filter.where.push(condition(field, op, value))

    const fieldWord: Labeled = [this.fieldWord(field), 'FIELD']
    const number: Labeled = [shown, 'VAL_NUM']
    const isSymbol = /[<>=:]/.test(comparisonWords[0])
    const fieldFirst = isSymbol || random.chance(0.4)
    return fieldFirst ? [fieldWord, ...comparison, number] : [...comparison, number, fieldWord]
  }

  textClause(): Labeled[] {
    const { random } = this
    const textFields = this.fieldsOf('text')
    const topics = this.domain.words
    const phrase = random.chance(0.3)
      ? [random.pick(topics), random.pick(topics)]
      : [random.pick(topics)]
    const values: Labeled[] = phrase.map(word => [word, 'VAL_TEXT'])
    const style = random.next()

    if (style < 0.35) {
      this.filter.where.push(condition(textFields[0], 'contains', phrase.join(' ')))
      return values
    }
    if (style < 0.7) {
      this.filter.where.push(condition(textFields[0], 'contains', phrase.join(' ')))
      return [[random.pick(TEXT_PREPOSITIONS), 'OP'], ...values]
    }

    const field = random.pick(textFields)
    this.filter.where.push(condition(field, 'contains', phrase.join(' ')))
    const fieldWord = this.fieldWord(field)
    return [[fieldWord, 'FIELD'], [random.pick(TEXT_VERBS), 'OP'], ...values]
  }

  private adjectiveSort(fieldsWithAdjectives: Field[]): Labeled[] {
    const { random } = this
    const field = random.pick(fieldsWithAdjectives)
    const [adjective, direction] = random.pick(Object.entries(field.adjectives!))
    const words: Labeled[] = [[adjective, 'FIELD']]
    if (random.chance(0.3)) words.push([random.pick(['ones', 'things']), 'O'])

    const style = random.next()
    if (style < 0.6) {
      words.push(['first', 'DIR'])
      this.filter.sort.push({ field: field.name, dir: direction })
    } else if (style < 0.75) {
      words.push(['last', 'DIR'])
      this.filter.sort.push({ field: field.name, dir: opposite(direction) })
    } else {
      this.filter.sort.push({ field: field.name, dir: direction })
    }
    return words
  }

  sortClause(): Labeled[] {
    const { random } = this
    const fieldsWithAdjectives = this.schema.fields.filter(field => field.adjectives)
    if (fieldsWithAdjectives.length && random.chance(0.5)) {
      return this.adjectiveSort(fieldsWithAdjectives)
    }

    const sortable = this.schema.fields.filter(
      field => field.kind !== 'person' && field.kind !== 'text',
    )
    if (!sortable.length) return []

    const field = random.pick(sortable)
    const aliases = (field.aliases ?? []).filter(alias => !UNSORTABLE_ALIASES.includes(alias))
    const fieldWord: Labeled = [this.fieldWord(field, [field.name, ...aliases]), 'FIELD']

    if (random.chance(0.25)) {
      const [superlative, direction] = random.pick([
        ['highest', 'desc'],
        ['lowest', 'asc'],
      ] as const)
      this.filter.sort.push({ field: field.name, dir: direction })
      return [[superlative, 'DIR'], fieldWord, ['first', 'DIR']]
    }

    const sortWord = random.pick(['sort', 'sorted', 'order', 'ordered'])
    const words: Labeled[] = [[sortWord, 'SORT'], ['by', 'SORT'], fieldWord]
    const direction = random.pick([null, null, 'asc', 'desc'] as const)
    if (direction) {
      const spellings =
        direction === 'asc' ? ['asc', 'ascending'] : ['desc', 'descending', 'reversed']
      words.push([random.pick(spellings), 'DIR'])
    }
    this.filter.sort.push({ field: field.name, dir: direction ?? 'asc' })
    return words
  }

  private groupFieldWord(field: Field): string {
    const aliases = (field.aliases ?? []).filter(
      alias => !PREPOSITION_ALIASES.includes(alias) && !alias.endsWith('ed'),
    )
    return this.fieldWord(field, [field.name, field.name, ...aliases])
  }

  private chartWords(kind: keyof typeof CHART_WORDS | null): Labeled[] {
    const { random } = this
    const generic = random.pick(['chart', 'graph', 'plot'])
    if (!kind) {
      const word = random.pick([generic, generic, 'breakdown', 'distribution'])
      return [[word, 'CHART']]
    }
    const kindWord = random.pick(CHART_WORDS[kind])
    const words: Labeled[] = [[kindWord, 'CHART']]
    if (kindWord !== 'histogram' && kindWord !== 'trend' && random.chance(0.7)) {
      words.push([generic, 'CHART'])
    }
    return words
  }

  viewClause(): { before: Labeled[]; after: Labeled[] } {
    const { random } = this
    const before: Labeled[] = []
    const after: Labeled[] = []
    const groupable = this.schema.fields.filter(
      field => field.kind === 'enum' || field.kind === 'person' || field.kind === 'date',
    )
    const numberFields = this.fieldsOf('number')

    let agg: Aggregate = 'count'
    let of: string | null = null
    const style = random.next()
    if (style < 0.25) {
      before.push(...random.pick(COUNT_OPENERS))
    } else if (style < 0.45 && numberFields.length) {
      const measure = random.pick(numberFields)
      const [word, aggregate] = random.pick(MEASURE_WORDS)
      agg = aggregate
      of = measure.name
      before.push([word, 'AGG'], [this.fieldWord(measure), 'FIELD'])
      if (random.chance(0.6)) before.push([random.pick(['of', 'for']), 'O'])
    }

    const aggregated = before.length > 0
    const explicitKind = random.chance(aggregated ? 0.2 : 0.55)
      ? random.pick(['bar', 'pie', 'line'] as const)
      : null
    const showsChartWord = explicitKind !== null || (!aggregated && random.chance(0.5))
    const chartFirst = showsChartWord && random.chance(0.5)
    if (showsChartWord && chartFirst) {
      before.unshift(...this.chartWords(explicitKind), ['of', 'O'])
    }

    const grouped = groupable.length > 0 && random.chance(aggregated ? 0.5 : 0.85)
    let by: string | null = null
    if (grouped) {
      const field = random.pick(groupable)
      by = field.name
      after.push(...random.pick(GROUP_WORDS), [this.groupFieldWord(field), 'FIELD'])
    }
    if (showsChartWord && !chartFirst) {
      after.push(['as', 'O'], ['a', 'O'], ...this.chartWords(explicitKind))
    }
    if (!before.length && !after.length) before.push(...random.pick(COUNT_OPENERS))

    const firstOf = (kind: FieldKind) => this.fieldsOf(kind)[0]?.name ?? null
    if (!by && (explicitKind === 'bar' || explicitKind === 'pie')) by = firstOf('enum')
    if (!by && explicitKind === 'line') by = firstOf('date')
    const byDate = this.fieldsOf('date').some(field => field.name === by)
    const chart: ChartKind = by ? (explicitKind ?? (byDate ? 'line' : 'bar')) : 'number'

    this.filter.view = { chart, by, agg, of }
    return { before, after }
  }

  limitClause(): Labeled[] {
    const { random } = this
    const limit = random.pick([3, 5, 10, 20, 50, random.int(2, 99)])
    this.filter.limit = limit
    const limitWord = random.pick(LIMIT_WORDS)
    const spelledOut = NUMBER_AS_WORD[limit] && random.chance(0.3)
    const shown = spelledOut ? NUMBER_AS_WORD[limit] : String(limit)
    return [
      [limitWord, 'LIMIT'],
      [shown, 'VAL_NUM'],
    ]
  }
}
