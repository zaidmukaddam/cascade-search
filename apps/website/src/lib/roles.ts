import type { Role } from 'cascade-search'
import type { TagColor } from '@/components/Tag'

interface RoleStyle {
  name: string
  color: TagColor
}

const ROLE_STYLE: Record<Role, RoleStyle> = {
  O: { name: 'noise', color: 'gray' },
  FIELD: { name: 'field', color: 'blue' },
  OP: { name: 'operator', color: 'gray' },
  NEG: { name: 'negation', color: 'red' },
  VAL_ENUM: { name: 'category', color: 'green' },
  VAL_PERSON: { name: 'person', color: 'yellow' },
  VAL_DATE: { name: 'date', color: 'purple' },
  VAL_NUM: { name: 'number', color: 'blue' },
  VAL_TEXT: { name: 'topic', color: 'magenta' },
  SORT: { name: 'sort', color: 'gray' },
  DIR: { name: 'direction', color: 'gray' },
  LIMIT: { name: 'limit', color: 'gray' },
  OR: { name: 'or', color: 'gray' },
  GROUP: { name: 'group by', color: 'orange' },
  CHART: { name: 'chart', color: 'orange' },
  AGG: { name: 'aggregate', color: 'orange' },
}

export function roleStyle(role: Role): RoleStyle {
  return ROLE_STYLE[role]
}
