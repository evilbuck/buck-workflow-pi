---
status: active
date: 2026-06-06
subject: 2026-06-06.omp-integration-buck-workflow
topics: [omp, buck-workflow, goal-mode, orchestrate-keyword, workflow-keyword, plan-mode, autonomous, b-phase, b-plan, b-build, magic-keywords, slash-commands, eval, slash-command-mirror, cross-harness, compat, b-grill, eval-kernel]
informs: []
artifacts:
  - research-omp-integration.md
  - follow-ups.md
  - plan-cross-harness-kernel.md
  - plan-cross-harness-kernel-phases.md
  - phase-1-cross-harness-compat.md
  - phase-2-kernel-contract-doc.md
  - phase-3-eval-kernel-examples.md
  - phase-4-b-grill-integration.md
  - docs/eval-kernel.md
  - eval-review-audit.py
  - eval-migration-sweep.py
---

# omp integration with buck-workflow

## Goal

Make buck-workflow and buck-phase-planning **aware of the omp primitives** so the plan writer can opt into omp's autonomous-loop machinery, and so plan/phase files carry the metadata the agent needs to execute under it.

## What omp is (one-line)
A coding-agent CLI for the terminal. Locally installed: `~/.bun/bin/omp` v15.10.0. Source under `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/`. Same engine exposed as interactive TUI, `omp -p` (one-shot), `omp --mode rpc` (NDJSON over stdio), and `omp acp` (Agent Client Protocol for editors).

## The three primitives that matter for buck-workflow

| Primitive | Triggered by | Surface | Effect |
|---|---|---|---|
| **Goal mode** | `/goal set <objective>` (slash command) — user toggles | Persistent runtime state across turns | Adds `goal` tool; injects `goal-mode-active.md`; enforces completion audit; tracks token+time budget |
| **`orchestrate` keyword** | `orchestrate` as standalone lowercase prose word | Hidden `customType: "orchestrate-notice"` message | Switches model into orchestrator contract: parallel `task` subagents, no-yield-between-phases, verify-after-every-phase |
| **`workflow` keyword** | `workflow` / `workflows` as standalone lowercase prose word | Hidden `customType: "workflow-notice"` message | Steers model to author Python in the `eval` tool, fan out via `agent()` / `parallel()` / `pipeline()` with a per-turn budget |

**Two key facts:**
1. Goal mode is **user-toggled, persistent** — not a magic keyword. `/goal set` is the entry point; the model does not enable it for itself.
2. The magic keywords are **user-only**: omp guards `if (!options?.synthetic)` in `agent-session.ts:4274`. Synthetic / agent-initiated turns never trigger the notices. The user must say the keyword.

## Discovery summary

Reviewed omp source at the path above, the buck-workflow skills (`skills/b-*/SKILL.md`), and the prompt files (`prompts/b-*.md` and the symlink-mirrored `commands/*.md`). **No buck-workflow skill currently emits omp keywords, slash commands, or eval-kernel cells.** The orchestration story is hand-written prose.

The b-flow extension was recently **deprecated** for being "wired but never invoked" (`.context/2026-06-01.deprecate-b-flow/`). This integration deliberately stays prompt-level / skill-level — no new Pi extensions, no new state machines.

## Key files in omp (v15.10.0)

| Concern | Path (relative to `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/`) |
|---|---|
| System prompt template | `system-prompt.ts`, `prompts/system/system-prompt.md` |
| Orchestrate notice | `prompts/system/orchestrate-notice.md`, `modes/orchestrate.ts` |
| Workflow notice | `prompts/system/workflow-notice.md`, `modes/workflow.ts` |
| Goal runtime | `goals/runtime.ts`, `goals/state.ts` |
| Goal tool | `goals/tools/goal-tool.ts` |
| Goal prompts | `prompts/goals/goal-mode-active.md`, `goal-continuation.md`, `goal-budget-limit.md` |
| Goal tool description | `prompts/tools/goal.md` |
| `/goal` slash command | `slash-commands/builtin-registry.ts:97` |
| Magic-keyword detection | `session/agent-session.ts:4288-4307` |
| Magic-keyword highlighter | `modes/magic-keywords.ts` |
| Eager-todo prelude | `prompts/system/eager-todo.md` |
| Plan-mode prompts | `prompts/system/plan-mode-active.md`, `plan-mode-approved.md` |
| Eval-kernel Python API | `eval/py/prelude.py` |

## Integration surfaces (ranked by payoff per byte)

1. **F1** — Add three cross-platform slash-command stubs (`/omp-orchestrate`, `/omp-workflow`, `/omp-goal`). Pure observation, zero risk.
2. **F4** — New `omp_execution` field on `b-phase` phase files (`none | orchestrate | workflow | goal`).
3. **F5** — `b-plan` recommends the field based on plan shape.
4. **F6** — `b-plan` writes a starter `eval` cell template for `workflow` plans.
5. **F7** — `b-review` adopts the goal-mode 6-step completion-audit protocol.
6. **F2 / F3** — Doc updates in `docs/buck-workflow.md` and `AGENTS.md`.

Full detail and risk analysis in `research-omp-integration.md`. Concrete next actions and user decisions in `follow-ups.md`.

All four open questions from the original exploration are now **resolved** by the F1–F7 build: F1 stubs ship independently; `omp_execution` is omitted by default; the eval cell defaults to Python; F7 (the goal-mode audit) shipped in the same pass.

## Status

**F1–F7 build complete (2026-06-06).** Slash-command stubs, docs, AGENTS
cross-ref, `omp_execution` frontmatter field, `b-plan` recommendation
rules, eval cell template, and `b-review` 6-step audit are all in
place. Tests: 163/163 passing.

**Phased follow-up plan ready (2026-06-07).** The cross-harness kernel
work is captured in `plan-cross-harness-kernel.md` and broken into four
discrete phases:

1. Cross-harness compat (foundation, easy) — header guards + runtime probe
2. Kernel contract doc (medium) — `docs/eval-kernel.md`
3. Real kernel usage examples (medium) — two example cells in this folder
4. `b-grill*` integration with the cell (hard) — auto-derive `PHASES`
   from `decision_domains`

Plan-level OMP Execution Recommendation: **`orchestrate`** (4 phases,
hard sequential deps). On non-OMP harnesses, Phase 1's top-row guard
returns `none` and the Ralph cycle runs without an opt-in keyword.

Durable artifacts in this folder:

- `research-omp-integration.md` (16.9 KB) — full source-verified analysis.
- `follow-ups.md` (6.3 KB) — concrete next actions with "do not" list.
- `plan-cross-harness-kernel.md` (21.7 KB) — the phased plan.
- `plan-cross-harness-kernel-phases.md` — phased-plan index.
- `phase-{1,2,3,4}-*.md` — discrete phase files (4 × ~10–19 KB).

## Recommended next step

Run `/b-build` against `phase-1-cross-harness-compat.md` (the
foundation phase). Once Phase 1 lands and tests stay green, queue
Phase 2, then Phase 3, then Phase 4. Backlog items already created
under `.context/backlog/items/phase-{1,2,3,4}-*.md` with
Phase 1 in the active todo queue.

If running under omp with the plan-level `orchestrate` opt-in: type
the `orchestrate` keyword on the first turn of Phase 1 — the orchestrator contract (parallel `task` subagents, no-yield between
phases, verify-after-every-phase) carries through the full run.