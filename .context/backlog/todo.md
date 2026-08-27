# Backlog

- [x] [b-commit-improved](archive/2026-07/b-commit-improved.md) — make b-commit deterministic (skill, preflight, extension, tests, cross-platform) — done 2026-07-25
- [x] [Stop b-commit-improved committing leftover draft placeholders](archive/2026-08/b-commit-placeholder-sentinels.md) — done 2026-08-26

- [ ] [Live TUI progress for deterministic slash commands](items/deterministic-extension-progress.md) — high priority
- [ ] [Raise patch coverage vs origin/master above 90%](items/patch-gate-branch-coverage.md) — medium; first guardrails check failed at 51%
- [ ] [Rewrite HEAD 30e0849 placeholder commit subject](items/rewrite-placeholder-commit-30e0849.md) — low; tool fixed, historical message not rewritten
- [ ] [First npm publish of buck-workflow (blocked on test gate)](items/first-npm-publish.md) — high priority
- [ ] [Test b-grill-auto extension in live Pi session](items/test-b-grill-auto-extension.md)
- [ ] [Multi-harness symlink installer (buck-workflow install)](items/multi-harness-symlink-installer.md) — high priority
- [ ] [b-loop skill — advisory + stamp + deferred slash mirror](items/b-loop-skill-and-mirror.md) — SKILL.md only; tracked follow-ups F1–F3
- [x] [b-init-guardrails](archive/2026-07/b-init-guardrails.md) — quality guardrails with brownfield ratchet (skills, detection, ratchet protocol, managed block, OMP async check) — done 2026-07-26
- [ ] [docs/eval-kernel.md omits async task/hub job contract](items/eval-kernel-async-task-doc-gap.md)
- [ ] [Sweep leftover qmd mentions outside the memory-search plan](items/qmd-mentions-outside-plan.md)
- [ ] [Run /b-init-guardrails on this repo to record a durable check contract](items/run-b-init-guardrails-on-repo.md)
- [ ] [Complexity gate burn-down for pre-existing hotspots](items/complexity-burn-down.md) — medium; override recorded 2026-08-27, includes lizard parseArgs@32-677 artifact

## b-flow SDK Redesign Phases
- [x] Phase 3: Test Coverage & Verification (2026-05-30) — see `.context/backlog/archive/2026-05/phase-3-test-coverage.md`
- [x] Redesign b-flow to use Pi SDK for isolated worker contexts (2026-05-30) — see `.context/backlog/archive/2026-05/b-flow-sdk-redesign.md`

## Cross-harness Kernel Phases (2026-06-07)
- [x] Phase 1: Cross-harness compat — archived `.context/backlog/archive/2026-06/phase-1-cross-harness-compat.md` — done 2026-06-07
- [x] Phase 2: Kernel contract doc — archived `.context/backlog/archive/2026-06/phase-2-kernel-contract-doc.md` — done 2026-06-07
- [x] Phase 3: Real kernel usage examples — archived `.context/backlog/archive/2026-06/phase-3-eval-kernel-examples.md` — done 2026-06-07
- [x] Phase 4: b-grill* integration — archived `.context/backlog/archive/2026-06/phase-4-b-grill-integration.md` — done 2026-06-07


## Code-review universal skill (2026-06-07)
- [x] [Code review skill](items/code-review-skill.md) — pr-context.ts, submit-review.ts, SKILL.md, prompt, symlink, docs reality pass — done 2026-06-07

## Other
- [ ] [Add plan-specific implementation ledger for b-review traceability](items/plan-implementation-ledger.md)
- [x] [b-pr skill](items/b-pr-skill.md) — SKILL.md, pr-preflight.ts, prompt, command, dual-audience description — done 2026-06-11
- [x] [b-pr: portable script path + .context-as-research](../2026-06-22.b-pr-skill-portable-path/index.md) — `<skill_dir>` resolution, impl/context file split, changed-only artifacts — done 2026-06-22
- [ ] [Make b-commit the final Buck workflow step](items/b-commit-final-step.md)
- [ ] [Make Buck execution loops loop-agnostic](items/loop-agnostic-execution-loops.md) — remove Ralph-specific instructions from generated mini-cycles

