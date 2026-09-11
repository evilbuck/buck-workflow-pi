---
status: pending
phase: 5
order: 5
plan: plan-b-pr-manager.md
phases_overview: plan-b-pr-manager-phases.md
difficulty: hard
model_hint: strongest available model; prompt-injection, schema binding, and exact-head review are failure-sensitive
buck_hint: /b-build-hard
goal: "Ship schema-bound validator/planner/builder/reviewer/conflict actors and the Buck fix-round controller without letting model output choose git, GitHub, or merge readiness."
files:
  - extensions/b-pr-manager/model.ts
  - extensions/b-pr-manager/buck-loop.ts
  - extensions/omp-models.ts
  - extensions/b-pr-manager/__tests__/model.test.ts
from_plan_steps: [5, 6]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Five roles exist: validator, planner, builder, reviewer, conflict — each returns versioned JSON matching Phase 1 schemas"
  - "[ ] Malformed output retries once with validation errors; second failure is a typed block, not a guessed parse"
  - "[ ] Review comments are quoted untrusted data; they cannot grant tools, alter policy, or authorize external actions"
  - "[ ] Each role has a minimum tool allowlist; builder cannot run git/gh; reviewer is read-only"
  - "[ ] `omp-models.ts` accepts `AbortSignal`, supports schema-validated structured sessions, and disposes child sessions"
  - "[ ] One traceable iteration artifact per feedback round under `.context/<date>.pr-<number>-feedback/`"
  - "[ ] Reviewer verdict binds to exact head OID + worktree diff digest; OID change invalidates it"
  - "[ ] In-scope review findings return to planning; `unsure`, large valid scope, or structural blockers become `blocked`"
  - "[ ] Holistic `buck_review` still runs when no comment is actionable; a comment-specific pass is not a substitute"
  - "[ ] Local check-contract resolution is invoked before any commit/push recommendation; this phase does not commit or push"
completed_at: null
completed_by: null
---

# Phase 5: Model actors and Buck fix rounds

## Context

Parent user goal: a developer can run one OMP command on an open pull request and have valid review feedback fixed, verified, rebased, pushed, and merged without babysitting.

This is the `[L]` / `[H]` ownership slice. Deterministic code still chooses the next event. Can start after Phase 1; git/GitHub adapters are faked in tests.

## Implementation Details

1. Extend `extensions/omp-models.ts`:
   - Thread `AbortSignal` into nested sessions.
   - Structured output validated against a runtime schema.
   - Guaranteed disposal on success, failure, and cancel.
   - Keep existing callers working.
2. Implement `model.ts` roles (prompt text treats review comments as quoted data):
   - **validator**: classify each feedback version with file/line evidence; group semantic duplicates; nits that are valid locally are actionable.
   - **planner**: write/update the round's Buck iteration artifact with feedback IDs, evidence, bounded changes, acceptance criteria, verification commands. No source edits.
   - **builder**: nested session with code tools only; expected paths recorded before run; inspect diff after.
   - **reviewer**: separate read-only session; `reviewing` for a fix round, `buck_review` for the holistic pass.
   - **conflict**: receives only unresolved paths + both-side context; does not run git.
3. Validation: parse JSON → schema check → one retry with errors → `blocked`.
4. Implement `buck-loop.ts`:
   - Materialize `.context/<date>.pr-<number>-feedback/iterate-pr-<number>-round-<n>.md`.
   - Sequence: plan → build → independent review → (iterate in-scope) or verify.
   - Record expected vs actual paths; unrelated edits, placeholders, no-progress, or destructive ops → `blocked`, preserve edits.
   - Bind review/verification attestations to head OID + diff digest.
   - Resolve the target repo's deterministic check contract (same resolution order as AGENTS.md) and record commands/exit codes. Do not weaken gates.
5. Tests in `model.test.ts`:
   - Schema accept/reject; one retry; second-failure block.
   - Cancellation disposes the child session.
   - Tool allowlists.
   - Prompt-injection fixture: comment text that tries to grant tools / skip review is inert.
   - Builder fixtures: expected files, unrelated files, no progress, placeholders.
   - Exact-head binding: changed OID rejects a stale pass.
6. Do not commit, push, enable auto-merge, or register `/b-pr-manager`.

## Risks

- Model claims "done" and later phases trust it. Only schema + diff + check contract matter; merge readiness is forbidden here.
- Prompt injection via review comments. Quote as data; lock tools; keep mutations deterministic in other modules.
- `omp-models.ts` breakage for existing extensions. Update `extensions/omp-models.test.ts` and any createAgentSession callers that need the new optional abort/schema args.

## Verification

- `vitest` `extensions/b-pr-manager/__tests__/model.test.ts` and `extensions/omp-models.test.ts`.
- Confirm no `git`/`gh` imports in `model.ts`.
- Confirm `buck-loop.ts` never calls push/merge.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress`.

`omp_execution` is omitted (`none`). No first-turn keyword or `/goal set`.
