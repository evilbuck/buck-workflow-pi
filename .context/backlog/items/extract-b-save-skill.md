---
title: Extract b-save prompt into portable skill
status: active
priority: medium
created: 2026-06-04
updated: 2026-06-04
completed: null
related:
  - .context/2026-06-04.buck-workflow-benefits-explainer/gaps-and-followups.md
  - .context/2026-06-04.buck-workflow-benefits-explainer/research-buck-workflow-benefits.md
---

# Extract b-save prompt into portable skill

## Problem

`/b-save` currently lives as an extension-registered Pi command with its operational prompt embedded in `extensions/index.ts`. That makes the save workflow useful in Pi, but harder to reuse across other agent environments such as Claude Code, Codex, or OpenCode.

## Desired outcome

Move the canonical `b-save` workflow instructions into a portable skill artifact so other agents can load the same save behavior, while Pi can continue registering `/b-save` as an extension command that delegates to or references the shared skill.

## Candidate approach

- Create `skills/b-save/SKILL.md` as the canonical portable save workflow.
- Move the current 10-responsibility prompt from `extensions/index.ts` into the skill.
- Update the Pi `/b-save` extension command to reference or inject the skill-backed instructions rather than owning a divergent embedded prompt.
- Add thin wrappers/adapters for Claude, Codex, and OpenCode as appropriate.
- Preserve Pi-specific runtime behavior: reading `.context/workflow/current-session.json`, marking `save_completed`, and triggering QMD indexing.

## Acceptance criteria

- `skills/b-save/SKILL.md` exists and documents the canonical save workflow.
- Pi `/b-save` behavior remains available and functionally equivalent.
- The “10 responsibilities” wording is corrected and consistent everywhere.
- Docs explain which parts are portable skill behavior vs Pi extension runtime behavior.
- The skill can be reused or adapted by Claude and Codex without depending on Pi extension APIs.
