export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export class Random {
  readonly next: Rng

  constructor(rng: Rng) {
    this.next = rng
  }

  pick<T>(options: readonly T[]): T {
    return options[Math.floor(this.next() * options.length)]
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  int(low: number, high: number): number {
    return low + Math.floor(this.next() * (high - low + 1))
  }
}
