---
cluster: INTERVIEW, UX & AUTHORING
skills_covered: 10
---

## Verdict

- **Grill family** stress-tests plans/designs through relentless one-question-at-a-time interviewing — either the human (`b-grill-me`) or a different AI model via Pi RPC (`b-grill-auto`), with `b-grill` as the mode router and `b-grill-with-docs` adding CONTEXT.md/ADR enforcement.
- **Spine mechanic**: every grill session writes structured metadata (`decision_domains`, `break_points`, `boundary_assessment`) to `.context/<subject>/grill-session-*.md` (or `grill-auto-session-*.md`) that downstream `b-phase` reads for phase-boundary suggestions (`skills/b-grill-me/SKILL.md:63-64`, `skills/b-grill-me/SKILL.md:147-149`).
- **Assessment threshold** (default 20 questions) is a soft pause signal — not a hard stop — to evaluate separation-of-concerns boundaries and optionally recommend `/skill:b-phase` (`skills/b-grill/SKILL.md:58-70`).
- **UX authoring pipeline**: `b-create-ux-guide` inventories existing UI into three docs artifacts → `b-create-styleguide` turns that into a living, agent-wired styleguide with managed blocks in AGENTS.md/CLAUDE.md → `b-plan`/`b-build` implement.
- **Stack-agnostic authoring**: `design-brief` (UI spec extraction) and `product-tour` (guided onboarding) map onto any app; `rails-app` is a Rails-specific reference skill, not a workflow step.
- **Most distinctive mechanic**: grill sessions accumulate decision-domain metadata with an explicit boundary assessment at threshold — high question count alone does not mandate phasing; boundary-crossing does (`skills/b-grill/SKILL.md:70`).

## Skill Table

