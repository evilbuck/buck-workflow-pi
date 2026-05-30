---
title: Fix b-flow test suite failures
status: completed
priority: medium
created: 2026-05-30
updated: 2026-05-30
completed: 2026-05-30
related: []
---

# Fix b-flow Test Suite Failures

## Description

The test files in `extensions/b-flow/__tests__/` are failing because they use `node:test` globals instead of vitest globals.

## Context

- **Failing files**:
  - `extensions/b-flow/__tests__/guards.test.ts`
  - `extensions/b-flow/__tests__/integration.test.ts`
- **Root cause**: These files import from `node:test` and use `test()` and `assert` directly, but vitest expects `describe`/`it`/`expect` globals
- **Error**: `No test suite found in file` — vitest doesn't recognize the `node:test` syntax
- **Priority**: Medium — these tests haven't run in a while, were likely broken during vitest migration or setup

## Technical Notes

The b-flow extension was added in commit `addb759`. The tests work correctly with `node:test` runner but fail when run through vitest. Options:
1. Migrate tests to vitest syntax (change imports and assertion style)
2. Configure vitest to properly handle these files
3. Exclude these files from vitest and run separately

## Related Work

- Commit `addb759` introduced the failing tests
- Other tests in the repo use vitest (see `extensions/buck-mode.test.ts`)
