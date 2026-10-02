---
status: active
date: 2026-10-01
subject: 2026-10-01.sql-memory-remember-op
topics: [sql-memory, remember, error-fix, b-save]
research: []
iterations: [iterate-sql-memory-remember-op.md, iterate-jev-warning-severity.md]
memory: []
---

# Plan: Model-facing SQL memory save

## User Goal

An agent saving project memory should not have to know table columns. A wrong query should come back with the legal columns and the call to use instead, so the operator stops seeing a burst of failed memory probes.

Synthesized from this session. Correct the wording if the beneficiary is wrong.

## Goal

Add a `remember` operation that writes a memory without the model assembling SQL, and return a `fix` on gate denials and Postgres failures so a model that still writes SQL can correct the next call.

## Context used / assumptions

- User-provided context: the 2026-10-01 08:51 EDT notice burst, then the request to move UUID/timestamp decisions into the tool, then the request for errors the model can use, then this plan.
- Session context: the burst was a direct `/b-save` in `jev-buck-flow` (`2026-10-01T12-11-22-551Z_01a0f760-5c37-7334-9933-af09234ee7c8.jsonl`), not a down database and not a buck-loop child. The model had loaded the full `b-save` skill, including `INSERT INTO users (email)`, then treated `xd://sql_memory` as the schema. That document lists ops only.
- Statements, in order: `SELECT u.id FROM users` → `column u.id does not exist`; three `information_schema.columns` queries → gate reason `Cross-database or non-public schema references are not allowed`, notice hardcoded to `operation not allowed`; `project = '<uuid>'::text` → `operator does not exist: uuid = text`. The untyped uuid literal succeeded. `SELECT * FROM users` showed `email` and `skill_weight` only.
- The model reads tool-result JSON, not the 50-character notice. It already received `message` and still probed. A longer notice is not the correction channel.
- `saveSqlFacts` in `extensions/buck-loop/sql-save.ts` already derives email, origin, branch/SHA, source key, seq, category `"project"`, and readback. The incident did not use that path.
- `users.email` is the primary key. `memories.id` and `projects.id` default to `uuidv7()`. `created_at` and `valid_at` default to `now()`. Corrections already set `invalid_at = now()` inside `correctSqlMemory`.
- `plugins/buck-workflow/skills/b-save/` must stay byte-identical to `skills/b-save/`. `scripts/codex-plugin.test.ts` enforces canonical copies.
- Stale session pointer `2026-09-22.buck-loop-model-config` was not reused. No orchestration file. This subject is new.

## Decision Closure

**Selected course.** Add `op: "remember"` on the direct tool and the save role. Recall role cannot call it. The model supplies `body`, `subject`, optional `previousId`, optional `phase`, and optional `category` (default `"project"`). The tool derives author, project, branch/SHA, seq, source key, context, ids, and timestamps, then returns `{ id }` only after an internal same-project active readback. A `previousId` call fills identity and uses the existing `correctSqlMemory` transaction. Do not accept author, project, branch, SHA, or seq from the model on this op.

Error JSON gains `fix`, plus Postgres `hint`, `code`, `table`, and `column` when the driver provides them. Gate denials keep `gate.reason` in `message` and add a `fix` that names the nine public tables and forbids catalog queries. Unknown-column failures name that table's columns. UUID/text operator failures say to compare a uuid column to an untyped literal or a uuid parameter, and to cast the column only in the select list. The tool description, which is the `xd://sql_memory` document, includes one column card shared with the fix text.

`b-save` SQL mode becomes one `remember` call. The skill still writes the receipt from the returned id. It does not emit `INSERT`, `UPDATE`, source-key `SELECT`, or a readback `SELECT`. Raw `sql` stays for recall and for the documented schema examples. `saveSqlFacts` stays the supervisor writer and is not rewritten.

Tradeoff: `subject` is required even though the earlier sketch was body plus `previousId`. The tool cannot know which subject folder the fact belongs to, and that string is not a column. Identical body text in the same subject retries as the same fact.

**Evidence.** Migration `001` has no `users.id`. The incident JSON contained the real Postgres and gate text while the notice said `operation not allowed` (`extensions/sql-memory/index.ts` hardcodes that notice string; `index.test.ts` pins it). The model corrected the `::text` cast after the operator error and answered the missing column by querying `information_schema`. `correctSqlMemory` and `saveSqlFacts` already own the write transaction and the identity rules.

**Excluded scope.** No recall op. No removal of `sql`. No `information_schema` access. No `skill_weight` or `value_score` automation. No receipt unforgeability work. No migration. No change to the supervisor insert column list or source-key format. No notice redesign beyond stopping the hardcoded denial string.

**Next action.** `/b-build-hard` against this plan. The new write op is a trust-boundary abstraction; hard mode applies the minimal-change sequence and does not replace `correctSqlMemory` or `saveSqlFacts`.

## Assumptions Ledger

