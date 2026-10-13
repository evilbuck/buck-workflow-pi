---
status: completed
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, native-access]
informs: []
addresses: phase-4-native-access.md
completed: 2026-10-12
from_review: b-review
---

# Iteration: Phase 4 native access

## Source
- Reviewed after: `/b-build-hard` repair passes.
- Phase: `phase-4-native-access.md`.
- Parent: `plan-durable-storage-adapters.md`.
- Report: `review-phase-4-native-access-2026-10-12.md`.
- Baseline: `db3157532de611c1ce2d990c0d18e4fb984ee313` plus current staged, unstaged, and untracked Phase 4 implementation.
- The current acceptance boundary assigns remaining canonical-skill durable-path consumers and full legacy removal to Phase 5. None of the findings below requires doing that deferred work.

## Critical Issues

### 1. Project-specific backend selection is lost when the native/CLI surface opens its store
- **File**: `skills/_shared/scripts/workflow-state.ts:148-158,199-206,283-287`; `skills/_shared/scripts/workflow-state-cli.ts:66-69`.
- **Problem**: Context resolution discovers Git origin and selects the configured project key, but store opening reloads configuration with `options.origin` (normally undefined). A project configured for external-files under a repo-files machine default writes to the repository instead. Actual CLI write returned success and created `.context/review-override.md`; trusted context still identified `review-project`.
- **Proposed fix**: Resolve identity and adapter selection from one trusted origin/config snapshot and pass the resolved selection through native, CLI, bridge, recall, and save callers. Do not silently reload a different default. Exercise actual CLI and native calls with machine defaults differing from project overrides.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/scripts/workflow-state.ts:148-158,199-206,283-287`; `skills/_shared/scripts/workflow-state-cli.ts:66-69`.. Re-review this finding with Jev.

### 2. Concurrent trusted context resolution loses branch identity registrations
- **File**: `skills/_shared/scripts/workflow-state.ts:103-158`.
- **Problem**: `readIdentity` → mutation → atomic rename is not a serialized read-modify-write. Eight simultaneous resolutions of the same checkout using a fresh identity path returned eight distinct branch IDs. Only the last complete-file rename survives, so successful writes under the other IDs cease to be discoverable on later resolution. Concurrent projects can also lose registry entries.
- **Proposed fix**: Serialize the entire identity transaction with a cross-process lock/transaction using an existing repository locking pattern. Re-read after acquiring ownership. Prove one branch incarnation across concurrent processes and retain registrations for distinct projects/workspaces. Keep atomic replacement for crash consistency; it is not sufficient for concurrency.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/scripts/workflow-state.ts:103-158`.. Re-review this finding with Jev.

### 3. Restricted children bypass native visibility permissions through the CLI
- **File**: `extensions/buck-loop/run-step.ts:139-158,438-447`; `skills/_shared/scripts/workflow-state-cli.ts:29-34,68-69`.
- **Problem**: Every restricted stage has `bash`; CLI `inspect`/`recover` unconditionally assign `admin`. In an actual two-branch fixture the restricted native tool refused inspect, but the identical checkout's CLI inspect exited 0 and returned `PRIVATE OTHER BRANCH BODY`. Retaining an audit record does not prevent a body entering child context.
- **Proposed fix**: Bind restricted child CLI access to the supervisor's trusted role/context and enforce it before reading bodies; keep operator administration separate. If a general shell cannot enforce this boundary, use an enforceable execution boundary for restricted children rather than a caller-editable flag/environment convention. Negative verification must exercise the shell/CLI route as well as the custom tool. Do not loosen the phase's scope restriction to match the bypass.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/buck-loop/run-step.ts:139-158,438-447`; `skills/_shared/scripts/workflow-state-cli.ts:29-34,68-69`.. Re-review this finding with Jev.

### 4. Matching CLI operations and run-bound receipts are unusable
- **File**: `skills/_shared/scripts/workflow-state-cli.ts:9,63-69`; `skills/_shared/scripts/workflow-state.ts:40-44,157-158,265-267,341-348`.
- **Problem**: The portable CLI always uses `write` for ordinary operations, so documented `correct`, `transition`, and `write-receipt` are denied. Actual correction and initialization commands exited 1 with `not permitted for the write role`. Named-branch resolution never supplies a worktree/run identity; actual `read-receipt` exited 1 with `receipt requires a trusted run identity`. A token-only `read` also exits 1 with `read requires --subject` despite the token carrying the subject.
- **Proposed fix**: Route CLI operations through the same trusted stage permission contract as native access, with valid trusted worktree/run binding for receipt operations. Do not accept caller-provided scope or turn every operation into admin. Derive token subject when a token is supplied. Exercise lifecycle initialize/activate, correction, attempted/complete receipt readback, and token-only reads via the actual executable on a named Git branch.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/scripts/workflow-state-cli.ts:9,63-69`; `skills/_shared/scripts/workflow-state.ts:40-44,157-158,265-267,341-348`.. Re-review this finding with Jev.

