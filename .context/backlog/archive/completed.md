- [x] [Repair buck-loop SQL-save checkpoint failure](2026-10/buck-loop-sql-save-phase-provenance-test.md) — done 2026-10-04 — restored canonical subject in saveDirective; SQL-save tests and durable guardrails pass, live receipt verified. Checkpoint 63b237e.
- [x] [Refuse unphased buck-loop done without closeout evidence](2026-09/buck-loop-unphased-closeout.md) — done 2026-09-30 — ineligible unphased commits block with unchecked acceptance lines; eligible resume closes the subject without another build. `8e62775`, subject closed in `6829598`. `.context/2026-09-30.buck-loop-unphased-closeout/`
- [x] [Phase 1: Types, Scan, and the Pure Waterline](2026-10/phase-1-ranking-types-scan-waterline.md) — done 2026-10-04 — `ranking` state outside `WorkState` and inside `FROZEN_PHASE`, `{kind: rank}` effect, persistence compatibility, `hasIterate()` ignoring `below-waterline`, the `critical:n`/`warning:n` parser, and the pure `aboveWaterline()` cell matrix; A-1/A-9/A-10 validated by fixture parse, scan, persist and waterline tests with no network. Committed `8f8c511`. `.context/2026-10-03.review-severity-ranking/phase-1-types-scan-pure-waterline.md`

- [x] [repairCheckedPhase rewrites a body status line outside the frontmatter](2026-10/buck-loop-repair-checked-phase-escapes-frontmatter.md) — done 2026-10-03 — `repairCheckedPhase()` now rewrites only within `frontmatterSpan()` (re-exported from `phase-completion.ts`) and stamps `completed_at` as a bare date; both mandated regression tests red-then-green; 1565-test suite and durable guardrails pass.

- [x] [Phase 6: Narrative and proof](2026-09/phase-6-narrative-and-proof.md) — done 2026-09-30 — second methodology principle (visible material decisions, accepted-decision envelope) added to `docs/buck-workflow.md`; full Codex bundle parity for changed canonical skills; forbidden-term scan zero matches; `npx vitest run scripts/codex-plugin.test.ts` passes; six behavior scenarios traced; phase file `status: completed`. `.context/2026-09-16.decision-closure/phase-6-narrative-and-proof.md`
- [x] [Phase 5: Hard-mode sequence and review matrix](2026-09/phase-5-hard-mode-sequence-and-review-matrix.md) — done 2026-09-30 — hard-mode minimal-change and settled-decision rules in `b-build`; `b-review` defect/warning/new-scope matrix; bundled parity and tests pass. `.context/2026-09-16.decision-closure/phase-5-build-and-review.md`
- [x] [Phase 4: Plan ledger and phase routing](2026-09/phase-4-plan-ledger-and-phase-routing.md) — done 2026-09-30 — conditional plan records, missing-upstream synthesis, earliest-capable assumption assignment. `.context/2026-09-16.decision-closure/phase-4-plan-and-phase.md`
- [x] [Phase 3: Grill variants closeout](2026-09/phase-3-grill-variants-closeout.md) — done 2026-09-30 — four portable grill variants wired to the shared closure contract; bundled skill parity and forbidden-term scan pass. `.context/2026-09-16.decision-closure/phase-3-grill-variants.md`
- [x] [Phase 2: Shared decision-closure protocol](2026-09/phase-2-shared-decision-closure-protocol.md) — done 2026-09-30 — `skills/_shared/decision-closure.md` authored, registered, and bundled; receipt `01a0f062-…6730` completed. `.context/2026-09-16.decision-closure/phase-2-shared-protocol.md`

