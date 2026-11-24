---
status: active
date: 2026-11-23
domains: [testing, orchestration, workflow]
topics: [b-full-orchestration, dispatch, alias-resolution, restart-safety, fixture-verification]
related: [plan-resume-safe-orchestration.md, review-b-full-orchestration.md]
priority: high
subject: 2026-11-23.full-orchestration-review
artifacts: [skills/b-full-orchestration/SKILL.md, skills/b-full-orchestration/references/run.md, skills/b-full-orchestration/references/stage-map.md]
---

# Fixture verification: dispatch + resume-safe orchestration

Disposable checkout: `~/projects/.worktrees/buck-workflow-pi/feat/orchestration-fixture` (branch `feat/orchestration-fixture`, commit `65d5b7d` = rewritten skill alone on top of `7dd702f`). All worker operations were confined to that worktree; the main checkout was never touched by fixture work.

## 1. Static dispatch check (RED → GREEN)

`/tmp/check-dispatch.py` (throwaway, kept out of the repo).

- RED (pre-rewrite tables): 17 targets; `b-build-hard` and `b-commit` FAILED (no `skills/b-build-hard/`, no `skills/b-commit/`, no alias mapping); hard-difficulty signal MISSING; exit 1.
- GREEN (post-rewrite, fixed alias regex — pipe-column rows carry no hyphen before the path): 18 targets, all `ok`; `b-build-hard -> skills/b-build/SKILL.md`, `b-commit -> skills/git-commit/SKILL.md`; hard-difficulty signal present; no synthetic `skills/b-build-hard/` or `skills/b-commit/` directories; exit 0. 18th target `b-plan-update` covers the "covering artifact answers plan open questions" edge.

## 2. Infrastructure probes in the worktree

- `workflow-state-cli.ts write` + `read` round-trip: OK (~2.2 s each; smoke artifact under subject `fixture-smoke`, revision `3382b227-…`).
- `workflow-state-cli.ts list` / `discover`: hangs/unbounded with 828+ `.context` entries (pre-existing CLI perf issue; also seen by CaseAPlan worker). Out-of-plan finding, not fixed in this slice.
- `subject-lifecycle.ts inspect|initialize|activate|close-verified`: OK in the worktree (node_modules symlinked).

## 3. Outer intake edges (real workers)

### Case E — named missing external fact → research → plan → relay once → plan-update

Dispatch order (all real `task` subagents):

1. `CaseEResearch` (b-research): subject `.context/2026-11-23.agent-skills-standard/`; answer cites https://agentskills.io/specification, https://agentskills.io/llms.txt, https://github.com/agentskills/agentskills/tree/main/skills-ref.
   - Defect caught by the evidence rule: first return claimed four artifacts but only `index.md` existed (its `write` calls had resolved relative paths against the main checkout). Rejected per "a subagent summary is not evidence"; worker recovered content into the worktree and deleted only its own misplaced folder from the main checkout (verified absent). This validated the reject-unverified-artifact transition with a real failure, not a simulated one.
2. `CaseEPlan` (b-plan, same subject reused): plan `plan-agent-skills-standard.md` with the material question recorded verbatim (line 49), options + consequences, blocked section. No second research pass.
3. Supervisor relayed the question once; fixture user answer: "Document both, one short paragraph each."
4. `CaseEPlanUpdate` (b-plan-update): revised in place — answered-questions section, step 2 unblocked, open-questions section removed, revision log appended. Verified by grep: question now under `## Answered questions`; remaining "Open questions (BLOCKING)" match is historical (revision-log line only).

### Case B — phased plan

`CaseBPlan` (b-plan): subject `.context/2026-11-23.orchestration-restart-safety-note/`; `plan-orchestration-note.md` + `-phases.md` + `phase-1-restart-safety.md` + `phase-2-evidence-section.md`; phase 2 HARD-depends on phase 1; both phase statuses `pending`; subject `active` (revision 2, canonical). Verified by direct read.

### Case A — clear feature, no prior artifacts

`CaseAPlan` (b-plan): subject `.context/2026-11-23.orchestration-readme-pointer/`; plan `plan-readme-orchestration-pointer.md`; four unchecked acceptance criteria verified by direct read; subject `active` (revision 2, canonical).

## 4. Run machine (real run workers, nested stage dispatch)

In progress — sections below are filled as workers return.

### Case A run (unphased, final run)

- `CaseARun` run worker dispatched with start-stage hint `build`, final run `yes`.
- Nested stage workers confirmed spawning (`CaseARun.CaseARunReview` observed).

## 5. Run machine — Case A (unphased plan, end-to-end with real restart)

