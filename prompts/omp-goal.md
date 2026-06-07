---
description: Reminder of the goal-mode runtime — persistent objective, budget, and audit-before-complete protocol
---

> **Harness note:** This command documents the omp `/goal set` slash command.
> On non-OMP harnesses (Pi, Claude Code, OpenCode, Codex) it is a no-op — the
> `/goal` slash command does not exist in omp's namespace here. (Note: on Claude
> Code, `/goal` is a different namespace entirely.) Skip this command on non-OMP
> sessions; on OMP, run `/goal set <objective>` to enter goal mode.

# /omp-goal

This is a documentation stub, not a toggle. Goal mode is **user-toggled
runtime state**, not a magic keyword. To enter goal mode, the user runs:

```
/goal set <objective>
```

The `/goal` slash command is a runtime toggle that survives across turns.
It is registered in omp at `src/slash-commands/builtin-registry.ts:97`
with subcommands `set`, `show`, `pause`, `resume`, `drop`, `budget`.

## What goal mode does

- Adds the `goal` tool to the active tool set
  (`src/tools/index.ts:368-481`).
- Injects `goal-mode-active.md` into every active-goal turn.
- Persists goal state to the session — `active`, `paused`, `budget-limited`,
  `complete`, or `dropped` (`src/goals/state.ts`).
- Enforces a token+time budget per goal. `cacheRead` is excluded from
  token accounting (`goalTokenDelta` in `src/goals/runtime.ts:87-99`).
- Fires `goal-budget-limit.md` when the budget is exhausted. The steer
  says "wrap up, do not start new work; **budget exhaustion is not
  completion**."

## The 6-step completion-audit protocol

Injected on autonomous turn boundaries via `goal-continuation.md`:

1. **Restate the objective as concrete deliverables.** Pull from the
   active plan/phase file's `acceptance_criteria`.
2. **Map each deliverable to evidence.** Cite file paths, line numbers,
   or test names.
3. **Inspect the actual current state.** Read the code, run the tests,
   do not trust checkboxes.
4. **Match verification scope to claim scope.** What you can run is what
   counts.
5. **Treat uncertainty as not-yet-achieved.** "Looks right" is not
   evidence.
6. **Budget exhaustion is not completion.** If the budget ran out,
   surface what is missing.

Before `goal({op: "complete"})` succeeds, every unchecked acceptance
criterion must produce direct current-state evidence or be flagged as
partial/missing.

## Buck workflow context

When a plan declares `omp_execution: goal`, b-plan recommends the user
start a goal-mode session with the plan's User Goal as the objective.
The optional `omp_goal_budget: <tokens>` companion field in the plan or
phase frontmatter documents the suggested budget. **The user must run
`/goal set` themselves** — the plan can recommend, not enable.

## Cross-references

- Background: `.context/2026-06-06.omp-integration-buck-workflow/research-omp-integration.md`
- Goal runtime: `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/goals/runtime.ts`
- Goal prompts: `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/prompts/goals/`
- Decision log: `.context/2026-06-06.omp-integration-buck-workflow/follow-ups.md`
- Cross-platform slash-command pattern: `skills/cross-platform-pi-omp-loading/SKILL.md`
