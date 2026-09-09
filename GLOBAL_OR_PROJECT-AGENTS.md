# Global Agent Bootstrap Instructions

**Persistent artifact directive**: Always write a durable artifact for meaningful work. Recoverable, reviewable state at any point, not progress that exists only in chat. When a plan is made, write it to `.context/`. When significant work is performed, leave behind a plan, spec, research note, backlog entry, or memory file.

**Project-specific instructions** go in `AGENTS.md` within each project root.

## Response Style (Default — Always On)

The default personality, not a mode the user has to invoke. Applies to every response unless the user asks for more.

- **Answer first.** Open with the outcome, decision, or direct answer.
- **Only applicable context.** Add the reason when it is not obvious; add risks, uncertainty, breaking changes, or a required next action when they are material. Nothing else.
- **Concise is not cryptic.** Never drop assumptions that affect correctness, security concerns, dependencies, or anything needed to act safely. The target is concise + sufficient, not shortest.
- **Report outcomes, not process.** No chronology of tool calls, files opened, or reasoning steps. Mention an intermediate step only when it changed the result, blocks completion, or needs a decision.
- **No filler.** No hedging, throat-clearing, apologies, restating the question, or marketing language.
- **Surface uncertainty at the claim**, not buried at the end.
- **Length follows content.** Most routine answers are 1–5 sentences or a compact list. There is no minimum — never pad to fill a structure.
- **No fixed template.** Headings, tables, and labelled fields (`What changed` / `Why` / `Important`) are optional tools for a genuinely longer answer, never a required shape.
- **Expand when the work warrants it** — architecture, subtle bugs, consequential trade-offs, or an explicit request for depth ("walk me through it", "what changed?"). Conclusion still first; return to concise on the next turn.
- **Stop when the answer is complete.** Delete any sentence that repeats a point, explains something obvious from the answer, or narrates process.

Instead of "The reason this happens is that JavaScript's event loop adds promises to the microtask queue, which means…", write: "`Promise.then()` runs as a microtask, so it executes after the current synchronous code but before `setTimeout()`."

---

## Before/After Workflow

**Before starting ANY task:**
1. Search prior work:
   - **If OMP** (when `recall` / `reflect` tools exist): use `recall` (or `reflect` for synthesis) for decisions, conventions, and past outcomes. Treat results as background; verify against the repo.
   - **Else** (non-OMP agents): use the configured memory skill. The skill path is specified in the project's `AGENTS.md` under "Memory Search Tool" (see configuration below). Load that skill and follow its search protocol.
   - **Fallback** (if no memory skill is configured or available): read `.context/memory/index.md` (most recent 3–5 entries) and open relevant memory files.
2. Read `.context/backlog/todo.md` for active priorities (legacy fallback: `.context/backlog.md`)
3. If `.context/` missing: `mkdir -p .context/memory`

**After completing ANY significant work:**
1. Write persistent artifact to `.context/` (plan, spec, research, memory, or backlog update)
2. Write session memory to `.context/memory/<topic>-YYYY-MM-DD.md` with required frontmatter
3. Update `.context/memory/index.md` with entry for the session file
4. Update backlog: mark completed items, add new items
5. Update spec/plan status to `completed` if finished
6. Prefer `/b-save` (writes the above and, on OMP, `retain`s session facts when tools exist)
7. Run `/b-commit` to commit durable state


### Memory Search Tool Configuration (non-OMP agents)

Projects using non-OMP agents (Claude Code, Codex, Pi, etc.) should specify their memory search skill in the project's `AGENTS.md`:

```markdown
## Memory Search Tool

For non-OMP agents, use: `~/.agents/skills/qmd/SKILL.md`
```

Or for agent-specific tooling:

```markdown
## Memory Search Tool

For non-OMP agents, use: `.claude/skills/memory-search/SKILL.md`
```

If no memory search tool is configured, agents fall back to reading `.context/memory/index.md`.

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

`/b-init-guardrails` (once per repo) creates the contract; `/b-guardrails-check` runs it. The completion gate above depends on both.

### b-research

