---
name: b-backlog
description: Delegate to a subagent to author a buck-workflow backlog item and register it in todo.md. Use when a piece of work is identified (from conversation, a plan, a review finding, or an explicit description) and needs durable tracking in the buck-workflow backlog.
triggers:
  - /b-backlog
  - add to backlog
  - backlog this
  - create backlog item
  - track this as backlog
---

# b-backlog: Backlog Item Authoring

Create a buck-workflow backlog item via a dedicated subagent, then register it in `.context/backlog/todo.md`. The subagent writes the item file and proposes the todo line + related links; the parent reviews and commits the todo registration.

## When to Use

- A piece of work surfaces in conversation that isn't happening this session
- `/b-review` surfaces an out-of-plan follow-up that needs tracking
- A plan or spec identifies deferred scope
- The user explicitly says "backlog this" or similar
- A decision is made to defer scope from the current plan

## When NOT to Use

- Work that is happening **now** → do it, don't backlog it
- GitHub issue creation → use `/b-issue-create`
- A full plan/spec that doesn't exist yet → use `/b-brainstorm` or `/b-plan` first, then backlog the resulting work if it's being deferred
- Memory capture of what happened → use `/b-save`

## Write Boundary

- `.context/backlog/items/<slug>.md` — new item file (subagent writes)
- `.context/backlog/todo.md` — one checkbox line appended (parent writes, after review)
- Read-only scan of `.context/` (plans, specs, memory, subjects) to propose `related:` links

The subagent does not touch application code, CI, infra, tests, or any other `.context/` artifact.

## Approved Item Schema

### Frontmatter (required)

```yaml
---
title: <Human-readable title, imperative or noun phrase>
status: active
priority: high | medium | low
created: YYYY-MM-DD
updated: YYYY-MM-DD
completed: null
related:
  - <repo-root-relative paths to plans, specs, memory files, subjects, skills>
---
```

Enums: `priority ∈ {high, medium, low}`, `status ∈ {active, completed}`. A new item is always `status: active` with `completed: null`.

### Body (minimal approved shape)

The body has two required elements and nothing else is mandated:

1. **H1 title** — matches or restates the frontmatter title
2. **Acceptance criteria** — a bulleted checklist of observable outcomes

The subagent MAY add sections (Problem, Desired outcome, Out of scope, Notes, Follow-ups) when they would materially help a future agent or the user understand the item. It MUST NOT pad with boilerplate. Default to shorter.

Example minimal item:

```markdown
---
title: Add retry budget to HTTP client
status: active
priority: medium
created: 2026-07-06
updated: 2026-07-06
completed: null
related:
  - .context/backlog/items/http-client-refactor.md
---

# Add retry budget to HTTP client

## Acceptance criteria

- [ ] Retry logic caps aggregate retries per request at a configurable budget
- [ ] Budget exhaustion surfaces as a distinct error, not an infinite loop
- [ ] Unit tests cover budget exhaustion and normal retry paths
- [ ] Document the budget knob in the HTTP client README section
```

### Slug rules

- Kebab-case, short, descriptive
- Derived from the title; drop articles and filler
- Must be unique within `.context/backlog/items/` — if a collision exists, append a disambiguator (e.g. `-2`, or the distinguishing noun)

## Subagent Delegation Protocol

### 1. Parent gathers input

The parent identifies what's being backlogged from one of:

- The active conversation (most common — "backlog this thing we just discussed")
- An explicit description passed as `$ARGUMENTS` to `/b-backlog`
- A reference to an existing plan, spec, or subject folder (turn its scope into a tracked item)

If the input is ambiguous (what is the work? why backlog it now vs. do it?), the parent asks **one** targeted clarifying question before dispatching. Do not dispatch with a guess.

### 2. Parent spawns the subagent

Dispatch a single `task` subagent with:

- `role`: **"Backlog Curator"** — a specialist lens for crafting scannable, actionable backlog entries
- A prompt that includes:
  - The approved schema (frontmatter + minimal body shape) above — copy it into the prompt verbatim, don't rely on the subagent knowing this skill
  - The gathered input (conversation summary, description, or plan/spec reference)
  - Instructions to scan `.context/` for related artifacts (plans, specs, memory files, subject folders, skills) and populate `related:`
  - Instructions to propose a unique slug
  - Instructions to **write** the item file to `.context/backlog/items/<slug>.md`
  - Instructions to **return** (not write): the proposed todo.md checkbox line and the final `related:` list
  - Today's date for `created:` / `updated:`

The parent's prompt to the subagent MUST include the schema. Subagents do not inherit skill context.

### 3. Subagent work

The subagent:

1. Picks a slug from the title
2. Checks `.context/backlog/items/` for collisions
3. Scans `.context/` (subjects, plans, specs, memory index) for related artifacts and drafts the `related:` list
4. Writes `.context/backlog/items/<slug>.md` with the approved schema
5. Returns to the parent:
   - The item path
   - The proposed todo.md line: `- [ ] [<Title>](items/<slug>.md)` (with optional ` — <priority>` suffix when helpful for scanning)
   - The final `related:` list as written into the file

The subagent does **not** edit `todo.md`. The parent does, after review.

### 4. Parent reviews and registers

The parent:

1. Reads the freshly written item file
2. Presents to the user: the item path, the title, the priority, the proposed todo line, and the `related:` list
3. On user confirmation (or implicit approval if the user moves on), appends the proposed checkbox line to `.context/backlog/todo.md`

If the user wants changes, the parent either edits the file directly (for small fixes) or re-dispatches the subagent (for substantive rewrites).

### 5. Parent reports

One short message: item path, todo registration confirmed, recommended next step (usually `/b-plan` when the item is ready to be worked, or nothing if it's parked).

## Output

```
Backlog item created: .context/backlog/items/<slug>.md
Registered in: .context/backlog/todo.md
Priority: <high|medium|low>
Related: <comma-separated list, or "none identified">
```

## Recommended Next Steps

- `/b-plan` — when the item is ready to be worked and needs a bounded plan
- `/b-brainstorm` — when the item is still vague and needs scoping before planning
- Nothing — when the item is intentionally parked for a future session
