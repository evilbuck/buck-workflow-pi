---
status: active
date: 2026-06-13
subject: 2026-06-13.context-format-research
topics: [context-format, markdown, json, jsonc, jq, llm-memory, marksman]
informs: [plan-hybrid-context-artifact-model.md]
---

# Research: Context artifact format for agent memory and workflow state

## Question

Should Buck workflow keep `.context/` artifacts as Markdown, switch to JSONC, or split formats by artifact type?

## Conclusion

**Do not replace `.context/` wholesale with JSONC.**

Best fit here is a **hybrid contract**:

- **Keep Markdown + YAML frontmatter** for plans, research, specs, memory, backlog items, and subject indexes.
- **Use strict JSON** for machine-owned, high-write operational state and derived indexes.
- **Avoid JSONC** as the primary format.

Why:

1. The repo already treats Markdown as a structured medium via frontmatter, headings, filenames, and links.
2. The live Markdown LSP (`marksman`) is effective enough to make Markdown navigable and partially queryable for agent work.
3. Recreated JSON prototypes are clearly easier to slice with `jq`, but preserving the same artifact semantics required inventing a nested document schema.
4. There is no JSON language server active in this workspace today, while Markdown already has semantic tooling.
5. JSONC weakens interoperability with tools like `jq`; if `jq` is the reason, choose **JSON**, not JSONC.
6. Narrative artifacts are not just key/value stores. The body text is the payload: synthesis, rationale, risks, evidence, citations, and next-step recommendations.

## Key findings

### 1. The repo already uses a hybrid model in practice

Existing design work moved workflow state into JSON because it is operational state with field lifecycles, frequent writes, and handoff semantics. That same work did **not** argue for moving plans/research/memory out of Markdown.

This means the repo already has an implicit split:

- **Markdown** for durable narrative artifacts
- **JSON** for operational session state

### 2. Markdown in this repo is already structured data

This is not "freeform prose vs structured JSON".

Repo code already reads Markdown structurally:

- `extensions/index.ts` checks `format: discrete` frontmatter.
- `extensions/b-flow/sdk-worker.ts` intentionally writes Markdown with YAML frontmatter.
- `extensions/b-flow/verify-result.ts` fails verification if frontmatter is missing.
- `skills/_shared/subject-resolution.md` depends on frontmatter and naming conventions for discovery.

So the real choice is between **structured Markdown** and **strict JSON**, not between structure and no structure.

### 3. JSONC is a poor fit for the `jq` argument

RFC 8259 JSON is minimal and portable. Comments are not part of JSON grammar.

JSONC:

- is still a draft spec
- adds comments that consumers must ignore
- recommends `.jsonc`, not `.json`
- should not be sent as `application/json`

`jq` consumes **JSON**. It does not natively justify JSONC. If the desired gain is `jq` queries, JSONC adds friction instead of removing it.

### 4. Markdown LSP support is materially useful here

Live workspace checks show `marksman` is available and effective.

Observed behavior in this repo:

- Markdown artifact link → `definition` resolved to the target file
- `references` worked across linked artifact files
- `symbols` produced a heading tree for long research docs
- `workspace symbols` found related headings across `.context/`
- diagnostics flagged:
  - broken wiki-link as an **error**
  - broken inline Markdown link as a **warning**

This matters because it means agents can navigate `.context/` semantically without converting everything to JSON.

### 5. Markdown still has real limits

Markdown + frontmatter is weaker than JSON when you need:

- hard schema enforcement
- trivial field slicing with `jq`
- bulk machine mutation
- low-noise diffing for frequently rewritten fields
- deterministic validation of enums/required keys/types

For those cases, JSON is better.

### 6. Prototype JSON confirms the upside and the cost

I recreated representative artifacts as JSON and tested them with `jq`.

Observed upside:

- extracting fields and lists is trivial
- verification lines stream cleanly
- aggregate counts are easy

Observed cost:

- preserving memory/research/index semantics required a custom document schema (`title`, `sections[]`, `bullets[]`)
- the more faithful the conversion, the less "simple JSON" it becomes
- there is no active JSON LSP here, so JSON currently loses on semantic editor support in this workspace

This makes the likely winning shape **Markdown as source, JSON as derived view**, not JSON-only source artifacts.

## Tradeoff table

| Need | Best format |
|---|---|
| Long-form reasoning, synthesis, citations, recommendations | Markdown + frontmatter |
| Cross-linking human/agent-readable artifacts | Markdown + frontmatter |
| Heading-based navigation / workspace symbols / link definition | Markdown + LSP |
| High-write operational state | JSON |
| Strict schema validation | JSON |
| `jq` queries | JSON |
| Comments inside machine state | Usually separate docs, not JSONC |
| Current live LSP support in this workspace | Markdown |

## Recommendation

### Recommended steady-state model

1. **Keep current Markdown artifact classes**
   - `research-*.md`
   - `plan-*.md`
   - `spec-*.md`
   - subject `index.md`
   - memory files
   - backlog item files

2. **Tighten the Markdown contract instead of replacing it**
   - standardize frontmatter keys per artifact type
   - add validators for required keys and enum values
   - prefer predictable heading sections for major artifact classes
   - optionally add generated summary/index files for machine lookup

3. **Use strict JSON for machine-owned state**
   - session state
   - grill state
   - caches
   - derived registries/indexes
   - any artifact rewritten often or queried programmatically

4. **Do not standardize on JSONC**
   - it is worse than JSON for interoperability
   - it does not solve prose-heavy artifact needs
   - it adds parser/tool variance without giving stronger guarantees

## If you want more queryability without losing Markdown

