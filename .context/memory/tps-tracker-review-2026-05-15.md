---
date: 2026-05-15
domains: [extensions, review, implementation]
topics: [tps-tracker, tokens-per-second, pi-extension, wire-pattern, ctx-hasUI]
subject: 2026-05-15.tps-tracker-review
artifacts: [iterate-tps-tracker-review.md, draft-commit.md]
related: [b-grill-auto-2026-05-08, tmux-window-status-2026-04-16]
priority: medium
status: active
---

# TPS Tracker Extension — Review & Fix

## Context
User created `extensions/tps-tracker.ts` to track tokens per second during model generation in pi-coding-agent. Ran b-review followed by b-iterate.

## Decisions Made
- Use `wire()` export pattern (matching project convention from tmux-window-status, b-grill-auto, etc.) instead of adding to `package.json` pi.extensions array
- Remove `messageStart` fallback in `message_end` — non-streaming messages now report N/A instead of misleadingly high TPS
- Guard all UI calls with `ctx.hasUI` for print/json mode safety

## Implementation Notes
- Refactored `tps-tracker.ts`: renamed default export to `wire`, removed `messageStart` state variable, added `ctx.hasUI` guards in `agent_start`, `message_update`, and `agent_end`
- Wired from `extensions/index.ts` via `import { wire as wireTpsTracker } from "./tps-tracker.js"` + `wireTpsTracker(pi)`
- Handler simulation verified all three scenarios: streaming ✅, non-streaming N/A ✅, no-UI silent ✅

## Files Modified
- `extensions/tps-tracker.ts` — refactored: wire() export, removed messageStart fallback, added hasUI guards
- `extensions/index.ts` — added import + wireTpsTracker(pi) call

## Verification
- TypeScript: no new errors (2 pre-existing unrelated errors remain)
- Handler simulation: streaming reports TPS, non-streaming shows N/A, no-UI mode produces zero calls

## Next Steps
- Commit with `/git-commit` using draft at `.context/2026-05-15.tps-tracker-review/draft-commit.md`
- Test in live Pi session to verify footer status and notification behavior
