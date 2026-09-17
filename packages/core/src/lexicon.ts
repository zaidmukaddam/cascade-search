const words = (list: string) => new Set(list.split(' '))

export const LEXICON = {
  GT: words('over above more greater after since exceeding > >= least min minimum'),
  LT: words('under below less fewer before until till < <= most max maximum'),
  EQ: words('is are was equals equal = : in with has having on'),
  NEG: words("not except without no non excluding but != ! isn't aren't exclude minus never"),
  SORT: words('sort sorted order ordered rank ranked arrange arranged'),
  DESC: words('desc descending first top highest reverse reversed down'),
  ASC: words('asc ascending last lowest bottom up'),
  LIMIT: words('top first limit only max just last'),
  OR: words('or either'),
  AND: words('and & plus also'),
  PREP: words('from by to for of at than as'),
  DATE: words(
    [
      'today yesterday tomorrow week month year quarter weekend last this next past ago recently',
      'monday tuesday wednesday thursday friday saturday sunday',
      'january february march april may june july august september october november december',
      'jan feb mar apr jun jul aug sep sept oct nov dec',
    ].join(' '),
  ),
  TIMEUNIT: words('day days weeks months years hour hours minute minutes'),
  ME: words('me my mine i myself'),
  ANYONE: words('anyone anybody everyone everybody someone somebody nobody'),
  FILLER: words(
    [
      'the a an all any show find get list that which thing things one ones stuff items please',
      'give search where were it them those these every display see want need',
    ].join(' '),
  ),
  NUMWORD: words('two three four five six seven eight nine ten twenty fifty hundred dozen'),
  TEXTPREP: words(
    'about containing contains contain mentioning mentions titled named called matching like regarding saying',
  ),
}

export type LexiconName = keyof typeof LEXICON

export const LEXICON_NAMES = Object.keys(LEXICON) as LexiconName[]

export function inLexicon(name: LexiconName, word: string): boolean {
  return LEXICON[name].has(word)
}

export function closedClassWords(): Set<string> {
  return new Set(LEXICON_NAMES.flatMap(name => [...LEXICON[name]]))
}
