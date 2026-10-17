---
status: active
date: 2026-06-05
subject: 2026-06-05.current-session-json-design
topics: [session-state, redesign, per-subject, handoff, multi-machine, migration]
research: [research-current-session-json-design.md, research-session-json-origin.md]
memory: []
---

# Plan: Redesign `.context/workflow/current-session.json` as per-subject handoff payload

## Goal

Move the buck-workflow session state out of the global, frequently-rewritten, merge-conflict-prone `.context/workflow/current-session.json` and into a per-subject `.context/<subject>/session.json` file that is **committed** and serves as the handoff payload for moving the workflow between machines. Apply the same pattern to `.context/workflow/grill-session.json`.

## Context used / assumptions

- **User pain**: merge conflicts on `current-session.json` while working across branches/machines.
- **User use case (revealed)**: hand off an in-flight workflow to a different machine mid-workflow. The git repo is the sync layer; the session file IS the handoff payload.
- **User design picks**:
  - Per-subject session file (not global)
  - Commit the whole file (handoff payload)
  - Active-subject resolution derives from filesystem/git signals (no global pointer)
  - Same pattern for `grill-session.json`
  - Active-subject signal: option (a) — `git log -1 --format=%ct -- <subject>/session.json`
- **Root cause (from research)**: the file is in `.gitignore` but was added to git before the rule existed, so it remains tracked. The `cad21be resolved session papertrail conflicts` commit is a smoking gun.
- **Field-lifecycle audit**: 5 of 17 fields are cross-subject durable (`memory_file`, `plan_mode_active`, `buck_workflow_mode_*`, `restrict_cwd_active`); the other 12 are per-pi-session papertrail or unused legacy. The redesign scopes all fields to the subject.
- **Open question (will become a backlog item if needed)**: should `commands_run` and `files_modified` papertrail ever be read by a human directly, or only by the LLM via the compaction hook? Today's design assumes only the hook reads them. The handoff path is consistent with this.

## Scope

In scope:
- Subject-scoped session file `.context/<subject>/session.json` (committed, handoff payload)
- Subject-scoped grill file `.context/<subject>/grill-session.json` (committed, handoff payload)
- Tiny gitignored global fallback `.context/workflow/modes.json` for the brief window before a subject exists
- Bootstrap behavior: read committed file, preserve workflow state, reset per-pi-session flags, append `handoff` audit metadata
- Active-subject resolution via `git log -1 --format=%ct -- <subject>/session.json` (or mtime if `git log` is too slow)
- Migration of any in-flight state from the legacy `current-session.json` on first bootstrap
- `git rm --cached` of the legacy file; update `.gitignore` to track per-subject files and ignore the legacy path
- Update `extensions/index.ts` readers (compaction hook, agent_end save warning, tool_call write guard, system prompt injection)
- Update `extensions/buck-mode.test.ts` to use the new path
- Update `extensions/b-grill-auto/grill-state.ts` for the new path
- Update `skills/_shared/subject-resolution.md` to replace the `current-session.json` step with `scanActiveSubject()`
- README + CHANGELOG note explaining the new model

Out of scope:
- Removing the `commands_run` and `files_modified` papertrail fields entirely (re-deriving them from git history). The user's pick was "commit the whole file" — papertrail is part of the handoff payload. This can be a follow-up if desired.
- Changing the b-grill-auto RPC protocol
- Changing the write guard logic itself (still uses `plan_mode_active` / `restrict_cwd_active` — only the storage path changes)
- Multi-pi-session file locking (a single machine opening two pi sessions on the same subject is a rare edge case; defer)

## Affected files

| File | Change |
|---|---|
| `extensions/index.ts` | Replace `STATE_DIR`/`STATE_FILE` constants and `readState`/`writeState`/`defaultState` with subject-scoped versions. Add `subjectSessionPath(subject)`, `readSubjectSession(subject)`, `writeSubjectSession(subject, state)`, `bootstrapSubjectSession(subject)`, `scanActiveSubject()`. Update all 11 call sites of `readState`/`writeState`. |
| `extensions/buck-mode.test.ts` | Update `readState` test helper to subject-scoped variant. Update test fixtures to set up a test subject folder. |
| `extensions/b-grill-auto/grill-state.ts` | Replace `STATE_DIR`/`STATE_FILE` with subject-scoped versions. Update reader/writer. |
| `extensions/b-grill-auto/index.ts` | Update orchestration loop to read/write subject-scoped grill session. |
| `skills/_shared/subject-resolution.md` | Replace step 2 (`current-session.json` → `memory_file` → subject) with `scanActiveSubject()` via `git log` mtime. |
| `.gitignore` | Replace `.context/workflow/current-session.json` with `.context/workflow/modes.json` (gitignored legacy fallback) and a clarifying comment block explaining the per-subject, committed pattern. |
| `CHANGELOG.md` | Add a section explaining the migration. |
| `README.md` | Brief mention in the workflow section that session state is per-subject and committed. |
| `extensions/b-flow/machine.ts` (and any sibling `b-flow` state readers) | Update to read from per-subject session. (Need to verify during phase 1 — search for any other `current-session.json` consumers.) |
| New: `.context/<subject>/session.json` (per subject, on bootstrap) | The handoff payload file. |

