const CALLS_PER_HOUR = 40
const HOUR_MS = 3_600_000

const callsByAddress = new Map<string, number[]>()

function recentCalls(address: string): number[] {
  const now = Date.now()
  const recent = (callsByAddress.get(address) ?? []).filter(time => now - time < HOUR_MS)
  callsByAddress.set(address, recent)
  return recent
}

export function remainingCalls(address: string): number {
  return CALLS_PER_HOUR - recentCalls(address).length
}

export function spendCall(address: string) {
  recentCalls(address).push(Date.now())
}
