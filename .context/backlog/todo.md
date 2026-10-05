# Backlog

## Review Severity Ranking Phases (2026-10-03)

Overview: [`plan-review-severity-ranking-phases.md`](../2026-10-03.review-severity-ranking/plan-review-severity-ranking-phases.md).
Phases form a HARD chain (1 → 2 → 3 → 4).

- [x] [Phase 1: Types, Scan, and the Pure Waterline](archive/2026-10/phase-1-ranking-types-scan-waterline.md) — medium, `/b-build-hard`, `orchestrate` — [phase-1-types-scan-pure-waterline.md](../2026-10-03.review-severity-ranking/phase-1-types-scan-pure-waterline.md) — done 2026-10-04; committed `8f8c511`

### Upcoming Phases

- [x] Phase 2: Jev Ranking Core and Audit Trail — hard, `/b-build-hard`, `orchestrate` — [phase-2-jev-ranking-core.md](../2026-10-03.review-severity-ranking/phase-2-jev-ranking-core.md) — done 2026-10-04; review Pass, iterate defects resolved (134 tests)
- [ ] Phase 3: Machine Edges and the Rank Effect Handler — hard, `/b-build-hard`, `orchestrate` — [phase-3-machine-loop-routing.md](../2026-10-03.review-severity-ranking/phase-3-machine-loop-routing.md)
- [ ] Phase 4: State Diagram and Doc Sentence — easy, `/b-build`, `orchestrate` — [phase-4-docs.md](../2026-10-03.review-severity-ranking/phase-4-docs.md)

- [x] [b-commit-improved](archive/2026-07/b-commit-improved.md) — make b-commit deterministic (skill, preflight, extension, tests, cross-platform) — done 2026-07-25
- [x] [Stop b-commit-improved committing leftover draft placeholders](archive/2026-08/b-commit-placeholder-sentinels.md) — done 2026-08-26


- [ ] [Replace modelRoles YAML parser with omp Settings API](items/settings-api-model-roles.md) — medium; hard dep on @oh-my-pi fork, async resolution, legacy `.pi` mapping retired — see `.context/2026-09-19.settings-api-model-roles/plan-settings-api-model-roles.md`

- [ ] [Report `/buck-models` write failures in the command UI](items/buck-models-write-error-feedback.md) — medium; out-of-plan Phase 5 review warning

## Verified bugs found while raising buck-loop coverage (2026-10-03)

Each item was reproduced by direct execution, not inferred. Found during the
`extensions/buck-loop/` 75%-per-file coverage pass; none is fixed by that work.