## Implementation steps

These are organized into four sequential phases because the work touches many files, spans multiple architectural layers (extension core + grill extension + skill protocol + tests + docs + git state), and warrants explicit verification between phases. The plan exceeds the b-phase threshold (8+ steps, 9+ files, multi-layer), so run `/skill:b-phase` after this plan to break it into Ralph-ready units.

### Phase 1 — Subject-scoped session helpers (extensions/index.ts core)

1. Add new constants next to existing `STATE_DIR`/`STATE_FILE`:
   ```ts
   const SUBJECT_SESSION_FILE = "session.json";
   const LEGACY_STATE_FILE = "current-session.json";
   const MODES_FALLBACK_FILE = "modes.json";
   ```
2. Add helpers:
   - `subjectSessionPath(subject: string): string` — returns `.context/<subject>/session.json`
   - `readSubjectSession(subject: string): SessionState | null`
   - `writeSubjectSession(subject: string, state: SessionState): void`
   - `bootstrapSubjectSession(subject: string): SessionState` — reads committed file, preserves workflow fields, resets per-pi-session flags, adds `handoff` audit metadata
3. Refactor `readState`/`writeState`/`ensureState` to operate subject-scoped; the file path is no longer a constant — it comes from the active subject.
4. Keep `defaultState()` unchanged.
5. **Verification for Phase 1**: buck-mode test suite still passes; manual test: bootstrap a subject, run a few commands, verify the per-subject `session.json` is written and the global `current-session.json` is no longer touched.

### Phase 2 — Active-subject resolution

6. Implement `scanActiveSubject(): string | null`:
   ```ts
   function scanActiveSubject(): string | null {
     const ctxDir = ".context";
     if (!existsSync(ctxDir)) return null;
     const folders = readdirSync(ctxDir, { withFileTypes: true })
       .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}\./.test(e.name))
       .map(e => e.name);

     let best: { subject: string; commitTime: number } | null = null;
     for (const subject of folders) {
       const sessionPath = join(ctxDir, subject, "session.json");
       let commitTime = 0;
       try {
         const out = execSync(
           `git log -1 --format=%ct -- "${sessionPath}"`,
           { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
         ).trim();
         commitTime = parseInt(out, 10) || 0;
       } catch { /* no commit yet */ }
       if (!best || commitTime > best.commitTime) best = { subject, commitTime };
     }
     return best?.subject ?? null;
   }
   ```
7. Update `skills/_shared/subject-resolution.md` step 2 to call `scanActiveSubject()` instead of reading `current-session.json`.
8. **Verification for Phase 2**: on a fresh clone with one subject, bootstrap identifies the right subject; with two subjects, the most-recently-committed one wins; with no subjects, returns null and the protocol falls through to the menu.

### Phase 3 — Migration + cleanup

9. One-time migration on first bootstrap with the new code:
   - If `.context/workflow/current-session.json` exists and no subject has a `session.json` yet, derive initial per-subject state from the global file (merge: take workflow state, blank per-pi-session flags).
   - Write the legacy `current-session.json` content to `.context/workflow/modes.json` (gitignored global fallback) so any unbootstrapped references still work.
   - Keep the legacy file readable for one release as a safety net.
10. `git rm --cached .context/workflow/current-session.json` and `git rm --cached .context/workflow/grill-session.json`.
11. Update `.gitignore`:
    ```
    # Buck workflow modes — small global fallback for the pre-subject window
    .context/workflow/modes.json

    # Legacy session state (kept on disk for one release, never re-tracked)
    .context/workflow/current-session.json
    .context/workflow/grill-session.json
    ```
    Note: per-subject `session.json` and `grill-session.json` are NOT gitignored — they're the handoff payload.
12. Add CHANGELOG entry: "Run `git rm --cached .context/workflow/current-session.json .context/workflow/grill-session.json` if upgrading from a version that had them tracked. Session state is now per-subject in `.context/<subject>/session.json` (committed)."
13. Brief README note in the workflow section.
14. **Verification for Phase 3**: on a clone of the previous version, `git pull` succeeds, bootstrap migrates state correctly, no warnings about the legacy file.

### Phase 4 — Grill-session parallel

