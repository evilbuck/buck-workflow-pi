---
status: below-waterline
date: 2026-10-12
updated: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [review, iteration, native-access, confinement, project-binding]
informs: []
addresses: phase-4-native-access.md
completed: null
from_review: b-review
---

# Iteration: Phase 4 trusted child boundary

## Source
- Reviewed after: `/b-iterate` completed `iterate-phase-4-native-access-rereview.md`.
- Phase: `phase-4-native-access.md`.
- Parent: `plan-durable-storage-adapters.md`.
- Report: `review-phase-4-native-access-boundary-2026-10-12.md`.
- Baseline: `db3157532de611c1ce2d990c0d18e4fb984ee313` plus current Phase 4 implementation.
- Current Phase 5 remaining-consumer boundary remains accepted. These defects are in the new access/permission binding, not the deferred durable-consumer sweep or publication/migration phases.
- Both findings were ranked `in_scope` and real (noul 0.90 and 0.81) but landed in the **Medium** cell, hence below the supervisor's waterline; see `ranking-2026-10-13T00-43-32-461Z.md`. Below-waterline disposition is not evidence that the boundary defect is resolved. Both remain unfixed in current source: `extensions/workflow-state/confined-fs.ts` `deepestExisting` still calls `existsSync`, and `restrictedChildTools` in `extensions/buck-loop/run-step.ts` still passes bare `cwd` with no pinned trusted context. The finding text below is retained verbatim so the gap survives the disposition; it is not deleted.

## Critical Issues

### 1. Dangling symlink escapes host filesystem write confinement
- **File**: `extensions/workflow-state/confined-fs.ts`
- **Location**: lines 39–42, 63–84; installed SDK write sink `dist/core/tools/write.js:157-162`.
- **Classification**: in-plan; Phase 4 criterion 2, parent material risk 3. High severity; reachable by a local restricted child via the delivered write tool.
- **Problem**: `deepestExisting` uses `existsSync`, which follows symlinks. A dangling link inside the checkout is treated as a nonexistent file; authorization checks its checkout parent, then passes the original link to the SDK. The SDK follows it and creates the outside target. No timing race is required.
- **Observed evidence**: actual `restrictedChildTools(cwd, "b-review")` write of checkout path `dangling`, pointing to an absent fixture machine-storage file, returned `Successfully wrote 34 bytes to dangling`. `outsideCreated: true`; exact outside content was `outside write via dangling symlink`. Direct outside and existing-symlink reads remained denied, so existing tests do not cover this write edge.
- **Proposed fix**: distinguish symlink directory entries from absent paths (`lstat` or equivalent), fail closed on dangling/escaping links and authorize the actual sink. Keep authorization enforceable through the write/edit operation, including intermediate components and check/use races; do not leave host delegation using an unchecked original path. Reuse the existing confinement seam rather than add a prompt-only warning.
- **Required verification**: delivered tools reject dangling final-component and intermediate-directory symlink writes outside the checkout; outside targets remain absent/unchanged. Existing outside reads/edits and symlink denials remain; ordinary new checkout file writes/edits still work. Exercise the actual SDK-backed tool object, not mocked operations or source-text assertions. Address concurrent link replacement if validation remains separate from the sink.

### 2. Child can mutate Git identity inputs and rebind native project scope
- **File**: `extensions/buck-loop/run-step.ts`
- **Location**: lines 153–169, 450–459.
- **Related code**: `extensions/workflow-state/confined-fs.ts:63-75`; `extensions/workflow-state/index.ts:65-70`; `skills/_shared/scripts/workflow-state.ts:172-186`; `extensions/workflow-state/execution.ts:48-56`.
- **Classification**: in-plan; Phase 4 criterion 2 and parent material risk 3. High severity; local restricted child can spoof project identity and retrieve private state.
- **Problem**: only workflow_exec makes Git metadata read-only. Host write/edit permits checkout `.git/config`, index, refs, or a worktree `.git` indirection. The child workflowStateTool is constructed with cwd/role but without one supervisor-bound context; each execute resolves origin/config again. A child can therefore change the project/branch identity inputs and let the next native operation read another scope despite literal project/visibility arguments being rejected.
- **Observed evidence**: a delivered b-review write of `.git/config` succeeded and Git read back the changed setting. A fixture project-B native memory was initially invisible under project A (`read` returned null). The child file tool rewrote `.git/config` to B's origin; the same native tool next returned `PRIVATE PROJECT B`. Trusted resolver project IDs changed from `origin-e545c2ef1403bf526148639ea3172b5bc710e1aeef01e96624f88ab4f1ad5253` to `origin-2f8db86e737456605048171e2b8677e73182c3a91a6377517d9fb3b9f6a62fc8`.
- **Proposed fix**: resolve and bind one validated project/branch/worktree context and store selection in trusted child-session creation, then share it across that child's native operations. Refuse changed identity/backend inputs until an explicit trusted rebind; do not silently follow child-writable metadata. Enforce read-only Git metadata for all non-commit child filesystem operations, protecting normal `.git` directories, worktree `.git` pointers and common-dir metadata. Preserve expressly authorized commit-checkpoint behavior without exposing an arbitrary project-selection capability.
- **Required verification**: actual tools delivered to build/review/save cannot write/edit `.git/config`, index, refs or worktree indirection outside their stage authorization. Project A cannot retrieve project B's private body after an attempted origin/config rewrite, nor widen branch scope through identity-input mutation. Allowed source reads/edits, native current-scope writes, independent attempt receipts and the commit checkpoint remain usable. Test regular repositories and linked worktrees; changing host configuration during a child must fail closed or retain the pinned trusted binding, not redirect writes.

## Warnings
- Fresh durable v2 guardrails pass: coverage 88.9% against baseline 84%; required unit/ratchet/complexity pass; functional/lint skipped and patch advisory by contract. These passing gates do not exercise the two failing boundary scenarios.
- Focused access tests: 10 files / 167 tests passed. Command wrappers: 1 file / 4 tests passed.
- Native/CLI/token/correction/lifecycle and two independent complete receipt attempts passed against repo-files, external-files, on-disk SQLite and disposable PostgreSQL 18 + pgvector. Normal branch-switch receipt/token privacy and original-branch resume work; do not regress the repaired receipt semantics.
- Canonical/bundle/migration byte parity passes; copied bundle CLI and fully linked isolated installer verification pass (17 shipping files).
- All review data were fixture-only. Review-owned container stopped and throwaway scripts/roots removed. No production source, phase/lifecycle status or loop state changed.
- No out-of-plan discoveries are included. Documentation/how-to impact belongs to the separate non-blocking report path.

## Recommended Workflow

Start with `/b-iterate` against these two in-plan trust-boundary defects, then re-run `/b-review` against `phase-4-native-access.md`. Inside the configured execution session, `/b-iterate` completes this artifact before returning; the supervisor owns subsequent review and routing. Do not soften the child boundary, receipt guards, guardrails or accepted later-phase scope.
