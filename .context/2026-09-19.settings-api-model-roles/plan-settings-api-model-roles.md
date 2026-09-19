---
status: active
date: 2026-09-19
subject: 2026-09-19.settings-api-model-roles
topics: [omp-models, settings-api, model-roles, yaml-parser, buck-loop, code-review-iteration, b-save-improved]
research: []
iterations: []
spec:
memory: []
---

# Plan: Replace hand-rolled modelRoles YAML parser with the omp Settings API

## User Goal

Operators get model-role resolution that uses the omp host's real config layering (runtime → overlay → project → global → default) instead of a regex-based YAML re-implementation, so roles configured through the omp config UI/API are always honored consistently by every buck extension (buck-loop, b-save-improved, code-review-iteration, buck-mode).

## Goal

Replace `parseModelRoles`/`readOmpModelRoles` (hand-rolled `config.yml` line parser in `extensions/omp-models.ts`) with `Settings.loadReadOnly()` from `@oh-my-pi/pi-coding-agent`, delete the YAML parser and the legacy `.pi/settings.json` `buckModelMapping` fallback, and migrate every caller to the async resolution API.

## Context used / assumptions

- Session research (this conversation, 2026-09-19):
  - The `Settings` class with the modelRoles API (`getModelRole(s)`, `setModelRole`, layer getters, `Settings.loadReadOnly/init`) exists **only** in `@oh-my-pi/pi-coding-agent` (omp fork, v17.x). The repo's optional peer `@mariozechner/pi-coding-agent` 0.73.1 has **no** modelRoles support (`core/settings-manager.d.ts` has zero matches).
  - `Settings.loadReadOnly({ cwd, agentDir })` reads config sources "without opening agent.db, migrating legacy settings, or writing marker files" — read-only, so repo-pinned version skew vs. the running omp binary is tolerable for the config.yml read path.
  - Current consumers of the YAML parser:
    | Consumer | Site | Notes |
    |---|---|---|
    | `buck-loop/run-step.ts:177` | `mappingFromOmpRoles` → `modelPattern` | already async |
    | `buck-loop/choice.ts:122` | `resolveOmpRole("smol") ?? resolveOmpRole("default")` | already async |
    | `code-review-iteration/index.ts:243-247` | `fallbackModel` (fixer fallback) | deps callback `fixerFallbackModel` typed sync at `loop.ts:83` |
    | `code-review-iteration/index.ts:373-384` | `readOmpModelRoles` + `resolveOmpRole` | caller async |
    | `code-review-iteration/prompts.ts:104` | `resolveReviewerModel({ ompRoles })` | takes a roles **record** — stays sync |
    | `b-save-improved/index.ts:199-201, 547, 555, 665` | `resolveRoleModel` / `resolveOmpRole` | `resolveRoleModel` is a sync export with direct test asserts |
    | `extensions/index.ts:48-70, 414-415` | `readModelMapping` (buck-mode auto-switch) | `handleModelSwitch` already async; includes legacy `.pi/settings.json` fallback |
    | `b-flow/sdk-worker.ts:34` | `mappingFromOmpRoles` | **unwired/historical** — signature change forces a minimal `await` touch; no revival |
  - `DIFFICULTY_TO_ROLE` (`extensions/omp-models.ts:119`) and `OmpModelMapping` semantics are unchanged.
- User decisions (this session, via clarification):
  - **Hard dep, delete parser** — add `@oh-my-pi/pi-coding-agent` as optional peer + dev dependency; single resolution path; YAML parser and its tests deleted.
  - **Retire the legacy `buckModelMapping` fallback** (`.pi/settings.json`) — modelRoles via Settings is the only mapping source. Pi-runtime users without omp config get no mapping, same as "no config" today.

## Scope

- Rewrite role resolution in `extensions/omp-models.ts` on top of `Settings.loadReadOnly`.
- Migrate all callers (table above) to the async API.
- Add `@oh-my-pi/pi-coding-agent` to `package.json` (optional peerDependency + devDependency).
- Delete `parseModelRoles`, the sync readers, and the `.pi/settings.json` `buckModelMapping` reader.
- Update affected tests to the async API with the same `.omp/config.yml` fixture strategy.

## Out of scope

