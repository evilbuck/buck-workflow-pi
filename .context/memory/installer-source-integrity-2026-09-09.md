---
date: 2026-09-09
domains: [install, tooling, testing]
topics: [installer, verify-mode, source-root, symlink, complexity-ratchet, main-module-guard]
related: ["scripts/install.mjs", "scripts/install.test.mjs"]
priority: medium
status: active
subject: 2026-09-09.installer-source-integrity
artifacts:
  - scripts/install.mjs
  - scripts/install.test.mjs
  - README.md
  - agent-install_instructions.md
  - .context/2026-09-09.installer-source-integrity/plan-installer-source-integrity.md
---

# Installer source integrity — implementation

Built `plan-installer-source-integrity.md` with TDD. All eight plan steps landed.

## What shipped

- `isInsideRoot(target, root)` — separator-guarded containment (`/x/repo-old` is not inside `/x/repo`).
- `ensureSymlink(..., { sourceRoot, relPath })` — a relink whose previous target resolves outside `sourceRoot` returns `crossRoot: true` + `oldRoot` and a message naming both roots. Relative link targets are resolved against the link's own directory first. Omitting `sourceRoot` preserves the original behavior, so the 37 pre-existing tests still pin it.
- `enumerateSurfaces()` — one traversal shared by `install()` and `verifySurfaces()` so the two can never disagree about what should exist.
- `verifySurfaces()` + `--verify` — read-only; states `linked-here | linked-elsewhere | dangling | real-file | missing`, distinct-root inventory, exit 1 on any problem.
- Copied bootstrap now reports as a copy with the `--force` remedy, instead of a generic conflict that a normal re-run silently skips.
- `summarize()` — run summary counts created + relinked + unchanged + moved-between-roots. The old line counted only created/skipped, so today's 90-link repair printed "11 linked, 3 skipped".

## Out-of-plan fix

The plan's own verification step exposed a silent no-op: the auto-run guard compared `resolve(process.argv[1])` to `resolve(__filename)`. Those differ whenever the invocation path crosses a symlink (`/tmp` → `/private/tmp` on macOS, a symlinked home or checkout), so `node <path>/install.mjs` exited 0 having installed nothing. Extracted `isMainModule()` comparing `realpathSync` on both sides; guarded by a subprocess test that invokes the script through a symlinked directory.

## Decisions

- Cross-root relink **warns, does not block** — a `--force` gate would have blocked the legitimate one-command repair done earlier today.
- `--verify` **exits 1** on a split so it can be used as a script/CI guard.
- **No state file.** The filesystem is the source of truth; a manifest would drift and would not help pre-existing installs.
- CLI handlers (`runList`, `runVerify`, `runInstall`) are exported and tested in-process for exit codes and verdicts; exactly one subprocess test covers the entry point, because in-process v8 coverage cannot see a child process.

## Complexity ratchet

First measurement failed: `ensureSymlink` hit CCN 12 (new violation, ceiling 10) and `main` went 16 → 30 on a function already in `guardrails.json`'s baseline inventory. Refactored — `relink()` / `classifyExistingLink()` out of `ensureSymlink`, and `runList` / `runVerify` / `runInstall` / `describeProblem` / `printHarnessTallies` / `printVerifyVerdict` out of `main`. Max CCN in the file is now 9, so `scripts/install.mjs main` should drop out of the baseline inventory on the next ratchet update.

## Verification

- `npx vitest run` → 472 passed (27 files); `npm run test:bun` → 70 passed.
- `scripts/install.mjs` coverage 64.76% → **92.38% lines / 91.7% statements**.
- `uvx lizard -C 10 -w scripts/install.mjs` → no warnings (`lizard` is not on PATH directly; `uvx lizard` works).
- Live split smoke: copied the repo to `/tmp/bw-split`, installed codex from it → cross-root warning naming both roots + "1 moved from another source root"; `--verify` from the dev repo → codex `linked-elsewhere`, 2 roots, exit 1; repaired and re-verified → 1 root, exit 0. Fixture removed.
- `--help`, `--list`, `--dry-run`, `--verify` all exercised against the real machine.
