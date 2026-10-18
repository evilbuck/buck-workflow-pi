---
status: active
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
topics: [code-review, end-to-end-proof, packaging, storage-docs]
review_verdict: request-changes
addresses: phase-8-proof-docs-package.md
---

# Plan Path Review: Phase 8 end-to-end proof, docs, and packaging

## Verdict

**Needs work.** The working tree marks Phase 8 completed. That marker is not evidence. The required per-backend OMP workflows were not run, the parent acceptance list was not re-checked, and the changed plan-site surface still advertises a filesystem / future SQL-memory source. Durable guardrails pass. This review does not choose a loop state or change phase/lifecycle metadata.

## Plan Source

- File: `.context/2026-10-10.durable-storage-adapters/phase-8-proof-docs-package.md`
- Goal: exercise complete workflows on all four adapters, run guardrails and install/bundle checks, and document configuration, publication, migration, recovery, and dotfile exclusions.
- Inherited user goal: users choose durable storage per project, resume reliably, and keep unmerged work invisible on other branches.
- Baseline: `08f488880cd2f97b121373151f79f259ab3dbf65` (`feat/storage-adapter`). No upstream is configured. Source-state verification is authoritative. HEAD phase status is `pending`; the unstaged working tree flips it to `completed`.
- References followed: parent plan step 8 and acceptance list, parent assumptions A-1–A-5 and material risks, phases overview, implementation notes. Earlier phase closeouts are context, not new proof of this phase.

## Evidence Sources

- Git status at review start: staged docs/how-to/changelog/notes/draft commit; unstaged phase status flip, overview status flip, and a local adapter-readback note. Those pre-existing changes were not staged by this review.
- Recent commit: `08f4888 feat(storage): implement verified migration cutover and rollback`.
- Modified Phase 8 surface inspected: `docs/howto/configure-storage-backend.md`, `docs/howto/README.md`, `docs/context-artifacts.md`, `docs/CHANGELOG.md`, `docs/sql-memory.md`, `docs/buck-loop.md`, `docs/buck-workflow.md`, `docs/storage/CONTEXT.md`, `AGENTS.md` managed conventions, `docs/plans/src/lib/plans/sql.ts`, `docs/plans/src/pages/index.astro`, `docs/plans/src/layouts/Base.astro`.
- Verification run in this review: `npm run guardrails:check`; `node scripts/install.mjs --verify`; `diff -rq` storage bundle; `omp --version`; `pg_isready`; adapter-backed `createPlanSource()` read of this subject.

## Findings — Spec / Acceptance Axis

### R1. Required live OMP workflows were not exercised — in-plan

Criterion 1 and implementation detail 1 require a real OMP workflow per backend: brainstorm/research/plan → phase → build/review/iterate → save/checkpoint → restart/resume, with exact artifact IDs/revisions and completed attempt receipts, including presentation attachment, retained pass audit, hook memory, and attribution/import cursor.

Current evidence stops at a local script note in `implementation-notes-phase-8.md`: repo-files `2df98bcb-1693-4d49-b755-93b28a0dfd8d`, external-files `8f091399-8526-4bf1-848f-0041d04d56e3`, sqlite `e79bcc40-22c1-40ca-8df5-69949706d119`, shared sha256, and a completed receipt. That is not an OMP session transcript and does not cover restart/resume or the named edge kinds. `pg_isready` returned no server on `/run/postgresql:5432` (exit 2). `omp/18.11.1` is installed; no workflow transcript is in the subject. The same notes still say the four workflows and parent re-walk were not done.

The unstaged phase file and phases overview mark this criterion and the phase completed. Adapter readback of the phase document still reports `status: pending`. Checkboxes are not proof.

Fix: revert the false completion markers. Produce per-backend transcripts that read back exact revision IDs and completed receipts after restart/resume, including PostgreSQL. Do not substitute prior-phase adapter tests.

### R2. Parent acceptance list was not re-checked — in-plan

