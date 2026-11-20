---
status: pending
phase: 4
order: 4
plan: plan-migration-followups.md
phases_overview: plan-migration-followups-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Single Bun lockfile, no stray JS remnants."
depends_on: [2]
dependency_type: SOFT
files:
  - bun.lock
  - package-lock.json
  - docs/plans/astro.config.mjs
  - docs/plans/astro.config.ts
from_plan_steps: [1, 2, 3]
acceptance_criteria:
  - "[ ] `bun install --lockfile-only` regenerates bun.lock; `bun install --frozen-lockfile` exits 0"
  - "[ ] package-lock.json deleted (A3 resolved)"
  - "[ ] astro.config.mjs → astro.config.ts; `astro build` still works in docs/plans"
  - "[ ] Stray `.context/turn-memory/turn-memory/[\"/` directory deleted"
  - "[ ] No tracked .js/.mjs sources remain except generated .context artifacts"
completed_at: null
completed_by: null
---

# Phase 4: lockfile and remnants

## Context
Parent goal (inherited): repository clean under the Bun-only runtime. `bun.lock` (2026-11-18) predates today's `package.json` metadata changes; `package-lock.json` was hand-edited. CI runs `bun install --frozen-lockfile`. Remaining JS: `docs/plans/astro.config.mjs` (TS supported) and `.context/2026-05-06…/app.js` (generated artifact, excluded per A4).

**A3 (deferred assumption, this phase validates):** `bun.lock` becomes the single lockfile; delete `package-lock.json`. Validation path: `bun install --frozen-lockfile` clean after regeneration.

SOFT-depends on Phase 2: `astro.config.ts` must typecheck under the widened tsconfig include; can proceed with the current narrower include and re-verify after Phase 2.

## Implementation Details
1. Regenerate `bun.lock` (`bun install --lockfile-only`), verify `bun install --frozen-lockfile` exits 0, delete `package-lock.json` (A3).
2. Convert `docs/plans/astro.config.mjs` → `astro.config.ts`; confirm `astro build` still works.
3. Delete stray `.context/turn-memory/turn-memory/["/` directory.

## Risks
- Lockfile deletion breaks residual npm workflows — CI is already Bun-only; `package.json` has no npm-specific lifecycle left besides `prepublishOnly` (runs `bun run test`).

## Verification
`bun install --frozen-lockfile`; `bun run guardrails:check`; `git ls-files '*.mjs'` shows only generated `.context` artifacts (none after this phase's conversion).

## Per-Phase Execution Loop
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. In-plan `iterate-*.md` → `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. Doc impact flagged → `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
6. If incomplete, leave `status: in-progress` for resume.
