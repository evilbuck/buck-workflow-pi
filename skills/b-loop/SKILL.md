---
name: b-loop
description: Run unattended Buck phase loops in OMP via hot-reloadable TypeScript eval runner (%load skills/b-loop/scripts/eval-buck-loop.ts) using native agent() and judge().
---

# /b-loop: Autonomous Buck Phase Loop Runner (OMP 18.x)

`/b-loop` runs multi-phase Buck workflow plans to completion autonomously within Oh My Pi (OMP 18.x). It replaces the legacy background node-worker extension with a hot-reloadable TypeScript script (`skills/b-loop/scripts/eval-buck-loop.ts`) executed in OMP's Bun `eval` kernel (`language: "js"`) via `%load`.

## Prerequisites

- **Harness**: Oh My Pi (`omp` v18.21+) with the `eval` tool enabled.
- **Eval kernel**: Bun JavaScript/TypeScript backend (`language: "js"`).
- **Subagent routing**: `extensions/interactive-model-switch.ts` intercepts subagent spawns via `before_subagent_spawn` to route models per `/buck-models` stage profiles.

> [!NOTE]
> Non-OMP harnesses (such as standalone Pi or Claude Code) do not feature OMP's built-in `eval` worker and native `judge()` host bridges. On non-OMP harnesses, execute each phase step sequentially using standard Buck workflow commands: `/b-build` → `/b-review` → `/b-save` → `/b-commit`.

## Syntax

```bash
/b-loop [target] [--status | --resume | --stop]
```

### Arguments

- `[target]`: Optional path to a specific subject directory (e.g. `.context/2026-11-16.feature/`), plan overview (`plan-*-phases.md`), or phase file (`phase-1-*.md`). If omitted, `/b-loop` automatically discovers the active subject and earliest incomplete phase in `.context/`.
- `--status`: Inspect the status of the current or last loop run recorded in `.context/workflow/buck-loop.json` without modifying state.
- `--resume`: Resume an interrupted or stopped loop from the saved `.context/workflow/buck-loop.json` snapshot. Resume restarts the recorded phase at build and keeps the saved loop count. A snapshot whose state is already `done` is reported and not rebuilt. With no snapshot, the runner starts at the first incomplete phase.
- `--stop`: Safely abort the running loop and checkpoint its state in `.context/workflow/buck-loop.json`.

## Architecture & Flow

When `/b-loop` is triggered, the outer agent assigns arguments to `globalThis.BUCK_LOOP_ARGS` and loads the runner via `eval`:

```javascript
eval({
  language: "js",
  code: "%load skills/b-loop/scripts/eval-buck-loop.ts",
  timeout: 0
});
```

The runner:
1. **Discovers**: Scans `.context/` for active plans and phase files, loading frontmatter and acceptance criteria with zero bare npm specifiers.
2. **Orchestrates**: Runs the phase cycle in this script. `extensions/buck-loop/` remains on disk and is not wired from `extensions/index.ts`; this runner does not call `machine.ts`.
   - **Build**: Dispatches `agent(prompt, { agent: "task", label: "b-build-<phase>" })` (or `b-build-hard` for hard phases) and verifies acceptance criteria via `judge()`. A `bool: false` or `ok: false` verdict blocks save and commit.
   - **Review**: Dispatches `agent(prompt, { agent: "task", label: "b-review-<phase>" })`. If findings are generated, ranks them via `judgeBatch()` and iterates via `b-iterate`.
   - **Save**: Dispatches `agent(prompt, { agent: "task", label: "b-save-<phase>" })` to persist session memory and metadata.
   - **Commit**: Stages `.context/` and phase `files:`, runs `b-commit`, and verifies git status baseline.
3. **Closes**: When all phases are complete, executes `subject-lifecycle.ts close-verified` to close the subject.
