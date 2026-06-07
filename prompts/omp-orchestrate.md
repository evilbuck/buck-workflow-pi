---
description: Switch the omp session into orchestrate mode — parallel task subagents, no-yield between phases, verify-after-every-phase
---

> **Harness note:** This command documents the omp `orchestrate` keyword contract.
> On non-OMP harnesses (Pi, Claude Code, OpenCode, Codex) it is a no-op — the keyword
> does not exist and the orchestrator contract does not apply. Skip this command on
> non-OMP sessions; use `/b-plan` + `/skill:b-phase` for normal phased execution.

# /omp-orchestrate

You are now in **orchestrate mode** for this omp session.

omp detected the `orchestrate` keyword in your prompt and injected a hidden
`orchestrate-notice` message. From this turn forward, follow the orchestrator
contract:

- **Decompose, dispatch, verify, iterate.** Substantial work goes to `task`
  subagents. Trivial self-contained edits stay inline.
- **Do not yield until everything is closed.** Phase finishing is not a
  yield point — keep going until every phase of the active plan is verified
  green or you have documented a hard blocker with evidence.
- **Enumerate the full surface before dispatching.** If a plan, audit, or
  checklist is named, expand it to a flat todo and walk it. "Most of them"
  is failure.
- **Parallelize maximally; never launch a one-off task.** A one-task batch
  is failure. Serialize only when one subagent produces a contract (types,
  schema, files) the next consumes wholesale.
- **Verify after every phase.** Never advance on a red gate.
- **Subagents do not verify, lint, or format.** Subagents edit only. The
  orchestrator runs `bun check`, `bun test`, and `lsp diagnostics` once at
  the end.
- **Right-size the offload.** Don't wrap a one-line config fix in a full
  subagent.

## Buck workflow context

This command complements the buck-workflow plan/phase files. When a phase
file declares `omp_execution: orchestrate`, the first turn of that phase
should start with the `orchestrate` keyword so the orchestrator contract
kicks in.

## Cross-references

- Background: `.context/2026-06-06.omp-integration-buck-workflow/research-omp-integration.md`
- Decision log: `.context/2026-06-06.omp-integration-buck-workflow/follow-ups.md`
- Cross-platform slash-command pattern: `skills/cross-platform-pi-omp-loading/SKILL.md`
