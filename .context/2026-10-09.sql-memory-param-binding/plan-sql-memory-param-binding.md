---
status: active
date: 2026-10-09
subject: 2026-10-09.sql-memory-param-binding
topics: [sql-memory, parameter-binding, tool-contract, 42P02, recall]
research: []
iterations: []
spec:
memory: []
---

# Plan: sql_memory parameter binding contract (42P02 "there is no parameter $2")

## User Goal
The user hits `Memory failed · there is no parameter $2` in ordinary sessions. Goal: any agent following the documented recall protocol gets a working `sql_memory` call on the first try, and any future binding mistake produces an error that names the actual fix.

## Goal
Make `op:"sql"` accept the bound-values array under the keys callers actually send, keep `values` working, and make 42P02-class failures self-describing. Document the exact JSON envelope everywhere the recall query is prescribed.

## Context used / assumptions
- Session context (2026-10-09, Scout/marketing): four live `xd://sql_memory` calls.
  1. `{"op":"sql","query":…,"params":[…]}` → validation: `statement` required; echoed normalized args were `{"op":"sql"}` — `query` and `params` stripped.
  2. `{"op":"sql","statement":…,"params":[…]}` → executed, PostgreSQL 42P02 `there is no parameter $2`.
  3. Same with `parameters` → identical 42P02.
  4. Literals inlined → executed, returned rows.
- Root cause (scout-verified, no fix applied): `extensions/sql-memory/index.ts:19` declares the array as `values` only. `params`/`parameters` are not schema properties, so provider-side JSON-schema normalization of the flat `Type.Unsafe` object (`index.ts:14-43`) strips unknown keys before `execute` runs. The executor is NOT broken: `executeSql` passes `params.values` as the pg driver's second argument (`index.ts:131`). It is a key-naming contract mismatch.
- Misleading hint: `fixForSqlError` (`index.ts:164-173`) special-cases only 42703/42883; 42P02 falls through to `fixFor("denied")` = "Use the column card in the tool description…" (`columns.ts:118`) — irrelevant advice for an unbound placeholder.
- Visibility gap: the rendered tool-description schema card shows `{op?: "sql"}` with no `statement`/`values` fields (they live in top-level properties + `anyOf` branch requirements at `index.ts:37-38`, which the card renderer omits), and `skills/_shared/recall-project-memories.md` gives the `$1`/`$2` SQL but never names the envelope key for the values array. This is why every session guesses `params` and fails.
- Internal caller `extensions/buck-loop/project-memory.ts` (`RECALL_SQL`, `recallProjectMemories`) calls the pool directly in TypeScript — unaffected by the JSON key contract; only agent-facing JSON callers hit the bug.
- Existing tests: `extensions/sql-memory/index.test.ts` (binding-as-data at L18-35; fake pool asserts positional values), `sql-gate.test.ts` (placeholders `$n` allowed, `plainto_tsquery` allowed both directions), `columns.test.ts` (fixFor hints), `migrations.test.ts`, `remember.test.ts`. No test uses `params`/`parameters`.
- Repo state: `buck-workflow-pi` on `master`, clean, even with `origin/master`. Master is protected — work on a feature branch.
- Extension load path (assumption, verify in step 0): `skill://` URIs in the live OMP session resolve directly into this checkout, and neither `~/.omp/agent/extensions/` nor `~/.pi/agent/extensions/` contains sql-memory — the harness appears to load extensions from this installed package checkout. A session restart is required after the fix; confirm the loaded copy at implementation time (startup log or `read proc://`).
- Test command: `npm run test` (vitest run + bun subset).

## Decision (selected course)
Accept `params` and `parameters` as aliases of `values` rather than renaming `values`:
- Renaming breaks the documented pg-driver-idiomatic key and every internal test for zero added robustness.
- Aliasing absorbs the two most common caller guesses while `values` stays canonical; existing `values` callers are unaffected.
- Tradeoff accepted: three names for one concept. Precedence at dispatch: `params ?? parameters ?? values`. Documented in schema comment + tool description.

This is routine, reversible, well-specified work (decision-closure low-risk path): no closure sections, no assumptions ledger.

