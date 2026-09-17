export interface Token {
  text: string
  start: number
  end: number
}

export const MAX_TOKENS = 24

const WORD_OR_OPERATOR = /[A-Za-z0-9_@][A-Za-z0-9_@.'-]*|>=|<=|!=|[<>=:!]/g
const TRAILING_PUNCTUATION = /[.'-]+$/

export function tokenize(phrase: string): Token[] {
  const tokens: Token[] = []
  for (const match of phrase.matchAll(WORD_OR_OPERATOR)) {
    const text = match[0].replace(TRAILING_PUNCTUATION, '') || match[0]
    tokens.push({ text, start: match.index, end: match.index + text.length })
    if (tokens.length === MAX_TOKENS) break
  }
  return tokens
}
