---
status: active
date: 2026-09-09
subject: 2026-09-09.installer-source-integrity
topics: [installer, symlink, source-root, verify, bootstrap-drift, cli]
research: []
iterations: []
memory: []
---

# Plan: installer source integrity (`--verify` + cross-root warnings)

## User Goal

*Synthesized from the 2026-09-09 split-install incident — confirm or refine.*

Anyone running buck-workflow across more than one agent harness can see, in a single command, which checkout each harness actually resolves to — and is warned at install time when a run is about to move harnesses onto a different checkout. Today that split is invisible: the user discovers it weeks later as an agent quietly following stale instructions.

## Goal

Make `scripts/install.mjs` self-diagnosing about its own source root:

1. A read-only `--verify` mode that prints `dest → resolved target` for every detected harness surface and names every distinct source root in play.
2. A loud, named warning when a relink moves a destination from one source root to another.
3. A copy-specific message when a bootstrap destination is a real file, since that case silently skips its own repair.
4. Accurate run-summary counts.

## Context used / assumptions

- Root cause established 2026-09-09 (`.context/memory/install-source-consolidation-2026-09-09.md`): `source` defaults to the installer's own location (`install.mjs:28,188`), so running it from a second checkout repoints detected harnesses with no record of the previous root.
- `ensureSymlink` (`:129-142`) already distinguishes create / skip / replace / conflict. It has no notion of a *source root*, only an exact `src` string, so "stale link inside my own checkout" and "link belonging to a different checkout" are indistinguishable today.
- `--list` (`:374-391`) prints detected harnesses plus the *current run's* source. It never reads a destination, so it cannot show the split.
- A `cp`'d bootstrap is a real file → `conflict` branch (`:146-151`) → **skipped** by a normal re-run. This is why `~/.pi/agent/AGENTS.md` stayed 318 diff lines behind through repeated installs.
- The final summary (`:420`) counts only `created` and `skipped`. Today's repair printed `Done. 11 linked, 3 skipped` while ~90 links were *replaced* — the number the user most needed was missing.
- `scripts/install.test.mjs` is a **vitest** suite (37 tests) with `/tmp` fixtures via `setupFixtures()`. Run with `npx vitest run scripts/install.test.mjs`; `node --test` throws a misleading `@vitest/runner` error.
- Assumption: no persisted install state file. `--verify` derives everything from the filesystem, so it works on installs made before this change.

## Scope

- `scripts/install.mjs` — new exported `verifySurfaces()`, `--verify` flag, `sourceRoot` option on `ensureSymlink`, copy-specific conflict wording, corrected summary counts, HELP text.
- `scripts/install.test.mjs` — cases for each behavior above.
- `README.md` — flags table + replace the `ls -l` audit one-liner with `--verify`.
- `agent-install_instructions.md` — same substitution in the "Bootstrap wiring — symlink, never copy" section.

## Out of scope

- Persisting installer state (a lockfile / manifest of past source roots). The filesystem is already the source of truth; a state file would add a second thing to drift.
- Auto-repairing a detected split. `--verify` reports; the user re-runs the installer with the root they want.
- Changing which harnesses or surfaces exist, or the `HARNESSES` registry shape.
- Project-scoped (`.claude/`, `.opencode/`) installs — global surfaces only, as today.
- Publishing to npm (tracked separately in `items/first-npm-publish.md`).

## Affected files

| File | Change |
|---|---|
| `scripts/install.mjs` | `verifySurfaces()`, `--verify`, `ensureSymlink({ sourceRoot })`, conflict wording, summary counts, HELP |
| `scripts/install.test.mjs` | new describe blocks; update the exact-equality `parseArgs([])` assertion |
| `README.md` | flags table row; audit command in the Rules block |
| `agent-install_instructions.md` | audit command in the bootstrap-wiring rules |

## Implementation steps

1. **`isInsideRoot(target, root)` helper** (module-private). `resolve()` both, then require `target === root || target.startsWith(root + sep)`. The separator guard is the point — a naive `startsWith` matches `/x/buck-workflow-pi-old` against `/x/buck-workflow-pi`.