- [x] [Add a tail-able /buck-loop streaming log drain](2026-09/buck-loop-streaming-log-drain.md) — done 2026-09-30 — versioned JSONL activity drain at `.context/workflow/buck-loop.log.jsonl` (start truncates, resume appends), shipped in PR #51 (`0a82064`) via `extensions/buck-loop/activity-log.ts` + tests; iterate fixes landed in `a490963`. `.context/2026-09-24.buck-loop-streaming-log-drain/`
- [x] [Add `/buck-models --doctor`](2026-09/buck-models-doctor.md) — done 2026-09-30 — read-only availability audit of project+global model profiles vs live registry with active-profile resolution, shipped in PR #51 (`76e722e`; fixes `7c9b4a7`, `a490963`); read-once loader fix confirmed. `.context/2026-09-25.buck-models-doctor/`
- [x] [Harden Buck Workflow integrity and enforcement](2026-09/buck-workflow-factory-improvements.md) — done 2026-09-30 — all 11 criteria shipped: skill-frontmatter/codex-plugin/commands-mirror/install-smoke tests, guardrails.json gates + check.mjs CI runner, hooks.mjs + pre-push audit. `.context/2026-09-18.good-ideas/`
- [x] [Define verified closeout evidence for unphased plans](2026-09/unphased-plan-closeout-evidence.md) — done 2026-09-30 — `subject-lifecycle.ts verifyClose` now accepts an unphased plan whose frontmatter `status: completed` as closeout evidence; regression test added. `.context/2026-09-19.subject-work-state/`

- [x] [Phase 4: Policy/docs and live proof](2026-09/phase-4-sql-memory-docs-live-proof.md) — done 2026-09-29 — isolated disposable `/buck-loop` plus cross-branch recall, supersede, and connection-failure proof. `.context/2026-09-28.sql-memory-buck-loop/phase-4-policy-docs-live-proof.md`
- [x] [Phase 3: SQL save and truthful completion](2026-09/phase-3-sql-memory-save-receipts.md) — done 2026-09-29 — subject receipts, same-project read-back, commit blocked without a match. `.context/2026-09-28.sql-memory-buck-loop/phase-3-sql-save-truthful-completion.md`
- [x] [Phase 2: Recall and bounded judgment](2026-09/phase-2-sql-memory-recall-judgment.md) — done 2026-09-29 — all-branch active recall; invalidated rows excluded; Jev cannot add an id. `.context/2026-09-28.sql-memory-buck-loop/phase-2-recall-bounded-judgment.md`
- [x] [Phase 1: Tool contract and child seam](2026-09/phase-1-sql-memory-child-seam.md) — done 2026-09-29 — scoped child SQL tool, stage policy, disposable deployed OMP proof, four review iterations, documentation/save, and checkpoint commit `7705adf`. `.context/2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md`

- [x] [Finish ambiguous buck-loop repair](2026-09/buck-loop-ambiguous-repair.md) — done 2026-09-29 — fix-or-stop supervisor, checked-phase repair, one Jev-gated retry, restart gate for loop-extension edits; 118 focused tests and durable guardrails pass; fresh OMP SQL-memory Phase 1 blocked with operator reason after one build. `.context/2026-09-29.buck-loop-ambiguous-repair/`

- [x] [Phase 2: Extension and SQL Tool](2026-09/phase-2-extension-sql-tool.md) — done 2026-09-28 — `sql_memory` OMP tool: `SQL_MEMORY_URL`-gated registration, lazy `pg` load, allowlisted SELECT/INSERT/UPDATE with `SET LOCAL search_path = public`, additive-only migration runner with checksum pinning and exact-filename acknowledgment for non-additive files. 45 focused tests, three disposable `pgvector/pgvector:pg18` tool smokes, two review iterations closed lexical backslash and destructive-keyword gaps; durable guardrails v2 pass. `.context/2026-09-28.postgres-agent-memory/phase-2-extension-sql-tool.md`
- [x] [Named model profiles for Buck workflow stages](2026-09/buck-loop-model-config.md) — done 2026-09-24 — six-phase cutover covering config resolution, Jev/random selection, loop and interactive routing, `/buck-models`, living docs, how-to, and end-to-end proof. `.context/2026-09-22.buck-loop-model-config/plan-buck-loop-model-config.md`
- [x] [Phase 6: Model Profiles Documentation and Proof](2026-09/phase-6-model-profiles-documentation-proof.md) — done 2026-09-24 — named-profile living docs and how-to; existing cross-path integration coverage; save→resolve→Jev-pick→run/refuse smoke; durable guardrails pass. `.context/2026-09-22.buck-loop-model-config/phase-6-documentation-and-end-to-end-proof.md`
- [x] [Phase 5: `/buck-models` Command](2026-09/phase-5-buck-models-command.md) — done 2026-09-24 — project/global profile editor with activation-only switching, collision-safe selection, lossless stage preservation, availability warnings, and escaped arbitrary notes. `.context/2026-09-22.buck-loop-model-config/phase-5-buck-models-command.md`

