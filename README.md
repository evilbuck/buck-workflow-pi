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

### Pi-native mapping

This package maps Buck workflow concepts onto Pi primitives like this:

- **Most `/b-*` commands** → **prompt templates** in `prompts/`
- **Reusable helpers** → **skills** in `skills/`
- **Session/runtime automation** → **extension** in `extensions/index.ts`
- **Special case: `/b-save`** → **extension-registered command**, not a prompt template

So while the user experience is a unified `/b-*` command surface, Pi is implementing that surface with multiple package primitives.

### Prompt Templates (`/b-*` commands)

Type `/b-` in pi to see the Buck workflow prompt-template commands:

| Command | Purpose |
|---------|---------|
| `/b-brainstorm` | Interview-style intake, capture initial thinking |
| `/b-research` | Explore code, trace architecture, capture findings |
| `/b-plan` | Create bounded implementation plan with scope and risks |
| `/b-present` | Generate async-readable presentation package from plan/phase/brainstorm/spec |
| `/b-build` | Standard implementation — smallest safe code change |
| `/b-build-hard` | Complex, ambiguous, or higher-risk implementation |
| `/b-iterate` | Quick follow-up fixes, polish, review-loop edits |
| `/b-review` | Review implementation for correctness and regressions |

### Extension Command

| Command | Purpose |
|---------|---------|
| `/b-save` | Record session history to `.context/memory/`, update workflow state, and trigger follow-up save orchestration |

### Skills

| Skill | Purpose |
|-------|---------|
| `spec-progress` | Show progress of in-flight specs as a markdown table |

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
