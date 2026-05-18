# Buck Workflow for Pi

A structured, discoverable workflow for AI-assisted software development with durable context management and autonomous phase execution.

## Philosophy

The Buck workflow is built on one principle: **don't lose work**. It separates **intent** (plans in subject folders) from **record** (history in memory), creating a durable paper trail that survives chat context limits.

## Global vs Package Ownership

Buck workflow is designed for portability across agent environments. The split between global Pi agent instructions and this package is intentional:

| Layer | Location | Owns |
|-------|----------|------|
| **Global baseline** | `~/.pi/agent/AGENTS.md` | Operating principles, durable-artifact principle, `.context/` as shared convention, Buck recommendation |
| **Global reference** | `~/.pi/agent/docs/context-workflow.md` | Detailed `.context/` conventions, frontmatter templates, backlog layout |
| **Buck package** | This repo | Workflow semantics, skills, prompts, extension runtime, Buck-mode behavior |

The global AGENTS.md is kept compact (~120 lines). Buck owns the detailed workflow taxonomy and runtime behavior. This means Buck workflow remains portable — the global layer provides a lightweight hint that points to Buck for non-trivial work.

## Install

```bash
pi install /path/to/buck-workflow
# or from git:
pi install git:github.com/buckleyrobinson/buck-workflow-pi
```

After installing, the package is active on next Pi session start. To pick up changes during a running session, use `/reload`.

## What's Included

### Layered Architecture

Buck workflow uses a three-layer model for portability across agents:

1. **Canonical skills** (`skills/`) — Portable workflow logic. These are the reusable, agent-neutral instruction sets that define *how* each workflow behaves. They are the source of truth.
2. **Thin wrappers** (`prompts/`) — Agent-native invocation surface. Pi prompt templates provide the familiar `/b-*` commands, but each one is now a thin wrapper that loads the matching skill. Other agents (Claude Code, OpenCode, Codex) can use their own command/skill mechanisms to invoke the same canonical logic.
3. **Runtime automation** (`extensions/`) — Session tracking, state orchestration, and event-driven behavior that needs hooks and persistence. This is not portable as static instructions and stays in extensions.

**Pi-native mapping:**

- **Most `/b-*` commands** → **prompt templates** in `prompts/` that invoke **skills** in `skills/`
- **Session/runtime automation** (`/b-save`, `/b-mode`, `/b-flow`, `/b-next`) → **extensions** in `extensions/`
- **Autonomous phase execution** → **b-flow extension** orchestrating build → review → iterate → save lifecycle

### Prompt Templates (`/b-*` commands)

Type `/b-` in pi to see the Buck workflow prompt-template commands. Each is a thin wrapper that invokes the matching skill:

| Command | Skill Invoked | Purpose |
|---------|---------------|--------|
| `/b-brainstorm` | `b-brainstorm` | Interview-style intake, capture initial thinking |
| `/b-research` | `b-research` | Explore code, trace architecture, capture findings |
| `/b-plan` | `b-plan` | Create bounded implementation plan with scope and risks |
| `/b-present` | `b-present` | Generate async-readable presentation package |
| `/b-build` | `b-build` (standard mode) | Standard implementation — smallest safe code change |
| `/b-build-hard` | `b-build` (hard mode) | Complex, ambiguous, or higher-risk implementation |
| `/b-iterate` | `b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `/b-review` | `b-review` | Review implementation for correctness and regressions |
| `/git-commit` | `git-commit` | Create a Conventional Commits message and commit |

### Extension Commands

| Command | Source | Purpose |
|---------|--------|--------|
| `/b-save` | `extensions/index.ts` | Record session history to `.context/memory/`, update workflow state, trigger save orchestration |
| `/b-mode on\|off\|status` | `extensions/index.ts` | Control Buck workflow mode and its planning write guard |
| `/b-flow <subcommand>` | `extensions/b-flow/index.ts` | Orchestrate autonomous/guided phase execution (see below) |
| `/b-next` | `extensions/b-flow/index.ts` | Show next pending work item from the b-flow queue |
| _Auto-injected_ | `extensions/b-flow/index.ts` | `before_agent_start` digest with active step/iteration/phase links |

#### b-flow: Autonomous Phase Execution

`/b-flow` is the autonomous orchestration layer. It executes a phased plan through a deterministic lifecycle without manual prompting between steps.

```
/b-flow start <goal>    →  Create a phased subject folder and queue
/b-flow run              →  Execute phases with guided confirmations
/b-flow run --autonomous →  Execute phases autonomously (skips routine confirmations, preserves guardrails)
/b-flow status           →  Show current state, active phase, step, iteration
/b-flow pause            →  Pause after current worker finishes
/b-flow stop             →  Abort and record reconciliation state
/b-flow continue         →  Resume from last projected state
/b-flow jump <state>     →  Manual state transition (experimental, for recovery)