2. **Teach `ensureSymlink` about source roots.** Add an optional `sourceRoot` to the options bag. In the existing symlink branch (`:129-142`), when the current target is not `src`, classify:
   - target inside `sourceRoot` → today's behavior, `action: "replaced"`, current message.
   - target outside `sourceRoot` → `action: "replaced"` with `crossRoot: true` and a message naming **both** roots, e.g. `Moved to a different source root: <oldRoot> → <sourceRoot>`.
   Derive `oldRoot` by walking the target path up to the longest prefix that is not inside `sourceRoot`; if that is unclear, fall back to the target's `dirname`. Callers that pass no `sourceRoot` keep exactly today's behavior — that keeps the 37 existing tests honest.
   **Do not block on cross-root.** A hard `--force` gate would have prevented the one-command repair performed on 2026-09-09; warning plus the end-of-run summary is the right severity.

3. **Copy-specific conflict wording.** `ensureSymlink` does not know the surface, so keep its generic conflict message and append the remedy: `Use --force to replace it with a symlink.` In `install()`, where `surfaceName` is known, rewrite a `conflict` result on the `bootstrap` surface to `Copied bootstrap detected at <dest> — it will not track the repo. Re-run with --force to convert it to a symlink.`

4. **`verifySurfaces({ source, home, harnessIds })`.** Read-only; mirrors `install()`'s traversal (bootstrap file, `commands/*.md`, `skills/*/`) but calls `lstat`/`readlink` instead of writing. Per destination emit `{ harness, surface, dest, target, state }` where `state` is one of:
   - `linked-here` — symlink resolving inside `source`
   - `linked-elsewhere` — symlink resolving outside `source` (carry the offending root)
   - `dangling` — symlink whose target does not exist
   - `real-file` — a real file or directory (a copy)
   - `missing` — nothing at `dest`
   Return `{ results, roots, exitCode }`, where `roots` is the set of distinct source roots observed. `exitCode` is 1 when any result is `linked-elsewhere`, `dangling`, or `real-file`; otherwise 0. Never write, never create parent dirs, honor `--harness`.

5. **Wire `--verify` into `parseArgs` and `main()`.** Add `verify: false` to the defaults bag. In `main()`, handle `--verify` before the install branch: print one line per non-`linked-here` result first (the problems), then a compact per-harness summary, then the root inventory — `Source roots in use: 1` on a healthy machine, or every root listed with its destination count when > 1. Exit with `verifySurfaces()`'s code. `--verify` combined with `--dry-run` is redundant but harmless; `--verify` wins.

6. **Fix the summary line** (`:420`) to count `created`, `replaced`, `skipped`, and `conflict`, and to append `— N moved from another source root` when any result carries `crossRoot`.

7. **HELP text** — add `--verify   Report what each harness resolves to; write nothing`.

8. **Docs.** In `README.md` §2 Rules and in `agent-install_instructions.md`'s bootstrap-wiring rules, replace the `ls -l ~/.claude/CLAUDE.md …` audit one-liner with `node scripts/install.mjs --verify`, and add the `--verify` row to the README flags table.

## Tests

Add to `scripts/install.test.mjs`, reusing `setupFixtures()`:

- `ensureSymlink` with `sourceRoot`: same-root stale link → `replaced`, no `crossRoot`; link into a second repo fixture → `replaced` with `crossRoot: true` and both roots in the message; omitting `sourceRoot` preserves current behavior.
- `isInsideRoot` boundary: `/x/repo-old` is **not** inside `/x/repo`.
- `verifySurfaces` on a clean install → every state `linked-here`, `roots.length === 1`, `exitCode 0`.
- `verifySurfaces` on a split fixture (install from `repoA`, then relink one harness to `repoB`) → that harness `linked-elsewhere`, `roots.length === 2`, `exitCode 1`.
- `verifySurfaces` with a real file at the bootstrap dest → `real-file`, `exitCode 1`; with a symlink to a deleted target → `dangling`, `exitCode 1`.
- `verifySurfaces` writes nothing: snapshot the fixture tree before/after.
- `install()` on a `cp`'d bootstrap → conflict message contains `Copied bootstrap detected`.
- `parseArgs`: `--verify` parses; **update** the existing `parseArgs([])` exact-equality assertion at `install.test.mjs:423` to include `verify: false`. That assertion pins the CLI's option contract, so extending it is correct — do not weaken it to `toMatchObject`.

