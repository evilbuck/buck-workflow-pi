---
cluster: RESEARCH, MEMORY & DOCUMENTATION
skills_covered: 12
---

## Verdict

- This cluster owns **investigation → durable notes → session checkpoint → canonical docs → long-term memory import** — the path from "what we learned" to "what survives the next session."
- **Spine:** dated subject folders under `.context/YYYY-MM-DD.<subject>/` (research/explore/capture) feed **`/b-save` or `/b-save-improved`**, which writes `.context/memory/*.md` and updates `.context/memory/index.md` plus backlog cross-refs.
- **Write-gate** is the distinctive mechanic for investigation skills: persist after each source/trace, never batch to session end (`skills/b-research/SKILL.md:107-118`, `skills/b-explore/SKILL.md:67-77`).
- **b-capture** is orthogonal: user dictation → one subagent per dump → immutable `notes/entries/NNN.md` files, explicitly not synthesis (`skills/b-capture/SKILL.md:27-33`).
- **b-docs / b-howto** split *why* (CONTEXT.md, ADRs, conventions) from *how* (`docs/howto/`) and **never write `.context/`** (`skills/b-docs/SKILL.md:96-97`, `skills/b-howto/SKILL.md:162`).
- **Deterministic Bun scripts** (`save-preflight.ts`, `save-apply.ts`, `import-context-memory.ts`, `import-projects.ts`) handle file mechanics; model prose handles research narrative and the portable `/b-save` fallback.

## Skill Table

