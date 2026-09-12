---
cluster: PLANNING & SCOPING
skills_covered: 10
---

## Verdict

- This cluster turns fuzzy intent into **bounded, file-backed work artifacts** in `.context/YYYY-MM-DD.<subject>/`, never touching application source.
- The spine runs **intake → requirements (optional) → plan → phase (optional) → visualize → build**; sibling clusters own build, research, git, and interview/UX.
- **Subject folders** with `index.md` status (`draft` | `active`) are the shared entrypoint every skill resolves through `skills/_shared/subject-resolution.md` (`skills/b-plan/SKILL.md:91-97`, `skills/b-phase/SKILL.md:24-27`).
- **b-phase** is the dependency engine: it maps HARD/SOFT/NONE edges between phases, not just a numbered list (`skills/b-phase/SKILL.md:88-110`).
- **b-loop** stamps autonomous-loop *recommendations* only; it never drives execution (`skills/b-loop/SKILL.md:17-22`, `skills/b-loop/SKILL.md:370-377`).
- The most distinctive mechanic is **dual artifact types at plan time**: tactical `plan-*.md` vs strategic `spec-*.md`, with NASA-hardened requirements upstream (`skills/b-plan/SKILL.md:279-280`, `skills/b-nasa-prd/SKILL.md:19`).

## Skill Table

| Skill | Invocation | Input | Output (exact paths) | Workflow position | Distinctive mechanic |
|---|---|---|---|---|---|
| b-brainstorm | Skill load when starting scoping; no slash mirror in SKILL body | User topic; optional existing subject via subject-resolution | `.context/YYYY-MM-DD.<subject>/index.md` (`status: draft`), `brainstorm-<slug>.md`, `brainstorm-state-<slug>.json` | **Before** b-plan; **after** nothing required; user may manually edit draft | One-question-at-a-time interview (~4 soft cap); SHA256 sidecar detects external edits (`skills/b-brainstorm/SKILL.md:39-45`, `skills/b-brainstorm/SKILL.md:99-111`) |
| b-plan | `/b-plan` or skill name; **Active Capability Probe runs first** | User/session context; optional `brainstorm-*`, `research-*`, `spec-*`; code reads | `.context/YYYY-MM-DD.<subject>/index.md` (`status: active`), `plan-<topic>.md` and/or `spec-*.md`; full mode may add `.context/backlog/items/<slug>.md`, `eval-<topic>.py` | **After** brainstorm/research/spec/nasa-prd; **before** b-phase, b-build, b-present, b-blueprint; recommends b-phase when large | Loader-native probe for `b-build`/`b-review`/`b-save` gates full vs standalone mini-workflow (`skills/b-plan/SKILL.md:17-63`); optional Light Grill (3–10 Qs) (`skills/b-plan/SKILL.md:190-237`) |
| b-plan-update | Skill when revising existing plan | Existing `plan-*.md`; session context; mockups/screenshots/research copied into subject | Same `plan-<topic>.md` in place; `## Revision Log` appended; assets → `.context/<subject>/assets/` | **After** b-plan; **before** b-build/b-phase re-run; flags stale phases | Implicit removals gated behind numbered review menu; never edits phase files (`skills/b-plan-update/SKILL.md:82-102`, `skills/b-plan-update/SKILL.md:160-168`) |
| b-phase | `/skill:b-phase` or after writing `plan-*` | `plan-*.md` in subject folder; optional `grill-session-*.md` | `phase-N-<slug>.md`, `plan-<topic>-phases.md`; may add `.context/backlog/items/phase-<n>-<slug>.md`, Phase 1 line in `todo.md` | **After** b-plan when plan exceeds thresholds; **before** b-build/b-loop; b-plan-update triggers re-run | Dependency graph (HARD/SOFT/NONE), parallel-opportunity flags, `omp_execution`/`depends_on` frontmatter (`skills/b-phase/SKILL.md:88-124`, `skills/b-phase/SKILL.md:152-175`) |
| b-nasa-prd | Skill name | Idea intake or existing PRD/`spec-*.md` path | PRD/spec markdown in subject folder (structure in skill); audit findings table in review mode | **After** b-research (sibling); **before** b-plan (`skills/b-nasa-prd/SKILL.md:112`) | NASA SEH Appendix C: shall/will/should, rule-ID audit checklist (`skills/b-nasa-prd/SKILL.md:21-27`, `skills/b-nasa-prd/SKILL.md:100-108`) |
| b-blueprint | `/b-blueprint` or `/skill:b-blueprint` | Resolved plan/phase/brainstorm/spec via same discovery as b-present | `presentations/<slug>/blueprint.html`; optional `presentations/<slug>/assets/blueprint.css` | **After** b-plan, b-phase, or b-brainstorm; parallel to b-present | Single scrolling HTML “architecture poster” with Mermaid + file-change map; no manifest (`skills/b-blueprint/SKILL.md:52-53`, `skills/b-blueprint/SKILL.md:197-214`) |
| b-present | `/b-present` or `/skill:b-present` | Plans, phases, brainstorms, specs, grill sessions, research | `presentations/<slug>/index.html`, optional detail pages, `assets/`, `sources/*.md`, `manifest.json` | **After** b-plan/b-phase/b-brainstorm/b-research; **before** b-build (reference) | Multi-page async briefing package; `manifest.json` for regeneration hygiene (`skills/b-present/SKILL.md:49-64`, `skills/b-present/SKILL.md:125-139`) |
| b-loop | `/skill:b-loop` or load by name (**no** `/b-loop` slash mirror) | Phased plan: `plan-*-phases.md`, `phase-N-*.md`, or subject folder | Stamps `omp_execution` / `omp_goal_budget` on `phase-N-*.md` frontmatter; mirrors `omp_execution` cell in `plan-*-phases.md` `## Phase Summary` table | **After** b-phase; **before** user-driven b-build per phase | Advisory + stamp only; user must type `orchestrate`/`workflow` or run `/goal set` themselves (`skills/b-loop/SKILL.md:24-29`, `skills/b-loop/SKILL.md:92-96`) |
| b-backlog | `/b-backlog`, triggers: "add to backlog", "backlog this", etc. | Conversation snippet, `$ARGUMENTS`, or plan/spec reference | `.context/backlog/items/<slug>.md`; parent appends checkbox to `.context/backlog/todo.md` | Lateral: deferred work from conversation, plan, or review; **before** future b-plan/b-brainstorm | Parent spawns "Backlog Curator" subagent to write item; parent registers todo after review (`skills/b-backlog/SKILL.md:109-138`) |
| b-arch-qa | Skill name (`b-arch-qa`) | Live architecture/tech questions | Default: `.context/discussions/{subject}.md`; alt: Obsidian vault subject folder or custom path | **Before** b-plan (as `research:` input); read-only; hands off to b-build | Fire-and-forget `quick_task` subagents append Q&A + living `## Architecture` section after each answer (`skills/b-arch-qa/SKILL.md:52-53`, `skills/b-arch-qa/SKILL.md:93-105`) |

