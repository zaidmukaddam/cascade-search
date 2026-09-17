import { type Field, type FieldKind, KINDS, type Schema } from 'cascade-search'
import { DetailBody, DetailText, DetailTitle } from '@/components/Detail'
import { GlassSelect } from '@/components/GlassSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SCHEMA } from '@/lib/schema'
import { type State, update } from '@/lib/store'

const KIND_OPTIONS = KINDS.map(kind => ({ value: kind, label: kind }))
const CONSONANTS = 'bcdfghjklmnpqrstvwxz'
const SCRAMBLED_LENGTH = 6

function nonsenseName(): string {
  const letters = Array.from(
    { length: SCRAMBLED_LENGTH },
    () => CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)],
  )
  return letters.join('')
}

function scrambled(schema: Schema): Schema {
  const fields = schema.fields.map((field, index) => {
    const aliases = [...new Set([SCHEMA.fields[index].name, ...(field.aliases ?? [])])]
    return { ...field, name: nonsenseName(), aliases }
  })
  return { ...schema, fields }
}

function withField(schema: Schema, index: number, patch: Partial<Field>): Schema {
  const fields = schema.fields.map((field, i) => (i === index ? { ...field, ...patch } : field))
  return { ...schema, fields }
}

function FieldRow({ field, index, schema }: { field: Field; index: number; schema: Schema }) {
  const rename = (name: string) => {
    const safeName = name.replace(/[^\w-]/g, '') || 'field'
    update({ schema: withField(schema, index, { name: safeName }) })
  }
  const changeKind = (kind: FieldKind) => {
    update({ schema: withField(schema, index, { kind }) })
  }
  return (
    <li className="flex h-9 items-center justify-between gap-3 border-b border-ray-line last:border-0">
      <Input
        className="-ml-1.5 h-7 min-w-0 flex-1 rounded-md border-transparent bg-transparent px-1.5 font-mono text-[13px] shadow-none hover:bg-ray-selected focus-visible:border-ray-line focus-visible:bg-ray-selected focus-visible:ring-0 md:text-[13px] dark:bg-transparent"
        value={field.name}
        aria-label={`Field ${index + 1} name`}
        autoComplete="off"
        spellCheck={false}
        onChange={event => rename(event.currentTarget.value)}
      />
      <GlassSelect
        label={`Field ${index + 1} kind`}
        value={field.kind}
        options={KIND_OPTIONS}
        onChange={changeKind}
        variant="quiet"
        className="h-7"
      />
    </li>
  )
}

export function SchemaView({ state }: { state: State }) {
  const { schema } = state
  return (
    <DetailBody>
      <DetailTitle>Schema</DetailTitle>
      <DetailText>
        Field names never reach either model, only their kinds. Scramble them and your query still
        parses; the filter just comes out in the new names.
      </DetailText>
      <ul>
        {schema.fields.map((field, index) => (
          <FieldRow key={SCHEMA.fields[index].name} field={field} index={index} schema={schema} />
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => update({ schema: scrambled(schema) })}>
          Scramble Names
        </Button>
        <Button size="sm" variant="ghost" onClick={() => update({ schema: SCHEMA })}>
          Reset
        </Button>
      </div>
    </DetailBody>
  )
}
