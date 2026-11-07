---
status: pending
phase: 4
order: 4
plan: plan-b-save-state-machine.md
phases_overview: plan-b-save-state-machine-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Ship deterministic-first evaluation of the twelve save responsibilities and the recoverable, journaled `.context/**` apply."
files:
  - extensions/b-save/machine.ts
  - extensions/b-save/apply.ts
  - extensions/b-save/__tests__
from_plan_steps: [6, 7]
depends_on: [2, 3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] All twelve responsibilities are encoded as deterministic rules that either return a closed result or raise a typed `NeedsJudgmentError`."
  - "[ ] Only expected semantic uncertainty routes to a Phase 3 role; citations and transitions are validated deterministically afterward."
  - "[ ] Containment, schema, stale-input, I/O, and programmer errors are hard deterministic failures that never reach a model."
  - "[ ] User decisions are preserved as explicit gates for multiple eligible subjects and inferred backlog changes."
  - "[ ] Apply composes one full patch: memory content, explicit cross-references, backlog archive/create deltas, spec/phase/iterate status changes, phase-overview projection repairs, canonical memory-index upserts, subject-index updates, and artifact moves."
  - "[ ] The whole patch is validated before any write; dependent hashes are rechecked pre-apply; before-images and per-file progress are journaled; files are replaced atomically."
  - "[ ] A simulated mid-apply failure recovers via resume or rollback with no silent partial success."
  - "[ ] Pre-apply drift invalidates and reruns only dependent work."
  - "[ ] Reruns produce no duplicate headings, links, memory-index entries, archive summaries, or backlog rows."
  - "[ ] All writes are constrained to validated `.context/**` targets; apply aborts on any changed before-image; failure-injection and idempotency tests pass."
completed_at: null
completed_by: null
---

# Phase 4: Deterministic Evaluation & Journaled Apply

## Context

Parent plan user goal (inherited): Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

The heart of the engine. Consumes Phase 2's snapshot/hashes and Phase 3's bounded roles; produces validated patch sets that Phase 5 reports and delivers. Covers plan steps 6–7. The responsibility matrix in `research-b-save-state-machine.md` is the authoritative boundary table for step 6.

## Implementation Details

1. **Deterministic-first evaluation (plan step 6) — `extensions/b-save/machine.ts`.** Encode the twelve responsibility contracts (research matrix, responsibilities 1–12) as deterministic rules:
   - Each rule returns a closed result, or raises a typed `NeedsJudgmentError` routed to the matching Phase 3 role (scribe → memory authoring/backlog semantics; evidence auditor → spec/phase/iterate non-mechanical criteria; goal classifier → semantic user-goal near-matches).
   - Validate role citations and state transitions deterministically after every model return.
   - Preserve user gates: selection among multiple eligible subjects; approval of inferred backlog completions and new/deferred items.
   - Deterministic fast paths: subject precedence, cross-reference stitching from explicit frontmatter/provenance only, canonical memory-index upsert keyed by filename, spec/phase status with consistently checked criteria, exact-syntax goal check.
   - Hard failures (schema, containment, stale snapshot, I/O, programmer errors) never reach a model.
2. **Recoverable apply (plan step 7) — `extensions/b-save/apply.ts`.**
   - Compose the complete patch from validated state (list in acceptance criteria above).
   - Validate the whole patch before writing; recheck dependent hashes immediately before apply.
   - Write-ahead journal: before-images plus per-file progress; atomic per-file replacement (temp file + rename).
   - Resume/rollback after interruption; abort on any changed before-image; constrain every write to validated `.context/**` targets; reject symlink/path escapes.
   - Idempotent reruns: canonical upserts, no duplicate index entries/links/headings/archive summaries/backlog rows.

## Risks

- **Journal recovery corrupting unrelated work** if path or freshness checks are incomplete — validate containment on every target and abort on changed before-images.
- **Semantic leakage**: any new uncertainty added to a rule must justify why it cannot be deterministic; default is a hard failure, not a model call.
- **Duplicate-on-rerun regressions**: the 2026-08-26 parity work hardened idempotency; port those fixtures.

## Verification

- Run focused Vitest suites: responsibility evaluation (closed results, `NeedsJudgmentError` routing, deterministic hard failures), reducer/guard transitions, apply validation, journal recovery with injected mid-apply failure, rerun idempotency, hash-invalidation (changed input → only dependent proposals rerun).
- Run integration fixtures in temporary repositories covering subject selection gates, backlog user gates, canonical index upsert, and provenance-based moves.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.

*(Goal mode: if not already active, this phase runs under the goal set in Phase 1's first turn.)*
