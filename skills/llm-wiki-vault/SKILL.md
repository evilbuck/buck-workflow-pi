---
name: llm-wiki-vault
description: "Vault-native LLM Wiki for Obsidian PARA vaults: ingest sources, build interlinked research notes, maintain the knowledge base. For use in vaults at ~/Documents/second brain or any Obsidian vault using the vault-native LLM Wiki schema."
version: 1.0.0
author: wooderson
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [wiki, knowledge-base, research, notes, markdown, obsidian, rag-alternative, llm-wiki]
  category: research
  related_skills: [obsidian, b-research, b-plan]
---

# Vault-Native LLM Wiki

Build and maintain a persistent, compounding knowledge base as interlinked markdown files inside an Obsidian PARA vault — not a separate `~/wiki` directory.

Based on the [Karpathy LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), adapted for Obsidian PARA vaults (vault-native variant, not the standalone `~/wiki` variant).

Unlike RAG (which rediscovers knowledge from scratch per query), the wiki compiles knowledge once and keeps it current. Cross-references are already there. Contradictions are flagged. Synthesis reflects everything ingested.

**Division of labor:** The human curates sources and directs analysis. The agent summarizes, cross-references, files, and maintains consistency.

## When This Skill Activates

Use this skill when:
- The user asks to ingest, research, or process sources into the Obsidian vault
- The user asks to build, add to, or continue a wiki or knowledge base in Obsidian
- The user asks a question where the answer likely lives in the Obsidian vault (search vault first)
- The user asks to lint, audit, or health-check the vault's research notes
- The user references their "second brain," "Obsidian vault," or "knowledge base" in a research context

## Vault Location

**Buckley's vault:** `/home/buckleyrobinson/Documents/second brain`

For other vaults, the path is set by `OBSIDIAN_VAULT_PATH` environment variable. If unset, defaults to `~/Documents/second brain`.

```bash
VAULT="${OBSIDIAN_VAULT_PATH:-${HOME}/Documents/second brain}"
```

## Architecture: Vault-Native Layers

```
vault/
├── 90_System/
│   ├── LLM Wiki Schema.md       # Conventions, frontmatter, tag taxonomy, placement rules
│   ├── LLM Wiki Integration.md  # Protocol walkthrough for agents
│   └── LLM Wiki Log.md          # Append-only chronological action log
├── 40_Archives/Raw-Sources/
│   ├── articles/                 # Layer 1: Immutable web article captures
│   ├── papers/                  # Layer 1: PDFs, arxiv papers
│   ├── transcripts/             # Layer 1: Meeting notes, interviews
│   └── assets/                 # Layer 1: Images, diagrams
└── [PARA folders]/
    ├── 30_Resources/            # Layer 2: Concept/resource pages (Design/, AI/, Tech-Notes/)
    ├── 20_Areas/                # Layer 2: Area pages
    ├── 10_Projects/             # Layer 2: Project research
    └── 30_Resources/<Domain>/   # Layer 2: Domain-specific indexes and research
```

**Layer 1 — Raw Sources:** Immutable. The agent reads but never modifies these.
**Layer 2 — Synthesis:** Agent-owned markdown files. Created, updated, and cross-referenced by the agent.
**Layer 3 — Schema:** `90_System/LLM Wiki Schema.md` defines structure, conventions, and tag taxonomy.

## Critical: Always Orient First

Before any non-trivial research write, orient yourself:

```bash
VAULT="${OBSIDIAN_VAULT_PATH:-${HOME}/Documents/second brain}"

# 1. Read the schema — mandatory before first write in any session
read_file "$VAULT/90_System/LLM Wiki Schema.md"

# 2. Read the nearest MOC or domain index
read_file "$VAULT/90_System/Maps-of-Content/Resources MOC.md"
# or the relevant domain index, e.g.:
read_file "$VAULT/30_Resources/Design/Design Resources Index.md"

# 3. Scan recent log entries (last 30 lines)
read_file "$VAULT/90_System/LLM Wiki Log.md" offset=<last 30 lines>

# 4. Search for existing pages on the topic
search_files "<topic>" path="$VAULT" limit=10
```

Skipping orientation causes:
- Duplicate pages for entities that already exist
- Missed cross-references to existing content
- Contradicting the schema's conventions
- Repeating work already logged

For large vaults (100+ pages), also run a quick `search_files` for the topic at hand before creating anything new.

## Core Operations

### 1. Ingest — Full Protocol

When the user provides a source (URL, file, paste) to integrate:

#### Step 1a: Capture the raw source

```bash
VAULT="${OBSIDIAN_VAULT_PATH:-${HOME}/Documents/second brain}"
```

