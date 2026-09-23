---
title: Fix macOS /tmp-symlink realpath mismatches blocking the required unit-test gate
status: active
priority: high
created: 2026-09-23
updated: 2026-09-23
completed: null
related:
  - scripts/serve-presentations.ts
  - scripts/serve-presentations.test.ts
  - scripts/hooks.mjs
  - scripts/hooks.test.mjs
  - extensions/code-review-iteration/__tests__/git-ops.test.ts
  - .context/memory/design-brief-blueprint-theme-2026-09-23.md
---

# Fix macOS /tmp-symlink realpath mismatches blocking the required unit-test gate

`bunx vitest run` on a clean checkout (`cf086f4`, no local changes) fails 10
tests across 3 files, all macOS-only, all pre-existing before 2026-09-23:

- `scripts/serve-presentations.test.ts` (5 failures) — `resolveRequestPath`
  compares a `realpathSync`'d target against a non-realpath'd root. macOS
  `os.tmpdir()` resolves under `/var/folders/...`, a symlink to
  `/private/var/folders/...`, so every legitimate nested request path fails
  the containment check and 403s. **Already diagnosed and fixed once** (see
  2026-09-23 session), then **reverted** to keep an unrelated theme-addition
  diff isolated — the fix itself is proven correct (26/26 green in isolation):
  realpath the root the same way the target is realpath'd, before the
  containment comparison; update the two test expectations that hardcode the
  non-realpath'd form to use the realpath'd root instead.
- `scripts/hooks.test.mjs` (4 failures) — same `/tmp` → `/private/tmp`
  realpath-vs-lexical mismatch in `resolveHooksDir`, plus one unrelated
  failure: `stat -c %a` is a GNU-only flag and returns an empty string under
  macOS BSD `stat` (needs `stat -f %Lp` or a cross-platform branch).
- `extensions/code-review-iteration/__tests__/git-ops.test.ts` (1 failure) —
  disposable detached worktree cleanup; not investigated.

**Why this matters:** `guardrails.json`'s `unit_test_gate`/`global_ratchet`
are `required`. Any session that touches non-docs code in this repo on macOS
currently cannot obtain a clean `/b-guardrails-check` verdict without either
fixing these or recording an override, even when its own change is unrelated.

**Suggested fix shape:** apply the `serve-presentations.ts` realpath fix
verbatim (see the design-brief-blueprint-theme memory entry for the exact
diff), extend the same pattern to `resolveHooksDir` in `hooks.mjs`, switch the
`stat -c` invocation to a cross-platform check, and investigate the
`git-ops.test.ts` worktree-cleanup failure separately.