First run (`CaseARun`): build verified (README +1 row exactly), review Pass cycle 1 **retained through workflow_state** — revision `e8ab44f1-a1ba-4e47-9d54-4c34b649b755`, sha256 `de8a14a0cb8256070b85f3e2451b1851687cfec243c61e13344a7ec6a9779c36`, implementation fingerprint `git hash-object README.md` = `1bd655f10da0012af658bbef651a2af646ccb13e`. Save blocked (see incident below) → returned a **blocked run** with durable partial state and restart entry point `enter → save`. No commit was made by the blocked run — the blocked-run-does-not-commit rule held under a real block.

Supervisor independently re-verified before restart: README diff exactly one row, all 4 acceptance boxes `[x]` with evidence, retained review read back with matching sha256, fingerprint unchanged.

Restart run (`CaseARestart`, fresh worker, no chat history, hint `save`): **reused the retained review — no review worker dispatched** (unchanged-content reuse criterion), re-verified it itself via CLI mid-run, then finalize (plan `status: completed`) → `close-verified` (state `completed`, `verifiedClosed: true`, blockers `[]`, lifecycle revision 3) → commit preparation → nested `b-commit` stage worker. **Commit `05ca4e8a7ee1d99da42799d367609766b71f84f1`** on tip of `feat/orchestration-fixture`, parent `65d5b7d`, 11 files +164/−0, fixture-scoped paths only, unrelated dirty paths untouched, not pushed. Supervisor re-verified commit, lifecycle, and clean tree.

Out-of-plan finding by the restart worker, fixed in-run: `.context/memory/index.md` gained a row linking a nonexistent `.context/memory/orchestration-readme-pointer.md`; the worker created the mirror file so the committed index has no dangling link.

## 6. Save-slot incident (real failure, root-caused)

Running two run workers concurrently (Cases A and B) livelocked the repo-level single save-attempt slot (`.context/workflow/sql-save-attempt.json`, one slot per branch). Findings, all real:

1. **Save serialization is per-branch, not per-orchestration.** Two independent orchestrations on one branch cannot overlap at save. The skill's step 5 serializes runs within one orchestration; cross-orchestration concurrency on one branch still needs dispatch-level serialization.
2. **Native `workflow_state` calls from subagents spawn bun children under the OMP host pid**, invisible to the calling agent's pgrep; agents misattributed them to "a foreign omp session" and killed legitimate work, deepening the livelock. Attribution must use `/proc/<pid>/environ` PI_SESSION_FILE, not ppid.
3. **The file-store lock records the writing process's pid; host-in-process writers record the host pid**, so an abandoned lock looks alive for the host's lifetime (dead-holder reclaim never fires). Two manual stale-lock removals were needed (backed up to /tmp).
4. **`SQL_MEMORY_URL` is globally exported on this machine**, so `save-apply.ts`'s `sqlMemoryMode()` gate selects the durable SQL path even for this repo-files-adapter project outside any `/buck-loop` — the gate ignores per-project adapter selection. `env -u SQL_MEMORY_URL` restores the correct file-mode path, which sealed CaseA's save cleanly (memory + subject index applied, lifecycle canonical).
5. The machine-global manifest bloated ~5 MB → 75 MB during the contention; every store open then cost 2–3 minutes. Store backup: /tmp/repo-manifest-backup-1905.tgz. Half-open durable SQL attempts for fixture subjects remain as harmless residue in that store.

Trial note: the supervisor performed two infra interventions (stale-lock removal; one file-mode `save-apply` from the staged payload) — recorded as incident handling, not stage execution; the restart run worker re-verified everything itself before committing.

User corroboration (2026-11-23 ~20:10): storage tested separately from another machine — healthy. The manifest bloat and lock timeouts are host-local session artifacts, not store corruption.

## 7. Case B — phased plan end-to-end

`CaseBPlan` produced the two-phase plan (phase 2 HARD-depends on phase 1). Phase-1 first run (`CaseBRunPhase1`) built `docs/orchestration-note.md` and passed review, then got entangled in the save-slot incident; its save child was recalled after misattributed process-killing. Fresh restart worker (`CaseBRestart`, hint `save`): phase-1 retention not in file-mode scope → dispatched a fresh review (cycle 2, Pass, revision `09b5bd47-1fc2-432c-929a-e58f8460ab2a`, fingerprint matched) → finalize (subject left open) → save → **commit `350ab7c6975b90cceba408ca2b024a56b5418ac2`** (parent `05ca4e8`, 12 files). Sole remaining lifecycle blocker was phase-2 pending — correct intermediate-run semantics.

