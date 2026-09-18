import type { EscalationRequest, Role } from 'cascade-search'

export const ROLE_GUIDE: Record<Role, string> = {
  O: 'Noise: filler, politeness, articles, or the noun for the rows themselves. Carries no filter meaning.',
  FIELD:
    'Names a field/column to filter or sort on, including prepositions that stand for one ("from", "by" meaning the author) and sort adjectives ("newest", "biggest").',
  OP: 'A comparison or relation: is, over, under, before, after, since, until, about, containing.',
  NEG: 'Negation: not, except, without, excluding, but.',
  VAL_ENUM: 'A value from a fixed set of categories, such as a status, type, label or format.',
  VAL_PERSON: "A person: a name, a username, or a pronoun like 'me'.",
  VAL_DATE:
    'Part of a date or time expression: yesterday, last week, tuesday, 3 days ago, 2024-01-05.',
  VAL_NUM: 'A number used as a quantity or a limit.',
  VAL_TEXT: 'A free-text topic or keyword to search for inside text.',
  SORT: 'A word that introduces sorting: sort, sorted by, order by.',
  DIR: 'A sort direction: ascending, descending, first, last, highest, lowest.',
  LIMIT: 'A word that introduces a result limit: top, first N, limit, only.',
  OR: "The word 'or' joining two alternatives.",
  GROUP:
    'A word that introduces grouping for a chart or a count: "by status", "per assignee", "for each", "grouped by". Not "by" standing for a person ("closed by sam"), which is FIELD, and not "sorted by", which is SORT.',
  CHART: 'Asks for a visual or names its kind: chart, graph, plot, bar, pie, line, breakdown.',
  AGG: 'Asks for a number instead of rows: count, how many, total, sum, average.',
}

const GUIDANCE = [
  'Judge by what the word means and by its neighbours.',
  'A given name, nickname or username is VAL_PERSON even with no preposition before it.',
  'A topic or keyword someone would look for inside text is VAL_TEXT.',
  'Slang, hedges and filler are O.',
].join(' ')

export function questionId(wordIndex: number): string {
  return `t${wordIndex}`
}

function instructionsFor(word: string, wordIndex: number): string {
  return `What role does word #${wordIndex} ("${word}") play in this fragment of a search query over table rows? ${GUIDANCE}`
}

export function buildQuestions(request: EscalationRequest) {
  const entries = request.ask.map(wordIndex => [
    questionId(wordIndex),
    {
      type: 'choice' as const,
      instructions: instructionsFor(request.words[wordIndex], wordIndex),
      criteria: ROLE_GUIDE,
    },
  ])
  return Object.fromEntries(entries)
}

export function buildState(request: EscalationRequest) {
  const asked = new Set(request.ask)
  const fragment = request.words.map((word, index) => {
    const described = { '#': index, word, matches_in_schema: request.matches[index] }
    return asked.has(index) ? described : { ...described, role: request.localRoles[index] }
  })
  return {
    fragment_text: request.words.join(' '),
    fragment,
    field_kinds_in_schema: request.kinds,
  }
}
