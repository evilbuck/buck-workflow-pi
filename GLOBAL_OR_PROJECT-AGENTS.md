# Global Agent Bootstrap Instructions

**Purpose**: This file provides global agent workflow guidance and may be consumed by multiple agentic tools and environments. Treat it as environment-agnostic by default, with Pi-compatible behavior as the baseline.

**Scope**: Defines universal workflows for:
- Creating/reading `.context/` directories in projects
- Session memory management
- Tool usage patterns
- General development practices

**Environment note**: These workflows must work without any MCP servers configured. Treat MCP integrations as optional enhancements only. Every MCP-specific instruction must have a local, non-MCP fallback.

**Persistent artifact directive**: Always write a durable artifact for meaningful work. We want recoverable, reviewable state at any point, not progress that exists only in chat context. When a plan is made, write it to disk in `.context/` according to the current subject-folder rules. When a task or todo is completed, update the todo/backlog state on disk. When significant work is performed, leave behind a persistent artifact such as a plan, spec, research note, backlog entry, or memory file.

**Project-specific instructions** should be placed in `AGENTS.md` within each project root.

---

## ⚠️ CRITICAL WORKFLOW - READ FIRST

**Before starting ANY task, execute these steps:**

   ```bash

1. ✅ **Check memory index, then read recent memory files (3-5 most recent)**
   ```bash
   cat .context/memory/index.md 2>/dev/null | sed -n '1,120p' || echo "No memory index found"
   ls -lt .context/memory/ 2>/dev/null | head -6 || echo "No memory files found"
   ```

   **QMD integration** — memory is scoped to the current project/worktree:
   - **CLI (canonical for indexing)**: `COLLECTION=$(get_qmd_collection) && qmd index .context/memory --collection "$COLLECTION" || true`
   - **Preferred default for retrieval**: Read `index.md` and recent files directly
   - **Optional enhancement**: Use QMD with the scoped collection for semantic lookup

3. ✅ **Acknowledge context** to the user:
   "I've reviewed the backlog and recent memory (QMD: CLI available | manual fallback | not available). Current priorities: [X, Y, Z]"

**After completing ANY significant work:**

4. ✅ **Write a persistent artifact** to `.context/`
   - Prefer durable on-disk state over conversational-only state
   - If you created a plan, write a `plan-*.md` file in the appropriate subject folder
   - If you performed execution work, write or update session memory, backlog state, spec state, or related artifacts as appropriate

5. ✅ **Write session memory when execution or decisions warrant it** to `.context/memory/<topic>-YYYY-MM-DD.md`
   - Document decisions, gotchas, changed files, next steps
   - Include reference to active spec for the session
   - Include required frontmatter metadata (date/domains/topics/related/priority/status)

6. ✅ **Update memory index** (`.context/memory/index.md`) when memory is written
   - Add/update a single entry for the session file with date, topics, domains, status
   - Keep newest entries first for fast scanning
   - Re-index with CLI using project/worktree-scoped collection: `COLLECTION=$(get_qmd_collection) && qmd index .context/memory --collection "$COLLECTION" || true`
   - Use any configured search/query integration after indexing if available

7. ✅ **Update backlog status**:
   - Read `.context/backlog/todo.md` for active queue (legacy fallback: `.context/backlog.md`)
   - Mark completed items: remove from `todo.md`, update item file `status: completed`, move to archive
   - Add new items: create backing item file in `.context/backlog/items/<slug>.md`, add linked checkbox to `todo.md`
   - If a task or todo was completed, archive it following the completion flow

8. ✅ **Update completed specs/plans**:
   - If a spec is complete, set `status: completed` in its frontmatter (no file moves needed)
   - If a plan was created or materially revised, ensure the current version is written to disk

**If `.context/` doesn't exist:** Create it immediately with `mkdir -p .context/memory`

---

## Agent Bootstrap Workflow

When starting work on a project, **automatically execute these steps**:

### 1. Check for Context Directory

```bash
# Check if .context exists
ls -la .context/
```

**Worktree note:** If working in a git worktree, each worktree has its own `.context/` directory. Initialize fresh context for new worktrees.

### 2. Create Context Structure (If Missing)

```bash
# Create directories
mkdir -p .context/memory

