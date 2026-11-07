---
title: Prevent workflow_exec dependency symlinks from exposing host directories
status: active
priority: high
created: 2026-11-05
updated: 2026-11-05
completed: null
related:
  - extensions/workflow-state/execution.ts
  - extensions/workflow-state/execution.test.ts
  - .context/2026-11-05.sql-memory-parameter-error/research-review-iteration-failure.md
---

# Prevent workflow_exec dependency symlinks from exposing host directories

`workflowExecutionTool` resolves the checkout's `node_modules` on each execution and bind-mounts its real target into the sandbox. A sandboxed command can create or change that symlink in its writable checkout; the next command can then read files from the host directory named by the symlink. Reproduced using two calls to the same tool instance and a synthetic private file outside the checkout. This violates the documented isolation boundary. Avoid running untrusted workflow stages through `workflow_exec` until resolved.

A separate compatibility failure occurs when `node_modules` traverses multiple symlinks: the sandbox mounts the final dependency directory but not the intermediate symlink, so the upstream isolation test cannot import `yaml` in a symlinked worktree. Merely canonicalizing that test fixture would not close the security issue.

## Acceptance criteria

- [ ] Neither an initial checkout-controlled dependency symlink nor a symlink changed between calls can expose host directories outside a supervisor-trusted dependency boundary; isolation fails closed when trust cannot be established.
- [ ] Sandbox regression tests demonstrate that a synthetic host-private file remains inaccessible across the two-call symlink pivot and initially malicious checkout cases.
- [ ] Legitimate dependency access in symlinked worktrees is supported through an explicitly trusted boundary without exposing parent directories, credentials, or machine state.
- [ ] The full guardrails contract passes from a symlinked worktree without weakening the isolation assertions.