| Skill | Invocation | Input | Output (exact paths) | Workflow position | Distinctive mechanic |
|---|---|---|---|---|---|
| b-research | `/b-research` (`prompts/b-research.md:9-12`); skill name | Research question; optional `$ARGUMENTS`; subject via `skills/_shared/subject-resolution.md` | `.context/YYYY-MM-DD.<subject>/index.md`; `research/notes-<topic>.md`; `research/sources-<topic>.md`; `research-<topic>.md` | After user question, before `/b-plan` or `/b-build` (`skills/b-research/SKILL.md:162-167`) | Write-gate: append after **each external source**; consolidate every 3–5 sources (`skills/b-research/SKILL.md:107-116`) |
| b-explore | `/b-explore` (`prompts/b-explore.md:9-12`) | Exploration topic; codebase symbols/paths | Same subject-folder layout as research: `index.md`, `research/notes-<topic>.md`, `research-<topic>.md` | Before planning/build when code is unfamiliar (`skills/b-explore/SKILL.md:113-118`) | Write-gate after each **code trace**; optional OMP `recall`/`reflect` or `.context/memory/index.md` for prior decisions (`skills/b-explore/SKILL.md:65`, `skills/b-explore/SKILL.md:67-75`) |
| b-capture | `/b-capture` (`prompts/b-capture.md:9-12`) | User dumps (often dictated); optional custom notes root | `<notes-root>/index.md`; `notes/raw-capture-log.md`; `notes/entries/NNN.md`; `glossary.md`; `open-questions.md` (default root `.context/YYYY-MM-DD.<subject>/`) | Mid-thought capture; before tidy/synthesize/plan (`skills/b-capture/SKILL.md:91-93`) | One subagent **per dump** writes exactly one immutable entry file; mainline owns log/glossary (`skills/b-capture/SKILL.md:78-83`) |
| b-recap | `/b-recap` (`prompts/b-recap.md:9-12`) | Current session transcript + artifacts (read-only) | **Chat output only** — no files (`skills/b-recap/SKILL.md:10`, `skills/b-recap/SKILL.md:15`) | Mid-session orientation; does **not** replace `/b-save` (`skills/b-recap/SKILL.md:10`) | 500-word cap; evidence hierarchy conversation → compaction/artifacts → git corroboration (`skills/b-recap/SKILL.md:19-31`) |
| b-docs | `/b-docs` (`prompts/b-docs.md:9-12`); normally after `/b-review` doc-impact flag | Git diff, active subject plan/spec, b-review finding | `CONTEXT.md`; `docs/adr/NNNN-slug.md`; managed block in `AGENTS.md`/`CLAUDE.md`; `docs/*`; README flagged only | After `/b-review` doc impact, **before** `/b-save` (`skills/b-docs/SKILL.md:16-18`, `skills/b-docs/SKILL.md:207`) | ADR gate (3 criteria); may load sibling `b-howto` same session (`skills/b-docs/SKILL.md:101-111`, `skills/b-docs/SKILL.md:147-172`) |
| b-howto | `/b-howto`, triggers `how-to`/`howto` (`skills/b-howto/SKILL.md:4-8`; `prompts/b-howto.md`) | User action or surface name; `$ARGUMENTS` | `docs/howto/README.md`; `docs/howto/<kebab-action>.md`; optional `AGENTS.md` managed block | After user-facing action ships or b-review how-to impact; before `/b-save` (`skills/b-howto/SKILL.md:186`, `skills/b-howto/SKILL.md:162-165`) | Diátaxis: one action/file, numbered steps, last step **Eat** (`skills/b-howto/SKILL.md:13-16`, `skills/b-howto/HOWTO-FORMAT.md:6-8`) |
| b-save | `/b-save` trigger (`skills/b-save/SKILL.md:4-5`); prompt body `prompts/b-save.md` | Active subject; session transcript; optional retain/learn tools (OMP) | `.context/memory/<topic>-YYYY-MM-DD.md`; `.context/memory/index.md`; `.context/backlog/todo.md`, `items/`, `archive/`; subject `index.md`; plan/spec cross-refs; optional `draft-commit.md` prep | End of session: after review/iterate/docs/howto, before `/b-commit` (`skills/b-save/SKILL.md:56-64`) | Pure prompt — 12 responsibilities, no extension backing (`skills/b-save/SKILL.md:21-23`) |
| b-save-improved | `/b-save-improved` + extension `extensions/b-save-improved/index.ts` (`skills/b-save-improved/SKILL.md:9-11`) | Same as b-save + flags `--dry-run`, `--archive-inferred`, `--subject`, `--no-retain`, `--model` | Same `.context/` targets as b-save via `save-apply.ts`; stdout JSON report from preflight/apply | Same slot as b-save when extension loaded; `/b-save` remains portable fallback (`skills/b-save-improved/SKILL.md:13-14`) | Hybrid: Bun preflight/apply + scribe (memory/backlog) + auditor (spec/phase/iterate) model roles (`skills/b-save-improved/SKILL.md:79-85`, `skills/b-save-improved/SKILL.md:88-110`) |
| b-memory-import | `/b-memory-import`, triggers in frontmatter (`skills/b-memory-import/SKILL.md:4-7`) | Project root (`--root`); optional `--source-dirs` | HTTP upsert to Hindsight bank; local manifest `<project>/.context/memory/.omp-hindsight-import-manifest.json` (`skills/b-hindsight-import-projects/SKILL.md:152-154`) | One-shot/backfill after `.context/memory` exists; **not** per-session (`skills/b-memory-import/SKILL.md:3`, `skills/b-save/SKILL.md:47`) | Deterministic Bun scan/parse/retain; stable `document_id` upsert (`skills/b-memory-import/SKILL.md:72-82`) |
| b-hindsight-import-projects | `/b-hindsight-import-projects` + triggers (`skills/b-hindsight-import-projects/SKILL.md:4-8`) | `--root` path(s); `--include`/`--exclude`/`--all`; forwarded import flags | Per-project inner JSON + aggregate stdout envelope (`skills/b-hindsight-import-projects/SKILL.md:102-137`) | Workspace-wide seed/resume; wraps b-memory-import (`skills/b-hindsight-import-projects/SKILL.md:13-18`) | Multi-root discovery; one project failure does not stop batch (`skills/b-hindsight-import-projects/SKILL.md:147-151`) |
| llm-wiki-vault | Skill name / vault research context (`skills/llm-wiki-vault/SKILL.md:24-31`) | URLs, files, pasted text; vault at `$OBSIDIAN_VAULT_PATH` or `~/Documents/second brain` | Vault paths: `40_Archives/Raw-Sources/**`; synthesis under PARA folders; `90_System/LLM Wiki Log.md` | Parallel to b-research for Obsidian-native KB; may feed b-plan (`skills/llm-wiki-vault/SKILL.md:367-369`) | Mandatory orient-first (Schema + MOC + log tail); raw sources immutable (`skills/llm-wiki-vault/SKILL.md:67-87`, `skills/llm-wiki-vault/SKILL.md:355`) |
| crawl4ai | Invoked by b-research (`skills/b-research/SKILL.md:103`); not standalone slash command | Target URLs/domains; subject folder path | `.context/YYYY-MM-DD.<subject>/research/crawl-output/*.md` + processed notes (`skills/crawl4ai/SKILL.md:145-154`) | Helper inside b-research when fetch/search insufficient (`skills/crawl4ai/SKILL.md:8`, `skills/crawl4ai/SKILL.md:124-130`) | External Crawl4AI CLI/Python with graceful fallback to fetch_content (`skills/crawl4ai/SKILL.md:134-139`) |

