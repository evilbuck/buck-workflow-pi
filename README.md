# Buck Workflow

A structured, discoverable workflow for AI-assisted software development with durable context management.

## Philosophy

The Buck workflow is built on one principle: **don't lose work**. It separates **intent** (plans in subject folders) from **record** (history in memory), creating a durable paper trail that survives chat context limits.

## Not a Framework — A Toolkit

Buck workflow is **not prescriptive**. You don't have to run it from start to finish. Each stage is a named thinking mode — pick the ones your task needs and skip the rest:

- **Start in the middle.** Already know what to build? Run `/b-plan` and skip the exploration.
- **Finish early.** Small change? `/b-build` → `/b-review` and you're done.
- **Ad-hoc.** Work freeform and let the global AGENTS.md baseline handle durability.

The global baseline ensures that even without running any Buck command, the agent still creates durable artifacts (memory, backlog updates, subject folders). Buck stages add structure on top; they don't gate basic durability.

## Architecture: Global Baseline + Buck Package + Project Config

Buck workflow is a stack of three layers that work together. The global layer is always active — it provides the durable-artifact conventions that make everything else work. Buck adds structured workflow stages. Project config adds domain-specific instructions.

### The Global Baseline (`~/.omp/agent/AGENTS.md` or `~/.pi/agent/AGENTS.md`)
The global AGENTS.md is loaded for every session, in every project. It establishes the conventions that make Buck work without requiring any Buck command to be run:

- **Before any task**: check `.context/memory/index.md` and recent memory files, check backlog
- **After any significant work**: write session memory, update the memory index, update backlog status
- **Artifact conventions**: subject folder structure, frontmatter format, cross-reference linking
- **Buck workflow surface**: `b-*` names as workflow labels that agents follow using `.context/` artifacts when native commands aren't available

This means **durability works even in quick ad-hoc sessions** where no Buck command is run. The baseline handles it automatically.

### Layer Ownership

| Layer | Location | Owns |
|-------|----------|------|
| **Global baseline** | `~/.omp/agent/AGENTS.md` or `~/.pi/agent/AGENTS.md` | Operating principles, durable-artifact principle, `.context/` conventions, Buck workflow surface |
| **Global reference** | Agent-global `docs/context-workflow.md` when installed | Detailed `.context/` conventions, frontmatter templates, backlog layout |
| **Buck package** | This repo | Workflow semantics, skills, prompt/command wrappers, minimal runtime automation |
| **Project config** | `./AGENTS.md` per repo | Build commands, code style, architecture notes, gotchas |

The global AGENTS.md is kept compact (~120 lines). Buck owns the detailed workflow taxonomy and runtime behavior. This means Buck workflow remains portable — the global layer provides a lightweight hint that points to Buck for non-trivial work.

## Install

> **For installing agents:** Read
> [`agent-install_instructions.md`](./agent-install_instructions.md) and
> **ask the user which harness they're on** (Pi, OMP, Codex, OpenCode, or
> Claude Code) before running any install commands.

### 1. Install the Buck Workflow Package

```bash
pi install /path/to/buck-workflow
# or from git:
pi install git:github.com/buckleyrobinson/buck-workflow-pi
```

### 2. Run the Multi-Harness Installer

The installer detects which agent harnesses are installed on your machine and symlinks the bootstrap instructions + skill/command trees into each harness's expected locations. One command, every harness, always in sync:

```bash
npx buck-workflow install
```

**What it does:**
- Detects installed harnesses (Pi, OMP, Claude Code, Codex, OpenCode, Cursor)
- Symlinks `GLOBAL_OR_PROJECT-AGENTS.md` as bootstrap instructions for each
- Symlinks `prompts/*.md` as slash commands for Claude Code, OpenCode
- Symlinks `skills/<name>/` directories for Claude Code, OpenCode
- Idempotent — re-run anytime, existing correct symlinks are skipped

**Flags:**

