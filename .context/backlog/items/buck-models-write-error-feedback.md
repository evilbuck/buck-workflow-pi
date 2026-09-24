---
title: Report /buck-models write failures in the command UI
status: active
priority: medium
created: 2026-09-24
updated: 2026-09-24
completed: null
related:
  - .context/2026-09-22.buck-loop-model-config/phase-5-buck-models-command.md
  - .context/2026-09-22.buck-loop-model-config/review-phase-5-buck-models-command-2026-09-24.md
  - extensions/buck-models/index.ts
---

# Report `/buck-models` write failures in the command UI

## Acceptance criteria

- [ ] A project- or user-global config write failure produces a targeted `/buck-models` UI notification.
- [ ] The notification identifies the failed scope and preserves the underlying error detail needed to diagnose the failure.
- [ ] Failed writes do not report success or partially mutate the selected profile.
- [ ] Behavioral coverage exercises the command callback with a failing writer seam.
