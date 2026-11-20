---
status: pending
phase: 2
order: 2
plan: plan-migration-followups.md
phases_overview: plan-migration-followups-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
goal: "Drive `bun --bun tsc --noEmit` to zero errors with tsconfig including scripts/**/*."
depends_on: []
dependency_type: NONE
files:
  - tsconfig.json
  - skills/b-auto-fix/scripts/auto-fix.test.ts
  - extensions/fix-pr-feedback/__tests__/index.test.ts
  - skills/b-memory-import/scripts/import-context-memory.test.ts
  - skills/b-auto-fix/scripts/auto-fix.ts
  - extensions/workflow-state/confined-fs.test.ts
  - skills/b-loop/scripts/recovery.ts
  - scripts/serve-presentations.ts
  - scripts/context-artifacts.test.ts
from_plan_steps: [1, 2, 3, 4]
acceptance_criteria:
  - "[ ] A1 resolved with measured blast radius: @types/bun fallout measured against scoped declarations; smaller option chosen and recorded in session memory"
  - "[ ] `bun --bun tsc --noEmit` exits 0 with tsconfig include widened to `scripts/**/*`"
  - "[ ] No `@ts-nocheck` and no assertion-based narrowing hacks introduced"
completed_at: null
completed_by: null
---

# Phase 2: zero TypeScript diagnostics

## Context
Parent goal (inherited): the repository typechecks clean under the Bun-only runtime. Fresh measurement (2026-11-20): `bun --bun tsc --noEmit` → 165 errors, concentrated in ~25 files. Current tsconfig include excludes most of `scripts/`; a wide run also showed `scripts/context-artifacts.test.ts` (~6) and `scripts/serve-presentations.ts` (1, untyped `Bun` global).

**A1 (deferred assumption, this phase validates):** Bun type strategy for `bun:test` files. Recommended: scoped declarations or a dedicated tsconfig for Bun-only suites — repo memory records that repo-wide `@types/bun` flips `ReturnType<typeof setTimeout>`/`NodeJS.Timeout` inference in extension files. Validation path: measure the error delta of repo-wide adoption; if fallout ≤ ~10, adopt repo-wide instead of scoped declarations. Record the measured decision in session memory.

## Implementation Details
1. Resolve A1: measure `@types/bun` fallout vs scoped declarations; pick the smaller blast radius.
2. Fix errors in descending concentration: auto-fix.test.ts (58), fix-pr-feedback index.test.ts (19), memory-import tests (12), auto-fix.ts (8), confined-fs.test.ts (7), recovery.ts (6), remainder (~55).
3. Re-widen tsconfig include to `scripts/**/*`; fix `serve-presentations.ts` (`Bun` global via structural declaration, pack.ts precedent) and `context-artifacts.test.ts`.
4. No `@ts-nocheck`; no assertion-based narrowing hacks. Pre-existing 155-error HEAD baseline diagnostics in untouched files are tolerated; the target is exit 0 under the widened include.

## Risks
- Test-file typing churn can mask real defects — keep fixes minimal and mechanical; do not restate test logic in mocks.

## Verification
`bun --bun tsc --noEmit` exits 0; `bun run guardrails:check`; `npm test` still green.

## Per-Phase Execution Loop
1. Run `/b-build` (escalate to `/b-build-hard` if A1 ambiguity expands) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
6. If incomplete, leave `status: in-progress` for resume.