# Create root AGENTS.md for project-specific instructions
# Use the standard project-context template available in your environment, or create an equivalent file manually
# Create .context/backlog/ directory for project todos
# mkdir -p .context/backlog/items
```

### 3. Read Existing Project Context

**Core files** (always read):
1. **`AGENTS.md`** - Project-specific agent instructions (root directory, single source of truth)
2. Use local memory artifacts first (`.context/memory/index.md` and recent memory files); use QMD CLI with the project/worktree-scoped collection for search integration
3. **`.context/backlog/`** - Active queue (`todo.md`) and per-item detail files (`items/<slug>.md`). Legacy fallback: `.context/backlog.md`
4. **`README.md`** - Project overview and documentation
5. **`.context/SKILLS.md`** - Available project skills (if exists)

**Specialized context files** (read based on task):

Each `.context/*.md` file (except SKILLS.md) should include frontmatter to describe when it applies:
- Note: `.context/AGENTS.md` is deprecated - use root `AGENTS.md` instead

```yaml
---
name: Design Standards
domain: design
description: Visual design principles, Tailwind CSS usage
---
```

**Frontmatter Standard:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable title |
| `domain` | Yes | Task domain(s) this context applies to (e.g., design, testing, debugging, refactor) |
| `description` | No | Brief description of what's in this context |

**Domain values** should match task types. Common domains:
- `design` - visual design, styling, UI components
- `testing` - test patterns, test setup
- `debugging` - debugging workflows, logging patterns
- `refactor` - refactoring guidelines
- `docs` - documentation standards
- `security` - security patterns

**How to use:**

1. Parse frontmatter from all `.context/*.md` files in the project
2. Check the `domain` field against the current task
3. Include relevant contexts based on domain match
4. Always include core files (root AGENTS.md, SKILLS.md, memory index, recent memory, backlog)

```python
# Example logic
current_task = "update_button_styling"  # inferred from user request
relevant_domains = ["design", "ui", "frontend"]

for file in context_files:
    # Root AGENTS.md is always included
    if file.path == "AGENTS.md":
        include(file)
    # .context/SKILLS.md for project-specific skills
    elif file.name == "SKILLS.md":
        include(file)
    # Other .context/ files based on domain matching
    elif any(domain in file.domain for domain in relevant_domains):
        include(file)
```

### 4. Acknowledge Context

Before starting work, briefly summarize what you learned:
```
"I've reviewed:
- Project context: [key details from AGENTS.md]
- Memory index: [relevant topics and linked sessions]
- Recent work: [highlights from memory/]
- Current priorities: [items from .context/backlog/todo.md]

Ready to proceed with: [user's request]"
```

---

## Project Context Directory Structure

Each project should maintain this structure:

```
AGENTS.md           # Project-specific agent instructions (single source of truth)
.context/
├── backlog/                                # Active queue + per-item detail
│   ├── todo.md                            # Active items (linked checkboxes only)
│   └── items/<slug>.md                    # Per-item detail with frontmatter
├── memory/                                 # Session memory (chronological)
│   ├── index.md                            # History ledger
│   └── <topic>-YYYY-MM-DD.md              # Session notes with subject: links
│
├── YYYY-MM-DD.subject-name/                # ← Subject folder (date-prefixed)
│   ├── research-<topic>.md                # Research findings
│   ├── plan-<topic>.md                    # Implementation plan
│   └── spec-<milestone>-<topic>.md        # Strategic spec
│
├── plans/                                  # Legacy flat plans (backward compat)
├── specs/                                  # Legacy flat specs (backward compat)
│   ├── active/
│   └── archive/
│
└── *.md                                    # Optional architecture/docs
```

### Subject Folders (New Convention)

**Format:** `YYYY-MM-DD.subject-name/`

Subject folders group related artifacts (research, plans, specs) by topic:

```
.context/
├── 2026-03-15.auth-feature/
│   ├── research-oauth-providers.md
│   ├── plan-oauth-login.md
│   └── spec-v1-auth-mvp.md
│
├── 2026-04-01.payment-integration/
│   ├── research-stripe-api.md
│   └── plan-checkout-flow.md
```

**Rules:**
- Date prefix is creation date (keeps folders chronologically sortable)
- Subject name is kebab-case
- Full folder name (`YYYY-MM-DD.subject-name`) is the canonical subject identifier
- Files inside use prefixes: `research-*`, `plan-*`, `spec-*`

**Resolution Order:** Agents search for artifacts in this order:
1. Active subject folder (from session context): `.context/YYYY-MM-DD.[:subject]/`
2. All subject folders: `.context/*/{plan,spec,research}-*.md`
3. Flat directories (legacy): `.context/plans/`, `.context/specs/active/`
4. Backlog: `.context/backlog/todo.md` (legacy fallback: `.context/backlog.md`)

This ensures **zero breaking changes** for existing projects using flat directories.
### Subject-Level State
A subject folder's `index.md` carries an explicit `status:` field:
- `draft` — brainstorm/research in progress, no plan yet
- `active` — plan/spec exists, work underway or available
- `completed` — all objectives met
Skills that create or modify artifacts must update `index.md` status accordingly.
If `index.md` is absent or has no `status:`, derive from artifact frontmatter as before.

### Subject-Local Progress Tracker (`tasks.md`)

When a task list contains **more than 2 items**, create an optional `tasks.md` in the active subject folder to track progress. This provides a persistent, scannable view of all tasks within a subject without requiring agents to parse multiple artifacts.

> **Naming note**: Subject-local progress trackers use `tasks.md` (not `todo.md`) to avoid confusion with the global backlog queue `.context/backlog/todo.md`.

**When to create:**
- Task list in a plan, spec, or backlog item has 3+ items
- Work spans multiple sessions or agents
- Need to track progress across interruptions

**Tasks.md format:**
```markdown
# Tasks: [Subject Name]

**Created**: YYYY-MM-DD
**Status**: in-progress | completed

## Tasks

- [ ] Task 1 - [brief description]
- [ ] Task 2 - [brief description]
- [x] Task 3 - [completed]