## Detail

### b-research (`skills/b-research/SKILL.md`, 167 lines)
- **Procedure**: (1) Resolve subject via shared protocol or create `.context/YYYY-MM-DD.<subject>/` + `index.md` (`status: draft`) (`skills/b-research/SKILL.md:31-37`). (2) Create `research/` rolling notes immediately (`skills/b-research/SKILL.md:64-71`). (3) Clarify question; select sources from `docs/research-source-dictionary.md` (`skills/b-research/SKILL.md:89-97`). (4) After each source, append notes + sources files (`skills/b-research/SKILL.md:111-114`). (5) Every 3–5 sources consolidate to `research-<topic>.md` (`skills/b-research/SKILL.md:115-116`). (6) Set frontmatter `informs: []` for later stitching (`skills/b-research/SKILL.md:131-135`). (7) Report summary + recommend next step.
- **Gates/stops**: Must not modify app code (`skills/b-research/SKILL.md:27-29`); redirects internal questions to b-explore (`skills/b-research/SKILL.md:19-23`); subject folder creation is mandatory (`skills/b-research/SKILL.md:33`).
- **Supporting files**: `docs/research-source-dictionary.md` (`skills/b-research/SKILL.md:91`); `skills/_shared/subject-resolution.md` (`skills/b-research/SKILL.md:54`); helper `skills/crawl4ai/SKILL.md` (`skills/b-research/SKILL.md:103`); `prompts/b-research.md`.
- **Explicitly does NOT do**: Codebase tracing (`skills/b-research/SKILL.md:21-22`); planning (`skills/b-research/SKILL.md:23`).

