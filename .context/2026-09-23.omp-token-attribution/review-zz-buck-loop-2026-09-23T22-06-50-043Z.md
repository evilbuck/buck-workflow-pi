## Plan Path Review: OMP token attribution by project and feature

### Plan Source
- File: `.context/2026-09-23.omp-token-attribution/plan-omp-token-attribution.md`
- Goal: Record OMP token usage by repository and branch, including nested agents, and expose totals through `/tokens`.
- Baseline: Working tree against `HEAD` `717174b`; source-state verification used because implementation is uncommitted.

### Evidence Sources
- Git status: attribution implementation is untracked; `extensions/index.ts` modified. Unrelated pre-existing model-config brainstorm changes excluded.
- Modified implementation:
  - `extensions/index.ts`
  - `extensions/token-attribution/index.ts`
  - `extensions/token-attribution/git-identity.ts`
  - `extensions/token-attribution/db.ts`
  - `extensions/token-attribution/report.ts`
  - Five attribution test files
- Live smoke:
  - `omp -p --no-tools --thinking=off --max-time=90 "Reply exactly TOKEN-ATTRIBUTION-SMOKE"`
  - OMP rejected both installed extension copies with `Extension runtime not initialized. Action methods cannot be called during…`
  - `~/.omp/stats.db` still had no attribution table afterward.
- Focused tests: 5 files, 13/13 passed.
- Guardrails: durable v2 contract passed.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Git identity resolver | ✅ complete | `git-identity.ts:27-52`; worktree, non-git, and detached behavior covered by focused tests |
| 2. SQLite attribution table | ✅ complete | `db.ts:52-140`; busy timeout, owned/fallback schema, unique delivery, and OMP-table preservation |
| 3. Usage extraction | ✅ complete | `index.ts:65-136`; token buckets, reasoning, provider/model/API, cost, and delivery key |
| 4. Wire live `message_end` recording | ❌ missing | `index.ts:251` calls `pi.getCommands()` during extension initialization, causing OMP to reject the extension. Identity caching required by the plan is also absent. |
| 5. Nested JSONL ingest | 🔄 partial | Direct tests cover ingestion and deduplication, but the extension cannot load live. The implementation also reparses every prior nested transcript synchronously on each event. |
| 6. `/tokens` command | ❌ missing | Formatter and command tests pass, but the live command is never registered because extension loading fails. |
| 7. Wire from extension entry point | 🔄 partial | `extensions/index.ts:315-318` calls the wire function, but the called function aborts extension initialization. |
| 8. Unit tests | ✅ complete | `npx vitest run extensions/token-attribution`: 13/13 passed |

### Review Axes
- **Spec axis worst finding:** Critical — load-time `pi.getCommands()` prevents the entire extension from loading, failing the recorder, `/tokens`, and `omp install` acceptance criteria.
- **Standards axis worst finding:** Warning — nested ingestion performs recursive synchronous full-file reads and reparses all historical nested entries on every `message_end` and `agent_end`.
- Standards mode: sequential portable fallback, seeded with the TypeScript guide and relevant long-method, duplicate-code, data-clump, primitive-obsession, long-parameter, and dead-code smells.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: **No**
- User goal: **Not met** — persistence and reporting logic exist, but OMP rejects the extension before registration.
- Scope adhered: Yes; unrelated model-config changes were pre-existing and excluded.
- Out-of-scope implementation changes: none identified.

### Guardrails Verdict
- Contract: `durable`
- Contract version: `2`
- Status: `pass`
- Gates:
  - `unit_test_gate=pass`
  - `functional_test_gate=skipped`
  - `lint_gate=skipped`
  - `patch_gate=pass`
  - `global_ratchet=pass`
  - `complexity_gate=pass`
- Coverage: 85.8% against 84% baseline.
- Focused attribution tests: 13/13 passed.

### User Goal Analysis
- Goal: See token counts and estimated cost per repository and branch across models.
- Met: Database schema, identity resolution, usage extraction, aggregation, formatting, and direct integration tests exist.
- Partial: Nested ingest is implemented but inefficient and not live-verified.
- Missing: A loadable OMP extension and operational `/tokens` command.
- Verdict: **Not met**

### Documentation Impact
- New token-attribution module, persistence contract, and command should be reflected in living extension documentation after correctness is restored.
- Recommended: `/b-docs` after the iteration passes review.

### How-to Impact
- `/tokens [branch-or-project-substring]` is a new user-facing action.
- Recommended: document through `/b-docs`/`/b-howto` after the command works live.

### Issue Classification
- In-plan issues:
  1. Load-time runtime action prevents extension initialization.
  2. Planned identity cache is absent.
  3. Nested ingestion repeatedly performs synchronous whole-history parsing.
- Out-of-plan issues: none.

### Verdict
**Needs work**

Iteration artifact written:

`.context/2026-09-23.omp-token-attribution/iterate-omp-token-attribution.md`

### Recommended Next Step
Return this result to the supervisor for `/b-iterate`, then repeat `/b-review` and the live OMP smoke against the same plan.