Criterion 2 requires every parent acceptance item re-checked against live behavior, with parent checkboxes updated and evidence recorded. `plan-durable-storage-adapters.md` acceptance items remain `[ ]` (lines 181–195). Implementation notes say the list was not re-walked. Prior phase closeouts do not satisfy this criterion.

Fix: re-walk each parent item against current behavior, record the command or file:line evidence, and check only items that evidence supports.

### R3. Changed plan-site surface still claims a filesystem / future SQL source — in-plan

The changed reader is adapter-backed. This review's `createPlanSource()` smoke returned `kind: "sql"`, 131 subjects, and this subject's phase file (46 documents). Pages call that factory (`docs/plans/src/pages/index.astro:3-6`).

The rendered copy does not match:

- `docs/plans/src/pages/index.astro:13` — `source: filesystem (.context/)`
- `docs/plans/src/layouts/Base.astro:90` — `filesystem (.context/) today, SQL when the plan-document table lands`
- `docs/plans/package.json:5` — filesystem and SQL memory "interchangeably"

That is the obsolete second-source story. No Astro build was run; the strings are what a build would emit. Fix the copy to name the configured workflow adapter. Do not restore a filesystem union or raw SQL reader.

## Findings — Standards Axis

No additional independent finding. Sequential fallback pass; this harness has no task/sub-agent dispatch tool.

Seed: `skills/code-review-universal/reference/code-review-best-practices.md`, `skills/code-review-universal/reference/code-quality-universal.md`, and diff-scoped `skills/code-smells/docs/comments.md` plus `dead-code.md`. The Phase 8 docs diff is a how-to, index link, XDG correction, and changelog line. The how-to matches `config.ts` XDG defaults (`config.ts:31-32,86-90`). No new abstraction, duplicated procedure, or comment-masked logic in that diff. R3 is a spec-axis false claim, not a style finding.

## Completion Matrix

| Deliverable | Status | Direct evidence / missing piece |
|---|---|---|
| 1. Real OMP workflow per backend with exact IDs/revisions and completed receipts, including restart/resume | ❌ missing | No transcript. Local three-adapter note is not the workflow. PostgreSQL server absent (`pg_isready` exit 2). R1. |
| 2. Parent acceptance criteria re-checked; checkboxes updated with evidence | ❌ missing | Parent list still unchecked at `plan-durable-storage-adapters.md:181-195`. R2. |
| 3. Deterministic suite, guardrails, install, bundle parity, changed plan-site smoke | 🔄 partial | Fresh guardrails pass. Storage bundle `diff -rq` exit 0. Install inventory 22/22. Host `--verify` exit 1 is the known split-root detector, not a missing storage file. Plan-site reader smoke loaded this subject; rendered source labels are still wrong. R3. |
| 4. Storage, publication, migration/recovery, backup, dotfile exclusions, named docs, how-tos, changelog, AGENTS conventions | ✅ complete | `docs/howto/configure-storage-backend.md`; publication/migration how-tos in `docs/howto/README.md:19-41`; backup/export and rescue in `docs/howto/export-storage-snapshot.md` and `docs/sql-memory.md:50-74`; dotfile exclusions in the new how-to and `docs/sql-memory.md:70-74`; `docs/buck-loop.md` nested `workflow_state` boundary; `docs/buck-workflow.md` tool row; staged `docs/CHANGELOG.md` line; `AGENTS.md` managed conventions for workflow_state, publication, and offline cutover. `GLOBAL_OR_PROJECT-AGENTS.md` stays generic by project rule. |
| 5. No dual-write, obsolete raw-SQL recall, or second active memory store | ✅ complete | `extensions/sql-memory/index.ts:409-411` `wire()` registers nothing. `extensions/index.ts` registers `workflow_state`, not a SQL recall tool. `doctorLegacySql` returns `adopt: false`. Save mode treats `SQL_MEMORY_URL` as a receipt gate, not a pool or second store (`docs/sql-memory.md:8-12`). R3 is stale copy, not a second runtime store. |
| Blocking assumptions assigned to this phase | ✅ complete | Parent A-1–A-5 are `validated` and non-blocking. Phase 8 restates none as unresolved. |
| Material rollback/fallback this phase must validate | 🔄 partial | Earlier risks stay with their phases. This phase's integration-gap risk is open because R1 was not run. Risk 6's exclusion list is documented; no chezmoi file was edited, matching the plan. |
| False completion markers | ❌ missing | Unstaged phase and overview say completed. Adapter-visible phase status is `pending`. Revert until R1–R3 have evidence. |

