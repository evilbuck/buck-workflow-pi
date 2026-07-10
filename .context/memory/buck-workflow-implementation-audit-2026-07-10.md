---
date: 2026-07-10
domains: [research, docs, buck-workflow, architecture]
topics: [whole-system-audit, lifecycle, prompts, skills, artifact-contracts, phase-state, review-evidence, b-save, b-commit, omp-eval, portability, documentation-drift]
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/index.md
  - .context/2026-07-10.buck-workflow-implementation-audit/research-workflow-implementation-audit.md
  - .context/backlog/items/reconcile-buck-workflow-contracts.md
  - .context/backlog/items/plan-implementation-ledger.md
  - .context/backlog/items/b-loop-skill-and-mirror.md
priority: high
status: completed
subject: 2026-07-10.buck-workflow-implementation-audit
artifacts:
  - .context/2026-07-10.buck-workflow-implementation-audit/index.md
  - .context/2026-07-10.buck-workflow-implementation-audit/research-workflow-implementation-audit.md
  - .context/2026-07-10.buck-workflow-implementation-audit/research/notes-workflow-implementation-audit.md
  - .context/backlog/items/reconcile-buck-workflow-contracts.md
  - .context/backlog/todo.md
---

# Buck Workflow Whole-System Implementation Audit

## Scope

Read-only b-explore audit of Buck Workflow's canonical skills, prompt/command surfaces, primary and harness documentation, lifecycle transitions, context schemas/validator, wired extension, OMP loop integration, and supporting entrypoints.

## Architecture assessment

The three-layer design remains good: canonical skills, thin agent-native wrappers, and minimal runtime hooks backed by durable `.context/` state. The core loop is conceptually coherent:

`build → review → iterate if in-plan defects → review → docs if impact → save → stage → commit`

Strong parts include b-build-hard's parameterized reuse, b-review's issue routing, the mostly-correct prompt/command symlink mirror, user-toggled OMP modes, and the explicit deprecation of extension-owned b-flow orchestration.

## Load-bearing findings

1. `b-build` completes Phase N before review. No-argument `b-review` then resolves Phase N+1. Phase completion must become review-owned or review-evidenced.
2. Passing review leaves no durable artifact. Save/commit cannot prove the review gate passed; the existing implementation-ledger backlog item is the right foundation.
3. `b-save` is declared the subject completer but does not set plan/subject index status to completed or own deterministic next-phase backlog promotion.
4. The canonical save→commit flow omits staging even though git-commit refuses to stage. Draft selection also bypasses subject resolution and can skip diff analysis using a stale draft.
5. b-plan's executable workflow eval template targets OMP 15.10 (`llm`, `agent_type`, imported prelude). Current OMP 16.3.15 exposes `completion`, `agent=`, and injected helpers; a live smoke confirmed `llm` is undefined.
6. b-plan still uses the package's always-present `omp` manifest field as possible runtime detection, contradicting b-loop's corrected rule.
7. b-build is not portable: Vitest/Playwright/npm/localhost/tmux/repo-specific layout are hardcoded, and all JS/TS is treated as UI. Mandatory approval also blocks autonomous plan execution.
8. Artifact validation recognizes only memory, subject index, research, generic plan, and backlog item. Phase/spec/iterate artifacts are invisible; plan-*-phases is misclassified as a generic plan.
9. The installable bootstrap's “three universal statuses” contradicts memory and phase vocabularies.
10. Primary workflow diagrams reuse Mermaid IDs and omit the final commit; README partial flows contradict durable closeout and include b-plan→b-review even though b-review does not review plans.
11. Loading docs/counts and cross-platform skill guidance are stale; the latter describes removed b-save/b-mode/b-restrict extension behavior.
12. Supporting surfaces have real holes: b-auto-fix stages work but never executes agents/commits, b-grill-auto delegates to an unwired command and missing helper, and b-blueprint advertises an unwired `/b-blueprint` form.

## Intentional gaps distinguished from defects

- b-loop's missing prompt/command mirror is an explicit user-selected deferral already tracked in `b-loop-skill-and-mirror.md`.
- b-issue-create is skill-only without falsely promising a slash command; this is discoverability, not broken behavior.
- commands/b-pr.md and commands/b-pr-review-2-issues.md are regular files while the other command entries are symlinks; b-pr's exception is intentional for portable skill-directory resolution, but loading docs should state the exceptions.
- b-flow code remains as historical/unwired source by design. Residual subject-resolution fallback, xstate dependency, and missing directory banner are incomplete deprecation cleanup.

## Verification

- `npm run context:validate`: 62 warnings, 0 errors. Output confirms phase overviews are treated as generic plans.
- `npx vitest run scripts/context-artifacts.test.mjs`: 41/41 tests passed.
- Direct classifier smoke: overview=`plan`; phase/iterate/spec=`null`; research=`research`.
- Live OMP eval smoke: `completion=function`, `agent=function`, `llm=undefined`.
- Command mirror: 20 tracked symlinks + 2 tracked regular wrappers.
- Marksman/LSP diagnostics: clean for docs, README, installable bootstrap, and all exploration artifacts.

## Durable outputs

- Canonical audit: `.context/2026-07-10.buck-workflow-implementation-audit/research-workflow-implementation-audit.md`
- Evidence log: `.context/2026-07-10.buck-workflow-implementation-audit/research/notes-workflow-implementation-audit.md`
- High-priority remediation backlog: `.context/backlog/items/reconcile-buck-workflow-contracts.md`

## Recommended next action

Run `/b-plan` against the remediation backlog and split it into at least two ordered efforts: (1) lifecycle transaction and review evidence; (2) OMP 16.3.15 compatibility. Schema/validator unification and docs generation follow after those executable contracts are green.
