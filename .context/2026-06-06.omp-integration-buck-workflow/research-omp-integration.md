---
status: active
date: 2026-06-06
subject: 2026-06-06.omp-integration-buck-workflow
topics: [omp, buck-workflow, goal-mode, orchestrate-keyword, workflow-keyword, plan-mode, autonomous, b-phase, b-plan, b-build, magic-keywords, slash-commands, eval]
informs: []
---

# Research: omp Integration with Buck Workflow

## Subject

Make buck-workflow and buck-phase-planning **aware of the omp primitives** so the plan writer can opt into omp's autonomous-loop machinery, and so plan/phase files carry the metadata the agent needs to execute under it.

## What omp is (working definition)

omp = Oh My Pi. A coding-agent CLI distributed as `@oh-my-pi/pi-coding-agent` (npm). On this machine it resolves to `~/.bun/bin/omp` (v15.10.0). It is a fork of Mario Zechner's Pi mono-repo, rewritten as a coding-first surface with bundled subagents, plan mode, eval kernel, LSP, DAP, hindsight/mnemopi memory, and 32 tools. It ships an in-process Rust engine (`@oh-my-pi/pi-natives`) for grep/glob/ast/pty/etc., a Bun-based JS VM, and a persistent Python kernel reachable from the `eval` tool.

omp runs as an interactive TUI, as `omp -p` (one-shot), as `--mode rpc` (NDJSON over stdio), or as `omp acp` (Agent Client Protocol over stdio for editors). Same engine, four wrappers.

## The three primitives that matter for buck-workflow

Buck-workflow cares about three independent mechanisms inside omp. They compose, but they are not the same thing and they are not triggered the same way.

### 1. The `goal` tool (slash command `/goal`, **persistent runtime**)

- **Not a magic keyword** — `/goal` is a registered slash command. It is a **runtime toggle** that survives across turns. There is no prose keyword that turns it on.
- It is documented at `src/slash-commands/builtin-registry.ts:97` and registered as `goal` with subcommands `set`, `show`, `pause`, `resume`, `drop`, `budget`.
- When goal mode is **active**, the `goal` tool is added to the active tool set (`src/tools/index.ts:368-481`) and the `goal-mode-active.md` prompt is injected into every turn. When paused, the tool is still available so the model can `resume` or `drop`.
- The runtime lives at `src/goals/runtime.ts`. State model (`src/goals/state.ts`):
  - `GoalStatus = "active" | "paused" | "budget-limited" | "complete" | "dropped"`
  - `GoalModeState = { enabled, mode, goal: { id, objective, status, tokenBudget, tokensUsed, timeUsedSeconds, ... } }`
  - `GoalToolInput = z.object({ op: "create" | "get" | "complete" | "resume" | "drop", objective?, token_budget? })`
- **Three prompts** steer the model:
  - `goal-mode-active.md` — injected on every active-goal turn. Carries the objective (sanitized), the live budget, and a hard rule: **"before `goal({op:"complete"})`, audit the current repo state against every concrete deliverable."**
  - `goal-continuation.md` — hidden continuation steer (sent on autonomous turn boundaries). Adds the 6-step completion-audit protocol.
  - `goal-budget-limit.md` — fired by `#sendBudgetLimitSteer` when `tokensUsed >= tokenBudget`. Tells the model to wrap up, not start new work, and explicitly **"budget exhaustion is not completion."**
- **Token accounting** (from `goalTokenDelta`, `runtime.ts:87-99`): `max(0, Δinput) + max(0, ΔcacheWrite) + max(0, Δoutput)`. `cacheRead` is excluded because it is reused prefix, not new work. omp deviates from codex here on purpose.
- **Persistence**: goal state is persisted to the session by `GoalRuntimeHost.persist("goal" | "goal_paused" | "none", state)`. Resuming a session restores active/paused state. `replaceGoal` is allowed when an active goal exists; `createGoal` requires no existing goal.
- **Where the goal keyword is detected**: not in the prose matcher. The goal mode is a session-level mode toggled by the user via `/goal set <objective>`. The model doesn't enable it for itself — the user does. **This is a critical difference from `orchestrate`/`workflow` keywords.**