- [x] [Phase 4: Interactive Command Cutover](2026-09/phase-4-interactive-command-cutover.md) — done 2026-09-24 — mapped interactive Buck commands apply the stage model and thinking level, then restore both; missing configuration refuses by stage name. `.context/2026-09-22.buck-loop-model-config/phase-4-interactive-command-cutover.md`

- [x] [Phase 3: Loop Runtime Cutover](2026-09/phase-3-loop-runtime-cutover.md) — done 2026-09-24 — nested work and closed-set choice use the stage picker; failed host calls re-pick; recovered text is kept; missing stage blocks by name. `.context/2026-09-22.buck-loop-model-config/phase-3-loop-runtime-cutover.md`

- [x] [Phase 2: TypeSafe Model Picker](2026-09/phase-2-typesafe-model-picker.md) — done 2026-09-24 — parent Jev/random picker; membership check; failed-id exclusion; named-stage exhaustion stop; review pass; loop callers not cut over. `.context/2026-09-22.buck-loop-model-config/phase-2-typesafe-model-picker.md`

- [x] [Phase 1: Profile Config and Resolution](2026-09/phase-1-profile-config-and-resolution.md) — done 2026-09-23 — buckModels parse, project-then-global stage resolution, availability filter, lossless YAML write; modelRoles unchanged; loop callers not cut over. `.context/2026-09-22.buck-loop-model-config/phase-1-profile-config-and-resolution.md`

- [x] [OMP token attribution by project and feature](2026-09/omp-token-attribution.md) — done 2026-09-23 — plugin-owned SQLite ledger, origin/worktree and branch attribution, nested delivery reconciliation, `/tokens` reporting, documentation, and passing durable guardrails. `.context/2026-09-23.omp-token-attribution/`

- [x] [Fix macOS /tmp-symlink realpath mismatches blocking the required unit-test gate](2026-09/macos-tmp-symlink-test-failures.md) — done 2026-09-23 — realpath'd `resolveRequestPath`/`gitCommonDir` and fixed two GNU-only `stat -c` invocations; added symlinked-root regression tests; `fix/macos-tmp-symlink-realpath@a0bf7b5`, 942/942, durable guardrails pass

- [x] [Fix buck-loop deferred-docs routing and in-cycle resume](2026-09/fix-buck-loop-deferred-docs-and-in-cycle-resume.md) — done 2026-09-22 — deferred Phase N documentation routes directly to save; blocked loop-owned staged work resumes while unrelated dirt fails closed. `.context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/`

- [x] [Skill/command/extension surface cleanup](2026-09/skill-surface-cleanup.md) — done 2026-09-21 — removed dead unwired extensions, made `b-save` skill-canonical, and moved release-PR review artifacts under `.context/`
- [x] [Phase 1 — Shared typed-output contract](2026-09/phase-1-shared-typed-output-contract.md) — done 2026-09-22 — versioned review/recovery validators, shared injectable TypeSafe evaluator, semantic policy fixtures, and durable guardrails pass
- [x] [Phase 2 — Binary phase-difficulty cutover](2026-09/phase-2-binary-difficulty-cutover.md) — done 2026-09-22 — binary `hard | not-hard` phase domain with legacy normalization; root and buck-loop routing preserved three-tier model roles
- [x] [Phase 1 — Jev tool contract](2026-09/phase-1-jev-tool-contract.md) — done 2026-09-21 — generic fail-closed TypeSafe `systemOne` OMP tool with tested Noul/Choice/Score passthrough

- [x] [Phase 2: b-save Thin-Wrap and Code-Review Paths](2026-09/phase-2-bsave-and-code-review.md) — done 2026-09-21 — canonical save skill, 13-line loader, portable review paths, passing review and guardrails

- [x] [Phase 1: Dead Unwired Extensions](2026-09/phase-1-dead-unwired-extensions.md) — done 2026-09-21 — deleted three unwired extension surfaces, replaced grill dialog calls with file/chat handoff, and preserved guardrail and Codex bundle parity

