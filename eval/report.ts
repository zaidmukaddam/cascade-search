import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const RESULTS = new URL('./results/', import.meta.url)

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function writeResult(name: string, data: unknown) {
  mkdirSync(RESULTS, { recursive: true })
  writeFileSync(new URL(name, RESULTS), JSON.stringify(data, null, 1))
}

export function readResult<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(name, RESULTS), 'utf8'))
}

export function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.floor(sorted.length * fraction)]
}
