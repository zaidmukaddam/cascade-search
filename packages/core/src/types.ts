export const ROLES = [
  'O',
  'FIELD',
  'OP',
  'NEG',
  'VAL_ENUM',
  'VAL_PERSON',
  'VAL_DATE',
  'VAL_NUM',
  'VAL_TEXT',
  'SORT',
  'DIR',
  'LIMIT',
  'OR',
  'GROUP',
  'CHART',
  'AGG',
] as const
export type Role = (typeof ROLES)[number]

export type FieldKind = 'enum' | 'person' | 'date' | 'number' | 'text'
export const KINDS: FieldKind[] = ['enum', 'person', 'date', 'number', 'text']

export interface Field {
  name: string
  kind: FieldKind

  aliases?: string[]

  values?: Record<string, string[]>

  adjectives?: Record<string, 'asc' | 'desc'>
}

export interface Schema {
  entity?: string[]
  fields: Field[]
}

export type Op = 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
export interface Cond {
  field: string
  op: Op
  value: string | number
  not?: true
}

export type Clause = Cond | { or: Cond[] }

export type ChartKind = 'bar' | 'pie' | 'line' | 'number'
export type Aggregate = 'count' | 'sum' | 'avg'
export interface View {
  chart: ChartKind
  by: string | null
  agg: Aggregate
  of: string | null
}

export interface Filter {
  where: Clause[]
  sort: { field: string; dir: 'asc' | 'desc' }[]
  limit: number | null
  view: View | null
}

export interface TokenResult {
  text: string
  start: number
  end: number
  role: Role

  confidence: number

  tier: 'local' | 'jev'
}