## Notes
[Any additional context or blockers]
```

**Workflow:**
1. Create `tasks.md` in `.context/YYYY-MM-DD.subject/` when task count exceeds 2
2. Update checkboxes as work progresses: `- [ ]` → `- [x]`
3. Update `**Status**` field when all tasks complete: `in-progress` → `completed`
4. Reference the tasks file from the parent plan/spec: `See: .context/YYYY-MM-DD.subject/tasks.md`

## Configuration Paths

Configuration paths are environment-specific. In Pi, prefer the live Pi filesystem and currently exposed tool definitions over assumptions copied from other agent platforms.

Notes:
- Do not assume OpenCode paths such as `~/.config/opencode/...` exist in Pi
- Prefer the paths and tool surfaces visible in the current environment
- If this file is shared across multiple environments, keep path guidance conditional and explicit

## Skill Scope Policy (Domain Partitioning)

Default behavior for coding sessions:

- Prioritize coding/workflow skills or reusable workflow artifacts available in the current environment
- Treat broad non-coding shared skill packs (for example SEO skill suites) as opt-in
- Load/use non-coding skills only when user intent is explicitly in that domain
- If both coding and non-coding skill sets are available, do not let non-coding guidance override coding workflow defaults

## Task Routing Matrix

Route work to the best available workflow or specialist capability in the current environment:

| Task Pattern | Preferred Capability |
|--------------|----------------------|
| Reproducible bug, runtime error, failing behavior | systematic debugging workflow |
| Memory synthesis, timeline extraction, schema/index remediation | memory-processing workflow |
| Test authoring and execution | QA/testing workflow |
| Architecture discovery, data flow mapping | research workflow |
| Documentation/library research | documentation research workflow |
| Documentation writing | writing/documentation workflow |
| Code refactoring | refactor workflow |
| Code review | review workflow |

If routing is ambiguous, state the selected workflow and why in one sentence before proceeding. Use environment-specific commands or agents only when they actually exist.

## Buck Workflow Surface

The Buck workflow is a conceptual workflow family organized around shared `b-` names.

- Treat `b-*` names as workflow labels first, not guaranteed literal commands
- If your environment exposes Buck commands or agents, use them
- If it does not, follow the same workflow intent manually using `.context/` artifacts and the available tools

### Buck Workflow Steps

- `b-brainstorm` - optional intake step: interview-style to create a loose first-draft plan
- `b-research` - read-mostly investigation with writes limited to `.context/` and temp scratch paths
- `b-plan` - read-mostly planning with writes limited to `.context/` and temp scratch paths
- `b-build` - standard implementation
- `b-build-hard` - complex or higher-risk implementation
- `b-present` - generate presentation from a plan artifact
- `b-review` - correctness and regression review
- `b-iterate` - quick follow-up fixes

### Recommended Flows

- New work (with brainstorm): `b-brainstorm` -> `b-plan` -> `b-present` -> `b-build` -> `b-review`
- New work: `b-research` -> `b-plan` -> `b-present` -> `b-build` -> `b-review`
- Complex work: `b-research` -> `b-plan` -> `b-present` -> `b-build-hard` -> `b-review`
- Quick fix loop: `b-iterate` -> `b-review`
- Review loop: `b-review` -> `b-iterate` -> `b-review`

### Creating the Context Directory

**For bash/terminal:**
```bash
mkdir -p .context/memory
```

**For agents with inline commands:**
```
!mkdir -p .context/memory
```

### Where Work History Goes

After any significant work, record what was done in persistent artifacts. If `/b-save` exists in your environment, use it; otherwise perform the equivalent manual updates in `.context/`. The canonical artifact map:

| Artifact | Purpose | Answer to |
|----------|---------|-----------|
| `.context/memory/index.md` | **Canonical history ledger** | "What was worked on?" |
| `.context/memory/*.md` | Detailed session notes | "What decisions were made?" |
| `.context/backlog/` | Active queue + per-item detail | "What needs doing?" |
| `.context/YYYY-MM-DD.subject/` | **Subject folder** — groups related work | "Everything about [topic]" |
| `research-*.md` | Research findings | "What did we learn?" |
| `plan-*.md` | Tactical intent (how) | "How will it be done?" |
| `spec-*.md` | Strategic intent (what/why) | "Why is this being built?" |

**Q:** "Where does completed work history go?"  
**A:** `.context/memory/index.md` (ledger) + `.context/memory/<session>.md` (details) + linked subject folder

**Subject Folder Creation:**
- `b-research`, `b-plan`, `b-brainstorm` style planning/research work → create immediately with named subject
- `b-build`, `b-build-hard` style implementation work → create or update the subject folder by session end if none exists
- `/b-save` or equivalent manual checkpoint → create subject folder, consolidate artifacts, and stitch cross-references

### Initial Setup Template

When creating root `AGENTS.md` for a new project, use the standard project-context template available in the current environment, or create an equivalent file covering project overview, setup, conventions, important files, dependencies, and gotchas.

```markdown
# Project Context

## Project Overview
- **Name**: [Project name]
- **Purpose**: [What this project does]
- **Tech stack**: [Languages, frameworks, key dependencies]

## Development Setup
- **Build**: `[build command]`
- **Test**: `[test command]`
- **Lint**: `[lint command]`
- **Dev server**: `[dev command]`

## Project-Specific Conventions
- **Code style**: [PEP 8, Airbnb JS, etc.]
- **Naming patterns**: [File naming, variable naming]
- **Architecture**: [MVC, microservices, monolith, etc.]

## Important Files/Directories
- `[path]`: [purpose]

## External Dependencies
- **APIs**: [External services, endpoints]
- **Required credentials**: [What needs to be configured]

## Known Gotchas
- [Thing to watch out for]
```

---

## Tools Available

### HTML/Web Parsing Tools

**Quick reference** (see environment-local docs if available):

- **`html2text`**: Convert HTML → readable markdown (best for article text)
- **`pup`**: CSS selectors for DOM exploration (outputs text or JSON)
- **`htmlq`**: Precise CSS selector extraction (text/attributes)

**Example:**
```bash
# Extract links from a page
curl -fsSL https://example.com | htmlq -a href 'a'

# Get article text
curl -fsSL https://example.com | pup 'article text{}'
```

### Web Search (On-Demand)

Use **`ddgr`** when you need to search the web for documentation, libraries, or information not in the project.

**When to use:**
- Looking up library/framework APIs
- Finding documentation for a tool or service
- Researching solutions to unfamiliar problems
- Verifying standards or best practices

**When NOT to use:**
- For project-local research (use memory, specs, code exploration)
- When the answer is in local docs or codebase

**Usage:**
```bash
# Interactive (shows results, opens in browser on selection)
ddgr "search query"

# Non-interactive, 5 results, no browser
ddgr "query" -n 5 --np

# Specific site
ddgr "site:github.com rust async"

# Show only URLs
ddgr "query" -n 3 -w
```

---

### Frontend Web UI Development

**For frontend web UI projects**, use these tools:

- **`playwright-cli`**: Browser automation and E2E testing (preferred for web UI work)
- **`chrome-devtools_*`**: Optional browser-inspection tools when configured

**When to use each:**
- **Playwright**: Automated testing, page interactions, screenshots, form filling
- **Chrome DevTools-style tooling**: Live debugging, inspecting running pages, network analysis, performance tracing when configured

**Example Playwright usage:**
```bash
# Install browsers
npx playwright install

# Run tests
npx playwright test

# Generate code
npx playwright codegen https://example.com
```

### Optional Tool Integrations

**Context7 (when configured)**:

Use Context7 or similar library-doc tooling when it is actually available, especially when:
- Looking up library or framework APIs (e.g. "how do I paginate with Prisma?")
- Generating code that uses a specific library (e.g. React hooks, Express middleware)
- Checking setup, configuration, or installation steps for any package
- Verifying method signatures, options, or return types
- Answering "how do I do X with library Y?" questions

**Workflow when available:**
1. Resolve the library identifier
2. Query the docs with a specific question
3. Use the returned docs/snippets to inform code generation or answers

**Fallback when unavailable:**
- Read local project docs and examples
- Use library docs already present in the repository
- Use available CLI or web research tools if configured

**Chrome DevTools / browser automation tools (when configured)**:

Tools for browser automation, debugging, and inspection:
- `chrome-devtools_navigate_page` - Navigate to URLs, reload, go back/forward
- `chrome-devtools_take_snapshot` - Get accessible tree snapshot of page
- `chrome-devtools_take_screenshot` - Capture page or element screenshots
- `chrome-devtools_click`, `chrome-devtools_fill`, `chrome-devtools_type_text` - Interact with elements
- `chrome-devtools_evaluate_script` - Run JavaScript in page context
- `chrome-devtools_list_network_requests` - Monitor network activity
- `chrome-devtools_list_console_messages` - View console output
- `chrome-devtools_performance_start_trace` / `stop_trace` - Performance profiling

**Use browser automation/debug tooling when available to:**
- Debug UI issues visually
- Verify changes work as expected
- Inspect network requests and console errors
- Test user interactions
- Capture screenshots for documentation

**Fallback when unavailable:**
- Use available local test tooling (for example Playwright CLI if installed)
- Rely on code-level verification and explicit manual verification steps
- Do not describe browser-tool verification as completed unless it was actually performed

## Bash Tool Schema Compliance

Every Bash tool call must include a complete, valid payload for the actual environment. Schema validation failures waste turns and break workflows.

**Required fields on every Bash call in Pi:**
- `command` — the shell command to execute

**Conditional fields:**
- `timeout` — include for long-running commands (builds, installs, test suites)

**Environment rule:**
- Do not assume extra bash fields such as `description` or `workdir` unless the current tool definition explicitly supports them
- If the tool schema differs between environments, follow the live tool schema rather than stale prompt text

**Example correct call in this Pi harness:**
```json
{
  "command": "git log -10 --oneline"
}
```

**On schema rejection:** Retry immediately using the currently exposed tool schema. Do not skip the command or substitute a different tool without reason.

**Canonical reference:** The live tool definition wins if this document and the environment disagree.

---

## Mandatory Web UI Verification Workflow

**Applies to:** Any changes to UI-related files (HTML, JavaScript, TypeScript, CSS, SASS, SCSS, or server-side templates)

**When modifying UI code, you MUST:**

1. **Start/verify dev server** - Ensure the application is running and accessible
2. **Navigate to affected page** - Use available browser or automation tooling to load the relevant view
3. **Verify visual changes** - Use available snapshot/screenshot tooling to confirm changes render correctly
4. **Test interactions** - For interactive elements, use available click/fill tools to verify functionality
5. **Check for errors** - Use available console/error inspection tooling to catch JavaScript errors
6. **Iterate until verified** - Fix issues and re-verify until working correctly
7. **Fallback when browser tooling is unavailable** - document the missing tooling, perform the best available local verification, and do not claim browser verification was completed
8. **Document verification** - Note in session memory: pages tested, issues found, screenshots captured if any

### Tool Building Principles

When you need to extract or process data repeatedly, **build a tool** instead of parsing in context:

- **Research first**: Find the best CLI tools (htmlq, pup, jq, ripgrep, etc.)
- **Build MVP scrapers**: Create focused scripts → `scripts/scrape-<source>.sh`
- **Don't parse in context**: Use model for strategy, tools for execution

**When to build an agent** (instead of a script):
- Complex decision-making during scraping
- Multi-step workflows with state management
- Dynamic/JavaScript-heavy sites requiring browser automation

Store reusable agents in `agent/` directory.

---

## Memory Management

Memory is **discrete per project and worktree**. Each git worktree operates as an independent context with its own `.context/` directory. QMD collections are scoped to the current project/worktree, not global.

### Worktree Awareness

Git worktrees share a git repository but have separate working directories. Each worktree must have its own `.context/` directory to maintain discrete memory:

```bash
# Detect if in a worktree (parses .git for worktree info)
is_worktree() {
  if [ -f .git ]; then
    grep -q "worktree" .git 2>/dev/null && return 0
  elif [ -d .git ]; then
    git rev-parse --is-inside-work-tree 2>/dev/null | grep -q true && return 0
  fi
  return 1
}

# Get the QMD collection name for this project/worktree
get_qmd_collection() {
  local worktree_suffix=""
  if is_worktree; then
    # Use worktree path suffix to make collection unique per worktree
    worktree_suffix="-$(pwd | md5sum | cut -c1-8)"
  fi
  local repo_name=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
  echo "memory-${repo_name}${worktree_suffix}"
}
```

**Key principle**: Never share `.context/` between worktrees. When working in a new worktree, initialize its own `.context/` structure.

---

Keep track of conversations to maintain context across sessions.

### Memory Format

**Each session gets its own file** in `.context/memory/` with a unique, descriptive name:

```
.context/memory/
├── form-fix-chat-2026-02-12.md
├── oauth-debugging-2026-02-13.md
└── ...
```

**Naming convention**: `<topic>-<YYYY-MM-DD>.md`
- Use the session's main topic or task as the prefix
- Include the date at the end
- Keep it lowercase with hyphens
- Example: `session-2026-02-12-initial.md` → `neovim-config-2026-02-12.md`

### Memory Index (Required)

Use `.context/memory/index.md` as a lightweight searchable manifest of session files.

**Index format (one bullet per session):**

```markdown
# Memory Index

- 2026-02-18 | `wooderson-ssh-scrollback-and-branch-merge-2026-02-18.md` | domains: [debugging, infra] | topics: [ssh, tmux, chezmoi] | status: active
- 2026-02-16 | `codex-context-bootstrap-2026-02-16.md` | domains: [docs, tooling] | topics: [codex, context-bootstrap] | status: active
```

**Index rules:**
- Keep newest entries first
- Keep one entry per memory file (update, do not duplicate)
- Use topics/domains from required memory frontmatter
- Keep lines single-line and grep-friendly

### When to Write

After significant work, write a memory file if:
- You made key architectural decisions
- There are non-obvious implementation details or gotchas
- External dependencies or APIs changed
- You tried approaches that failed (to avoid repeating)
- Project-specific conventions were established
- User gave specific preferences or requirements
- Breaking changes or migrations were discussed

### Memory File Format

```markdown
# Session: <date> - <topic>

## Context
- Previous work: ...
- Goal: ...

## Decisions Made
- Chose X over Y because...

## Implementation Notes
- Key files modified: ...
- Important gotchas: ...

## Next Steps
- [ ] Todo items for next session
```

### Memory File Frontmatter (Required)

All memory session files must include YAML frontmatter. Memory files are not valid for indexing unless the required frontmatter keys are present.

**Frontmatter format:**

```yaml
---
date: 2026-02-14
domains: [testing, refactor, api]
topics: [oauth-integration, session-management]
related: [oauth-debugging-2026-02-13.md]
priority: high
status: active
---
```

**Frontmatter fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `date` | Yes | Session date (YYYY-MM-DD format) |
| `domains` | Yes | Task domains: testing, refactor, debugging, design, docs, security, etc. |
| `topics` | Yes | Keywords for searchability |
| `subject` | No | Subject folder name (`YYYY-MM-DD.subject-name`) this session relates to |
| `artifacts` | No | Files in subject folder touched this session (e.g., `[plan-oauth.md]`) |
| `related` | Yes | Related memory file names (use `[]` when none) |
| `priority` | Yes | high \| medium \| low - Importance level |
| `status` | Yes | active \| completed \| superseded - Current relevance |

**Benefits of frontmatter:**
- Faster searching by topic or domain
- Track relationships between sessions
- Filter by priority or status
- Better chronological organization
- Enhanced context retrieval via `@memory-processor`

**Important notes:**
- Required keys must always exist. Use `related: []` when no related sessions exist.
- Use defaults when uncertain: `priority: medium`, `status: active`.
- Keep frontmatter values concise and index-friendly (arrays of short slugs/keywords).

**Example with frontmatter:**

```markdown
---
date: 2026-02-14
domains: [refactor, testing]
topics: [api-service-layer, dependency-injection]
subject: 2026-02-14.api-service-layer
artifacts: [plan-extraction.md]
related: [api-design-2026-02-10.md, testing-strategy-2026-02-12.md]
priority: high
status: active
---

# Session: 2026-02-14 - API Service Layer Refactor

## Context
- Previous work: Initial API design from 2026-02-10
- Goal: Extract service layer for better testability

## Decisions Made
- Chose dependency injection pattern for service layer
- Selected class-based services over functional approach for better TypeScript support

## Implementation Notes
- Key files modified: `src/api/`, `src/services/`, `src/types/`
- Important gotchas: Circular dependency between UserService and AuthService - broke via interface

## Next Steps
- [ ] Add unit tests for UserService
- [ ] Document service layer patterns in ARCHITECTURE.md
```

### Using Memory

**Before starting work:**
1. Check if `.context/memory/` exists: `ls .context/memory/`
2. Read `.context/memory/index.md` first to identify relevant sessions quickly
3. Read recent session files to understand context
4. Use this information to inform planning and decisions

**Project/Worktree boundaries:**
- Memory files in the current `.context/` are for THIS project/worktree only
- Cross-project context comes from the project-specific `AGENTS.md`, not shared memory
- When switching worktrees, read that worktree's `.context/memory/index.md` fresh

**Processing and analyzing memories:**
5. Use the best available memory-processing workflow:
   - Target the current project/worktree collection: `qmd search memory --collection "$(get_qmd_collection)"`
   - Summarize recent sessions, search topics, extract patterns
   - Generate or refresh memory indices and timelines

**After writing a new memory file:**
6. Add/update a matching line in `.context/memory/index.md`
7. Validate that all required frontmatter keys exist before considering the memory complete

### Memory Quality Gate (Required Before Task Close)

Before final task completion, run this validation sequence for the current project/worktree:

1. Ensure index exists and QMD collection ready:
   ```bash
   test -f .context/memory/index.md || printf "# Memory Index\n\n" > .context/memory/index.md
   # Index with project/worktree-scoped collection
   COLLECTION=$(get_qmd_collection)
   command -v qmd >/dev/null 2>&1 && qmd index .context/memory --collection "$COLLECTION" || true
   ```
2. Validate frontmatter:
   - **Search integration**: Run query against the scoped collection and compare results against file count
   - **Manual fallback**: `grep -L "^---$" .context/memory/*.md | grep -v index.md | wc -l` (should be 0)
3. Remediation: `@memory-processor backfill frontmatter` or use `memory_frontmatter_backfill` skill
4. Refresh index:
   ```bash
   COLLECTION=$(get_qmd_collection)
   command -v qmd >/dev/null 2>&1 && qmd index .context/memory --collection "$COLLECTION" || true
   ```

**Example invocations (project-scoped):**
```
@memory-processor summarize the last 5 sessions about API changes
@memory-processor find all sessions that mention authentication
@memory-processor extract all architectural decisions
@memory-processor refresh .context/memory/index.md from memory frontmatter
```

**QMD collection scoping:** Each project/worktree gets a unique QMD collection name based on repo name + worktree identifier. This prevents cross-contamination when querying.

---

## Cross-Referencing Between Artifacts

Every artifact (research, plan, spec, memory) carries forward and backward links in its frontmatter. This enables cold-start discovery: an agent with no conversation history can navigate from any artifact to all related work.

### Link Map

```
                    ┌─────────────┐
                    │   Memory    │
                    │ (session)   │
                    └──────┬──────┘
                           │ subject: → folder
                           │ artifacts: → [plan, spec, research]
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────┐    ┌─────────────┐    ┌─────────────┐
  │ Research   │    │    Plan     │    │    Spec     │
  │            │───▶│             │───▶│             │
  │ informs:[] │    │ research:[] │    │ plans:[]    │
  └───────────┘    │ spec:       │    │ memory:[]   │
                   │ memory:[]   │    └─────────────┘
                   └─────────────┘
```

### Frontmatter Link Fields by Entity Type

| Entity | Link Field | Points To | Example |
|--------|-----------|-----------|---------|
| **Research** | `informs:` | Plans or specs this research fed into | `[plan-oauth-login.md]` |
| **Plan** | `research:` | Research files that informed this plan | `[research-oauth-providers.md]` |
| **Plan** | `spec:` | Spec this plan implements (if any) | `spec-v1-auth-mvp.md` |
| **Plan** | `memory:` | Memory files recording execution | `[auth-implementation-2026-04-08.md]` |
| **Spec** | `plans:` | Plans that implement this spec | `[plan-oauth-login.md, plan-password-reset.md]` |
| **Spec** | `memory:` | Memory files recording work on this spec | `[auth-research-2026-03-15.md]` |
| **Memory** | `subject:` | Subject folder this session relates to | `2026-04-08.auth-feature` |
| **Memory** | `artifacts:` | Specific files touched this session | `[plan-oauth-login.md, research-oauth-providers.md]` |

### Link Rules

- Links use **filenames only** (not full paths) for files within the same subject folder
- Links to memory files use the memory filename (they live in `.context/memory/`)
- All link fields are arrays (except `spec:` which is a single file)
- Empty arrays `[]` are valid — not every plan has a spec, not every research feeds a plan yet
- **b-save is responsible for stitching**: when it creates the memory file, it back-fills `memory:` links into the plan/spec files that were worked on

### Cold-Start Agent Discovery Flow

1. Agent reads `backlog/todo.md` → finds task linked to `2026-04-08.auth-feature/spec-v1-auth-mvp.md`
2. Reads the spec → `plans: [plan-oauth-login.md]`, `memory: [auth-research-2026-03-15.md]`
3. Reads the plan → `research: [research-oauth-providers.md]`, `memory: [auth-implementation-2026-04-08.md]`
4. Reads memory → full context of what was decided and what happened
5. Agent now has complete picture without needing any conversation history

---

## Backlog

The project backlog tracks priorities and future work. The canonical location is `.context/backlog/` — a directory with an active queue and per-item detail files. A legacy single-file `.context/backlog.md` is supported as a fallback only.

### Canonical Layout

```
.context/backlog/
├── todo.md                        # Active queue (linked checkboxes only)
├── items/
│   ├── refactor-auth.md           # Per-item detail
│   └── add-rate-limiting.md       # Per-item detail
└── archive/
    ├── completed.md               # Archived summary lines
    └── YYYY-MM/                   # Monthly archive of completed item files
        └── refactor-auth.md
```

### Read Protocol

1. Read `.context/backlog/todo.md` for the active queue.
2. Read item files in `.context/backlog/items/` selectively (only for items you plan to work on or need details for).
3. If `.context/backlog/` does not exist, fall back to `.context/backlog.md` (legacy format). Warn once per session when falling back.

### Active Queue Format (`todo.md`)

`todo.md` contains **only** linked checkboxes for active items:

```markdown
# Backlog

- [ ] [Refactor auth middleware](items/refactor-auth.md)
- [ ] [Add rate limiting](items/add-rate-limiting.md)
- [ ] [Update error messages](items/update-error-messages.md)
```

No priority sections, no details inline — priority lives in item-file frontmatter, details live in item files.

### Backlog Item File Format (`items/<slug>.md`)

Each active queue entry must have a backing item file:

```markdown
---
title: Refactor auth middleware
status: active
priority: high
created: 2026-04-08
updated: 2026-04-08
completed: null
related:
  - .context/2026-04-08.auth-feature/plan-oauth-login.md
  - .context/memory/auth-implementation-2026-04-08.md
---

# Refactor Auth Middleware

## Description
Brief one-line description of what needs to be done.

## Context
- Relevant files: `src/middleware/auth.ts`, `src/config/auth.yaml`
- Requirements: Extract auth logic into reusable middleware
- Technical notes: Must maintain backward compatibility with existing token format
- Related work: See plan at `.context/2026-04-08.auth-feature/plan-oauth-login.md`
```

**Frontmatter fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Human-readable title |
| `status` | Yes | `active` or `completed` |
| `priority` | Yes | `high`, `medium`, or `low` |
| `created` | Yes | Creation date (YYYY-MM-DD) |
| `updated` | Yes | Last update date (YYYY-MM-DD) |
| `completed` | Yes | Completion date (YYYY-MM-DD) or `null` |
| `related` | Yes | List of repo-root-relative paths to related artifacts (use `[]` when none) |

**Slug stability**: The filename (slug) stays stable after creation. If the title changes, update `title:` in frontmatter but keep the filename unchanged.

**Related paths**: Use repo-root-relative paths (e.g., `.context/...`) so links do not break when items are archived.

### Completion Flow

When a backlog item is completed:

1. **Remove** the item from `todo.md`
2. **Update** the item file frontmatter: `status: completed`, `completed: YYYY-MM-DD`
3. **Move** the item file to `archive/YYYY-MM/<slug>.md`
4. **Add** a summary entry to `archive/completed.md`

```markdown
<!-- archive/completed.md -->
- [x] Refactor auth middleware (2026-04-15) — `.context/2026-04-08.auth-feature/plan-oauth-login.md`
```

### Adding Items

When the user says "add to backlog", "todo later", "make a note", etc.:

1. Create the backing item file: `.context/backlog/items/<slug>.md` with frontmatter and description
2. Add a linked checkbox to `todo.md`: `- [ ] [Title](items/<slug>.md)`

### Agent Responsibilities

- **Always check** `.context/backlog/todo.md` (or legacy `.context/backlog.md`) for current priorities before starting work
- **Add items** with a backing item file + todo.md entry
- **Update status** by following the completion flow
- **Keep the queue clean** — completed items should be archived, not left in `todo.md`

### Status Model

Backlog items use only two statuses:
- `active` — on the queue, not yet started or in progress
- `completed` — done, archived

No `blocked`, `in-progress`, or other intermediate statuses. If an item is blocked, note it in the item file body.

### Legacy Fallback

Projects that still use `.context/backlog.md` (single-file format) continue to work:
- If `.context/backlog/` exists → use the canonical directory layout
- If only `.context/backlog.md` exists → use legacy format, **warn once per session** that the project should migrate
- **Do not auto-migrate** — migration is manual/on-request only
- Fresh projects should initialize `.context/backlog/` only (no shim file)

### Spec → Backlog Integration

When breaking a spec into actionable tasks:
- Create backlog items only for **clear near-term actionable units** of work
- One backlog item = one pickup-able unit of work
- Do not auto-expand specs/plans into a large queue
- Link backlog items to the spec via the item's `related:` paths

---

## Specifications & Planning (Specs)

For major features, roadmaps, epics, PRDs, and complex multi-session efforts, use **subject folders** with spec files. Specs live alongside related research and plans in date-prefixed subject folders.

> **Tip**: If your environment provides spec-summary tooling, use it to quickly review in-progress specs; otherwise inspect the subject folders directly.

### Three Universal Statuses

Every artifact (research, plan, spec) uses the same `status:` field in frontmatter:

| Status | Meaning |
|--------|---------|
| `draft` | Work in progress, not ready for action |
| `active` | Ready and current — being worked or available for reference |
| `completed` | Done, all objectives met |

**Why three, not more:**
- `blocked` is just `active` with a note in the body (blocks change, statuses shouldn't)
- `in-progress` vs `active` is a distinction without a difference at this granularity
- `archived` is replaced by `completed` — no file moves needed

### Subject-Level State

A subject folder's `index.md` carries an explicit `status:` field:
- `draft` — brainstorm/research in progress
- `active` — plan/spec exists, work underway or available
- `completed` — all objectives met

Skills that create or modify artifacts must update `index.md` status accordingly.
If `index.md` is absent or has no `status:`, derive from artifact frontmatter as before.

### Spec Lifecycle Workflow

1. **Ideation & Drafting (Active)**
   - Create `.context/YYYY-MM-DD.<subject>/spec-<milestone>-<topic>.md`.
   - Use YAML frontmatter: `status: draft`, `date`, `subject`, `topics`, `type`, `priority`, `dependencies`, `plans`, `memory`.
   - No separate registration needed — scan subject folders to find specs.

2. **Execution (Backlog Integration)**
   - Break the spec into actionable tasks and add them as backlog items (`.context/backlog/items/<slug>.md` + entries in `.context/backlog/todo.md`). Legacy fallback: `.context/backlog.md`.
   - **Crucial**: Link the backlog item's `related:` field to the spec file. One backlog item = one pickup-able unit of work.

3. **Session Memory & Execution**
   - Read the spec file before starting a task linked to it.
   - Mention the spec progress or blockers in your `.context/memory/<session>.md` notes.
   - Keep the spec file updated if requirements evolve.

4. **Completion**
   - Once all tasks are done, set frontmatter `status: completed`.
   - Files stay in place — no directory moves needed.
   - Mark backlog items as `[x]`.
   - Summarize the completion in session memory.

### Spec Markdown Template

```markdown
---
status: active
date: 2026-04-08
subject: 2026-04-08.auth-feature
topics: [oauth, login]
type: epic | prd | milestone
priority: high | medium | low
dependencies: [other-subject/spec]
plans: [plan-oauth-login.md]        # Plans implementing this spec
memory: []                          # Filled by b-save after execution
---

# [Title]

## Goal
[One sentence objective]

## Context / Background
[Why are we doing this?]

## Requirements
- [ ] Must have: ...
- [ ] Should have: ...

## Implementation Plan
[Step-by-step breakdown or phased approach]

## Acceptance Criteria
[Definition of done]
```

### Legacy Compatibility

The old flat directory structure is still supported:
- `.context/specs/active/*.md` — scanned as fallback
- `.context/specs/archive/*.md` — tolerated but not used for new work
- `.context/plans/*.md` — scanned as fallback

Resolution order ensures zero breaking changes for existing projects.

---

## Plans vs Specs vs Research: When to Use Each

Three planning artifacts exist with different purposes. Understanding when to use each prevents confusion and ensures work is captured appropriately.

### Quick Decision Guide

| Question | Answer | Create |
|----------|--------|--------|
| "What did we learn?" | Investigation findings | **Research** |
| "What are we building and why?" | Strategic definition | **Spec** |
| "How do I implement this?" | Tactical steps | **Plan** |
| "This needs exploration first" | Unknown codebase/tech | **Research** |
| "This will take 3 sessions" | Multi-session | **Spec** |
| "I can finish this today" | Single session | **Plan** |
| "I need to track requirements" | Needs tracking | **Spec** |
| "I need to list affected files" | Implementation detail | **Plan** |
| "This is an epic/PRD/roadmap" | Strategic document | **Spec** |
| "This is a step-by-step guide" | Tactical document | **Plan** |

### Key Differences

| Attribute | Research | Spec | Plan |
|-----------|----------|------|------|
| **Purpose** | Learn & document | Strategic: what & why | Tactical: how |
| **Time horizon** | Hours to days | Days to weeks | Hours to a day |
| **Scope** | Discovery | Multi-session | Single session |
| **Lifecycle** | Ad-hoc (reference) | 3 statuses (draft/active/completed) | 3 statuses (draft/active/completed) |
| **Contents** | Findings, data flow, risks | Goals, requirements, acceptance criteria | Steps, files, verification |
| **Driven by** | Curiosity, unknowns | User needs, business value | Implementation reality |
| **When done** | Findings captured | All acceptance criteria met | All steps completed |

### Directory Structure (Subject Folders)

```text
.context/
├── backlog/                              # Active queue + per-item detail
│   ├── todo.md                          # Active items (linked checkboxes only)
│   ├── items/<slug>.md                  # Per-item detail with frontmatter
│   └── archive/                         # Completed items
│       ├── completed.md                 # Archived summary lines
│       └── YYYY-MM/<slug>.md            # Monthly archive of item files
├── memory/                                 # Session memory
│   ├── index.md
│   └── <topic>-YYYY-MM-DD.md              # With subject: links
│
├── YYYY-MM-DD.subject-name/                # ← Subject folder
│   ├── research-<topic>.md                # Research findings
│   ├── plan-<topic>.md                    # Implementation plan
│   └── spec-<milestone>-<topic>.md        # Strategic spec
│
├── plans/                                  # Legacy flat plans
├── specs/                                  # Legacy flat specs
│   ├── active/
│   └── archive/
└── *.md                                    # Optional docs
```

### Workflow Relationship

```text
Research ──→ Spec ──→ Plan ──→ Build ──→ Memory
   │           │        │
   │           │        └─ references research
   │           │           (if applicable)
   │           │
   │           └─ references spec
   │              (if applicable)
   │
   └─ informs plans/specs
```

### Buck Workflow Integration

| Artifact | Created By | Read By | Location |
|----------|------------|---------|----------|
| **Research** | research workflow | planning/build workflows | `.context/YYYY-MM-DD.subject/research-*.md` |
| **Spec** | planning workflow (strategic) | review/build workflows | `.context/YYYY-MM-DD.subject/spec-*.md` |
| **Plan** | planning workflow (tactical) | build workflows | `.context/YYYY-MM-DD.subject/plan-*.md` |
| **Backlog** | User, agent, or manual update | all workflows | `.context/backlog/todo.md` + `items/` |
| **Memory** | After significant work | all workflows | `.context/memory/` |

### When to Create Research

**Create research when:**
- You're exploring unfamiliar code
- You need to trace architecture or data flow
- You're comparing options (libraries, approaches)
- Findings should be reusable by other agents
- You want to capture findings outside the context window

**Skip research when:**
- You already understand the codebase
- The task is a simple, obvious change
- No investigation is needed

### When to Create a Spec

**Create a spec when:**
- The work spans multiple sessions (days/weeks)
- You need to track requirements and acceptance criteria
- The feature is complex with many files and decisions
- You're creating an epic, PRD, or roadmap item
- Other agents need to understand the goal before implementing

**Skip the spec when:**
- The task is a simple, focused change
- You can explain it in a single sentence
- It's a one-hour fix that won't need review

### When to Create a Plan

**Create a plan when:**
- You need to list specific files to change
- You're doing implementation-focused work
- You want to capture steps for later verification
- The work can be done in one session
- You need to clarify scope (in vs out)

**Skip the plan when:**
- The work is trivial (single file, obvious changes)
- A spec already covers everything needed
- You're just editing a few lines

### Research Markdown Template

```markdown
---
status: active
date: 2026-04-08
subject: 2026-04-08.auth-feature
topics: [oauth, providers, comparison]
informs: [plan-oauth-login.md]      # What this research fed into
---

# Research: OAuth Provider Comparison

## Summary
[One paragraph overview of findings]

## Key Findings
- Finding 1
- Finding 2

## Data Flow
[How the system works]

## Risks / Unknowns
- Risk 1
- Open question 1

## Recommended Next Step
[Link to plan or spec that uses this research]
```

### Plan Markdown Template

```markdown
---
status: active
date: 2026-04-08
subject: 2026-04-08.auth-feature
topics: [oauth, login, implementation]
research: [research-oauth-providers.md]  # Research that informed this plan
spec: spec-v1-auth-mvp.md               # Spec this plan implements (if any)
memory: []                               # Filled by b-save after execution
---

# Plan: OAuth Login Implementation

## Goal
[One sentence objective]

## Scope
- **In scope**: [what's included]
- **Out of scope**: [what's NOT included]

## Affected Files
- `path/to/file1` - [description]
- `path/to/file2` - [description]

## Implementation Steps
1. [Step with specific file]
2. [Next step]
3. [Verification step]

## Verification
- [ ] [Checkable outcome]
- [ ] [Another outcome]
```

### Concrete Examples

#### Example 1: When to Create Research

**Scenario:** You need to understand how authentication works in an unfamiliar codebase.

**Why this is research:**
- You're tracing code paths you don't know
- Findings will inform the implementation plan
- Other agents might need these findings later
- You want to capture architecture diagrams, data flow, etc.

#### Example 2: When to Create a Spec

**Scenario:** You're planning to add OAuth authentication to your application.

**Why this is a spec:**
- Spans multiple sessions (days/weeks)
- Requires requirements gathering (which providers, what flows)
- Has acceptance criteria (users can log in with Google/GitHub)
- Needs backlog integration (break down into tasks)
- Involves multiple files across the codebase

#### Example 3: When to Create a Plan

**Scenario:** You've researched how the current auth system works and need to implement password reset.

**Why this is a plan:**
- Single session work (hours)
- Focused on specific files and steps
- Implementation-focused (how, not what)
- References the research that informed it

### Quick Rules

**Create research when:**
- ☐ Exploring unfamiliar code
- ☐ Comparing options or approaches
- ☐ Findings should be reusable
- ☐ Need to trace architecture/data flow

**Create a spec when:**
- ☐ Multi-session work
- ☐ Complex requirements to track
- ☐ Epic, PRD, or milestone
- ☐ Work will be referenced by multiple agents

**Create a plan when:**
- ☐ Single session work
- ☐ Implementation-focused
- ☐ Need to list affected files
- ☐ Want step-by-step verification
- ☐ Tactical, not strategic

**Use backlog when:**
- ☐ Quick todos or near-term actionable units
- ☐ Need a pick-up-able queue entry
- ☐ Item links to a subject plan/spec for full context

---

## Agent Checklist

Before submitting changes:
- [ ] Code follows project naming conventions (check root `AGENTS.md`)
- [ ] Docstrings/comments added for public APIs
- [ ] Error handling is explicit and informative
- [ ] Tests pass (or are added for new functionality)
- [ ] Linting passes (ruff, eslint, shellcheck as appropriate)
- [ ] Backlog updated if needed
- [ ] Session memory updated in `.context/memory/` if significant decisions were made
- [ ] User notified of any breaking changes or required actions
- [ ] **Web UI changes verified in browser** (if modifying UI files: screenshots captured, console errors checked, interactions tested)

## 📋 Task Completion Checklist

**After finishing ANY task:**

- [ ] **Checkpoint persistent state** using `/b-save` or the manual equivalent:
  - [ ] A durable artifact exists for the work (`plan`, `spec`, `research`, `memory`, or backlog update)
  - [ ] Plans created during the session are written to `.context/` under the current subject-folder rules
  - [ ] Memory written to `.context/memory/<topic>-YYYY-MM-DD.md` when execution or decisions warrant it
  - [ ] Memory index updated (`.context/memory/index.md`) when memory was written
  - [ ] Backlog updated (completed items marked, new items added)
  - [ ] Specs completed (set `status: completed` in frontmatter, files stay in place)
  - [ ] Architecture synced (if implementation changed)
  - [ ] QMD re-indexed (if available)
- [ ] **User notified** of completion and any follow-up needed
- [ ] **Browser verification complete** (for UI changes: navigated, tested, error-free)

---

## Specialized Workflows

Some environments expose specialized agents, reusable skills, or named workflows. In Pi, treat these as optional execution modes rather than guaranteed built-ins.

### Example Specialized Roles

| Role | When to Use | Description |
|------|-------------|-------------|
| **systematic-debugger** | Code doesn't work as expected | Investigates root causes using a disciplined debugging process and records findings persistently. |
| **QA** | Need tests created or run | Focuses on test creation, execution, and quality reporting. |
| **memory-processor** | Search/analyze project memory | Synthesizes past sessions, searches for topics, and extracts patterns from `.context/memory/`. |
| **research workflow** | Need architecture or library understanding | Performs structured discovery and records findings in research artifacts. |
| **review workflow** | Need correctness or regression review | Reviews changes and reports issues or approval criteria. |

### Environment Rule

- Use named agents, skills, or commands only when your current environment actually provides them
- Otherwise, follow the same role manually with the available tools and `.context/` artifacts
- Prefer explicit written outputs over relying on invisible subagent state

### Creating Custom Agents or Workflow Artifacts

Create environment-appropriate custom agents or reusable workflow artifacts in the paths supported by the current platform. Prefer project-local definitions when the behavior is project-specific.

## Operational Drift Audit

Run this periodically (or after major configuration changes) using whatever inspection commands the current environment supports.

Audit goals:
- Detect duplicate or overlapping workflow definitions
- Confirm path precedence is preserved
- Confirm domain partition policy for non-coding shared packs
- Remove or consolidate stale definitions in the source of truth

---

## Multi-Model Safe Agent Policy (from specs)

**Mission**: Make the smallest safe change that solves the task.

**Non-negotiables**:
- Do NOT expand scope
- Do NOT refactor unrelated code
- Do NOT introduce dependencies
- Do NOT change APIs unless required
- Do NOT modify config, CI, or infra

**Safe Change Policy**:
- Before editing: Read target + related files, find call sites + tests
- After: Run verification, list changed files, report assumptions, stop on failures

**Task Types**:
- GOOD for weak/fast agents: specific bug fix, small UI, rename, add known tests
- BAD: system refactor, architecture changes, redesigns

Use stronger planning/review/build workflows for judgment and higher-risk work. Escalate on ambiguity or when the change spans more than 3 files.

## Handling User Feedback

**Core Principle**: User statements are high-value hypotheses, **not** infallible truth. Verify everything. You can be wrong. The user can be wrong. Strong collaboration requires evidence-based dialogue.

### Verification Workflow (Mandatory)

When the user provides feedback, correction, or opinion:

1. **Pause and Assess**
   - Identify claim strength: strong assertion, tentative suggestion, preference/opinion, or question
   - Note any emotional tone or certainty language

2. **Verify Against Ground Truth** (never skip)
   - Re-read relevant session memory, specs, plans, and code
   - Use tools in this order:
     - Local memory artifacts first; optionally use `qmd` or `@memory-processor` if available for project history
     - Code exploration (`explore`, `grep`, jcodemunch tools, `read`)
     - Library/API docs from available sources (local docs first; Context7 or similar integrations only when configured)
     - `webfetch`/`web_parser` or other available external research tools for standards
   - Reproduce any reported issues using `@systematic-debugger` patterns if applicable

3. **Response Patterns** (use these templates for consistency)

**For Corrections:**
> "You mentioned [user claim]. After checking the [memory/code/docs], I confirmed [evidence]. This updates my previous understanding because [reason]. Here's the corrected approach: ..."

**For Disagreements/Opinions:**
> "Your preference for [user view] makes sense for [context]. However, the current implementation follows [standard/previous decision] because [evidence]. Tradeoffs are:
> - Your approach: [pros/cons]
> - Current approach: [pros/cons]
> Recommendation: [balanced suggestion]. Would you like to adjust the spec?"

**For Uncertainty:**
> "I'm verifying this now using [tools]. Stand by for evidence-based response..."

### Key Rules (Especially for Mid-Tier Models)

- **Never** default to "You're right" without verification steps above
- **Always** document the resolution (and evidence) in session memory
- If research shows user is correct: explicitly acknowledge, update memory/index/backlog as needed
- If research shows your prior output was correct: present evidence respectfully, without defensiveness
- When user asks for an opinion: lead with facts/research from tools, *then* reasoned position

This protocol prevents compounding errors and creates a robust human-AI collaboration loop.

## Additional Resources

- Local project docs and `README.md`
- `.context/` artifacts in the current project
- Environment-specific workflow docs, templates, and tool references if present
- Reusable local scripts and project-local workflow artifacts
