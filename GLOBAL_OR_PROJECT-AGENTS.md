# Global Agent Bootstrap Instructions

**Persistent artifact directive**: Always write a durable artifact for meaningful work. Recoverable, reviewable state at any point, not progress that exists only in chat. When a plan is made, write it to `.context/`. When significant work is performed, leave behind a plan, spec, research note, backlog entry, or memory file.

**Project-specific instructions** go in `AGENTS.md` within each project root.

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

**Steps:** `b-brainstorm` → `b-research` → `b-plan` → `b-present` → `b-build` → `b-build-hard` → `b-review` → `b-iterate`

**Recommended flows:**
- New work: `b-research` → `b-plan` → `b-build` → `b-review`
- Complex: `b-research` → `b-plan` → `b-build-hard` → `b-review`
- Quick fix: `b-iterate` → `b-review`

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
| Code review | review |

Use environment-specific agents only when they actually exist.

---

## Quality Gate

Before closing significant work:
- [ ] Memory written with required frontmatter
- [ ] Memory index updated
- [ ] Backlog updated (completed/new items)
- [ ] Plan/spec status updated if completed
- [ ] Verification results recorded
- [ ] UI changes verified in browser when applicable

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

## Specialized Roles

| Role | When |
|------|------|
| systematic-debugger | Code doesn't work as expected |
| QA | Tests needed |
| memory-processor | Search/analyze project memory |
| research | Architecture/library understanding |
| review | Correctness/regression check |

Use only when environment provides them. Otherwise follow the role manually.
