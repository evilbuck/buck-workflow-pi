---
title: docs/eval-kernel.md omits the async task/hub job contract
status: completed
priority: medium
created: 2026-07-26
updated: 2026-09-21
completed: 2026-09-21
related:
  - docs/eval-kernel.md
  - .context/2026-07-26.b-init-guardrails/research-harness-gate-mechanics.md
  - skills/b-guardrails-check/SKILL.md
---

# eval-kernel docs omit async subagent dispatch

## Gap

`docs/eval-kernel.md` documents only the **blocking** prelude helpers (`agent`, `parallel`,
`pipeline`, `llm`, `phase`, `log`, `budget`). A scout sweep across `docs/`, `skills/`, `extensions/`
and `prompts/` found **no** in-repo documentation of the live OMP `task`/`hub` async job contract:

> Execution does not block — you receive IDs immediately. … Results auto-deliver.

Paired with `hub` (`op: jobs | wait | inbox | send | cancel`). Verified empirically — four
fire-and-forget batches were dispatched during the `b-init-guardrails` research session while the
main agent continued working.

## Why it matters

Skills that need non-blocking background work currently have no documented primitive to point at, so
they either serialize unnecessarily or invent their own wording. `b-init-guardrails` hit this
directly: its whole "don't block the mainline agent" requirement rests on a contract the repo does
not document.

## Resolution

Completed 2026-09-21. `docs/eval-kernel.md` now distinguishes persistent
eval-kernel handles from asynchronous session `task` / `hub` jobs, documents
result references and retention, and replaces the removed `parallel()`,
`pipeline()`, and `llm()` APIs with current handle-based examples.

`skills/code-smells/SKILL.md` now uses `agent()` handles plus `wait()` for
OMP and retains batched asynchronous `task` jobs as the portable fallback.
