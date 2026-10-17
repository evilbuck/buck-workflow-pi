---
status: completed
date: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [storage-consumers, census, r8]
related: [iterate-phase-5-current-state-2026-10-15.md, persistence-inventory.md]
---

# R8 retained census repair

## Scope and decision

Only R8: the assigned auto-fix/PR-context scripts, their tests, minimal instruction-defined consumer handoffs, and corresponding persistence inventory rows. Buck-owned auto-fix run/stage/completion/PR-body/failure evidence and pinned PR context/diff remain retained run-private data, not transient/user-owned exclusions. `CODE-REVIEW.md` remains retained review knowledge; the user-selected thought-dump document/checkpoint remains repository source with concrete ownership evidence.

## Implementation plan

1. Trace concrete writers, readers and lifetime; preserve existing CLI/side-effect boundaries.
2. Retain exact bytes through the configured adapter under trusted checkout/run scope. Port actual consuming reads to adapter authority and keep local paths as exports only. Keep writes awaited, conditional where read-modify-write applies, and receipt-bearing.
3. Exercise focused tests and real CLI/restart smoke, including absent/modified exports and persistence failure. Record exact commands, paths and evidence here; reconcile only assigned inventory rows.

## Constraints

No shared helper edits, stage/commit/loop-state changes, or completion of the iterate artifact. Preserve dirty staged/unrelated changes. Supervisor supplied SQL recall; no recall queries. Supervisor owns full coherent-tree guardrails/R9 verification.

## Evidence

### Auto-fix implementation

- `skills/b-auto-fix/scripts/auto-fix.ts`: `resolveConsumerContext(owningCheckout)` pins trusted destination/scope; `withBoundStore` + `commitConsumerBatch` retain bytes before export. `run.json` uses kind `run-state`; issue evidence uses `audit`; subject `auto-fix`, logical `<auto-fix-run-id>/<relative-name>`. Every write allocates a separate receipt run while artifacts remain under readable trusted workspace `context.runId`. The final manifest update is conditional on the initial revision; the shared batch preserves links.
- `main()` persists run manifests, issue stage prompts and routing plans. Its first-run safety read lists retained runs rather than checking export-directory existence.
- `artifact write <run-id> issue-<n>/<name> <input-file> --cwd <owning-checkout>` retains stage output; `artifact read` reads canonical bytes; `artifact restore` re-exports retained run/evidence after restart. Accepted relative names are constrained to the existing run/stage/evidence family.
- `successPath()` requires retained run/build/review evidence and retains the PR body before dry-run return or external operations. Hard-fail summaries and soft-fail logs are retained before acknowledgement. No missing-input or service-error fallback to files.
- `skills/b-auto-fix/SKILL.md` now routes the actual instruction-defined stage writers/readers through that handoff instead of writing canonical Markdown directly to the run directory.

### Focused tests

- `bun test skills/b-auto-fix/scripts/auto-fix.test.ts`: exit 0; **46 pass, 0 fail, 102 assertions**. Added isolated configured-store/identity + fake-gh fixtures; no operator destination or GitHub dependency.
- `npx vitest run skills/b-auto-fix/scripts/auto-fix-storage.test.ts`: exit 0; **10 pass**. Real subprocesses + local Git, repo-files/external-files/SQLite: retained manifest/stage/routing recovery, retained build/review completion, PR/failure bytes, export removal/forgery, missing canonical inputs, malformed destination no fallback, retained prior-run safety decision, and actual sibling-worktree isolation with explicit owner targeting.
- Source LSP diagnostics: eight existing Bun-ambient/`.ts`-specifier compatibility errors in `auto-fix.ts` under the repository TypeScript config; no clean typecheck claim. Those same Bun references/specifiers existed in the original source; Bun runtime suites above pass.

### Auto-fix real CLI smoke

Command: `node /tmp/r8-auto-fix-smoke.mjs` (throwaway driver, not the test suite), exit **0**, status **pass**. Ran real auto-fix CLI and completion helpers, real local Git, configured SQLite; only `gh` fixture input was substituted. No push, PR, issue comment, or other external effect. Fifteen successful CLI/Git/helper invocations, then an intentional invalid-config read exited **1**, stdout **0 bytes**.

Exact paths:

- Fixture root `/tmp/r8-auto-fix-smoke-wXBky5`; owning checkout `<root>/checkout`; config `<root>/storage.yaml`; selected DB `<root>/evidence.sqlite`; identity root `<root>/identity`.
- Auto-fix run `2026-10-16T02-41-51-2f642267`; exported run `<checkout>/.context/auto-fix/2026-10-16T02-41-51-2f642267/`.
- Trusted scope: project `workspace-a440bf2fa6d450915d56145ddc318c29faa0fefb9295ee92500dd60071e46256`, branch `branch-978d60b4-04da-40a9-a30a-04a475777b05`, worktree `worktree-93daa2bd-9773-4179-8706-d0a2bfe0877a`, workspace run `run-e308614f-e101-4bb8-b681-e9812351f5f7`.

