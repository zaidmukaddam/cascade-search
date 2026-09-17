import type { Weights } from './weights.ts'

export interface RoleDecision {
  role: number
  confidence: number
}

export function argmax(values: ArrayLike<number>, start: number, count: number): number {
  let best = 0
  for (let i = 1; i < count; i++) {
    if (values[start + i] > values[start + best]) best = i
  }
  return best
}

function softmax(logits: Float32Array, start: number, count: number, temperature: number) {
  const top = logits[start + argmax(logits, start, count)]
  const probabilities = new Float64Array(count)
  let total = 0
  for (let i = 0; i < count; i++) {
    probabilities[i] = Math.exp((logits[start + i] - top) / temperature)
    total += probabilities[i]
  }
  for (let i = 0; i < count; i++) probabilities[i] /= total
  return probabilities
}

function normalizedEntropy(probabilities: Float64Array): number {
  let entropy = 0
  for (const p of probabilities) {
    if (p > 0) entropy -= p * Math.log(p)
  }
  return entropy / Math.log(probabilities.length)
}

export function decide(
  weights: Weights,
  logits: Float32Array,
  confLogit: Float32Array,
): RoleDecision[] {
  const { roleCount, temperature } = weights
  return Array.from(confLogit, (headLogit, token) => {
    const start = token * roleCount
    const role = argmax(logits, start, roleCount)
    const probabilities = softmax(logits, start, roleCount, temperature)

    if (weights.confidence === 'head') return { role, confidence: 1 / (1 + Math.exp(-headLogit)) }
    if (weights.confidence === 'entropy') {
      return { role, confidence: 1 - normalizedEntropy(probabilities) }
    }
    return { role, confidence: probabilities[role] }
  })
}
