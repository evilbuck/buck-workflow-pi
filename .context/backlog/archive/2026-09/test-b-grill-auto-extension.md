---
title: Test b-grill-auto extension in live Pi session
status: completed
priority: high
created: 2026-05-08
updated: 2026-09-21
completed: 2026-09-21
related:
  - .context/2026-05-08.b-grill-auto/plan-b-grill-auto-extension.md
  - .context/memory/b-grill-auto-2026-05-08.md
---

# Test b-grill-auto Extension

**Closed 2026-09-21:** `extensions/b-grill-auto/` and `skills/b-grill-auto/` deleted. Auto grilling remains as `/skill:b-grill --mode auto`. Live `/b-grill-auto` command test is obsolete.

## Original description

Run `/b-grill-auto` in a live Pi session to verify end-to-end behavior:

- Command registration and arg parsing
- RPC subprocess spawn and communication
- Orchestrator loop (question generation → answer → record)
- Session file output to subject folder
- Cleanup on completion/error
