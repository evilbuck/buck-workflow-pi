---
status: completed
date: 2026-07-10
subject: 2026-07-10.buck-workflow-implementation-audit
topics: [buck-workflow, architecture, documentation, prompts, skills, consistency]
informs: [plan-buck-workflow-contract-remediation.md]
---

# Buck Workflow Implementation Audit

## Scope

Whole-system, read-only analysis of canonical skills, prompt/command entrypoints, workflow documentation, lifecycle transitions, artifact contracts, and cross-harness execution guidance.

## Architecture observed

Buck Workflow's intended layering is sound:

1. `skills/` — canonical, portable workflow behavior.
2. `prompts/` and `commands/` — agent-native invocation surfaces; the OMP command tree is mostly a symlink mirror of Pi prompts.
3. `extensions/` — minimal runtime hooks for behavior that prompts cannot provide.
4. `.context/` — durable state and evidence across turns/sessions.

The canonical implementation cycle is:

`build → review → iterate if in-plan defects → review again → docs if impact → save → stage → commit`

Planning, phasing, presentations, PR/issue handoffs, and OMP execution modes branch around that cycle. `orchestrate`, `workflow`, and goal mode are correctly modeled as user-toggled execution envelopes, not workflow stages.

## What is working well

- Core skill decomposition is understandable; `b-build-hard` correctly parameterizes `b-build` rather than cloning it.
- `b-review` cleanly separates in-plan defects, out-of-plan discoveries, and non-blocking documentation impact.
- Prompt/command mirroring is healthy for most entrypoints; 20 command files are real symlinks, with two deliberate regular-file exceptions.
- `b-flow` is not wired into `package.json`; the current architecture correctly avoids another hidden extension orchestrator.
- Subject folders, memory, backlog, and cross-links provide a strong durable-state foundation.
- OMP modes are recommendations only; the user must explicitly activate them.

## Highest-priority findings

### P0 — State-machine correctness

1. **Phase verification can target the wrong phase.** `b-build` marks a phase `completed` before `/b-review`; a no-argument review then resolves the first non-completed phase, i.e. the next one (`skills/b-build/SKILL.md:273-285`; `skills/b-review/SKILL.md:26-33,72-79`).
2. **Passing review has no durable record.** Failures create `iterate-*.md`; passes live only in chat. Save/commit cannot prove the review gate passed. This is the same traceability problem represented by the active plan-implementation-ledger backlog item.
3. **`b-save` does not perform its declared subject-close transition.** Shared resolution assigns `b-save` ownership of `index.md: status: completed`, but neither the skill nor prompt implements it. Plans and subjects can remain active forever (`skills/_shared/subject-resolution.md:89-94`; `prompts/b-save.md:6-42`).
4. **The save→commit edge omits staging.** `git-commit` refuses to stage and reads staged changes only, while `/b-save` writes new context files immediately before `/b-commit` (`skills/git-commit/SKILL.md:12-24`). The documented flow needs an explicit staging gate.
5. **Draft commit selection is unsafe.** `git-commit` selects the most recently modified subject with `ls -dt`, bypasses shared subject resolution, and skips diff analysis entirely when a draft exists (`skills/git-commit/SKILL.md:27-47`). It can use a wrong or stale draft.

### P0 — Executable contract drift

6. **Generated OMP workflow cells target an obsolete eval API.** Repo docs/templates were verified against OMP 15.10.0 and use `llm`, `agent_type`, and `from prelude import`; current OMP 16.3.15 exposes `completion`, `agent=`, and injected helpers. `b-plan` emits executable files from the stale template (`docs/eval-kernel.md:1-44`; `skills/b-plan/SKILL.md:256-393`).
7. **`b-plan` can mis-detect OMP.** It treats the package's always-present `package.json.omp` metadata as runtime evidence; `b-loop` explicitly warns that this is invalid (`skills/b-plan/SKILL.md:219-229`; `skills/b-loop/SKILL.md:73-90`).

### P1 — Portability and autonomous execution

8. **`b-build` is repository-specific despite being the portable core.** It hardcodes Vitest, Playwright, npm scripts, localhost:3000, tmux, and this repo's test layout; it also treats every JS/TS file as UI (`skills/b-build/SKILL.md:13-37,60-93,121-219`).
9. **`b-build` always asks for approval.** Mandatory interface/test confirmation and plan approval conflicts with approved plan execution and OMP no-yield modes (`skills/b-build/SKILL.md:60-68`).
10. **The model-switch extension ignores the resolved subject.** It chooses the lexicographically newest phases overview across `.context/`, not the explicit/current subject (`extensions/index.ts:105-150`).
11. **Current-session ownership is unclear.** Skills claim a plugin tracks the session, current docs/tests say session injection was removed, and different skills opportunistically create/read the JSON.

### P1 — Contract/schema integrity

12. **Artifact validation is incomplete.** Only memory, subject index, research, generic plan, and backlog items have schemas. Phases, iterations, specs, brainstorms, grill sessions, and draft commits are unvalidated (`scripts/context-artifacts.mjs:66-100,172-186`).
13. **Phase overviews are misclassified as generic plans.** They match `plan-.*` but do not carry the generic plan's required fields, guaranteeing warnings while leaving phase-specific invariants unchecked.
14. **Status vocabularies conflict.** The installable bootstrap says every artifact is only `draft|active|completed` and forbids `in-progress`, while memory permits `superseded` and phase files require `pending|in-progress|completed` (`GLOBAL_OR_PROJECT-AGENTS.md:55-74`; `skills/b-phase/SKILL.md:152-178`).
15. **`b-save` violates the thin-wrapper model.** Its prompt is the full executable contract while its skill is a second, shorter contract. `b-pr` and `b-pr-review-2-issues` also duplicate policy rather than purely loading skills.
16. **Recommendation logic is duplicated.** `b-plan` and `b-loop` have different harness detection, rule order, and mode precedence; goal-mode audit text is separately duplicated in `b-review` and `omp-goal`.