| Flag | Purpose |
|------|---------|
| `--dry-run` | Print planned symlinks, write nothing |
| `--force` | Replace real files at destination (e.g., chezmoi-managed configs) |
| `--source <path>` | Repo root symlinks resolve from (default: auto-detect) |
| `--harness <id,...>` | Wire only named harnesses (comma-separated) |
| `--list` | Print detected harnesses and exit |

**Per-harness behavior:**

| Harness | Bootstrap | Commands | Skills | Notes |
|---------|:---------:|:--------:|:------:|-------|
| **Pi** | ✅ symlink | ❌ (package) | ❌ (package) | Skills/commands loaded via `pi install` |
| **OMP** | ✅ symlink | ❌ (package) | ❌ (package) | Skills/commands loaded via package manifest |
| **Claude Code** | ✅ → `CLAUDE.md` | ✅ `~/.claude/commands/` | ✅ `~/.claude/skills/` | |
| **Codex** | ✅ → `AGENTS.md` | ❌ (no commands) | — | Bootstrap-only; Codex has no slash commands |
| **OpenCode** | ✅ → `AGENTS.md` | ✅ `~/.config/opencode/commands/` | ✅ `~/.config/opencode/skills/` | |
| **Cursor** | — | — | — | Project-scoped only (`.cursor/rules/`); no global install |

**Bootstrap drift fix:** The installer uses symlinks instead of copies, so `git pull` + re-run keeps every harness in sync. No more manual re-copying when the bootstrap file changes.

#### Per-Project (Optional)

If you want project-specific instructions in addition to the global bootstrap, place an `AGENTS.md` in the project root:

```bash
cp GLOBAL_OR_PROJECT-AGENTS.md /path/to/your-project/AGENTS.md
```

Most agents load both global and project-level files — the project-level one extends the global baseline with build commands, code style, and architecture notes.

## What's Included

### Layered Architecture

1. **Canonical skills** (`skills/`) — Portable workflow logic. Agent-neutral Markdown files that define *how* each workflow behaves. These are the source of truth.
2. **Thin wrappers** (`prompts/` + `commands/`) — Agent-native invocation surface. Pi reads `prompts/*.md` as slash commands. OMP reads `commands/*.md`; those files are symlinks back to `prompts/` so there is one source of truth.
3. **Runtime automation** (`extensions/index.ts`) — Minimal Pi/OMP extension surface for model auto-switch and TPS tracking. Historical orchestration subsystems remain in `extensions/` but are not wired by the package manifest.

**Runtime mapping:**

- **Pi `/b-*` commands** → prompt templates in `prompts/` that invoke skills in `skills/`
- **OMP `/b-*` commands** → symlinks in `commands/` that point to the same prompt templates
- **Runtime hooks** → `extensions/index.ts` only: model auto-switch for phased plans and token-per-second tracking
- **`/b-save`** → pure prompt + skill (`prompts/b-save.md`, `skills/b-save/SKILL.md`), not an extension command; run before `/b-commit` to record durable session state

### Cross-Agent Parallels

Skills are designed to be a portable layer. Each agent would invoke them through its native mechanism:

| Agent | Invocation Mechanism | Example | Installed by |
|-------|---------------------|---------|-------------|
| **Pi** | Prompt templates (`prompts/`) | `/b-plan` loads `prompts/b-plan.md` | `pi install` (package) |
| **OMP** | Command mirror (`commands/`) | `/b-plan` loads `commands/b-plan.md` → `../prompts/b-plan.md` | Package manifest |
| **Claude Code** | Commands (`.claude/commands/`) | `/b-plan` loads the same prompt template | `buck-workflow install` |
| **Codex** | Bootstrap only (no slash commands) | `AGENTS.md` auto-loaded | `buck-workflow install` |
| **OpenCode** | Commands + skills | `/b-plan` loads the same prompt template | `buck-workflow install` |
| **Cursor** | Project rules (`.cursor/rules/`) | Rule file references skill content | Manual (project-scoped) |

