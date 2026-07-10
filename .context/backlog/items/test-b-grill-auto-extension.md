---
title: Test b-grill-auto extension in live Pi session
status: active
priority: high
created: 2026-05-08
updated: 2026-07-10
completed: null
related:
  - .context/2026-05-08.b-grill-auto/plan-b-grill-auto-extension.md
  - .context/memory/b-grill-auto-2026-05-08.md
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-11-entrypoint-legacy-cleanup.md
---

# Test b-grill-auto Extension

## Description
Run `/b-grill-auto` in a live Pi session to verify end-to-end behavior:
- Command registration and arg parsing
- RPC subprocess spawn and communication
- Orchestrator loop (question generation → answer → record)
- Session file output to subject folder
- Cleanup on completion/error

## Context
Extension was implemented and TypeScript-verified but not yet tested in a live Pi session.

## Verification
- [ ] `/b-grill-auto` appears in command list
- [ ] RPC subprocess starts with correct model/provider
- [ ] At least one question is generated and answered
- [ ] `grill-auto-session-*.md` is written to subject folder
- [ ] No orphan processes after completion
- [ ] Error handling works (bad model, timeout, abort)

## Phasing

Absorbed by Phase 11 of the Buck Workflow contract remediation. The extension is unwired and the checked-in Python helper is syntax-invalid; the conservative plan retires `b-grill-auto` from active discovery instead of treating this live-session test as actionable. Archive this item when Phase 11 lands.
