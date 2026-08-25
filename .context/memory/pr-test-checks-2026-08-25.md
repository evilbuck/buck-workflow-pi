---
date: 2026-08-25
domains: [ci, testing, github]
topics: [pull-requests, github-actions, vitest, bun, test-gate]
related: [npm-publish-readiness-2026-08-12]
priority: high
status: completed
subject: 2026-08-25.pr-test-checks
artifacts: [.github/workflows/test.yml, package.json, vite.config.ts, extensions/b-kamal-release/index.ts, extensions/b-commit-improved/__tests__/wire.test.ts, .context/2026-08-25.pr-test-checks/plan-pr-test-checks.md]
---

# GitHub pull-request test checks

## Decision

Run all repository tests from `npm test` using each suite's required runtime:
Vitest covers Node-compatible suites; Bun runs the two suites that depend on
`Bun` or `bun:test`. The pull-request workflow installs Bun, installs the
lockfile with `npm ci`, and executes that single contract.

## Failure classification

- Auto-fix and context-memory-import failures were **invalid Vitest runs**, not
  invalid tests. Both suites passed under Bun, so they were removed from Vitest
  collection and retained under `test:bun`.
- Kamal dry-run failures were **valid**: dry-runs should provide their release
  plan without requiring a deploy executable. `kamal` is now checked only
  after dry-run exits and before any tag mutation.
- The root fallback-draft failure was an **invalid assertion** against the
  process cwd; it now checks the `cwd` argument documented by the function and
  retains behavior coverage.
- b-pr preflight’s GitHub-authentication probe was an **invalid dependency**:
  it is not used by candidate discovery or rebase preflight, and made the
  otherwise deterministic tests depend on developer credentials. Removed it.

## Verification

`npm ci && npm test` passed: 19 Vitest files / 311 tests and 63 Bun tests.

## Files modified

- `.github/workflows/test.yml`
- `package.json`
- `vite.config.ts`
- `extensions/b-kamal-release/index.ts`
- `extensions/b-commit-improved/__tests__/wire.test.ts`
- `.context/2026-08-25.pr-test-checks/plan-pr-test-checks.md`
- `.context/2026-08-25.pr-test-checks/index.md`
- `.context/backlog/items/first-npm-publish.md`
- `.context/memory/index.md`
- `.context/workflow/current-session.json`