- [x] [Test b-grill-auto extension in live Pi session](2026-09/test-b-grill-auto-extension.md) — done 2026-09-21 — extension deleted; skill remains

- [x] [Test b-grill-auto extension in live Pi session](2026-09/test-b-grill-auto-extension.md) — done 2026-09-21 — extension and skill deleted; auto grilling is `/skill:b-grill --mode auto`

- [x] [Document current eval-kernel and async job contracts](2026-09/eval-kernel-async-task-doc-gap.md) — done 2026-09-21 — current handle-based eval API, task/hub boundary, result retention, and migrated workflow examples. `.context/2026-09-18.doc-honesty/`

- [x] [b-loop skill — advisory + stamp + deferred slash mirror](2026-09/b-loop-skill-and-mirror.md) — done 2026-09-20 — skill deleted; never had a slash mirror; `/buck-loop` is the runner; `b-plan`/`b-phase` own `omp_execution`

- [x] [Extract reusable pure state-machine evaluator](2026-09/reusable-state-machine-core.md) — done 2026-09-20 — domain-neutral evaluator; Buck adapter cutover; architecture proof; 187 Buck-loop tests and guardrails pass. `.context/2026-09-19.reusable-state-machine/`

- [x] [Phase 3: Architecture documentation and proof](2026-09/phase-3-architecture-documentation-and-proof.md) — done 2026-09-20 — evaluator/adapter docs; non-Buck smoke; 121 focused + 187 Buck-loop tests; final review and guardrails pass. `.context/2026-09-19.reusable-state-machine/phase-3-architecture-documentation-and-proof.md`

- [x] [Phase 2: Buck machine migration](2026-09/phase-2-buck-machine-migration.md) — done 2026-09-20 — Buck definition over defineMachine; table.ts removed; complexity split; 89/89; guardrails pass. `.context/2026-09-19.reusable-state-machine/phase-2-buck-machine-migration.md`

- [x] [Phase 1: Generic evaluator contract](2026-09/phase-1-generic-evaluator-contract.md) — done 2026-09-20 — pure synchronous evaluator; closed-choice isolation rejects shared memory; repeat review and durable guardrails passed. `.context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md`

- [x] [Deterministic subject lifecycle and plan-scoped scan](2026-09/subject-work-state.md) — done 2026-09-19 — final review passed; lifecycle authority, complete caller cutover, Codex parity, policy audit, and guardrails verified. `.context/2026-09-19.subject-work-state/`

- [x] [buck-loop extension](2026-09/buck-loop-extension.md) — done 2026-09-18 — visible activity, structured nested-failure handoff, real OMP loop reached done, 165 focused tests. `.context/2026-09-18.buck-loop-extension/`

- [x] [Phase 7: buck-loop documentation and proof](2026-09/phase-7-documentation-and-proof.md) — done 2026-09-18 — ADR 0002; runner vs stamper; 161 tests; guardrails pass. `.context/2026-09-18.buck-loop-extension/phase-7-documentation-and-proof.md`

- [x] [Phase 6: buck-loop command surface](2026-09/phase-6-command-surface.md) — done 2026-09-18 — `wireBuckLoop` registers `/buck-loop`; b-flow unwired. `.context/2026-09-18.buck-loop-extension/phase-6-command-surface.md`

- [x] [Phase 5: buck-loop supervisor](2026-09/phase-5-loop-supervisor.md) — done 2026-09-18 — `loop.ts`; review-zz naming; two iterate rounds. `.context/2026-09-18.buck-loop-extension/phase-5-loop-supervisor.md`

- [x] [Phase 4: buck-loop nested work sessions](2026-09/phase-4-nested-work-sessions.md) — done 2026-09-18 — `run-step.ts`; abort-with-text fails; iterate closed. `.context/2026-09-18.buck-loop-extension/phase-4-nested-work-sessions.md`

- [x] [Phase 3: buck-loop closed-set choice](2026-09/phase-3-closed-set-choice.md) — done 2026-09-18 — `choice.ts`; retry once then fail closed. `.context/2026-09-18.buck-loop-extension/phase-3-closed-set-choice.md`