Phase-2 final run (`CaseBRunPhase2`): build (append-only `## Evidence`) → review cycle 1 retained (`f08deaa2-5a45-45e0-bbdd-e88c674677b3`) → finalize → save → closeout (`close-verified`) → **commit `0a97b13eb072df94a5ffaea01983378e46ce1ca1`** (parent `350ab7c`, 9 files, +93/−11 subject bookkeeping only; phase-1 content byte-identical). Supervisor re-verified commit, append-only diff, and closure (`state: completed`, `verifiedClosed: true`, blockers `[]`).

## 8. Trial battery on the phase-2 boundary (T2–T5)

Setup for each: `git reset --soft 350ab7c && git restore --staged .` — worktree keeps the completed phase-2 state, history drops its commit, so the completion check fails and the machine re-enters the run (verified completion is checked before the task label, and a phase counts as complete only via its commit).

**T2 — open criterion blocks completion (worker `TrialT2OpenCriterion`).** One acceptance box unchecked + phase status `in-progress`. The worker entered at save, found save evidence current, reused the retained review (fingerprint match, no re-review), reached closeout — and returned BLOCKED: no box checked on the builder's behalf, no commit, HEAD unchanged at `350ab7c`. Real defect found: `subject-lifecycle.ts close-verified` returned `verifiedClosed: true` while still listing `phase-2-evidence-section.md: phase is not completed` — the worker correctly preferred the machine's own completion definition (all boxes `[x]`) over the self-contradictory boolean.

**T3 — changed bytes invalidate the retained review (workers `TrialT3Invalidation` + `TrialT3Complete`).** With the box restored and one sentence appended inside the slice file (fingerprint `aa448036…` → `72d0002b…`), the fresh run dispatched a NEW review (cycle 2, `review-phase-2-cycle-2.md`) instead of reusing cycle 1 — the re-review-on-change criterion. Completion then landed as **commit `41da634e6091b90ad801a2fd2d5075f46f2602ec`** (parent `350ab7c`, 9 paths). Store retention of the cycle-2 verdict degraded to the file artifact + a saved retention payload after host-local lock timeouts (recorded in `memory/storage-degradation-2026-11-23.md`); closeout re-inspected clean with no self-contradiction.

**T4 — inseparable same-file content refuses to commit (worker `TrialT4Inseparable`).** An unrelated hand-edit appended to `.context/memory/index.md` — a commit-required repo-projected record whose required hunks cannot be separated from the foreign one. The worker re-verified review currency, re-entered at the commit boundary, and stopped before mutation: no `git add`, no commit, HEAD `350ab7c` unchanged, `git status --porcelain` byte-identical before/after (`cmp` clean), nothing repaired, no iterate dispatched.

**T5 — scoped commit excludes unrelated staged work (worker `TrialT5ScopedCommit`).** Foreign line removed by its owner; an unrelated `AGENTS.md` change staged by the supervisor. The worker staged exactly the 8 candidate paths, committed **`a9440e16deb574f12528e9b26d5852d7e998e0ca`** (parent `350ab7c`; 8 files +36/−15; zero `AGENTS.md` hunks), and left `AGENTS.md` staged with an identical blob (`5c99858…`). Supervisor re-verified all three.

## 9. Quick fix (T6)

**First invocation** (worker `TrialT6QuickFix`): task "Create `docs/fixture-done.txt` containing exactly one line: 'Fixture complete.'" with no plan. Run shape: enter → iterate (`b-iterate` created the file) → review pass retained (`t6-quick-fix-review` revision `1cfd666a-e7ee-41f6-8d2d-0a22491c0694`, fingerprint match) → save checkpoint retained (`fdcbf843-0001-48f6-8999-e73e0383d04c`) → **commit `c274dfe06a223aac1c15472adeb35d76808bb4ee`** (parent `a9440e16`); subject left open — quick-fix runs have no closeout edge. `AGENTS.md` remained staged and untouched.

**Second invocation** (supervisor-level outer detection): implementation exists (`docs/fixture-done.txt` = "Fixture complete."), completion proof = commit `c274dfe` at tip containing the declared file → verified completion before the task label → close, **no run worker dispatched, HEAD unchanged**. CLI hardening findings from this run: the file-mode CLI serialized a JSON-object `body` as `[object Object]` (fixed via a `correct` request with `predecessorRevision` + `idempotencyKey`), and `--help` parses "help" as JSON.

### Case B phase-1 run (restart trial base)

- `CaseBRunPhase1` dispatched with hint `build`, final run `no`.
- Observed progress: build+review passed clean → review retention via workflow_state → save.

## Out-of-plan findings so far

1. `workflow-state-cli.ts list`/`discover` unbounded/hangs on large `.context` trees (pre-existing).
2. b-plan reuse of an existing subject clobbered `index.md` lifecycle frontmatter (`inspect` → `state: missing, canonical: false, revision 0` for Case E subject, while content blockers still derived correctly). b-plan convention gap, outside this slice's scope.
