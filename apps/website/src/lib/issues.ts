import { PEOPLE, TOPICS } from './schema.ts'

export const DAY_MS = 86_400_000

const ISSUE_COUNT = 2000
const FIRST_ID = 1000
const SEED = 42
const OLDEST_DAYS = 400
const LONGEST_UPDATE_GAP_DAYS = 30
const MOST_COMMENTS = 40

const VERBS = [
  ...['fix', 'investigate', 'add', 'remove', 'speed up'],
  ...['rewrite', 'document', 'handle', 'retry', 'validate'],
]
const CONTEXTS = [
  ...['on mobile', 'for new users', 'in production', 'after upgrade'],
  ...['when offline', 'under load', 'on safari', 'in the api', '', ''],
]
const STATUSES = ['open', 'open', 'open', 'closed', 'closed', 'blocked']
const TYPES = ['bug', 'bug', 'feature', 'chore']
const PRIORITIES = ['urgent', 'high', 'high', 'low', 'low', 'low']
const POINTS = [1, 1, 2, 3, 5, 8, 13]

export interface Issue {
  id: number
  title: string
  status: string
  type: string
  priority: string
  author: string
  assignee: string
  created: number
  updated: number
  comments: number
  points: number
}

function linearCongruential(seed: number): () => number {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    return (state >>> 0) / 4294967296
  }
}

export function makeIssues(now: number): Issue[] {
  const random = linearCongruential(SEED)
  const pick = <T>(options: readonly T[]) => options[Math.floor(random() * options.length)]

  return Array.from({ length: ISSUE_COUNT }, (_, index) => {
    const ageDays = Math.floor(random() ** 2 * OLDEST_DAYS)
    const created = now - ageDays * DAY_MS - Math.floor(random() * DAY_MS)
    const title = `${pick(VERBS)} ${pick(TOPICS)} ${pick(TOPICS)} ${pick(CONTEXTS)}`.trim()
    const status = pick(STATUSES)
    const type = pick(TYPES)
    const priority = pick(PRIORITIES)
    const author = pick(PEOPLE)
    const assignee = pick(PEOPLE)
    const updateGapDays = Math.floor(random() * LONGEST_UPDATE_GAP_DAYS)
    const comments = Math.floor(random() ** 3 * MOST_COMMENTS)
    const points = pick(POINTS)

    return {
      id: FIRST_ID + index,
      title,
      status,
      type,
      priority,
      author,
      assignee,
      created,
      updated: Math.min(now, created + updateGapDays * DAY_MS),
      comments,
      points,
    }
  })
}
