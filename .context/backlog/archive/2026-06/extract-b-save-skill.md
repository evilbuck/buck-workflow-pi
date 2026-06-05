---
title: Extract b-save prompt into portable skill
status: completed
priority: medium
created: 2026-06-04
updated: 2026-06-05
completed: 2026-06-05
related:
  - .context/2026-06-05.extension-slimdown/plan-extension-slimdown.md
  - .context/memory/extension-slimdown-2026-06-05.md
---

# Extract b-save prompt into portable skill

## Outcome

Completed as part of the extension slimdown work (`.context/2026-06-05.extension-slimdown/plan-extension-slimdown.md`).

- `skills/b-save/SKILL.md` created — documents the canonical save workflow
- `prompts/b-save.md` updated — replaced `{{SESSION_STATE}}` placeholder with direct file-read instruction
- `/b-save` behavior preserved as pure prompt + skill — no extension backing
- `commands/b-save.md` symlink already existed for OMP runtime discovery