## Verification Evidence

### Guardrails

`npm run guardrails:check` — durable v2, runner 1.0.0, status **pass**.

- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`
- Coverage 88% vs baseline 84%, target 90%; patch null under advisory enforcement
- Complexity 29 hotspots vs baseline 30; no new or hard-ceiling violations
- Proposed ratchet updates were not applied

A passing suite does not prove the unrun OMP workflows.

### Install and bundle

`node scripts/install.mjs --verify`: 22 shipped storage files ok, then exit 1. Split roots are this host's pre-existing links to `buck-workflow-pi` and `~/.pi/agent`, not missing package files. Do not relink the operator home as a Phase 8 fix. Historical installer closeout already records this detector behavior.

`diff -rq skills/_shared/storage plugins/buck-workflow/skills/_shared/storage` exit 0, empty. `workflow-state.ts` and `workflow-state-cli.ts` match their bundle copies.

### Plan-site reader

```json
{"kind":"sql","subjectCount":131,"target":{"name":"2026-10-10.durable-storage-adapters","status":"active","docs":46},"phaseFile":{"file":"phase-8-proof-docs-package.md","status":"pending"}}
```

No `npm run build` in `docs/plans`. Limit: reader path exercised; browser render not observed. Source labels in R3 would still render.

### Runtime availability

`omp --version` → `omp/18.11.1`. `pg_isready` → `/run/postgresql:5432 - no response`, exit 2.

## Review Axes

- Spec axis worst finding: **R1**, the required four-backend OMP proof does not exist. R2 independently blocks the parent re-check. R3 is a separate surface defect.
- Standards axis worst finding: **none**. Sequential fallback pass.
- Cross-axis ranking: **none**.

## Verification Status / User Goal Analysis

- Goal achieved: **partial**. Docs and the no-dual-write runtime are in place. The integration proof this phase exists to produce is absent.
- User goal: **partially met** by earlier phases' adapter, visibility, and cutover work. This phase does not add live resume proof across all four backends.
- Scope adhered: yes for the docs delta. Out-of-scope changes: none identified in the Phase 8 delta. Unrelated pre-existing staged files were left untouched.
- Goal mode: `.context/workflow/current-session.json` has no `goal` field. Its subject pointer is an older subject and does not override this phase.

## Guardrails Verdict

- Contract: **durable**
- Contract version: **2**
- Status: **pass**
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`

## Documentation Impact

No additional documentation impact. Configuration, publication, migration/recovery, backup, and dotfile exclusions are already written. R3 is an in-plan surface correction, not a separate `/b-docs` route.

## How-to Impact

No how-to impact. `docs/howto/configure-storage-backend.md` is the missing selection guide and is indexed. Publication, export, cutover, resume, and rollback how-tos already exist.

## Issue Classification

- In-plan issues: **3** (R1, R2, R3) → `/b-iterate` on `iterate-phase-8-proof-docs-package.md`
- Out-of-plan issues: **none**

## Completion Audit

1. Deliverables are the five phase acceptance criteria plus the parent re-walk and packaging checks.
2. Each row above cites current files or commands run in this review.
3. Checkboxes and `status: completed` were not treated as proof. The adapter-visible phase status is still `pending`.
4. Guardrails, install inventory, bundle diff, and the plan-site reader were run. OMP workflow and Astro build were not. PostgreSQL was unavailable.
5. Missing transcripts are missing, not complete.
6. Both axes finished. No phase or loop transition was selected.

## Recommended Next Step

Supervisor: run `/b-iterate` on `iterate-phase-8-proof-docs-package.md`, then re-review this phase. Do not save or commit Phase 8 as complete. Review deliverables are this report and the iteration artifact only.
