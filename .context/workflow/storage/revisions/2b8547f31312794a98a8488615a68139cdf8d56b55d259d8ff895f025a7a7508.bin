---
status: active
date: 2026-08-20
subject: 2026-08-20.deterministic-extension-progress
topics: [extensions, tui, progress, b-pr-improved, b-commit-improved, b-kamal-release, execFile]
research: []
iterations: []
memory: []
---

# Plan: Live progress for deterministic slash commands

## User Goal

When I run `/b-pr-improved` (or `/b-commit-improved` / `/b-kamal-release`),
the TUI shows that the command is working — phase-level progress, not a
frozen last-command line until it suddenly finishes.

*(Synthesized from the 2026-08-20 request.)*

## Goal

Make the three wired deterministic command extensions report live phase
progress on OMP/Pi **while they run**, by:

1. emitting a visible progress line **before** the first long operation, and
2. not blocking the TUI event loop during long children.

## Context used / assumptions

- **User-provided context:** no feedback until done; `/b-pr-improved` looks
  frozen. Use async `execFile` so TUI updates can paint. Kamal deploy output
  is a full docker build plus Kamal noise — buffering all of it is a risk and
  unused.
- **Session context:** OMP TUI. Capability probe `full` (`b-build`, `b-review`,
  `b-save` in the system available-skills catalog). New subject.
- **Locked decisions:**
  1. **Small, finite output** (bun preflight JSON, git push, `gh pr create`,
     git tag push): `execFile` from `node:child_process/promises`.
  2. **`kamal deploy`:** `spawn`. Never `execFile` (1 MiB `maxBuffer` is a
     docker-build risk). Never concatenate the full log.
  3. **Kamal stdout/stderr consumers today:** success path discards `output`
     entirely (`✅ Deployed …`). Failure path uses `output.split("\n").slice(-20)`.
     So the only thing worth keeping is a **last-N-line ring for the failure
     notify**. Drop chunks as they arrive otherwise. Do not stream Kamal lines
     into the chat (phase label only: `Deploying <tag>…`).
  4. Progress is **phase labels**, not live child stdout.

### Why it looks frozen (verified against OMP)

| Mechanism | What actually happens |
|---|---|
| `execFileSync` for bun preflight / git push / `gh pr create` | Blocks the Node event loop. `requestRender()` cannot paint. |
| First `notify` only after preflight | Zero UI during the long wait. |
| `ctx.ui.setWorkingMessage` | Custom slash commands never call `ensureLoadingAnimation()`. Message is stored and **never shown**. Not the primary surface. |
| `notify("…", "info")` | Chat transcript dim status line. Consecutive info notifies **replace** the previous line. |
| `setStatus(key, text)` | Footer. Needs an event-loop tick. |

### Child-process split

| Child | API | Output |
|---|---|---|
| bun preflight, git push, `gh pr create`, git tag push | async `execFile` | Full stdout needed (JSON / URL / git errors). Small. |
| Short git reads (`rev-parse`, `status --porcelain`, `log -1`) | `execFileSync` OK | Milliseconds. |
| `kamal deploy` | `spawn` | Exit code + last ~20 lines on failure. Nothing on success. |

Handlers are already `async`. `await execFile(...)` after `notify(...)` is
enough for a paint tick.

Non-zero `execFile` **rejects** with `ExecFileException` (`error.stdout`,
`error.stderr`, `error.code`). Wrapper must capture stdout the same way
today's `execFileSync` catch reads `err.stdout` / `err.status` (preflight
JSON on exit 2/3).

## Scope

- Shared progress helper + `execFileCaptured` under `extensions/`.
- Apply to `b-pr-improved`, `b-commit-improved`, `b-kamal-release`.
- Kamal: last-N ring only; delete unbounded `output += chunk`.
- Tests: progress before child; nonzero preflight still parses JSON;
  kamal helper retains ≤ N lines; headless does not throw.

## Out of scope

- Streaming child stdout into the chat (including kamal build lines).
- Persisting kamal logs to a file.
- Skill fallbacks (already stream as agent tool calls).
- b-flow, b-grill-auto, tps-tracker.
- Teaching `setWorkingMessage` to create a loader (no extension API).
- Making every one-line git helper async.

## Affected files