- In-app role **writing** (e.g. `/model-roles` command, `setModelRole`) — separate future plan (docs/ideas.md #5 configuration UI).
- Role caching / live invalidation via `onModelRoleChanged` — only add if verification shows `before_agent_start` latency; default is fresh-read per call (matches today's per-call file reads).
- `b-flow` revival (stays unwired per locked project decision).
- `buck-mode`'s auto-switch behavior beyond the mapping source swap.

## Affected files

| File | Change |
|---|---|
| `package.json` | + `@oh-my-pi/pi-coding-agent` optional peer + devDep `^17.4.2` |
| `extensions/omp-models.ts` | Delete `parseModelRoles` + sync readers; add `loadOmpModelRoles(cwd): Promise<Record<string,string>>` via `Settings.loadReadOnly({ cwd, agentDir: ompAgentDir() })`; make `resolveOmpRole` / `mappingFromOmpRoles` async; errors → `{}` (preserves today's "ignore unreadable config") |
| `extensions/buck-loop/run-step.ts` | `await mappingFromOmpRoles` |
| `extensions/buck-loop/choice.ts` | Single `await loadOmpModelRoles` then pick `smol` → `default` from the record |
| `extensions/code-review-iteration/index.ts` | Await `fallbackModel`; await roles for `resolveReviewerModel`; deps callback typing |
| `extensions/code-review-iteration/loop.ts` | `fixerFallbackModel` dep becomes `Promise<string | null>`; `await` at `:209`, `:390` |
| `extensions/b-save-improved/index.ts` | `resolveRoleModel` async; awaits at `:547`, `:555`, `:665` |
| `extensions/index.ts` | Delete `readModelMapping` + legacy `.pi` reader; `handleModelSwitch` awaits `mappingFromOmpRoles`; drop dead imports (`homedir`/`readFileSync` if orphaned) |
| `extensions/b-flow/sdk-worker.ts` | Minimal `await` at `:34` (signature compliance only) |
| Tests | `omp-models.test.ts` (drop `parseModelRoles` block; async-ify; precedence test becomes project-beats-global), `buck-loop/choice.test.ts`, `buck-loop/run-step.test.ts` (fixtures unchanged, mocks async), `b-save-improved/wire.test.ts` (`await resolveRoleModel`), `b-save-improved/handler.test.ts` (mock resolves promises), `code-review-iteration` loop/prompt tests, `buck-mode.test.ts:262-268` expectations |

## Implementation steps

1. `package.json`: add `@oh-my-pi/pi-coding-agent` to `peerDependencies` (optional) and `devDependencies` (`^17.4.2`); install.
2. `extensions/omp-models.ts`: implement `loadOmpModelRoles` on `Settings.loadReadOnly({ cwd, agentDir: ompAgentDir() })` → `getModelRoles()`; make `resolveOmpRole` / `mappingFromOmpRoles` async; delete `parseModelRoles` and sync readers.
3. Migrate `buck-loop` (`run-step.ts`, `choice.ts`) and `code-review-iteration` (`index.ts`, `loop.ts` deps interface).
4. Migrate `b-save-improved/index.ts` and `extensions/index.ts` (delete `readModelMapping` + legacy `.pi` reader).
5. Minimal `await` in `b-flow/sdk-worker.ts`.
6. Update all tests listed under Affected files; fixture files stay `.omp/config.yml` (now loaded through Settings — format-truthful).
7. Run verification.

## Acceptance criteria

- [ ] No regex/line-based `config.yml` parsing remains in `extensions/` (`parseModelRoles` gone).
- [ ] No `.pi/settings.json` `buckModelMapping` reader remains.
- [ ] `resolveOmpRole` / `mappingFromOmpRoles` / `loadOmpModelRoles` resolve through `Settings` with layer precedence project > global, fallback to `default` role preserved (`DIFFICULTY_TO_ROLE` untouched).
- [ ] All consumers await the async API; `tsc --noEmit` clean.
- [ ] Full test suite passes (`npm test`).
- [ ] Parity smoke: `loadOmpModelRoles` on this repo returns the same roles the old parser returned.

## Verification

1. `bunx tsc --noEmit` (catches every missed await/caller).
2. `npm test` (vitest + bun suites).
3. Parity smoke script (throwaway, then removed): old parser output vs `loadOmpModelRoles` against this repo's real config (project `.omp/config.yml` exists in repo? global `~/.omp/agent/config.yml` has modelRoles) — byte-identical mapping.
4. `npm run guardrails:check` — code-touching session, gate is blocking.
5. Optional live smoke: `/buck-loop --status` in a running omp session (no role resolution on that path) plus a one-phase plan run if cheap; otherwise the test suites + parity smoke are the evidence.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` (or `/b-build-hard` if ambiguity appears) against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next turn.

## Light Grill

- Q1: How should the extension get the omp Settings API? → resolved: Hard dependency (`@oh-my-pi/pi-coding-agent` optional peer + devDep), single resolution path, YAML parser deleted (recommended option accepted).
- Q2: Keep or retire the legacy `.pi/settings.json` `buckModelMapping` fallback? → resolved: Retire; modelRoles via Settings is the only mapping source (recommended option accepted).

## Risks

- **Version skew**: repo-pinned fork (^17.4.2) vs. running omp binary (18.2.6 observed). `Settings.loadReadOnly` avoids `agent.db` and migrations; `config.yml` format is stable. If a future format change breaks reads, the failure mode is empty roles → no mapping (graceful, same as missing config today).
- **Duplicate SDK in node_modules**: weight + a second `createAgentSession`-adjacent API surface. We import only `Settings`; no session APIs from the fork.
- **Pi-runtime regression (accepted by user)**: no `buckModelMapping` fallback; Pi users must provide omp-format `config.yml` (project `.omp/config.yml` or agent-dir config) or live with no phase-based model switching.
- **`before_agent_start` latency**: buck-mode now awaits an async settings read per prompt. `loadReadOnly` skips agent.db; expected low single-digit ms. If verification shows otherwise, add a memoized cache with explicit invalidation as a follow-up.
- **`b-flow` type touch**: signature compliance only; no behavioral revival.
