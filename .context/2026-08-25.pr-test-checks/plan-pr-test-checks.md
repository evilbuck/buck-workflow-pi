---
date: 2026-08-25
domains: [ci, testing, github]
topics: [pull-requests, github-actions, vitest]
related: []
priority: high
status: completed
subject: 2026-08-25.pr-test-checks
artifacts: [.github/workflows/test.yml, package.json, vite.config.ts, extensions/b-kamal-release/index.ts, extensions/b-commit-improved/__tests__/wire.test.ts]
memory: [pr-test-checks-2026-08-25.md]
---

# Run unit tests in GitHub pull-request checks

## User goal

Run the repository's unit test command automatically as a visible GitHub check
for every pull request.

## Finding

The repository had no `.github/` directory or GitHub Actions workflow. Its
canonical unit-test command is `npm test`, which runs `vitest run`.

## Implementation

Add one GitHub Actions workflow that:

- triggers for every `pull_request`, so its `Unit tests` job appears in PR
  checks;
- installs the lockfile-resolved dependency set with `npm ci`;
- runs the existing `npm test` contract under Node 22 with npm cache enabled.

## Repair scope

Classify each current `npm test` failure before changing code:

- retain tests that assert a real contract and repair their runner, fixture, or
  implementation;
- remove only tests whose assertion contradicts the production contract and
  leaves equivalent meaningful coverage;
- make `npm test` green before committing the GitHub workflow.

## Failure classification

- **Valid Bun tests:** auto-fix and context-memory-import tests require Bun APIs
  and pass under `bun test`; they were invalidly collected by Vitest.
- **Valid Kamal dry-run assertions:** dry runs must validate configuration and
  render the release plan without requiring the deploy executable. The runtime
  check now occurs after dry-run and before tag creation.
- **Invalid fallback assertion:** the test checked a relative returned path
  against the process cwd, contradicting the function's explicit `cwd`
  argument. The assertion now checks that supplied repository root while
  retaining fallback-draft coverage.
- **Valid CI isolation tests:** b-pr preflight only uses Git state; requiring
  GitHub authentication made base-candidate discovery and rebase checks depend
  on a developer's local login. The unused authentication probe was removed.
- **Valid worktree tests:** their temporary repositories must not inherit a
  developer's Git identity. The fixture now supplies a commit-scoped identity
  explicitly, removing the CI-only dependency.

## Verification

- `npm ci && npm test` — passed: 19 Vitest files / 311 tests, then 63 Bun
  tests.
- The workflow installs Bun before Node dependencies and invokes that same
  `npm test` contract for every pull request.
