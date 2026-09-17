import { expect, test } from 'vitest'
import { DOMAINS } from '../../../training/domains.ts'
import { dataset, goldTokens } from '../../../training/gen.ts'
import {
  compile,
  type EscalationRequest,
  escalate,
  parse,
  pretty,
  type Role,
} from '../../core/src/index.ts'
import { createJev, JevError, type JevOptions, ROLE_GUIDE } from '../src/index.ts'

type Evaluate = NonNullable<JevOptions['evaluate']>
type EvaluateArgs = Parameters<Evaluate>[0]

const schema = DOMAINS[0].schema
const ESCALATE_EVERYTHING = 1.01
const UNLIMITED = 1e9

const oneWordRequest: EscalationRequest = {
  words: ['x'],
  ask: [0],
  localRoles: ['O'],
  matches: [[]],
  kinds: [],
}

function fakeEvaluate(answer: (questionId: string, args: EvaluateArgs) => object): Evaluate {
  const fake = async (args: EvaluateArgs) => ({
    answers: Object.fromEntries(Object.keys(args.questions).map(id => [id, answer(id, args)])),
    usage: { inputTokens: 120, outputTokens: 0, totalTokens: 120 },
  })
  return fake as unknown as Evaluate
}

function certainChoice(role: Role) {
  return { type: 'choice', choice: role, probabilities: { [role]: 1 } }
}

function failingEvaluate(error: unknown): Evaluate {
  const fake = async () => {
    throw error
  }
  return fake as unknown as Evaluate
}

test('both tiers produce the same IR type, and agree when Jev is right', async () => {
  let escalatedTokens = 0

  for (const ex of dataset('transfer', 300, 7)) {
    const answerWithGold = fakeEvaluate(id => certainChoice(ex.roles[Number(id.slice(1))]))
    const jev = createJev({ callsPerMinute: UNLIMITED, evaluate: answerWithGold })
    const local = parse(ex.q, ex.schema, { threshold: ESCALATE_EVERYTHING })
    const final = await escalate(local, ex.schema, jev)

    escalatedTokens += final.tokens.filter(token => token.tier === 'jev').length
    expect(pretty(final.ir), ex.q).toBe(pretty(compile(goldTokens(ex), ex.schema)))
    expect(Object.keys(final.ir).sort()).toEqual(Object.keys(local.ir).sort())
  }

  expect(escalatedTokens).toBeGreaterThan(1000)
})

test('only the uncertain span is sent, with kinds but never field names', async () => {
  const sent: EvaluateArgs[] = []
  const recording = fakeEvaluate((_, args) => {
    sent.push(args)
    return { type: 'choice', choice: 'O', probabilities: { O: 0.9 } }
  })
  const local = parse('open bugs from sam kinda about auth newest first', schema, {
    threshold: 0.95,
  })
  expect(local.spans.length).toBeGreaterThan(0)

  await escalate(local, schema, createJev({ evaluate: recording }))

  const states = JSON.stringify(sent.map(call => call.state))
  for (const field of schema.fields) {
    expect(states.includes(`"${field.name}"`), field.name).toBe(false)
  }
  for (const call of sent) {
    const state = call.state as { fragment: unknown[] }
    expect(state.fragment.length).toBeLessThan(local.tokens.length)
  }
  const firstQuestion = Object.values(sent[0].questions)[0] as { criteria: object }
  expect(Object.keys(firstQuestion.criteria)).toEqual(Object.keys(ROLE_GUIDE))
})

test('budget is enforced before the network', async () => {
  let networkCalls = 0
  const counting = fakeEvaluate(() => {
    networkCalls++
    return certainChoice('O')
  })
  const jev = createJev({ callsPerMinute: 2, evaluate: counting })

  await jev(oneWordRequest)
  await jev(oneWordRequest)

  await expect(jev(oneWordRequest)).rejects.toMatchObject({ kind: 'budget' })
  expect(networkCalls).toBe(2)
  expect(jev.remaining()).toBe(0)
})

test('failures are structured', async () => {
  const failWith = (error: unknown) =>
    createJev({ evaluate: failingEvaluate(error) })(oneWordRequest)

  const unauthorized = Object.assign(new Error('nope'), { statusCode: 401 })
  const rateLimited = Object.assign(new Error('slow down'), { lastError: { statusCode: 429 } })

  await expect(failWith(unauthorized)).rejects.toMatchObject({ kind: 'auth' })
  await expect(failWith(rateLimited)).rejects.toMatchObject({ kind: 'rate_limit' })
  await expect(failWith(new TypeError('fetch failed'))).rejects.toMatchObject({ kind: 'network' })
})

test('a hung request times out', async () => {
  const neverAnswers = ((args: EvaluateArgs) =>
    new Promise((_, reject) => {
      args.abortSignal?.addEventListener('abort', () => reject(args.abortSignal?.reason))
    })) as unknown as Evaluate
  const jev = createJev({ timeoutMs: 20, evaluate: neverAnswers })

  await expect(jev(oneWordRequest)).rejects.toMatchObject({ kind: 'timeout' })
})

test('an answer without probabilities is rejected', async () => {
  const bare = fakeEvaluate(() => ({ type: 'choice', choice: 'O' }))
  const jev = createJev({ evaluate: bare })

  await expect(jev(oneWordRequest)).rejects.toBeInstanceOf(JevError)
})
