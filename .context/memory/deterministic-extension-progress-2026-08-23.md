---
date: 2026-08-23
updated: 2026-08-25
domains: [extensions, tui, testing]
topics:
  - b-pr-improved
  - b-commit-improved
  - b-kamal-release
  - command-progress
  - execFile
  - spawn
  - tui-progress
  - kamal
  - iteration
subject: 2026-08-20.deterministic-extension-progress
artifacts:
  - extensions/command-progress.ts
  - extensions/command-progress.test.ts
  - extensions/b-pr-improved/index.ts
  - extensions/b-pr-improved/__tests__/wire.test.ts
  - extensions/b-commit-improved/index.ts
  - extensions/b-commit-improved/__tests__/wire.test.ts
  - extensions/b-kamal-release/index.ts
  - extensions/b-kamal-release/__tests__/wire.test.ts
  - .context/2026-08-20.deterministic-extension-progress/plan-deterministic-extension-progress.md
  - .context/2026-08-20.deterministic-extension-progress/iterate-deterministic-extension-progress.md
  - .context/2026-08-20.deterministic-extension-progress/draft-commit.md
related: []
priority: high
status: active
---

# Live TUI progress for deterministic slash commands

## Current State

The initial build makes `/b-pr-improved`, `/b-commit-improved`, and
`/b-kamal-release` report phase-level progress while their long children run:

- `createProgress` sends the visible info notification before awaited work.
- Small finite children use promisified `execFile`; `kamal deploy` stays on
  `spawn` with a last-20-line failure ring.
- `--dry-run` remains usable without Kamal installed because PATH detection
  occurs only at deploy time.

## Files Modified

- `extensions/b-kamal-release/index.ts`
- `extensions/b-kamal-release/__tests__/wire.test.ts`
- `.context/2026-08-20.deterministic-extension-progress/iterate-deterministic-extension-progress.md`
- `.context/2026-08-20.deterministic-extension-progress/draft-commit.md`

## Iteration: 2026-08-25

`b-review` found that a Kamal process terminated by a signal produced
`close(code=null)`, which `runKamal` mapped to success. The fix keeps the
signal, maps a missing numeric exit code to `1`, and reports the signal in the
error notification.

The regression test launches a separate Bun process with a fake `kamal` on
its initial `PATH`; it verifies a self-`SIGTERM` deploy never emits
`✅ Deployed` and instead reports `signal SIGTERM`.

## Decisions

- This Node 26 / Bun 1.3.14 build has no `node:child_process/promises`; use
  `promisify(execFile)`.
- Do not claim TUI liveness from unit tests. The manual OMP smoke remains
  required.
- A missing numeric `close` code is a failed process, never deployment success.

## Verification

Focused extension suite:

```text
npx vitest run extensions/command-progress.test.ts \
  extensions/b-pr-improved/__tests__/wire.test.ts \
  extensions/b-commit-improved/__tests__/wire.test.ts \
  extensions/b-kamal-release/__tests__/wire.test.ts
# 4 files, 57 tests passed
```

No `guardrails.json` exists, so the quality contract is ephemeral and has no
lint command. The required full `npm test` unit gate still fails outside this
iteration: 3 files / 23 tests fail in `skills/b-auto-fix` because `Bun` is
undefined in the Node Vitest process.

## Next

Run `/b-pr-improved --dry-run` and `/b-commit-improved --dry-run` in OMP to
observe `preflight…` before the child completes. Then run `/b-review` against
`plan-deterministic-extension-progress.md`; after it passes, run `/b-save`
and `/b-commit`.
