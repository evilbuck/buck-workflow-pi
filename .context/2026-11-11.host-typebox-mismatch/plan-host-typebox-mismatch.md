---
status: active
date: 2026-11-11
subject: 2026-11-11.host-typebox-mismatch
topics: [typebox, omp, extension-loader, schema-validation, token-attribution, b-save]
research: []
iterations: []
spec:
memory: [host-typebox-check-2026-11-12.md]
---

# Plan: host-agnostic schema validation for omp-hosted extensions

## User Goal

Drafted 2026-11-11 from the reported symptom; confirm at review.

When the Buck Workflow plugin runs under OMP, the user sees a
`Warning: Token attribution persistence failed: Unknown type` toast on ordinary turns, and the
same latent failure sits in `/b-save` schema validation. The user wants the plugin to behave
correctly under every supported host (OMP, Pi, plain Node/Bun) without a host-specific
workaround, and without weakening validation.

## Goal

Make every runtime schema check in the plugin's extension code work against whichever
typebox-family implementation the host actually loaded, so no `Unknown type` failure can be
raised by a host/import mismatch.

## Context used / assumptions

- User-provided context: the OMP warning `Token attribution persistence failed: Unknown type`,
  and the instruction that the fix is plugin-side (not an OMP change).
- Session context (diagnosis run, 2026-11-11, OMP 18.18.8):
  - The toast is emitted by the plugin, not by OMP: `extensions/token-attribution/index.ts:341`
    (also `:353`, `:362`) calls
    `ctx.ui.notify(\`Token attribution persistence failed: ${error.message}\`, "warning")`.
  - The throw is `extensions/token-attribution/db.ts:27` —
    `Value.Check(RecordSchema, value)` inside `parseRecord()` — which raises
    `ValueCheckUnknownTypeError: Unknown type` from
    `node_modules/@sinclair/typebox/build/esm/value/check/check.mjs:463` (the `default:` branch
    of `Visit()`, when the schema carries no known `Kind`).
  - Reproduced in a live OMP session with a scratch probe extension: the first insert succeeds,
    the second insert of the same entry key throws `Unknown type` with the stack above.
    `parseRecord` is reached on the read-back path, which is why re-delivery of an
    already-stored row (every subsequent turn) fails.
  - Why the two imports disagree: OMP's extension loader rewrites the **exact** specifier
    `"@sinclair/typebox"` to a bundled legacy typebox shim (`legacy-typebox.ts`, a Zod-backed
    implementation that exports only `Type` and `default`), but does **not** rewrite the
    subpath `"@sinclair/typebox/value"`. That subpath therefore resolves from disk to the real
    `@sinclair/typebox@0.34.52`. Live probe under OMP: the `Type` module exposes only
    `["Type","default"]`, `Type.Object(...)` returns a schema with `safeParse`/`__validator`
    and **no** `Symbol.for("TypeBox.Kind")`, while the `Value` module is the full v0.34 API.
    Real typebox's `Value.Check` dispatches on that missing symbol and throws.
  - Pi is unaffected: `pi-coding-agent`'s loader maps `@sinclair/typebox`, `typebox`,
    `@sinclair/typebox/value` and `typebox/value` to one package family, so `Type` and `Value`
    always agree. Plain Node/Bun (vitest) resolves both specifiers to the same
    `@sinclair/typebox@0.34.52`, so the current test suite is green and cannot see this bug.
  - Shim parity spot-checks under OMP (all pass): `additionalProperties: false` is enforced
    (`"extra must be removed"`), literal unions, numeric literals, null unions, booleans,
    `minItems`, `minLength` and `Optional` all behave as expected.