# Non-LLM quick command
/b-next                  →  Show next pending work item from the queue
```

**Lifecycle** (executed per phase):

```
select phase → build → review → [iterate → review]ⁿ → save → next phase
```

The lifecycle is artifact-driven: it reads and writes phase files, iterate artifacts, and worker result files. Recovery reconciles phase file frontmatter, worker results, and projected state on restart.

**Guardrails (autonomous mode):**
- Max 5 iterations per phase (configurable)
- Stagnation detection: same issue fingerprint 3 times, no source changes 2 iterations, repeated failures
- Phase-boundary git safety: blocks before new phase if unattributed source changes remain
- Orphaned audit detection: blocks if worker died without producing a result
- Multiple active iterate artifacts: blocks with actionable message

**Modes:**
- **Guided** (`/b-flow run`): confirms build/review/iterate/save/next-phase transitions
- **Autonomous** (`/b-flow run --autonomous`): skips routine confirmations but still blocks on all guardrails

#### b-grill-auto: Automated Plan Grilling

`/b-grill-auto` (in `extensions/b-grill-auto/`) interviews a separate AI model via RPC subprocess to stress-test a plan or design. Tracks decision-tree complexity as metadata and evaluates separation-of-concerns boundaries at the assessment threshold.

### Skills

| Skill | Purpose |
|-------|---------|
| `b-brainstorm` | Interview-style intake — capture initial thinking and save a draft plan |
| `b-research` | Explore unfamiliar code, trace architecture, capture findings |
| `b-plan` | Turn context into a bounded implementation plan |
| `b-build` | Implement well-defined work (standard or hard mode) |
| `b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `b-review` | Review implementation for correctness and regressions |
| `b-present` | Generate async-readable presentation package from artifacts |
| `b-phase` | Analyze a plan and break it into sequential phases |
| `b-grill` | Stress-test a plan or design through structured interviewing |
| `b-grill-me` | Grill the user directly about a plan |
| `b-grill-auto` | Grill a different AI model via RPC about a plan |
| `b-grill-with-docs` | Grill against existing domain documentation |
| `arch-deep-dive` | Generate single-page HTML architecture deep-dive with diagrams |
| `pi-rpc` | Drive a Pi subprocess via JSON RPC protocol |
| `run-in-idle-pane` | Detect least-active tmux pane and run commands there |
| `git-commit` | Create a Conventional Commits message and commit |

### Extensions

| Extension | Location | What it does |
|-----------|----------|-------------|
| **Session tracking** | `extensions/index.ts` | Tracks commands, file modifications, compaction injection, `/b-save` and `/b-mode` commands, Buck workflow mode management |
| **b-flow** | `extensions/b-flow/` | State-machine orchestration for autonomous/guided phase execution — lifecycle actor, guardrails, persistence, status display, before_agent_start injection, b-next injection |
| **b-grill-auto** | `extensions/b-grill-auto/` | Spawns a Pi RPC subprocess for automated plan grilling by a different model |
| **grill-me-dialog** | `extensions/grill-me-dialog.ts` | Document-mode grilling dialog that opens a QA markdown file for the user to edit |
| **tmux-window-status** | `extensions/tmux-window-status.ts` | TMux window status display integration |
| **tps-tracker** | `extensions/tps-tracker.ts` | Tokens-per-second tracking for cost/performance monitoring |

## Workflow Overview

```
/b-research → /b-plan → /b-build → /b-review → /b-save
```

### Basic Flows

| Flow | When to Use |
|------|-------------|
| `/b-brainstorm → /b-plan → /b-build → /b-review → /b-save` | Starting from a vague idea |
| `/b-research → /b-plan → /b-build-hard → /b-review → /b-save` | Complex/risky work |
| `/b-iterate → /b-review` | Quick fix loop |
| `/b-build → /b-review → /b-save` | Ad-hoc work (no planning) |

### Autonomous Flow

For multi-phase work with multiple build/review/iterate cycles, use the autonomous loop:

```
/b-flow start "add auth feature"
/b-flow run --autonomous        # walks through all phases autonomously
/b-flow status                   # check progress any time
```

The loop handles build, review, iterate (as needed), and save transitions automatically. Guardrails block on stagnation, excessive iteration, unattributed source changes, and orphaned workers.

## Subject Folder System

All artifacts are organized in dated subject folders:

```
.context/
├── YYYY-MM-DD.subject-name/
│   ├── brainstorm-*.md               # Initial thinking capture
│   ├── research-*.md                  # Code/architecture exploration
│   ├── plan-*.md                      # Implementation plan (single phase)
│   ├── plan-*-phases.md               # Multi-phase plan with summary table
│   ├── phase-N-*.md                   # Individual phase files
│   ├── spec-*.md                      # Requirements specification
│   ├── iterate-*.md                   # Iteration artifact (from b-review)
│   ├── draft-commit.md                # Commit message draft
│   └── architecture-presentation.html # Generated deep-dive
├── backlog/
│   ├── todo.md                        # Active items (checkboxes → item files)
│   ├── items/<slug>.md                # Individual item definitions
│   └── archive/                       # Completed/deferred items
├── memory/
│   ├── index.md                       # Reverse-chronological catalog
│   └── YYYY-MM-DD.subject-name.md     # Session records
└── workflow/
    └── current-session.json           # Live session state
```

## Cross-Reference System

Artifacts link to each other via frontmatter fields:

- **Research** → `informs: [plan-file.md]`
- **Plan** → `research: [research-file.md]`, `spec: spec-file.md`, `memory: []`
- **Spec** → `plans: [plan-file.md]`, `memory: []`
- **Phase** → `plan: plan-file.md`, `phases_overview: plan-*-phases.md`
- **Iterate** → `addresses: plan-file.md`, `informs: []`
- **Memory** → `subject: YYYY-MM-DD.name`, `artifacts: [files...]`

`/b-save` stitches cross-references automatically.

## Buck Workflow Mode

Buck workflow mode (`/b-mode on`) adds a **planning write guard**: when active, the agent cannot modify files outside the `.context/` directory without explicit confirmation. This prevents accidental implementation changes during planning/research.

```bash
/b-mode on         # Enable planning write guard
/b-mode off        # Disable (normal operation)
/b-mode status     # Show Buck mode + guard state
```

Mode auto-enables when `/b-plan` is invoked and auto-disables after `/b-build`. The status indicator shows `[📋]` or `[🛡️]` in the Pi context bar.

## Requirements

- [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) coding agent
- A `.context/` directory in your project (created automatically on first use)
- Optional: [qmd](https://github.com/qmd-project/qmd) for semantic search over memory files

## License

MIT
