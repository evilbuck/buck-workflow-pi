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