- [x] [repairCheckedPhase rewrites a body status line outside the frontmatter](archive/2026-10/buck-loop-repair-checked-phase-escapes-frontmatter.md) — medium; whole-document regex, and `completed_at` receives a full ISO timestamp from `resolveAmbiguity` — done 2026-10-03
- [ ] [formatRecall's "no relevant candidates" branch is unreachable](items/recall-format-empty-shortlist-unreachable.md) — low; the sub-threshold fail-open is real and undocumented
- [ ] [serializeCallError emits an empty message for a nameless, messageless Error](items/serialize-call-error-empty-message.md) — low; intentionally untested pending a product decision
- [ ] [initialLabel does not narrow the profile command, so index.ts fails tsc](items/buck-loop-index-initial-label-narrowing.md) — low; pre-existing typing gap, runtime-safe
- [ ] [Expose exhaustive fix-pr feedback as an agent tool](items/fix-pr-native-pr-tool.md) — medium; native PR orientation with typed tool over portable ingest — see `.context/2026-09-28.fix-pr-native-pr-tool/plan-fix-pr-native-pr-tool.md`

## Postgres Agent Memory Phases (2026-09-28)

Overview: [`plan-postgres-agent-memory-phases.md`](../2026-09-28.postgres-agent-memory/plan-postgres-agent-memory-phases.md).
Phases form a HARD chain (1 → 2) with a SOFT docs tail (2 → 3).

- [ ] [Phase 1: Schema and Migrations](items/phase-1-schema-migrations-pg.md) — medium, `/b-build` — [phase-1-schema-migrations.md](../2026-09-28.postgres-agent-memory/phase-1-schema-migrations.md)
- [x] [Phase 2: Extension and SQL Tool](archive/2026-09/phase-2-extension-sql-tool.md) — hard, `/b-build-hard` — done 2026-09-28
- [x] [Phase 3: Recall Patterns and Docs](archive/2026-09/phase-3-recall-patterns-docs.md) — easy, `/b-build` — done 2026-09-28

## SQL memory in Buck-loop Phases (2026-09-28)

Overview: [`plan-sql-memory-buck-loop-phases.md`](../2026-09-28.sql-memory-buck-loop/plan-sql-memory-buck-loop-phases.md).
Phases form a HARD chain (1 → 2 → 3 → 4).


### Active and Upcoming Phases

- [x] [Phase 2: Recall and bounded judgment](archive/2026-09/phase-2-sql-memory-recall-judgment.md) — done 2026-09-29
- [x] [Phase 3: SQL save and truthful completion](archive/2026-09/phase-3-sql-memory-save-receipts.md) — done 2026-09-29
- [x] [Phase 4: Policy/docs and live proof](archive/2026-09/phase-4-sql-memory-docs-live-proof.md) — done 2026-09-29

- [ ] [Show a one-line TUI notice when sql_memory is used](items/sql-memory-tui-notice.md) — medium; mimic the Jev decision line — see `.context/2026-09-30.sql-memory-tui-notice/plan-sql-memory-tui-notice.md`
- [ ] [Stop model-written SQL memory saves](items/sql-memory-remember-op.md) — medium; `remember` op plus model-facing `fix` — see `.context/2026-10-01.sql-memory-remember-op/plan-sql-memory-remember-op.md`

## Buck Model Profile Phases (2026-09-23)

### Upcoming Phases


- [ ] [Unified live activity for extensions](items/deterministic-extension-progress.md) — high priority; animated footer spinner + bounded live activity window across every long-running command — see `.context/2026-09-11.extension-activity-progress/plan-extension-activity-progress.md`
- [x] [Add a tail-able `/buck-loop` streaming log drain](archive/2026-09/buck-loop-streaming-log-drain.md) — done 2026-09-30
- [ ] [Fail closed when buck-loop Git safety probes fail](items/fail-closed-buck-loop-git-safety-probes.md) — high; branch/status command failures must block rather than appear unprotected and clean

- [ ] [Jev-ranked `/buck-loop` subject picker](items/buck-loop-subject-picker.md) — medium; bare `/buck-loop` ranks runnable subjects with Jev, shows up to 10 in the TUI, and starts the operator's selection — see `.context/2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker.md`

## Subject Picker Phases (2026-09-27)

Overview: [`plan-buck-loop-subject-picker-phases.md`](../2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker-phases.md).
Phases form a HARD chain (1 → 2) with a SOFT docs tail (2 → 3).

- [ ] [Phase 1: Subject-Choice Module](items/phase-1-subject-choice.md) — hard, `/b-build-hard` — [phase-1-subject-choice.md](../2026-09-19.buck-loop-subject-picker/phase-1-subject-choice.md)

### Upcoming Phases

- [ ] Phase 2: Command Boundary and Kickoff — hard, `/b-build-hard` — [phase-2-command-kickoff.md](../2026-09-19.buck-loop-subject-picker/phase-2-command-kickoff.md)
- [ ] Phase 3: Documentation — easy, `/b-build` — [phase-3-docs.md](../2026-09-19.buck-loop-subject-picker/phase-3-docs.md)
- [ ] [Harden typed Buck Workflow outputs](items/jev-buck-loop-chooser.md) — high; five phased contracts for b-review, buck-loop recovery, and TypeSafe verification — see [phase overview](../2026-09-21.jev-decision-opportunities/plan-jev-buck-loop-chooser-phases.md)

## Typed Workflow Output Phases (2026-09-22)


### Upcoming Phases

- [ ] [Phase 2: Review Contract and Typed Routing](items/phase-2-review-contract-and-routing.md) — hard — [phase](../2026-09-21.jev-decision-opportunities/phase-2-review-contract-and-routing.md)
- [ ] [Phase 3: Fix-or-Continue Recovery](items/phase-3-fix-or-continue-recovery.md) — hard — [phase](../2026-09-21.jev-decision-opportunities/phase-3-fix-or-continue-recovery.md)
- [ ] [Phase 4: Core Closed-Set Migration](items/phase-4-core-closed-set-migration.md) — hard — [phase](../2026-09-21.jev-decision-opportunities/phase-4-core-closed-set-migration.md)
- [ ] [Phase 5: Documentation and Live Proof](items/phase-5-documentation-and-live-proof.md) — medium — [phase](../2026-09-21.jev-decision-opportunities/phase-5-documentation-and-live-proof.md)

## Jev Tool Phases (2026-09-21)

Overview: [`plan-jev-tool-phases.md`](../2026-09-21.jev-tool/plan-jev-tool-phases.md).
Phases form a HARD chain because Phases 1–2 share `extensions/index.ts` and Phase 3 is their integration join.

### Upcoming Phases

- [ ] [Phase 3: b-phase Integration and Proof](items/phase-3-b-phase-integration-and-proof.md) — medium, `/b-build` — [phase-3-b-phase-integration-and-proof.md](../2026-09-21.jev-tool/phase-3-b-phase-integration-and-proof.md)
- [ ] [Fix buck-loop context-free choice stalls](items/buck-loop-contextless-choice-stall.md) — high; original incident first in [combined Phase 1](../2026-09-16.decision-closure/phase-1-chooser-stall.md); broader typed-review/recovery scope remains separate
- [ ] [Fix buck-loop save/commit checkpoint handoff](items/buck-loop-save-commit-handoff.md) — high; verified save receipts reported as SqlMemoryError + commit guard blocking phase deliverables — see `.context/2026-09-30.buck-loop-save-commit-handoff/plan-save-commit-handoff.md`
- [ ] [Preserve buck-loop commit checkpoint identity](items/buck-loop-commit-phase-identity.md) — high; retain the phase across failed commits and restarts; no next-phase work before a verified commit
- [ ] [Fix buck-loop SQL-save receipt subject mismatch](items/buck-loop-save-receipt-subject.md) — high; `saveDirective()` omits `subject`, so `sameAttempt()` rejects a receipt the child verified and the save postcondition stays ambiguous — observed 2026-10-02 blocking the stacked-cards run at `saving → blocked`
- [ ] [Stop false heavy lifts when an iterate file stays active](items/buck-loop-iterate-closeout.md) — high; supervisor closes one unfinished iterate artifact after an ok session — see `.context/2026-10-03.buck-loop-iterate-closeout/plan-iterate-closeout.md`
- [x] [Add decision closure across Buck Workflow](items/decision-closure-protocol.md) — medium; phased — all six phases complete — done 2026-09-30
- [x] [Phase 1: Chooser Stall Verification and Repair](items/phase-1-chooser-stall.md) — hard, `/b-build-hard`; bugs-first entry — done 2026-09-29
- [ ] [Raise patch coverage vs origin/master above 90%](items/patch-gate-branch-coverage.md) — medium; first guardrails check failed at 51%
- [ ] [Rewrite HEAD 30e0849 placeholder commit subject](items/rewrite-placeholder-commit-30e0849.md) — low; tool fixed, historical message not rewritten
- [ ] [First npm publish of buck-workflow (blocked on test gate)](items/first-npm-publish.md) — high priority
- [ ] [Multi-harness symlink installer (buck-workflow install)](items/multi-harness-symlink-installer.md) — high priority
- [x] [b-init-guardrails](archive/2026-07/b-init-guardrails.md) — quality guardrails with brownfield ratchet (skills, detection, ratchet protocol, managed block, OMP async check) — done 2026-07-26
- [ ] [Sweep leftover qmd mentions outside the memory-search plan](items/qmd-mentions-outside-plan.md)
- [x] [Run /b-init-guardrails on this repo to record a durable check contract](items/run-b-init-guardrails-on-repo.md) — done 2026-09-10 (guardrails.json v2 durable contract verified during mattpocock Phase 1)
- [ ] [Cover serve-presentations.ts lines 289-304 (patch gate at 89%)](items/serve-presentations-patch-coverage.md) — medium; pre-existing from 0d1dbf7, surfaced 2026-09-10
- [ ] [Complexity gate burn-down for pre-existing hotspots](items/complexity-burn-down.md) — medium; override recorded 2026-08-27, includes lizard parseArgs@32-677 artifact
- [ ] [Installer cannot detect or warn about a split source root](items/installer-source-split-detection.md) — medium; add `--verify`, warn on cross-root relink, flag copied bootstraps
- [x] [Fix 3 live defects from the mattpocock/skills audit](items/mattpocock-audit-defects.md) — high; done 2026-09-10 as **Phase 1** → [`phase-1-live-defects.md`](../2026-09-10.mattpocock-adoption/phase-1-live-defects.md)

## Skill Surface Cleanup Phases (2026-09-21)

Overview: [`plan-skill-surface-cleanup-phases.md`](../2026-09-21.skill-command-extension-audit/plan-skill-surface-cleanup-phases.md).
Umbrella: [Skill/command/extension surface cleanup](archive/2026-09/skill-surface-cleanup.md).
Phases share no files; recommended order is Phase 1 first.

- [x] Phase 1: Dead Unwired Extensions — medium — [phase-1-dead-unwired-extensions.md](../2026-09-21.skill-command-extension-audit/phase-1-dead-unwired-extensions.md) — done 2026-09-21

- [x] [Phase 2: b-save Thin-Wrap and Code-Review Paths](archive/2026-09/phase-2-bsave-and-code-review.md) — done 2026-09-21

### Follow-up

- [ ] [Sync living docs to canonical b-save skill](items/sync-b-save-canonical-docs.md) — low; replace stale wording that says the prompt executes the procedure directly

## buck-loop Extension Phases (2026-09-18)

Overview: [`plan-buck-loop-extension-phases.md`](../2026-09-18.buck-loop-extension/plan-buck-loop-extension-phases.md).
Umbrella: [buck-loop extension — scrap XState, happy-path nested-session runner](archive/2026-09/buck-loop-extension.md).
After Phase 1, Phases 2–4 may run in parallel. Phase 5 is their join.

- [x] [Phase 1: Transition Contract](archive/2026-09/phase-1-transition-contract.md) — hard, `/b-build-hard` — done 2026-09-18 — review Pass, 66/66
- [x] [Phase 2: Artifact State](archive/2026-09/phase-2-artifact-state.md) — hard, `/b-build-hard` — done 2026-09-18 — review Pass with warnings, 49/49
- [x] [Phase 3: Closed-Set Choice](archive/2026-09/phase-3-closed-set-choice.md) — hard, `/b-build-hard` — done 2026-09-18
- [x] [Phase 4: Nested Work Sessions](archive/2026-09/phase-4-nested-work-sessions.md) — hard, `/b-build-hard` — done 2026-09-18
- [x] [Phase 5: Loop Supervisor](archive/2026-09/phase-5-loop-supervisor.md) — hard, `/b-build-hard` — done 2026-09-18
- [x] [Phase 6: Command Surface](archive/2026-09/phase-6-command-surface.md) — medium, `/b-build` — done 2026-09-18
- [x] [Phase 7: Documentation and Proof](archive/2026-09/phase-7-documentation-and-proof.md) — medium, `/b-build` — done 2026-09-18

## Coordinated Decision Phases (rephased 2026-09-29)

Overview: [`plan-decision-closure-protocol-phases.md`](../2026-09-16.decision-closure/plan-decision-closure-protocol-phases.md).
Umbrella: [Add decision closure across Buck Workflow](items/decision-closure-protocol.md).
Phase 1 verifies/closes the chooser bug first; Phase 2 freezes the closure protocol; only then may Phases 3–5 run in parallel.

- [x] Phase 1: Chooser Stall Verification and Repair — hard — [phase-1-chooser-stall.md](../2026-09-16.decision-closure/phase-1-chooser-stall.md) — done 2026-09-29

### Upcoming Phases

- [x] Phase 2: Shared Protocol — hard — [phase-2-shared-protocol.md](../2026-09-16.decision-closure/phase-2-shared-protocol.md) — done 2026-09-29
- [x] Phase 3: Grill Variants — not-hard — [phase-3-grill-variants.md](../2026-09-16.decision-closure/phase-3-grill-variants.md) — done 2026-09-29
- [x] Phase 4: Plan and Phase — not-hard — [phase-4-plan-and-phase.md](../2026-09-16.decision-closure/phase-4-plan-and-phase.md) — done 2026-09-29
- [x] Phase 5: Build and Review — not-hard — [phase-5-build-and-review.md](../2026-09-16.decision-closure/phase-5-build-and-review.md) — done 2026-09-29
- [x] Phase 6: Narrative and Proof — not-hard — [phase-6-narrative-and-proof.md](../2026-09-16.decision-closure/phase-6-narrative-and-proof.md) — done 2026-09-30

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

## State Machine Module Cutover Phases (2026-10-01)

Overview: [`plan-state-machine-module-cutover-phases.md`](../2026-10-01.state-machine-redesign/plan-state-machine-module-cutover-phases.md).
Umbrella plan: [plan-state-machine-module-cutover.md](../2026-10-01.state-machine-redesign/plan-state-machine-module-cutover.md).
Phases form a HARD chain (1 → 2), SOFT (2 → 3, sequencing only), HARD join (2,3 → 4).

- [ ] [Phase 1: Module Finalization](items/phase-1-state-machine-module.md) — medium, `/b-build` — [phase-1-module-finalization.md](../2026-10-01.state-machine-redesign/phase-1-module-finalization.md)
- [ ] [State-machine guards must attach context to the next step](items/state-machine-guard-step-context.md) — high; a refused edge must name the alternate step and the context that step receives

### Upcoming Phases

- [ ] Phase 2: Port buckMachine — hard, `/b-build-hard` — [phase-2-port-buck-machine.md](../2026-10-01.state-machine-redesign/phase-2-port-buck-machine.md)
- [ ] Phase 3: Port reviewMachine — medium, `/b-build` — [phase-3-port-review-machine.md](../2026-10-01.state-machine-redesign/phase-3-port-review-machine.md)
- [x] Phase 4: Delete Old Engine and Update Docs — medium — [phase-4-delete-and-document.md](../2026-10-01.state-machine-redesign/phase-4-delete-and-document.md) — review Pass; durable guardrails reproduce pass; save checkpoint complete 2026-10-01; commit pending.

## Other
- [ ] [Add plan-specific implementation ledger for b-review traceability](items/plan-implementation-ledger.md)
- [x] [b-pr skill](items/b-pr-skill.md) — SKILL.md, pr-preflight.ts, prompt, command, dual-audience description — done 2026-06-11
- [x] [b-pr: portable script path + .context-as-research](../2026-06-22.b-pr-skill-portable-path/index.md) — `<skill_dir>` resolution, impl/context file split, changed-only artifacts — done 2026-06-22
- [ ] [Make b-commit the final Buck workflow step](items/b-commit-final-step.md)
- [ ] [Make Buck execution loops loop-agnostic](items/loop-agnostic-execution-loops.md) — remove Ralph-specific instructions from generated mini-cycles
- [ ] [Locate Pi coding-agent runtime source in clean worktrees](items/pi-runtime-source-clean-worktree.md) — medium priority

## Viability Cleanup Phases (2026-10-01)

Overview: [`plan-viability-cleanup-phases.md`](../2026-10-01.skill-command-viability/plan-viability-cleanup-phases.md).
HARD chain: 1 → 2 → 3 → 4. X1–X3 are not phased.

- [ ] [Phase 1: OMP stubs to docs](items/phase-1-omp-stubs.md) — medium, `/b-build` — [phase-1-omp-stubs.md](../2026-10-01.skill-command-viability/phase-1-omp-stubs.md)

### Upcoming Phases

- [ ] Phase 2: Fold duplicates — medium, `/b-build` — [phase-2-fold-duplicates.md](../2026-10-01.skill-command-viability/phase-2-fold-duplicates.md)
- [ ] Phase 3: Delete the grill shell — medium, `/b-build` — [phase-3-grill-shell.md](../2026-10-01.skill-command-viability/phase-3-grill-shell.md)
- [ ] Phase 4: Move out of the package — medium, `/b-build` — [phase-4-move-out.md](../2026-10-01.skill-command-viability/phase-4-move-out.md)
