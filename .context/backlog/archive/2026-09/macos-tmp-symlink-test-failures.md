---
title: Fix macOS /tmp-symlink realpath mismatches blocking the required unit-test gate
status: completed
priority: high
created: 2026-09-23
updated: 2026-09-23
completed: 2026-09-23
related:
  - scripts/serve-presentations.ts
  - scripts/serve-presentations.test.ts
  - scripts/hooks.mjs
  - scripts/hooks.test.mjs
  - extensions/code-review-iteration/git-ops.ts
  - extensions/code-review-iteration/__tests__/git-ops.test.ts
  - .context/memory/design-brief-blueprint-theme-2026-09-23.md
---

# Fix macOS /tmp-symlink realpath mismatches blocking the required unit-test gate

Fixed on branch `fix/macos-tmp-symlink-realpath` (commit `a0bf7b5`, base
`master@f4fd02b`), separate from the `feat/design-brief-blueprint-theme`
branch that surfaced it.

`bunx vitest run` on a clean checkout (`cf086f4`, no local changes) failed 10
tests across 3 files, all macOS-only:

- `scripts/serve-presentations.test.ts` (5 failures) — `resolveRequestPath`
  compared a `realpathSync`'d target against a non-realpath'd root; fixed by
  realpathing the root the same way.
- `scripts/hooks.test.mjs` (4 failures) — same `/tmp` → `/private/tmp`
  realpath-vs-lexical mismatch in the tests' expected-value construction (the
  function itself, via git's own `--absolute-git-dir`, was already correct),
  plus one unrelated GNU-only `stat -c` invocation that returned an empty
  string on macOS BSD `stat` and silently passed by comparing two empty
  strings — replaced with `fs.statSync`.
- `extensions/code-review-iteration/__tests__/git-ops.test.ts` (1 failure) —
  `gitCommonDir` returned an absolute-but-not-realpath'd path when git
  reported a relative `--git-common-dir` (main checkout) but an
  already-realpath'd absolute path for a worktree; fixed by realpathing the
  function's result in both branches.

Also added one dedicated symlinked-root/repo regression test per fixed
function, so the fix is exercised deterministically even on Linux CI where
the host tmpdir isn't itself behind a symlink (the original bug only
manifested on macOS and had zero prior coverage).

**Verified:** full suite 942/942 (10 more than the pre-fix 932/942); durable
guardrails on the fix branch: `unit_test_gate` pass, `global_ratchet` pass,
`complexity_gate` pass, coverage 85.6%.
