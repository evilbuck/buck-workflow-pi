---
status: pending
phase: 6
order: 6
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Implement sealed checkpoint binding, ancestry-proven publication, explicit rewritten-history mapping, integration reconciliation, conflict resolution, and orphan recovery."
files:
  - skills/_shared/storage/
  - extensions/buck-loop/
from_plan_steps: [6]
depends_on: [2, 3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Sealing freezes the exact immutable revision set + hashes; explicit in save/checkpoint flow; post-seal edits and branch drafts never auto-added."
  - "[ ] Automatic promotion only on eligible source checkpoint AND `git merge-base --is-ancestor <anchor> <integration-tip>` success; exit 1 (not merged) distinguished from errors (cannot prove); no automatic network fetch."
  - "[ ] Git fixtures pass: sealed v1 publishes after merge while v2 stays private; inherited/creation-HEAD anchors, old creation ancestor with unmerged body, branch rename/delete/recreate, detached/unborn, stale/missing refs, force-push, patch equivalence, and Git errors never count as proof."
  - "[ ] Squash/rebase stay private until explicit verified mapping (project, exact snapshot hashes, target reachability, mapping evidence); patch-id alone rejected."
  - "[ ] Publication is a versioned integration view: rewritten/revoked evidence removes visibility; revert of code never implicitly deletes knowledge; conflicting independent publications preserve both candidates and the last unambiguous baseline until explicit resolution."
  - "[ ] Branch deletion/orphaning never promotes or destroys state; explicit recovery lists private orphan scopes with provenance; rebinding/export only after selection; new incarnations don't inherit old private artifacts by name."
  - "[ ] Run projections, receipts, import cursors, pass audits, attribution/dedupe remain run/workspace-private after merge."
completed_at: null
completed_by: null
---

# Phase 6: Publication, Reconciliation & Recovery

## User Goal
Technical chore — publication policy; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose durable storage, resume reliably, branch-private unmerged work. Depends on Phase 2 (immutable revisions/checkpoints) and Phase 3 (branch identity, visibility); SOFT on Phase 4 (recovery inspection via CLI preferred). This phase implements the plan's core privacy promise end-to-end. Plan step 6.

## Implementation Details
1. Central checkpoint manifests (file under machine Buck dir or in the selected DB) recording exact revision sets/hashes; seal/bind during save/checkpoint; failed bind leaves the snapshot private and recoverable, never fabricates a commit.
2. Promotion eligibility + ancestry proof with strict exit-code handling; record resolved tips/proof with every publication.
3. Explicit rewritten-history attestation flow for squash/rebase.
4. Versioned integration-view reconciliation against the configured integration tip; conflict-preservation semantics; tombstones/corrections as explicit revisions.
5. Orphan handling: explicit recovery listing, scope selection, rebind/export; no deletion-based promotion or cleanup.

## Risks
- Git ancestry edge cases are the plan's #1 and #2 material risks — the fixture matrix here is the acceptance bar; do not trim it.
- Never auto-fetch from the network during proof.

## Verification
- Full Git fixture matrix from the plan's Verification section (preserved merge/FF, squash/rebase mapping, edit-after-seal, inherited anchor, rename/delete/recreate, detached/unborn, stale/missing refs, force-push, overlapping conflict, code revert).
- Two-project/two-worktree same-name fixture: default tools show no cross-branch leakage.
- `npm run guardrails:check` passes.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