Prompt templates are the source of truth for slash-command bodies. Skills, `.context/` conventions, and the global AGENTS.md are written to be agent-agnostic. The installer wires each harness's native loading mechanism to the shared source of truth.

**Want to help?** Pull requests that improve support for Claude Code, Cursor, OpenCode, Codex, or other agent harnesses are very welcome. The skills are plain Markdown — the main work is testing the full workflow on each harness and fixing any behavioral quirks.

### Prompt Templates (`/b-*` commands)

Type `/b-` in Pi or OMP to see the Buck workflow slash commands. Each prompt command is a thin wrapper that invokes the matching skill:

| Command | Skill Invoked | Purpose |
|---------|---------------|---------|
| `/b-brainstorm` | `b-brainstorm` | Interview-style intake, capture initial thinking |
| `/b-explore` | `b-explore` | Explore codebases, trace architecture, map data flows |
| `/b-research` | `b-research` | External/web research, source collection, evidence capture |
| `/b-plan` | `b-plan` | Create bounded implementation plan with scope and risks |
| `/b-present` | `b-present` | Generate async-readable presentation package |
| `/b-build` | `b-build` (standard mode) | Standard implementation — smallest safe code change |
| `/b-build-hard` | `b-build` (hard mode) | Complex, ambiguous, or higher-risk implementation |
| `/b-iterate` | `b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `/b-review` | `b-review` | Review implementation for correctness and regressions |
| `/b-commit` | `git-commit` | Create a Conventional Commits message and commit |

### OMP Command Mirror

`commands/*.md` are symlinks to `prompts/*.md`. They exist so OMP discovers the same slash commands that Pi exposes from `prompts/`.

### Pure Prompt Commands

| Command | Purpose |
|---------|---------|
| `/b-save` | Record session history to `.context/memory/`, update workflow state, stitch cross-references, and update backlog/spec status |

### Skills

| Skill | Purpose |
|-------|---------|
| `b-brainstorm` | Interview-style intake — capture initial thinking and save a draft |
| `b-explore` | Explore unfamiliar codebases, trace architecture, map data flows |
| `b-research` | Investigate external sources — APIs, libraries, documentation, web resources |
| `crawl4ai` | Deep website crawling and content extraction (helper skill for b-research) |
| `b-plan` | Turn context into a bounded implementation plan |
| `b-build` | Implement well-defined work (standard or hard mode) |
| `b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `b-review` | Review implementation for correctness and regressions |
| `b-present` | Generate async-readable presentation package from artifacts |
| `b-phase` | Analyze a plan and break it into sequential phases |
| `git-commit` | Create a Conventional Commits message and commit |
| `b-grill` | Stress-test a plan or design through structured interviewing |
| `b-grill-me` | Grill the user directly about a plan |
| `b-grill-auto` | Grill a different AI model via RPC about a plan |
| `b-grill-with-docs` | Grill against existing domain documentation |
| `run-in-idle-pane` | Detect least-active tmux pane and run commands there |
| `design-brief` | Extract UI design briefs from screenshots, files, text, and subject-folder context |

### Extension (Runtime Hooks)

The wired package extension is intentionally small:
- **Model auto-switch** for phased plans on `/b-build`, `/b-build-hard`, `/b-iterate`, and `/b-review`
- **Token-per-second tracking** during model generation

Removed/unwired subsystems include `/b-mode`, plan-mode write guards, `/b-save` as an extension command, `b-flow`, `b-grill-auto` extension command wiring, tmux status, and session state injection. See [`docs/extension-loading.md`](docs/extension-loading.md) for the package loading truth table.

## Workflow Overview

Buck workflow is not a rigid pipeline. You choose which stages to run based on the task at hand:

### Full Workflow — New Feature

```
/b-brainstorm → /b-explore → /b-research → /b-plan → /b-build → /b-review → /b-save → /b-commit
```

Starting from a vague idea through to durable completion. Every artifact survives the session.

### Partial Workflows

| Flow | When to Use |
|------|-------------|
| `/b-brainstorm → /b-plan → /b-build` | Idea to implementation in one session |
| `/b-plan → /b-build → /b-review → /b-save → /b-commit` | You already know what to build |
| `/b-research → /b-plan → /b-build-hard → /b-review → /b-save → /b-commit` | Complex/risky work |
| `/b-build → /b-review` | Quick fix — no planning needed |
| `/b-iterate → /b-review` | Follow-up fix loop |
| `/b-plan → /b-review → /b-save → /b-commit` | Plan and review without exploration |

### Ad-Hoc Work

You don't have to run any Buck command at all. The global AGENTS.md bootstrap (`~/.omp/agent/AGENTS.md` or `~/.pi/agent/AGENTS.md`) ensures that even in freeform sessions, the agent still writes memory, updates the backlog, and maintains `.context/` artifacts. Buck stages add structure; the baseline ensures continuity regardless.

## Subject Folder System

All artifacts are organized in dated subject folders:

```
.context/
├── 2026-04-08.auth-feature/
│   ├── research-oauth-providers.md
│   ├── plan-oauth-login.md
│   └── spec-v1-auth-mvp.md
├── backlog/
│   ├── todo.md
│   ├── items/<slug>.md
│   └── archive/
├── memory/
│   ├── index.md
│   └── auth-impl-2026-04-08.md
├── workflow/
│   └── current-session.json
└── backlog.md            # Legacy fallback (not used when backlog/ exists)
```

## Hybrid Context Indexes

Narrative `.context/` artifacts stay in Markdown. Machine query views are generated under `.context/index/`.

Commands:

```bash
npm run context:index
npm run context:validate
```

Generated files:

- `.context/index/subjects.json`
- `.context/index/memory.json`
- `.context/index/backlog.json`
- `.context/index/artifacts.json`

`context:validate` is strict on enum/value errors and currently reports legacy missing-field drift as warnings so older artifacts do not block adoption. `context:index` rebuilds the JSON views from Markdown source; never hand-edit the generated JSON.
## Cross-Reference System

Artifacts link to each other via frontmatter fields:

- **Research** → `informs: [plan-file.md]`
- **Plan** → `research: [research-file.md]`, `spec: spec-file.md`, `memory: []`
- **Spec** → `plans: [plan-file.md]`, `memory: []`
- **Memory** → `subject: YYYY-MM-DD.name`, `artifacts: [files...]`

`/b-save` stitches cross-references by executing the prompt/skill instructions directly.

## Requirements
- An AI coding agent — any supported harness (see [Compatibility](#compatibility))
- The agent bootstrap instructions installed (via `buck-workflow install` or manually)
- A `.context/` directory in your project (created automatically on first use)
- For slash commands: Pi with `prompts/` loaded, or OMP with `commands/` mirror, or any harness wired by the installer
- Optional: [qmd](https://github.com/qmd-project/qmd) for semantic search over memory files

## Compatibility

**Buck workflow runs on all major agent harnesses.**

The multi-harness installer (`buck-workflow install`) handles path placement and wrapper wiring automatically. Pi and OMP are the maintained targets with full test coverage. Claude Code, Codex, OpenCode, and Cursor are wired by the installer but may have behavioral differences:

1. **Tool availability** — Some agents may not support all tools referenced by skills (e.g., `ast_grep`, `debug`)
2. **Schema compliance** — Frontmatter parsing and file conventions may vary
3. **Context injection** — How agents load and prioritize `AGENTS.md`/`CLAUDE.md` differs
4. **Cursor** — Global install not supported; requires project-scoped `.cursor/rules/` setup

### Contributing

Pull requests are welcome and encouraged:
- Bug fixes from testing on other harnesses
- Installer improvements and new harness support
- Documentation corrections

The skills are the portable core — if you can load a Markdown file and follow instructions, you can make Buck workflow run on any agent.


## License

MIT