- [x] [Phase 2: buck-loop artifact state](2026-09/phase-2-artifact-state.md) — done 2026-09-18 — scan.ts + persist.ts; 49/49; two iterate rounds; `/b-review` Pass with warnings. `.context/2026-09-18.buck-loop-extension/phase-2-artifact-state.md`

- [x] [Phase 1: buck-loop transition contract](2026-09/phase-1-transition-contract.md) — done 2026-09-18 — frozen types.ts + table.ts; 66/66; `/b-review` Pass. `.context/2026-09-18.buck-loop-extension/phase-1-transition-contract.md`

- [x] Stop b-commit-improved committing leftover draft placeholders (2026-08-26) — `.context/2026-08-26.b-commit-placeholder-sentinels/index.md`. Dollar-sign sentinels only; leftover angle-bracket titles refused. 16/16 tests.

- [x] Run /b-init-guardrails on this repo (2026-08-26) — `.context/2026-08-26.b-init-guardrails-on-repo/index.md`. Durable `guardrails.json` v2; first check failed patch gate on pre-existing branch diffs.

- [x] Make b-commit deterministic — b-commit-improved (2026-07-25) — `.context/2026-07-25.git-commit-improved/plan-git-commit-improved.md`. Skill, preflight script (4 exit codes), Pi extension (orchestrator + `fallbackDraft`), 10/10 vitest pass, OMP + Pi cross-platform fallbacks, 2-line wire-up. 0 tsc errors in new files.
- [x] Phase 3: Test Coverage & Verification (2026-05-30) — `.context/2026-05-30.b-flow-sdk-redesign/plan-b-flow-sdk-redesign-phases.md`
- [x] Redesign b-flow to use Pi SDK for isolated worker contexts (2026-05-30) — `.context/2026-05-30.b-flow-sdk-redesign/plan-b-flow-sdk-redesign.md`
- [x] Extract b-save prompt into portable skill (2026-06-05) — slimmed extension to model auto-switch + TPS tracker; b-save became pure skill + prompt. Completed as part of `.context/2026-06-05.extension-slimdown/plan-extension-slimdown.md`
- [x] Implement hybrid context artifact model (2026-06-13) — `.context/2026-06-13.context-format-research/plan-hybrid-context-artifact-model.md`. Built `scripts/context-artifacts.mjs` (scanner, validator, index generator), 41 tests, docs, npm scripts. Review passed clean.
- [x] Add b-fix-rebase-conflict skill (2026-06-16) — `.context/2026-06-16.b-fix-rebase-conflict/plan-b-fix-rebase-conflict.md`. Build + review passed. Files: SKILL.md, rebase-conflict-analyze.ts, test.ts, prompt, symlink, README.
- [x] Skip `.context` review comments in b-pr-review-2-issues (2026-06-17) — `.context/2026-06-17.b-pr-review-2-issues-context-skip/index.md`. Skill now excludes `.context/**` comments by default, except secret-leak reports.
- [x] Add b-init-guardrails skills (2026-07-26) — `.context/2026-07-26.b-init-guardrails/plan-b-init-guardrails.md`. Two skills (`b-init-guardrails`, `b-guardrails-check`): language-agnostic tests+coverage+cyclomatic-complexity guardrails with a brownfield ratchet, managed-block dispatch, and OMP async check dispatch. 5 phases built; 3 review-iteration passes closed dispatch-ownership, `lizard` vendor-dir exclusion, and `diff-cover` compare-branch resolution defects. Review passed clean after live scratch-repo verification.
- [x] [Heal commands/ mirror drift](2026-09/commands-mirror-drift.md) — done 2026-09-18 — all-symlink contract, zero exceptions; drift test `scripts/commands-mirror.test.ts` (2026-09-18.good-ideas plan)
- [x] [Phase 3: Recall Patterns and Docs](2026-09/phase-3-recall-patterns-docs.md) — done 2026-09-28 — live-verified recall/supersede/embedding docs; three iterate rounds closed
- [Add decision closure across Buck Workflow](2026-09/decision-closure-protocol.md) — done 2026-09-30 — six-phase combined sequence (chooser stall verification, shared protocol, grills, plan/phase, build/review, narrative/proof) complete and verified.
