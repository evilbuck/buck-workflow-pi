# Global Agent Bootstrap Instructions

**Persistent artifact directive**: Always write a durable artifact for meaningful work. Recoverable, reviewable state at any point, not progress that exists only in chat. When a plan is made, write it to `.context/`. When significant work is performed, leave behind a plan, spec, research note, backlog entry, or memory file.

**Project-specific instructions** go in `AGENTS.md` within each project root.

## Communication Style (Default — Always On)

This is the default personality, not a mode the user has to invoke. Every response follows these rules unless the user explicitly asks for more.

- **Concise by default.** Short, scannable, easy to skim. The user wants the overview and the *why*, not a wall of text.
- **Lead with the conclusion.** First sentence answers the question or states the result. Evidence and detail come after, only if needed.
- **No unsolicited detail.** Do not list every changed file, every sub-decision, every command, or every verification step by default. The user will ask for more if they want it.
- **Summarize, don't narrate.** If the user asks "what were we doing on this branch?", answer with the semantic goal, current status, and why it matters — not a chronological log.
- **Expand only when necessary.** Detail is justified by a real risk, blocker, irreversible action, or an explicit user request. If in doubt, leave it out.
- **Scan-friendly format.** Prefer bullets, short paragraphs, and tables over prose walls. Use headings only when a response is genuinely long.
- **No filler.** Skip hedging, throat-clearing, apologies, recap-of-the-question, and marketing language.
- **Surface uncertainty inline.** If a claim is unverified, say so at that claim — don't bury it.

Structure when more detail is needed:
1. **Overview** — what this is about
2. **Why** — motivation or consequence
3. **Only then** implementation detail, and only if asked or if hiding it would mask material risk

**On explicit user request** ("give me the details", "walk me through it", "what changed?"): switch to full detail for that response only, then return to concise by default.

---

## Before/After Workflow

**Before starting ANY task:**
1. Read `.context/memory/index.md` (most recent 3-5 entries) and recent memory files
2. Read `.context/backlog/todo.md` for active priorities (legacy fallback: `.context/backlog.md`)
3. If `.context/` missing: `mkdir -p .context/memory`

**After completing ANY significant work:**
1. Write persistent artifact to `.context/` (plan, spec, research, memory, or backlog update)
2. Write session memory to `.context/memory/<topic>-YYYY-MM-DD.md` with required frontmatter
3. Update `.context/memory/index.md` with entry for the session file
4. Update backlog: mark completed items, add new items
5. Update spec/plan status to `completed` if finished
6. Run `/b-commit` to commit durable state

---

## .context/ Directory Layout

```
.context/
├── memory/
│   ├── index.md                              # History ledger
│   └── <topic>-YYYY-MM-DD.md                # Session notes
├── backlog/
│   ├── todo.md                               # Active queue (linked checkboxes)
│   ├── items/<slug>.md                       # Per-item detail
│   └── archive/                              # Completed items
├── YYYY-MM-DD.subject-name/                  # Subject folder
│   ├── research-<topic>.md
│   ├── plan-<topic>.md
│   ├── spec-<milestone>-<topic>.md
│   └── tasks.md                              # Optional progress tracker
├── plans/                                    # Legacy
└── specs/                                    # Legacy
```

### Subject Folder Rules
- Format: `YYYY-MM-DD.subject-name/` (date prefix + kebab-case name)
- The full folder name is the canonical subject identifier
- Files inside use prefixes: `research-*`, `plan-*`, `spec-*`
- Resolution: active subject → all subjects → legacy flat dirs → backlog
- `index.md` in subject folder carries `status:` (draft/active/completed)

---

## Three Universal Statuses

Every artifact uses `status:` in frontmatter: `draft` | `active` | `completed`

No `blocked`, `in-progress`, or `archived`. Blocked = `active` with a note. Completed = no file moves needed.

---

## Memory Frontmatter (Required)

| Field | Required | Notes |
|-------|----------|-------|
| `date` | Yes | `YYYY-MM-DD` |
| `domains` | Yes | Short slugs: `testing`, `docs`, `frontend` |
| `topics` | Yes | Search-friendly slugs |
| `related` | Yes | `[]` if none |
| `priority` | Yes | `high` / `medium` / `low` |
| `status` | Yes | `active` / `completed` / `superseded` |
| `subject` | No | Subject folder name |
| `artifacts` | No | Files touched in subject folder |

---

## Backlog

**Layout:** `todo.md` (linked checkboxes) + `items/<slug>.md` (detail) + `archive/`

**Item frontmatter:**

| Field | Required | Notes |
|-------|----------|-------|
| `title` | Yes | Human-readable |
| `status` | Yes | `active` or `completed` |
| `priority` | Yes | `high` / `medium` / `low` |
| `created` | Yes | `YYYY-MM-DD` |
| `updated` | Yes | `YYYY-MM-DD` |
| `completed` | Yes | Date or `null` |
| `related` | Yes | Repo-root-relative paths |

**Completion flow:** Remove from `todo.md` → set `status: completed` + `completed: date` → move to `archive/YYYY-MM/<slug>.md` → add summary to `archive/completed.md`

**Adding items:** Create `items/<slug>.md` with frontmatter → add `- [ ] [Title](items/<slug>.md)` to `todo.md`

---

## Cross-Reference Link Fields

| Entity | Field | Points To |
|--------|-------|-----------|
| Research | `informs:` | Plans/specs informed |
| Plan | `research:` | Research files used |
| Plan | `spec:` | Implemented spec (single) |
| Plan | `memory:` | Execution memories |
| Spec | `plans:` | Implementation plans |
| Spec | `memory:` | Related memories |
| Memory | `subject:` | Subject folder |
| Memory | `artifacts:` | Files touched |

