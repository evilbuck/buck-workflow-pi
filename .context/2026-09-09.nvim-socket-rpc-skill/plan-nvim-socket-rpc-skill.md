---
status: active
date: 2026-09-09
subject: 2026-09-09.nvim-socket-rpc-skill
topics: [nvim, rpc, agent-tools, skill-authoring]
research: []
iterations: []
memory: []
---

# Plan: nvim-socket-rpc skill (SKILL.md + Bun CLI tool)

## User Goal

An agent in any harness can reliably show, inspect, and navigate files in a user's *running* Neovim instance — opening files at exact lines, registering quickfix tours, and verifying what actually happened — without re-deriving fragile quoting incantations every session.

## Decision: not prompt-only — ship a Bun TS tool wrapped by SKILL.md

**Recommendation: SKILL.md + `scripts/nvim-ctl.ts` (Bun CLI).** Rejected alternatives with rationale:

| Option | Verdict | Why |
|---|---|---|
| SKILL.md only (prompt engineering) | Rejected | The hard part is structural, not knowledge: `--remote-expr` evaluates *Vimscript* (Lua `[[...]]` long-brackets parse as garbage → `E121`), current nvim builds removed the `nvim_exec_lua` Vimscript alias (`E117`), and every invocation re-rolls nested shell+Vimscript+Lua quoting. This exact failure class consumed three failed calls in one live session (2026-09-09, buck-cms). Prose cannot make quoting deterministic; code can. |
| SKILL.md + TS tool | **Selected** | Matches existing repo patterns: `b-auto-fix`, `b-memory-import`, `b-init-guardrails`, `pi-rpc`, `code-review` all ship executable scripts beside SKILL.md, several with tests. The deterministic core (transport, payload composition, readback) becomes testable; SKILL.md carries the judgment parts (etiquette, when-to-use, manual fallback). |
| OMP/Pi extension | Rejected | Extensions exist for runtime automation needing event hooks and session state. This is a standalone CLI any agent invokes from a shell; extension coupling would break cross-harness portability. Repo lesson from the b-flow deprecation: "no new extension-based orchestration." |
| Hand-rolled msgpack-RPC client | Rejected | ~200 lines of msgpack edge cases (EXT types, negative ints, str/bin headers) with zero benefit at agent call rates. Wrapping nvim's own stable `--server` CLI surface is boring and survives API drift better. Recorded as the alternative if `--remote-expr` proves limiting. |

The tool makes the two observed pitfall classes *impossible by construction*: it never emits `[[...]]` payloads and never calls `nvim_exec_lua`; the only carrier is `luaeval('(function() ... end)()')` with file-based Lua (`loadfile`).

## Context used / assumptions

- Live-session evidence (2026-09-09, buck-cms repo): drove the user's running instance at `/tmp/nvim.socket` — opened 6 files as tabs, set quickfix, positioned cursor; hit `E121` then `E117` before settling on `luaeval` + `loadfile`.
- Repo conventions confirmed: skills at `skills/<name>/` with optional `scripts/`; bun TS scripts + `bun test` files are gate-visible via the `test:bun` package script; utility skills ship without `prompts/`/`commands/` wrappers (`run-in-idle-pane`, `fix-pr`); pi-rpc is the style analog (`<skill_dir>` resolution, "When the helper is not enough", failure modes, files list).
- Durable guardrails contract v2: coverage baseline 54.9, CCN max 10 (hard 15). New functions must stay ≤10 CCN — design as small pure functions.
- Cross-platform: bun is not guaranteed on every harness machine (claude, codex, goose). SKILL.md must document the manual fallback path so the skill degrades gracefully.
- Assumption: name `nvim-socket-rpc`. A personal managed skill of the same name was minted in the author's omp during the live session; it must be retired after this repo skill ships and installs, to prevent divergence (cleanup step, not build scope).
- Assumption: the tool never exposes destructive surface (`:w`, `:q`, `:bd`, buffer writes) — etiquette is enforced by API shape, not prose alone.

## Scope

