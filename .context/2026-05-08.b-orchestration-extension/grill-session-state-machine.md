---
type: grill-session
date: 2026-05-08
subject: 2026-05-08.b-orchestration-extension
total_questions: 20
assessment_threshold: 20
boundary_assessment: cohesive
break_points: []
decision_domains:
  - name: State Machine Semantics
    questions: [1-20]
    resolved: 19
    deferred: 0
status: active
---

# Grill Session: State Machine

## Decision Domains

### Domain: State Machine Semantics

- Q1: What is the authoritative unit of progress in the state machine: Buck workflow state, decomposed chunk, or worker invocation? → resolved: Hybrid. Use a parent workflow machine for coarse Buck states and nested queue/chunk machines for decomposed task execution. Worker invocations are attempts, not the authoritative progress unit.
- Q2: Should chunk execution be modeled as a nested child state machine invoked by the parent, or as queue data managed inside the parent context? → resolved: Use nested child machine + durable queue projection. Parent remains coarse workflow supervisor; child owns queue lifecycle.
- Q3: What should the parent workflow do when the child chunk queue reports a blocked chunk? → resolved: Pause and ask user by default. Smarter retry/replan behavior can be added later after the core loop is reliable.
- Q4: What should count as completion for a chunk: artifact status, worker result status, git diff/verification, or all of these? → resolved: All of these. Completion requires worker result completed, task/phase artifact completed, verification recorded/passing, and changed files matching expected scope.
- Q5: Should the orchestrator enforce this completion strictly in the chunk queue, or allow `completed_with_warnings` and rely on review to catch remaining issues? → resolved: Allow `completed_with_warnings`; advance the queue and rely on review to catch remaining issues.
- Q6: Should review run after every chunk, after all chunks in a batch, or only after the queue is exhausted? → resolved: Policy-based. Hard/high-risk chunks and worker warnings trigger immediate review; easy/medium chunks review after queue exhaustion; completed_with_warnings schedules review but may continue if chunks are independent.
- Q7: Who decides whether a chunk is hard/high-risk or independent enough to continue: static metadata, programmatic checks, model guard, or user policy? → resolved: Hybrid. Use static metadata first, then programmatic changed-file/dependency checks, then model guard only for ambiguous cases, with user policy overrides.
- Q8: Should the model guard run in the main supervisor session/model, or in a separate cheap classifier subprocess so main context stays clean? → resolved: Separate cheap classifier model call, with config override later if needed. Implementation can use the TypeScript SDK/API directly inside the extension rather than a subprocess, as long as the call does not pollute main chat context.
- Q9: What should the classifier be allowed to decide: only routing recommendations, or also state mutation like marking chunks completed/blocked? → resolved: Routing recommendation only. Classifier returns route/confidence/reason/evidence; supervisor remains authoritative for state mutation.
- Q10: Should classifier model calls use the Pi SDK/model APIs directly, or share the same external worker/RPC transport used for subagent execution? → resolved: Both. Use SDK direct model calls for classifier guards; use external subagent process/RPC for worker execution.
- Q11: What should the state machine do when the classifier confidence is low or classifier output is invalid? → resolved: Combination. Retry once for invalid JSON; ask user when confidence is below threshold; if classifier unavailable, use obvious programmatic safest route or block.
- Q12: Should the state machine persist classifier decisions as audit records, and if so where? → resolved: Both summary inline in orchestration history and full audit file under `.context/<subject>/transition-audits/<timestamp>-from-to.json`.
- Q13: Should worker execution attempts also be audited separately from worker result files? → resolved: Both inline summary and separate audit file per attempt. Worker audits should capture command/model/PID/session/stdout/stderr/exit/timeout, while worker results capture semantic outcome.
- Q14: What is the retry policy for failed worker attempts before the chunk is marked blocked? → resolved: Retry based on failure type, with config override later. Runtime crash retries once same settings; format failure retries once stricter prompt; verification failure goes to completed_with_warnings/review; scope/user blocker pauses; repeated timeout may retry with stronger model or longer timeout.
- Q15: Should the state machine support parallel chunk workers eventually, and should the MVP design leave room for it? → resolved: Future yes, but MVP serial. Schema should leave room for future `active_workers[]`, `max_concurrency`, and dependency-aware parallelism.
- Q16: What should be the source of truth for the machine after restart: XState persisted snapshot, human-readable orchestration projection, or reconstructed artifacts? → resolved: Layered recovery. Load XState snapshot, load orchestration projection, reconcile against artifacts, let artifacts win, and block/ask user on unsafe conflicts.
- Q17: Should the extension create/update a formal machine design spec now, separate from the brainstorm, once this grilling session resolves enough decisions? → resolved: Write a draft now and update after Q20 threshold assessment.
- Q18: What should be the top-level parent machine states in the formal spec? → resolved: Initial list was excessive because it mixed durable workflow modes with internal implementation substates. Revised top-level states accepted: `idle`, `recovering`, `planning`, `decomposing`, `executingChunks`, `reviewing`, `saving`, `blocked`, `paused`, `done`, `aborted`. Internal steps like scanning/routing/classifying/awaitingUser are nested or invoked substates, not top-level.
- Q19: Should `planning` and `decomposing` run in the main supervisor session, or should they also use external workers like chunk execution? → resolved: Hybrid. In guided/manual mode, planning/decomposing run in main session for visibility. In autonomous mode, they can run in external worker sessions; supervisor receives artifact summaries only. Chunk execution stays external once chunks exist.
- Q20: At the threshold, do these decisions reveal distinct separation-of-concerns boundaries requiring multiple specs/phases, or are they cohesive around one state-machine design? → pending

## Boundary Assessment

Triggered at Q20 (assessment threshold: 20).

**Assessment**: cohesive

**No phase boundaries**: The questions cluster around a single concern: the `/b-flow` orchestration state machine design. The discussion covered nested machines, guards, classifier routing, worker lifecycle, audits, retry policy, recovery, and parent states, but these are all parts of the same technical design rather than separate implementation concerns.

The eventual implementation may still be phased for delivery, but the design itself is cohesive and should remain in one state-machine spec.

## Deferred Questions

None yet.