| Skill | Invocation | Input | Output (exact paths) | Workflow position | Distinctive mechanic |
|---|---|---|---|---|---|
| `b-grill` | `/skill:b-grill`, `/skill:b-grill --mode user\|auto`, `/b-grill-me`, `/b-grill-auto` | Plan/design (inline, file, or subject-folder artifact); optional `--model` for auto | `.context/YYYY-MM-DD.<subject>/grill-session-<topic>.md` (user) or `grill-auto-session-<topic>.md` (auto); optional `.context/<subject>/grill-qa-<slug>-<n>.md` (doc mode) | After draft plan/brainstorm; before `b-phase`. Delegates to `b-grill-me` or `b-grill-auto` | Mode router + shared taxonomy; default user mode (`skills/b-grill/SKILL.md:23-26`) |
| `b-grill-me` | `/b-grill-me`, `/skill:b-grill-me` | User's plan/design; optional subject path | `.context/YYYY-MM-DD.<subject>/grill-session-<topic>.md`; optional `grill-qa-*.md`; may feed `.context/<subject>/eval-<topic>.py` via opt-in `b-plan` workflow path | After plan exists; before `b-phase`/`b-plan`; feeds `b-phase` boundary signals | One question at a time to human; recommends answer; codebase-explore instead of ask (`skills/b-grill-me/SKILL.md:12-14`) |
| `b-grill-auto` | `/b-grill-auto`, `/skill:b-grill-auto`, `/skill:b-grill-auto --model <id>` | Plan/design; model via flag, `.context/grill-model.txt`, or auto-detect | `.context/YYYY-MM-DD.<subject>/grill-auto-session-<topic>.md` | Same position as `b-grill-me` but interviewer is external model | Pi RPC via `grill.py`; tracks `model_aligned`/`model_diverged` resolutions (`skills/b-grill-auto/SKILL.md:68-69`) |
| `b-grill-with-docs` | `/skill:b-grill-with-docs` | Plan + existing `CONTEXT.md`/`docs/adr/` | `grill-session-<topic>.md` + inline `CONTEXT.md`/`docs/adr/NNNN-slug.md` updates + Documentation Decisions section | After plan, when domain docs exist; before `b-phase` | Challenges glossary against CONTEXT.md; lazy ADR creation when 3 criteria met (`skills/b-grill-with-docs/SKILL.md:45-55`) |
| `b-create-styleguide` | `/b-create-styleguide`, `/skill:b-create-styleguide` | Conversational interview; optional ux-guide seed | `docs/styleguide.html` or `views/styleguide/index.ejs` or `docs/styleguide.md`; `docs/styleguide-design-brief.json`; `AGENTS.md`/`CLAUDE.md` managed block; `.context/YYYY-MM-DD.<surface>-styleguide/` | After `b-create-ux-guide` (optional) or standalone; before `b-plan`/`b-build` | Create vs refresh modes; reconciles JSON by component `id`; deprecates not deletes (`skills/b-create-styleguide/SKILL.md:12-15`, `skills/b-create-styleguide/SKILL.md:65-70`) |
| `b-create-ux-guide` | `/b-create-ux-guide [section]`, `/skill:b-create-ux-guide` | Optional section/area scope; codebase UI surface | `docs/ux-style-guide.md`, `docs/ux-research.html`, `docs/ux-design-brief.json`; `.context/YYYY-MM-DD.<surface>-ux-guide/` | Before `b-create-styleguide` or `b-plan`; after need identified | 12-category taxonomy + DRY hotspots; documentation-only, no app edits (`skills/b-create-ux-guide/SKILL.md:44-60`, `skills/b-create-ux-guide/SKILL.md:229`) |
| `design-brief` | `/skill:design-brief` | Screenshots, files, descriptions, `.context/<subject>/` artifacts | `design-brief-<topic>.md` in `.context/<subject>/` when writing; structured JSONC in output | During/after brainstorm/plan; before UI `b-build` | Observed vs inferred discipline; Tailwind breakpoint defaults (`skills/design-brief/SKILL.md:21-27`, `skills/design-brief/SKILL.md:96-99`) |
| `product-tour` | `/skill:product-tour` | Vague tour request; existing shipped UI | Plan (project workflow location); tour code in host app; thin gate test; durable note | After feature ships; parallel to/helping `b-plan` when present | Phase 0 interview gate blocks coding until step table locked; teach-by-doing advance on real actions (`skills/product-tour/SKILL.md:51-56`, `skills/product-tour/SKILL.md:177-179`) |
| `rails-app` | Load skill by name when in Rails project | Rails frontend/deployment/test task context | None (reference only) | Read before Rails UI/deploy/test work | "Do this not that" footgun catalog (subpath, Tailwind rebuild, assert_select, BEM) (`skills/rails-app/SKILL.md:8`, `skills/rails-app/SKILL.md:10-17`) |
| `_shared` | `skill://_shared/<file>.md` | Invoked indirectly when b-* skills reference protocol | No artifacts; loads `skills/_shared/*.md` | Before b-* skill work when subject unresolved | Registration shim resolving `skill://_shared/subject-resolution.md` (`skills/_shared/SKILL.md:8-16`) |

## Detail

### b-grill (`skills/b-grill/SKILL.md`, 334 lines)
- **Procedure**: (1) Select mode user vs auto (`skills/b-grill/SKILL.md:23-26`). (2) Create/join `.context/YYYY-MM-DD.<subject>/` (`skills/b-grill/SKILL.md:36-40`). (3) Ask one question at a time with recommended answer; explore codebase when answerable (`skills/b-grill/SKILL.md:30-32`). (4) Track per-question metadata: type, resolution, decision domains (`skills/b-grill/SKILL.md:46-82`). (5) Write/update session file every 5 questions or at domain boundaries (`skills/b-grill/SKILL.md:86-87`). (6) At assessment threshold evaluate SoC boundaries; recommend `b-phase` if found (`skills/b-grill/SKILL.md:58-68`). (7) Auto mode: RPC via `grill.py`, track model divergence (`skills/b-grill/SKILL.md:190-204`). (8) Optional doc mode via `grill-me_dialog` tool (`skills/b-grill/SKILL.md:284-317`).
- **Gates/stops**: Threshold is soft — continues if cohesive (`skills/b-grill/SKILL.md:276-278`). Doc mode waits on user Done/Cancel (`skills/b-grill/SKILL.md:311`).
- **Supporting files**: `skills/b-grill/grill.py` (412 lines, RPC client); duplicated in `skills/b-grill-auto/grill.py`.
- **Explicitly does NOT do**: Does not implement plans; does not auto-write phased plans (delegates to `b-phase`, `skills/b-grill/SKILL.md:280-282`).