- `skills/nvim-socket-rpc/SKILL.md` — discovery, etiquette, quick start via `<skill_dir>`, subcommand reference, manual fallback recipes, pitfalls, API reference link (https://neovim.io/doc/user/api/#api-global).
- `skills/nvim-socket-rpc/scripts/nvim-ctl.ts` — Bun CLI (`#!/usr/bin/env bun`, `import.meta.main`), JSON stdout `{ ok, command, ... }`, subcommands:
  - `discover` — list candidate sockets (`$NVIM_LISTEN_ADDRESS`, `/run/user/<uid>/nvim.*.0`, `/tmp/nvim*.socket` style paths) with a timed liveness probe. Print every live socket; never pick one.
  - `ping --sock S` — connectivity + version readback. `--sock` is always required on every command except `discover`.
  - `open --sock S --file P...` — idempotent `tab drop`, one tab per file, last file focused, then readback
  - `goto --sock S --file P --line N` — `tab drop` (opens if missing) then `nvim_win_set_cursor` (1-based line, 0-based col), print readback
  - `eval --sock S --file L.lua` — `loadfile` the Lua file; Lua return value MUST go through `vim.json.encode` before crossing `--remote-expr`; TS `JSON.parse`s stdout
  - `qf --sock S --file items.json [--title T]` — `setqflist` from JSON array of `{ filename, lnum, text }`, report count
  - `verify --sock S` — readback current `bufname:line` + mode
  - Transport: `Bun.spawn` argv array (never `sh -c`); 5s timeout on every RPC; reject paths containing `"`, `'`, `\`, `$`, or newlines rather than escaping.
  - Every mutating subcommand performs a readback and prints it; exit non-zero with a readable message on RPC/transport/timeout error.
- `skills/nvim-socket-rpc/scripts/nvim-ctl.test.ts` — deterministic unit tests for pure parts (arg parsing, payload composition asserting the absence of `[[` and `nvim_exec_lua`, discover path enumeration, error mapping). No live nvim dependency.
- `package.json` — append the new test file to the `test:bun` script line.

## Out of scope

- OMP/Pi extension or slash-command wrapper (skill-only, per utility-skill precedent).
- msgpack-RPC client implementation.
- Destructive operations (write buffers, quit, delete buffers).
- Retiring the author's personal managed `nvim-socket-rpc` skill — done after this skill ships and installs (separate one-line step, tracked in backlog item).
- README/AGENTS.md skill inventory edits — owned by `/b-review` → `/b-docs` if flagged.

## Affected files

- `skills/nvim-socket-rpc/SKILL.md` (new)
- `skills/nvim-socket-rpc/scripts/nvim-ctl.ts` (new)
- `skills/nvim-socket-rpc/scripts/nvim-ctl.test.ts` (new)
- `package.json` (one-line edit to `test:bun`)

## Implementation steps

1. Scaffold `skills/nvim-socket-rpc/` with SKILL.md: frontmatter (`name`, `description` phrased for discovery: "drive a running Neovim", "show files in neovim", "open in nvim"), When-to-use, Quick start with `<skill_dir>` resolution (`bun <skill_dir>/scripts/nvim-ctl.ts`), subcommand table, etiquette (never quit/write the user's session; `tab drop` is idempotent; always read back; if `discover` returns >1 live socket, list them and do not guess), manual fallback for machines without bun (the `luaeval` + `loadfile` recipe verbatim), pitfalls section (`[[...]]` → E121, `nvim_exec_lua` alias removal → E117, cursor indexing 1-based/0-based), API doc link.
2. Implement `nvim-ctl.ts` as small pure functions (CCN ≤ 10 each): `buildLuaCarrier(path)` producing the `luaeval('(function() local f = loadfile("...") if not f then return vim.json.encode({ok=false,error="loadfile failed"}) end return vim.json.encode(f()) end)()')` string; `runNvimExpr(sock, expr)` via `Bun.spawn(["nvim","--server",sock,"--remote-expr",expr], { stdout, stderr })` with a 5s abort; per-subcommand handlers; JSON printer. Paths with forbidden characters: reject with a clear error rather than escaping.
3. Unit tests `nvim-ctl.test.ts`: carrier composition contains no `[[` and no `nvim_exec_lua`; carrier wraps return in `vim.json.encode`; discover enumerates `$NVIM_LISTEN_ADDRESS`, `/run/user/<uid>/nvim.*.0`, `/tmp/nvim*.socket`; subcommand arg parsing (missing `--sock`, missing `--file`); error mapping to non-zero exit text. Optional: if `nvim` is on PATH, a gated integration test may spawn `nvim --headless --listen <tmp-sock>` — never the user's GUI instance.
4. Add the test file to `package.json` → `scripts.test:bun`.
5. Headless smoke (throwaway instance, not the user's editor): `nvim --headless --listen /tmp/nvim-ctl-smoke.sock` → `discover` (must list it) → `ping` → `goto` a file in this repo → `qf` a two-entry tour → `verify` readback → kill the headless process. Record output as evidence. Do **not** drive `/tmp/nvim.socket` or any GUI instance during automated verification.
6. Run `npm test`, `bunx tsc --noEmit`, and `/b-guardrails-check` (durable contract). Hand off to `/b-review`.

## Acceptance criteria

- [ ] `nvim-ctl.ts ping|open|goto|eval|qf|verify` each require `--sock` and print JSON; `discover` lists live sockets and never selects one.
- [ ] Headless smoke (throwaway `--listen` socket) exercises the full subcommand set with readback. CI/`npm test` does **not** require a live nvim — unit tests stay deterministic.
- [ ] No code path can emit a `[[...]]` Lua long-bracket or an `nvim_exec_lua` call (unit-test enforced). Lua results cross the boundary only as `vim.json.encode` output.
- [ ] Tool exposes no destructive surface; SKILL.md etiquette section states the read/position/tour-only contract.
- [ ] SKILL.md manual fallback lets an agent without bun reproduce `goto` and `qf` with raw shell commands.
- [ ] `bun test skills/nvim-socket-rpc/scripts/nvim-ctl.test.ts` passes standalone and under `npm test`.
- [ ] No new function exceeds CCN 10; no guardrails gate regresses (coverage baseline 54.9 untouched).
- [ ] Headless smoke evidence recorded in the session memory with socket path and readback output.

## Verification

- `bun test skills/nvim-socket-rpc/scripts/nvim-ctl.test.ts` — deterministic, no live nvim.
- `npm test` — full repo gate (vitest + bun).
- `bunx tsc --noEmit` — clean.
- `/b-guardrails-check` — durable v2 contract, all gates pass.
- Headless smoke (build phase): throwaway `nvim --headless --listen` round-trip with readback evidence. Not the user's GUI instance.

## Execution Instructions

Non-phased, single-session, bounded. Treat the whole plan as one unit:
1. `/b-build` against this plan.
2. `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` cycle. If `/b-review` flags documentation impact, `/b-docs` before `/b-save`.
4. `/b-save`, then `/b-commit`.

## Risks

- **`--remote-expr` output framing varies** (multi-line Lua returns, error text split across streams). Mitigation: Lua always returns `vim.json.encode(...)`; TS `JSON.parse`s stdout; 5s timeout; verify command reads back via a second call.
- **API drift across nvim versions** (the `nvim_exec_lua` removal proves it happens). Mitigation: the tool depends only on `luaeval` (stable builtin), `vim.json.encode`, and nvim's CLI transport; unit tests pin the payload shape so drift fails loudly in CI rather than silently in a user session.
- **Socket ambiguity** (multiple nvim instances, stale socket files). Mitigation: `discover` probes liveness with a timeout, prints every live socket, never guesses; every other command requires explicit `--sock`.
- **Cross-harness machines without bun.** Mitigation: documented manual fallback; skill remains useful prompt-only in the worst case.
- **Duplicate guidance divergence** with the author's managed skill. Mitigation: retire the managed copy immediately after repo install; backlog item tracks it.

## Plan review (2026-09-09)

Reviewed as a design document before `/b-build`. Architectural decision (SKILL.md + Bun CLI, not prompt-only, not an extension, not msgpack) stands. Corrections applied above:

1. **No implicit `--sock`.** The CLI is stateless; "except after discover/ping" was a contradiction. `--sock` is required on every command except `discover`.
2. **Don't smoke against the user's editor.** Automated verification uses a throwaway `nvim --headless --listen`. Driving `/tmp/nvim.socket` during tests violates the skill's own etiquette.
3. **`luaeval` is not JSON.** Returns must pass `vim.json.encode` on the Lua side; TS parses JSON. Otherwise tables stringify as Vimscript dicts.
4. **Spawn argv, never a shell; 5s timeout.** `--remote-expr` hanging on a stale socket must fail, not block the agent.
5. **`goto` tab-drops first.** Otherwise a closed file is a silent miss. Same as the live session that worked.
6. **Pin schemas.** QF items `{ filename, lnum, text }`; CLI JSON `{ ok, command, ... }`.
7. **CI vs smoke.** Unit tests stay nvim-free so `npm test` does not depend on a GUI instance.
