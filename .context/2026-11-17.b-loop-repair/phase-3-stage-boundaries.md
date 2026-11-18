---
status: completed
phase: 3
order: 3
plan: plan-b-loop-repair.md
phases_overview: plan-b-loop-repair-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Wire existing Buck build acceptance (including OMP native judge), fresh build-fingerprinted review without ranking/auto-iterate loops, restricted stage tools, and journal/receipt-bound save recovery."
omp_execution: none
files:
  - skills/b-loop/scripts/stages.ts
  - skills/b-loop/scripts/eval-buck-loop.ts
  - skills/b-loop/scripts/eval-buck-loop.test.ts
from_plan_steps: [3]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] Restricted tool sets are enforced cleanly per stage (`build`, `review`, `save`, `commit`) matching Buck stage responsibilities."
  - "[x] `build` stage tracks phase revision, acceptance evidence, and exact resulting worktree fingerprint; uses existing Buck build acceptance checks including OMP 18.22.0 native `judge(state, keyedQuestionsObject)` (`noul >= 0.7`, reading `result.answers`) when acceptance criteria require judgment; failed/missing/stale acceptance preserves partial worktree changes and blocks/reruns appropriately."
  - "[x] Separate runner `judgeBatch` finding-ranking and automatic `b-iterate` loop are removed from `/b-loop`; `review` runs a fresh `b-review` tied strictly to the accepted build revision and worktree fingerprint."
  - "[x] Review recovery reuses matching review evidence, retries interrupted review, and when actionable findings exist keeps the report, records `b-review finished · blocked` (preserving milestone), and blocks `save`."
  - "[x] `save` persists `attemptId` (or save run ID) before apply, binds to existing journal (`sql-save-attempt.json` / adapter attempt journal) or `write-receipt` before apply, reads back the same attempt + exact saved artifact revisions via `workflow_state`, recovers/accepts an already-completed apply without duplicating save effects, and blocks on ambiguous outcome."
completed_at: 2026-11-17
completed_by: claude-opus-4-6
---

# Phase 3: Stage Boundaries (`build`, `review`, `save`) & Acceptance

## Context

Parent plan User Goal: When a phase fails or gets interrupted, Buck operators and their agents can see what finished and continue by running the same `/b-loop <subject>` command.

The audit at `1f02867` identified invalid OMP `judge` arguments (passing an array instead of a keyed object and checking `{ ok, bool }` instead of `result.answers`), stale review selection, and unpinned save execution. Building on Phase 2's checkpoint seam, this phase wires the exact stage contracts and stage-specific recovery rules for `build`, `review`, and `save`, while removing the runner's stale `judgeBatch` ranking and automatic `b-iterate` path.

## Implementation Details

1. **Restricted stage tool contracts**:
   - Explicitly configure `tools` passed to `agent(prompt, { agent: "task", label, tools })` for each Buck stage (`b-build`/`b-build-hard`, `b-review`, `b-save`, `b-commit`) consistent with Buck's role boundaries (e.g., review cannot edit application code; save/commit operate within their declared responsibilities).
2. **`build` stage & native acceptance**:
   - Compute deterministic worktree + phase fingerprint before/after `build` execution (capturing phase revision + changed/working tree digest + verification evidence).
   - Dispatch `b-build` or `b-build-hard` (per phase `buck_hint`) with explicit phase context and `starting` → `working` → `finished` checkpoint updates.
   - Verify build acceptance checks (`acceptance_criteria` + verification commands + native OMP `judge(state, questionsObj)` with keyed record `{ [id]: { type: "noul", instructions, criteria } }` inspecting `answers[id].noul >= 0.7`).
   - Preserve partial worktree changes on failure/interruption; when restarting build with missing/stale acceptance evidence, re-validate or rerun build/checks against current worktree before marking `verified`.
3. **`review` stage (no ranking, no auto-iterate)**:
   - Remove `judgeBatch` finding ranking and any automatic `b-iterate` loop from `eval-buck-loop.ts`.
   - Bind each review strictly to the current verified `build` proof (phase revision + worktree fingerprint). Reject/invalidate stale review evidence if worktree or build fingerprint changed since review ran.
   - Recover interrupted review by re-running fresh `b-review`; reuse an already-verified matching review cleanly; when actionable findings exist, keep the review report artifact intact, set milestone `finished` + blocker (`reason` + next manual/iterate action), and block `save`.
4. **`save` stage (journal & receipt idempotency)**:
   - Generate and persist `attemptId` in checkpoint `starting` BEFORE dispatching or applying save.
   - Bind save execution to existing save journal / `workflow_state` `write-receipt` (`status: "attempted"` before apply, verified `"complete"` + exact artifact revision list after apply).
   - On recovery after interruption during `save`: read back the recorded `attemptId` receipt/journal first. If the save already landed cleanly on that attempt, adopt the recorded artifact revisions and mark `verified` without running a second save. If an existing apply journal needs completion, recover/verify it cleanly; if outcome is ambiguous, surface a clear blocker referencing `attemptId`.

## Risks

- **OMP `judge` API contract mismatch**: Passing wrong question schema or reading wrong response shape fails at runtime inside `omp __omp_worker_js_eval_process`.
  - *Mitigation*: Match OMP 18.22.0 verified signature (`Record<string, Question>` returning `answers[id].noul`) and validate with unit tests + OMP worker smoke test.
- **Stale review reuse**: Reusing a prior review after manual edits in the worktree would approve unreviewed code.
  - *Mitigation*: Compare exact SHA/fingerprint of working tree + build proof when verifying review evidence; mismatch forces blocker / fresh review.

## Verification

- Tests covering: `build` native `judge` keyed-object request + `noul >= 0.7` acceptance pass/fail + partial change retention; `review` staleness detection on changed fingerprint + actionable findings keeping report and blocking save; `save` pre-apply receipt binding, post-apply crash recovery reusing same attempt revisions without double-apply, and ambiguous save blocking.
- Confirm removal of `judgeBatch` ranking and automatic iterate transitions.
- `npm run guardrails:check` and `npm run subject-lifecycle:check`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
