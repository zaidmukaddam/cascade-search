import { inLexicon } from './lexicon.ts'
import { type Hit, matchToken } from './match.ts'
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
  View,
} from './types.ts'

type Direction = 'asc' | 'desc'
type PendingNumber = { op: Op; value: number; negated: boolean }
export type RoleToken = { text: string; role: Role }

const AT_LEAST_WORDS = ['since', 'least', 'min', 'minimum', '>=', 'from']
const AT_MOST_WORDS = ['until', 'till', 'most', 'max', 'maximum', '<=', 'to', 'by']
const KEEPS_SORT_DIRECTION = ['first', 'top']
const FLIPS_ADJECTIVE_SORT = ['last', 'bottom']
const CURRENT_USER = '@me'

const NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  dozen: 12,
  twenty: 20,
  fifty: 50,
  hundred: 100,
}

const MAGNITUDE: Record<string, number> = { '': 1, k: 1e3, m: 1e6 }

const CHART_KIND: Record<string, ChartKind> = {
  bar: 'bar',
  bars: 'bar',
  histogram: 'bar',
  pie: 'pie',
  donut: 'pie',
  line: 'line',
  trend: 'line',
}

const AGGREGATE: Record<string, Aggregate> = {
  total: 'sum',
  sum: 'sum',
  average: 'avg',
  avg: 'avg',
  mean: 'avg',
}

function operatorFor(word: string): Op | null {
  if (AT_LEAST_WORDS.includes(word)) return 'gte'
  if (AT_MOST_WORDS.includes(word)) return 'lte'
  if (inLexicon('GT', word)) return 'gt'
  if (inLexicon('LT', word)) return 'lt'
  if (inLexicon('TEXTPREP', word)) return 'contains'
  if (inLexicon('EQ', word)) return 'eq'
  return null
}

function parseNumber(word: string): number | null {
  if (word in NUMBER_WORDS) return NUMBER_WORDS[word]
  const match = /^(\d+(?:[.,]\d+)?)([km]?)$/.exec(word)
  if (!match) return null
  return Number(match[1].replace(',', '.')) * MAGNITUDE[match[2]]
}

function opposite(direction: Direction): Direction {
  return direction === 'asc' ? 'desc' : 'asc'
}

class Compiler {
  private readonly filter: Filter = { where: [], sort: [], limit: null, view: null }
  private chartKind: ChartKind | null = null
  private expectsGroupField = false
  private expectsMeasureField = false
  private namedField: Field | null = null
  private previousField: Field | null = null
  private operator: Op | null = null
  private negated = false
  private joinsPrevious = false
  private expectsSortField = false
  private expectsLimit = false
  private pendingDirection: Direction | null = null
  private lastSortFromAdjective = false
  private pendingNumber: PendingNumber | null = null
  private position = 0

  private readonly tokens: RoleToken[]
  private readonly schema: Schema

  constructor(tokens: RoleToken[], schema: Schema) {
    this.tokens = tokens
    this.schema = schema
  }

  run(): Filter {
    for (this.position = 0; this.position < this.tokens.length; this.position++) {
      const { text, role } = this.tokens[this.position]
      this.handle(role, text, text.toLowerCase())
    }
    this.attachPendingNumberToOnlyNumberField()
    this.settleView()
    return this.filter
  }

  private handle(role: Role, text: string, word: string) {
    switch (role) {
      case 'FIELD':
        return this.onField(text, word)
      case 'OP':
        this.operator = operatorFor(word) ?? this.operator
        return
      case 'NEG':
        this.negated = true
        return
      case 'OR':
        this.joinsPrevious = true
        return
      case 'SORT':
        this.expectsSortField = true
        return
      case 'LIMIT':
        this.expectsLimit = true
        return
      case 'DIR':
        return this.onDirection(word)
      case 'VAL_ENUM':
        return this.onEnumValue(text, word)
      case 'VAL_PERSON':
        return this.onPerson(text, word)
      case 'VAL_DATE':
        return this.onDate()
      case 'VAL_NUM':
        return this.onNumber(word)
      case 'VAL_TEXT':
        return this.onText()
      case 'GROUP':
        this.ensureView()
        this.expectsGroupField = true
        return
      case 'CHART':
        this.ensureView()
        this.chartKind = CHART_KIND[word] ?? this.chartKind
        return
      case 'AGG':
        this.ensureView().agg = AGGREGATE[word] ?? 'count'
        this.expectsMeasureField = word in AGGREGATE
        return
    }
  }

  private ensureView(): View {
    this.filter.view ??= { chart: 'bar', by: null, agg: 'count', of: null }
    return this.filter.view
  }

  private settleView() {
    const view = this.filter.view
    if (!view) return
    if (view.agg !== 'count' && !view.of) {
      const measure = this.firstFieldOf('number')
      if (measure) view.of = measure.name
      else view.agg = 'count'
    }

    const wantsGroups = this.chartKind === 'bar' || this.chartKind === 'pie'
    if (!view.by && wantsGroups) view.by = this.firstFieldOf('enum')?.name ?? null
    if (!view.by && this.chartKind === 'line') view.by = this.firstFieldOf('date')?.name ?? null

    const groupedByDate = this.schema.fields.some(
      field => field.name === view.by && field.kind === 'date',
    )
    if (!view.by) view.chart = 'number'
    else view.chart = this.chartKind ?? (groupedByDate ? 'line' : 'bar')
  }