### 5. A visible published artifact token cannot be read
- **File**: `skills/_shared/scripts/workflow-state.ts:174-187,315-317`.
- **Problem**: Tokens omit ownership branch, and `readOne` binds every reference to the current branch. With a trusted published revision set, list returned `published.md` and its token, but reading that exact token returned null. This is a Phase 4 reference-resolution defect, not a request to implement Phase 6 publication reconciliation.
- **Proposed fix**: Resolve references/revisions against the trusted visible view and use the selected artifact's actual key for body loading. Require exact visible membership before loading; never accept caller ownership/visibility arguments. Prove listed published tokens round-trip, current overlays win for unversioned refs, and unlisted private revision tokens remain unreadable.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/scripts/workflow-state.ts:174-187,315-317`.. Re-review this finding with Jev.

### 6. OMP plan bridge emits a token the shared reader rejects
- **File**: `extensions/plan-artifact.ts:257-262`; `skills/_shared/scripts/workflow-state.ts:60-69`.
- **Problem**: The bridge discards the write result and builds `workflow-artifact:2026-10-12.bridge/plan/plan-bridge.md`, whereas the token parser requires base64url JSON. An actual plan-mode turn-end callback persisted the plan and appended that marker; `parseArtifactToken(marker.target)` threw `Invalid workflow artifact token`.
- **Proposed fix**: Use the token returned by the successful write as the marker/reference; retain the actual logical name/revision. Verify the marker can be read through native/CLI access after the callback and on a later session. Do not manually invent a second token grammar.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/plan-artifact.ts:257-262`; `skills/_shared/scripts/workflow-state.ts:60-69`.. Re-review this finding with Jev.

### 7. Curated release bundle cannot load its CLI
- **File**: `plugins/buck-workflow/skills/_shared/scripts/workflow-state-cli.ts:3-4`; canonical `skills/_shared/scripts/workflow-state.ts:14`; `skills/_shared/storage/postgres-store.ts:2,7`.
- **Problem**: Byte-identical copies preserve runtime imports into `../../../extensions/sql-memory/`, but the skills-only Codex bundle intentionally has no extensions directory. `bun plugins/buck-workflow/skills/_shared/scripts/workflow-state-cli.ts list` exited 1: `Cannot find module '../../../extensions/sql-memory/db.js'`. This fails before backend selection, including file mode. Existing parity tests pass because they do not execute the shipped CLI.
- **Proposed fix**: Put portable pool/migration dependencies and required resources behind a self-contained shared module boundary, or package them explicitly without shipping host-specific extension APIs. Preserve canonical/bundle byte parity. Exercise the shipped CLI outside the development checkout's dependency/layout assumptions, including a file adapter and PostgreSQL when a disposable fixture is available.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file plugins/buck-workflow/skills/_shared/scripts/workflow-state-cli.ts:3-4`; canonical `skills/_shared/scripts/workflow-state.ts:14`; `skills/_shared/storage/postgres-store.ts:2,7`.. Re-review this finding with Jev.

