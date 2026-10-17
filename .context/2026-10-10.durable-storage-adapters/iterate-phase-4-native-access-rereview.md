---
status: completed
date: 2026-10-12
updated: 2026-10-17
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, native-access, scope-binding]
informs: []
addresses: phase-4-native-access.md
completed: 2026-10-17
from_review: b-review
---

# Iteration: Phase 4 native access re-review

## Source
- Reviewed after: `/b-iterate` completed `iterate-phase-4-native-access-review.md`.
- Phase: `phase-4-native-access.md`.
- Parent plan: `plan-durable-storage-adapters.md`.
- Report: `review-phase-4-native-access-rereview-2026-10-12.md`.
- Baseline: `db3157532de611c1ce2d990c0d18e4fb984ee313` plus existing staged/unstaged Phase 4 changes.
- The recorded Phase 5 boundary remains accepted. These findings concern the new access/permission binding itself, not the deferred consumer sweep or Phase 6 publication.

## Critical Issues

### 1. Host file tools bypass the restricted child's storage boundary
- **File**: `extensions/buck-loop/run-step.ts`
- **Location**: lines 139–148, 435–448.
- **Related code**: `extensions/workflow-state/execution.ts:19-33`; installed SDK `dist/core/tools/read.js:132-158` and `path-utils.js:47-57`.
- **Classification**: in-plan; criterion 2 and parent material risk 3.
- **Problem**: Bubblewrap isolates only `workflow_exec`. Restricted children still receive the ordinary host `read`, `edit`, `write`, `grep`, and (in review) `find`/`ls` tools. The session constructor supplies no confined file operations or path guard. The host SDK read tool accepts absolute paths outside its cwd. Removing host bash therefore does not make workflow_state the only route to machine storage; a child can directly retrieve another branch's external-file body without native inspect permission.
- **Observed evidence**: a real two-branch external-files fixture produced `nativeInspectDenied: true`, `returnedPrivateBody: true`, and `fileOutsideCheckout: true`. The private body was returned by the installed SDK's actual `createReadTool(cwd).execute(...)`. The actual Bubblewrap command tool denied `cat` of that same path. This proves the isolation mismatch without prompting a model or reading real user-private data; no live model-backed child session is claimed.
- **Proposed fix**: enforce the storage boundary for every child-visible filesystem tool, not only command execution. Provide confined operations or an equivalent enforceable execution boundary that permits required checkout/skill source access but denies machine storage, identity/configuration/credentials, and unauthorized writes. Resolve symlinks before authorizing access. Keep workflow_state as the sole durable-store route; do not use a caller-editable environment flag or prompt warning as authorization.
- **Required verification**: exercise the actual tool objects delivered to restricted stages. Absolute-path and symlink reads/searches of another branch's file store must fail; out-of-root edits/writes must fail; permitted checkout source reads/edits and native artifact operations must continue to work. Retain the shell negative case, but do not treat it as proof for host file tools.

### 2. Workspace-stable run identity leaks receipts across branches and makes later saves unusable
- **File**: `skills/_shared/scripts/workflow-state.ts`
- **Location**: lines 156–182, 289–291, 332, 367–374.
- **Related code**: `skills/_shared/scripts/workflow-state-cli.ts:66-71`; `skills/_shared/storage/domain.ts:117-139`.
- **Classification**: in-plan; typed receipt operations, trusted scope binding, and criterion 6 receipt semantics.
- **Problem**: `bindPrivate` creates one runId per project/cwd and persists it indefinitely; named branches reuse that same runId through `resolveTrustedContext`. The CLI cannot start a distinct trusted run. `read-receipt` looks up only projectId/runId and does not reject a stored branch/worktree mismatch. After one complete receipt, another branch in the same checkout receives that first branch's receipt; a second attempted save on the original branch is rejected by the domain's correct immutable-receipt guard. Do not weaken that guard to accommodate the access binding.
- **Observed evidence**: after an actual CLI attempted → complete receipt on `topic`, a new CLI attempted receipt with `attemptId: attempt-2` failed with `receipt attempt or scope mismatch, or already complete`. After `git checkout -b other`, trusted resolution retained the same runId; actual `read-receipt` returned `status: complete` with branch `branch-5859b5df-5d8f-47f3-914a-291c0cbc1f64`, while the current trusted branch was `branch-59702567-4239-464c-8d80-ac6f9a089026`.
- **Proposed fix**: separate stable workspace identity from trusted run/attempt identity. Bind or resume an exact validated run for native/CLI receipt operations; create a new run for a later independent attempt without allowing model-supplied arbitrary scope. Before returning a receipt, validate project, branch, worktree and run against the bound context. Preserve completed receipt immutability and exact-attempt resume semantics.
- **Required verification**: two independent saves in one named checkout can each complete with distinct trusted run identities; repeated commands within one attempt retain its identity; switching branches cannot read or resume the previous branch's receipt implicitly; explicitly validated same-attempt resume still works. Verify at the actual CLI/native boundary, not only with injected run IDs.

## Warnings
- Fresh durable guardrails pass: coverage 88.8% against 84%; required unit/ratchet/complexity pass; functional/lint skipped and patch advisory as configured. Green existing tests do not exercise the two failing scenarios above.
- Focused access regression suite: 9 files, 164 tests passed.
- Actual native/CLI write → token read → correction → lifecycle initialize/activate → single receipt completion passed on repo-files, external-files, SQLite and PostgreSQL 18 + pgvector. The copied bundle CLI and isolated Codex installer verification passed. This is focused surface evidence, not whole-parent workflow completion or live model-backed OMP proof.

## Recommended Workflow
Start with `/b-iterate` against these two in-plan access defects, then re-run `/b-review` against `phase-4-native-access.md`. Inside the configured execution session, `/b-iterate` completes this artifact before returning; the supervisor owns the subsequent review and routing. This review changes no phase/subject lifecycle or loop state.
