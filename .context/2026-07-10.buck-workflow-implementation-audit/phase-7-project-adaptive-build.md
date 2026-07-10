---
status: pending
phase: 7
order: 7
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; portable repository discovery and behavioral verification policy
buck_hint: /b-build-hard
goal: "Make b-build discover each target project's actual verification and UI/server boundaries."
files:
  - skills/_shared/project-verification-discovery.md
  - skills/b-build/SKILL.md
  - skills/b-build-hard/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-phase/SKILL.md
from_plan_steps: [7]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] b-build names frameworks and commands only after discovering target-repo evidence"
  - "[ ] Non-UI JS/TS work does not automatically require Playwright, a browser, or a dev server"
  - "[ ] UI/browser/server verification follows detected framework and project scripts"
  - "[ ] Current repository still resolves to its configured Vitest/Playwright surfaces through discovery"
  - "[ ] Canonical skill instructions use native harness file/search tools rather than hardcoded shell discovery"
completed_at: null
completed_by: null
---

# Phase 7: Project-adaptive Build Discovery

## Context

**Inherited parent goal**: Buck Workflow users can apply the portable build skill to arbitrary repositories without inheriting this repository's test stack or UI assumptions.

The canonical `b-build` currently hardcodes Vitest, Playwright, npm scripts, tmux, localhost:3000, and “any JS/TS is UI.” This phase separates behavioral/TDD invariants from project-specific discovery. Phase 3 lands the final closeout wording first to avoid competing edits in `b-build`.

## Implementation Details

1. Add one shared project-verification discovery protocol: inspect project context, manifest/scripts, test configs, browser/e2e configs, framework/layout, existing tests, and documented dev-server conventions using harness-native read/glob/search tools.
2. Classify work by observable boundary, not extension:
   - rendered UI/browser interaction;
   - service/API/CLI/library/backend;
   - infrastructure/config/docs;
   - mixed work requiring more than one verification layer.
3. Select focused unit/integration/browser/e2e checks only from configured project evidence. Never prescribe a tool absent from the repo.
4. Start a dev server only when the observable contract requires a running app and a discovered command exists. Reuse existing server-process skills; do not hardcode tmux/localhost in the portable core.
5. Retain TDD, deterministic testing, user-observable contracts, and focused smoke requirements independent of framework.
6. Update `b-review` claim-scope verification wording to consume discovered surfaces.
7. Replace `b-phase`'s shell `ls|head` discovery examples with native tool-neutral instructions.
8. Exercise at least two repo shapes: this repository and a minimal non-UI JS/TS service/CLI fixture. Add a UI fixture only if needed to prove boundary selection.

## Risks

- **Vague discovery becomes no verification**: discovery must always end in a concrete focused command or an explicit manual behavioral scenario.
- **Over-general abstraction**: one checklist/shared contract is enough; no framework plugin system.
- **False UI negatives**: detect rendering/framework/routes/components and plan acceptance, not only filenames.
- **Server lifecycle leakage**: use the project's existing server management convention and stop/hand off cleanly.

## Verification

- In this repo, discovery finds `vitest`, Playwright scripts/config, and the actual relevant focused test.
- In a non-UI JS/TS fixture, discovery selects its unit/integration path and does not require browser/server work.
- In a UI fixture, discovery selects configured browser tooling and the discovered server command/URL.
- A repo with no tests receives a focused behavioral smoke and an explicit gap; no fake test command is invented.
- Review the generated b-build flow end-to-end for no hardcoded `localhost:3000`, unconditional Playwright, npm-only, or tmux-only requirement.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Exercise the repository-shape scenarios before review.
3. Run `/b-review` against this exact phase file.
4. Iterate in-plan discovery defects and repeat the relevant scenario.
5. Run `/b-docs` if documentation impact is flagged.
6. Run `/b-save`, stage implementation and durable artifacts, then `/b-commit`.
7. If any supported scenario lacks a concrete verification path, leave `status: in-progress`.