### 2. The `orchestrate` magic keyword (hidden system notice)

- **Magic keyword** — `orchestrate` is a standalone, lowercase, prose-only word. Detection: `keywordInProse(text, /(?<!\S)orchestrate(?!\S)/)` (`src/modes/orchestrate.ts`). The editor highlights matches in a teal→violet gradient.
- **Detection site**: `src/session/agent-session.ts:4288-4297`. On a non-synthetic (real user) prompt, if `containsOrchestrate(expandedText)`, the model receives a hidden `customType: "orchestrate-notice"` message carrying the contents of `src/prompts/system/orchestrate-notice.md`. Synthetic/agent-initiated turns never trigger it.
- The notice is the **orchestrator contract**:
  - "Decompose, dispatch, verify, iterate." Substantial work → `task` subagents. Trivial self-contained edits stay inline.
  - Rule 1: **"Do not yield until everything is closed."** Phase finishing is not a yield point.
  - Rule 2: **"Enumerate the full surface before dispatching."** If a plan/audit/checklist is named, expand it to a flat todo before launching subagents. "Most of them" is failure.
  - Rule 3: **"Parallelize maximally; never launch a one-off task."** One-task batch is failure. Serialize only when one subagent produces a contract (types, schema) the next consumes.
  - Rule 5: Verify after every phase. Never advance on a red gate.
  - Rule 9: **"Subagents do not verify, lint, or format."** Subagents edit only. The orchestrator runs the gates once at the end.
  - Rule 10: **"Right-size the offload."** Don't wrap a one-line config fix in a full subagent.
- **Workload model**: `todo` lists, parallel `task` batches, gates (`bun check`, `bun test`, `lsp diagnostics`), commits per green phase.

### 3. The `workflow` magic keyword (eval-kernel fan-out)

- **Magic keyword** — `workflow` / `workflows` (singular or plural). Detection: `keywordInProse(text, /(?<!\S)workflows?(?!\S)/)` (`src/modes/workflow.ts`). Highlighted in amber→green.
- **Same detection site** (`agent-session.ts:4298-4307`). Hidden `customType: "workflow-notice"` message carries `src/prompts/system/workflow-notice.md`.
- The notice steers the model to **author Python in the `eval` tool and fan out subagents** through the `agent()`/`parallel()`/`pipeline()`/`llm()` helpers — not through the `task` tool.
- **Why this is different from `orchestrate`**: orchestrate is a hand-driven multi-phase plan, dispatched as ordinary `task` subagents. workflow is a **single Python cell** that calls `agent()`/`parallel()`/`pipeline()` inside the persistent eval kernel, where the agent can read its own prior work, the kernel keeps state, and the budget is enforced per turn.
- **eval-kernel API** (from `src/eval/py/prelude.py`):
  - `agent(prompt, *, agent_type="task", model=None, context=None, label=None, schema=None)` — runs ONE subagent. With `schema=`, returns a parsed JSON object. Subagents "hand back raw data" — they don't summarize.
  - `parallel(thunks)` — zero-arg callables through a bounded pool. Pool width = `task.maxConcurrency`. Thunk that raises propagates. Bind with default arg (`lambda d=d: …`) in loops.
  - `pipeline(items, *stages)` — one-arg callables. **Barrier between stages** — all items clear stage N before any enters N+1.
  - `llm(prompt, *, model="default", system=None, schema=None)` — oneshot, stateless LLM call. Tiers: `"smol"`, `"default"`, `"slow"`. Use it as a judge.
  - `phase(title)` / `log(message)` — emit status events for the TUI.
  - `budget` — object with `.total`, `.spent()`, `.remaining()`. `+Nk!` or Goal Mode sets a hard ceiling; `agent()` refuses to spawn past it. `+Nk` is advisory.
  - `display(value)`, `read(path, offset, limit)`, `write(path, content)`, `tool.<name>(args)` — full re-entry into the agent's own tools.