### b-grill-me (`skills/b-grill-me/SKILL.md`, 253 lines)
- **Procedure**: (1) One-at-a-time user interview with recommended answers (`skills/b-grill-me/SKILL.md:12-14`). (2) Subject folder create/join (`skills/b-grill-me/SKILL.md:18-22`). (3) Track question metadata and emerging decision domains (`skills/b-grill-me/SKILL.md:28-59`). (4) Write `grill-session-<topic>.md` with YAML frontmatter (`skills/b-grill-me/SKILL.md:63-87`). (5) At threshold assess boundaries; offer continue vs `b-phase` (`skills/b-grill-me/SKILL.md:133-143`). (6) Optional doc mode Q&A file flow (`skills/b-grill-me/SKILL.md:151-184`). (7) Opt-in: `decision_domains` may feed `eval-<topic>.py` PHASES on next `b-plan` with `omp_execution: workflow` (`skills/b-grill-me/SKILL.md:191-244`).
- **Gates/stops**: Doc mode `grill-me_dialog` wait blocks until Done; cancel → inline fallback (`skills/b-grill-me/SKILL.md:178-187`). Does not auto-write eval cell (`skills/b-grill-me/SKILL.md:236-238`).
- **Supporting files**: Requires harness `grill-me_dialog` tool for doc mode (`skills/b-grill-me/SKILL.md:161`).
- **Explicitly does NOT do**: No implementation; no automatic phasing; no eval-cell write without opt-in `b-plan` path (`skills/b-grill-me/SKILL.md:236-238`).

### b-grill-auto (`skills/b-grill-auto/SKILL.md`, 307 lines)
- **Procedure**: (1) Setup subject folder (`skills/b-grill-auto/SKILL.md:53-57`). (2) Initialize Grill RPC session with selected model (`skills/b-grill-auto/SKILL.md:164-181`). (3) Traverse decision tree sending each question to grilling model (`skills/b-grill-auto/SKILL.md:183-192`). (4) Record resolutions including model alignment/divergence (`skills/b-grill-auto/SKILL.md:238-252`). (5) Write `grill-auto-session-<topic>.md` (`skills/b-grill-auto/SKILL.md:87`). (6) Threshold boundary assessment (`skills/b-grill-auto/SKILL.md:71-73`). (7) Close RPC session (`skills/b-grill-auto/SKILL.md:198-201`).
- **Gates/stops**: Default model `openai-codex/gpt-5.4` if unspecified (`skills/b-grill-auto/SKILL.md:48-49`). Notes `/b-grill-auto` extension command as runtime entry (`skills/b-grill-auto/SKILL.md:8`).
- **Supporting files**: `skills/b-grill-auto/grill.py`; config file `.context/grill-model.txt` (`skills/b-grill-auto/SKILL.md:39-43`).
- **Explicitly does NOT do**: Does not replace human judgment on divergences — documents and resolves (`skills/b-grill-auto/SKILL.md:240-245`).

