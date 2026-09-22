---
date: 2026-09-21
domains: [extensions, testing, tooling]
topics: [buck-loop, dirty-tree, rpc, timeout, herdr, plugin-provenance]
related: []
priority: high
status: completed
subject: 2026-09-21.buck-loop-midrun-deadlock
artifacts:
  - research-buck-loop-midrun-deadlock.md
  - iterate-buck-loop-midrun-deadlock.md
  - draft-commit.md
---

# Buck-loop dirty-tree iteration

Resolved every finding in `iterate-buck-loop-midrun-deadlock.md`.

## Decisions

- Dirty-tree confirmation uses the host's full dialog-options contract with a 30-second timeout and an `AbortSignal`. Timeout, cancellation, and dialog errors deny.
- RPC remains UI-capable because `ctx.hasUI` is true there; print/JSON modes deny because they have no UI.
- `--resume` validates that a saved projection exists before asking the operator to approve dirty paths.
- Denial text now works for both an explicit decline and a client that cannot display the prompt.
- The presentation path regression uses a deliberately symlinked served root so deleting root canonicalization makes the test fail.

## Verification

- Red phase: three targeted tests failed against the prior implementation — missing dialog options/timeout, dirty resume without a projection still prompted, and RPC-style confirmation remained pending.
- Focused regression run: 69/69 passed across `wire.test.ts`, `loop.test.ts`, and `serve-presentations.test.ts`.
- Changed-area run: 222/222 passed across all `extensions/buck-loop` tests plus `scripts/serve-presentations.test.ts`.
- Live Herdr test in the active `lever.data-api` pane: restarted OMP after linking this checkout, ran `/buck-loop --resume`, and observed the 30-second countdown with the exact `docs/cycles/2026-09-21-RMAPSH-1740-per-user-auth.md` path. A deliberate No verified the denial path. After the user clarified that this loop-owned output must not stop the run, a second resume selected Yes and advanced into the real `b-build-hard` child; the live activity stream showed reads and edits under `Building phase-1-auth-spike-and-design-note.md`.
- Repository lint is disabled in `guardrails.json`. Whole-repository `tsc --noEmit` is not a project gate and still reports 112 pre-existing diagnostics across unrelated Bun scripts/extensions; no changed file appeared in its diagnostic list.

## Files modified

- `extensions/buck-loop/index.ts`
- `extensions/buck-loop/loop.ts`
- `extensions/buck-loop/__tests__/wire.test.ts`
- `extensions/buck-loop/__tests__/loop.test.ts`
- `scripts/serve-presentations.test.ts`
- `docs/adr/0002-observably-invoked-happy-path-loop.md`
- `.context/2026-09-21.buck-loop-midrun-deadlock/iterate-buck-loop-midrun-deadlock.md`
- `.context/2026-09-21.buck-loop-midrun-deadlock/draft-commit.md`

## Environment note

`omp plugin list` originally resolved `buck-workflow@0.2.0` under `~/.omp/plugins/node_modules`. `omp plugin link .` replaced that package with a symlink to this checkout. `/reload-plugins` still retained the old module in the active process; restarting OMP with `--continue` loaded the current source.

## Next

Run `/b-review` against `.context/2026-09-21.buck-loop-midrun-deadlock/research-buck-loop-midrun-deadlock.md`, then `/b-save` and `/b-commit` if review passes.
