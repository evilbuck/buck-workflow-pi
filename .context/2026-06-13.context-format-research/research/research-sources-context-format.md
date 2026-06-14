---
status: active
date: 2026-06-13
subject: 2026-06-13.context-format-research
topics: [context-format, markdown, json, jsonc, jq, llm-memory]
informs: []
---

# Source log: context format

## Local source 1 — README.md

- Path: `README.md`
- Accessed: 2026-06-13
- Key lines:
  - `README.md:7` — "It separates intent (plans in subject folders) from record (history in memory), creating a durable paper trail..."
  - `README.md:28` — "Artifact conventions: subject folder structure, frontmatter format, cross-reference linking"
  - `README.md:130-132` — "Skills... are written to be agent-agnostic... The skills are plain Markdown"

## Local source 2 — prior research on subject-scoped session JSON

- Path: `.context/2026-06-05.current-session-json-design/research-current-session-json-design.md`
- Accessed: 2026-06-13
- Key lines:
  - `...:13-19` — handoff reframed the file as sync payload; same pattern for grill-session
  - `...:42-51` — active-subject signal options and recommendation around committed structured state
  - `...:116` — "5 of 17 fields are cross-session durable. The other 12 are per-session papertrail or unused legacy."

## Local source 3 — repo implementation reads Markdown as structured data

- Paths:
  - `extensions/index.ts`
  - `extensions/b-flow/sdk-worker.ts`
  - `extensions/b-flow/verify-result.ts`
  - `skills/_shared/subject-resolution.md`
- Accessed: 2026-06-13
- Key lines:
  - `extensions/index.ts:96-103` — detects plan format via `format: discrete` frontmatter
  - `extensions/b-flow/sdk-worker.ts:161-164` — result markdown intentionally synthesized with YAML frontmatter
  - `extensions/b-flow/verify-result.ts:34-41` — missing YAML frontmatter is a verification failure
  - `skills/_shared/subject-resolution.md:19-27` — subject discovery mixes JSON session state with Markdown frontmatter

## External source 4 — RFC 8259

- URL: https://www.rfc-editor.org/rfc/rfc8259.txt
- Accessed: 2026-06-13
- Key lines:
  - `:145-152` — JSON design goals: "minimal, portable, textual, and a subset of JavaScript."
  - `:198-205` — JSON text grammar is strict serialized values; comments are absent from the grammar.

## External source 5 — JSONC specification

- URL: https://jsonc.org/
- Accessed: 2026-06-13
- Key lines:
  - "Notice: This is a draft of the JSONC Specification and is subject to change."
  - "Comments... MUST NOT affect consumption. Removing all comments MUST yield the same data representation..."
  - "The extension `.json` SHOULD be avoided..."
  - "Senders SHOULD NOT use `application/json` for JSONC content..."

## External source 6 — jq manual

- URL: https://jqlang.org/manual/
- Accessed: 2026-06-13
- Key lines:
  - "jq filters run on a stream of JSON data."
  - "The input to jq is parsed as a sequence of whitespace-separated JSON values..."

## External source 7 — Jekyll front matter docs

- URL: https://jekyllrb.com/docs/front-matter/
- Accessed: 2026-06-13
- Key lines:
  - "Any file that contains a YAML front matter block will be processed..."
  - "The front matter must be the first thing in the file..."
  - "You can also set your own front matter variables..."

## Local source 8 — live Marksman server capabilities

- Tool: `lsp status`, `lsp capabilities`
- Accessed: 2026-06-13
- Key findings:
  - active server: `marksman (ready)`
  - capabilities include `definitionProvider`, `referencesProvider`, `documentSymbolProvider`, `workspaceSymbolProvider`, `renameProvider`, `codeActionProvider`, `hoverProvider`, `completionProvider`

## Local source 9 — live Marksman behavior in this workspace

- Tool: `lsp definition`, `lsp references`, `lsp symbols`, `lsp diagnostics`
- Files:
  - `.context/2026-06-05.current-session-json-design/index.md`
  - `.context/2026-06-05.current-session-json-design/research-current-session-json-design.md`
  - `.context/2026-06-13.context-format-research/research/marksman-diagnostics-test.md`
- Accessed: 2026-06-13
- Observed results:
  - Markdown file link resolved to target document definition
  - Heading tree extracted correctly from a long research file
  - Workspace symbol search found related headings across `.context/`
  - Diagnostics reported both broken wiki-link (error) and broken inline link (warning)

## External source 10 — Marksman README / features docs

- URLs:
  - https://github.com/artempyanykh/marksman
  - https://github.com/artempyanykh/marksman/blob/main/docs/features.md
- Accessed: 2026-06-13
- Key lines:
  - README: "completion, goto definition, find references, rename refactoring, diagnostics, and more"
  - README: supports inline, reference, and wiki links
  - features.md: document symbols from headings; workspace symbols from headings; rename refactor; multi-folder workspaces; project-root behavior

## Local source 11 — JSON prototype + jq experiment

- Files:
  - `.context/2026-06-13.context-format-research/research/prototype-memory.json`
  - `.context/2026-06-13.context-format-research/research/prototype-subject-index.json`
- Accessed: 2026-06-13
- Observed results:
  - `jq` query cleanly extracted `status`, `subject`, `artifact_count`, `next_steps`
  - `jq -r '.verification[]'` emitted verification lines directly from the subject-index prototype
  - representing the original Markdown artifact required explicit nested document schema (`title`, `sections`, `bullets`) to preserve narrative structure

## Local source 12 — JSON LSP availability in this workspace

- Tool: `lsp diagnostics`
- File: `.context/2026-06-13.context-format-research/research/prototype-memory.json`
- Accessed: 2026-06-13
- Observed result:
  - `No language server found`