### b-grill-with-docs (`skills/b-grill-with-docs/SKILL.md`, 231 lines)
- **Procedure**: (1) Inherit `b-grill-me` interview + metadata (`skills/b-grill-with-docs/SKILL.md:10-14`, `skills/b-grill-with-docs/SKILL.md:57-67`). (2) Locate CONTEXT.md / ADRs (`skills/b-grill-with-docs/SKILL.md:18-39`). (3) Challenge glossary, sharpen terms, cross-reference code (`skills/b-grill-with-docs/SKILL.md:45-51`). (4) Update CONTEXT.md inline on term resolution (`skills/b-grill-with-docs/SKILL.md:53`). (5) Create ADRs sparingly (`skills/b-grill-with-docs/SKILL.md:55`). (6) Add Documentation Decisions section to session file (`skills/b-grill-with-docs/SKILL.md:73-88`). (7) Same doc mode and workflow-kernel opt-in as `b-grill-me` (`skills/b-grill-with-docs/SKILL.md:102-231`).
- **Gates/stops**: ADR only when hard-to-reverse + surprising + real trade-off (`skills/b-grill-with-docs/SKILL.md:55`). Create `docs/adr/` lazily (`skills/b-grill-with-docs/ADR-FORMAT.md:5`).
- **Supporting files**: `skills/b-grill-with-docs/CONTEXT-FORMAT.md`, `skills/b-grill-with-docs/ADR-FORMAT.md`.
- **Explicitly does NOT do**: Does not batch CONTEXT updates (`skills/b-grill-with-docs/SKILL.md:53`). Does not auto-write eval cell (`skills/b-grill-with-docs/SKILL.md:199-208`).

### b-create-styleguide (`skills/b-create-styleguide/SKILL.md`, 352 lines)
- **Procedure**: (0) Idempotency check — create vs refresh mode (`skills/b-create-styleguide/SKILL.md:38-55`). (1) Explain styleguide; interview one question at a time (`skills/b-create-styleguide/SKILL.md:97-116`). (2) Optional reverse-engineer scan using ux-guide taxonomy (`skills/b-create-styleguide/SKILL.md:118-127`). (3) Generate HTML/EJS/markdown styleguide + JSON spec (`skills/b-create-styleguide/SKILL.md:129-211`). (4) Wire AGENTS.md/CLAUDE.md managed block (`skills/b-create-styleguide/SKILL.md:213-262`). (5) Bookkeeping in `.context/` (`skills/b-create-styleguide/SKILL.md:267-271`). (6) Verification checklist (`skills/b-create-styleguide/SKILL.md:273-284`).
- **Gates/stops**: Stops if zero UI (CLI/API-only) (`skills/b-create-styleguide/SKILL.md:294`). UX-guide seed is offer-only, never auto (`skills/b-create-styleguide/SKILL.md:50-54`). Refresh skips full interview (`skills/b-create-styleguide/SKILL.md:75-78`).
- **Supporting files**: Managed block markers `<!-- BEGIN b-create-styleguide -->`; JSON `_managed` object (`skills/b-create-styleguide/SKILL.md:56-63`, `skills/b-create-styleguide/SKILL.md:175-184`).
- **Explicitly does NOT do**: No view/CSS migration/refactor (`skills/b-create-styleguide/SKILL.md:293`). Not a code-only inventory (`skills/b-create-styleguide/SKILL.md:26-27` → use `b-create-ux-guide`).

### b-create-ux-guide (`skills/b-create-ux-guide/SKILL.md`, 267 lines)
- **Procedure**: (1) Resolve scope from argument or context; ask if unclear (`skills/b-create-ux-guide/SKILL.md:14-17`). (2) Ask output paths (defaults `docs/ux-*`) (`skills/b-create-ux-guide/SKILL.md:32-40`). (3) Create `.context/...-ux-guide/` subject folder (`skills/b-create-ux-guide/SKILL.md:70`). (4) Inventory UI with find/search/read; parallelize large surfaces (`skills/b-create-ux-guide/SKILL.md:74-80`). (5) Organize into 12-category taxonomy + DRY (`skills/b-create-ux-guide/SKILL.md:82-88`). (6) Write markdown guide, HTML research guide, design-brief JSON (`skills/b-create-ux-guide/SKILL.md:90-206`). (7) Bookkeeping + verification (`skills/b-create-ux-guide/SKILL.md:208-225`).
- **Gates/stops**: Asks scope if context ambiguous (`skills/b-create-ux-guide/SKILL.md:17`). Asks doc paths before writing (`skills/b-create-ux-guide/SKILL.md:40`). Stops at documentation — no implementation (`skills/b-create-ux-guide/SKILL.md:229`).
- **Supporting files**: `skills/b-create-ux-guide/BACKLOG.md` (schema reconciliation notes with styleguide).
- **Explicitly does NOT do**: No app code edits (`skills/b-create-ux-guide/SKILL.md:213`, `skills/b-create-ux-guide/SKILL.md:229`). Not external research (`skills/b-create-ux-guide/SKILL.md:30`).

