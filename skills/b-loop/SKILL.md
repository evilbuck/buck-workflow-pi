---
name: b-loop
description: Run unattended Buck phase loops for one named subject in OMP via installed module import using native agent(), judge(), sh(), and workflow_state.
---

# /b-loop: Autonomous Buck Phase Loop Runner (OMP 18.x)

`/b-loop <subject>` runs one named subject's discrete phased Buck workflow plan in Oh My Pi (OMP 18.x). Each phase runs `build -> review -> save -> commit` on a named local Git branch with the `repo-files` store and no `integration_ref`.

## Syntax

```bash
/b-loop <subject>
```

### Arguments

- `<subject>`: Required subject identifier for an existing discrete phased plan (for example `2026-11-17.b-loop-repair`). Automatic subject discovery, unphased plans, and removed control or profile flags (status, resume, stop, profile) are unsupported and rejected before dispatching any stage.

## Invocation Contract

When `/b-loop <subject>` is triggered, OMP resolves the installed `skills/b-loop/scripts/eval-buck-loop.ts` module path, imports it via `import()`, and calls `runBuckLoop` once inside `eval` (`language: "js"`, `timeout: 0`) with `{ args, cwd, bridges }`:

- **Fail-closed bridge check**: `agent`, `wait`, `judge`, `sh`, `phase`, `log`, and `tool.workflow_state` must all be present; the runner never substitutes mock bridges.
- **Pre-flight checks**: verifies a named Git branch with a valid `HEAD` commit (rejecting detached `HEAD` and unborn branches), checks effective storage configuration (`repo-files` only, no `integration_ref`), and pins the ordered discrete phase artifacts via `workflow_state`.
- **Non-OMP harnesses**: standalone Pi and Claude Code do not expose OMP's `eval` bridges; run `/b-build` → `/b-review` → `/b-save` → `/b-commit` manually per phase.
