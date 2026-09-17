import type { Cond, Filter, Op } from './types.ts'

const OPERATOR_SYMBOL: Record<Op, string> = {
  eq: ':',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  contains: '~',
}

const OPERATOR_BY_SYMBOL = Object.fromEntries(
  Object.entries(OPERATOR_SYMBOL).map(([op, symbol]) => [symbol, op]),
) as Record<string, Op>

const BARE_VALUE = /^[A-Za-z_@][\w@.-]*$/
const NUMBER_VALUE = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i

const OPEN_GROUP = String.raw`(?<open>\()`
const CLOSE_GROUP = String.raw`(?<close>\))`
const OR_KEYWORD = String.raw`(?<or>OR)\b`
const SORT = String.raw`@sort:(?<descending>-?)(?<sortField>[A-Za-z_][\w-]*)`
const LIMIT = String.raw`@limit:(?<limit>\d+)`
const CONDITION = [
  String.raw`(?<negated>-?)(?<field>[A-Za-z_][\w-]*)`,
  '(?<symbol>>=|<=|[:><~])',
  String.raw`(?<value>"(?:[^"\\]|\\.)*"|[^\s()]+)`,
].join('')

const TOKEN = new RegExp(
  String.raw`\s*(?:${[OPEN_GROUP, CLOSE_GROUP, OR_KEYWORD, SORT, LIMIT, CONDITION].join('|')})`,
  'y',
)

function printValue(value: string | number): string {
  if (typeof value === 'number') return String(value)
  return BARE_VALUE.test(value) ? value : JSON.stringify(value)
}

function printCondition(condition: Cond): string {
  const sign = condition.not ? '-' : ''
  return `${sign}${condition.field}${OPERATOR_SYMBOL[condition.op]}${printValue(condition.value)}`
}

export function pretty(filter: Filter): string {
  const parts = filter.where.map(clause =>
    'or' in clause ? `(${clause.or.map(printCondition).join(' OR ')})` : printCondition(clause),
  )
  for (const sort of filter.sort) {
    parts.push(`@sort:${sort.dir === 'desc' ? '-' : ''}${sort.field}`)
  }
  if (filter.limit !== null) parts.push(`@limit:${filter.limit}`)
  return parts.join(' ')
}

function readValue(raw: string): string | number {
  if (raw.startsWith('"')) return JSON.parse(raw) as string
  return NUMBER_VALUE.test(raw) ? Number(raw) : raw
}

export function parseFilter(source: string): Filter {
  const filter: Filter = { where: [], sort: [], limit: null }
  const end = source.trimEnd().length
  let group: Cond[] | null = null
  TOKEN.lastIndex = 0

  while (TOKEN.lastIndex < end) {
    const position = TOKEN.lastIndex
    const token = TOKEN.exec(source)?.groups
    if (!token) {
      throw new SyntaxError(`bad filter at ${position}: ${source.slice(position, position + 20)}`)
    }

    if (token.open) {
      group = []
    } else if (token.close) {
      filter.where.push({ or: group ?? [] })
      group = null
    } else if (token.sortField) {
      filter.sort.push({ field: token.sortField, dir: token.descending ? 'desc' : 'asc' })
    } else if (token.limit) {
      filter.limit = Number(token.limit)
    } else if (token.field) {
      const condition: Cond = {
        field: token.field,
        op: OPERATOR_BY_SYMBOL[token.symbol],
        value: readValue(token.value),
      }
      if (token.negated) condition.not = true
      if (group) group.push(condition)
      else filter.where.push(condition)
    }
  }
  return filter
}
