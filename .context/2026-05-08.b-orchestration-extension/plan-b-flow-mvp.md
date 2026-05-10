---
status: active
date: 2026-05-08
subject: 2026-05-08.b-orchestration-extension
topics: [buck-workflow, pi-extension, orchestration, state-machine, b-flow]
research: [research-xstate-for-b-flow.md]
spec: spec-b-flow-state-machine.md
memory: [b-orchestration-extension-2026-05-08.md, b-flow-mvp-2026-05-09.md, b-flow-start-debug-2026-05-09.md, b-flow-unit-tests-2026-05-09.md]
---

# Plan: Buck Workflow Orchestration MVP

## Goal

Define and later implement a Pi extension that supervises the Buck workflow as a durable, user-confirmed state machine.

## Context used / assumptions

- Brainstorm source: `docs/brainstorms/b-orchestration-extension.md`
- Existing extension surfaces:
  - `extensions/index.ts` tracks `/b-*` usage, plan mode, file modifications, model hints, and `/b-save`.
  - `extensions/b-grill-auto/` shows `pi.sendUserMessage(...)` loop orchestration and status UI.
  - Pi extension docs support commands, events, status widgets, compaction hooks, custom session entries, and `sendUserMessage`.
- Assumption: MVP should be guided at first, but the target architecture is an autonomous durable loop.
- Assumption: existing Buck prompts/skills remain the workflow semantics; orchestration supervises transitions.
- New requirement: once work is decomposed into phase/task chunks, execution should happen in an isolated subagent outside the main Pi context.
- Research result: XState v5 is a strong fit for the supervisor engine because it provides guarded transitions, invoked actors, `onDone`/`onError`, typed context/events, and persisted snapshots.

## Scope

- Add a new orchestration concept around `/b-flow`.
- Persist workflow state to `.context/workflow/orchestration.json`.
- Support the core implementation loop first:
  - `plan → phase? → build chunks → review → save → done`
- Use external subagent workers for chunk execution once phase/task files exist.
- Keep the main Pi session as a supervisor/control plane with minimal summaries.
- Require confirmation before mutating/build/save transitions unless explicit autonomous mode is selected.

## Out of scope for MVP

- Full `b-grill-me` integration.
- Full `b-research` integration.
- Automatic classifier model for transition decisions.
- Parallel worker pools; MVP should run one subagent worker at a time.
- Removing `b-build-hard` or `b-iterate` commands immediately.

## Affected files for future implementation

- `extensions/index.ts` or new `extensions/b-flow/` module — command registration and state machine.
- `.context/workflow/orchestration.json` — runtime state output.
- `docs/brainstorms/b-orchestration-extension.md` — design record.
- `README.md` / `docs/buck-workflow.md` — documentation after implementation.

## Proposed implementation steps

1. Add `xstate` as a runtime dependency if implementation proceeds.
2. Extract orchestration into `extensions/b-flow/` rather than growing `extensions/index.ts`.
3. Define `BuckState`, XState machine context/events, `OrchestrationState` projection, queue item types, and route action types.
4. Implement persistence for both `.context/workflow/orchestration.json` and `.context/workflow/orchestration.snapshot.json`.
5. Register `/b-flow` command with `start`, `run`, `continue`, `status`, `pause`, `resume`, `jump`, and `stop`.
6. Implement invoked actor `scanContext` for latest plan, phases overview, active phase, `tasks.md`, backlog item, iterate artifact, memory file, git diff, and worker results.
7. Implement pure XState guards over the scanned context; keep async/model checks out of guards.
8. Implement invoked actor `evaluateModelGuard` only for ambiguous semantic routing.
9. Implement queue builder for decomposed chunks: phase files first, then iterate/tasks/backlog.
10. Implement invoked actor `runWorker` for one external subagent chunk at a time.
11. Require each worker to write `.context/<subject>/worker-results/<timestamp>-<state>-<slug>.md`.
12. Implement invoked actor `verifyResult` to parse worker result file and update queue/projection state.
13. Implement confirmation UI before mutating transitions unless autonomous policy allows.
14. Add footer status and compaction context injection.
15. Add tests for XState transitions, guard routing, queue selection, worker-result parsing, snapshot restore, and stale-worker recovery.

## Verification

- `/b-flow start <goal>` creates `.context/workflow/orchestration.json`.
- `/b-flow status` shows current state and pending next action.
- `/b-flow run` starts an XState actor loop and advances via `/b-flow continue --from-extension` events.
- Once phase/task files exist, `/b-flow` spawns an isolated worker for one chunk.
- Worker writes a result file; supervisor reads only the summary/result, not the whole transcript.
- XState snapshot and human-readable projection survive `/reload` or session resume.
- Review-fix loop stops after configured max loops.
- Existing `/b-*` commands still work without orchestration enabled.

## Risks

- Recursive command injection if extension-generated `/b-*` input is reinterpreted incorrectly.
- Worker subprocess failures may leave queue items `running`; startup should detect stale workers and recover/block.
- Over-automation could surprise the user; default should require explicit `run/autonomous` opt-in.
- Artifact inference may be brittle; deterministic scans should fail closed and ask the user.
- Main context can still bloat if worker transcripts are pasted back; only summarize and link result files.
- Existing `b-build-hard` / `b-iterate` semantics should be folded gradually via aliases/modes, not removed abruptly.

## Recommended next step

Refine the worker transport decision (`pi --mode rpc` vs print/json subprocess), then phase the implementation. The MVP should prove one-at-a-time external workers over phase/task chunks before adding parallelism.
