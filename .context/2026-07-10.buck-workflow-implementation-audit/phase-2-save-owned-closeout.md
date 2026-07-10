---
status: pending
phase: 2
order: 2
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; atomic multi-artifact closeout and backlog transition
buck_hint: /b-build-hard
goal: "Make b-save the sole deterministic closer of accepted workflow state."
files:
  - skills/b-save/SKILL.md
  - prompts/b-save.md
  - commands/b-save.md
  - skills/_shared/lifecycle-artifacts.md
  - skills/_shared/subject-resolution.md
  - skills/b-build/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-phase/SKILL.md
from_plan_steps: [2]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] b-save closes a unit only when a matching valid review-pass exists and no active iterate blocks it"
  - "[ ] Intermediate phase closeout completes the phase/overview row and promotes exactly the next backlog item while the subject stays active"
  - "[ ] Final phase or non-phased closeout completes plan/spec/overview, subject index, and current session memory"
  - "[ ] Missing or stale review-pass leaves work and memory active instead of inferring completion"
  - "[ ] prompts/b-save.md is a thin wrapper over the canonical skill"
completed_at: null
completed_by: null
---

# Phase 2: Save-owned Closeout Transaction

## Context

**Inherited parent goal**: Buck Workflow users can close accepted work durably without plans, subjects, memories, or queued phases drifting apart.

Phase 1 provides a durable verdict. This phase consumes it as a transaction. `b-save`—not build, review chat, checked boxes, or a plugin—owns state mutation and next-phase promotion. It also resolves the current split authority where `prompts/b-save.md` contains the real procedure and the canonical skill only summarizes it.

## Implementation Details

1. Move the complete executable save contract into `skills/b-save/SKILL.md`; reduce `prompts/b-save.md` to the repository's normal thin-loader shape. Preserve the OMP command mirror.
2. Resolve the exact target through explicit/current subject context. Require a matching, valid review-pass and reject an active iterate for the same target.
3. Intermediate phased closeout, atomically and idempotently:
   - mark the phase `completed`, set completion metadata, and check only verified acceptance criteria;
   - update exactly the matching overview row;
   - complete/archive the phase backlog item;
   - expose exactly the next dependency-ready phase in `todo.md`;
   - complete the current session memory;
   - keep overview/frontmatter and subject index `active` while later phases remain.
4. Final phase or non-phased closeout:
   - complete the accepted plan/spec/overview;
   - complete the subject `index.md` only when no active unit remains;
   - complete current memory and consumed review-pass;
   - create no next-phase queue entry.
5. Interrupted/pre-pass save leaves phase/plan/subject active and memory active. Never infer acceptance from checked boxes alone.
6. Record pass-with-out-of-plan-follow-up as accepted current work; create/link a separate backlog or plan without reopening the accepted unit.
7. Make QMD explicitly optional-if-installed. Save must not fail because QMD is absent.
8. Emit a precise post-save changed-path/staging checklist for Phase 3's explicit stage gate.
9. Add fixture smokes for intermediate, final, and refused closeout; run twice to prove idempotency.

## Risks

- **Partial writes**: several files change together. Define write order and recovery so rerunning save converges without double-promoting or duplicate archive entries.
- **Subject closes too early**: completion is based on all active plan/spec/phase/iterate units, not the current phase alone.
- **Backlog duplication**: promotion uses stable phase item paths and dependency state; no duplicate checkbox on rerun.
- **Memory semantics**: current session memory may complete while its subject remains active for later phases.

## Verification

- Intermediate fixture: Phase 1 pass + Phase 2 pending; save completes Phase 1/overview row, archives its backlog item, exposes Phase 2 once, completes memory, and leaves subject active.
- Final fixture: final pass closes phase, overview, parent plan/spec, subject index, memory, and review-pass.
- Refusal fixtures: missing pass, stale fingerprint, or active iterate leaves all completion state unchanged.
- Run save twice on the same accepted unit: no duplicate backlog, archive, memory-index, or cross-reference entries.
- Read `prompts/b-save.md` and OMP command resolution: the skill is the only procedural authority.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Run `/b-review` against this exact phase file.
3. If review creates an in-plan iterate artifact, run `/b-iterate`, then re-run review. Route out-of-plan findings separately.
4. Run `/b-docs` if documentation impact is flagged.
5. Run the newly canonical `/b-save`; inspect its closeout and changed-path checklist.
6. Explicitly stage the implementation and durable artifacts.
7. Run `/b-commit` for this phase only.
8. If incomplete, leave `status: in-progress` and do not promote Phase 3.
