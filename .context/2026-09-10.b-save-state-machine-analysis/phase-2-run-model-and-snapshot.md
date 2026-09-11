---
status: pending
phase: 2
order: 2
plan: plan-b-save-state-machine.md
phases_overview: plan-b-save-state-machine-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Ship the versioned run model, XState v5 topology, and authoritative snapshot layer that every later phase consumes."
files:
  - extensions/b-save/types.ts
  - extensions/b-save/machine.ts
  - extensions/b-save/snapshot.ts
  - extensions/b-save/__tests__
  - extensions/b-save-improved/scripts/save-preflight.ts
  - package.json
  - tsconfig.json
from_plan_steps: [3, 4]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Closed TypeScript/TypeBox contracts exist for run identity, selected subject, advisory session evidence, content hashes, evidence records, semantic proposals, user decisions, complete patch sets, journal progress, external-effect outcomes, and terminal errors."
  - "[ ] Each run persists under `.context/workflow/b-save/<run-id>/`; the manifest stays compact; before-images are retained only as long as recovery requires; unknown schema versions are rejected instead of coerced."
  - "[ ] XState v5 machine defines states, events, guards, retries, resume transitions, and terminal outcomes with pure, unit-testable transitions."
  - "[ ] Snapshot layer migrates the proven containment, slug, status, digest, and parser logic from `save-preflight.ts` into typed functions — ported by invariant and fixture, not wholesale rewrite."
  - "[ ] Subject precedence resolves exactly as researched; loose artifacts move only with explicit provenance; untrusted text is redacted and bounded."
  - "[ ] Every consumed input is hashed and each proposal maps to its input dependencies, so later phases can invalidate only dependent work."
  - "[ ] Focused Vitest suites pass for type round-trips, snapshot functions, and machine transitions."
completed_at: null
completed_by: null
---

# Phase 2: Run Model & Deterministic Snapshot

## Context

Parent plan user goal (inherited): Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

Builds on Phase 1's frozen contract: the run model encodes the frozen flags and resume selector; the snapshot layer enforces the contract's paths and policy. This phase is the foundation every later module consumes. Covers plan steps 3–4.

## Implementation Details

1. **Versioned run model (plan step 3) — `extensions/b-save/types.ts`.** Closed contracts for: run identity, selected subject, advisory session evidence, content hashes, evidence records, semantic proposals, user decisions, complete patch sets, journal progress, external-effect outcomes, terminal errors. Reject unknown schema versions; never coerce. Run persistence layout: `.context/workflow/b-save/<run-id>/`, compact manifest, before-images only while recovery requires them.
2. **State topology (plan step 3) — `extensions/b-save/machine.ts`.** XState v5 states, events, guards, retries, resume transitions, and terminal outcomes. Keep transitions pure so reducer/guard tests need no I/O. Terminal outcomes must distinguish failed model, failed apply, unsupported effect, and completed durable save (the reporting contract Phase 5 relies on).
3. **Snapshot layer (plan step 4) — `extensions/b-save/snapshot.ts`.** Migrate proven logic from `extensions/b-save-improved/scripts/save-preflight.ts` into typed functions:
   - Subject precedence exactly as researched (authoritative status ordering; `current-session.json` is advisory evidence only, validated and staleness-checked, never authoritative).
   - Move loose artifacts only with explicit provenance; enumerate plans/specs/phases/iterates/backlog/index inputs.
   - Redact and bound untrusted text before it can reach Phase 3's model roles.
   - Hash every consumed input; map each proposal to its input dependencies (drives Phase 4's invalidation).
4. **Package wiring.** Make the verified OMP SDK type/runtime dependency explicit in `package.json`/`tsconfig.json` without affecting the legacy prompt path. Capability-gate any OMP-only import so the package still loads on non-OMP harnesses.

## Risks

- **Losing proven edge-case handling from the monolith.** Port behavior invariant-by-invariant with fixtures from `save-preflight.ts` tests; do not rewrite by filename.
- **OMP-first imports breaking Pi package loading.** Keep imports capability-gated and the legacy prompt path independent.
- **Schema drift.** Version every persisted structure now; unknown versions must hard-fail.

## Verification

- Run focused Vitest suites for `extensions/b-save/types`, `machine` (pure transition tests incl. resume), and `snapshot` (subject precedence, provenance moves, redaction, hashing, dependency mapping) plus the ported preflight fixtures.
- Verify a persisted run under `.context/workflow/b-save/<run-id>/` round-trips and that an unknown schema version is rejected.
- Verify package loading still works on a non-OMP path (legacy prompt untouched).

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.

*(Goal mode: if not already active, this phase runs under the goal set in Phase 1's first turn.)*
