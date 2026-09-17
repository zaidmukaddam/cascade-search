import type { Schema } from 'cascade-search'
import { DOMAINS } from '../../../../training/domains.ts'

const issuesDomain = DOMAINS[0]

export const CURRENT_USER = 'alice'
export const PEOPLE = issuesDomain.people
export const TOPICS = issuesDomain.words

export const LABELED_EXAMPLES = [
  { label: 'A simple ask', query: 'open bugs from sam' },
  { label: 'Just a sort', query: 'big ones first' },
  { label: 'Mine', query: 'urgent stuff assigned to me' },
  { label: 'Either, with a number', query: 'bugs or features over 5 comments' },
  { label: 'Half remembered', query: 'the thing from last week about auth' },
  { label: 'Everyone but me', query: 'closed by anyone except me since tuesday' },
  { label: 'No grammar at all', query: 'timeout auth sam kinda recent' },
  { label: 'Slang', query: 'whatever raj filed re billing' },
]

export const EXAMPLES = LABELED_EXAMPLES.map(example => example.query)

function withKnownPeople(schema: Schema): Schema {
  const known = Object.fromEntries(PEOPLE.map(person => [person, []]))
  const fields = schema.fields.map(field =>
    field.name === 'author' ? { ...field, values: known } : field,
  )
  return { ...schema, fields }
}

export const SCHEMA: Schema = withKnownPeople(issuesDomain.schema)
