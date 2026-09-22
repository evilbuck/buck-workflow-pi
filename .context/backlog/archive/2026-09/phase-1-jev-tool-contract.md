---
title: Phase 1 — Jev tool contract
status: completed
priority: high
created: 2026-09-21
updated: 2026-09-22
completed: 2026-09-21
related:
  - .context/2026-09-21.jev-tool/phase-1-jev-tool-contract.md
  - .context/2026-09-21.jev-tool/plan-jev-tool-phases.md
  - .context/2026-09-21.jev-tool/plan-jev-tool.md
  - extensions/jev-tool/
  - extensions/index.ts
  - package.json
---

# Phase 1 — Jev tool contract

Installed the TypeSafe SDK and registered a generic `jev` OMP tool with the `systemOne` request shape. Tests cover Noul/Choice/Score passthrough, multi-question calls, model override, validation, missing credentials, SDK errors, and root extension wiring. The tool fails closed with no alternate model/session fallback.