## Detail

### b-brainstorm (`skills/b-brainstorm/SKILL.md`, 143 lines)

- **Procedure**: (1) Apply subject-resolution; create or resume `.context/YYYY-MM-DD.<subject>/` with `index.md status: draft` (`skills/b-brainstorm/SKILL.md:13-14`, `skills/b-brainstorm/SKILL.md:36-39`). (2) Ask one interview question at a time (~4 soft cap); first substantive Q surfaces `## User Goal` (`skills/b-brainstorm/SKILL.md:39-40`, `skills/b-brainstorm/SKILL.md:24-30`). (3) Write loose `brainstorm-<slug>.md` using draft template (`skills/b-brainstorm/SKILL.md:61-85`). (4) Update `brainstorm-state-<slug>.json` with SHA256 hash (`skills/b-brainstorm/SKILL.md:99-111`). (5) Show saved path; gap-check draft (`skills/b-brainstorm/SKILL.md:42-44`). (6) Offer continue/edit/manual; recommend `/b-plan` only if user asks (`skills/b-brainstorm/SKILL.md:44-45`).
- **Gates/stops**: Multiple subjects → numbered menu, wait (`skills/b-brainstorm/SKILL.md:36-37`). Missing user goal blocked except explicit "technical chore" waiver (`skills/b-brainstorm/SKILL.md:29-30`). Never auto-invoke b-plan (`skills/b-brainstorm/SKILL.md:45`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (referenced `skills/b-brainstorm/SKILL.md:36`)
- **Explicitly does NOT do**: Formal planning (`skills/b-brainstorm/SKILL.md:8`); modify source outside `.context/` (`skills/b-brainstorm/SKILL.md:16`); create backlog unless user explicitly asks (`skills/b-brainstorm/SKILL.md:20`)

### b-plan (`skills/b-plan/SKILL.md`, 638 lines)

- **Procedure**: (1) Active Capability Probe for `b-build`/`b-review`/`b-save` before anything else (`skills/b-plan/SKILL.md:17-63`). (2) Resolve/create subject folder with `index.md status: active` (`skills/b-plan/SKILL.md:73-81`). (3) Gather user/session/artifact/code context (`skills/b-plan/SKILL.md:118-131`). (4) Clarification interview + user-goal gate (`skills/b-plan/SKILL.md:180-188`, `skills/b-plan/SKILL.md:263-274`). (5) Optional Light Grill on draft ambiguities (`skills/b-plan/SKILL.md:190-237`). (6) Write `plan-*.md` (tactical) or `spec-*.md` (strategic) with frontmatter template (`skills/b-plan/SKILL.md:279-280`, `skills/b-plan/SKILL.md:310-323`). (7) Full mode: cross-reference stitch, backlog items, execution instructions, optional `eval-<topic>.py` for workflow plans (`skills/b-plan/SKILL.md:239-257`, `skills/b-plan/SKILL.md:394-563`). (8) Report saved path + capability state + recommended next step (`skills/b-plan/SKILL.md:618-637`).
- **Gates/stops**: Probe `unknown` → standalone mini-workflow, no full-workflow dependencies (`skills/b-plan/SKILL.md:53-63`, `skills/b-plan/SKILL.md:133-156`). Plan incomplete without `## User Goal` (`skills/b-plan/SKILL.md:271-272`). Does not require `research-*.md` (`skills/b-plan/SKILL.md:15`). b-phase recommended only in full mode when loader-discoverable and plan exceeds thresholds (`skills/b-plan/SKILL.md:295-303`).
- **Supporting files**: `skills/_shared/subject-resolution.md`; `docs/buck-workflow.md`; example eval cells under `.context/2026-06-06.omp-integration-buck-workflow/` (`skills/b-plan/SKILL.md:541-545`)
- **Explicitly does NOT do**: Modify application source (`skills/b-plan/SKILL.md:69`); auto-set `omp_execution` on phases — recommends only (`skills/b-plan/SKILL.md:352-355`); auto-spawn other skills from Light Grill (`skills/b-plan/SKILL.md:214`); emulate build/review/save in standalone mode (`skills/b-plan/SKILL.md:155-156`)

### b-plan-update (`skills/b-plan-update/SKILL.md`, 223 lines)

- **Procedure**: (1) Subject-resolution; verify `index.md` status `active` or `draft` (`skills/b-plan-update/SKILL.md:21-25`). (2) Select target `plan-*.md` (exclude `plan-*-phases.md`) (`skills/b-plan-update/SKILL.md:29-39`). (3) Intake explicit instructions, session context, new artifacts (copy externals into subject) (`skills/b-plan-update/SKILL.md:46-63`). (4) Read plan fully; classify changes add/modify/explicit-remove/implicit-remove (`skills/b-plan-update/SKILL.md:69-102`). (5) Interweave edits; renumber steps; structural consistency pass (`skills/b-plan-update/SKILL.md:104-121`). (6) Update frontmatter `updated:`; append `## Revision Log` entry (`skills/b-plan-update/SKILL.md:123-145`). (7) Emit standardized output block with phase-drift and spec-conflict flags (`skills/b-plan-update/SKILL.md:170-184`).
- **Gates/stops**: Zero plan candidates → STOP, point to `/b-plan` (`skills/b-plan-update/SKILL.md:10-11`, `skills/b-plan-update/SKILL.md:35-39`). Multiple candidates → STOP, menu (`skills/b-plan-update/SKILL.md:34-34`). `status: completed` → STOP unless user confirms reopen (`skills/b-plan-update/SKILL.md:44-44`). Implicit removals never silent (`skills/b-plan-update/SKILL.md:82-82`). Spec divergence flagged, not silently applied (`skills/b-plan-update/SKILL.md:154-158`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (`skills/b-plan-update/SKILL.md:23`)
- **Explicitly does NOT do**: Create new plans (`skills/b-plan-update/SKILL.md:10`); edit phase files (`skills/b-plan-update/SKILL.md:17`, `skills/b-plan-update/SKILL.md:218-221`); edit specs in place (`skills/b-plan-update/SKILL.md:222`); commit or call b-save (`skills/b-plan-update/SKILL.md:208`)

### b-phase (`skills/b-phase/SKILL.md`, 442 lines)

- **Procedure**: (1) Subject-resolution; find `plan-*.md` (`skills/b-phase/SKILL.md:24-27`, `skills/b-phase/SKILL.md:31-44`). (2) Assess size against thresholds; SKIP or PHASE (`skills/b-phase/SKILL.md:10-20`, `skills/b-phase/SKILL.md:60-66`). (2b) Optional grill-session metadata for boundaries (`skills/b-phase/SKILL.md:68-86`). (3) Map dependency graph HARD/SOFT/NONE (`skills/b-phase/SKILL.md:88-110`). (4) Design phases with difficulty/model hints (`skills/b-phase/SKILL.md:112-142`). (5) Write `phase-N-<slug>.md` + `plan-<topic>-phases.md` overview with dependency matrix (`skills/b-phase/SKILL.md:144-303`). (5c) Set plan and `index.md` to `active` (`skills/b-phase/SKILL.md:335-339`). (6) Optional backlog per-phase items; queue Phase 1 only (`skills/b-phase/SKILL.md:373-384`). (7) Summarize for user (`skills/b-phase/SKILL.md:386-394`).
- **Gates/stops**: SKIP when plan executable in one session (`skills/b-phase/SKILL.md:63-66`). High grill `boundaries_found` → strong phase signal (`skills/b-phase/SKILL.md:80-81`). Commit invariant: one phase = one commit (`skills/b-phase/SKILL.md:326`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (`skills/b-phase/SKILL.md:25`)
- **Explicitly does NOT do**: Replace b-plan (`skills/b-phase/SKILL.md:428` integration note only); enforce `omp_execution` at runtime — field is user recommendation (`skills/b-phase/SKILL.md:181-183`)

### b-nasa-prd (`skills/b-nasa-prd/SKILL.md`, 120 lines)

- **Procedure**: **Author mode**: (1) Intake need/goals/scope/constraints/flows/assumptions (`skills/b-nasa-prd/SKILL.md:31-40`). (2) Draft shall-statements into requirements table (`skills/b-nasa-prd/SKILL.md:42-64`). (3) Validate against checklist (`skills/b-nasa-prd/SKILL.md:66-68`). (4) Emit PRD with sections 1–8 (`skills/b-nasa-prd/SKILL.md:70-98`). **Review mode**: extract requirements, run checklist, output findings table, stop unless asked to rewrite (`skills/b-nasa-prd/SKILL.md:100-108`).
- **Gates/stops**: Review mode stops and reports — no silent full rewrite (`skills/b-nasa-prd/SKILL.md:108`). Flip PRD to `active` only after assumptions confirmed (`skills/b-nasa-prd/SKILL.md:76`).
- **Supporting files**: `references/nasa-appendix-c.md`, `references/requirement-quality-checklist.md` (`skills/b-nasa-prd/SKILL.md:10-11`, `skills/b-nasa-prd/SKILL.md:116-120`)
- **Explicitly does NOT do**: Exploration (`b-research`), implementation planning (`b-plan`), issue triage (`skills/b-nasa-prd/SKILL.md:19`)

### b-blueprint (`skills/b-blueprint/SKILL.md`, 397 lines)

- **Procedure**: (1) Resolve source artifact (same order as b-present) (`skills/b-blueprint/SKILL.md:32-49`). (2) Read fully; extract architecture signals (`skills/b-blueprint/SKILL.md:115-137`). (3) Generate Mermaid diagrams only from source facts (`skills/b-blueprint/SKILL.md:139-156`). (4) Build file-change map NEW/MODIFY/DELETE/DEPS (`skills/b-blueprint/SKILL.md:158-170`). (5) Render code snippets/diffs (`skills/b-blueprint/SKILL.md:172-184`). (6) Assemble HTML from `references/blueprint-template.html` (`skills/b-blueprint/SKILL.md:186-193`). (7) Write `presentations/<slug>/blueprint.html` and report (`skills/b-blueprint/SKILL.md:195-214`).
- **Gates/stops**: Ambiguous source → stop and ask (`skills/b-blueprint/SKILL.md:42`). No source → fail message (`skills/b-blueprint/SKILL.md:372`). Do not invent architecture (`skills/b-blueprint/SKILL.md:141`, `skills/b-blueprint/SKILL.md:392`).
- **Supporting files**: `references/blueprint-template.html` (`skills/b-blueprint/SKILL.md:188`, `skills/b-blueprint/SKILL.md:368`)
- **Explicitly does NOT do**: Modify source artifacts (`skills/b-blueprint/SKILL.md:55`); multi-file site (`skills/b-blueprint/SKILL.md:393`); replace b-present (`skills/b-blueprint/SKILL.md:397`)

### b-present (`skills/b-present/SKILL.md`, 280 lines)

- **Procedure**: (1) Discover source via precedence list (`skills/b-present/SKILL.md:18-30`). (2) Read/parse frontmatter and sections (`skills/b-present/SKILL.md:72-78`). (3) Synthesize overview narrative with source-type bias (`skills/b-present/SKILL.md:86-108`). (4) Create detail pages when justified (`skills/b-present/SKILL.md:110-119`). (5) Copy sources to `sources/` (`skills/b-present/SKILL.md:121-123`). (6) Generate `manifest.json` (`skills/b-present/SKILL.md:125-139`). (7) Preview via local HTTP server chain (`skills/b-present/SKILL.md:141-152`).
- **Gates/stops**: Multiple plausible sources at same level → stop and ask (`skills/b-present/SKILL.md:28-29`). Nothing found → clear error (`skills/b-present/SKILL.md:250`). Contradictions surfaced, not silently merged (`skills/b-present/SKILL.md:104-106`, `skills/b-present/SKILL.md:253`).
- **Supporting files**: `references/briefing-package-patterns.md` (manifest schema, HTML/CSS patterns) (`skills/b-present/SKILL.md:239-246`)
- **Explicitly does NOT do**: Modify `.context/` source artifacts (`skills/b-present/SKILL.md:45`); hand-edit packages (`skills/b-present/SKILL.md:47`)

### b-loop (`skills/b-loop/SKILL.md`, 420 lines)

- **Procedure**: (1) Resolve plan via explicit path, subject folder, conversation, or `current-session.json` / deprecated `orchestration.json` (`skills/b-loop/SKILL.md:100-161`). (2) Advisory mode: apply recommendation table, ask user confirm (`skills/b-loop/SKILL.md:198-233`). (3) Stamp `omp_execution`/`omp_goal_budget` on non-completed `phase-N-*.md`; mirror overview table (`skills/b-loop/SKILL.md:235-293`). (4) Emit per-phase precondition sentences in chat (`skills/b-loop/SKILL.md:305-318`). (5) Print closeout report (`skills/b-loop/SKILL.md:320-342`).
- **Gates/stops**: All entrypoints empty → STOP and ask (`skills/b-loop/SKILL.md:160-161`). Non-phased plan → print recommendation only, no writes (`skills/b-loop/SKILL.md:349-357`). `in-progress` phases untouched unless forced (`skills/b-loop/SKILL.md:363-367`). Non-OMP harness → recommend `none` (`skills/b-loop/SKILL.md:79-90`).
- **Supporting files**: Cross-references only — `skills/b-phase/SKILL.md`, `skills/b-plan/SKILL.md`, `docs/buck-workflow.md` (`skills/b-loop/SKILL.md:399-414`)
- **Explicitly does NOT do**: Drive build/review/save cycle (`skills/b-loop/SKILL.md:17-22`); auto-type OMP keywords (`skills/b-loop/SKILL.md:92-96`, `skills/b-loop/SKILL.md:380-383`); create orchestration state files (`skills/b-loop/SKILL.md:57-59`, `skills/b-loop/SKILL.md:372-376`)

### b-backlog (`skills/b-backlog/SKILL.md`, 167 lines)

- **Procedure**: (1) Parent gathers input from conversation, `$ARGUMENTS`, or plan/spec ref (`skills/b-backlog/SKILL.md:99-107`). (2) If ambiguous, one clarifying question before dispatch (`skills/b-backlog/SKILL.md:107-107`). (3) Spawn single `task` subagent "Backlog Curator" with schema copied into prompt (`skills/b-backlog/SKILL.md:109-123`). (4) Subagent writes `.context/backlog/items/<slug>.md`, returns proposed todo line (`skills/b-backlog/SKILL.md:125-137`). (5) Parent reviews; on confirm appends to `todo.md` (`skills/b-backlog/SKILL.md:140-147`). (6) Report path and next steps (`skills/b-backlog/SKILL.md:150-161`).
- **Gates/stops**: Work happening now → do not backlog (`skills/b-backlog/SKILL.md:26-26`). GitHub issues → use b-issue-create (`skills/b-backlog/SKILL.md:27`). No plan yet → brainstorm/plan first (`skills/b-backlog/SKILL.md:28`). Subagent must not edit `todo.md` (`skills/b-backlog/SKILL.md:138`).
- **Supporting files**: None beyond SKILL.md
- **Explicitly does NOT do**: Touch application code or other `.context/` artifacts besides backlog item (`skills/b-backlog/SKILL.md:37`); memory capture (`b-save`) (`skills/b-backlog/SKILL.md:29`)

### b-arch-qa (`skills/b-arch-qa/SKILL.md`, 178 lines)

- **Procedure**: (1) Session start: ask doc location once (`.context/discussions/`, Obsidian vault, or custom) (`skills/b-arch-qa/SKILL.md:36-44`). (2) Infer subject slug; resume or create doc (`skills/b-arch-qa/SKILL.md:42-44`). (3) Per question: determine source (web/code/both), answer in chat, spawn background subagent to append doc (`skills/b-arch-qa/SKILL.md:46-53`). (4) Maintain living `## Architecture` section via subagent updates (`skills/b-arch-qa/SKILL.md:83-91`). (5) Hand off implementation requests to b-build (`skills/b-arch-qa/SKILL.md:31-33`).
- **Gates/stops**: Read-only on application code/config/tests (`skills/b-arch-qa/SKILL.md:29`). User wants implementation → offer b-build handoff, do not edit project (`skills/b-arch-qa/SKILL.md:33`). Pure external tech → b-research instead (`skills/b-arch-qa/SKILL.md:22`). One-off answer with no doc → skip skill (`skills/b-arch-qa/SKILL.md:20`).
- **Supporting files**: References `obsidian-cli` skill for vault writes (`skills/b-arch-qa/SKILL.md:144`)
- **Explicitly does NOT do**: Edit application code (`skills/b-arch-qa/SKILL.md:29`); replace b-research for pure external questions (`skills/b-arch-qa/SKILL.md:22`)

## Cross-cutting answers

### Q1. Dependencies between work units vs purely linear phases?

**Both.** The default workflow spine is linear (brainstorm → plan → phase → build), but **b-phase explicitly models dependencies**, not just ordering:

- Step 3 maps a dependency graph with types **HARD** (blocking), **SOFT** (stub/mock OK), and **NONE** (parallel-capable) (`skills/b-phase/SKILL.md:88-110`).
- Phase frontmatter carries `depends_on: [phase numbers]` and `dependency_type` (`skills/b-phase/SKILL.md:168-169`).
- Overview files include a **Dependency Matrix** and diagram, plus a **Parallel Opportunities** section when phases have no mutual dependency (`skills/b-phase/SKILL.md:277-307`).
- b-plan-update does **not** edit phases; it only **flags drift** when plan changes invalidate phased output (`skills/b-plan-update/SKILL.md:160-166`).
- b-backlog queues **Phase 1 only** to `todo.md`; later phases stay upcoming until prior phase completes (`skills/b-phase/SKILL.md:373-380`).

Within a single plan, implementation steps are numbered sequentially (`skills/b-plan/SKILL.md:591-592`), but phasing can split and constrain them by dependency edges.

### Q2. Machine-readable artifacts vs prose-only?

**Mixed — substantial structured output beyond prose markdown.**

| Artifact | Format | Skill | Evidence |
|---|---|---|---|
| `brainstorm-state-<slug>.json` | JSON sidecar (paths, slug, question_count, SHA256 hash) | b-brainstorm | `skills/b-brainstorm/SKILL.md:15`, `skills/b-brainstorm/SKILL.md:103-111` |
| `index.md` frontmatter | YAML `status:` | b-brainstorm, b-plan, b-phase | `skills/b-brainstorm/SKILL.md:14`, `skills/b-plan/SKILL.md:80`, `skills/b-phase/SKILL.md:335-339` |
| `plan-*.md` / `spec-*.md` frontmatter | YAML (`research:`, `spec:`, `iterations:`, etc.) | b-plan | `skills/b-plan/SKILL.md:310-323` |
| `phase-N-*.md` frontmatter | YAML arrays (`depends_on`, `acceptance_criteria`, `omp_execution`, …) | b-phase | `skills/b-phase/SKILL.md:152-175` |
| `manifest.json` | JSON package metadata | b-present | `skills/b-present/SKILL.md:63`, `skills/b-present/SKILL.md:125-137` |
| Backlog item frontmatter | YAML enums (`priority`, `status`, `related:`) | b-backlog | `skills/b-backlog/SKILL.md:41-54` |
| `eval-<topic>.py` | Executable Python with structured schema dicts | b-plan (workflow recommendation) | `skills/b-plan/SKILL.md:394-534` |

b-blueprint output is HTML (human-facing). b-loop writes YAML frontmatter stamps. b-nasa-prd and b-arch-qa are primarily prose markdown, with structured tables and YAML frontmatter where noted.

### Q3. Autonomous execution loop concept and stop conditions?

**Yes — defined but not driven by this cluster.**

- **Generic mini-cycle** (documented across build skills, referenced by b-loop): `build → review → iterate → docs → save → commit → done` (`skills/b-loop/SKILL.md:13-15`).
- **OMP autonomous primitives** stamped on phase files: `none | orchestrate | workflow | goal` via `omp_execution` frontmatter (`skills/b-phase/SKILL.md:164-191`, `skills/b-loop/SKILL.md:17-22`).
- **b-loop** and **b-plan** only **recommend and stamp**; user must manually type keywords or run `/goal set` — agent cannot enforce (`skills/b-loop/SKILL.md:92-96`, `skills/b-phase/SKILL.md:181-183`).
- **b-loop explicitly does not run or drive the loop** (`skills/b-loop/SKILL.md:17-22`, `skills/b-loop/SKILL.md:370-377`).

**What stops autonomous work:**
- Phase `status: completed` and acceptance criteria met (`skills/b-phase/SKILL.md:237`, `skills/b-phase/SKILL.md:326-327`)
- User refusal / choice in b-loop advisory confirm step (`skills/b-loop/SKILL.md:229-233`)
- Light Grill stop at 10 questions or user says stop (`skills/b-plan/SKILL.md:213`)
- `goal` mode: token budget (`omp_goal_budget`) is a hint; completion audit on `goal({op:'complete'})` (`skills/b-phase/SKILL.md:193-197`, `skills/b-loop/SKILL.md:213-218`)
- Out-of-plan review findings routed to new plan cycle, not infinite iterate (`skills/b-phase/SKILL.md:222`, `skills/b-plan/SKILL.md:341`)
- b-phase SKIP when plan fits one session (`skills/b-phase/SKILL.md:63-66`)

### Q4. What distinguishes `spec` from `plan` from `phase`?

**Quoted distinctions from skills:**

**Plan (tactical)** — b-plan: *"Write tactical implementation plans as `plan-*.md` in the subject folder."* (`skills/b-plan/SKILL.md:279`). Structured with implementation steps, affected files, acceptance criteria, verification (`skills/b-plan/SKILL.md:565-606`).

**Spec (strategic / PRD)** — b-plan: *"Write strategic specs as `spec-*.md` in the subject folder (for multi-session epics/PRDs)."* (`skills/b-plan/SKILL.md:280`). b-brainstorm menu: *"I want a full spec/PRD/roadmap → I'll hand off to `/b-plan` for a strategic spec"* (`skills/b-brainstorm/SKILL.md:56`). b-nasa-prd produces requirements artifacts *"that feeds"* b-plan, with shall-statements and traceability (`skills/b-nasa-prd/SKILL.md:19`, `skills/b-nasa-prd/SKILL.md:91-98`). Plans reference specs via frontmatter `spec:` field (`skills/b-plan/SKILL.md:320`).

**Phase (execution slice)** — b-phase: *"Break large plans into sequential, independently-verifiable phases. Each phase should be completable in one agent session."* (`skills/b-phase/SKILL.md:8`). Phase files are derived slices with `from_plan_steps`, own acceptance criteria, and optional HARD deps on prior phases (`skills/b-phase/SKILL.md:167-172`). Overview file `plan-<topic>-phases.md` is an index only; *"All implementation details live in the phase files"* (`skills/b-phase/SKILL.md:346`).

**Brainstorm draft** is explicitly *not* formal planning: *"loose first-draft plan"* / intake (`skills/b-brainstorm/SKILL.md:8`).

### Q5. Subagent dispatch — which skills and for what?

| Skill | Dispatches subagents? | Purpose | Evidence |
|---|---|---|---|
| b-backlog | **Yes** — single `task` subagent | "Backlog Curator" writes `.context/backlog/items/<slug>.md`, scans `.context/` for `related:` links, returns todo line | `skills/b-backlog/SKILL.md:109-123`, `skills/b-backlog/SKILL.md:125-137` |
| b-arch-qa | **Yes** — `quick_task` per Q&A append (fire-and-forget; parallel for Architecture + Q&A) | Technical documentation writer appends to discussion doc | `skills/b-arch-qa/SKILL.md:52-53`, `skills/b-arch-qa/SKILL.md:93-105` |
| b-plan | **No** auto-spawn | Light Grill *"Do not auto-spawn a new skill"* when gaps found | `skills/b-plan/SKILL.md:214` |
| b-phase | **No** in skill body | Documents that `orchestrate` runtime uses parallel `task` subagents — user-invoked OMP behavior, not b-phase dispatch | `skills/b-loop/SKILL.md:315`, `skills/b-phase/SKILL.md:232` |
| All others in cluster | **No** subagent dispatch documented | — | — |

## Gaps

- **No dedicated grill skill in this cluster** — b-plan's Light Grill is inline (3–10 Qs); full `b-grill-me` / grill sessions are sibling-owned but consumed by b-phase for boundary metadata (`skills/b-phase/SKILL.md:68-86`).
- **No research/explore skill here** — b-plan and b-nasa-prd assume upstream `research-*.md` may exist but do not produce it (`skills/b-plan/SKILL.md:15`, `skills/b-nasa-prd/SKILL.md:19`).
- **b-loop lacks slash-command mirror** — only `/skill:b-loop` or programmatic load (`skills/b-loop/SKILL.md:24-47`); discoverability gap vs other `b-*` skills.
- **No automated dependency validation** — b-phase documents dependencies in markdown/YAML but no skill in this cluster verifies the graph against the repo.
- **Presentation outputs not wired back into `.context/`** — `presentations/<slug>/` is disposable generated output, not indexed in subject `index.md` by default (`skills/b-present/SKILL.md:43-47`).
- **b-arch-qa vs b-research boundary** is manual judgment (`skills/b-arch-qa/SKILL.md:22`) — no hard router.

## Open questions

- Q-P1: Does `b-plan`'s standalone mini-workflow ever write `spec-*.md`, or only `plan-*.md`? The skill lists both artifact types globally (`skills/b-plan/SKILL.md:279-280`) but standalone section only mandates `plan-*.md` (`skills/b-plan/SKILL.md:144-147`).
- Q-P2: Is `brainstorm-state-*.json` consumed by any skill other than b-brainstorm resume logic, or is it resume-only?
- Q-P3: When both b-present and b-blueprint run on the same subject, is `<slug>` derivation consistent between skills (no shared slug algorithm is documented in either SKILL body).
- Q-P4: b-phase Step 1 still shows legacy `ls .context/plans/` discovery bash (`skills/b-phase/SKILL.md:33-37`) while other skills use subject-folder convention — is `.context/plans/` still supported in practice?
- Q-P5: For Obsidian-mode b-arch-qa, is the discussion doc ever linked from subject `index.md`, or does it remain outside the Buck subject-folder artifact graph (`skills/b-arch-qa/SKILL.md:166` mentions `research:` in plans but not vault paths)?