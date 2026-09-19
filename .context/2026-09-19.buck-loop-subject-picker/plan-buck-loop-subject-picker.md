---
status: active
date: 2026-09-19
subject: 2026-09-19.buck-loop-subject-picker
topics: [buck-loop, subject-picker, tui, command-surface]
research: []
iterations: []
spec:
memory: []
---

# Plan: `/buck-loop` subject picker

## User Goal

When I run `/buck-loop` without naming a subject, I pick from my latest subjects in the TUI instead of getting a usage error, and that choice stays fixed until the run finishes.

## Goal

Bare `/buck-loop` presents up to five recent runnable subject folders via `ctx.ui.select`. The chosen folder name is the only path the supervisor sees for that invocation. Explicit paths, `--resume`, `--status`, and `--stop` are unchanged. `scan()` still never guesses among subjects.

## Context used / assumptions

- User-provided context: picker when no subject is provided; latest subjects, cap 5, TUI; lock the choice for the rest of the loop.
- Session context: Phase 6 AC currently requires a missing path to print usage and perform **no subject discovery**. This plan replaces that AC with an operator TUI pick, not a scan guess. ADR 0002 still forbids auto-planning and hidden orchestration.
- Relocated from `2026-09-18.buck-loop-extension` so `/buck-loop` does not treat sibling completed phases as this plan. Status-contract / skill-hook work is out of this plan.
- Code: `parseArgs("")` → usage error (`index.ts`); `startRun` already requires a path and `drive`/`rescan` reuse it; `FROZEN_PHASE` already freezes `phasePath`; `Projection.subject` already bookmarks the run; `scan()` returns `missing("path is required")` on empty input and refuses `.context` with multiple subjects (`scan.test.ts`). TUI pattern already exists: `ctx.ui.select("Which subject?", names)` in `extensions/b-save-improved/index.ts`.
- Related (not in this subject folder): `.context/2026-05-31.subject-selection-prompting/` is skill-level numbered menus, not this command.
- Assumptions:
  - **Latest** = subject folder basename descending (`YYYY-MM-DD.slug` is ISO, so lexicographic = newest first). Not mtime.
  - Cap 5; show fewer when fewer exist. No padding, no "Other".
  - Eligible: `.context/YYYY-MM-DD.*` directories that are not `status: completed` (missing `index.md` / missing `status:` = eligible, matching subject-resolution legacy) **and** contain at least one `plan-*.md` (loop is existing-plans only).
  - Cancel (`select` → `null`/`undefined`) = toast, no persist, no `handleLoop`.
  - Headless / no `ui.select` = keep today's USAGE toast. Do not invent a subject.
  - `--resume` uses `projection.subject` (or `phasePath`/`planPath`); never re-prompts.
  - No phase picker. After the subject is chosen, existing `pickSolePlan` / `pickPhase` apply.
  - Do not share a module with `b-save-improved`. Copy the select call shape only.

## Scope

1. Export a pure `listRecentSubjects(projectRoot, limit = 5): string[]` next to `SUBJECT_DIR_RE` in `scan.ts` (or a tiny sibling `subjects.ts` if `scan.ts` would otherwise grow a second job). Does not change `scan()` empty-path behavior.
2. Allow empty `/buck-loop` as `command: "start"` with no path. Handler calls `listRecentSubjects`, then `ctx.ui.select("Which subject?", names)`, then `handleLoop({ command: "start", path: picked })` once.
3. Lock: `select` runs at most once per invocation, and only when start has no path. Nested workers and the transition table never see the picker. `startRun` still refuses an empty path.
4. Docs: USAGE, ADR 0002 invocation sentence, `docs/extension-loading.md` `/buck-loop` bullet, any `/buck-loop <path>` wording in `docs/buck-workflow.md` / `docs/oh-my-pi.md`.

## Out of scope

- Auto-selecting the single newest subject.
- Showing completed subjects, brainstorm-only folders, or a custom-path/"Other" row.
- Phase menus, plan menus when a subject has multiple `plan-*.md` (existing scan `missing` stays).
- Re-prompt on `--resume`, mid-loop, or after `blocked`.
- Changing `scan()` to search `.context/` when `path` is empty.
- Sharing listing code with `b-save-improved` or the skill-level subject-resolution protocol.
- New howto in this build; `/b-review` should flag howto impact (`docs/howto/` has no `run-buck-loop.md` today).
- Subject closeout contract, LLM-written `status:` trust, skill lifecycle hooks.

## Affected files

