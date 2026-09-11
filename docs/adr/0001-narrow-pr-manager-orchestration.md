# 0001. Narrow PR-manager orchestration

Date: 2026-09-10

## Status

Accepted

## Context

General-purpose `b-flow` orchestration was deprecated because an extension that is not observably invoked becomes dead weight. We still need one OMP command that can take an open pull request from review feedback through fix, rebase, push, auto-merge, and confirmed merge without babysitting.

## Decision

Ship `/b-pr-manager` as a **narrow, explicitly invoked** XState v5 machine:

- User starts it. It does not auto-activate.
- Deterministic TypeScript owns git, GitHub, timing, persistence, transitions, and success.
- Model roles return versioned JSON only. They never choose shell commands or claim merge readiness.
- Success is GitHub `state=MERGED` only. Auto-merge accepted is not completion.
- Runtime state lives under `<git-dir>/b-pr-manager/`, never the PR worktree.
- `b-flow` stays unwired. `/skill:fix-pr` remains the portable/manual fallback.

## Consequences

- One extra extension command, not a general orchestrator.
- Merge-method and base prompts stay explicit when several options exist.
- `--force` without lease cannot be produced.
- Living docs must not describe this as restoring `b-flow`.
