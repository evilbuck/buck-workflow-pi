---
name: b-arch-qa
description: Run a live Q&A exploration session about architecture, codebase structure, or technology choices. At session start, asks the user where to keep the discussion doc (default: `.context/discussions/{subject}.md`; Obsidian vault and custom paths supported). Answers questions by searching the web and/or exploring the codebase and builds a durable discussion document as the session progresses. Read-only — does not edit application code; hands implementation off to `b-build`. Use when the user wants to understand how something works, compare approaches, or explore tradeoffs through back-and-forth conversation.
---

# arch-qa: Architecture Q&A Exploration

Run a live Q&A session that combines codebase exploration and web research, building a durable discussion document in the background as the conversation progresses.

## When to Use

- User wants to understand the architecture of the project or a subsystem
- Back-and-forth questions about technology choices, tradeoffs, or patterns
- Mix of general (Next.js/React/language) and project-specific questions
- User is learning a new part of the stack and wants answers grounded in the actual code
- Post-investigation: you want to document what was discovered during exploration

## When NOT to Use

- User wants a one-off answer with no ongoing session — just answer and move on
- User explicitly doesn't want a document
- The question is purely about external technology with no codebase relevance — use `b-research` instead
- User wants code changes **implemented**, not just discussed — use `b-build` or `b-iterate` instead (arch-qa is read-only)

## Behavior

### Read-only — discussion and documentation, not implementation

**Do not edit application code, config, tests, or infrastructure.** arch-qa answers questions and writes the discussion doc — nothing else. In scope: reading the codebase (`read`, `grep`, `glob`, `lsp`, `ast_grep`), web research, and writing **only** the discussion doc (plus sibling notes in Obsidian mode). Out of scope: any `edit` / `write` / `bash` mutation of the project under discussion.

If the conversation surfaces work to do — a bug, a refactor, a config change — **do not start it here.** Record the finding in the discussion doc, file a backlog item if asked, and hand off to `b-build` / `b-iterate` with the discussion doc as context.

When the user says "apply this", "let's do X", or "fix Y", read it as *analyze and document how X would work*, then **offer the hand-off to `b-build`** — do not implement inline. If it's ambiguous whether they want discussion-only or implementation, ask before editing anything other than the discussion doc.

### Session start

1. **Pick the discussion doc location.** Ask the user once (use `ask`) — the location is fixed for the whole session. Three options:
   - **Project `.context/`** (recommended default) → `.context/discussions/{subject}.md`. Stays in-repo, durable, version-controlled.
   - **Obsidian vault** → a subject folder inside the user's vault (see [Obsidian vault](#obsidian-vault) below). Cross-project, searchable, linkable.
   - **Custom path** → any path the user names (e.g. `docs/notes/{subject}.md`).
   Remember the choice as `location_kind` (`context` | `obsidian` | `custom`) and `doc_path` (the resolved file path). Do not re-ask unless the user changes their mind mid-session.
2. **Infer the subject** from the first question or the user's framing (e.g. `nextjs-architecture`, `auth-flow`, `database-design`). Use the subject both as the filename slug and as the Obsidian folder name.
3. **Resume if it exists.** Look for a doc matching the subject at the chosen location. If found, load it and continue from where it left off (preserve prior Q&A and Architecture section). If the user picks Obsidian but a project-side doc with the same subject already exists, surface that fact and ask whether to copy it over, link it, or treat them as separate sessions.
4. **Create the doc fresh** if no match exists. For Obsidian, create the full subject folder structure first; for project or custom, create the single file.

### Per question

1. **Determine source**: Is this a general technology question, a codebase question, or both?
   - General → search the web
   - Codebase → explore files, use LSP, search, read
   - Both → do both in parallel
2. **Answer directly** in the chat. Dense, evidence-first. No ceremony.
3. **Spin a background subagent** immediately after answering to append the Q&A to the doc. Do not wait for the subagent — continue the session.

### Document structure

Every discussion doc follows this layout:

```markdown
# {Subject} Q&A

_Session: YYYY-MM-DD_

## Architecture

{Living summary of what has been learned about the architecture.
Updated as new facts emerge. Covers: structure, rendering model,
data flow, auth, performance characteristics, and any notable patterns.}

---

## Q: {First question verbatim or close paraphrase}

{Answer — same quality as the chat answer. Code blocks, tables, diagrams where useful.}

---

## Q: {Second question}

{Answer}
```

The `## Architecture` section is **not a Q&A entry** — it is a running factual summary maintained separately. Update it whenever a Q&A reveals a new structural fact. It should always be readable as a standalone architecture overview independent of the Q&A conversation.

### Architecture section rules

- One section per document, near the top, before any Q&A entries
- Written in present tense, factual, no opinion
- Covers: monorepo/project structure, rendering model, API/transport layer, auth, data fetching, database, and any significant performance characteristics
- Updated incrementally via subagent as new facts emerge — do not wait until the end
- If a fact from a Q&A contradicts the Architecture section, correct the section