15. In `extensions/b-grill-auto/grill-state.ts`, replace `STATE_DIR`/`STATE_FILE` constants with subject-scoped variants.
16. Add `grillSessionPath(subject)` and update `writeSessionState`/`readSessionState`/`clearSessionState` to use it.
17. In `extensions/b-grill-auto/index.ts`, find the active subject (via `scanActiveSubject` or argument) and pass the subject slug to grill state.
18. Update grill tests to use a per-subject fixture.
19. **Verification for Phase 4**: `/b-grill-auto` against a subject writes `.context/<subject>/grill-session.json`; resuming on another machine picks up the same grill state.

## Verification

End-to-end (covers all phases):
- **Unit**: `bun test extensions/buck-mode.test.ts` passes with the new subject-scoped paths.
- **Integration**: `bun test extensions/b-grill-auto/` passes.
- **Manual handoff test** (most important):
  1. On machine A, start a subject, run `/b-plan`, edit some files, run `/b-build`.
  2. `git add . && git commit -m "wip" && git push`.
  3. On machine B, `git pull`, start pi on the same project. The active subject is identified correctly. Workflow state (plan mode on, etc.) is restored. Per-pi-session flags are reset. A `handoff` audit entry is added.
  4. Run `/b-iterate`. The new commands are appended to the existing `commands_run`. Files modified on machine B are appended to `files_modified`.
  5. Commit, push, repeat.
- **Merge conflict regression test**: in a worktree, run a few commands, then `git checkout main && git checkout -` to switch branches. The legacy file would have produced conflicts; the new design has no shared state to conflict on.

## Ralph Instructions

This plan exceeds the b-phase thresholds (4 distinct phases, 9+ files, multi-layer: extension core + grill extension + skill protocol + tests + docs + git state). Run `/skill:b-phase` to break it into Ralph-ready phases with dependency analysis and per-phase model hints. Each phase has its own verification gate above; do not advance to the next phase without the gate passing.

If the user wants to run a non-phased Ralph loop instead: treat the whole plan as one unit, single `/b-build` → `/b-review` → `/b-iterate` (if needed) → `/b-save` → `/git-commit` → `ralph_done` cycle. The plan is short enough end-to-end to fit in one session but verification between phases is recommended.

## Risks

- **R1 — Bootstrap regression on existing clones**: someone with a populated `.context/workflow/current-session.json` and a partially-set-up project (no subject folder yet) might lose state on first bootstrap. *Mitigation*: the migration step preserves the legacy file content in `modes.json`; the bootstrap falls back to `modes.json` if no subject exists. Worst case, the user can re-derive state by reading the modes file.
- **R2 — `git log` performance on large repos**: a repo with thousands of commits and many subject folders could slow down `scanActiveSubject`. *Mitigation*: cache the result for the duration of one pi process; re-derive on session start. Fall back to filesystem mtime if `git log` exceeds a budget (e.g., 200ms).
- **R3 — Schema version drift**: per-subject `session.json` files committed at different times might have different schemas. *Mitigation*: include `schema_version: 2` in the new files; on read, check the version and migrate or warn. The previous schema (no `schema_version`) is treated as v1 and migrated on bootstrap.
- **R4 — Buck-mode test suite churn**: `extensions/buck-mode.test.ts` reads the legacy path in 7 places (lines 114-115, 137, 144, 158, 172, 187, 202, 235, 247, 263, 268). Each test fixture needs to set up a test subject folder. *Mitigation*: a single `setupTestSubject()` helper at the top of the test file; refactor the test to call it in `beforeEach`.
- **R5 — Subject-resolution protocol changes break the skill prompts**: `skills/_shared/subject-resolution.md` is referenced by every b-* skill's "Apply Context Resolution" step. A bug in the new resolver means every skill fails to find its subject. *Mitigation*: keep the old step 2 logic as a fallback inside the new `scanActiveSubject()`; if `git log` fails or returns no result, fall back to filesystem mtime. Document the fallback in the skill.
- **R6 — Handoff audit metadata grows unboundedly**: each handoff adds a `handoff: { from_started_at, received_at }` entry. Multiple handoffs per day would grow the file. *Mitigation*: keep only the latest handoff entry; older handoffs are a follow-up audit-trail improvement.

## Open questions

1. **Schema version field**: add `schema_version: 2` to new files for forward-compat? *Lean: yes, costs nothing.*
2. **Should the handoff metadata also include a machine identifier** (hostname, OS, pi version) for debugging? *Lean: yes, low cost, useful for "why did this handoff go wrong" forensics.*
3. **What's the exact name of the new file?** Options: `session.json` (short), `workflow-session.json` (explicit), `state.json` (generic). *Lean: `session.json` — matches the user's mental model ("the session file").*

## Recommended next step

Run `/skill:b-phase` to break this plan into Ralph-ready phases with per-phase model hints and dependency analysis. Then run `/b-build` against the first phase.