  private firstFieldOf(kind: FieldKind): Field | undefined {
    return this.schema.fields.find(field => field.kind === kind)
  }

  private fieldFor(kind: FieldKind): Field | undefined {
    if (this.namedField?.kind === kind) return this.namedField
    if (this.joinsPrevious && this.previousField?.kind === kind) return this.previousField
    return this.firstFieldOf(kind)
  }

  private phrase(): string {
    const role = this.tokens[this.position].role
    const words = [this.tokens[this.position].text.toLowerCase()]
    while (this.tokens[this.position + 1]?.role === role) {
      this.position++
      words.push(this.tokens[this.position].text.toLowerCase())
    }
    return words.join(' ')
  }

  private addCondition(field: Field, op: Op, value: string | number) {
    const condition: Cond = { field: field.name, op, value }
    if (this.negated) condition.not = true

    const previous = this.filter.where.at(-1)
    if (this.joinsPrevious && previous) {
      if ('or' in previous) previous.or.push(condition)
      else this.filter.where[this.filter.where.length - 1] = { or: [previous, condition] }
    } else {
      this.filter.where.push(condition)
    }

    this.previousField = field
    this.namedField = null
    this.operator = null
    this.negated = false
    this.joinsPrevious = false
  }

  private addSort(field: Field, direction: Direction, fromAdjective: boolean) {
    this.filter.sort.push({ field: field.name, dir: direction })
    this.lastSortFromAdjective = fromAdjective
    this.expectsSortField = false
    this.pendingDirection = null
  }

  private onField(text: string, word: string) {
    const hits = matchToken(text, this.schema)
    const adjective = hits.find(hit => hit.type === 'adj')
    const named = hits.find(hit => hit.type === 'field')

    if (adjective && !named) {
      this.addSort(adjective.field!, adjective.canonical as Direction, true)
      return
    }
    if (!named) return

    const field = named.field!
    if (this.expectsGroupField) {
      this.ensureView().by = field.name
      this.expectsGroupField = false
      this.expectsMeasureField = false
    } else if (this.expectsMeasureField && field.kind === 'number') {
      this.ensureView().of = field.name
      this.expectsMeasureField = false
    } else if (this.expectsSortField || this.pendingDirection) {
      this.addSort(field, this.pendingDirection ?? 'asc', false)
    } else if (this.pendingNumber && field.kind === 'number') {
      this.attachPendingNumber(field)
    } else {
      this.namedField = field
      if (inLexicon('PREP', word)) this.operator ??= operatorFor(word)
    }
  }

  private onDirection(word: string) {
    const ascending = inLexicon('ASC', word) && !inLexicon('DESC', word)
    const direction: Direction = ascending ? 'asc' : 'desc'
    const lastSort = this.filter.sort.at(-1)

    if (!lastSort) {
      this.pendingDirection = direction
    } else if (KEEPS_SORT_DIRECTION.includes(word)) {
      return
    } else if (FLIPS_ADJECTIVE_SORT.includes(word)) {
      if (this.lastSortFromAdjective) lastSort.dir = opposite(lastSort.dir)
    } else {
      lastSort.dir = direction
    }
  }

  private onEnumValue(text: string, word: string) {
    const values = matchToken(text, this.schema).filter(hit => hit.type === 'value')
    const best: Hit | undefined =
      values.find(hit => hit.field === this.namedField) ??
      values.find(hit => hit.field!.kind === 'enum') ??
      values[0]
    const textField = this.firstFieldOf('text')

    if (best) this.addCondition(best.field!, 'eq', best.canonical!)
    else if (this.namedField) this.addCondition(this.namedField, 'eq', word)
    else if (textField) this.addCondition(textField, 'contains', word)
  }

  private onPerson(text: string, word: string) {
    const field = this.fieldFor('person')
    if (!field || inLexicon('ANYONE', word)) return

    const known = matchToken(text, this.schema).find(
      hit => hit.type === 'value' && hit.field!.kind === 'person',
    )
    const person = inLexicon('ME', word) ? CURRENT_USER : (known?.canonical ?? word)
    this.addCondition(field, 'eq', person)
  }

  private onDate() {
    const field = this.fieldFor('date')
    const op = this.operator && this.operator !== 'contains' ? this.operator : 'eq'
    const phrase = this.phrase()
    if (field) this.addCondition(field, op, phrase)
  }

  private onNumber(word: string) {
    const value = parseNumber(word)
    if (value === null) return

    if (this.expectsLimit) {
      this.filter.limit = value
      this.expectsLimit = false
    } else if (this.namedField?.kind === 'number') {
      this.addCondition(this.namedField, this.operator ?? 'eq', value)
    } else {
      this.pendingNumber = { op: this.operator ?? 'eq', value, negated: this.negated }
      this.operator = null
      this.negated = false
    }
  }

  private onText() {
    const field = this.fieldFor('text')
    const phrase = this.phrase()
    if (field) this.addCondition(field, 'contains', phrase)
  }

  private attachPendingNumber(field: Field) {
    const pending = this.pendingNumber!
    this.negated = pending.negated
    this.addCondition(field, pending.op, pending.value)
    this.pendingNumber = null
  }

  private attachPendingNumberToOnlyNumberField() {
    const numberFields = this.schema.fields.filter(field => field.kind === 'number')
    if (this.pendingNumber && numberFields.length === 1) this.attachPendingNumber(numberFields[0])
  }
}

export function compile(tokens: RoleToken[], schema: Schema): Filter {
  return new Compiler(tokens, schema).run()
}
