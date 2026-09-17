export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function dollars(value: number): string {
  return value < 100 ? `$${value.toFixed(2)}` : `$${Math.round(value).toLocaleString()}`
}

export function compactCount(value: number): string {
  return value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : Math.round(value).toLocaleString()
}
