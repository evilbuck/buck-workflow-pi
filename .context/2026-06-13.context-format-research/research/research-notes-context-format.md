---
status: active
date: 2026-06-13
subject: 2026-06-13.context-format-research
topics: [context-format, markdown, json, jsonc, jq, llm-memory]
informs: []
---

# Rolling notes: context format

## README.md + repo docs

- Consulted local Buck docs first because the question is about this repo's artifact contract, not generic note-taking.
- README positions `.context/` as a **durable paper trail** and explicitly calls out `frontmatter format` plus `cross-reference linking` as baseline conventions. That pushes the format requirement beyond raw key/value storage: artifacts must carry both structured metadata and free-form narrative.
- README also says canonical skills are plain Markdown and agent-agnostic. Existing cross-harness portability already depends on Markdown being the lowest-common-denominator content type for prompts/skills/docs.
- Initial implication: switching all context artifacts to JSONC would fight the repo's existing portability/documentation model. It would improve machine extraction for narrow fields, but it would degrade long-form plans, research syntheses, citations, and link-heavy notes.

## Existing `.context/` history: session JSON work

- Prior research already split the problem space by artifact type. The 2026-06-05 session-state work moved **workflow state** into JSON because that file is operational state with field lifecycles, frequent writes, and handoff semantics.
- That same research classified many JSON fields as per-session papertrail or derivable, which is evidence that structured machine state benefits from explicit schema and lifecycle auditing.
- Important distinction: that earlier work was about `session.json`/`grill-session.json`, not about narrative artifacts like research, plans, specs, or memory entries.
- Initial implication: the repo already has an emerging hybrid model — Markdown for durable narrative artifacts, JSON for volatile operational state.

## Repo implementation pattern: frontmatter is already the machine contract

- Current repo code does not treat Markdown as "unstructured". It already parses frontmatter and filename conventions as the structured contract.
- `extensions/index.ts` detects phased plan format via `format: discrete` frontmatter.
- `extensions/b-flow/verify-result.ts` hard-fails when YAML frontmatter is missing. That means some workflow paths already rely on Markdown body + machine-readable metadata header.
- `subject-resolution.md` uses a mixed strategy: JSON session state for the active session pointer, then Markdown frontmatter in memory/index files for subject discovery and status classification.
- Implication: the question is not "Markdown or structure?" The repo already uses **structured Markdown**. A full JSONC rewrite would mostly replace one structure mechanism with another while losing prose ergonomics.

## External standards: JSON vs JSONC vs jq

- RFC 8259 defines JSON as minimal and portable. Comments are not part of the format. If the goal is broad interoperability, strict JSON wins over JSONC.
- JSONC's own spec says it is a draft, adds JavaScript-style comments, recommends `.jsonc`, and warns not to send JSONC as `application/json`.
- jq's manual says it parses a stream of JSON data. That is a key practical point: `jq` is a first-class argument for **JSON**, not JSONC. JSONC adds comment readability but weakens direct tooling compatibility unless another parse/strip step is inserted.
- Implication: "switch to JSONC so we can query it with jq" is internally inconsistent. `jq` is a reason to choose JSON, not JSONC.

## Working thesis

- Best single-format answer: **no**. Markdown is not the best format for high-write operational state; JSON/JSON schema is better there.
- But JSONC is also not the best repo-wide replacement, because the bulk of `.context/` artifacts are long-form plans/research/memory where body prose is the payload and frontmatter already supplies the fields the code reads.
- Stronger model: keep narrative artifacts in Markdown with strict frontmatter schema; add JSON sidecars/indexes only where queryability or machine mutation materially matters.

## Markdown LSP effectiveness: Marksman in this repo

- The workspace has `marksman` live and ready; TypeScript LSP is configured but irrelevant for this question.
- Marksman advertises exactly the operations that matter here: document/workspace symbols, definition, references, rename, diagnostics, completion, and code lens for Markdown links/headings.
- Actual repo check:
  - `lsp definition` on a Markdown artifact link in `.context/.../index.md` resolved to the target research file.
  - `lsp references` on that same link returned both the link site and the target document heading.
  - `lsp symbols` on a research note returned a usable heading tree; `workspace symbols` found related docs by heading text across `.context/`.
- Diagnostic check via a scratch file in `.context/.../research/marksman-diagnostics-test.md`:
  - broken wiki-link produced an **error**
  - broken inline Markdown link produced a **warning**
- That makes Markdown+frontmatter materially more queryable than "just prose" in this environment. The LSP already gives structural navigation and broken-link detection without abandoning Markdown.

## Limits of the Markdown-LSP path

- Marksman is strong on links/headings/workspace navigation, not arbitrary schema validation of frontmatter/body conventions. If you want hard guarantees like `priority ∈ {high, medium, low}` or required `related:` arrays, JSON Schema is better.
- jq-style field slicing is still weaker on Markdown than JSON. You can search/parse frontmatter, but it is not as direct as `.foo.bar`.
- Therefore the right comparison is:
  - Markdown + frontmatter + LSP = strong for authored narrative artifacts
  - JSON (+ schema, jq) = strong for machine-owned state and audit tables
  - JSONC specifically = weaker interoperability than JSON, without solving the prose problem

## Prototype test: recreating Markdown artifacts as JSON

- I created JSON prototypes for two real Buck artifacts:
  - memory entry
  - subject index
- jq test was strong immediately. Example queries pulled `status`, `subject`, `artifact_count`, `next_steps`, and emitted verification lines with near-zero friction.
- That confirms the obvious upside: if the source-of-truth artifact is JSON, machine slicing is much cleaner than parsing Markdown frontmatter/body conventions.
- But the prototype also exposed the hidden cost: to preserve what the Markdown artifact actually carries, the JSON had to grow a custom document schema (`title`, `sections[]`, `bullets[]`, etc.). Once you do that, you have not removed structure design work — you moved it into a rigid AST-like schema.
- A second hard result: there is **no JSON language server active in this workspace**. `lsp diagnostics` on the prototype JSON file returned `No language server found`. Today, Markdown has a real semantic tooling path here; JSON does not.
- So yes, recreating representative artifacts as JSON is a useful experiment, but the success criteria must include:
  - machine query ergonomics
  - link/navigation/refactor support
  - authoring burden for long-form reasoning
  - ability to preserve current artifact semantics without inventing a painful schema
  - actual tool availability in this workspace, not hypothetical editor support

## Updated judgment

- A targeted prototype is worthwhile.
- A repo-wide migration hypothesis is still weak unless the JSON shape can faithfully encode:
  - frontmatter metadata
  - sectioned narrative
  - cross-links
  - evidence lists
  - recommendations / open questions
  - stable machine queries
- Right now the evidence points toward **dual representations** being more plausible than all-JSON source artifacts:
  - Markdown remains better as authored source
  - generated JSON indexes/sidecars remain better as query surfaces