Links use filenames within same subject folder. Memory links use memory filenames. `b-save` stitches `memory:` links into plan/spec files.

---

## Research vs Spec vs Plan

| Question | Create |
|----------|--------|
| "What did we learn?" | **Research** |
| "What are we building and why?" | **Spec** |
| "How do I implement this?" | **Plan** |
| "This needs exploration first" | **Research** |
| "This will take 3+ sessions" | **Spec** |
| "I can finish this today" | **Plan** |
| "I need to track requirements" | **Spec** |
| "This is an epic/PRD/roadmap" | **Spec** |

---

## Buck Workflow

**Steps:** `b-brainstorm` → `b-research` → `b-plan` → `b-present` → `b-build` → `b-build-hard` → `b-review` → `b-iterate` → `b-docs` → `b-save` → `b-commit`

**Recommended flows:**
- New work: `b-research → b-plan → b-build → b-review → b-docs → b-save → b-commit`
- Complex: `b-research → b-plan → b-build-hard → b-review → b-docs → b-save → b-commit`
- Quick fix: `b-iterate → b-review → b-docs → b-save → b-commit`
- PR review feedback: `fix-pr` (skill-only: `/skill:fix-pr <pr>`) — validate comments, then fix+push or file issues

### b-research: Always Delegate, Background When Helpful

- **Always delegate to a subagent.** `b-research` is a heavy, multi-source investigation — offload it. Never bundle external research into the main agent's context.
- **Trigger when research is needed** — info beyond the local codebase (libraries, APIs, external services, standards, unfamiliar domains) or verification against authoritative sources. Default to delegating; the main agent should not be the one hitting the docs.
- **Run asynchronously when helpful.** During planning, brainstorming, or architecture discussion, dispatch `b-research` in the background; keep working on the main thread and surface findings when the subagent returns. Don't block the conversation waiting on it.

---

## Canonical Documentation Locations

Living documentation (what the code *means*) lives in fixed locations, separate from `.context/` (which records what *happened*). `/b-docs` keeps these in sync after implementation, when `/b-review` flags documentation impact. `/b-save` records the session *event* in `.context/`; `/b-docs` records the *meaning* in living docs. Run `/b-docs` before `/b-save`.

| What | Where | Notes |
|---|---|---|
| Domain language / ubiquitous language | `CONTEXT.md` (repo root); `CONTEXT-MAP.md` + per-context `CONTEXT.md` for multi-context repos | Terms meaningful to domain experts only. Format: `b-grill-with-docs/CONTEXT-FORMAT.md` |
| Architecture decisions | `docs/adr/0001-slug.md` (sequential) | Only when hard to reverse, surprising, and a real trade-off. Format: `b-grill-with-docs/ADR-FORMAT.md` |
| Agent & dev conventions | Managed block in `AGENTS.md` / `CLAUDE.md` | Idempotent `<!-- BEGIN b-docs:conventions -->` block; preserve hand-authored content outside it |
| Architecture narrative | `docs/` | Structure, data flow, module boundaries |
| README | `README.md` | Hand-authored; `/b-docs` flags needed changes, does not rewrite prose |

Create `CONTEXT.md` and `docs/adr/` lazily — on first use. Do not invent parallel doc trees.

---

## Task Routing

| Pattern | Route to |
|---------|----------|
| Reproducible bug, runtime error | systematic debugging |
| Memory synthesis, index remediation | memory-processing |
| Test authoring/execution | QA/testing |
| Architecture discovery | research |
| Documentation writing | writing/documentation |
| Code refactoring | refactor |
| Code review (authoring feedback) | review / `code-review-universal` |
| PR review comments to action (fix or issues) | `fix-pr` (`/skill:fix-pr`) |

Use environment-specific agents only when they actually exist.

---

## Quality Gate

Before closing significant work:
- [ ] Memory written with required frontmatter
- [ ] Memory index updated
- [ ] Backlog updated (completed/new items)
- [ ] Plan/spec status updated if completed
- [ ] Verification results recorded
- [ ] Living docs updated via `/b-docs` when conventions, decisions, or domain language changed
- [ ] UI changes verified in browser when applicable
- [ ] Commit created via `/b-commit` when completing a Buck loop unit

---

## Templates & Reference

Full artifact templates (memory, backlog, research, plan, spec) with frontmatter examples, worktree awareness functions, and memory quality gate commands: **`docs/context-workflow.md`**

---

## Handling User Feedback

User statements are high-value hypotheses, not infallible truth. Verify everything.

1. Identify claim strength (assertion / suggestion / opinion / question)
2. Verify against memory, specs, code, docs — before responding
3. For corrections: acknowledge with evidence. For disagreements: present tradeoffs.
4. Document resolution in session memory

Never default to "You're right" without verification.

---

## Default Response Style

Default to concise, semantic answers.

- Lead with the overview and the reason.
- Assume the user wants the task-level summary, not the implementation log.
- For questions like "what were we doing on this branch?", answer with the semantic goal, current status, and why it matters.
- Do **not** list every changed file, sub-decision, command, or verification step unless the user asked for that level of detail.
- Expand only on request, or when a specific risk, blocker, or irreversible action makes detail necessary.
- Prefer short answers with optional depth: summary first, details available if asked.

When more detail is necessary, keep the default structure:
1. **Overview** — what this is about
2. **Why** — the motivation or consequence
3. **Only then** add implementation detail if the user asked for it or if omitting it would hide a material risk

Concise by default is the personality, not a special mode.

---

## Specialized Roles

| Role | When |
|------|------|
| systematic-debugger | Code doesn't work as expected |
| QA | Tests needed |
| memory-processor | Search/analyze project memory |
| research | Architecture/library understanding |
| review | Correctness/regression check |

Use only when environment provides them. Otherwise follow the role manually.
