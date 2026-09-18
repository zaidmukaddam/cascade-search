import type { Clause, Cond, Field, Filter, Op, Schema, View } from 'cascade-search'
import { type DateRange, dateRange } from './dates.ts'
import type { Issue } from './issues.ts'
import { CURRENT_USER, SCHEMA } from './schema.ts'

const PRIORITY_ORDER = ['low', 'high', 'urgent']
const ME = '@me'

type Column = keyof Issue

function columnFor(fieldName: string, schema: Schema): { field: Field; column: Column } | null {
  const index = schema.fields.findIndex(field => field.name === fieldName)
  const original = SCHEMA.fields[index]
  if (index < 0 || !original) return null
  return { field: schema.fields[index], column: original.name as Column }
}

function inDateRange(timestamp: number, op: Op, [start, end]: DateRange): boolean {
  if (op === 'gte') return timestamp >= start
  if (op === 'gt') return timestamp >= end
  if (op === 'lt') return timestamp < start
  if (op === 'lte') return timestamp < end
  return timestamp >= start && timestamp < end
}

function compareNumbers(actual: number, op: Op, expected: number): boolean {
  if (op === 'gt') return actual > expected
  if (op === 'gte') return actual >= expected
  if (op === 'lt') return actual < expected
  return actual <= expected
}

function holds(issue: Issue, condition: Cond, schema: Schema, now: number): boolean {
  const target = columnFor(condition.field, schema)
  if (!target) return true
  const cell = issue[target.column]

  if (target.field.kind === 'date') {
    const range = dateRange(String(condition.value), now)
    return range ? inDateRange(Number(cell), condition.op, range) : true
  }
  if (condition.op === 'contains') return String(cell).includes(String(condition.value))
  if (condition.op === 'eq') {
    const expected = condition.value === ME ? CURRENT_USER : String(condition.value)
    return String(cell) === expected
  }
  return compareNumbers(Number(cell), condition.op, Number(condition.value))
}

function matches(issue: Issue, condition: Cond, schema: Schema, now: number): boolean {
  const result = holds(issue, condition, schema, now)
  return condition.not ? !result : result
}

function satisfies(issue: Issue, clause: Clause, schema: Schema, now: number): boolean {
  if ('or' in clause) return clause.or.some(condition => matches(issue, condition, schema, now))
  return matches(issue, clause, schema, now)
}

function sortKey(issue: Issue, column: Column): string | number {
  return column === 'priority' ? PRIORITY_ORDER.indexOf(issue.priority) : issue[column]
}

export interface Slice {
  label: string
  value: number
}

const MONTH_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })
const MOST_GROUPS = 8
const MOST_MONTHS = 12

function select(issues: Issue[], filter: Filter, schema: Schema, now: number): Issue[] {
  return issues.filter(issue => filter.where.every(clause => satisfies(issue, clause, schema, now)))
}

function measure(rows: Issue[], view: View, schema: Schema): number {
  const column = view.of ? columnFor(view.of, schema)?.column : undefined
  if (view.agg === 'count' || !column) return rows.length
  const total = rows.reduce((sum, row) => sum + Number(row[column]), 0)
  if (view.agg === 'sum') return total
  return rows.length ? total / rows.length : 0
}

export function aggregate(issues: Issue[], filter: Filter, schema: Schema, now: number): Slice[] {
  const view = filter.view
  if (!view) return []
  const rows = select(issues, filter, schema, now)
  const target = view.by ? columnFor(view.by, schema) : null
  if (!target) return [{ label: 'All', value: measure(rows, view, schema) }]

  const byDate = target.field.kind === 'date'
  const groups = new Map<string | number, Issue[]>()
  for (const row of rows) {
    const cell = row[target.column]
    const date = new Date(Number(cell))
    const key = byDate ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth()) : String(cell)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const slices = [...groups].map(([key, group]) => ({
    key,
    label: byDate ? MONTH_FORMAT.format(Number(key)) : String(key),
    value: measure(group, view, schema),
  }))
  if (byDate) {
    return slices.sort((a, b) => Number(a.key) - Number(b.key)).slice(-MOST_MONTHS)
  }
  return slices.sort((a, b) => b.value - a.value).slice(0, filter.limit ?? MOST_GROUPS)
}

export function run(issues: Issue[], filter: Filter, schema: Schema, now: number): Issue[] {
  const kept = select(issues, filter, schema, now)

  for (const sort of [...filter.sort].reverse()) {
    const target = columnFor(sort.field, schema)
    if (!target) continue
    const sign = sort.dir === 'asc' ? 1 : -1
    kept.sort((a, b) => {
      const left = sortKey(a, target.column)
      const right = sortKey(b, target.column)
      if (left === right) return 0
      return left < right ? -sign : sign
    })
  }
  return filter.limit === null ? kept : kept.slice(0, filter.limit)
}
