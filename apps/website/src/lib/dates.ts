import { DAY_MS } from './issues.ts'

export type DateRange = [start: number, end: number]

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAYS_PER_UNIT: Record<string, number> = { day: 1, week: 7, month: 30, quarter: 91, year: 365 }

function daysIn(unit: string): number | undefined {
  return DAYS_PER_UNIT[unit.replace(/s$/, '')]
}

function startOfDay(timestamp: number): Date {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date
}

function agoRange(phrase: string, today: number): DateRange | null {
  const match = /^(\d+) (\w+) ago$/.exec(phrase)
  const days = match && daysIn(match[2])
  if (!match || !days) return null
  const start = today - Number(match[1]) * days * DAY_MS
  return [start, start + DAY_MS]
}

function rollingRange(phrase: string, today: number): DateRange | null {
  const match = /^last (\d+) (\w+)$/.exec(phrase)
  const days = match && daysIn(match[2])
  if (!match || !days) return null
  return [today - Number(match[1]) * days * DAY_MS, today + DAY_MS]
}

function namedPeriodRange(words: string[], today: number): DateRange | null {
  const days = words[1] && daysIn(words[1])
  if (!days || (words[0] !== 'last' && words[0] !== 'this')) return null
  const length = days * DAY_MS
  const start = words[0] === 'this' ? today - length + DAY_MS : today - 2 * length + DAY_MS
  return [start, start + length]
}

function weekdayRange(word: string, todayDate: Date): DateRange | null {
  const weekday = WEEKDAYS.indexOf(word)
  if (weekday < 0) return null
  const daysBack = (todayDate.getDay() - weekday + 7) % 7 || 7
  const start = todayDate.getTime() - daysBack * DAY_MS
  return [start, start + DAY_MS]
}

function monthRange(words: string[], todayDate: Date): DateRange | null {
  const month = MONTHS.indexOf(words[0].slice(0, 3))
  if (month < 0 || !/^[a-z]+$/.test(words[0])) return null
  const year = todayDate.getFullYear() - (month > todayDate.getMonth() ? 1 : 0)
  if (words[1]) {
    const day = Number(words[1])
    return [new Date(year, month, day).getTime(), new Date(year, month, day + 1).getTime()]
  }
  return [new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime()]
}

function absoluteRange(phrase: string): DateRange | null {
  const timestamp = Date.parse(phrase)
  return Number.isNaN(timestamp) ? null : [timestamp, timestamp + DAY_MS]
}

export function dateRange(phrase: string, now: number): DateRange | null {
  const todayDate = startOfDay(now)
  const today = todayDate.getTime()
  const words = phrase.split(' ')

  if (phrase === 'today') return [today, today + DAY_MS]
  if (phrase === 'yesterday') return [today - DAY_MS, today]
  return (
    agoRange(phrase, today) ??
    rollingRange(phrase, today) ??
    namedPeriodRange(words, today) ??
    weekdayRange(words[0], todayDate) ??
    monthRange(words, todayDate) ??
    absoluteRange(phrase)
  )
}
