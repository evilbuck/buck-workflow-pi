---
title: Multi-harness symlink installer (buck-workflow install)
status: active
priority: high
created: 2026-06-12
updated: 2026-07-10
completed: null
related:
  - .context/2026-06-12.multi-harness-symlink-installer/plan-symlink-installer.md
  - scripts/install.mjs
  - package.json
  - README.md
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-12-installer-surface-inventory.md
---

# Multi-harness symlink installer

One `buck-workflow install` command (Node ESM bin) detects installed agent harnesses (Pi, OMP, Claude Code, Codex, Cursor, OpenCode) and symlinks the bootstrap `AGENTS.md` + skill/command trees into each harness's expected locations. Fixes the bootstrap-drift bug (today it's a hand `cp`) and wires the four currently-unsupported harnesses.

- Scope decisions: all six harnesses; bootstrap + skill/command trees; Node ESM bin (Node already required, bun not declared).
- Pi/OMP = bootstrap-only (package loads skills/commands; avoid double-load).
- Codex = bootstrap-only (no slash-command system).
- Cursor = project `.cursor/rules/*.mdc` (global rules are app-settings, uncertain).
- Claude/OpenCode = full bootstrap + commands + skills fan-out.

Plan: `.context/2026-06-12.multi-harness-symlink-installer/plan-symlink-installer.md`
Pick up with `/b-build-hard` (per-harness unknowns warrant hard mode).

## Phasing

Phase 12 of the Buck Workflow contract remediation verifies the existing installer against this item's acceptance contract, adds generated surface inventory, and archives this item if the isolated-harness tests pass. Do not create a second installer implementation.
