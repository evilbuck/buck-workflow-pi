---
title: Heal commands/ mirror drift — 8 real files instead of symlinks
status: completed
priority: medium
created: 2026-09-16
updated: 2026-09-18
completed: 2026-09-18
related:
  - commands/
  - prompts/
  - docs/extension-loading.md
  - skills/cross-platform-pi-omp-loading/slash-command-mirror/SKILL.md
---

# Heal commands/ mirror drift

## Problem

The `prompts/` ↔ `commands/` symlink mirror (prompts = source of truth) has drifted. As of 2026-09-16, `commands/` has 44 entries: 36 symlinks + **8 real files**.

**Diverged twins (4)** — full body in `prompts/`, thin skill-loader stub in `commands/`:
- `b-pr.md`
- `b-pr-review-2-issues.md`
- `b-commit-improved.md`
- `b-save-improved.md`

Pi users get the full prompt; OMP users get the stub. Both work, but the bodies differ.

**OMP-only commands (4)** — real file in `commands/`, no `prompts/` twin, so Pi never registers them as slash commands:
- `b-kamal-release.md`
- `b-pr-improved.md`
- `git-clean-orphans.md`
- `product-tour.md`

## Desired outcome

One source of truth per command, symlinked.

- For OMP-only files: write a real `prompts/<name>.md` body, then `rm commands/<name>.md && ln -s ../prompts/<name>.md commands/<name>.md`.
- For diverged twins: pick the intended body (full prompt vs loader stub), put it in `prompts/`, symlink `commands/` to it. Note the `*-improved` stubs document the extension-command fallback path — if that wording matters on both runtimes, the stub body is the one to keep.

## Notes

- Documented (not fixed) in `docs/extension-loading.md` § Cross-Platform Slash Command Pattern, "Current exceptions" on 2026-09-16.
- The `slash-command-mirror` skill's drift-mitigation section assumes all-symlinks; refresh it when this lands.
