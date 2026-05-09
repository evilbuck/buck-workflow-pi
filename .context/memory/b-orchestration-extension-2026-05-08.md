---
date: 2026-05-08
domains: [tooling, pi-extension, orchestration, buck-workflow]
topics: [b-flow, orchestration, state-machine, subagent, context-rollover, worker-loop, xstate]
subject: 2026-05-08.b-orchestration-extension
artifacts: [plan-b-flow-mvp.md, tasks.md, research-xstate-for-b-flow.md, spec-b-flow-state-machine.md, grill-session-state-machine.md]
related: [b-grill-auto-2026-05-08.md, b-phase-discrete-files-2026-05-06.md]
priority: high
status: active
---

# Session: 2026-05-08 - Buck Workflow Orchestration Extension

## Context
- Goal: define a Pi extension that orchestrates the Buck workflow as a durable state machine.
- User clarified the main pain: context limitations and model degradation force manual clear/restart between workflow steps.
- User further clarified desired execution model: once a plan/task is chunked, an orchestration loop should continue over tasks using a subagent outside the main context.

## Decisions Made
- Treat `/b-flow` as the recommended primary command name; `/b-orchestrate` can be an alias later.
- Main Pi session should be a supervisor/control plane, not the worker context.
- Decomposed chunks should run through isolated subagent workers outside the main context.
- Durable artifacts are the source of truth between iterations.
- Worker loop should process one chunk at a time for MVP; parallel workers are deferred.
- Worker should write compact result files under `.context/<subject>/worker-results/` and the supervisor should read summaries/links, not full transcripts.
- XState v5 is recommended for the supervisor engine because it provides guarded transitions, invoked actors, `onDone`/`onError`, TypeScript typing, and persisted snapshots.
- XState guards should remain pure/synchronous; artifact scans and model routing should run as invoked actors before guard evaluation.
- State machine should be hybrid: parent workflow machine plus nested chunk queue machine.
- Parent top-level states accepted: `idle`, `recovering`, `planning`, `decomposing`, `executingChunks`, `reviewing`, `saving`, `blocked`, `paused`, `done`, `aborted`.
- Chunk = small independently executable unit: phase file, tasks.md item, backlog item, or iterate artifact.
- Blocked chunk should pause and ask user by default.
- Chunk completion can advance as `completed_with_warnings`; review catches remaining issues.
- Review timing is policy-based: high-risk/warnings immediate; easy/medium independent chunks can wait until queue exhaustion.
- Risk/independence uses hybrid evaluation: static metadata, programmatic checks, classifier model only when ambiguous, user policy overrides.
- Classifier should be direct SDK/model call outside main chat context; worker execution should use external subagent process/RPC.
- Classifier can recommend routes only; supervisor remains authoritative for state mutation.
- Classifier and worker attempts should be audited: inline summary plus full audit files.
- Recovery is layered: XState snapshot + orchestration projection + artifact reconciliation, with artifacts winning and unsafe conflicts blocking.

## Artifacts Updated
- `docs/brainstorms/b-orchestration-extension.md`
  - Added context rollover problem framing.
  - Added external subagent task loop design.
  - Added worker contract, worker result file shape, queue source priorities, and runtime state schema.
- `.context/2026-05-08.b-orchestration-extension/plan-b-flow-mvp.md`
  - Updated MVP plan around `plan → phase? → build chunks → review → save → done`.
  - Added external worker loop implementation steps and verification criteria.
- `.context/2026-05-08.b-orchestration-extension/research-xstate-for-b-flow.md`
  - Captured XState v5 fit assessment, caveats, and recommended architecture.
- `.context/2026-05-08.b-orchestration-extension/spec-b-flow-state-machine.md`
  - Drafted formal technical spec for XState parent/child machine, route actions, persistence files, audits, and MVP constraints.
- `.context/2026-05-08.b-orchestration-extension/grill-session-state-machine.md`
  - Captured 20-question grilling session; threshold assessment found the design cohesive around one state-machine concern.
- `.context/2026-05-08.b-orchestration-extension/tasks.md`
  - Updated completed design tasks and remaining implementation tasks.

## Next Steps
- [ ] Decide worker transport: `pi --mode rpc` vs print/json subprocess vs wrapper around Pi subagent example.
- [ ] Define exact worker prompt and result parser.
- [ ] Implement `extensions/b-flow/` MVP as an XState supervisor with one worker at a time.
- [ ] Add tests for XState transitions, guard routing, queue selection, worker-result parsing, snapshot restore, and stale-worker recovery.