| File | Change |
|---|---|
| `extensions/buck-loop/scan.ts` | Add `listRecentSubjects` (sort, cap, status + plan-file filters). `scan()` empty path unchanged. |
| `extensions/buck-loop/index.ts` | Empty args → start-without-path; `BuckLoopUI.select?`; pick then delegate; USAGE optional path. |
| `extensions/buck-loop/__tests__/scan.test.ts` | Listing cases on fixture trees. Existing "does not guess" cases stay. |
| `extensions/buck-loop/__tests__/wire.test.ts` | Empty+select, cancel, zero subjects, headless, explicit path skips select, `--resume` skips select. |
| `docs/adr/0002-observably-invoked-happy-path-loop.md` | Operator may pick from latest subjects when no path is given. |
| `docs/extension-loading.md` | Bare `/buck-loop` TUI pick. |
| `docs/buck-workflow.md` / `docs/oh-my-pi.md` | Only if they still require a positional path. |

`loop.ts` / `table.ts` / `persist.ts` / `choice.ts` should not need behavior changes. Lock is already `drive(cwd, snapshot, target)` plus `Projection.subject`.

## Implementation steps

1. **`listRecentSubjects`** — Read `.context/` dirents matching `SUBJECT_DIR_RE`. Drop non-directories, `status: completed`, and folders with no `plan-*.md`. Sort basename descending. Slice to `limit` (default 5). Return folder names only (scan-locatable via `locate()`).
2. **`parseArgs`** — `tokens.length === 0` → `{ ok: true, command: "start" }` (no `path`). Keep rejecting extra positionals, mixed flags, unknown flags. Update `USAGE` to `/buck-loop [path-to-plan|phase|subject] | --resume | --status | --stop`.
3. **Handler pick** — If `command === "start"` and `!path`: if `!ctx.ui.select`, toast USAGE and return (preserves the current headless test). If the list is empty, toast that there are no runnable subjects and return. Otherwise `select` once; on cancel return; on pick call `handleLoop` with that folder name. Explicit path and flags never call `select`.
4. **Activity label** — Before pick, `phase("Choosing subject")` (or skip the widget until a path exists). After pick, existing `Starting <path>` label.
5. **Tests** — See Verification. Rewrite `prints usage and does not start work on missing path` to the headless (no `select`) case; add the TUI cases.
6. **Docs** — ADR 0002 + extension-loading (and any remaining required-path sentences). Do not claim the runner auto-selects a subject.

## Acceptance criteria

- [ ] `/buck-loop` with no args and a working `ui.select` shows at most five newest eligible subject folder names and starts the loop on the chosen one.
- [ ] `select` is called at most once per invocation; `handleLoop` receives that folder name as `path` and is not called on cancel / empty list / headless.
- [ ] Explicit path, `--resume`, `--status`, and `--stop` never open the picker.
- [ ] `scan("")` still returns `planFacts.kind === "missing"` with `path is required`. `scan(".context")` with multiple subjects still refuses to guess.
- [ ] Completed subjects and folders without a `plan-*.md` do not appear. Newest date-prefix wins; sixth-newest is omitted.
- [ ] `--resume` continues the bookmarked `Projection.subject` without a second pick.
- [ ] USAGE, ADR 0002, and extension-loading describe the optional path + TUI pick.

## Verification

- `vitest run extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/wire.test.ts`
- Listing fixtures: 7 eligible → 5 newest names; a `completed` folder excluded; a brainstorm-only folder excluded; a `2026-09-19.newer` sorts above `2026-09-18.older`.
- Wire: mock `select` resolves to `2026-09-18.demo` → `handleLoop` called with `{ command: "start", path: "2026-09-18.demo" }` and `select` call count 1. `select` → `undefined` → `handleLoop` not called. No `select` on the UI → USAGE, `handleLoop` not called. `handler("plan.md")` and `handler("--resume")` never call `select`.
- Full `vitest run extensions/buck-loop/__tests__` plus `/b-guardrails-check` at a coherent point.
- Manual (after build): in this repo, `/buck-loop` with no args should list recent subjects including `2026-09-19.buck-loop-subject-picker`; picking it must not re-prompt during the run; `--resume` must not re-prompt.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation or how-to impact, run `/b-docs` (and `/b-howto` if flagged) before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next turn.

## Risks

- **Phase 6 regression misread.** The old "no subject discovery" AC forbids *scan guessing*. A TUI pick that then passes an explicit path is the intended replacement. Tests must keep the scan-guess cases red if anyone wires listing into `scan()` itself.
- **Headless / eval sessions.** `ui.select` may be absent. Fail closed to USAGE, same as today.
- **Stale `status:`.** A completed subject left `active` can appear. Accept; operator still confirms. Do not invent a second status parser.
- **Multiple plans in one subject.** Picker locks the *subject*, not the plan. Existing `pickSolePlan` missing-reason still applies. Do not add a second menu in this plan.
- **Widget vs modal.** `select` is modal; starting `createActivity` before it can look like a hung spinner. Prefer picking first, then opening the activity widget — or a single "Choosing subject" phase that does not imply nested work.
