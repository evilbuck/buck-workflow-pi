---
date: 2026-06-06
domains: [research, buck-workflow, planning, omp, autonomous]
topics: [omp, buck-workflow, goal-mode, orchestrate-keyword, workflow-keyword, magic-keywords, slash-commands, eval-kernel, b-phase, b-plan, autonomous-loops]
related:
  - ../2026-06-01.deprecate-b-flow/plan-deprecate-b-flow.md
  - ../2026-06-05.cross-platform-extension-loading/plan-cross-platform-extension-loading.md
status: completed
priority: medium
subject: 2026-06-06.omp-integration-buck-workflow
artifacts:
  - ../2026-06-06.omp-integration-buck-workflow/research-omp-integration.md
  - ../2026-06-06.omp-integration-buck-workflow/follow-ups.md
  - ../2026-06-06.omp-integration-buck-workflow/index.md
---

# omp × buck-workflow exploration (2026-06-06)

## What I did

Ran `/b-explore` on how buck-workflow can use omp's three autonomous-loop primitives. Read the omp source at `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/` (v15.10.0), the buck-workflow skills and prompts, and the cross-platform loading skill. Wrote three durable artifacts in `.context/2026-06-06.omp-integration-buck-workflow/`.

## Key findings (one-line each)

- **Goal mode** is a user-toggled persistent runtime state, not a magic keyword. Triggered by `/goal set <objective>` (slash command at `src/slash-commands/builtin-registry.ts:97`). State model in `src/goals/state.ts`. Three prompt modes (`active`, `continuation`, `budget-limit`) inject a hardened completion-audit contract on every active turn.
- **`orchestrate` magic keyword** is a hidden `customType: "orchestrate-notice"` injected at `src/session/agent-session.ts:4288-4297`. Source: `src/prompts/system/orchestrate-notice.md`. Switches model into orchestrator contract: parallel `task` subagents, never-yield-between-phases, verify-after-every-phase. Detection: lowercase, prose-only, whitespace-delimited.
- **`workflow` magic keyword** is a hidden `customType: "workflow-notice"` injected at `src/session/agent-session.ts:4298-4307`. Source: `src/prompts/system/workflow-notice.md`. Steers model to author Python in the `eval` tool, fan out via `agent()` / `parallel()` / `pipeline()` with a per-turn budget ceiling. Different from `orchestrate`: eval-cell, not hand-driven `task` batches.
- **omp's `agent-session.ts:4274` guards `if (!options?.synthetic)`** — synthetic / agent-initiated turns never trigger the magic keywords. **The user must say the keyword.** This rules out auto-insertion by b-build.
- **Buck-workflow currently has zero omp integration.** The orchestration story is hand-written prose in b-plan / b-phase / b-build. The b-flow extension (recently deprecated at `.context/2026-06-01.deprecate-b-flow/`) was supposed to fill this gap and was deprecated for being "wired but never invoked."
- **The `prompts/` ↔ `commands/` symlink mirror** is already in place in this repo (verified: 14 symlinks in `commands/` → `prompts/`). Adding new cross-platform slash commands is a one-line-per-command change.

## Decisions / preferences surfaced

- **All integration is prompt-level / skill-level — no new Pi extensions, no new state machines.** Lesson from b-flow: extension-based orchestration that isn't observably invoked is dead weight.
- **Defaults to `omp_execution: none` (omitted).** The new field on `b-phase` phase files is opt-in.
- **b-plan recommends, never auto-sets, the field.** The user confirms.
- **Python over JavaScript** for the `eval` cell template — the workflow-notice examples are in Python.
- **Cross-reference the b-flow deprecation lesson** in every new doc/skill so the next agent doesn't re-introduce the mistake.

## Open decisions for the user

1. Ship F1 (slash-command stubs) first, or bundle with F4-F5?
2. `omp_execution` field — required, recommended, or omitted-by-default? (Recommend: omitted.)
3. `eval` cell language — Python (recommended) or JavaScript?
4. Is F7 (goal-aware `b-review`) in scope for the first integration pass? (Recommend: follow-up.)

## Next step

Run `/b-plan` (or `/b-grill-me` first to settle the open decisions) on the F4 + F5 + F6 bundle. Research is at `.context/2026-06-06.omp-integration-buck-workflow/research-omp-integration.md`; concrete next actions at `.context/2026-06-06.omp-integration-buck-workflow/follow-ups.md`.

## Verification

- All cited omp source files were read in this session; line numbers are stable for omp v15.10.0.
- Cross-checked that no buck-workflow skill currently emits omp keywords (`grep` over `skills/` and `prompts/` confirmed zero matches for `orchestrate` / `workflow` / `goal_mode` / `/goal`).
- The `prompts/` ↔ `commands/` symlink mirror was confirmed working (`ls -la commands/`).
