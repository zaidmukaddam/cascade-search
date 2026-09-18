# cascade-search

A search bar that knows when it doesn't know.

A 27,193-parameter model that parses search queries in the browser in about a quarter of a millisecond. Every word gets a role and a calibrated confidence, and the roles compile to a typed filter. Zero runtime dependencies, 35.6 KB Brotli with its weights.

```bash
npm install cascade-search
```

```ts
import { parse } from 'cascade-search'

const schema = {
  fields: [
    { name: 'status', kind: 'enum', values: { open: [], closed: ['done'] } },
    { name: 'author', kind: 'person', aliases: ['from', 'by'] },
    { name: 'created', kind: 'date' },
  ],
}

const result = parse('open from sam since tuesday', schema)

result.ir
result.tokens
result.minConfidence
result.spans
```

`result.ir` is the filter: `{ where, sort, limit, view }`. `view` is `null` for a plain search; "open bugs by status", "pie chart of…", "how many…" or "total points per assignee" fill it with `{ chart: 'bar' | 'pie' | 'line' | 'number', by, agg: 'count' | 'sum' | 'avg', of }`. Drawing it is up to you. `result.spans` lists the words the model is unsure about. When it is empty, the local answer stands.

## Schemas

A field has a `name`, a `kind` (`enum`, `person`, `date`, `number`, `text`), and optionally `aliases`, `values` (canonical value to its aliases), and `adjectives` (`{ newest: 'desc' }`) for sorting. Field names never reach the model, only kinds, so it works on schemas it has never seen.

## Escalating the unsure words

```ts
import { escalate } from 'cascade-search'
import { createJev } from 'cascade-search-jev'

const final = result.spans.length ? await escalate(result, schema, createJev()) : result
```

`escalate` sends each uncertain span, with two neighbours of context, to any function of type `Escalator`. A remote role replaces the local one only where the remote tier is more confident. [`cascade-search-jev`](https://www.npmjs.com/package/cascade-search-jev) is an `Escalator` backed by Jev through Vercel AI Gateway.

## Batches on the GPU

```ts
import { createGpu, defaultWeights, featurize, tokenize } from 'cascade-search'

const gpu = await createGpu(defaultWeights())
const outputs = await gpu?.run(queries.map(query => featurize(tokenize(query), schema)))
```

`createGpu` resolves to `null` where WebGPU is unavailable. The WGSL kernel matches the TypeScript path within 1e-3 on every logit.

## Caveats

Trained on a synthetic corpus, English only, one-word terms only. Date phrases stay as phrases in the filter for your app to resolve. Full results and methodology are in the [repository](https://github.com/zaidmukaddam/cascade-search).

MIT
