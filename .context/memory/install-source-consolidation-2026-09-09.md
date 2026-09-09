---
date: 2026-09-09
domains: [install, docs, tooling]
topics: [installer, symlink, bootstrap-drift, source-root, agent-install-instructions, harness-wiring]
related: ["scripts/install.mjs", "agent-install_instructions.md", "README.md"]
priority: medium
status: completed
subject: 2026-09-09.review-response-style
artifacts:
  - agent-install_instructions.md
  - README.md
---

# Install source consolidation and symlink-not-copy instructions

Follow-on from the response-style consolidation: Claude Code was reading a *different checkout* of this project than OMP/Pi. Root-caused, fixed, and the install docs corrected.

## Root cause

Not a Claude Code behavior — Claude's surfaces are declared like every other harness (`scripts/install.mjs:56-65`). The installer's source defaults to its own location:

```js
const REPO_ROOT = resolve(__dirname, "..");   // install.mjs:28
source = REPO_ROOT                             // install.mjs:188
```

It had been run twice from two checkouts: Sep 2 from `~/projects/development_tools/buck-workflow-pi` (wired OMP) and Sep 3 from a second clone at `~/.local/share/buck-workflow-pi` (wired Claude). `ensureSymlink` (`:129-142`) silently replaces a link that points at a different source root — no warning, no record of the previous root, and `--list` shows only the *current* run's source. So a split install is invisible short of `ls -l`.

`~/.pi/agent/AGENTS.md` was a third case: a plain `cp` from the old README instruction, which also hits the `conflict` branch (`:146-151`) and is therefore *skipped* by a normal re-run — stale and self-perpetuating.

## What changed

- Ran `node scripts/install.mjs` from the dev repo. All four bootstraps (`~/.claude/CLAUDE.md`, `~/.omp/agent/AGENTS.md`, `~/.pi/agent/AGENTS.md`, new `~/.codex/AGENTS.md`) plus all Claude commands/skills now resolve to the dev repo. Zero `~/.local/share` links remain. Second run: `0 linked, 90 skipped` (idempotent).
- `agent-install_instructions.md`: new `## Bootstrap wiring — symlink, never copy` section covering the from-GitHub durable-clone flow, the local-checkout flow via `--source`, and three rules (no `cp`, no cache/temp source, one source root for all harnesses + the `ls -l` audit command). Fixed five stale `Where things go` rows that said "copy" or omitted the global symlink: Pi, OMP, Claude, Codex (`~/.codex/AGENTS.md`), OpenCode (`~/.config/opencode/AGENTS.md`). Added the missing blank line before the install-method table so it renders.
- `README.md` §2: replaced `npx buck-workflow install` — the package is **not published** (`npm view buck-workflow` → 404), and once it is, npx would symlink out of an evictable cache — with the durable-clone/`node scripts/install.mjs` form, plus the same three rules.

## Decisions

- Bootstrap wiring is always a symlink into a **durable** checkout. Copies drift silently and block their own repair.
- One source root for every harness. Most users install straight from GitHub, so the canonical instruction is `git clone … ~/.local/share/buck-workflow-pi` then run the installer from there; a dev checkout uses `--source` or is simply the cwd.
- Do not document `npx`/`pnpm dlx` for the installer at all — cache eviction leaves dangling links.

## Verification

- `readlink` on all four bootstraps → dev repo; `grep -c 'local/share/buck-workflow-pi'` in `~/.claude/{commands,skills}` → 0.
- Documented forms exercised: `node scripts/install.mjs`, `--dry-run --harness pi,omp`, `--dry-run --harness claude`.
- `npx vitest run scripts/install.test.mjs` → 37/37 pass. (Note: this suite is vitest, not `node --test`; running it under `node --test` throws a `@vitest/runner` `Cannot read properties of undefined (reading 'config')` — a harness error, not a failure.)
- Guardrails: docs-only session (`README.md`, `agent-install_instructions.md`, `.context/**`) → gate skipped per the Deterministic Check Contract.

## Known gap (not fixed)

The installer still cannot warn about a source-root split: no persisted record of the previous root, and `--list` prints detected harnesses plus the current source, not each destination's actual target. A `--verify`/status mode that prints `dest → resolved target` per harness would make this self-diagnosing.
