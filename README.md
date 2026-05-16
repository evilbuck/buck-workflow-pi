# Buck Workflow for Pi

A structured, discoverable workflow for AI-assisted software development with durable context management.

## Philosophy

The Buck workflow is built on one principle: **don't lose work**. It separates **intent** (plans in subject folders) from **record** (history in memory), creating a durable paper trail that survives chat context limits.

## Install

```bash
pi install /path/to/buck-workflow
# or from git:
pi install git:github.com/buckleyrobinson/buck-workflow-pi
```

## What's Included

### Layered Architecture

Buck workflow uses a three-layer model for portability across agents:

1. **Canonical skills** (`skills/`) — Portable workflow logic. These are the reusable, agent-neutral instruction sets that define *how* each workflow behaves. They are the source of truth.
2. **Thin wrappers** (`prompts/`) — Agent-native invocation surface. Pi prompt templates provide the familiar `/b-*` commands, but each one is now a thin wrapper that loads the matching skill. Other agents (Claude Code, OpenCode, Codex) can use their own command/skill mechanisms to invoke the same canonical logic.
3. **Runtime automation** (`extensions/`) — Session tracking, state orchestration, and event-driven behavior that needs hooks and persistence. This is not portable as static instructions and stays in extensions.

**Pi-native mapping:**

- **Most `/b-*` commands** → **prompt templates** in `prompts/` that invoke **skills** in `skills/`
- **Session/runtime automation** (`/b-save`) → **extension** in `extensions/index.ts`

### Prompt Templates (`/b-*` commands)

Type `/b-` in pi to see the Buck workflow prompt-template commands. Each is a thin wrapper that invokes the matching skill:

| Command | Skill Invoked | Purpose |
|---------|---------------|---------|
| `/b-brainstorm` | `b-brainstorm` | Interview-style intake, capture initial thinking |
| `/b-research` | `b-research` | Explore code, trace architecture, capture findings |
| `/b-plan` | `b-plan` | Create bounded implementation plan with scope and risks |
| `/b-present` | `b-present` | Generate async-readable presentation package |
| `/b-build` | `b-build` (standard mode) | Standard implementation — smallest safe code change |
| `/b-build-hard` | `b-build` (hard mode) | Complex, ambiguous, or higher-risk implementation |
| `/b-iterate` | `b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `/b-review` | `b-review` | Review implementation for correctness and regressions |
| `/git-commit` | `git-commit` | Create a Conventional Commits message and commit |

### Extension Command

| Command | Purpose |
|---------|---------|
| `/b-save` | Record session history to `.context/memory/`, update workflow state, and trigger follow-up save orchestration |

### Skills

| Skill | Purpose |
|-------|---------|
| `b-brainstorm` | Interview-style intake — capture initial thinking and save a draft |
| `b-research` | Explore unfamiliar code, trace architecture, capture findings |
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

### Extension (Session Tracking)

The extension automatically:
- **Tracks** which `/b-*` commands you've used this session
- **Tracks** files modified during implementation
- **Warns** when implementation work is unsaved (reminds you to `/b-save`)
- **Injects** session state into compaction context so summaries preserve workflow state
- **Bootstraps** `.context/workflow/current-session.json` on session start
- **Registers** `/b-save` as a real Pi extension command

## Workflow Overview

```
/b-research → /b-plan → /b-build → /b-review → /b-save
```

### Variations

| Flow | When to Use |
|------|-------------|
| `/b-brainstorm → /b-plan → /b-build → /b-review → /b-save` | Starting from a vague idea |
| `/b-research → /b-plan → /b-build-hard → /b-review → /b-save` | Complex/risky work |
| `/b-iterate → /b-review` | Quick fix loop |
| `/b-build → /b-review → /b-save` | Ad-hoc work (no planning) |

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

## Cross-Reference System

Artifacts link to each other via frontmatter fields:

- **Research** → `informs: [plan-file.md]`
- **Plan** → `research: [research-file.md]`, `spec: spec-file.md`, `memory: []`
- **Spec** → `plans: [plan-file.md]`, `memory: []`
- **Memory** → `subject: YYYY-MM-DD.name`, `artifacts: [files...]`

`/b-save` stitches cross-references automatically.

## Requirements

- [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) coding agent
- A `.context/` directory in your project (created automatically on first use)
- Optional: [qmd](https://github.com/qmd-project/qmd) for semantic search over memory files

## License

MIT
