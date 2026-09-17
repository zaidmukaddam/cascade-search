import type { ParseResult, Role } from 'cascade-search'

const DATABASE = 'cascade'
const STORE = 'escalations'

export interface LoggedDecision {
  token: number
  word: string
  role: Role
  confidence: number
}

export interface LogEntry {
  loggedAt: number
  kinds: string[]
  features: number[][]
  decisions: LoggedDecision[]
}

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { autoIncrement: true })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

function acceptedDecisions(merged: ParseResult): LoggedDecision[] {
  return merged.tokens.flatMap((token, index) =>
    token.tier === 'jev'
      ? [{ token: index, word: token.text, role: token.role, confidence: token.confidence }]
      : [],
  )
}

export async function logEscalation(local: ParseResult, merged: ParseResult, kinds: string[]) {
  const decisions = acceptedDecisions(merged)
  if (!decisions.length || !local.features) return

  const entry: LogEntry = { loggedAt: Date.now(), kinds, features: local.features, decisions }
  const database = await openDatabase()
  database?.transaction(STORE, 'readwrite').objectStore(STORE).add(entry)
}

export async function readLog(): Promise<LogEntry[]> {
  const database = await openDatabase()
  if (!database) return []
  return new Promise(resolve => {
    const request = database.transaction(STORE).objectStore(STORE).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve([])
  })
}

export async function downloadLog() {
  const blob = new Blob([JSON.stringify(await readLog())], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'escalations.json'
  link.click()
  URL.revokeObjectURL(link.href)
}