## Acceptance criteria

- [ ] `node scripts/install.mjs --verify` on this machine reports every surface `linked-here`, `Source roots in use: 1`, exit 0, and writes nothing.
- [ ] Against a synthetic split fixture, `--verify` names both roots, marks the offending destinations, and exits 1.
- [ ] A cross-root relink during a real install prints a message naming the old and new roots, and the run summary reports the moved count.
- [ ] A `cp`'d bootstrap produces the copy-specific message telling the user to re-run with `--force`.
- [ ] `Done.` summary accounts for created + replaced + skipped + conflicts.
- [ ] `npx vitest run scripts/install.test.mjs` passes with the new cases (37 existing + new).
- [ ] `README.md` and `agent-install_instructions.md` tell users to audit with `--verify`, not `ls -l`.

## Verification

1. `npx vitest run scripts/install.test.mjs` — full suite green.
2. `node scripts/install.mjs --verify` on the real machine — expect single-root, exit 0. Confirm `echo $?`.
3. Build a throwaway split: clone/copy the repo to `/tmp/bw-split`, run `node /tmp/bw-split/scripts/install.mjs --harness codex`, then `node scripts/install.mjs --verify` → expect Codex flagged `linked-elsewhere`, two roots, exit 1. Repair with `node scripts/install.mjs --harness codex` and confirm the cross-root warning fires, then re-verify → exit 0.
4. `node scripts/install.mjs --dry-run` — confirm no behavior change on the happy path.
5. Guardrails: this session touches `scripts/**`, so the check contract is **mandatory** — run `/b-guardrails-check` before completion. (Contrast with the docs-only sessions earlier today.)

## Risks

- **Cross-root detection is heuristic on `oldRoot`.** Reporting the *destination target* accurately is easy; naming its "root" is inference. Mitigation: always print the full old target path alongside the inferred root, so the message is useful even when the inference is imprecise.
- **Relative symlink targets.** `readlinkSync` returns whatever was stored. The installer only ever writes absolute targets, but a hand-made relative link must be resolved against `dirname(dest)` before the root check, or it will be misclassified. Cover with a test.
- **`--verify` exit 1 is a behavior contract.** Anything scripting the installer will now see a non-zero exit for a split. That is the point, but it must be documented in the flags table.
- **Scope creep toward auto-repair.** `--verify` must stay read-only; the fix path is an ordinary installer run.
- **The 37-test suite is the regression net.** Any change to `ensureSymlink`'s default (no `sourceRoot`) path is a red flag — those tests should not need editing beyond the `parseArgs` contract update.

## Light Grill

Three decisions were material enough to record; defaults applied, confirm or override:

- Q1: Cross-root relink — warn, or require `--force`? → **resolved: warn loudly, do not block.** A `--force` gate would have blocked the legitimate one-command repair run on 2026-09-09, and the common case (consolidating onto one root) is exactly the case that would be blocked.
- Q2: `--verify` exit code on a split — 0 (informational) or 1 (failure)? → **resolved: 1.** Makes it usable as a check in CI or a shell guard; a purely informational mode cannot be scripted.
- Q3: Persist the previous source root in a state file? → **resolved: no.** Out of scope. The filesystem already knows; a state file is a second thing that drifts, and it would not help installs made before this change.

## Recommended next step

`/b-build` against this plan. Non-phased: 8 steps across 4 files, one architectural layer, no high-risk paths — below the `b-phase` thresholds.