Best next move is not a repo-wide format migration. It is one of these:

### Option A — generated JSON indexes from Markdown

Keep source-of-truth Markdown, generate compact JSON indexes such as:

- `.context/index/subjects.json`
- `.context/index/memory.json`
- `.context/index/backlog.json`

Pros: keeps rich artifacts, adds `jq`-friendly views.

### Option B — stricter frontmatter schema + validator

Define per-artifact schemas and validate them in tooling.

Pros: preserves Markdown ergonomics; catches drift.

### Option C — formal bake-off on representative artifacts

Pick 3 real artifact types and recreate them as JSON:

- one memory file
- one research file
- one plan or subject index

Then score both representations on:

- authoring friction
- linkability
- queryability
- diff noise
- schema validation
- LSP/navigation support

Pros: replaces opinion with measured tradeoffs.

### Option D — selective sidecars

For a few artifact types, keep:

- `research-foo.md` as narrative source
- `research-foo.meta.json` as machine index

Pros: narrow change; avoids repo-wide migration.

## Brainstorm: what a hybrid model could look like

### Model 1 — Markdown source, generated JSON indexes

Source of truth stays in existing Markdown artifacts.

Add generated machine views:

- `.context/index/subjects.json`
- `.context/index/memory.json`
- `.context/index/backlog.json`
- `.context/index/artifacts.json`

What each contains:

- only normalized metadata and light summaries
- stable ids / paths
- status, subject, date, topics, related, artifacts
- selected derived fields like `title`, `goal`, `verification_summary`

Good:

- minimal authoring change
- jq-friendly
- no duplication of long-form prose
- easy to regenerate

Risk:

- indexes can go stale unless regenerated on write or checked in CI/hooks

### Model 2 — Markdown source, per-file JSON sidecars

Each narrative artifact keeps its `.md` file plus a sibling machine file:

- `research-foo.md`
- `research-foo.meta.json`

Sidecar holds:

- frontmatter fields
- extracted headings
- outbound links
- brief summary / abstract
- hash / mtime / generated_at for staleness checks

Good:

- strongest locality
- easy per-artifact jq queries
- enables richer graph building later

Risk:

- file count explosion
- sidecar churn in diffs

### Model 3 — Markdown source, JSON only for machine-owned classes

Keep all narrative artifacts as Markdown.

Move only inherently machine-owned artifacts to JSON:

- session state
- grill state
- backlog ledger/index
- memory index
- report registries / audit summaries

Good:

- smallest conceptual change
- clean separation: prose vs state

Risk:

- some queries still require frontmatter parsing or generated reports

### Model 4 — Markdown source, typed report payload blocks

Keep Markdown, but reserve one machine block inside it:

```md
## Structured Summary
```json
{ ... }
```
```

Use this only for artifact types that need both long-form explanation and precise machine payloads.

Good:

- one file
- human rationale and machine summary stay co-located

Risk:

- awkward editing
- harder validation
- worse than pure sidecars if the JSON block gets large

### Model 5 — Dual-write authoring model

Agents write both:

- canonical `.md`
- canonical `.json`

Same artifact, two equal sources.

I do **not** recommend this.

Why not:

- hardest consistency problem
- ambiguous source of truth
- guaranteed drift unless every writer is perfect

## My recommended hybrid shape

Closest boring win:

1. **Markdown remains source of truth** for:
   - memory files
   - research
   - plans
   - specs
   - subject indexes
   - backlog item detail files
2. **Strict JSON remains source of truth** for:
   - session/grill state
   - generated registries
   - query indexes
   - compact audit/result summaries
3. **Generated JSON indexes** provide the jq surface.
4. **Frontmatter schemas + validator** provide contract enforcement for Markdown.

That yields:

- good authoring ergonomics
- good current LSP support
- good jq support
- minimal migration risk

## If we implemented it tomorrow

Minimal first slice:

1. Define frontmatter schemas for:
   - memory
   - subject index
   - research
   - plan
   - backlog item
2. Build generator:
   - read `.context/**/*.md`
   - emit `.context/index/*.json`
3. Put these JSON views behind one command/script.
4. Test common queries:
   - active subjects
   - latest memory by topic
   - open backlog by subject
   - artifacts touching path X

## Bottom line

**Markdown is still the right primary format for Buck's durable context artifacts.**

But not because it is perfect. Because in this repo it already combines:

- expressive narrative payload
- machine-readable frontmatter
- link structure
- effective Markdown LSP navigation

Where stronger structure is needed, prefer **JSON**, not JSONC.


## Sources consulted
- `README.md`
- `.context/2026-06-05.current-session-json-design/research-current-session-json-design.md`
- `extensions/index.ts`
- `extensions/b-flow/sdk-worker.ts`
- `extensions/b-flow/verify-result.ts`
- `skills/_shared/subject-resolution.md`
- prototype JSON files in `.context/2026-06-13.context-format-research/research/`
- RFC 8259 — https://www.rfc-editor.org/rfc/rfc8259.txt
- JSONC specification — https://jsonc.org/
- jq manual — https://jqlang.org/manual/
- Jekyll front matter docs — https://jekyllrb.com/docs/front-matter/
- Marksman README — https://github.com/artempyanykh/marksman
- Marksman features — https://github.com/artempyanykh/marksman/blob/main/docs/features.md

## Recommended next step

1. **formal bake-off plan** for 3 artifact types: memory, research, plan/index
2. **frontmatter schema validator** for `.context/` Markdown artifacts
3. **generated JSON indexes** for `.context/` to unlock `jq`
4. **hybrid artifact policy doc** that codifies when Buck uses Markdown vs JSON