### design-brief (`skills/design-brief/SKILL.md`, 111 lines)
- **Procedure**: (1) Accept mixed inputs; prefer visual over prose for visible facts (`skills/design-brief/SKILL.md:21-27`). (2) Inspect `.context/<subject>/` for brainstorm/plan/spec artifacts (`skills/design-brief/SKILL.md:31-49`). (3) Output structured JSONC covering layout, components, typography, colors, modes, responsive (`skills/design-brief/SKILL.md:61-81`). (4) Mark observed vs inferred (`skills/design-brief/SKILL.md:96-99`). (5) Optionally write `design-brief-<topic>.md` (`skills/design-brief/SKILL.md:53-57`). (6) End with developer handoff prompt in markdown code block (`skills/design-brief/SKILL.md:102-111`).
- **Gates/stops**: Subject-folder artifacts optional, not mandatory (`skills/design-brief/SKILL.md:49`). Infer missing light/dark conservatively (`skills/design-brief/SKILL.md:26`).
- **Supporting files**: None in skill directory.
- **Explicitly does NOT do**: Does not fabricate hidden flows (`skills/design-brief/SKILL.md:97`). Handoff prompt excludes tech stack (`skills/design-brief/SKILL.md:110`).

### product-tour (`skills/product-tour/SKILL.md`, 412 lines)
- **Procedure**: (0) Interview one question at a time until step table lockable; push back if tour wrong tool (`skills/product-tour/SKILL.md:51-172`). (1) Write step table + gate/storage/finale locks (`skills/product-tour/SKILL.md:177-206`). (2) Map architecture: tour controller vs product UI vs bridge events (`skills/product-tour/SKILL.md:210-276`). (3) Implement checklist: gate, anchors, bridge, storage, finale (`skills/product-tour/SKILL.md:280-292`). (4) Thin automated gate test + manual verification path (`skills/product-tour/SKILL.md:322-357`). (5) Durable note for next tour (`skills/product-tour/SKILL.md:398-406`).
- **Gates/stops**: **Blocks coding until Phase 0 intake done** (`skills/product-tour/SKILL.md:53-56`). Synthesis gate requires user confirmation (`skills/product-tour/SKILL.md:154-172`). Max 6 teach steps (`skills/product-tour/SKILL.md:194`).
- **Supporting files**: None; includes Rails/Stimulus and React/Vue mapping tables as reference-only (`skills/product-tour/SKILL.md:294-318`).
- **Explicitly does NOT do**: Not permanent help docs, full wizards, or mockup tours (`skills/product-tour/SKILL.md:19-24`). No default full-screen dim (`skills/product-tour/SKILL.md:31`).

### rails-app (`skills/rails-app/SKILL.md`, 201 lines)
- **Procedure**: Read-only reference — consult relevant section before work: (1) subpath deployment (`skills/rails-app/SKILL.md:10-37`), (2) Tailwind rebuild (`skills/rails-app/SKILL.md:39-54`), (3) assert_select URL shape (`skills/rails-app/SKILL.md:55-71`), (4) integration sign_in bootstrap (`skills/rails-app/SKILL.md:73-94`), (5) BEM semantic classes (`skills/rails-app/SKILL.md:96-117`), (6) three-layer theme (`skills/rails-app/SKILL.md:118-128`), (7) dev server in tmux (`skills/rails-app/SKILL.md:130-142`), (8) mandatory browser UI verification (`skills/rails-app/SKILL.md:144-154`).
- **Gates/stops**: None — passive reference.
- **Supporting files**: None.
- **Explicitly does NOT do**: Not a workflow skill; produces no artifacts (`skills/rails-app/SKILL.md:8`).

