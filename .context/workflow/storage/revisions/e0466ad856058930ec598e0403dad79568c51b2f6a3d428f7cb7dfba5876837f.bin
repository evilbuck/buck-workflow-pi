---
status: active
date: 2026-06-01
subject: 2026-06-01.deprecate-b-flow
topics: [deprecation, b-flow, xstate, extension, removal-marking]
---

# Subject: Deprecate b-flow Extension

**Subject**: deprecate-b-flow
**Date**: 2026-06-01
**Status**: active

## Goal
Disable the `extensions/b-flow/` Pi extension at runtime and mark it as deprecated-for-removal so future agents do not revive it. The extension is wired but never invoked in real workflows; its XState v5 design is the root cause of the over-engineering. The directory stays on disk with a `DEPRECATED.md` banner — a later pass performs the actual deletion.

## Artifacts

| File | Type | Description |
|------|------|-------------|
| `plan-deprecate-b-flow.md` | Plan | Bounded implementation plan with scope, affected files, steps, verification, and risks |

## Inputs Used
- User request: "buck-workflow or b-flow doesn't work... too complicated and doesn't actually run as it is. xstate might be too much and overcomplicating it. For now, lets just disable it and mark it as deprecated and marked for removal."
- Session context: prior inline scout mapped the full scope (see `plan-deprecate-b-flow.md` Context section)
- Architecture review: `.context/2026-05-30.b-flow-sdk-redesign/architecture-review-sdk-worker.md` — concluded b-flow is "wired but never invoked in practice"
- Original research: `.context/2026-05-08.b-orchestration-extension/research-xstate-for-b-flow.md`
- SDK redesign research: `.context/2026-05-30.b-flow-sdk-redesign/research-pi-sdk-worker-architecture.md`
- Spec: `.context/2026-05-08.b-orchestration-extension/spec-b-flow-state-machine.md`

## Related Subjects
- `2026-05-08.b-orchestration-extension` (completed) — original b-flow MVP + spec
- `2026-05-30.b-flow-sdk-redesign` (completed) — SDK worker rewrite, concluded wired-but-never-invoked

## Out of Scope
- Deleting the `extensions/b-flow/` directory (later pass)
- b-grill-auto extension (different concern, not in scope)
- Historical `.context/**` artifacts (preserved as record)
- `presentations/b-flow-sdk-redesign/` (historical artifact)
- b-flow tests fix / removal (tests still pass after disable)
