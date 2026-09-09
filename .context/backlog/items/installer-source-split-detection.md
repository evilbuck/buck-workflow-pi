---
title: Installer cannot detect or warn about a split source root
status: active
priority: medium
created: 2026-09-09
updated: 2026-09-09
completed: null
related:
  - scripts/install.mjs
  - scripts/install.test.mjs
  - agent-install_instructions.md
  - .context/memory/install-source-consolidation-2026-09-09.md
---

# Installer silently splits harnesses across two checkouts

## Gap

`install()` resolves `source` from the script's own location (`scripts/install.mjs:28,188`). Running the installer from a second checkout repoints whatever harnesses it detects at that checkout, and `ensureSymlink` (`:129-142`) replaces a link pointing at a *different source root* with nothing but a `Replaced stale link` line. There is:

- no persisted record of the source root a previous run used,
- no warning when the incoming source differs from the existing target's root,
- no way to see current state — `--list` prints detected harnesses plus the *current run's* source, not each destination's actual target.

Result: harnesses silently resolve to different checkouts. Observed 2026-09-09 — Claude Code read `~/.local/share/buck-workflow-pi` (stuck at `c6859ec`) while OMP/Pi read the dev repo. Only `ls -l` exposed it.

Related smaller trap: a bootstrap installed with `cp` is a real file, so it hits the `conflict` branch (`:146-151`) and is *skipped* by a normal re-run — stale and self-perpetuating until someone passes `--force`.

## Why it matters

The whole point of the symlink installer is "one source of truth, `git pull` updates every harness". A split install defeats that and is undetectable without manual inspection, so the failure mode is silent stale instructions — exactly the drift the installer was written to fix.

## Fix

1. Add a `--verify` (or `--status`) mode that prints, per detected harness and surface, `dest → resolved target` plus whether the target is inside the current source root. No writes.
2. In `ensureSymlink`, distinguish "stale link within the same source root" (quiet replace) from "link points at a *different* root" (loud warning naming both roots, or require `--force`).
3. Flag real-file destinations as `copy detected — re-run with --force to convert to a symlink` rather than the generic conflict message.

Cover each with a case in `scripts/install.test.mjs` (currently 37 tests, all passing under `npx vitest run`).
