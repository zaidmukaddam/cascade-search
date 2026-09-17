# cascade-search-jev

The second tier for [`cascade-search`](https://www.npmjs.com/package/cascade-search). It asks [Jev](https://docs.typesafe.ai/introduction), TypeSafe's System One model, what role an uncertain word plays, through Vercel AI Gateway, and returns a typed decision with its probability.

```bash
npm install cascade-search cascade-search-jev
```

```ts
import { escalate, parse } from 'cascade-search'
import { createJev } from 'cascade-search-jev'

const jev = createJev({ callsPerMinute: 60, timeoutMs: 2500 })

const local = parse(query, schema)
const final = local.spans.length ? await escalate(local, schema, jev) : local
```

Set `AI_GATEWAY_API_KEY` in the environment. This runs on a server: never ship the key to a browser.

## What it does

- Sends only the uncertain span and two neighbours of context. The schema's field names are never sent, only field kinds.
- Asks one typed `choice` question per word and reads the probability of the chosen role, so every decision stays calibrated.
- Enforces a hard calls-per-minute budget before any network call, so a bad threshold cannot burn money. `jev.remaining()` reports what is left.
- Times out with an `AbortSignal`. Retries of 429 and 529 are the AI SDK's.
- Throws a `JevError` whose `kind` is one of `budget`, `timeout`, `auth`, `rate_limit`, `overloaded`, `invalid`, `no_probabilities`, `network`. Catch it and keep the local answer.

## Options

| Option | Default | |
| --- | --- | --- |
| `model` | `typesafe-ai/jev` | AI Gateway model id |
| `timeoutMs` | `2500` | per call |
| `callsPerMinute` | `60` | hard budget |
| `onCall` | | called after each success with the request, decisions, input tokens and latency: your escalation log |
| `evaluate` | the AI SDK's | injection point for tests |

A call averaged about 1,000 input tokens in our measurements, roughly 600 per uncertain word, at $0.042 per million. Output is free.

MIT