### 8. Recalled IDs cannot be used for corrections
- **File**: `extensions/buck-loop/project-memory.ts:58-66`; `extensions/buck-loop/sql-save.ts:102,167-172`.
- **Problem**: Recall reports `logicalName` as memory `id` and drops the token/revision/subject. Save correction matches `supersedes` against revision IDs. Actual recall returned `memory/fact.md` for stored revision `716607b7-08f4-4985-8e82-beb240b6aada`; saving a correction using that recalled ID failed with `SQL correction target is not in this project`. Same logical names across subjects also collide as Jev question identities.
- **Proposed fix**: Preserve revision identity and a usable token/logical ref in recalled rows. Use stable unique revision IDs for judgment keys and correction predecessors. Prove recall → correction succeeds, including two subjects with identical logical names and a branch-visible published predecessor.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/buck-loop/project-memory.ts:58-66`; `extensions/buck-loop/sql-save.ts:102,167-172`.. Re-review this finding with Jev.

### 9. Native operation failures are reported as successful tool executions
- **File**: `extensions/workflow-state/index.ts:41-43,65-74`; `extensions/omp-models.ts:65-74`; `extensions/buck-loop/run-step.ts:465-469`.
- **Problem**: Exceptions become ordinary tool results containing `{error:true}`, without the runtime failure signal. An actual denied operation's result normalized to `{kind:'toolEnd',tool:'workflow_state',ok:true}`. The save observer checks `!normalized.ok`, so these executor failures never become unresolved save failures. This is distinct from a successful retry and must not be concealed by an error JSON payload.
- **Proposed fix**: Use the host's failure convention (throw a sanitized execution error or supported error result), or explicitly normalize the structured workflow_state failure consistently before the supervisor consumes it. Preserve successful recovery/receipt authority. Verify invalid operations and actual store failures produce failed activity events and cannot masquerade as successful writes.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file extensions/workflow-state/index.ts:41-43,65-74`; `extensions/omp-models.ts:65-74`; `extensions/buck-loop/run-step.ts:465-469`.. Re-review this finding with Jev.

### 10. Native repo-files opener puts the private immutable manifest inside the repository
- **File**: `skills/_shared/scripts/workflow-state.ts:202-206`.
- **Problem**: The opener hardcodes `manifestRoot` to `.context/workflow/storage`, contrary to the settled parent central machine-manifest contract (`plan-durable-storage-adapters.md:43-47,110,125`). Current execution created a 4.5 MB manifest plus revisions beneath that repository path. Those private generated records lie inside the checkpoint's `.context/` staging scope. This is introduced by the new access binding, not a Phase 6 reconciliation requirement.
- **Proposed fix**: Keep repo-files editable bodies at `.context/`, but resolve manifest/revision authority under the trusted machine/project root outside Git. Use the existing adapter's separate contextRoot/manifestRoot seam. Prove actual repo-files native/CLI writes preserve editable body layout without placing manifests or private revision blobs under the checkout's staging scope.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/_shared/scripts/workflow-state.ts:202-206`.. Re-review this finding with Jev.

## Warnings
- First guardrails run failed one changed recall test; isolated recall tests and the second full guardrails run passed. The initial failure is retained in the report, not treated as a clean first run. Root cause of that individual failure is unproved; the identity race above is independently reproduced.
- No `BUCK_WORKFLOW_TEST_DATABASE_URL` was configured; PostgreSQL surface smoke was not executed. Existing tests skipped 30 tests in the first full run. Do not claim all-backend end-to-end verification from file/SQLite smokes or missing-env refusal tests.
- This artifact contains only in-plan implementation defects. Remaining durable consumers/publication/migration are still owned by their declared later phases.

## Recommended Workflow
Start with `/b-iterate` for these in-plan defects, then re-run `/b-review` against `phase-4-native-access.md`. Inside an OMP execution session, `/b-iterate` completes this artifact before returning; the supervisor then re-reviews. For larger rework use `/b-build-hard`. This review does not choose a loop state or change phase lifecycle fields.

## Applied iteration (2026-10-12)

All ten findings are repaired. Detailed changes, mutation evidence, runtime
smokes, packaging proof and verification limits:
[`research-phase-4-iteration-verification.md`](research-phase-4-iteration-verification.md).

Final focused run: 8 files / 87 tests passed. Final durable guardrails: pass;
coverage 88.8% versus 84% baseline; unit/ratchet/complexity pass, no new complexity
violations; lint/functional skipped and patch advisory as configured.

The actual native → canonical CLI → isolated bundled CLI roundtrip, project
backend override, correction/complete receipt, external private manifest,
isolated worktree commit and four-project concurrent registration smoke passed.
Bubblewrap is now required for nested command execution; isolation fails closed
and retains native stage roles. No real PostgreSQL surface smoke is claimed.

Return to the supervisor for `/b-review` against the same phase. Phase/subject
lifecycle and the next loop state were not changed by this iteration.