- **Patterns the workflow-notice surfaces**:
  - Adversarial verify — N refuters, keep when majority survives.
  - Perspective-diverse verify — verifiers with distinct lenses.
  - Judge panel — N attempts scored in parallel.
  - Loop-until-dry — keep spawning finders until K rounds surface nothing new.
  - Multi-modal sweep — parallel finders each searching differently.
  - Completeness critic — final agent that asks "what's missing?"
  - Budget/count loops — `while budget.remaining() > 50_000: …`.
  - **No silent caps** — log what you dropped.

## How they compose

- **Goal mode is orthogonal.** A goal-mode session can use either keyword inside any turn. Goal mode just provides the persistent objective and a hardened "audit-before-complete" protocol.
- **Orchestrate uses `task`; workflow uses `eval`'s `agent()`.** Same subagents under the hood (`agent_type="task"`), but the dispatch surface is different. The eval kernel can call into the same subagents but from inside a Python program with barriers, state, and a budget ceiling.
- **Plan mode** is yet a fourth mechanism. It is read-only, produces a plan at `{{planFilePath}}`, then `resolve(apply, …)` triggers user approval and a fresh execution context. It does not conflict with the keywords but it isn't a substitute for them — plan mode is for **design**, the keywords are for **execution**.

## Buck-workflow current state

Reviewed skills at `skills/b-*/SKILL.md` and prompt files at `prompts/b-*.md`. **No skill currently emits omp keywords, slash commands, or eval-kernel cells.** The orchestration story is hand-written prose ("use `task` subagents", "make a todo list"). The Ralph loop integration is at the prompt level — b-save writes durable state between Ralph iterations, and the phase files carry the `ralph_complexity` hint.

The most relevant existing structure is `b-phase`'s `phase-N-<slug>.md` files, which already carry:

```yaml
ralph_complexity: single | multi
goal: "<one sentence>"
```

This is the natural place to add a new field — e.g. `omp_execution: { mode: orchestrate | workflow | goal | none, eval_cell?: string, token_budget?: number }` — but the field is currently unused by the runtime; it's a human-readable hint.

## Where buck-workflow could integrate

Five integration surfaces, ranked by payoff per byte of change.

### Surface A: Phase plan emits an `orchestrate` or `workflow` directive

When `b-phase` writes `plan-*-phases.md`, it can stamp the plan with one of three omp execution modes:

| Mode | When | What the plan file declares |
|---|---|---|
| `none` (default) | Single phase, low risk, ~one session of work | Nothing — standard `b-build` flow |
| `orchestrate` | Multi-phase plan, 3+ files, the orchestrator can use `task` batches between phases | "Use the `orchestrate` keyword on first turn of each phase" |
| `workflow` | Cross-cutting review / audit / migration that benefits from `eval`-cell fan-out with a budget ceiling | "Author a Python `eval` cell that fans out `agent()` calls per phase" |
| `goal` | The whole plan = one persistent objective the model must keep working on | "Start a `/goal` session: objective = <verbatim plan User Goal> with `token_budget: N`" |

The phase file frontmatter gets a new optional field. b-build reads it and prepends the keyword to its first prompt of the phase (or `/goal set` for goal mode). Goal-mode state is **session-scoped**, so this only makes sense inside an interactive omp session — RPC and `-p` don't carry it across turns.

### Surface B: `b-plan` writes an `eval` cell template for review/audit plans

When a plan is `format: review` or contains the phrase "review", "audit", "sweep", `b-plan` can write a starter `eval` cell to `.context/<subject>/eval-<topic>.py` that the model runs inside the workflow contract. The cell calls `agent()` per dimension and feeds the results through `parallel()` for verification. This is the workflow-keyword use case made concrete.

### Surface C: Goal-mode-aware completion audit in `b-review` and `b-save`

Both already produce completion evidence (b-review's completion matrix, b-save's memory + plan/spec status update). Goal mode's `goal-continuation.md` already specifies a 6-step audit:

1. Restate objective as concrete deliverables.
2. Map each deliverable to evidence.
3. Inspect the actual current state.
4. Match verification scope to claim scope.
5. Treat uncertainty as not-yet-achieved.
6. Budget exhaustion is not completion.