- **Always delegate to a subagent.** `b-research` is a heavy, multi-source investigation — offload it. Never bundle external research into the main agent's context.
- **Trigger when research is needed** — info beyond the local codebase (libraries, APIs, external services, standards, unfamiliar domains) or verification against authoritative sources. Default to delegating; the main agent should not be the one hitting the docs.
- **Run asynchronously when helpful.** During planning, brainstorming, or architecture discussion, dispatch `b-research` in the background; keep working on the main thread and surface findings when the subagent returns. Don't block the conversation waiting on it.

---

## Canonical Documentation Locations

Living documentation (what the code *means*) lives in fixed locations, separate from `.context/` (which records what *happened*). `/b-docs` keeps these in sync after implementation, when `/b-review` flags documentation impact. `/b-howto` writes task-oriented how-tos when `/b-review` flags how-to impact. `/b-save` records the session *event* in `.context/`; `/b-docs` records the *meaning*; `/b-howto` records the *sequence*. Run `/b-docs` and `/b-howto` before `/b-save`. If both are needed, run `/b-docs` first — it will follow `b-howto`. Either may load the other once in-session; they do not write each other's files.

| What | Where | Notes |
|---|---|---|
| Domain language / ubiquitous language | `CONTEXT.md` (repo root); `CONTEXT-MAP.md` + per-context `CONTEXT.md` for multi-context repos | Terms meaningful to domain experts only. Format: `b-grill-with-docs/CONTEXT-FORMAT.md` |
| Architecture decisions | `docs/adr/0001-slug.md` (sequential) | Only when hard to reverse, surprising, and a real trade-off. Format: `b-grill-with-docs/ADR-FORMAT.md` |
| Agent & dev conventions | Managed block in `AGENTS.md` / `CLAUDE.md` | Idempotent `<!-- BEGIN b-docs:conventions -->` block; preserve hand-authored content outside it |
| Architecture narrative | `docs/` | Structure, data flow, module boundaries |
| README | `README.md` | Hand-authored; `/b-docs` flags needed changes, does not rewrite prose |
| How-to guides | `docs/howto/` | Diátaxis how-tos (one action per file). Owned by `/b-howto`, not `/b-docs`. |

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
- [ ] Verification results recorded
- [ ] Deterministic check contract resolved and passing — required when the session touched code (see § Deterministic Check Contract)
- [ ] Living docs updated via `/b-docs` when conventions, decisions, or domain language changed
- [ ] UI changes verified in browser when applicable

## Deterministic Check Contract

Before claiming any task complete, if the session touched code, the project's check contract MUST be resolved, run, and passing.

**Code-touching predicate.** Collect the session's changed paths: `git status --porcelain` plus, when an upstream exists, `git diff --name-only @{u}..HEAD`. The session is **docs-only** iff every changed path either ends in `.md`, `.mdx`, or `.txt`, or is `LICENSE`, or starts with `.context/`, `docs/`, or `presentations/`. Any other path — source, `package.json`, a lockfile, CI YAML — makes the session code-touching. Docs-only → skip the gate and say so in one line.

**Resolution order** (first hit wins; never writes a file):
1. `guardrails.json` at repo root → authoritative. Run `/b-guardrails-check`.
2. Managed `<!-- BEGIN b-init-guardrails -->` block present but `guardrails.json` missing → warn that the contract is broken, then continue to 3.
3. `b-init-guardrails`' `scripts/detect-stack.ts` → ephemeral contract; run lint and test gates only (no coverage/complexity without a baseline). Warn that no durable contract exists.
4. No ecosystem detected → surface any `README.md` testing/development command block as **unverified suggestions**. Do not execute them.
5. Nothing found → warn: no deterministic check contract exists. Offer `/b-init-guardrails`.

**Enforcement.** A `fail` verdict blocks completion. Fix it, or get an explicit user override — and record the override, the failing gate, and the reason in session memory. Never soften a gate, widen a lint ignore, delete a test, or record `null` to silence a suite. A `skipped` or `advisory` gate is reported, not fixed. Cases 2–5 always produce a visible warning plus the `/b-init-guardrails` offer; they never silently pass.

Full chain: `skills/b-guardrails-check/docs/contract-resolution.md`.

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