- **URL** → use `web_extract` to get markdown, save to `40_Archives/Raw-Sources/articles/`
- **PDF** → use `web_extract` (handles PDFs), save to `40_Archives/Raw-Sources/papers/`
- **Pasted text** → save to appropriate `raw/` subdirectory
- **Name file descriptively:** `raw-sources/articles/llm-wiki-karpathy-2026.md`
- **Add raw frontmatter** (`source_url`, `ingested`, `sha256` of body only)

On re-ingest of the same URL: recompute the sha256, compare to the stored value — skip if identical, flag drift if different.

#### Step 1b: Orient and check existing pages

Before writing synthesis, run the orientation steps above. Check for existing pages covering the same entities/concepts.

#### Step 1c: Write or update synthesis pages

- **New content:** Create pages only if they meet the Page Thresholds in the schema (2+ source mentions, or central to one source)
- **Existing pages:** Add new information, update facts, bump `updated` date. Follow the Contradiction Policy when new info conflicts.
- **Frontmatter:** Use the vault's standard frontmatter (see schema). Add LLM Wiki provenance fields (`sources:`, `confidence:`).
- **Cross-reference:** Every new or updated page must link to at least 2 other pages via `[[wikilinks]]`.
- **Tags:** Only use tags from the taxonomy in the schema.
- **Provenance markers:** On pages synthesizing 3+ sources, use paragraph-level `^[raw-sources/articles/source-file.md]` markers.

#### Step 1d: Update navigation

- Add new pages to the nearest MOC/index under the correct section
- Update the "Last updated" date in the index header

#### Step 1e: Log the action

Append to `90_System/LLM Wiki Log.md`:

```markdown
## [YYYY-MM-DD] ingest | Source Title
- Summary: what changed
- Files created:
  - path
- Files updated:
  - path
- Sources captured:
  - path or URL
- Notes: caveats, conflicts, follow-ups
```

#### Step 1f: Report

List every file created or updated to the user.

---

### 2. Query — Answer from the Vault

When the user asks a question about a domain covered by the vault:

① **Search the vault** — use `search_files` for key terms across the vault
② **Read the relevant pages** identified by search
③ **Synthesize an answer** from the compiled knowledge. Cite the wiki pages: "Based on [[page-a]] and [[page-b]]..."
④ **File valuable answers back** — if the answer is a substantial comparison or novel synthesis, create a page in the appropriate domain folder. Don't file trivial lookups.
⑤ **Update the log** with the query and whether it was filed.

---

### 3. Lint — Health Check

When the user asks to lint or audit the vault's research notes:

Check and report:
1. **Broken wikilinks** — `[[links]]` pointing to pages that don't exist
2. **Orphan pages** — research/resource pages with no inbound links from other pages
3. **Missing frontmatter** — pages missing required fields (title, created, updated, para-category, status)
4. **No updated date** — pages without an `updated:` frontmatter field
5. **Large pages** — pages over ~250 lines that may need splitting
6. **Missing provenance** — research pages making external claims but lacking `sources:` or `source_urls:`
7. **Missing log entries** — research pages created without a corresponding log entry
8. **Raw source drift** — raw files with `sha256:` that no longer match the body
9. **Contested pages** — pages with `contested: true` frontmatter needing review

Append lint summary to `LLM Wiki Log.md`.

---

## Frontmatter (Vault-Native)

Every new page in the vault must start with:

```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
co-authored: wooderson
para-category: inbox | project | area | resource | archive
status: active | completed | archived
audience: human | agent | both
tags:
  - tag1
  - tag2
related:
  - "[[Related Page]]"
---
```

For LLM Wiki-style research notes, add:

```yaml
sources:
  - "[[40_Archives/Raw-Sources/articles/source-file]]"
source_urls:
  - https://example.com/source
confidence: high | medium | low
contested: true
contradictions:
  - "[[Conflicting Page]]"
```

### Audience values

| Value | Meaning |
|-------|---------|
| `human` | Written for human reading first |
| `agent` | Dense lookup/index/reference page for agents |
| `both` | Useful to humans and agents |

### Common mistakes to avoid

- `status: in_progress` — invalid; use `status: active`
- `category:` instead of `para-category:`
- Missing `status:` or `para-category:`
- **Writing content before frontmatter.** Write frontmatter + content in one atomic `write_file` call. Adding frontmatter later via patch leaves the note in an invalid state between writes.

## Raw Source Frontmatter

Every raw source file should start with:

```yaml
---
title: Source Title
source_url: https://example.com/source
ingested: YYYY-MM-DD
sha256: <hex digest of body only>
source_type: article | paper | transcript | asset | paste
status: raw
---
```

Rules:
- Raw sources are immutable after capture.
- Compute `sha256` over the body after the closing frontmatter delimiter.
- Re-ingesting the same URL should compare hashes and skip if unchanged.
- If the source changed, create a new raw source version or explicitly log the drift.

## File Placement Rules

