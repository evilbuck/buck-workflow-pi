---
status: completed
phase: 7
order: 7
plan: plan-b-pr-manager.md
phases_overview: plan-b-pr-manager-phases.md
difficulty: medium
model_hint: capable general model; integration proof, living docs, and guardrails — no live PR merge
buck_hint: /b-build
goal: "Prove the primary paths against fake gh and fixtures, document the narrow orchestration boundary, and pass the repository guardrails contract."
files:
  - extensions/b-pr-manager/__tests__/integration.test.ts
  - skills/fix-pr/SKILL.md
  - README.md
  - docs/buck-workflow.md
  - docs/extension-loading.md
  - docs/adr/0001-narrow-pr-manager-orchestration.md
from_plan_steps: [8, 9, 10]
depends_on: [6]
dependency_type: HARD
acceptance_criteria:
  - "[x] Integration tests cover all six primary paths from the plan with fake `gh` and deterministic role fixtures"
  - "[x] Extra gate cases exist: check failure, draft PR, changes-requested, disabled auto-merge, poll exhaustion, cancellation, restart without duplicate mutations"
  - "[x] `/b-pr-improved` external behavior remains covered"
  - "[x] `skills/fix-pr/SKILL.md` documents the shared taxonomy and points OMP users at `/b-pr-manager` without removing the portable fallback"
  - "[x] README describes command purpose, safe defaults, resume, and explicit non-goals; table inserts do not truncate the file tail"
  - "[x] `docs/buck-workflow.md` states the narrow invoked-machine boundary vs deprecated `b-flow`"
  - "[x] ADR `docs/adr/0001-narrow-pr-manager-orchestration.md` records why this machine exists and general orchestration stays deprecated"
  - "[x] `/b-guardrails-check` passes lint, tests, coverage, patch coverage, and complexity with no overrides"
  - "[x] Smoke: run the registered command in a temp repo with fake GitHub transport and deterministic roles; inspect progress, checkpoint, git history, remote head, and terminal MERGED record"
  - "[x] No automated test merges a real GitHub PR"
completed_at: 2026-09-10
completed_by: b-build
---

# Phase 7: Safety proof, docs, and smoke

## Context

Parent user goal: a developer can run one OMP command on an open pull request and have valid review feedback fixed, verified, rebased, pushed, and merged without babysitting.

Closes plan steps 8–10 after the command exists. Docs must not invent extra approval rules or success definitions.

## Implementation Details

1. Fill `integration.test.ts` (and any remaining machine/github/model gaps) for:
   - Valid feedback → fix → review → verify → commit → push → new comment → second round → green gates → auto-merge → MERGED.
   - No actionable comments → holistic Buck review → gates → MERGED.
   - Invalid/already-done comments → no source edit, still holistic review + verify.
   - Conflict → bounded resolution → continue rebase → re-review/reverify → lease push.
   - Check failure, draft, changes-requested, disabled auto-merge, exhaustion, cancel, `--resume`.
2. Keep machine/service functions under the complexity ceiling; refactor rather than override.
3. Documentation:
   - `README.md`: command row + purpose/resume/non-goals. Re-read the file tail after any table insert so trailing sections are not clobbered.
   - `docs/buck-workflow.md`: narrow orchestration; not a revival of `b-flow`.
   - `docs/extension-loading.md` only if current structure requires a registration/lifecycle note.
   - First ADR at `docs/adr/0001-narrow-pr-manager-orchestration.md` (no `docs/adr/` yet).
   - `skills/fix-pr/SKILL.md`: shared validation taxonomy; OMP autonomous convergence → `/b-pr-manager`; portable/manual fallback remains.
4. Run `/b-guardrails-check`. A fail blocks completion.
5. Smoke the real registered command in a temporary repository with fake `gh` and deterministic roles. Exercise fix/push/new-comment/review/check/auto-merge/resume. Do not merge a live PR; a canary needs explicit later authorization.

## Risks

- README table insert deletes the file tail (known 2026-09-04 failure). Re-read tail after edit.
- Guardrails patch/complexity fail from earlier phases. Fix here; do not rebaseline.
- Docs implying the manager posts replies, dismisses reviews, or admin-merges. Those stay out of scope.

## Verification

- Guardrails verdict `status: pass`.
- Integration + existing b-pr-improved tests green.
- Smoke log shows MERGED only after a fake GitHub `state=MERGED` read.
- README still contains the sections that follow the catalog tables (Hybrid Context Indexes / Requirements / License or current tail).

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress`.

`omp_execution` is omitted (`none`). No first-turn keyword or `/goal set`.