### _shared (`skills/_shared/SKILL.md`, 23 lines)
- **Procedure**: (1) Harness resolves `skill://_shared/<file>.md` to sibling `.md` files (`skills/_shared/SKILL.md:8-22`). (2) Consumer skills load `subject-resolution.md` when invoked without explicit path.
- **Gates/stops**: Subject-resolution Step 5 stops for user menu when multiple active subjects (`skills/_shared/subject-resolution.md:47-47`). Step 6 stops for phase menu when multiple incomplete phases (`skills/_shared/subject-resolution.md:65-65`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (95 lines); `skills/_shared/scripts/context-helpers.ts` (692 lines); `skills/_shared/scripts/context-helpers.test.ts`.
- **Explicitly does NOT do**: SKILL.md is registration shim only — not substitute for resource files (`skills/_shared/SKILL.md:22-23`).

## Cross-cutting answers

### Q1. Grill family interview mechanic and stop condition

**Yes.** The grill family stress-tests plans by interviewing:
- **Human mode** (`b-grill-me`, `b-grill-with-docs`): one question at a time to the user (`skills/b-grill-me/SKILL.md:12`).
- **Auto mode** (`b-grill-auto`): questions sent to a different AI model via Pi RPC/`grill.py` (`skills/b-grill-auto/SKILL.md:14-19`).
- **Router** (`b-grill`): selects mode; default user (`skills/b-grill/SKILL.md:23-26`).

**Stop condition / threshold**: Configurable **assessment threshold default 20 questions** — explicitly **not a hard limit** (`skills/b-grill/SKILL.md:58-60`). At threshold the agent **pauses to assess** whether decision domains cross separation-of-concerns boundaries (subject boundaries, dependency independence, concern isolation) (`skills/b-grill/SKILL.md:61-65`). If boundaries found → write break-point recommendations and recommend `/skill:b-phase` (`skills/b-grill/SKILL.md:66-68`). If cohesive → note explicitly and **continue grilling** (`skills/b-grill/SKILL.md:276-278`). Session ends when user chooses to stop or switches to `b-phase`; doc mode ends when grilling complete (`skills/b-grill-me/SKILL.md:184`).

### Q2. Meta-skill for authoring new skills

**Absent.** A full listing of `skills/*/SKILL.md` in this repo (~56 skills) shows no skill whose purpose is authoring/testing new `SKILL.md` files. Closest adjacent skills (outside this cluster):
- `b-init-factory` — writes factory-scoped `AGENTS.md` for building skills/commands, not individual skill bodies (`skills/b-init-factory/SKILL.md:3-9`).
- `cross-platform-pi-omp-loading` — package layout and runtime loading for skill packages, not authoring workflow (`skills/cross-platform-pi-omp-loading/SKILL.md:3-4`).

No skill in `skills/` provides skill-authoring templates with testing guidance.

### Q3. `_shared` cross-skill protocols

**Yes.** `_shared` is a registration shim (`skills/_shared/SKILL.md:6-10`) exposing canonical protocols via `skill://_shared/<file>.md`.

Currently one protocol file — **`subject-resolution.md`** — replaces per-skill "Context Resolution" sections (`skills/_shared/subject-resolution.md:3`). Applied **before skill work** when invoked without arguments (`skills/_shared/subject-resolution.md:7-7`).

**Steps (first hit wins unless noted):**
1. **Explicit context** provided → use it, proceed (`skills/_shared/subject-resolution.md:9-11`).
2. **b-flow active** — `.context/workflow/orchestration.json` with `currentState` not idle/done/aborted → use b-flow subject (`skills/_shared/subject-resolution.md:13-15`).
3. **Session memory** — read `.context/workflow/current-session.json`, extract subject from `memory_file` path/frontmatter; if folder exists, use it (`skills/_shared/subject-resolution.md:17-23`).
4. **Scan subject folders** — list `.context/YYYY-MM-DD.*/`, read only `status:` from `index.md`; classify artifact state from filenames only (plan/phase/iterate/research/capture/brainstorm) (`skills/_shared/subject-resolution.md:25-39`).
5. **Present selection** — filter `active`/`draft`; 0 → fresh start; 1 → auto-select silently; **multiple → STOP, numbered menu, WAIT** (`skills/_shared/subject-resolution.md:41-58`).
6. **Phase selection** — if phased plan, one incomplete phase → auto; **multiple → STOP, menu, WAIT** (`skills/_shared/subject-resolution.md:60-74`).
7. **Proceed** with resolved subject/phase (`skills/_shared/subject-resolution.md:76-78`).

**Status convention**: `draft` (brainstorm/research), `active` (plan exists), `completed` (hidden from menu) (`skills/_shared/subject-resolution.md:80-88`).

Supporting implementation: `skills/_shared/scripts/context-helpers.ts` (YAML frontmatter parse, subject folder listing, artifact classification).

### Q4. Writing-quality / de-AI-ification skill

**Absent from `skills/`.** No skill in the directory listing addresses making generated prose sound human, de-AI-ification, or general writing-quality editing. Peripheral mentions only:
- `b-nasa-prd` — NASA editorial checklist for requirements (`skills/b-nasa-prd/SKILL.md:10-11` per directory index).
- `code-review-universal` — collaborative review tone guidance in reference material.
- `product-tour` — asks copy tone preference during intake (terse/playful/formal) (`skills/product-tour/SKILL.md:147`) but is not a prose-quality skill.

`b-writer` (editorial workshop) is **not present** in this repo's `skills/` tree.

### Q5. Generic/portable vs stack/product-tied

| Skill | Portability |
|---|---|
| `b-grill`, `b-grill-me`, `b-grill-auto`, `b-grill-with-docs` | **Concept portable** (interview stress-test) but **Buck-coupled**: `.context/` subject folders, `b-phase` feed, `grill-me_dialog` tool, optional `eval-<topic>.py` workflow-kernel path |
| `b-create-ux-guide` | **Mostly portable** (inventory → docs) but uses Buck `.context/` bookkeeping and recommends Buck downstream skills |
| `b-create-styleguide` | **Mostly portable** (styleguide patterns) but Buck `.context/`, AGENTS.md managed blocks, optional Vite/EJS Rails-ish examples |
| `design-brief` | **Mostly portable** UI extraction; assumes Tailwind default breakpoints (`skills/design-brief/SKILL.md:27`); optional `.context/` integration |
| `product-tour` | **Explicitly stack-agnostic** (`skills/product-tour/SKILL.md:10`); maps to host stack at implementation time |
| `rails-app` | **Rails-specific** reference (subpath, Tailwind, Minitest, BEM theming, tmux dev server) |
| `_shared` | **Buck `b-*` suite specific** — subject resolution over `.context/` and b-flow orchestration |

## Gaps

- **No meta-skill** for authoring, validating, or testing new skills within the suite.
- **No general writing-quality / de-AI prose skill** — only domain-specific editorial guidance (NASA PRD, code-review tone).
- **No dedicated frontend-design skill** in this cluster (exists elsewhere in suite per install manifest but not in assigned cluster).
- **Grill doc mode** depends on harness-specific `grill-me_dialog` tool — not portable without extension support.
- **UX pipeline schema drift** between `b-create-ux-guide` and `b-create-styleguide` JSON (`_managed`, `status`) documented as open backlog (`skills/b-create-ux-guide/BACKLOG.md:3-7`).
- **No user-story / PM intake skill** in cluster (`pm-story-groomer` not in repo `skills/` listing).

## Open questions

- Q-U1: Is `grill.py` duplicated intentionally in both `b-grill/` and `b-grill-auto/`, and which path is canonical for maintenance?
- Q-U2: Does the harness always provide `grill-me_dialog`, or is doc mode degraded in some runtimes (OMP vs Pi)?
- Q-U3: Should `design-brief`'s Tailwind breakpoint assumption be generalized for non-Tailwind stacks?
- Q-U4: Is `rails-app` intended to remain project-specific (PartyPic patterns) or evolve into a generic Rails reference?
- Q-U5: Will ux-guide/styleguide JSON schema reconciliation (`BACKLOG.md`) land as optional fields in ux-guide, unblocking silent handoff?