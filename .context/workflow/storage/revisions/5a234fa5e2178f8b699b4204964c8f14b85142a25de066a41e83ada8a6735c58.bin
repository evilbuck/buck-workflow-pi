---
status: completed
phase: 4
order: 4
plan: plan-state-machine-module-cutover.md
phases_overview: plan-state-machine-module-cutover-phases.md
difficulty: medium
model_hint: capable general model; mechanical deletions plus a full site-guide rewrite with live verification
buck_hint: /b-build
goal: "Delete the old engine, point every living doc and the site guide at extensions/state_machine/, and finish with a full green check."
files: [extensions/state-machine.ts, extensions/state-machine.test.ts, docs/state-machine.md, docs/adr/0002-observably-invoked-happy-path-loop.md, docs/extension-loading.md, extensions/code-review-iteration/personas/correctness.md, site/guides/state-machine.html, site/index.html]
from_plan_steps: [15, 16, 17, 18]
depends_on: [2, 3]
dependency_type: HARD
acceptance_criteria:
  - "[x] A-5 consumer search re-run: repo search (excluding historical paths) finds no reference to state-machine.ts / ../state-machine.js after deletion"
  - "[x] extensions/state-machine.ts and extensions/state-machine.test.ts deleted"
  - "[x] ADR 0002 amended (engine replaced by extensions/state_machine/; still one engine; supervisor still the only effect interpreter)"
  - "[x] docs/state-machine.md is a short pointer to extensions/state_machine/README.md; docs/extension-loading.md and personas/correctness.md reference the new module"
  - "[x] site/guides/state-machine.html rewritten for the new API (same eight-step recipe shape, complete copyable files, exact expected output verified by running them); site/index.html links updated"
  - "[x] npm test green; npm run guardrails:check passes (coverage ≥ baseline, no CCN > 10 in new code)"
completed_at: "2026-10-01T15:52:47.704Z"
completed_by: b-build
---

# Phase 4: Delete Old Engine and Update Docs

## Context

Parent User Goal: one engine before, one engine after (ADR 0002) — the module is the only state machine, and all living docs describe it.

**Assumption note:** A-5 (no consumers beyond the known list) was validated pre-plan; this phase re-runs the consumer search immediately before deletion. Historical artifacts (`.context/**`, `presentations/**`, `docs/brainstorms/**`) are left as-is.

## Implementation Details

15. Re-run the A-5 consumer search (`rg` excluding `.context/**`, `node_modules/**`); delete `extensions/state-machine.ts` and `extensions/state-machine.test.ts`.
16. Docs: ADR 0002 amendment; `docs/state-machine.md` → short pointer to `extensions/state_machine/README.md`; `docs/extension-loading.md:168` path/wording; `personas/correctness.md` reference.
17. Rewrite `site/guides/state-machine.html` for the new API (same eight-step recipe shape, complete copyable files, exact expected output verified by running them); update `site/index.html` links/wording.
18. Run `npm run guardrails:check`.

## Risks

- Coverage ratchet drop (baseline 84) when the old suite is deleted → module behavior tests landed in Phase 1 before this deletion; never lower the baseline.
- Stale guide examples → run the guide's copyable files and compare against the printed expected output.

## Verification

- Consumer search clean after deletion
- `npm test`; `npm run guardrails:check`
- Serve `site/` (`npm run site:serve`) and check the guide page renders

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues → separate `/b-plan` → `/b-build` follow-up. Doc impact → `/b-docs` before `/b-save`.
4. Run `/b-save`, then `/b-commit`.
5. If incomplete, leave `status: in-progress`.
