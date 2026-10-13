---
status: pending
phase: 7
order: 7
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Implement scoped read-only export/import with retained IDs/links/history/bytes, legacy quarantine, dry-run verification, and atomic backend switching with interrupted-cutover and rollback recovery."
files:
  - skills/_shared/storage/
  - skills/b-memory-import/
  - docs/sql-memory.md
from_plan_steps: [7]
depends_on: [6]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Scoped export/import preserves IDs, content hashes, binary files, links, scoped corrections, ranks, and lifecycle provenance byte-exact."
  - "[ ] Legacy records lacking exact branch/revision/merge evidence are quarantined into an explicit recovery/import scope — no guessing, no deletion (A-5 handling)."
  - "[ ] Dry-run verification reports the full before/after record set; atomic cutover switches config with source verification; read-only source; no source deletion."
  - "[ ] Interrupted-import fixture: restart resumes via recorded cursor, no duplicates, no partial visibility."
  - "[ ] Post-cutover rollback: new writes on the destination are recoverable via the same export/import route before rollback to the verified pre-cutover source snapshot."
  - "[ ] Obsolete normal storage branches/protocols removed only after all callers are migrated; legacy SQL env diagnosed (doctor) without silent backend adoption."
  - "[ ] Config redaction checks: credentials never in config text or export output; generated private state documented as excluded."
completed_at: null
completed_by: null
---

# Phase 7: Existing-Data Cutover

## User Goal
Technical chore — migration; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose durable storage, resume reliably, branch-private unmerged work. Requires all adapters plus Phase 6 publication/visibility evidence so migrated records keep correct publication status. Plan step 7.

## Implementation Details
1. Export: read-only, scoped by project/branch/scope selection, carries IDs/hashes/lineage/attachment bytes/importer manifests.
2. Import: destination verification, expected-revision checks, legacy quarantine for ambiguous provenance, preserved memory IDs/categories/ranks/correction history (PG mapping from Phase 2).
3. Cutover: dry-run diff report → explicit atomic switch (config write + destination verification) → old path removal after caller audit.
4. Recovery: interrupted cutover resume via recorded cursor; post-cutover write rescue before rollback; backup/restore snapshot path per adapter.
5. Doctor identifies legacy `SQL_MEMORY_URL`-style configuration and reports migration path without silently changing policy.

## Risks
- Material risk 4 (lost corrections/links/receipts/attachments) — the interrupted-cutover and rollback fixtures are mandatory, not optional.
- Rollback with post-cutover writes must supersede, not duplicate, memory rows (same `previousId` lesson as the receipt-subject work).

## Verification
- Round-trip export/import with post-cutover writes: field-by-field artifact comparison including binaries and link graph.
- Interrupted import mid-batch: restart, verify no duplicates/partial state.
- Cutover crash between config write and verification: rollback to pre-cutover snapshot works.
- `npm run guardrails:check` passes.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
