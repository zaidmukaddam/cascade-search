# Cascade Search — Scope Plan

A search bar / command palette where a ~30K-parameter browser model parses almost every query locally in sub-millisecond time, and only ambiguous spans are escalated to Jev (TypeSafe's System One model) for a typed, calibrated decision. Escalations are logged and fed back into the local model's training set, so the cascade gets cheaper on its own.

The bet: structured decisions stay structured end-to-end. No string parsing anywhere in the chain.

---

## Goals

- Sub-millisecond local parse for the common case, zero network.
- Escalate only low-confidence spans, not whole queries.
- Every output — local or escalated — carries a calibrated probability.
- One typed filter format consumed by the app, regardless of which tier produced it.
- A self-improving loop: Jev answers become local training data.

## Non-goals (v1)

- Not a general NLU engine. Scope is filter/command parsing against a known schema.
- Not multilingual. English only until the cascade is proven.
- No LLM tier. The escalation target is Jev only; adding an LLM fallback is a later experiment.
- No server-side model hosting. Local tier runs in-browser; remote tier is Jev's API.

---

## Architecture

```
keystroke
   │
   ▼
[tokenizer + sparse features]  ← mechanical, schema-agnostic, our own design
   │
   ▼
[micro-model: roles + confidence per token]  ← TS on CPU for single query, WGSL for batch
   │
   ├── all tokens ≥ threshold ──▶ [compile filter] ──▶ app
   │
   └── any token < threshold ──▶ [span extractor]
                                       │
                                       ▼
                               [Jev decision call]  ← typed schema, probabilities out
                                       │
                                       ▼
                               [merge + compile filter] ──▶ app
                                       │
                                       ▼
                               [escalation log] ──▶ retraining corpus
```

Key design rules:

- The schema's field **names** never reach the micro-model — only field kinds and match features, so it transfers to unseen apps.
- The filter IR is the single contract. Both tiers emit it; the app only ever consumes it.
- Confidence must be calibrated, not just softmax max. This is the piece that makes the router work.

---

## Stack

**Local tier**

- TypeScript, ESM, zero runtime deps for the published package.
- WebGPU / WGSL compute kernel for batch inference; plain TS path for single queries and as the CPU fallback.
- Int6-quantized weights, decoded to f32 at load. Target bundle < 40 KB Brotli including weights.
- Vitest for unit tests; a golden-file harness that checks TS vs WGSL logits agree within 1e-3.

**Training**

- Python 3.12, PyTorch.
- Synthetic query generator + schema sampler (issue trackers, mail, files, commits for training; contacts, music, recipes, shipments held out for transfer).
- Calibration: temperature scaling on held-out, evaluated with ECE and reliability diagrams.
- Export: custom script → int6 weights + JSON manifest consumed by the TS runtime.

**Remote tier**

- Jev via TypeSafe API (early access). Decision schema defined in advance per their docs; the span, its neighbors, and the field-kind list are the `state`.
- Thin TS client with timeout, retry, and a hard budget (calls/min) so a broken threshold can't burn money.

**Demo app**

- Vite + React (or plain HTML if we want it as small as the model).
- Tailwind for the demo only; the library ships no CSS.
- Indicator per query: tier used, latency, min token confidence.

**Data / ops**

- Escalation log: local IndexedDB in the demo; optional POST to a tiny endpoint (Cloudflare Worker + D1 or SQLite) when running as a hosted demo.
- Retraining is a manual script for v1. Automation is a stretch goal.

**Repo**

- pnpm monorepo: `packages/core` (runtime), `packages/jev` (client), `packages/demo`, `training/` (Python), `eval/`.
- GitHub Actions: lint, tests, TS/WGSL parity check, bundle-size gate.

---

## Milestones

### M0 — Spike

Prove the idea end-to-end with maximum ugliness.

- Write our own tokenizer and sparse feature scheme (token shape, case, length bucket, operator lexicon, schema-kind matches). No borrowed code.
- Hardcode one schema. Hardcode a threshold. Manual Jev call for one ambiguous query.
- Deliverable: a screen recording of one query going local and one going to Jev, both producing the same filter IR shape.

Exit: we can articulate exactly what the schema for the Jev call looks like and what "span" means.

### M1 — Filter IR and compiler

The contract everything else depends on.

- Define the filter IR (fields, operators, values, sort, limit, boolean grouping).
- Write the role → IR compiler in TS with alias, plural, and single-char typo tolerance.
- Write the Jev decision → IR adapter.
- Property-based tests: round-trip IR → pretty string → parse → IR.

Exit: both tiers produce the same IR type and a test proves it.

### M2 — Micro-model with a confidence head

The core technical contribution.

- Establish a transfer baseline on our own generator: train on one set of schema domains, evaluate on domains sharing no field words, aliases, or enum values.
- Add a calibration head; compare temperature scaling vs a learned confidence output vs entropy-based.
- Evaluate: ECE, reliability diagram, and the number that actually matters — **escalation rate at target accuracy**.
- Export pipeline to int6 + manifest.

Exit: on the transfer set, escalating the bottom X% of tokens by confidence raises accuracy more than escalating a random X%. Publish the curve.

### M3 — Runtime

Ship the local tier as a package.

- TS single-query path and WGSL batch path over the same weights.
- Parity harness (1e-3), bundle-size gate, CPU fallback when WebGPU is absent.
- Public API: `parse(phrase, schema, opts) → { ir, tokens, minConfidence, tier }`.

Exit: `npm install`, one function call, works in Chrome, Safari, and Firefox (CPU fallback where needed).

### M4 — Escalation path

Wire in Jev properly.

- Span extractor: contiguous low-confidence tokens plus a context window, never the whole query when avoidable.
- Jev client with schema, timeout, budget, and structured error handling.
- Merge logic: Jev roles overwrite local roles for the span only; recompute IR.
- Threshold tuning against a cost model (Jev $/call vs error cost).

Exit: a dashboard-style eval showing accuracy vs cost as the threshold moves. Pick a default.

### M5 — Demo site

The site is a first-class deliverable, not a wrapper around the package. The bar: one page, one idea, the model running in your tab, honest numbers measured on your hardware, and a link to the source. Nothing on the page should be a claim we can't let the visitor verify by clicking.

**Principles**

- A single-sentence headline that is the whole thesis, e.g. "A search bar that knows when it doesn't know."
- The live demo is above the fold and already running before you read anything.
- One-tap example chips that write into the same box, so nobody has to think of a query.
- Every number is measured in the visitor's browser when they press a button, with hardware and browser stated.
- Comparison charts that name the competitors and the version, dated.
- A "how it works" section that explains the actual mechanism, not marketing.
- Explicit caveats in body copy: what the metric does and does not establish.
- Author name and source link.

**Page structure**

1. **Hero** — headline, one-line subhead (parameter count, bundle size, "runs in this tab"), author, source link.
2. **Live search** — box over a sample dataset (issues, ~2k rows). Under it, three things update on every keystroke:
   - the token strip: each token colored by role, with a confidence bar under it; the lowest-confidence token pulses when it crosses the escalation threshold
   - the compiled filter, shown as both a chip row and the raw IR
   - a tier badge: `local · 0.4ms` or `escalated · 118ms · Jev` with the escalated span underlined in the query
   - a **threshold slider** the visitor can drag to see queries flip between tiers live
3. **Tap one, see the cascade** — 8 example chips, deliberately half local and half escalating: "open bugs from sam", "big ones first", "the thing from last week about auth", "closed by anyone except me since tuesday".
4. **Your schema** — editable field list with kinds, a "scramble names" button, and a note that the names never reach either model.
5. **Two tiers, one type** — a short diagram: keystroke → micro-model → confidence gate → Jev → filter IR. Plus a side-by-side of the local role output and the Jev decision output for the same span, showing they land in the identical IR.
6. **Inside the model** — an actual activation visualization: tokens → sparse feature rows → conv → gated scans → role logits and the confidence head, with real values from the current query. Optional short screen-recorded walkthrough.
7. **Backends** — "run 1,024 queries on both" button: CPU TS vs WGSL, measured now. Show the parity check status (roles match, logits within 1e-3) as a live green tick.
8. **Escalation curve** — the M2 chart: accuracy vs share of tokens escalated, confidence-ranked vs random. This is the one chart that justifies the project.
9. **Cost model** — an interactive calculator: queries/day × escalation rate × Jev price → $/month, with the slider from section 2 wired in. Makes the threshold trade-off tangible.
10. **Accuracy** — held-out vs transfer table, ECE for the confidence head, and the plain-language caveat that the corpus is synthetic and does not establish accuracy on real phrasing.
11. **Use it in your code** — the install line and one `parse()` call with the returned object shown.
12. **Footer** — MIT; GitHub; npm.

**Build**

- Vite + React, Tailwind, deployed on Vercel. Static except the Jev proxy.
- Jev calls go through a tiny edge function holding the key, with a per-IP budget and a visible "demo budget remaining" counter so we're honest that escalation costs money and can't be abused.
- If the budget is exhausted or Jev is unreachable, the site keeps working local-only and says so in the tier badge, never silently.
- Benchmarks run in a dedicated worker with DOM excluded; methodology, hardware, and date stated on the page.
- Light-first palette like the three references, system font stack, no images except the OG card and the activation video poster.
- Lighthouse ≥ 95 on all four; the site's own JS excluding the model should be under the model's size.

Exit: a stranger opens the URL, drags the threshold slider, watches a query flip from local to Jev, and understands why in under a minute. Every number on the page has a "measured on your device" or a dated methodology note next to it.

### M6 — Feedback loop

Close the loop.

- Log every escalation: input span, schema kinds, Jev decision, probability.
- Script: convert log → training examples, retrain, re-export, re-run M2 evals.
- Measure escalation rate before vs after one retraining cycle.

Exit: escalation rate drops on the demo's own traffic after retraining, and the M2 calibration curve is not degraded.

### M7 — Write-up and release

- README with the architecture diagram, the escalation-vs-accuracy curve, and the cost model.
- Blog post positioning it as the local tier of a System One stack.
- Publish package, tag v0.1.

---

## Risks

| Risk | Mitigation |
|---|---|
| Calibration head doesn't beat plain softmax | Ship temperature scaling anyway; the cascade still works, just less efficiently. Report it honestly. |
| Jev early access latency or rate limits | Client-side budget and graceful degradation to "local answer with warning." |
| Span-level escalation loses context Jev needs | Send a context window; fall back to full-query escalation and measure the cost delta. |
| Synthetic queries don't match real phrasing | The M6 log is the fix; ship with the caveat stated plainly. |
| Bundle creep | Size gate in CI from M3 onward. |

## Stretch

- Command-palette mode: same model, roles compile to action + args instead of a filter.
- Incremental parsing: only re-run the window around the edit.
- Second local model of our own for date/time spans, chained before anything escalates.
- Multi-tier: LLM behind Jev for spans Jev itself is unsure about.