| Content type | Preferred location |
|---|---|
| Raw web article | `40_Archives/Raw-Sources/articles/` |
| Raw paper/PDF | `40_Archives/Raw-Sources/papers/` |
| Raw transcript | `40_Archives/Raw-Sources/transcripts/` |
| Raw asset/image | `40_Archives/Raw-Sources/assets/` |
| Technical concept | `30_Resources/Tech-Notes/` or relevant domain folder |
| Design/system concept | `30_Resources/Design/` |
| AI/tooling concept | `30_Resources/AI/` |
| Company research | `30_Resources/company-research/` unless project-specific |
| Project-specific research | `10_Projects/<Project>/` or project docs |
| Query answer worth preserving | nearest domain folder or standalone resource note |
| Comparison | nearest domain folder, title as `<A> vs <B>` |

## Cross-Linking Requirements

For every new durable note:
1. Add at least 2 outbound `[[wikilinks]]` in body or `related:` frontmatter.
2. Link it from the nearest MOC, hub, or index.
3. If it mentions an existing entity/person/company/project, make the mention a wikilink.
4. If the note is part of a relationship graph, verify backlinks both directions.
5. If the note is `audience: agent`, include a `Quick Agent Lookup` block.

## Provenance Levels

| Level | When | Requirement |
|-------|------|-------------|
| Light | Single source / simple bookmark | `source_urls:` is enough |
| Normal | Research synthesis | `sources:` or `source_urls:` + `confidence:` |
| Strong | 3+ source synthesis / contested topic | paragraph-level source markers where useful |

Paragraph-level markers: `Claim text here. ^[raw-sources/articles/source-file.md]`

## Confidence Rules

| Confidence | Meaning |
|------------|---------|
| `high` | Multiple reliable sources agree or source is authoritative documentation |
| `medium` | Plausible synthesis from 1–2 decent sources |
| `low` | Single source, fast-moving topic, opinion-heavy, or uncertain inference |

## Contradiction Policy

When new information conflicts with existing notes:
1. Keep both positions if the conflict is real.
2. Add dates and sources.
3. Set `contested: true` in frontmatter.
4. Add `contradictions:` links to conflicting pages.
5. Log the conflict in `LLM Wiki Log.md`.

## Page Thresholds

Create a durable page when:
- The topic/entity is central to the source, or
- The topic/entity appears in 2+ sources, or
- The user explicitly asks for a page/index, or
- The content would be painful to re-derive later, or
- The page is needed as a hub for related notes.

Do NOT create a durable page for:
- Passing mentions
- Throwaway facts
- Single unsupported claims
- Temporary todos
- Information that will be stale within a week

## Wikilink Escaping in Tables

When a `[[path|display]]` wiki-link appears inside a markdown table cell, the `|` must be escaped as `\|`. Unescaped pipes are parsed as column separators and corrupt the table layout.

```markdown
<!-- Wrong -->
| [[10_Projects/Upwork Proposals|Upwork Proposals]] | Active |

<!-- Correct -->
| [[10_Projects/Upwork Proposals\|Upwork Proposals]] | Active |
```

## Quick Agent Lookup

```
LLM-WIKI      → [[llm-wiki-vault]] (this skill)
WIKI-SCHEMA   → [[90_System/LLM Wiki Schema]] (schema in vault)
WIKI-INTEGRATION → [[90_System/LLM Wiki Integration]] (protocol walkthrough)
WIKI-LOG      → [[90_System/LLM Wiki Log]] (append-only log)
RAW-SOURCES   → [[40_Archives/Raw-Sources/README]] (raw source directory)
INGEST        → [[llm-wiki-vault]] (this skill — Step 1: Ingest)
QUERY         → [[llm-wiki-vault]] (this skill — Step 2: Query)
LINT          → [[llm-wiki-vault]] (this skill — Step 3: Lint)
DESIGN-INDEX  → [[30_Resources/Design/Design Resources Index]]
AI-INDEX      → [[30_Resources/AI/AI Coding Tools Index]]
```

## Pitfalls

- **Never modify files in `raw/`** — sources are immutable. Corrections go in synthesis pages.
- **Always orient first** — read Schema + nearest MOC + recent log before any write. Skipping this causes duplicates and missed cross-references.
- **Always update the MOC/index and log.md** — skipping this makes the wiki degrade.
- **Don't create pages for passing mentions** — follow Page Thresholds.
- **Don't create pages without cross-references** — isolated pages are invisible.
- **Frontmatter must be first** — write frontmatter + content in one atomic call.
- **Tags must come from the taxonomy** — freeform tags decay into noise. Add new tags to the schema first, then use them.
- **Handle contradictions explicitly** — don't silently overwrite. Note both claims with dates, mark in frontmatter, flag for review.
- **Wikilinks in tables must escape `|`** — use `\|` inside table cells.

## Related Skills

- `obsidian` — for reading, searching, and creating notes in the vault (uses the same vault path)
- `b-research` — for running research passes before writing to the vault
- `b-plan` — for planning research-intensive work that will feed the vault
