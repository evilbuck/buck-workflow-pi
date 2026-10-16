---
status: active
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
domains: [storage, testing, docs]
topics: [end-to-end-proof, packaging, storage-docs, phase-8]
related: [phase-8-proof-docs-package.md, plan-durable-storage-adapters.md]
priority: high
---
# Phase 8 proof and packaging findings

## Verified so far

- OMP CLI is installed (`omp --version` → `omp/18.11.1`), but this session provides no OMP workflow interaction surface for carrying out the required live brainstorm/research/plan/build/review/iterate/save/checkpoint/restart workflows.
- Storage documentation specifies config schema and precedence, four adapters, publication and rewrite mapping, cutover/export/rollback, privacy/dotfile exclusions, `docs/sql-memory.md`, and migration/publication how-tos. Added the missing initial backend-selection guide and linked it in the how-to index. The docs previously claimed external/SQLite defaults ignored `XDG_CONFIG_HOME`; implementation uses the XDG base, so both the architecture doc and how-to now match the config resolver.
- `node scripts/install.mjs --verify` found all 22 shipped storage files. It also reported pre-existing machine bootstrap/command link drift; verification mode made no installation changes.
- `npm run test:sqlite-runtime` passed its Node v26.8.1 and Node v26.3.0 transaction smokes.
- `npm run context:validate` exited after reporting warnings on unrelated historical artifacts. No plan-site read path was changed in this assignment; this command is not plan-site surface evidence.
- Focused receipt CLI tests passed: `npx vitest run skills/_shared/scripts/workflow-state.test.ts -t 'honors a project override|completes independent saves' --reporter=verbose` → 2 passed, 12 skipped.
- Isolated `workflow-state-cli.ts doctor` smoke with a temporary project config selected `sqlite` and reported `projectConfigured: true`; config and isolated identity state were removed.
- `npm test` passed on an isolated run: Vitest 2,156 passed / 47 skipped (120 files passed / 1 skipped); Bun 70 passed; SQLite Node transaction smokes passed on v26.8.1 and v26.3.0.
- `npm run guardrails:check` final verdict: `pass` under durable v2. Required unit/global-ratchet/complexity gates passed; coverage 88% vs 84% baseline, 29 hotspots vs baseline 30, no new or hard complexity violations. Functional/lint are disabled and skipped; patch coverage is advisory with no patch result.
- The first concurrent `npm test` and guardrails run failed the unit gate with five-second Vitest timeouts in subprocess-heavy buck-loop/workflow-state tests. The isolated full test suite and rerun guardrails passed. Error output included an expected receipt rejection from a negative test; focused receipt tests passed, so no receipt defect was established.

## Outstanding acceptance evidence

- The four real OMP backend workflows, exact artifact/revision and complete attempt receipt readback, and restart/resume transcripts have not been exercised. OMP is present as a binary, but this coding session cannot drive an OMP session; no real transcript is available to cite.
- The parent plan's full acceptance list has not been re-walked against live per-backend behavior.
- Phase 8 acceptance remains unchecked. Do not infer completion from prior phases' adapter/migration tests or documentation.