| id | statement | status | blocking | evidence | validation_path |
|---|---|---|---|---|---|
| A-1 | The model corrects from tool-result JSON, not the 50-character notice. | validated | false | Incident tool results contained the full `message`. The model dropped `::text` after `operator does not exist: uuid = text`. | — |
| A-2 | Author is `users.email` from `git config user.email`. There is no user id to resolve. | validated | false | `migrations/001_initial_schema.sql`; incident `SELECT * FROM users` returned `email` and `skill_weight`. | — |
| A-3 | `remember` must work on the direct tool. The incident was not a save-role child. | validated | false | `jev-buck-flow` wrote `xd://sql_memory` during `/b-save` outside a configured loop. | — |
| A-4 | Canonical and bundled `b-save` must stay byte-identical. | validated | false | `scripts/codex-plugin.test.ts` canonical-copy check; existing phase acceptance uses `diff -rq skills/b-save plugins/buck-workflow/skills/b-save`. | — |

## Material Risks

- **failure_mode:** `remember` writes under the wrong project, or writes at all when git identity is missing.
  **impact:** A fact lands on another origin, or on a filesystem path if the cwd fallback in `resolveGitIdentity` is reused.
  **mitigation:** Fail closed when email or origin cannot be resolved. Do not call `resolveGitIdentity`; it returns `cwd` on failure. Redact URL credentials with `redactRemoteCredentials`. Detached HEAD stores both branch and SHA as null, matching `saveSqlFacts`.
  **rollback_or_fallback:** The op is additive. Revert the skill text and callers keep using `sql`. Rows written by a bad identity are corrected with `previousId`, not by updating `body`.
  **validation_path:** Unit test with a git runner that throws. Expect zero inserts. A second test uses a fixed origin and email and asserts those values on the inserted row.

- **failure_mode:** The model ignores `remember` and still writes SQL.
  **impact:** The same probe burst can recur. Raw `sql` remains legal.
  **mitigation:** The skill no longer contains the save `INSERT`/`SELECT` procedure. `fix` tells the model to call `remember` and names the legal columns. This does not make obedience guaranteed.
  **rollback_or_fallback:** `fix` still covers the three incident classes if the model stays on `sql`.
  **validation_path:** After the skill edit, `rg` over `skills/b-save/SKILL.md` finds `op: "remember"` and does not find `INSERT INTO memories` or `information_schema`. A unit test asserts the `42703` and gate `fix` strings.

- **failure_mode:** Identical body text in one subject collapses two intended facts.
  **impact:** The second call returns the first id.
  **mitigation:** Source key is a hash of subject, phase, body, and `previousId`. Different text, phase, or predecessor is a different row. Document the collapse. A correction still goes through `previousId`.
  **rollback_or_fallback:** Pass `previousId` to supersede, or change the body. No silent update of immutable content.
  **validation_path:** Unit tests: identical retry returns one id and does not insert again; two bodies return two ids; `previousId` sets `superseded_by` and leaves the predecessor body unchanged.

- **failure_mode:** Only the canonical skill is edited.
  **impact:** Codex bundle parity fails, or a bundled agent keeps the old SQL procedure.
  **mitigation:** Recopy `skills/b-save/` onto `plugins/buck-workflow/skills/b-save/`. Do not hand-edit the bundle.
  **rollback_or_fallback:** Recopy again from canonical. The parity test fails closed until they match.
  **validation_path:** `diff -rq skills/b-save plugins/buck-workflow/skills/b-save` is empty, and `npx vitest run scripts/codex-plugin.test.ts` passes.

## Scope

- `remember` on the direct tool and the save role. Recall role receives a denial whose `fix` says to use the recall protocol, not `remember`.
- Tool-owned identity, provenance, seq, source key, context, id, timestamps, user/project upsert, and readback.
- Model-facing `fix` on gate denials and query failures, including the three incident classes.
- Column card in the tool description, generated from the same column map as `fix`.
- `b-save` SQL mode cut over to `remember`, canonical and bundled.
- `docs/sql-memory.md` tool-mode section gains `remember`. Existing live SQL examples stay; they document the schema, they are not the save procedure.
- Denial notice uses the real short reason. It must not keep substituting `operation not allowed`. The 50-character cap and redaction stay. The model contract is the JSON `fix`, not the notice.

## Out of scope

- A recall op, or changing `skills/_shared/recall-project-memories.md`.
- Removing or narrowing the `sql` op.
- Rewriting `saveSqlFacts`, receipt files, or subject lifecycle.
- `skill_weight`, `value_score`, embeddings, or tags.
- Letting the model query `information_schema` or `pg_catalog`.
- Making a model unable to ignore the skill.

## Affected files

