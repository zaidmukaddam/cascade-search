import fc from 'fast-check'
import { expect, test } from 'vitest'
import { parseFilter, pretty } from '../src/ir.ts'
import type { Cond, Filter, Op } from '../src/types.ts'

const field = fc.stringMatching(/^[a-z_][a-z0-9_-]{0,8}$/)
const cond: fc.Arbitrary<Cond> = fc
  .record({
    field,
    op: fc.constantFrom<Op>('eq', 'gt', 'lt', 'gte', 'lte', 'contains'),
    value: fc.oneof(
      fc.string(),
      fc.double({ noNaN: true, noDefaultInfinity: true }).filter(n => !Object.is(n, -0)),
      fc.constantFrom('@me', 'last 3 days', 'OR', '(', '5'),
    ),
    not: fc.constantFrom(true as const, undefined),
  })
  .map(c => {
    if (!c.not) delete c.not
    return c
  })

const filter: fc.Arbitrary<Filter> = fc.record({
  where: fc.array(
    fc.oneof(cond, fc.record({ or: fc.array(cond, { minLength: 1, maxLength: 3 }) })),
    { maxLength: 5 },
  ),
  sort: fc.array(fc.record({ field, dir: fc.constantFrom<'asc' | 'desc'>('asc', 'desc') }), {
    maxLength: 2,
  }),
  limit: fc.oneof(fc.constant(null), fc.nat(1000)),
})

test('round trip: IR -> pretty string -> parse -> IR', () => {
  fc.assert(
    fc.property(filter, f => {
      expect(parseFilter(pretty(f))).toEqual(f)
    }),
    { numRuns: 2000 },
  )
})

test('pretty form is readable', () => {
  expect(
    pretty({
      where: [
        { field: 'status', op: 'eq', value: 'open' },
        { field: 'author', op: 'eq', value: '@me', not: true },
        {
          or: [
            { field: 'type', op: 'eq', value: 'bug' },
            { field: 'type', op: 'eq', value: 'chore' },
          ],
        },
        { field: 'created', op: 'gte', value: 'last week' },
      ],
      sort: [{ field: 'points', dir: 'desc' }],
      limit: 10,
    }),
  ).toBe(
    'status:open -author:@me (type:bug OR type:chore) created>="last week" @sort:-points @limit:10',
  )
})