- Assumptions:
  - A-1 — Under OMP the plugin's `@sinclair/typebox/value` import resolves to a real
    typebox v0.34 install (present in the installed plugin's `node_modules`). Status:
    validated by live probe (stack frame path).
  - A-2 — The host-provided schema always carries a usable validator: either
    `safeParse` (OMP shim) or a `TypeBox.Kind` symbol (real typebox v0.34 / v1). Status:
    validated by probe across both families.
  - A-3 — Semantics of the two families agree closely enough that one boolean check is
    equivalent for the schemas this plugin uses. Status: validated for the constructs in
    `extensions/token-attribution/db.ts`, `extensions/b-save/roles.ts` and
    `extensions/b-save/types.ts`; re-confirm with the plugin's own schema set in step 4.
  - A-4 — `extensions/sql-memory/index.ts:14` uses `Type.Unsafe` for tool parameters. Under OMP
    the shim returns a Zod-backed object instead of the raw JSON-schema literal, so the
    rendered tool-parameter schema may degrade. Status: deferred — out of scope for this
    plan, listed as a risk with a verification step (step 6).
  - Buck capability: full. Probe source: system available-skills catalog (`b-build`,
    `b-review`, `b-save` all listed).
- Artifacts used: none (diagnosis was done in-session; no research artifact exists yet).

## Decision Closure

- Selected course: introduce one plugin-owned validator helper that picks the validator from
  the **schema object** rather than from an import path, and route every runtime
  `Value.Check` call site through it.
- Evidence:
  - The failure is a specifier-rewrite asymmetry inside OMP's loader, so an import-path-level
    fix in the plugin cannot be made correct for all hosts at once — the helper must be
    capability-driven.
  - Both loaded families expose a usable validator on the schema itself (A-2), so a
    capability probe is sufficient; no host detection is needed.
  - Alternative "hand-roll the validation" was rejected: it would duplicate typebox
    semantics for the nested `b-save` schemas and drift from them.
  - Alternative "make the plugin import `Value` from the same module as `Type`" was rejected:
    under OMP the rewritten module exports no `Value`, so the pair would still be broken.
- Excluded scope: any change to OMP's loader, to `pi-coding-agent`, or to the typebox
  versions the plugin depends on. An upstream OMP issue (rewrite the `@sinclair/typebox/value`
  subpath alongside the bare specifier) is worth filing separately but is not required for
  this fix.
- Next action: implement the helper and the call-site migration (steps 1–3), then prove the
  mismatch is gone with the unit test in step 4.

## Assumptions Ledger

| id | statement | status | blocking | evidence | validation_path |
|---|---|---|---|---|---|
| A-1 | `@sinclair/typebox/value` resolves to a real typebox v0.34 install under OMP | validated | false | live OMP probe stack frame | — |
| A-2 | Every host-provided schema carries `safeParse` or a `TypeBox.Kind` symbol | validated | false | live OMP probe + local v0.34/v1 shape checks | — |
| A-3 | Shim and real typebox agree on the constructs the plugin's schemas use | validated | false | OMP probe of `additionalProperties`, literal unions, numeric literals, null unions, booleans, `minItems`, `minLength`, `Optional` | re-run against the plugin's own three schema sets in step 4 |
| A-4 | `Type.Unsafe` tool parameters may degrade under the OMP shim | deferred | false | OMP probe: `Unsafe` returns a Zod-backed object with `safeParse`/`toJsonSchema` and no plain keys | inspect the rendered `sql_memory` tool schema in an OMP session (step 6) |

## Material Risks

| id | failure mode | impact | mitigation | rollback / fallback |
|---|---|---|---|---|
| R-1 | The capability probe misreads a schema and picks a validator that is silently permissive | invalid data passes validation | probe prefers `safeParse` only when it is a function; every other path falls back to `Value.Check`; unit tests cover both families and a foreign-schema case | revert the call-site migration; helper is additive |
| R-2 | The two families differ on some construct used by the plugin's schemas | a schema becomes stricter or looser than today on one host | step 4 asserts the plugin's own three schema sets accept/reject identically under both families | pin the plugin to one family and file the upstream OMP issue instead |
| R-3 | `Value.Check` from a foreign family throws `Unknown type` inside the helper | validation crashes instead of returning false | helper catches the unknown-type error and rethrows a message that names the host mismatch | as above |
| R-4 | `extensions/sql-memory`'s `Type.Unsafe` tool parameters already degrade under OMP | tool schema card may be wrong for `sql_memory` | A-4 is tracked, not fixed here; step 6 reports the observed shape | unrelated to this change; separate plan if confirmed |

## Scope

1. New module `extensions/typebox-check.ts` exporting a single capability-driven validator:
   - if the schema exposes a callable `safeParse`, use `schema.safeParse(value).success`;
   - otherwise use `Value.Check(schema, value)` from `@sinclair/typebox/value`;
   - on a foreign-family `Value.Check` failure, rethrow with a message naming the mismatch
     instead of the bare `Unknown type`.
2. Migrate the five runtime `Value.Check` call sites to that helper:
   - `extensions/token-attribution/db.ts:27`
   - `extensions/b-save/roles.ts:123`, `:134`, `:140`
   - `extensions/b-save/types.ts:105`
3. Keep the schema definitions (`Type.*` builders) untouched — they are correct on every host;
   only the checking path changes.
4. Tests:
   - `extensions/typebox-check.test.ts` — helper unit tests: real typebox v0.34 schema path,
     a `safeParse`-only (foreign/OMP-style) schema path, and a foreign-schema error path.
   - A regression test that a second insert of an already-stored attribution row does not
     throw (the exact shape that fails under OMP today).
5. One backlog item for the whole unit (pickup-able), referencing this plan.
6. Verification sweep of the other `Type.*` runtime uses in the plugin, reporting (not fixing)
   the `Type.Unsafe` observation (A-4).

## Out of scope

- Any change to OMP (`oh-my-pi`), to `pi-coding-agent`, or to their typebox aliases.
- An upstream OMP issue/PR for the loader's subpath asymmetry (worth filing; not required).
- Changing `Type.Unsafe` tool-parameter schemas (A-4) — reported, not fixed.
- Adding typebox to the plugin's runtime dependencies, or pinning typebox versions.
- Reworking `b-save`'s validation error wording beyond what the helper change forces.

## Affected files

- `extensions/typebox-check.ts` — new. Shared validator helper.
- `extensions/typebox-check.test.ts` — new. Helper unit tests.
- `extensions/token-attribution/db.ts` — use the helper in `parseRecord`.
- `extensions/b-save/roles.ts` — use the helper in `isScribeProposal`, `parseAuditor`, `parseGoal`.
- `extensions/b-save/types.ts` — use the helper in `parseRunManifest`.
- `extensions/token-attribution/__tests__/db.test.ts` — regression test for the repeat-insert path.
- `.context/backlog/items/host-typebox-mismatch.md` — new backlog item.
- `.context/backlog/todo.md` — backlog checkbox for the item.

## Implementation steps

1. Add `extensions/typebox-check.ts`:
   - export `checkSchema(schema: unknown, value: unknown): boolean`;
   - prefer a callable `schema.safeParse` (OMP shim, Zod-style) and read its `success`;
   - otherwise call `Value.Check` from `@sinclair/typebox/value`;
   - catch the unknown-type error from a foreign family and rethrow
     `schema validation used a foreign typebox implementation (<original message>)`.
2. Replace the five call sites with `checkSchema(...)`; keep their existing accept/reject
   semantics and error messages unchanged (`Invalid retained attribution row`,
   `Auditor schema violation`, `Goal classifier schema violation`,
   `Run manifest failed schema validation`).
3. Remove the now-unused direct `Value` imports from those three files (keep `Type`).
4. Add `extensions/typebox-check.test.ts` covering both validator families and the error
   path; add the repeat-insert regression test to
   `extensions/token-attribution/__tests__/db.test.ts`.
5. Create the backlog item and its `todo.md` checkbox.
6. Report the `Type.Unsafe` observation (A-4) into this plan's findings without changing
   `extensions/sql-memory`.

## Acceptance criteria
- [x] `checkSchema` returns `true`/`false` for a real typebox v0.34 schema, matching `Value.Check`.
- [x] `checkSchema` returns `true`/`false` for a `safeParse`-only schema, without touching `Value.Check`.
- [x] `checkSchema` reports a foreign-family mismatch as a named error, not a bare `Unknown type`.
- [x] `extensions/token-attribution/db.ts`, `extensions/b-save/roles.ts` and `extensions/b-save/types.ts` contain no direct `Value.Check` call.
- [ ] A repeat insert of an already-stored attribution row succeeds in the test suite.
- [x] `npm run test` passes in `buck-workflow-pi`.
- [x] `npm run guardrails:check` reports a passing verdict (unit gate required; patch coverage ≥ 90; cyclomatic complexity ≤ 10 for new code).
- [x] An OMP smoke run with the plugin loaded produces no `Token attribution persistence failed` notification.

Acceptance wrap-up 2026-11-12, jev-1.14.0: criterion_1 0.98, criterion_2 0.97, criterion_3 0.96, criterion_4 0.96, criterion_6 0.84, criterion_7 0.96, criterion_8 0.93 stamped. Repeat-insert criterion stayed open: first call 0.13, second 0.49, third with verbose pass lines (`repo-files`/`external-files`/`sqlite` ✓, postgres skipped) 0.43. Not stamped. Plan status stays active.

## Verification

1. `cd ~/projects/development_tools/buck-workflow-pi && npm run test` — vitest + bun subsets +
   sqlite runtime smoke.
2. `npm run guardrails:check` — durable contract (`guardrails.json` present): unit gate required,
   patch coverage ≥ 90, complexity ceiling 10 (hard 15).
3. `npm run subject-lifecycle:check` — subject lifecycle invariants still hold.
4. OMP runtime proof: run a two-turn OMP session in a scratch git repo with the plugin loaded
   and grep the new session `.jsonl` for `Token attribution persistence failed` — expect zero
   hits — and confirm the attribution row persists (the plugin's own `/tokens` report or the
   persisted attribution store shows the turn).
5. Focused unit run: `npx vitest run extensions/typebox-check.test.ts
   extensions/token-attribution/__tests__/db.test.ts extensions/b-save/__tests__/roles.test.ts
   extensions/b-save/__tests__/types.test.ts`.
6. Host-compat sweep (reporting only): inspect the rendered `sql_memory` tool-parameter schema
   in an OMP session and record the result under A-4 in this plan.

## Risks

- See the Material Risks table (R-1…R-4). R-1 and R-3 are the ones that would turn a
  validation bug into a silent data bug; both are covered by step 4's unit tests.
- The fix is plugin-local and reversible: `extensions/typebox-check.ts` is additive, and the
  call-site migration is a five-line change per file.

## Findings

### A-4 Type.Unsafe under OMP (reported, not fixed)

2026-11-12, OMP 18.19.0, scratch session `/tmp/typebox-smoke-8e0o`. A probe extension imported `Type` from `@sinclair/typebox` (the specifier OMP rewrites) and called `Type.Unsafe` with a plain JSON-schema object (`type: object`, `properties.op`, `required: ["op"]`), the same shape `extensions/sql-memory/index.ts` passes to `Type.Unsafe`.

Observed: `Object.keys` was `[]`, `safeParse` was a function, `Symbol.for("TypeBox.Kind")` was null. The host shim does not leave a plain JSON-schema tool-parameter object. `extensions/sql-memory` was not changed. Separate plan if the rendered `sql_memory` card is wrong in a live tool listing.
