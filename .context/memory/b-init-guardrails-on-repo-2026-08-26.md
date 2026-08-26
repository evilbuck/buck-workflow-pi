---
date: 2026-08-26
domains: [quality, tooling, testing]
topics: [b-init-guardrails, guardrails.json, vitest, lizard, coverage, patch-gate]
subject: 2026-08-26.b-init-guardrails-on-repo
artifacts:
  - index.md
related:
  - guardrails.json
  - AGENTS.md
  - vite.config.ts
  - package.json
priority: high
status: completed
---

# /b-init-guardrails + first /b-guardrails-check on this repo

`.context/workflow/current-session.json` is **stale** — it still points at `2026-08-20.deterministic-extension-progress` / `b-build` from 2026-08-23 (`save_completed: false`). This save records the 2026-08-26 guardrails init, not that session.

## User decisions

- No Playwright / browser e2e gate. `tests/e2e/example.spec.ts` is a b-build template (`goto('/')`, `#some-button`); `playwright.config.ts` has webServer off.
- Detector `playwright test` and `pytest tests/e2e` are false positives here (`tests/e2e/` is Playwright TS, pytest is not installed).
- Unit + (future) functional is enough. Recorded `functional_test_cmd: null`.
- Lint skipped (no eslint/oxlint/biome). Python/Shell ecosystems detected with all commands `null`.

## Contract (`guardrails.json` v2)

- TypeScript: `vitest run`; coverage `vitest run --coverage --coverage.reporter=lcov`; lizard; `lint_cmd` null; `functional_test_cmd` null
- `git_compare_branch: origin/master`
- Coverage baseline **54.9%** (1172/2133 LH/LF)
- Complexity inventory **34** functions CCN > 10 (inline)
- `baseline_lint_clean: null`

## Tooling

- Added `@vitest/coverage-v8`
- `vite.config.ts` excludes bun:test suites so Vitest stays green:
  - `skills/b-auto-fix/scripts/auto-fix.test.ts`
  - `skills/b-memory-import/scripts/import-context-memory.test.ts`
  - `skills/b-hindsight-import-projects/scripts/import-projects.test.ts`
  Those **79** tests pass under `bun test` and are **not** in the unit gate
- `coverage/` gitignored
- Managed AGENTS.md block appended once

## First check verdict

`status: fail` because **patch_gate 51%** (threshold 90%). 149 changed lines vs `origin/master` + dirty tree, 72 missing:

| File | Patch cover |
|---|---|
| `extensions/b-kamal-release/index.ts` | 0% |
| `extensions/b-pr-improved/index.ts` | 39% |
| `extensions/b-commit-improved/index.ts` | 80% |
| `extensions/command-progress.ts` | 95.8% |

Unit 307 pass. Global ratchet pass (equal baseline). Complexity 34/34, no new violations. Check did not edit.

## Follow-ups

- Backlog: patch-gate coverage on those four extension files (branch vs origin/master)
- `first-npm-publish` still open; `npm test` (`vitest run`) is now 307/307 after the bun excludes — original auto-fix failure is no longer in that gate