This is a stronger contract than what `b-review` does today (the matrix is the per-step evidence; the audit is a one-time pass). The plan/spec/phase artifacts already carry `acceptance_criteria` checkboxes that map to step 1 and 2 — `b-review` could be upgraded to mirror the goal-audit protocol explicitly: every unchecked box must produce direct current-state evidence or be flagged as partial/missing.

### Surface D: `b-phase` decision-domains map to `workflow` fan-out

`b-grill*` skills already produce `decision_domains` in their session files. `b-phase` reads them and uses them as starting phase boundaries. A new optional path: when the grill session produced `boundary_assessment: boundaries_found` and a `workflow` execution mode is selected, the plan can include an `eval` cell that fans one `agent()` per decision domain, returning structured findings, then a synthesis stage that adjudicates them.

### Surface E: Slash-command mirror file

The project already has a `cross-platform-pi-omp-loading` skill that documents the slash-command mirror pattern. `commands/` is the OMP/Claude-Code/OpenCode/Codex directory; `prompts/` is the Pi prompt-templates directory. **The cleanest integration**: add a `commands/omp-orchestrate.md`, `commands/omp-workflow.md`, `commands/omp-goal.md` that just say "use the omp primitive; here's the prompt template." No code in the buck-workflow repo runs these — they're invokable from omp/Claude Code/etc. as native slash commands. Combined with the existing `/b-*` commands, this gives the agent a uniform surface.

## Risks and unknowns

1. **Magic keywords are user-only.** omp's `agent-session.ts:4274` guards `if (!options?.synthetic)` — synthetic/agent-initiated prompts never trigger the notices. This means **b-build cannot auto-insert the keyword on its first turn**; only the user can. The phase file should phrase it as a *recommendation* to the user, not as code the agent runs.
2. **Goal mode is also user-toggled.** `/goal set` is a slash command the user runs. The plan can *recommend* it, but cannot enable it for the user. This is consistent with the b-flow deprecation lesson — buck-workflow should suggest, not control, the runtime mode.
3. **Eval cells are interactive-TUI-only in practice.** `--mode rpc` and `omp -p` don't have a user-facing eval kernel. The `workflow` keyword is meaningless outside the interactive surface.
4. **The orchestrator's "do not yield between phases" contract** is at odds with the buck-workflow default of one-session-per-phase. A phased plan that wants to use `orchestrate` needs each phase to be the unit of "do not yield until phase done," not the whole plan. The phase file's `ralph_complexity: multi` already encodes this; the new `omp_execution: orchestrate` field can carry the per-phase contract.
5. **Per-turn budget vs plan-wide budget.** Goal mode's `token_budget` is per-goal, not per-phase. A plan with 5 phases and `goal` execution mode means the user sets a single budget for the whole plan. Phases compete for the same budget. This needs to be documented in the b-plan output, not hidden.
6. **Backward compatibility.** Every b-* skill, prompt, and phase file predates this integration. Default to `omp_execution: none` (or omit the field entirely) and make integration opt-in.
7. **The `b-flow` extension was deprecated for being "wired but never invoked"** (see `.context/2026-06-01.deprecate-b-flow/`). This integration must not repeat that mistake — every recommended primitive should be **observably reachable by the user in a normal omp session**, not buried in a config that requires the user to discover it.

## Open questions

1. Should `b-plan` auto-recommend an `omp_execution` mode based on plan size/shape, or should it always ask the user? (The current `b-plan` always asks for the user goal — same pattern.)
2. Should the `eval` cell be a deliverable artifact (a real `.py` file) or a hint (a code block in the plan)? Artifact is more verifiable; hint is more flexible.
3. Does `b-review` need a `goal-mode-aware` flag, or is the current completion matrix enough?
4. The `cross-platform-pi-omp-loading` skill is mostly about the slash-command mirror. Should the new `omp-*.md` command files live in `commands/` only, or also get a `prompts/` Pi-native variant for parity?

## Verification

- The research itself does not need verification — it is observation of installed source.
- Future work that depends on this research: read the omp source files cited; the line numbers are stable for omp v15.10.0.
- Future integration: the most useful first step is a `commands/omp-orchestrate.md` slash-command stub (Surface E), because it costs almost nothing and is the easiest to test from the interactive TUI.
