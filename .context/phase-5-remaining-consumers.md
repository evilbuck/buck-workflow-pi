---
status: pending
phase: 5
order: 5
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
goal: "Migrate every remaining Buck-owned durable consumer (save pipelines, loop persistence, hooks, attribution, import manifests, retained packages, plan-site reader) onto the storage contract, keeping host-owned data untouched."
files:
  - extensions/buck-loop/
  - extensions/b-save-improved/
  - skills/b-save-improved/scripts/
  - extensions/turn-memory/
  - hooks/post/turn-memory.ts
  - extensions/plan-artifact.ts
  - extensions/token-attribution/
  - extensions/code-review-iteration/
  - skills/b-memory-import/
  - docs/plans/src/lib/plans/
from_plan_steps: [5]
depends_on: [4]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Both save pipelines (buck-loop and b-save-improved preflight/apply) write same-adapter batches/attempt receipts through one storage contract."
  - "[ ] Loop resume/scan/checkpoint/activity, review pass artifacts/state, post-turn memory hook, Buck attribution and dedupe records, and import manifests all persist via the service; run-private scope retained after branch merge."
  - "[ ] Retained presentation packages and attachments adapter-backed (binary intact); generated presentation exports may remain user deliverables."
  - "[ ] Plan-site reader (docs/plans/src/lib/plans/) reads adapter-backed source through its existing reader seam; fake SQL stub removed once replaced; no UI redesign."
  - "[ ] Host-owned OMP session/stats/LTM rows untouched; no LTM mirroring of unmerged knowledge."
  - "[ ] Persistence inventory from Phase 1 fully reconciled: every listed path migrated or explicitly verified unchanged."
completed_at: null
completed_by: null
---

# Phase 5: Remaining Durable Consumers

## User Goal
Technical chore — consumer migration; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose durable storage, resume reliably, branch-private unmerged work. Needs the Phase 4 native/CLI surface. Plan step 5. Execution policy in code-review-iteration is unchanged — only its retained persistence moves.

## Implementation Details
1. Migrate both save pipelines and loop persistence (scan, persist, project-memory, save/checkpoint, subject picker evidence) to the service; retain machine rules (never-invent, repairing-state) untouched.
2. Migrate hooks (`hooks/post/turn-memory.ts`, `extensions/turn-memory/`), `extensions/plan-artifact.ts`, Buck-owned `extensions/token-attribution/` persistence (never host stats/session rows).
3. Migrate `extensions/code-review-iteration/` pass/state/report persistence; immutable pass artifacts semantics preserved under the adapter.
4. `b-memory-import` manifests and retained presentation/attachment outputs through export/import ops; mirror only published knowledge into harness LTM.
5. Connect plan-site reader to adapter-backed source via the existing seam; remove the fake SQL stub; no UI work.

## Risks
- Broad file spread but mechanical per-slice once the contract exists — this is why it is medium, not hard.
- `promisify(execFile)` convention required (no `node:child_process/promises` on this machine).

## Verification
- Focused scenarios per state kind: presentation attachment round-trip, retained pass audit, hook memory write, attribution/import cursor — read back exact IDs/revisions.
- Two-worktree fixture: concurrent runs never share mutable resume pointers.
- `npm run guardrails:check` passes.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only (escalate to `/b-build-hard` if ambiguity appears).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