## Scope
1. `extensions/sql-memory/index.ts`
   - Schema (`index.ts:14-43`): add `params: { type: "array", items: {} }` and `parameters: { type: "array", items: {} }` properties; extend the `SqlMemoryParamsType` sql variant (`index.ts:45`) with optional `params`/`parameters`.
   - Dispatch (`executeSql`, sql branch at `index.ts:390` area): resolve bound values once as `params ?? parameters ?? values` and pass that to `client.query` (`index.ts:131`) — one resolution point, not scattered.
   - `fixForSqlError` (`index.ts:164-173`): add a 42P02 branch (`fields.code === "42P02"` or `/there is no parameter \$\d+/` on the message) returning a new `fixFor("unbound-parameter", …)` entry in `columns.ts` with text like: `Bind $n placeholders by passing a JSON array under "values" (aliases: "params", "parameters"). Unknown keys are stripped by the schema, so placeholders reach PostgreSQL unbound.`
   - Tool `description` (ToolDefinition near `index.ts:328-407`): add one sentence stating the sql envelope — `{"op":"sql","statement":"…","values":[…], "params"/"parameters" accepted as aliases}` — because the rendered schema card hides top-level optional fields.
2. `skills/_shared/recall-project-memories.md`: after the query block, add the exact call envelope: `{"op":"sql","statement":"<query above>","values":["<origin>","<text>"]}` (aliases noted). Keep the SQL text unchanged (it is the aligned single contract from subject 2026-09-28.sql-memory-buck-loop).
3. `plugins/buck-workflow/skills/_shared/recall-project-memories.md`: byte-identical sync of the same change.
4. `docs/sql-memory.md`: document the envelope + alias precedence in the query section.
5. Tests
   - `extensions/sql-memory/index.test.ts`: params alias binds (fake pool receives the array positionally); parameters alias binds; precedence `params` over `values` when both present; existing `values` path still green.
   - `columns.test.ts` or `index.test.ts`: a 42P02-shaped error produces the unbound-parameter fix text (not the column-card hint).

## Out of scope
- Any change to the recall SQL text, gate allowlist, or role gating.
- `remember`/`correct`/`migrate` ops.
- Rendering changes to the harness schema card (harness-side; mitigated by description text).
- Buck-loop internal recall path (unaffected).

## Affected files
- `extensions/sql-memory/index.ts`
- `extensions/sql-memory/columns.ts`
- `extensions/sql-memory/index.test.ts`
- `extensions/sql-memory/columns.test.ts`
- `skills/_shared/recall-project-memories.md`
- `plugins/buck-workflow/skills/_shared/recall-project-memories.md`
- `docs/sql-memory.md`

## Implementation steps
1. Confirm which extension copy the live session loads (startup log / package pointer); note it for the reload step.
2. Branch off `master` (e.g. `fix/sql-memory-param-binding`).
3. Schema + dispatch alias resolution in `index.ts` (single resolution point).
4. 42P02 fix branch in `fixForSqlError` + `fixFor("unbound-parameter")` in `columns.ts`.
5. Tool description envelope sentence.
6. Tests per scope item 5.
7. Doc updates (both recall-project-memories.md copies byte-identical, docs/sql-memory.md).
8. `npm run test` — full suite green.

## Acceptance criteria
- [x] `{"op":"sql","statement":<protocol query>,"params":[origin,text]}` returns rows/`rowCount` — no 42P02.
- [x] Same for `"parameters"` and `"values"` keys (no regression).
- [x] A 42P02-class failure returns a `fix` naming `values`/`params`/`parameters` — asserted by test.
- [x] `recall-project-memories.md` (both copies, byte-identical) and `docs/sql-memory.md` show the exact JSON envelope.
- [x] `npm run test` passes.

## Verification
- Unit: new alias + hint tests; existing suite (`npm run test`).
- Byte-identity: `diff skills/_shared/recall-project-memories.md plugins/buck-workflow/skills/_shared/recall-project-memories.md` → empty.
- Live end-to-end (after session restart so the extension reloads): replay this session's exact failing call shape via `xd://sql_memory` with `params` → expect rows (or documented zero-row result), and re-read the tool description to confirm the envelope sentence appears. Zero-pollution: SELECT-only.

## Execution Instructions
This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings route to a separate `/b-plan` → `/b-build` cycle. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next turn.

## Risks
- Both `values` and `params` sent with different arrays → precedence picks `params`; deterministic, documented, harmless (SELECT-only role anyway).
- Harness may still strip aliased keys if its normalizer runs before schema validation against a stale schema — mitigated by adding them as real schema properties; verified by live replay.
- Loaded-copy ambiguity: if the session loads an installed copy rather than this checkout, the fix won't go live on restart — step 1 verifies; rollback is trivial (revert single commit).
- Doc drift between the two recall-project-memories.md copies — enforced by diff in verification.