- `extensions/command-progress.ts` — **new**: `createProgress`, `execFileCaptured`
- `extensions/command-progress.test.ts` — **new**
- `extensions/b-pr-improved/index.ts` + `__tests__/wire.test.ts`
- `extensions/b-commit-improved/index.ts` + `__tests__/wire.test.ts`
- `extensions/b-kamal-release/index.ts` + `__tests__/wire.test.ts`

No `extensions/index.ts` wiring change.

## Implementation steps

1. **`execFileCaptured(bin, args, cwd)`**
   - Wrap `execFile` from `node:child_process/promises`.
   - Always resolve `{ code, stdout, stderr }` (nonzero captured, not thrown)
     so preflight keeps "JSON on stdout + nonzero exit".
   - Throw-on-fail callers (git push, gh) check `code` and throw with stderr.
   - `encoding: "utf-8"`. Do not raise `maxBuffer`. Never used for kamal.

2. **`createProgress(ctx, key)`**
   - `step(label)`: `notify(label, "info")` (primary); `setStatus?.(key, label)`;
     `setWorkingMessage?.(label)` best-effort no-op.
   - `fail` / `done` / `clear`: warning/error or final info; clear footer.
   - Handlers wrap in `try/finally` → `progress.clear()`.

3. **`b-pr-improved`**
   - `runPreflight` / push / `gh pr create` → async `execFileCaptured`.
   - Steps: `preflight…` → conflicts → `Pushing <branch>…` →
     `Synthesizing PR description…` → `Creating PR with gh…` → `✅`.

4. **`b-commit-improved`**
   - Async preflight. `Drafting commit message…` on the model path.
   - `Committing…` then existing final notify.
   - Leave `git commit` sync unless smoke shows hook hang.

5. **`b-kamal-release`**
   - `createProgress` before tag / tag-push / deploy.
   - Tag-push via `execFileCaptured`.
   - `runKamal`: `spawn`; ring buffer of last ~20 lines (constant matching
     today's `.slice(-20)`). Success: ignore the ring. Failure: notify those
     lines. `stdio` stay piped so the child cannot block on a full pipe —
     consume and discard except the ring.
   - One `finally` clears progress.

6. **Tests**
   - `execFileCaptured`: exit 0 stdout; exit 3 still returns stdout (tiny
     `node -e` / `bun -e` child).
   - Existing dry-run / cache-miss tests still `await` and pass.
   - First notify matches `/preflight/i` before a deferred child resolves.
   - Kamal ring: feed more than N lines, assert retained length ≤ N.

## Acceptance criteria

- [x] `/b-pr-improved` emits a chat status line **before** bun preflight starts.
- [x] Preflight, push, `gh pr create`, tag push use async `execFile`, not
      `execFileSync`.
- [x] `kamal deploy` stays `spawn`; full log is not held; failure report is
      last N lines; success does not print Kamal output.
- [x] Command handlers `await` async children; no floating promises.
- [x] Nonzero preflight still parses JSON from captured stdout (exit 2/3).
- [x] Footer `setStatus` cleared on return.
- [x] Headless: missing optional UI methods do not throw.
- [x] Existing wire tests pass; new tests cover progress-before-child,
      captured nonzero exit, and bounded kamal tail.
- [x] No live git/gh/kamal log spam on the happy path.

## Verification

- Unit: vitest on the three `wire.test.ts` files + `command-progress.test.ts`.
- Smoke (manual OMP): `/b-pr-improved --dry-run` — dim `preflight…` appears
  **while** bun is still running. Same for `/b-commit-improved --dry-run`.
- Do not claim TUI liveness from unit tests alone.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next turn.

## Risks

- **`setWorkingMessage` still invisible** on custom commands. Primary surface
  is `notify` → chat status line.
- **Wrong error field** (`status` vs `code`) on promisified `execFile` breaks
  conflict/protected-branch paths. Wrapper must normalize.
- **Kamal pipe deadlock:** must read stdout/stderr (discard into the ring) so
  a verbose docker build cannot fill the pipe and stall. `stdio: "ignore"`
  would also avoid deadlock but then the failure notify has no tail — keep
  piped + ring.
- **Info-notify replacement** hides earlier phase text. Intended.
- **git commit hooks** can still block if left sync. v1 accept unless smoke
  shows it.
