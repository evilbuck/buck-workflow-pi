---
status: active
date: 2026-05-30
subject: 2026-05-30.cwd-restrict-mode
topics: [cwd-restriction, write-guard, extension]
research: []
iterations: []
spec: null
memory: [cwd-restrict-mode-2026-05-30.md]
---

# Plan: CWD Restriction Mode

## Goal

Add a toggleable CWD (Current Working Directory) restriction mode to the buck-workflow extension that prevents writes outside the project root. Defaults to ON.

## Context used / assumptions

- **User-provided context**: Add CWD restriction as a toggleable mode (`/b-restrict on|off`), default ON
- **Session context**: Extension already has plan mode (`.context/`, `docs/` only) and buck workflow mode
- **Code reviewed**: `extensions/index.ts` (full 1520 lines), `extensions/buck-mode.test.ts`
- **Assumptions**:
  - CWD restriction is a safety guard to prevent accidental writes outside the project
  - When ON: write/edit tools blocked for paths outside `cwd`
  - When OFF: no path restrictions (normal pi behavior)
  - Complements plan mode: plan mode is stricter (subset of CWD), CWD restriction is broader
  - Bash tool should also be checked for obvious path violations (like `rm -rf /`)

## Scope

- Add `restrict_cwd_active` boolean to `SessionState` (default: `true`)
- Add `/b-restrict on|off|status` command
- Add CWD path validation helper (`isWithinCwd`)
- Integrate into `tool_call` handler to block write/edit outside CWD when active
- Add status indicator when restriction is active
- Add tests for the new functionality

## Out of scope

- Modifying existing plan mode logic
- Bash command deep inspection (only check explicit paths in write/edit tools)
- Persisting restriction state across sessions (session-scoped only)
- UI prompts or confirmations for borderline cases

## Affected files

- `extensions/index.ts` — Add restrict state, command, handler logic, status indicator
- `extensions/buck-mode.test.ts` — Add tests for `/b-restrict` command and CWD blocking

## Implementation steps

1. **Add `restrict_cwd_active` to `SessionState` interface** (line ~16)
   - Add field: `restrict_cwd_active: boolean`
   - Update `defaultState()` to set `restrict_cwd_active: true`

2. **Add `isWithinCwd` helper function** (after `isAllowedPlanWritePath` ~line 98)
   ```typescript
   function isWithinCwd(path: string, cwd: string): boolean {
     let normalized = path.replace(/^\.\//, "").replace(/\/$/, "");
     if (path.startsWith("/")) {
       if (!path.startsWith(cwd + "/") && path !== cwd) return false;
       return true;
     }
     // Relative paths are always within CWD
     return true;
   }
   ```

3. **Add `/b-restrict` command** (after `/b-mode` command ~line 560)
   - Handler accepts `on`, `off`, `status`
   - Tab completion for arguments
   - Updates `state.restrict_cwd_active`
   - Shows notification on toggle

4. **Integrate into `tool_call` handler** (in `pi.on("tool_call")` ~line 740)
   - After plan mode checks, add CWD restriction checks
   - For `write` tool: if `restrict_cwd_active`, check `isWithinCwd(path, cwd)`
   - For `edit` tool: same check
   - Return `{ block: true, reason: "CWD restriction: path is outside project directory" }` if violated

5. **Add status indicator** (in `updateWorkflowStatuses` ~line 490)
   - Show `🔒 cwd` status when `restrict_cwd_active` is true
   - Add `updateCwdRestrictStatus` helper

6. **Inject into system prompt** (in `before_agent_start` ~line 640)
   - Add instruction block when `restrict_cwd_active` is true
   - Inform agent about CWD restriction

7. **Add tests to `buck-mode.test.ts`**
   - Test `/b-restrict on` enables restriction
   - Test `/b-restrict off` disables restriction
   - Test `/b-restrict status` shows current state
   - Test default state has `restrict_cwd_active: true`
   - Test write outside CWD is blocked when active
   - Test write inside CWD is allowed when active
   - Test write outside CWD is allowed when inactive

8. **Run tests and verify**
   - `npm test` should pass
   - Manual verification: start pi, run `/b-restrict status`, verify default is ON

## Verification

- [x] `/b-restrict status` shows `CWD restriction: active` by default
- [x] `/b-restrict off` disables restriction, notification shown
- [x] `/b-restrict on` enables restriction, notification shown
- [x] Write to `/tmp/test.txt` blocked when restriction is ON
- [x] Write to `./src/file.ts` allowed when restriction is ON
- [x] Write to `/tmp/test.txt` allowed when restriction is OFF
- [x] Status indicator `🔒 cwd` appears in status bar when active
- [x] All existing tests still pass
- [x] New tests added and passing

## Ralph Instructions

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` before `ralph_done` so memory, draft commits, and review/iteration artifacts are durable.
5. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next iteration.

## Risks

- **Low risk**: Feature is additive, doesn't change existing plan mode or buck workflow mode
- **Edge case**: Absolute paths with symlinks might bypass simple string comparison (acceptable for now)
- **User friction**: Default ON might surprise users who expect unrestricted writes (mitigate with clear notification on session start)

## Notes

- CWD restriction is orthogonal to plan mode — both can be active independently
- When both are active, plan mode is stricter (blocks more paths)
- Restriction state is session-scoped (not persisted to disk)
- Tab completion provides discoverability for the command arguments