All eight records were read through the service with this exact private worktree/run scope. Removed the whole auto-fix export tree before completion, generated completion/failure evidence from retained inputs in another process cwd, removed exports again, restored them through the CLI, and compared all eight byte-for-byte. Readback hashes (logical names relative to the auto-fix run):

| Kind | Relative name | SHA-256 |
|---|---|---|
| run-state | run.json | 792c6e3d8fb4d32683546c7232f3d8335b0fe5c94dae949d76498d3e68e91ca2 |
| audit | issue-83/stages.json | c5a11c38dafe7e84720dcdc7b695e4cb1a1cb779eaddf74bfa94255e5eaef19a |
| audit | issue-83/completion-plan.json | 1457fe6b11e7c3732814874549f39f04037b8572ec9d34548e1a19cfda1518cb |
| audit | issue-83/build.md | 38ff2bf8aaab2d248a14bc69941a5d646116c28a6dd9d23a6eaa6b9bcfcbdd77 |
| audit | issue-83/review.md | fb6ea68c1a0525db306e7a6a2ec35320af26ced546e29bc8c370b7eb49945a4d |
| audit | issue-83/pr-body.md | 31c39d2abcb1e1c226bc2a74948923f06d8ed1173249462efe1767b2bbf53646 |
| audit | issue-83/summary.md | 633f199a849795eeab0a96bc774e8dde4b1e5d402e3db9fd73427b69e368a5e0 |
| audit | issue-83/soft-fail.log | 2b2825948ccff68cdcdd983ee7d0a7abd508c888df70aeaec018f401a47c0876 |

Fixture removed after proof. No retained production/user records were modified by this smoke.

### Review report knowledge and ownership evidence

- `skills/code-review/SKILL.md` Step 6 now uses the existing `skills/_shared/workflow-state-access.md` write/readback contract for root `CODE-REVIEW.md` and subject review reports. Root logical ref: `{subjectId:"code-review",kind:"review",logicalName:"CODE-REVIEW.md"}`. The root file is an optional export; restart reads the retained reference/token.
- Actual portable CLI write/read against configured SQLite at `/tmp/r8-report-handoff-3vOtZc/storage.yaml` / `records.sqlite` returned the same revision `9df77b43-3a14-4503-80da-4d94ceeb73a3`, SHA-256 `8d9c15a56e47848551071b22cb1c5db471a632a3e818653bec6fcfa6e9a4fdfa`, despite a forged root `CODE-REVIEW.md` export. Commands: `bun skills/_shared/scripts/workflow-state-cli.ts write --subject code-review <JSON>` and corresponding `read`, from the fixture root. Fixture removed afterward.
- Thought-dump exclusion is not a new lifetime claim: `skills/thought-dump-writer/SKILL.md` lines 12–14 requires a user-selected single source file; lines 21–34 gives the user control of lifetime and explicit per-edit Git checkpoints; lines 38–44 restrict checkpointing to that exact source/executable path. This stays the original census's user repository source, not Buck run evidence.

### Pinned PR implementation

- `skills/code-review/scripts/pr-context.ts` retains context JSON and the **raw** Git diff bytes as one create-only (`expectedRevision: null`) audit batch with reciprocal artifact links. Subject `code-review-pr`; logical prefix `pull/<owner>/<repo>/pr-<N>/<base-sha>..<head-sha>/`. Both keys carry trusted source checkout worktree/workspace run, never the disposable PR checkout's identity. Each new batch has a separate fresh receipt run and readback before export.
- A later PR SHA pair receives different immutable logical names. Repeated capture of the same pair reuses the original revisions **and exports their original retained bytes**, not a newly fetched title/timestamp. No pretend receipt ID is emitted for the no-write reuse path.
- `--list <pr-ref>` and `--restore <pr-ref> [--head-sha <sha>] [--out <dir>]` use the same once-bound context and selected store. Restore reads exact listed revisions; ambiguous/missing pins or service failure refuse without local fallback. `--head-sha` selects only a head, never an unrelated matching base.
- `skills/code-review-universal/SKILL.md` directs the actual restart consumer through list/restore from the owning source checkout before reading exports. Restore rebuilds only evidence exports; it does not take ownership of or recreate a missing Git source checkout.
- `npx vitest run skills/code-review/scripts/`: exit 0, **37 pass** (30 PR-context cases across repo-files/external-files/SQLite + 7 neighboring PR-reference cases). Covers offline restart with exports absent, exact non-UTF-8 diff bytes, original context preserved after mutable PR metadata changes, revised pin retention, head selection/ambiguity, worktree isolation, create idempotence, and no `gh` call/fallback during restore or storage outage.

