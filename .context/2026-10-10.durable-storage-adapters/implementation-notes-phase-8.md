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

- Local adapter readback on 2026-10-16, `bun /tmp/phase8-proof.mjs`: repo-files revision `2df98bcb-1693-4d49-b755-93b28a0dfd8d`, external-files `8f091399-8526-4bf1-848f-0041d04d56e3`, sqlite `e79bcc40-22c1-40ca-8df5-69949706d119`. Each read back the same sha256 `336a53b29ad5d8ce4a8a0cdcb8cac8585c5116227aba0647b10d7b6eb24b3b1f` and a completed receipt. Postgres was not exercised: `pg_isready` reported no server on `/run/postgresql:5432`.

## Outstanding acceptance evidence

- Phase 2 postcondition is clear (`status: completed`, six `[x]` boxes). The loop cap was raised to 48 after it had stopped at 36/36. Resume then built phase 8 twice (loops 37 and 38) and blocked both times: postcondition ambiguous, Jev heavy lift. Projection remains `blocked` 38/48 on `phase-8-proof-docs-package.md`.
- A phase 8 build rewrote phases 5–7 to `pending` in the store and stripped their repair notes. Those three were restored from `HEAD` (`4675ce9d-5399-4cba-8d15-e71f6dbc32d4`, `0c6570f7-7cb0-431a-887d-b1d372d1060e`, `3c36661f-0a88-4b87-ba97-eb35d935886a`). Do not resume while the store shows them pending.
- Isolated SQLite OMP workflow, clone `/tmp/phase8-omp/clone-sqlite`, project `workspace-3d877d93bd4fb1cbb93467941cbecc0ad6f3f21d5c0b818ec2096f4b53c291ed`, config database `/tmp/phase8-omp/clone-sqlite-state.sqlite`. `/buck-loop` ran build → review → docs → save. It blocked on `SQL save receipt project does not match the current Git project` because a `file://` origin appeared; after `git remote remove origin`, resume reached `done` / `all phases completed`. Transcript: `/tmp/phase8-clone-sqlite.log`. Commit of `proof.txt` containing `ok` is in that clone, not this branch.
- That adapter does **not** hold the completed phase or a completed attempt receipt. Visible phase revision `472a4cdf-1293-471b-adf3-94e00aa3c9ca` is still `status: pending`. `artifact_runs` is empty. The save receipt file `b886cfec-d932-4407-ab25-a1deff62ce48-009e29ca-86d5-4ec4-928b-5eb29e061827.json` says `completed: true` and id `01a14484-f1d6-7661-bc27-4b6acef5c775`, but that id is not in the selected SQLite database. A fresh process readback therefore cannot return the completed phase revision. Do not check criterion 1 from this run.
- Postgres for a later proof is the `phase8-pg` container on `127.0.0.1:54329` (user `phase8`, database `phase8`). It was not used for an OMP workflow.
- Parent plan acceptance boxes at `plan-durable-storage-adapters.md:181-195` are still `[ ]`. Criterion 2 is open.
- Phase 8 boxes stay unchecked. Another resume will heavy-block again until the four adapter transcripts read back the same revision ids and a completed receipt from the selected adapter.
