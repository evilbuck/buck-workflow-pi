# Backlog

- [x] [b-commit-improved](archive/2026-07/b-commit-improved.md) — make b-commit deterministic (skill, preflight, extension, tests, cross-platform) — done 2026-07-25
- [x] [Stop b-commit-improved committing leftover draft placeholders](archive/2026-08/b-commit-placeholder-sentinels.md) — done 2026-08-26

- [ ] [Unified live activity for extensions](items/deterministic-extension-progress.md) — high priority; animated footer spinner + bounded live activity window across every long-running command — see `.context/2026-09-11.extension-activity-progress/plan-extension-activity-progress.md`
- [ ] [Raise patch coverage vs origin/master above 90%](items/patch-gate-branch-coverage.md) — medium; first guardrails check failed at 51%
- [ ] [Rewrite HEAD 30e0849 placeholder commit subject](items/rewrite-placeholder-commit-30e0849.md) — low; tool fixed, historical message not rewritten
- [ ] [First npm publish of buck-workflow (blocked on test gate)](items/first-npm-publish.md) — high priority
- [ ] [Test b-grill-auto extension in live Pi session](items/test-b-grill-auto-extension.md)
- [ ] [Multi-harness symlink installer (buck-workflow install)](items/multi-harness-symlink-installer.md) — high priority
- [ ] [b-loop skill — advisory + stamp + deferred slash mirror](items/b-loop-skill-and-mirror.md) — SKILL.md only; tracked follow-ups F1–F3
- [x] [b-init-guardrails](archive/2026-07/b-init-guardrails.md) — quality guardrails with brownfield ratchet (skills, detection, ratchet protocol, managed block, OMP async check) — done 2026-07-26
- [ ] [docs/eval-kernel.md omits async task/hub job contract](items/eval-kernel-async-task-doc-gap.md)
- [ ] [Sweep leftover qmd mentions outside the memory-search plan](items/qmd-mentions-outside-plan.md)
- [x] [Run /b-init-guardrails on this repo to record a durable check contract](items/run-b-init-guardrails-on-repo.md) — done 2026-09-10 (guardrails.json v2 durable contract verified during mattpocock Phase 1)
- [ ] [Cover serve-presentations.ts lines 289-304 (patch gate at 89%)](items/serve-presentations-patch-coverage.md) — medium; pre-existing from 0d1dbf7, surfaced 2026-09-10
- [ ] [Complexity gate burn-down for pre-existing hotspots](items/complexity-burn-down.md) — medium; override recorded 2026-08-27, includes lizard parseArgs@32-677 artifact
- [ ] [Installer cannot detect or warn about a split source root](items/installer-source-split-detection.md) — medium; add `--verify`, warn on cross-root relink, flag copied bootstraps
- [x] [Fix 3 live defects from the mattpocock/skills audit](items/mattpocock-audit-defects.md) — high; done 2026-09-10 as **Phase 1** → [`phase-1-live-defects.md`](../2026-09-10.mattpocock-adoption/phase-1-live-defects.md)

## mattpocock Remediation Phases (2026-09-10)

Overview: [`plan-mattpocock-findings-remediation-phases.md`](../2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation-phases.md).
All 5 phases shipped 2026-09-10.
Umbrella item: [Adopt mattpocock/skills capability gaps](items/mattpocock-adoptions.md) — done 2026-09-10.

- [x] Phase 1: Live Defects — medium, `orchestrate` — [phase-1-live-defects.md](../2026-09-10.mattpocock-adoption/phase-1-live-defects.md) — done 2026-09-10
- [x] Phase 2: Design Vocabulary & b-diagnose — hard — [phase-2-design-vocabulary-and-diagnose.md](../2026-09-10.mattpocock-adoption/phase-2-design-vocabulary-and-diagnose.md) — done 2026-09-10
- [x] Phase 3: Loop Composition Patches — medium — [phase-3-loop-composition-patches.md](../2026-09-10.mattpocock-adoption/phase-3-loop-composition-patches.md) — done 2026-09-10
- [x] Phase 4: Independent New Members — medium, `orchestrate` — [phase-4-independent-new-members.md](../2026-09-10.mattpocock-adoption/phase-4-independent-new-members.md) — done 2026-09-10
- [x] Phase 5: Tracker Init & Triage — hard — [phase-5-tracker-init-and-triage.md](../2026-09-10.mattpocock-adoption/phase-5-tracker-init-and-triage.md) — done 2026-09-10

### Tier 4 deferred (2026-09-10 mattpocock adoption)

Deferred deliverables from [`plan-mattpocock-findings-remediation.md`](../2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation.md) Tier 4 — low priority, not on the audit's rejected list.

- [ ] [b-phase ready-frontier + expand–contract](items/b-phase-ready-frontier-expand-contract.md) — low
- [ ] [b-prototype](items/b-prototype.md) — low
- [ ] [b-grill round-frontier mode](items/b-grill-round-frontier-mode.md) — low
- [ ] [b-auto-fix frontier concurrency](items/b-auto-fix-frontier-concurrency.md) — low
- [ ] [code-smells depth axis + b-blueprint visuals](items/code-smells-depth-axis-blueprint-visuals.md) — low
- [ ] [b-which router generated from the catalog](items/b-which-catalog-router.md) — low; promote if Tier 3 lands
- [ ] [b-retro](items/b-retro.md) — low
- [ ] [wayfinder](items/wayfinder.md) — low; gated on N4/b-triage proving the tracker integration

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
- [ ] [Locate Pi coding-agent runtime source in clean worktrees](items/pi-runtime-source-clean-worktree.md) — medium priority