### Pinned PR real CLI smoke

Command: `node /tmp/r8-pinned-pr-smoke.mjs` (throwaway driver), exit **0**, status **pass**. Real CLI, local Git origin/branches/worktrees, configured SQLite; `gh` supplied only fixture PR metadata. No external GitHub/publish actions. Twenty-four successful Git/CLI/service invocations; all smoke fixtures removed afterward.

Exact fixture paths: root `/tmp/r8-pinned-pr-smoke-WtJYkC`, source checkout `<root>/work`, config `<root>/storage.yaml`, selected DB `<root>/evidence.sqlite`, registry `<root>/identity`. Restored exports: `<root>/work/.worktrees/pr-84/pr-context.json` and `pr.diff`.

- Original base `ae5f5d9b691208042a31a046f687efab886fe558`; original head `8abd43b099b5ba0951479d0661c79681597c9e3f`; revised head `9512bf37885d0139bf48cecbee949a6c15561413`.
- Trusted project `origin-599c23b149245e33ef5004c34a03e02a6a55448d750fc1128371f414840dcc45`, branch `branch-cf6fe216-09e3-438d-835a-765afc7b0d2b`, worktree `worktree-712cf292-5e12-46db-be66-6bc7920a610d`, workspace run `run-2556829f-0215-4199-a701-97ee3806ec0c`.
- Original context revision `6a0a1254-a4fa-4289-ba7d-d97c9996056a`, SHA-256 `81868e6de4bf65a480ee54c7de9efad657aadf020fcb659a01d6134d7f0e2cca`.
- Original diff revision `f6f143df-2881-4fb7-877d-f6e9cbcf7180`, SHA-256 `296195b3397fb0e7b8e1d92cc366e6547240652c9ce11a6c812c9e890545f85f`.
- Exact original keys: subject `code-review-pr`, kind `audit`, logical `pull/fixture/smoke/pr-84/ae5f5d9b691208042a31a046f687efab886fe558..8abd43b099b5ba0951479d0661c79681597c9e3f/pr-context.json` and the same prefix + `pr.diff`.
- Receipt readback: run/attempt `run-5dfd50ff-5c60-4652-be1a-5400be669947`, status `attempted`, kind `rows`, duties `pr-context,pr-diff`, exactly the two original revision IDs above; same project/branch/worktree as the artifacts, distinct receipt run from readable workspace run.
- First capture matched raw `git diff <base>..<head>` bytes including non-UTF-8 text. Re-capture after changing mutable PR title preserved original exported context. After a second pin was retained, the entire `.worktrees` export/source tree was removed and `gh` replaced with a failing sentinel. `--restore ... --head-sha <original>` recovered both original byte sequences without invoking `gh`; `--list` retained both SHA pairs (four private audit records, each with exactly one same-run reciprocal link).
- Intentional invalid-config restore: exit **1**, no output directory created, no file fallback.

### Final verification and changed paths

- Final coherent owned batch: `bun test skills/b-auto-fix/scripts/auto-fix.test.ts` → **46 pass**; `npx vitest run skills/b-auto-fix/scripts/auto-fix-storage.test.ts skills/code-review/scripts/` → **47 pass**, 3 files. Both exit 0 after the final source edits.
- Scoped `lizard --csv skills/b-auto-fix/scripts/auto-fix.ts skills/code-review/scripts/pr-context.ts`: no new function over 10; existing baseline hotspots are auto-fix `parseFlags` 26, auto-fix `main` 16 (baseline 17), PR `isPrView` 16. No baseline/contract changes. Final `pr-context.ts` LSP diagnostics: **OK**.
- Source/tests: `skills/b-auto-fix/scripts/auto-fix.ts`, `auto-fix.test.ts`, new `auto-fix-storage.test.ts`; `skills/code-review/scripts/pr-context.ts`, new `pr-context.test.ts`.
- Consumer instructions: `skills/b-auto-fix/SKILL.md`, `skills/code-review/SKILL.md`, `skills/code-review-universal/SKILL.md`.
- Durable record: this file and `persistence-inventory.md`; only original auto-fix/PR-report/pinned-input rows reconciled, with b-pr cache and thought-dump source split out rather than falsely excluding retained data.
- No shared-helper needs found; no shared helpers edited. No target-repository stage/commit, loop/lifecycle state, iterate-artifact status, memory ledger, or unrelated dirty files changed by this assignment. Throwaway smoke drivers/fixtures removed.

### Remaining verification ownership

Assigned R8 implementation and focused evidence are complete. PostgreSQL/site/harness matrix remains Phase 8; no all-adapter or full-guardrails pass is claimed here. Full unchanged contract/R9 and iterate acceptance remain supervisor-owned.
