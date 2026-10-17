---
status: active
date: 2026-05-09
subject: 2026-05-09.pi-agent-cycle-fix
topics: [pi-core, model-switching, request-abort, interactive-session]
research: []
spec:
memory: []
---

# Plan: Abort In-Flight Request Before Model Cycle

## Goal

Fix the interactive Pi session bug where cycling models during a running turn leaves the old provider request alive, causing the session to remain stuck in `working...` and ignore later prompts.

## Context used / assumptions

- User-provided diagnosis identified the core symptom chain:
  - a provider request hangs indefinitely
  - user cycles models
  - model state changes, but the old request is not aborted
  - later user messages are queued behind a still-running turn
- Existing Buck workflow extension code confirms that session cleanup/UI recovery mostly depends on `agent_end`, so a never-ending core request leaves the UI stuck.
- The real fix belongs in Pi core, specifically the model-cycle path in `AgentSession`, not in this workflow package.
- `abort()` already exists in Pi core and is the correct primitive if it cancels the active request and waits for the session to become idle.

## Scope

- Patch Pi core model-cycling so it aborts any active turn before switching models.
- Preserve existing behavior when the session is already idle.
- Add targeted regression coverage for cycling during an in-flight request.

## Out of scope

- Diagnosing why specific providers hang.
- Adding global provider timeout policy, unless needed as a separate follow-up.
- Changing Buck workflow extension behavior beyond documenting the upstream dependency.

## Affected files for implementation

- `packages/coding-agent/src/core/agent-session.ts`
- Corresponding test file for `AgentSession` model-cycling behavior

## Proposed implementation steps

1. Inspect `AgentSession.cycleModel()` and its helpers to identify both model-cycle paths:
   - scoped model cycling
   - available-model cycling
2. Confirm the current call order:
   - current implementation mutates selected model state and emits model-change events
   - current implementation does not abort the active request first
3. Update both cycle helpers so they do this sequence:
   - if a turn is active, call `await this.abort()`
   - wait for the session to become idle
   - apply the new model selection
   - emit/log the model-change event as before
4. Verify the idle path remains cheap:
   - cycling while nothing is running should still switch immediately
   - no new visible error or delay should be introduced
5. Add regression tests covering:
   - cycling during an active request aborts the old run before model mutation
   - rapid repeated cycling does not leave multiple concurrent runs active
   - cycling while idle still works
6. Run the smallest relevant test target for Pi core model/session behavior.

## Verification

- Reproduce with a hanging or deliberately blocked provider call.
- Start a turn, then cycle models while the turn is in progress.
- Confirm the previous run is cancelled instead of left pending.
- Confirm new user input is accepted after the cycle instead of remaining blocked behind the old run.
- Confirm only one in-flight run exists at a time during rapid cycling.
- Confirm existing idle cycling behavior is unchanged.

## Risks

- If `abort()` has side effects beyond cancelling the current turn, cycling could unexpectedly clear more session state than intended.
- If model switching is allowed from multiple code paths, fixing only one helper could leave another unpatched.
- If request cancellation is provider-specific and not enforced uniformly, abort may return before the transport is fully torn down.

## Follow-up candidates

- Add a hard timeout for interactive provider requests so hangs become surfaced errors rather than permanent `working...`.
- Decide whether manual model cycling should also clear any queued follow-up prompt associated with the aborted turn.
- In Buck workflow, stop marking `/b-save` complete until the follow-up run actually finishes.

## Recommended next step

Implement the Pi core abort-before-cycle change first, then verify it against the real hanging-provider scenario before adding timeout policy.
