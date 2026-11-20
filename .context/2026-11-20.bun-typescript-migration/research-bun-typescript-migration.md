---
status: active
date: 2026-11-20
---
# Bun migration

User chose to drop Node support and require Bun 1.4+, converting JavaScript and MJS skill and loose scripts to TypeScript. Existing behavior must have test coverage before refactoring; preserve existing packer user .mjs configs and compile browser TypeScript to executable JS. Plugin copies and all distribution entrypoints must migrate together. User additionally reported an extension handler timeout at 30000 ms. Extension bundle registers multiple event handlers; token attribution awaits workflow store and artifact scans. Repo-files manifest measured 61 MB, 9438 revisions, 4468 receipts, and observed a live OMP process holding its lock; correlation is not proof of the specific timed-out handler. Do not remove a live lock.

Pre-conversion checks: publish characterization 13 passed; browser packed-report behavior 3 passed; installer/hooks/guardrails/sync 156 passed; packer 22 passed. Tests require mutation checks.