### Subagent pattern

Every append uses a `quick_task` subagent:

```
context: Goal, constraints (append-only, style-match, no emojis)
tasks: [{
  assignment: "Read the file first, then append the following section..."
  role: "Technical documentation writer"
}]
```

Fire and forget — do not poll the subagent job. The result arrives as a system notice; acknowledge the line count and continue. If you need to update both the Architecture section and append a Q&A entry in one turn, spawn two subagents in parallel.

### Tone and content for Q&A entries

- Same quality as the live chat answer — do not paraphrase down
- Include code blocks showing actual file paths and line context
- Include tables for comparisons
- Include the "why" not just the "what" — tradeoffs, design intent, risk
- If a question reveals a performance issue, bug, or architectural concern, note it explicitly
- If a question leads to a backlog item being created, reference it in the answer

## Document Location

Three valid locations, chosen once per session via the built-in `ask` tool. The choice is sticky — never re-ask unless the user changes their mind.

### Project `.context/discussions/` (default)

`.context/discussions/{subject}.md` — a single flat file per subject. Stays in-repo, durable, version-controlled. Co-located with the other session artifacts. Use this unless the user asks for Obsidian or names a path.

### Obsidian vault

A **subject folder** inside the user's vault, organized the same way `.context/` subject folders are (`YYYY-MM-DD.<subject-name>/`), so the vault mirrors the in-repo structure for Q&A. Inside the folder, the main discussion note is `index.md` (Obsidian's per-folder entry point), with the Q&A contents as the index body. **Every note in the folder MUST carry `tags: [arch-discussion]` (plus the subject-specific tag, e.g. `auth-flow`, `nextjs`) in its YAML frontmatter** — the `#arch-discussion` tag is the single canonical marker for "this note belongs to an arch-qa session" and is what makes the vault queryable as a set. Obsidian also accepts inline `#arch-discussion` for redundancy, but the source of truth is frontmatter (so it survives copy/paste and shows up in the Properties panel).

When the session expands into multiple architecture files (one per topic, or one per Q&A cluster), they all live as siblings inside the same subject folder so Obsidian's graph view shows the cluster as one node neighborhood. Use Obsidian-flavored Markdown throughout: YAML frontmatter, wikilinks for cross-references, `> [!note]` / `> [!question]` callouts where they earn their keep.

**Obsidian note template** — every note in the subject folder starts with this frontmatter:

```yaml
---
tags: [arch-discussion, <subject-tag>]
subject: <subject-name>
session: <YYYY-MM-DD>
---
```

`<subject-tag>` is the kebab-case subject (e.g. `auth-flow`); `<subject-name>` and `<session>` mirror the folder. Add the inline `#arch-discussion` tag near the top of the body for redundancy, then proceed with the standard Q&A layout.

Setup flow:
1. Use the built-in `ask` tool to confirm vault destination (single-question prompt with the three locations).
2. If Obsidian: ask which vault if more than one is configured (omit if only one). Use the `obsidian-cli` skill (`obsidian create` / `obsidian append`) to write — never raw filesystem writes — so Obsidian's indexer picks up the files immediately. Resolve vault paths via `vault://<vault>/<path>` when reading.
3. If project `.context/` (default): use plain filesystem `read` / `write` / `append` (the harness resolves these directly).
4. If custom: write to the path the user gave; verify the parent dir exists or `mkdir -p` it.

### Custom path

Any path the user names (e.g. `docs/notes/{subject}.md`, `~/notes/arch/{subject}.md`). Write with the same tool as the chosen kind would (fs for local paths, `obsidian-cli` for paths inside a vault).

### Mixed kinds

If the user wants both in-repo and Obsidian (e.g. project doc for the team, Obsidian for personal note-taking), write to both. Pick the primary for chat-side narration; the secondary gets the same content via parallel writes.

## Example subjects

- `nextjs-architecture` — rendering model, SSR vs CSR, server functions, navigation
- `auth-flow` — session management, token validation, tenant gating
- `database-design` — schema conventions, trigger patterns, RLS
- `api-layer` — oRPC structure, procedures, transport modes
- `performance` — bottlenecks, cold starts, caching, observability

## Integration with other workflows

- After an arch-qa session, the Architecture section of the discussion doc is useful input to `b-plan` — reference it with `research:` in the plan frontmatter
- Backlog items discovered during Q&A should be created with the standard backlog item format and referenced in the discussion doc
- If the session surfaces a bug or regression, hand off to `b-build` or `b-iterate` with the discussion doc as context

## Success criteria

A session is well-executed when:
- Every question has a grounded answer (code evidence or web citation, not guessing)
- The discussion doc is current with all Q&A from the session
- The Architecture section reflects everything learned, readable without the Q&A
- Any backlog items or action items discovered are filed
- The doc is committed or ready to commit
