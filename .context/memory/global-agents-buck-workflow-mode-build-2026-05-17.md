---
date: 2026-05-17
domains: [buck-workflow, docs, refactor, extensions, testing]
topics: [global-agents, buck-mode, ownership-split, plan-mode, docs, auto-enable]
subject: 2026-05-17.global-agents-buck-workflow-mode
artifacts: [plan-global-agents-buck-workflow-mode.md, ownership-split.md, draft-commit.md]
related: []
priority: high
status: active
---

## Context

Executing plan from `.context/2026-05-17.global-agents-buck-workflow-mode/plan-global-agents-buck-workflow-mode.md`. The first pass completed the documentation/global AGENTS ownership split. The second pass used `b-build-hard` for the remaining runtime work: Buck workflow mode state, `/b-mode`, narrow auto-enable, latching, and focused tests.

## Decisions Made

1. **Ownership split documented** — `ownership-split.md` maps content into: keep global, move to global reference docs, move to Buck docs, move to Buck runtime.
2. **Global AGENTS trimmed** — global `~/.pi/agent/AGENTS.md` now keeps baseline operating guidance, durable-artifact principle, minimal `.context/` convention, and a direct Buck recommendation.
3. **Detailed `.context` rules moved to reference docs** — `~/.pi/agent/docs/context-workflow.md` now includes `.context/workflow/` in the shared layout.
4. **Buck Workflow Mode is extension-owned** — implemented in `extensions/index.ts`, not global AGENTS.
5. **State split is explicit** — `buck_workflow_mode_active` is the broad workflow envelope; `plan_mode_active` remains the write-guard sub-mode.
6. **Manual mode UX is `/b-mode on|off|status`** — `/b-mode on` enables Buck mode plus planning guard; `/b-mode off` disables both and suppresses auto-enable for the session; `status` reports state/source/reason/intent count.
7. **`alt+p` toggles Buck workflow/planning mode** — replaces the previous plan-only toggle while preserving the write guard behavior when enabled.
8. **Narrow auto-enable implemented** — planning/research/docs/spec/backlog/review/handoff requests enable Buck + plan mode; workflow-shaped implementation asks enable Buck mode without the write guard so source edits are not blocked.
9. **Generic routing entrypoint remains deferred** — documented as deferred in Buck-mode docs.

## Implementation Notes

### Changed Files
- `/home/buckleyrobinson/.pi/agent/AGENTS.md` — prior pass: trimmed global always-loaded guidance.
- `/home/buckleyrobinson/.pi/agent/docs/context-workflow.md` — prior pass: added `.context/workflow/` layout entry.
- `extensions/index.ts` — added Buck workflow mode state fields, status handling, `/b-mode`, auto-enable classifier, Buck system-prompt injection, command state handling, compaction summary fields, and implementation tracking from source writes.
- `extensions/buck-mode.test.ts` — added focused Vitest coverage for manual mode control, planning auto-enable, workflow-shaped implementation auto-enable, manual suppression, and `/b-plan` state behavior.
- `docs/buck-workflow.md` — updated Buck-mode docs from planned to implemented, documented state split and command behavior, added `/b-mode` to command/reference tables.
- `README.md` — documented `/b-mode` as extension/runtime automation.
- `.context/2026-05-17.global-agents-buck-workflow-mode/plan-global-agents-buck-workflow-mode.md` — marked remaining runtime/test steps complete and recorded verification blockers.
- `.context/2026-05-17.global-agents-buck-workflow-mode/draft-commit.md` — updated Conventional Commit draft.

### Deferred / Not Changed
- Generic built-in Buck-aware routing entrypoint remains deferred.
- Pre-existing test/typecheck issues outside this change were not fixed.

## Verification

- `npx vitest run extensions/buck-mode.test.ts --reporter verbose` — passes: 5 tests.
- `npm test` — all real tests pass, but command exits non-zero because existing `extensions/b-flow/__tests__/guards.test.ts` and `extensions/b-flow/__tests__/integration.test.ts` use `node:test`; Vitest treats them as empty suites.
- `npx tsc --noEmit` — exits non-zero with pre-existing errors:
  - `extensions/b-flow/__tests__/wire.test.ts(254,21): TS7006 implicit any`
  - `extensions/grill-me-dialog.ts(288,24): TS2347 untyped function calls may not accept type arguments`

## Next Steps

- Run `/b-review` against the plan and changed runtime/docs.
- Consider a follow-up to convert or exclude the two `node:test` files so `npm test` can pass under Vitest.
- Consider a follow-up to fix the two pre-existing TypeScript errors.
- Run `/b-save` to finalize this session record.