### b-explore (`skills/b-explore/SKILL.md`, 118 lines)
- **Procedure**: (1) Create subject folder + `research/` + `index.md` (`skills/b-explore/SKILL.md:24-32`). (2) Broad symbol search → trace entry points → follow dependencies (`skills/b-explore/SKILL.md:52-57`). (3) Write-gate rolling notes after each trace (`skills/b-explore/SKILL.md:71-75`). (4) Consolidate to `research-<topic>.md` at breakpoints (`skills/b-explore/SKILL.md:74-75`). (5) Record risks/unknowns; set `informs: []` (`skills/b-explore/SKILL.md:80-86`).
- **Gates/stops**: Read-only on application code (`skills/b-explore/SKILL.md:18-22`); subject folder mandatory (`skills/b-explore/SKILL.md:26`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (`skills/b-explore/SKILL.md:46`); `prompts/b-explore.md`.
- **Explicitly does NOT do**: External/web research — use b-research (`skills/b-explore/SKILL.md:8`).

### b-capture (`skills/b-capture/SKILL.md`, 93 lines)
- **Procedure**: (1) Turn 1: resolve subject; scaffold tree (`index.md`, log, entries dir, glossary, open-questions) (`skills/b-capture/SKILL.md:41-54`). (2) State five-point contract; invite dump (`skills/b-capture/SKILL.md:27-33`, `skills/b-capture/SKILL.md:74`). (3) Each later turn: spawn one subagent → exclusive `notes/entries/NNN.md` (`skills/b-capture/SKILL.md:78-81`). (4) Mainline appends log pointer only (`skills/b-capture/SKILL.md:83`). (5) Update glossary/open-questions when no dump in flight (`skills/b-capture/SKILL.md:83-84`). (6) Leave mode only when user asks tidy/synthesize (`skills/b-capture/SKILL.md:91-93`).
- **Gates/stops**: `/b-save` does not end capture mode (`skills/b-capture/SKILL.md:33`); subagents must not touch shared files (`skills/b-capture/SKILL.md:81-83`); two plausible dictation readings → record both (`skills/b-capture/SKILL.md:32`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (`skills/b-capture/SKILL.md:43`); `prompts/b-capture.md`.
- **Explicitly does NOT do**: Agent-led investigation (`skills/b-capture/SKILL.md:12`); polish until user says so (`skills/b-capture/SKILL.md:33`).

### b-recap (`skills/b-recap/SKILL.md`, 79 lines)
- **Procedure**: (1) Apply evidence hierarchy: conversation → compaction/artifacts → git corroboration (`skills/b-recap/SKILL.md:19-31`). (2) Identify initial purpose/why (`skills/b-recap/SKILL.md:35-37`). (3) Cluster work into 2–4 areas (`skills/b-recap/SKILL.md:38-40`). (4) Document direction changes or state none (`skills/b-recap/SKILL.md:41-44`). (5) List 3–6 important files (`skills/b-recap/SKILL.md:45-49`). (6) Capture latest user request (excluding recap itself) + current state (`skills/b-recap/SKILL.md:50-52`). (7) Emit fixed markdown template (`skills/b-recap/SKILL.md:54-78`).
- **Gates/stops**: **Read-only** — never create/modify/delete files (`skills/b-recap/SKILL.md:15`); 500-word ceiling (`skills/b-recap/SKILL.md:14`); disclose `[compacted context]` gaps (`skills/b-recap/SKILL.md:16`).
- **Supporting files**: `prompts/b-recap.md`.
- **Explicitly does NOT do**: Persist session artifacts — `/b-save` remains authoritative (`skills/b-recap/SKILL.md:10`).

### b-docs (`skills/b-docs/SKILL.md`, 221 lines)
- **Procedure**: (1) Resolve subject; read diff, plan, b-review doc-impact finding (`skills/b-docs/SKILL.md:31-35`, `skills/b-docs/SKILL.md:60-70`). (2) Read existing canonical docs to avoid duplication (`skills/b-docs/SKILL.md:176-177`). (3) Write domain terms → `CONTEXT.md`; ADR-gated decisions → `docs/adr/`; conventions → managed AGENTS block; narrative → `docs/` (`skills/b-docs/SKILL.md:178-182`). (4) Flag README changes in report only (`skills/b-docs/SKILL.md:183`). (5) If warranted, load and execute `b-howto` (once-each guard) (`skills/b-docs/SKILL.md:185-188`). (6) Closeout report (`skills/b-docs/SKILL.md:190-212`).
- **Gates/stops**: Conditional on doc impact — say "No living-doc updates needed" and stop (`skills/b-docs/SKILL.md:27-29`); ADR requires all three gate criteria (`skills/b-docs/SKILL.md:101-111`); never write `.context/` (`skills/b-docs/SKILL.md:96-97`).
- **Supporting files**: `skills/b-grill-with-docs/CONTEXT-FORMAT.md`, `ADR-FORMAT.md` (`skills/b-docs/SKILL.md:45-46`); `skills/_shared/subject-resolution.md`; `prompts/b-docs.md`.
- **Explicitly does NOT do**: Session history/changelog in living docs (`skills/b-docs/SKILL.md:93-95`); how-tos in `docs/howto/` (`skills/b-docs/SKILL.md:51-55`); edit README body (`skills/b-docs/SKILL.md:49`).

### b-howto (`skills/b-howto/SKILL.md`, 199 lines)
- **Procedure**: (1) Resolve subject/surface from args (`skills/b-howto/SKILL.md:51-56`). (2) If sibling rule says so, load `b-docs` first (why-first) (`skills/b-howto/SKILL.md:111-114`, `skills/b-howto/SKILL.md:131-133`). (3) Inventory human-doable actions from implementation + `.context/` artifacts (`skills/b-howto/SKILL.md:84-97`). (4) Idempotent write/update/split per action (`skills/b-howto/SKILL.md:135-139`). (5) Update `docs/howto/README.md` index (`skills/b-howto/SKILL.md:140-142`). (6) Link from ADRs/PRDs; dedupe procedural copies (`skills/b-howto/SKILL.md:143-145`). (7) Optional AGENTS managed block (`skills/b-howto/SKILL.md:146-161`).
- **Gates/stops**: Stop if nothing human-facing changed (`skills/b-howto/SKILL.md:39-40`); do not write `.context/memory` (`skills/b-howto/SKILL.md:162`); once-each guard with b-docs (`skills/b-howto/SKILL.md:116-118`).
- **Supporting files**: `skills/b-howto/HOWTO-FORMAT.md` (`skills/b-howto/SKILL.md:64`); `prompts/b-howto.md`.
- **Explicitly does NOT do**: ADRs/domain language (`skills/b-howto/SKILL.md:44-46`); tutorials (`skills/b-howto/SKILL.md:46-47`); session history (`skills/b-howto/SKILL.md:47`).

### b-save (`skills/b-save/SKILL.md`, 72 lines)
- **Procedure**: (1) Agent receives `prompts/b-save.md` with 12 steps (`skills/b-save/SKILL.md:21-23`, `prompts/b-save.md:7-48`). (2) Read `.context/workflow/current-session.json` if present (`prompts/b-save.md:9`, `prompts/b-save.md:50-51`). (3) Resolve/create subject folder; consolidate loose artifacts (`prompts/b-save.md:10`). (4) Write/update `.context/memory/<file>.md` with frontmatter (`prompts/b-save.md:11-23`). (5) Stitch plan/spec `memory:` arrays (`prompts/b-save.md:24`). (6) Update backlog todo/items/archive (`prompts/b-save.md:25`). (7) Update spec/phase/iterate statuses (`prompts/b-save.md:26`, `prompts/b-save.md:37-47`). (8) Prepend `.context/memory/index.md` (`prompts/b-save.md:27`). (9) Optional OMP `retain`/`learn`; optional memory-skill re-index (`prompts/b-save.md:28-36`). (10) User Goal warning (non-blocking) (`prompts/b-save.md:48`).
- **Gates/stops**: Does not commit — prepares for `/b-commit` (`skills/b-save/SKILL.md:54-64`); User Goal is warning only (`skills/b-save/SKILL.md:38`); do not run full b-memory-import on routine save (`skills/b-save/SKILL.md:34`, `prompts/b-save.md:4`).
- **Supporting files**: `prompts/b-save.md` (`skills/b-save/SKILL.md:68`); commands symlink; related `skills/b-memory-import/SKILL.md`.
- **Explicitly does NOT do**: Bulk Hindsight HTTP import (`skills/b-save/SKILL.md:34`, `skills/b-save/SKILL.md:47`); git commit (`skills/b-save/SKILL.md:54-55`).

### b-save-improved (`skills/b-save-improved/SKILL.md`, 125 lines)
- **Procedure**: (1) Run `bun skills/b-save-improved/scripts/save-preflight.ts` (`skills/b-save-improved/SKILL.md:89`). (2) On exit 2, user picks subject or creates suggested name (`skills/b-save-improved/SKILL.md:92-94`). (3) Scribe model: memory narrative + backlog delta (`skills/b-save-improved/SKILL.md:95-100`). (4) Auditor model (conditional): spec/phase/iterate verdicts with evidence (`skills/b-save-improved/SKILL.md:101-106`). (5) Pipe payload to `save-apply.ts` (`skills/b-save-improved/SKILL.md:107-110`). (6) Mainline `retain`/`learn` if `expect_retain` (`skills/b-save-improved/SKILL.md:111-114`). (7) Best-effort qmd re-index non-OMP (`skills/b-save-improved/SKILL.md:115-117`).
- **Gates/stops**: `--dry-run` writes nothing (`skills/b-save-improved/SKILL.md:24-25`, `skills/b-save-improved/SKILL.md:46`); ambiguous subject stops for user (`skills/b-save-improved/SKILL.md:92-94`); path containment enforced in apply (`skills/b-save-improved/SKILL.md:48`); falls back to `prompts/b-save.md` if extension missing (`skills/b-save-improved/SKILL.md:36-37`).
- **Supporting files**: `scripts/save-preflight.ts`, `save-apply.ts`, tests (`skills/b-save-improved/SKILL.md:89`, `skills/b-save-improved/SKILL.md:108`); `extensions/b-save-improved/index.ts` (`skills/b-save-improved/SKILL.md:9`); `skills/_shared/scripts/context-helpers.js`; `commands/b-save-improved.md`.
- **Explicitly does NOT do**: Use `current-session.json` for subject selection (`skills/b-save-improved/SKILL.md:38-40`); Hindsight HTTP or b-memory-import (`skills/b-save-improved/SKILL.md:41-42`); replace portable `/b-save` (`skills/b-save-improved/SKILL.md:13-14`).

### b-memory-import (`skills/b-memory-import/SKILL.md`, 103 lines)
- **Procedure**: (1) Confirm target project cwd or `--root` (`skills/b-memory-import/SKILL.md:20`). (2) Dry-run: `bun scripts/import-context-memory.ts --dry-run` (`skills/b-memory-import/SKILL.md:22-25`). (3) Review JSON envelope (`skills/b-memory-import/SKILL.md:28`). (4) Live import (`skills/b-memory-import/SKILL.md:29-33`). (5) Verify via OMP `recall` or tests (`skills/b-memory-import/SKILL.md:95-96`).
- **Gates/stops**: Requires Hindsight credentials from env or `~/.omp/agent/config.yml` (`skills/b-memory-import/SKILL.md:13-14`); skips files missing required frontmatter (`skills/b-memory-import/SKILL.md:46-48`); exit 2 on retain failures (`skills/b-memory-import/SKILL.md:72-82` context in script header).
- **Supporting files**: `scripts/import-context-memory.ts`, `import-context-memory.test.ts` (`skills/b-memory-import/SKILL.md:96`); manifest `.context/memory/.omp-hindsight-import-manifest.json` (`skills/b-hindsight-import-projects/SKILL.md:152-154`).
- **Explicitly does NOT do**: LLM calls (`skills/b-memory-import/SKILL.md:11-12`); replace per-session `/b-save` retain (`skills/b-hindsight-import-projects/SKILL.md:28-30`).

### b-hindsight-import-projects (`skills/b-hindsight-import-projects/SKILL.md`, 183 lines)
- **Procedure**: (1) Discover projects under `--root` (single dir or immediate subdirs with `.context/memory/`) (`skills/b-hindsight-import-projects/SKILL.md:77-86`). (2) Filter `--include`/`--exclude`/`--all` (`skills/b-hindsight-import-projects/SKILL.md:85-86`). (3) For each project spawn inner `import-context-memory.ts` with forwarded flags (`skills/b-hindsight-import-projects/SKILL.md:88-101`). (4) Aggregate JSON to stdout (`skills/b-hindsight-import-projects/SKILL.md:102-137`). (5) Exit 2 if any project retain errors (`skills/b-hindsight-import-projects/SKILL.md:150-151`).
- **Gates/stops**: Requires sibling `b-memory-import` script (`skills/b-hindsight-import-projects/SKILL.md:34-36`); individual project failure does not abort batch (`skills/b-hindsight-import-projects/SKILL.md:147-149`).
- **Supporting files**: `scripts/import-projects.ts`, `import-projects.test.ts` (`skills/b-hindsight-import-projects/SKILL.md:159-169`).
- **Explicitly does NOT do**: Ongoing session writes — source is already-written `.context/memory` from b-save (`skills/b-hindsight-import-projects/SKILL.md:28-30`).

### llm-wiki-vault (`skills/llm-wiki-vault/SKILL.md`, 369 lines)
- **Procedure**: (1) Orient: read `90_System/LLM Wiki Schema.md`, nearest MOC, last 30 log lines, search vault (`skills/llm-wiki-vault/SKILL.md:67-87`). (2) **Ingest**: capture raw → `40_Archives/Raw-Sources/**`; write/update synthesis pages with wikilinks + frontmatter (`skills/llm-wiki-vault/SKILL.md:99-128`). (3) Update MOC/index + append `LLM Wiki Log.md` (`skills/llm-wiki-vault/SKILL.md:130-149`). (4) **Query**: search vault, synthesize, optionally file answer back (`skills/llm-wiki-vault/SKILL.md:157-165`). (5) **Lint**: broken links, orphans, frontmatter, provenance checks (`skills/llm-wiki-vault/SKILL.md:169-184`).
- **Gates/stops**: Raw sources immutable (`skills/llm-wiki-vault/SKILL.md:355`); page thresholds before creating durable pages (`skills/llm-wiki-vault/SKILL.md:310-324`); contradiction policy keeps both claims (`skills/llm-wiki-vault/SKILL.md:301-308`).
- **Supporting files**: Vault-resident `90_System/LLM Wiki Schema.md`, `LLM Wiki Integration.md`, `LLM Wiki Log.md` (`skills/llm-wiki-vault/SKILL.md:47-50`); related `obsidian`, `b-research`, `b-plan` skills (`skills/llm-wiki-vault/SKILL.md:365-369`).
- **Explicitly does NOT do**: Modify raw source files after capture (`skills/llm-wiki-vault/SKILL.md:355`); create pages for passing mentions (`skills/llm-wiki-vault/SKILL.md:319-324`).

### crawl4ai (`skills/crawl4ai/SKILL.md`, 173 lines)
- **Procedure**: (1) Check `crawl4ai` CLI/Python installed (`skills/crawl4ai/SKILL.md:26-33`). (2) Install via pip/uv + `crawl4ai-setup` if needed (`skills/crawl4ai/SKILL.md:35-48`). (3) Crawl to subject `research/` output dir (`skills/crawl4ai/SKILL.md:60-76`). (4) Process into notes/sources; cite URLs (`skills/crawl4ai/SKILL.md:129-130`). (5) Fall back to fetch_content if unavailable (`skills/crawl4ai/SKILL.md:134-139`).
- **Gates/stops**: Not for single-page or internal code (`skills/crawl4ai/SKILL.md:18-22`); respect robots/rate limits (`skills/crawl4ai/SKILL.md:167-173`).
- **Supporting files**: External Crawl4AI package/CLI only — no scripts in skill dir.
- **Explicitly does NOT do**: Standalone research workflow — invoked by b-research (`skills/crawl4ai/SKILL.md:8`).

## Cross-cutting answers

### Q1. How does session state survive compaction or a new session?

**During the session (survives compaction mid-flight):**
- Investigation/capture skills persist incrementally to **subject folders** under `.context/YYYY-MM-DD.<subject>/` via write-gate (`skills/b-research/SKILL.md:107-118`, `skills/b-explore/SKILL.md:67-77`, `skills/b-capture/SKILL.md:29`).
- **Writers:** b-research, b-explore, b-capture agents (and subagents for capture entries).

**At session checkpoint (survives new session in git):**
- **`/b-save`** (model following `prompts/b-save.md`) or **`/b-save-improved`** (`save-apply.ts`) writes:
  - `.context/memory/<topic>-YYYY-MM-DD.md` — session record with YAML frontmatter (`prompts/b-save.md:11-23`; example `.context/memory/fix-pr-18-2026-09-09.md:1-14`)
  - `.context/memory/index.md` — prepend ledger entry (`prompts/b-save.md:27`; index shape `.context/memory/index.md:1-5`)
  - `.context/backlog/todo.md`, `.context/backlog/items/*.md`, archive moves (`prompts/b-save.md:25`)
  - Subject `.context/<subject>/index.md` updates + plan/spec `memory:` back-fill (`prompts/b-save.md:24`; `save-apply.ts` functions `applyCrossrefs`, `applySubjectIndex` at `skills/b-save-improved/scripts/save-apply.ts:467-477`)
- **Writers:** b-save agent; b-save-improved scribe/auditor + deterministic apply script.

**Optional harness LTM (next-session recall in OMP):**
- Step 8 `retain`/`learn` mirrors facts to OMP native memory (`prompts/b-save.md:28-32`; `skills/b-save-improved/SKILL.md:111-114`).
- Bulk backfill of existing markdown: `b-memory-import` / `b-hindsight-import-projects` reading `.context/memory/` (`skills/b-memory-import/SKILL.md:10-11`).

**Read on resume (not authoritative writers today):**
- `.context/workflow/current-session.json` — read for hint only; **no writer since 2026-06-05 extension slim-down** (`skills/b-save-improved/SKILL.md:38-40`, `skills/b-save-improved/scripts/save-preflight.ts:176-189`).
- `.context/workflow/orchestration.json` — b-flow subject override (`skills/_shared/subject-resolution.md:13-15`).

### Q2. Automatic (hook-driven) persistence vs agent-initiated?

**No hook-driven auto-save is defined in this cluster.** `/b-save` is explicitly "a pure prompt — no extension backing" with no state injection (`skills/b-save/SKILL.md:21-23`). b-save-improved runs only when the slash command/extension is invoked (`extensions/b-save-improved/index.ts:1-8`).

**Agent-initiated writes (require choosing to follow a skill):**
- All `.context/` artifact creation (research/explore/capture write-gates, b-save, b-save-improved).
- Canonical doc updates (b-docs, b-howto) after review or explicit user ask.
- Hindsight import scripts when agent/user runs `/b-memory-import` or bulk wrapper.
- llm-wiki-vault writes when agent follows ingest/query/lint protocol.

**Semi-automatic within an active skill:** write-gate protocols mandate immediate persistence during b-research/b-explore/b-capture, but only while the agent is executing those skills — not harness hooks (`skills/b-research/SKILL.md:107-109`).

### Q3. Split between `.context/` (what happened) and canonical docs (what things mean)?

Quote from b-docs:

> ``b-save` records the **event** (what happened this session) into `.context/`. `b-docs` records the **meaning** (what the code now is) into the project's canonical doc locations. `b-howto` records the **sequence** a human runs.`` (`skills/b-docs/SKILL.md:13-15`)

Corollary rule:

> "Session history is `.context/memory/`'s job — never put a changelog or 'we did X on date Y' entry in living docs." (`skills/b-docs/SKILL.md:93-95`)

b-howto adds: "Session history — use `b-save`" and writes only `docs/howto/` (`skills/b-howto/SKILL.md:47`, `skills/b-howto/SKILL.md:58-64`).

### Q4. Per-session state files external tools/statuslines could read?

| File | Machine-readable content | Writer |
|---|---|---|
| `.context/YYYY-MM-DD.<subject>/index.md` | YAML `status:` (`draft`/`active`/`completed`) — subject-resolution scans this (`skills/_shared/subject-resolution.md:27`, `skills/_shared/subject-resolution.md:80-93`) | b-research/explore/capture create `draft`; b-plan → `active`; b-save → `completed` (`skills/_shared/subject-resolution.md:90-93`) |
| `.context/memory/<slug>-YYYY-MM-DD.md` | YAML frontmatter + markdown body (`prompts/b-save.md:12-22`) | b-save / save-apply |
| `.context/memory/index.md` | Two-line ledger entries: date + link + status, then metadata row (`.context/memory/index.md:1-5`; also detects legacy single-line — `save-preflight.ts:80-84`) | b-save / save-apply |
| `.context/backlog/todo.md` + `items/*.md` | Checkbox list + per-item frontmatter | b-save / save-apply |
| `.context/workflow/current-session.json` | JSON: `started_at`, `subject`, `memory_file` — **stale hint only** (`save-preflight.ts:176-189`) | Legacy (no current writer) |
| `.context/workflow/orchestration.json` | b-flow `currentState` + subject (`skills/_shared/subject-resolution.md:13-15`) | b-flow extension (outside this cluster) |
| `save-preflight.ts` stdout | Full JSON snapshot: subject, backlog, phases, git status (`save-preflight.ts:248-266`) | Invoked by b-save-improved |
| `.context/memory/.omp-hindsight-import-manifest.json` | Per-file sha skip state (`skills/b-hindsight-import-projects/SKILL.md:152-154`) | import-context-memory.ts |

**Not file-backed:** `/b-recap` emits chat-only (`skills/b-recap/SKILL.md:10`, `skills/b-recap/SKILL.md:15`).

### Q5. Deterministic scripts vs model-interpreted prose?

| Kind | Skills | Scripts / runtime |
|---|---|---|
| **Deterministic (Bun)** | b-memory-import | `skills/b-memory-import/scripts/import-context-memory.ts` — Bun (`skills/b-memory-import/SKILL.md:11-12`, `skills/b-memory-import/SKILL.md:24`) |
| **Deterministic (Bun)** | b-hindsight-import-projects | `skills/b-hindsight-import-projects/scripts/import-projects.ts` — Bun wrapper spawning inner import script (`skills/b-hindsight-import-projects/SKILL.md:148-149`) |
| **Hybrid** | b-save-improved | `save-preflight.ts` + `save-apply.ts` (Bun) for file mechanics; scribe + auditor model calls for narrative/verdicts (`skills/b-save-improved/SKILL.md:79-110`); orchestrated by `extensions/b-save-improved/index.ts` (TypeScript/Pi extension) |
| **Model prose (prompt/skill)** | b-save | Agent executes `prompts/b-save.md` — no extension (`skills/b-save/SKILL.md:21-23`) |
| **Model prose** | b-research, b-explore, b-capture, b-recap, b-docs, b-howto, llm-wiki-vault | SKILL.md instructions interpreted by agent |
| **External CLI (not repo scripts)** | crawl4ai | Crawl4AI Python CLI (`pip install crawl4ai`; `skills/crawl4ai/SKILL.md:37-48`) invoked per b-research guidance |

## Gaps

- **No automatic session checkpoint** — compaction survival depends on agents actually running write-gate during investigation or user invoking `/b-save` (`skills/b-save/SKILL.md:17`, `skills/b-research/SKILL.md:107-109`).
- **Stale `current-session.json`** — still referenced by b-save prompt and subject-resolution but documented as unwritten since 2026-06-05 (`skills/b-save-improved/SKILL.md:38-40`, `prompts/b-save.md:9`).
- **b-recap produces no durable artifact** — orientation is ephemeral chat only (`skills/b-recap/SKILL.md:10-15`).
- **llm-wiki-vault is vault-specific** — default path is Buckley's Obsidian vault, not `.context/` project memory (`skills/llm-wiki-vault/SKILL.md:35-37`); no bridge skill in this cluster syncs vault ↔ `.context/memory`.
- **No project-local research index** beyond per-subject `index.md` — cross-subject discovery relies on `.context/memory/index.md` after save, not during draft research.

## Open questions

- Q-R1: Should `current-session.json` be removed from b-save/subject-resolution read paths, or should b-save-improved start writing it again?
- Q-R2: Is there a planned merge of llm-wiki-vault synthesis back into Buck `.context/` subject folders for b-plan consumption, or are these intentionally separate corpora?
- Q-R3: Which harnesses ship the b-save-improved extension by default vs forcing portable `/b-save` only?