---
description: Switch the omp session into workflow mode — author Python in the eval kernel, fan out via agent() / parallel() / pipeline()
---

> **Harness note:** This command documents the omp `workflow` keyword contract.
> On non-OMP harnesses (Pi, Claude Code, OpenCode, Codex) it is a no-op — the keyword
> does not exist and the persistent eval-kernel does not exist. Skip this command on
> non-OMP sessions; on OMP, edit `.context/<subject>/eval-<topic>.py` and drop the
> `workflow` keyword on the first turn.

# /omp-workflow

You are now in **workflow mode** for this omp session.

omp detected the `workflow` keyword in your prompt and injected a hidden
`workflow-notice` message. From this turn forward, follow the workflow
contract:

- **Author Python in the `eval` tool.** Use the persistent Python kernel
  reachable from `eval`. The kernel keeps state across cells, reads prior
  work, and enforces a per-turn budget.
- **Fan out through `agent()` / `parallel()` / `pipeline()`.** Use these
  helpers, not the `task` tool. The eval kernel can re-enter the agent's
  own tools via `tool.<name>(args)`.
- **Use `agent()` for one-off subagents.** Pass `schema=` to receive a
  parsed JSON object back. Subagents hand back raw data, not summaries.
- **Use `parallel(thunks)` for bounded fan-out.** Pool width =
  `task.maxConcurrency`. A thunk that raises propagates. Bind with a
  default arg (`lambda d=d: ...`) in loops.
- **Use `pipeline(items, *stages)` for staged work.** A barrier runs
  between stages — every item clears stage N before any enters stage N+1.
- **Use `llm(prompt, *, model="default"|"smol"|"slow")` as a judge.**
- **Use `phase(title)` and `log(message)` for status events.** The TUI
  surfaces them.
- **Read `budget.remaining()` and stop before exhausting it.**
  `agent()` refuses to spawn past a hard ceiling set by `+Nk!` or Goal Mode.
  Log anything you drop — no silent caps.

## Buck workflow context

When a plan declares `omp_execution: workflow`, b-plan writes a starter
`eval-<topic>.py` cell into the subject folder. The user edits the cell
before invoking this command, then drops the `workflow` keyword on the
first turn. The cell fans out one `agent()` per phase and feeds results
through `parallel()` for verification.

## Cross-references

- Background: `.context/2026-06-06.omp-integration-buck-workflow/research-omp-integration.md`
- Eval-kernel API: `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/eval/py/prelude.py`
- Decision log: `.context/2026-06-06.omp-integration-buck-workflow/follow-ups.md`
- Cross-platform slash-command pattern: `skills/cross-platform-pi-omp-loading/SKILL.md`