- `extensions/sql-memory/index.ts` — `remember` params, identity, error envelope, description.
- `extensions/sql-memory/index.test.ts` — incident fixes, remember behavior, denial notice assertion at the `DELETE FROM memories` case.
- `extensions/sql-memory/notice.ts` — only if the real denial reason needs a caller-supplied string. Do not put `fix` in the 50-character notice.
- `skills/b-save/SKILL.md` — replace SQL steps 1–4 and the model-issued readback with one `remember` call.
- `plugins/buck-workflow/skills/b-save/` — recopy of the canonical directory.
- `docs/sql-memory.md` — tool modes and a short `remember` example.

Do not import `extensions/buck-loop/sql-save.ts` into the tool. Reuse `correctSqlMemory` and `sqlMemorySaveTransaction` in `extensions/sql-memory/index.ts`. Reuse `redactRemoteCredentials` from `extensions/token-attribution/git-identity.ts`.

## Implementation steps

1. Add one column map for the nine public tables, matching `migrations/001_initial_schema.sql`. `users` is `email`, `skill_weight`. `memories.author` is text. `memories.project` and `memories.id` are uuid. Put that card in the tool `description` so `xd://sql_memory` is no longer ops-only. State the joins: `u.email = m.author`, `p.id = m.project`.
2. On gate denial and on query throw, return JSON `{ error: true, message, fix, hint?, code?, table?, column? }`. `42703` names the referenced table's columns and says there is no `users.id`. Non-public schema and unknown-table denials name the nine tables and say schema inspection is denied. `42883` forbids casting a uuid literal to text. Every write-side `fix` says to call `remember` instead of assembling `INSERT`/`UPDATE`. Pass the real denial reason into the notice formatter. Update the test that expects `Memory denied · operation not allowed`.
3. Add `remember`. Required: `body`, `subject`. Optional: `previousId`, `phase` (`string | null`), `category` (default `"project"`). Reject an unknown or non-active category with a `fix` that lists active slugs from `categories`; the model does not run that query. Derive email and origin with a strict git reader. Missing email, missing origin, or a branch/SHA pair that is only half present fails before insert. Upsert `users` and `projects` the way `saveSqlFacts` does. Source key is a hash of subject, phase, body, and `previousId`. Reuse an active same-project row with that key. Otherwise allocate `seq` as `max(seq) + 1` for the project and insert through the existing column list. `previousId` calls `correctSqlMemory` after the tool fills author, project, branch, SHA, context, category, and seq. Context `source` is `sql-memory-remember`, not `b-save-improved`. Read back the active same-project id before returning `{ id }`. Recall role is denied before connect.
4. Add tests for the three incident statements, missing git identity with zero inserts, idempotent retry, two different bodies, correction linkage without a body update, unknown category, and recall-role denial.
5. Replace the `b-save` SQL procedure with one `remember` call. The skill still writes the receipt from the returned id and still fails the save on `{ error: true }`. It does not tell the model to resolve `users.id`, query catalogs, cast uuid literals, or issue the readback `SELECT`. Recopy the canonical skill directory onto the bundle.
6. Document `remember` in `docs/sql-memory.md` next to the existing tool modes. Leave the live schema examples in place.
7. Run the verification below. Do not start a second writer in `sql-save.ts` if step 3 can call `correctSqlMemory`.

## Acceptance criteria

- [x] `remember` with a fixed email and origin inserts one active row and returns its id. A second call with the same subject, phase, and body returns that id and does not insert again.
- [x] Two different bodies in one subject return two ids.
- [x] `previousId` invalidates that predecessor and sets `superseded_by` in one transaction. The predecessor `body` is unchanged.
- [x] Missing git email or origin inserts nothing.
- [x] Recall role cannot call `remember`.
- [x] `SELECT u.id FROM users` returns a `fix` that lists `email` and `skill_weight` and says there is no `users.id`.
- [x] An `information_schema` statement is denied with a `fix` that names the nine public tables and does not tell the model to inspect the catalog.
- [x] `project = '<uuid>'::text` returns a `fix` that says not to cast the literal to text.
- [x] The model-facing JSON for a gate denial is not merely `operation not allowed`. The collapsed notice no longer substitutes that string for `gate.reason`.
- [x] `skills/b-save/SKILL.md` save procedure contains `remember` and does not contain `INSERT INTO memories`. The bundled copy matches byte-for-byte.
- [x] `saveSqlFacts` tests still pass without a behavior change.

## Verification

- `npx vitest run extensions/sql-memory/index.test.ts extensions/sql-memory/notice.test.ts scripts/codex-plugin.test.ts`
- `diff -rq skills/b-save plugins/buck-workflow/skills/b-save`
- `rg -n "INSERT INTO memories|information_schema" skills/b-save/SKILL.md` returns no save-procedure matches.
- After the edit batch, `npm run guardrails:check`. A required-gate failure blocks completion.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build-hard` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact for an in-plan issue, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a separate `/b-plan` → `/b-build` cycle. If review flags documentation impact beyond step 6, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
6. If interrupted, resume from this plan.

## Risks

See Material Risks. The additional product risk is a model that keeps using `sql` after the skill change. That remains possible on purpose. The `fix` field is the backstop, not a guarantee.