### P1 — Documentation and discoverability

17. **Primary diagrams are semantically broken.** Mermaid IDs are reused for unrelated nodes, `/b-present` routes into implementation review, and both major diagrams stop before `/b-commit` (`docs/buck-workflow.md:175-241,269-309`).
18. **README completion claims conflict with durability.** It says `/b-build → /b-review` can be “done” and includes `/b-plan → /b-review` despite review explicitly not reviewing plans (`README.md:9-17,214-224`; `docs/buck-workflow.md:923-925`).
19. **Live `/b-*` wrappers are documented as skill-only.** `/b-phase`, `/b-grill-me`, and `/b-grill-with-docs` exist in both prompt/command trees but docs advertise only `/skill:*`.
20. **Loading docs are stale.** Counts, Pi filter examples, and the stated `omp` manifest fields no longer match the repository (`docs/extension-loading.md:105-138`; `package.json:13-33`).
21. **Cross-platform guidance describes removed extension behavior.** It claims `b-save`, `b-mode`, and `b-restrict` are still registered/runtime-owned (`skills/cross-platform-pi-omp-loading/SKILL.md:88-106`).

### P1 — Advertised but incomplete supporting surfaces

22. **`b-auto-fix` stages work but does not execute it.** The CLI writes stage/completion JSON and exits; it never runs agents or commits. Its exported success path assumes external work already exists (`skills/b-auto-fix/scripts/auto-fix.ts:398-559`).
23. **`b-grill-auto` delegates to an unwired command and an unusable helper.** The checked-in skill is documentation-only despite being advertised as runnable; `skills/b-grill-auto/grill.py` exists but fails Python compilation because literal patch-marker `+` lines remain (`skills/b-grill-auto/SKILL.md:6-10,155-180`; `grill.py:144`).
24. **`b-blueprint` advertises `/b-blueprint` without a prompt/command entrypoint.** `/skill:b-blueprint` works; `/b-blueprint` does not.
25. **`b-loop` is intentionally skill-only but absent from current workflow docs.** This is tracked debt, not an accidental missing file.

## Recommended improvement sequence

1. **Make phase completion review-owned.** Keep Phase N `in-progress` through build; persist a review-pass record tied to the phase; only then complete overview/phase state.
2. **Repair the closeout transaction.** `b-save` must complete plan/subject state, promote the next backlog phase when appropriate, and emit a staging checklist; `b-commit` must resolve the active subject safely and validate any draft against staged reality.
3. **Update OMP integration against 16.3.15.** Replace stale eval helpers/signatures, test a generated cell in the real eval kernel, remove package-metadata runtime detection, and centralize mode recommendation/audit contracts.
4. **Make `b-build` project-adaptive.** Discover test framework, UI boundary, dev-server command, and focused verification from the target repo; remove unconditional approval.
5. **Create one artifact-schema registry.** Cover spec, phase, overview, iterate, brainstorm/grill, review-pass, issue, and draft-commit artifacts; generate validator/docs/status tables from it.
6. **Restore the canonical-skill rule.** Convert `b-save`, `b-pr`, and `b-pr-review-2-issues` prompts to thin wrappers; centralize OMP tables/protocols in `_shared/`.
7. **Regenerate workflow docs from inventories/contracts.** Fix diagrams, show the staging edge, distinguish optional stages and skill-only surfaces, explain regular command exceptions, and stop maintaining hand-written counts.
8. **Resolve or retire incomplete entrypoints.** Conservatively retire incomplete `b-auto-fix` and `b-grill-auto` from active discovery unless a separate supported runner contract is approved; add the promised `b-blueprint` slash mirror; complete residual b-flow deprecation (`subject-resolution` fallback, dead `xstate`, directory banner).

## Lower-priority gaps

- Phased backlog promotion has no explicit owner after Phase 1.
- `b-pr-review-2-issues` keeps the secret-leak exception only in the prompt, not the canonical skill.
- QMD is documented as optional but `b-save` instructs agents to load/re-index it unconditionally.
- Protected-branch summaries omit `dev` even though `git-commit` protects it.
- `b-review` is described as read-only despite its intentional iterate-artifact write exception.
- OMP observation stubs say “You are now in mode” even though they do not toggle the mode.

## Evidence and rolling notes

Detailed file-by-file evidence is in `research/notes-workflow-implementation-audit.md`.

## Verification performed

- Context validator: `62 warning(s), 0 errors`; phased overview files appear as generic plans.
- Artifact validator tests: `41 passed`.
- Direct classifier smoke: overview=`plan`; phase/iterate/spec=`null`.
- Live OMP eval smoke: `completion` and `agent` exist; `llm` is undefined.
- Command mirror inspection: 20 symlinks, 2 deliberate regular wrappers.
- Markdown diagnostics: clean for project docs, README, bootstrap, and exploration artifacts.
- Planning follow-up smoke: `python3 -m py_compile skills/b-grill-auto/grill.py` fails at line 144 on a literal `+`, confirming the helper is checked in but unusable.
