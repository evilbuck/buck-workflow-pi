---
status: active
date: 2026-06-01
subject: 2026-06-01.deprecate-b-flow
topics: [deprecation, b-flow, xstate, extension, removal-marking]
research:
  - ../2026-05-08.b-orchestration-extension/research-xstate-for-b-flow.md
  - ../2026-05-30.b-flow-sdk-redesign/research-pi-sdk-worker-architecture.md
  - ../2026-05-30.b-flow-sdk-redesign/architecture-review-sdk-worker.md
spec: ../2026-05-08.b-orchestration-extension/spec-b-flow-state-machine.md
iterations: []
memory: []
---

# Plan: Deprecate b-flow Extension

## Goal

Disable `extensions/b-flow/` at runtime and mark it as **deprecated-for-removal** so future agents do not attempt to revive the extension. The directory and its tests stay on disk behind a `DEPRECATED.md` banner — a later pass performs the actual deletion.

Rationale (from user + architecture review):
- b-flow is "wired but never invoked in practice" (`.context/2026-05-30.b-flow-sdk-redesign/architecture-review-sdk-worker.md`, line 13)
- The XState v5 design is the root cause of over-engineering — too much state machine for the value delivered
- The user wants agents to see the deprecation marker before attempting resurrection

## Context used / assumptions

### User-provided context
- "The buck-workflow or b-flow doesn't work... too complicated and doesn't actually run as it is. I think xstate might be too much and overcomplicating it."
- "For now, lets just disable it and mark it as deprecated and marked for removal" — explicit: disable first, delete later

### Session context (from prior inline scout)
- `extensions/b-flow/` is wired into `extensions/index.ts`: import at line 12 (`import { wire as wireBFlow } from "./b-flow/index.js"`), call at line 521 (`wireBFlow(pi)`) sandwiched between `wireGrillDialog` and `wireTpsTracker`
- `package.json` declares `"xstate": "^5.0.0"` — a runtime dep that becomes dead weight after disable
- All `xstate` import sites in active source are inside `extensions/b-flow/` only (5 files: `index.ts`, `machine.ts`, `chunk-queue-machine.ts`, plus 2 test files using `createActor`); no other extension or skill uses xstate
- All `orchestration.json` write/read sites are inside `extensions/b-flow/` (persistence.ts + tests); removing b-flow leaves the file unwritten
- b-flow tests use `vitest` (NOT `node:test` as the prior scout initially claimed — verified: all 6 test files import from `"vitest"`). The tests pass at 77/77 per the SDK redesign verification log
- `wire.test.ts` imports `wire` directly from `../index.js` and tests it in isolation — it does NOT depend on `wireBFlow(pi)` being called at boot. Disabling the boot call does not break the tests
- b-grill-auto (`extensions/b-grill-auto/`) is a separate extension that also uses state machines — user said "it" (singular) and pointed at b-flow; b-grill-auto is **out of scope**

### Artifacts used
- `.context/2026-05-08.b-orchestration-extension/research-xstate-for-b-flow.md` — original xstate evaluation
- `.context/2026-05-08.b-orchestration-extension/spec-b-flow-state-machine.md` — state machine spec (deprecates alongside the code)
- `.context/2026-05-30.b-flow-sdk-redesign/research-pi-sdk-worker-architecture.md` — SDK worker research
- `.context/2026-05-30.b-flow-sdk-redesign/architecture-review-sdk-worker.md` — architecture review with the "wired but never invoked" verdict (deprecation smoking gun)
- `.context/2026-05-30.b-flow-sdk-redesign/architecture-review-sdk-worker.md` § 4 — original file-change plan that was implemented and led to current state

### Assumptions
- The user is OK with a two-step deprecation: (1) disable + mark now, (2) delete in a later session. Confirmed by the phrasing "for now, lets just disable... marked for removal"
- The b-flow tests staying green is desirable but not load-bearing — they exercise internal logic that no live workflow triggers
- All historical `.context/` subject folders (2026-05-08.b-orchestration-extension, 2026-05-30.b-flow-sdk-redesign) are preserved as record, not edited

### Open questions
- Should the deprecation banner in `extensions/b-flow/index.ts` also set a `console.warn` at import time (so anyone who accidentally re-enables it sees a runtime notice)? Recommend: yes, but only if the import side-effect path is light. Defer to `b-build` discretion
- Should the `presentations/b-flow-sdk-redesign/` directory be moved under an `archive/` subfolder? It is a historical artifact from the SDK redesign session. Recommend: leave in place for this pass; archive later if/when b-flow is fully deleted

## Scope

Disable the b-flow runtime wiring, mark the extension as deprecated-for-removal at every cross-reference point (code, docs, skills, manifest), and prune the now-unused `xstate` dependency. The directory, tests, and historical artifacts remain on disk for traceability and a later delete pass.

## Out of scope

- Deleting `extensions/b-flow/` directory (later pass)
- Removing the b-flow tests (tests still pass after disable — keeping them documents the original behavior)
- Modifying or fixing the b-flow state machine (this is disable, not refactor)
- `extensions/b-grill-auto/` extension (different concern; user singled out b-flow)
- Historical `.context/**` subject folders and their plans/specs (record, not edited)
- `presentations/b-flow-sdk-redesign/` directory (historical artifact)
- Other Buck workflow changes (buck-mode, b-save, etc.)

## Affected files

| File | Change |
|------|--------|
| `extensions/index.ts` | Remove `import { wire as wireBFlow } from "./b-flow/index.js"` (line 12) and `wireBFlow(pi)` call (line 521). Delete the `// --- b-flow orchestration ---` comment block (lines 520-521). |
| `extensions/b-flow/DEPRECATED.md` | **New file.** Deprecation notice explaining the rationale, the disable mechanism, the "do not revive" instruction, and a pointer to the original research + architecture review. |
| `extensions/b-flow/index.ts` | Prepend a deprecation banner comment (top of file, before the first import) referencing `DEPRECATED.md`. No code logic changes. |
| `package.json` | Remove `"xstate": "^5.0.0"` from `dependencies`. |
| `docs/b-flow.md` | Replace the entire file body with a single deprecation notice pointing to `extensions/b-flow/DEPRECATED.md` and the historical record (`.context/2026-05-30.b-flow-sdk-redesign/architecture-review-sdk-worker.md`). Keep the filename so any old cross-references do not 404. |
| `docs/buck-workflow.md` | Replace the `## b-flow — Autonomous Orchestration` section (lines 36-78) with a deprecation notice. Keep section anchor so old links do not break. |
| `README.md` | Three locations: (1) line 37 layered-architecture bullet, (2) line 65 extension command list, (3) line 89 extension (session tracking) section. Update each to drop the b-flow mention and add a one-line "(b-flow deprecated — see docs/b-flow.md)" note where appropriate. |
| `AGENTS.md` | Line 46: update `extensions/      # Pi extensions for runtime automation (b-flow, b-grill-auto)` to drop b-flow. |
| `skills/_shared/subject-resolution.md` | Step 2 "Check for b-flow Session" (lines 13-15): replace the active check with a no-op stub + a comment explaining b-flow is deprecated, or remove the step entirely and renumber Step 3+ to Step 2+. Also update the example menu in Step 5 (line 51) and the phase-selection example (line 67) so they no longer reference b-flow as the example subject. |

## Implementation steps

1. **`extensions/index.ts`** — delete the `wireBFlow` import (line 12) and the `// --- b-flow orchestration ---` block (lines 520-521, including the `wireBFlow(pi)` call). Keep all surrounding extensions (`wireTmuxStatus`, `wireGrillAuto`, `wireGrillDialog`, `wireTpsTracker`) untouched.

2. **`extensions/b-flow/DEPRECATED.md`** — write a new deprecation notice with these sections: Status (Deprecated, Scheduled for Removal), Reason (wired but never invoked; XState over-engineering), When Deprecated (2026-06-01), Original Research links (xstate-for-b-flow, architecture-review-sdk-worker), Original Plan links (plan-b-flow-mvp, plan-b-flow-sdk-redesign), Do Not Revive (explicit instruction to future agents, including "if you are considering re-enabling this extension, see the architecture review first and confirm with the user").

3. **`extensions/b-flow/index.ts`** — prepend a 3-5 line banner comment to the top of the file (before the first `import`) reading:
   ```ts
   /**
    * @deprecated See ./DEPRECATED.md. This extension is disabled at runtime
    * (see extensions/index.ts). Do not revive without explicit user direction
    * and a fresh architecture review.
    */
   ```
   Do not touch the code below the banner.

4. **`package.json`** — remove the `"xstate": "^5.0.0"` line from `dependencies`. After removal, the only top-level key in `dependencies` should be the remaining 6 deps (no other code imports xstate — verified above).

5. **`docs/b-flow.md`** — replace the entire body (everything from `# b-flow: Autonomous Workflow Orchestration` onward) with a deprecation stub:
   ```md
   # b-flow: Autonomous Workflow Orchestration

   > **Deprecated 2026-06-01.** The b-flow extension is disabled at runtime and scheduled for removal. See `extensions/b-flow/DEPRECATED.md` for rationale, original research, and the "do not revive" notice. The historical record of the implementation remains in `.context/2026-05-08.b-orchestration-extension/` and `.context/2026-05-30.b-flow-sdk-redesign/`.
   ```
   Keep the H1 title and the filename unchanged so old `docs/b-flow.md` cross-references in other docs still resolve.

6. **`docs/buck-workflow.md`** — replace lines 36-78 (the `## b-flow — Autonomous Orchestration` section) with a deprecation stub. Keep the H2 heading so any anchor links from other docs continue to work:
   ```md
   ## b-flow — Autonomous Orchestration

   > **Deprecated 2026-06-01.** See [docs/b-flow.md](b-flow.md) and `extensions/b-flow/DEPRECATED.md`. The b-flow extension is disabled at runtime and scheduled for removal.
   ```
   Verify no other section in `docs/buck-workflow.md` references the removed `/b-flow start`/`/b-flow run` commands after this change.

7. **`README.md`** — three edits:
   - Line 37 layered-architecture bullet: change `Runtime automation (\`extensions/\`) — Session tracking, state orchestration, and event-driven behavior that needs hooks and persistence` to drop the "state orchestration" phrasing or add a parenthetical "(b-flow deprecated — see docs/b-flow.md)".
   - Line 65 extension command list (`/b-save`, `/b-mode`): confirm no b-flow entry exists. If any, remove it.
   - Line 89 extension (session tracking) section: confirm no `/b-flow` mention. If any, replace with a one-line deprecation note.

8. **`AGENTS.md`** — line 46: change `extensions/      # Pi extensions for runtime automation (b-flow, b-grill-auto)` to `extensions/      # Pi extensions for runtime automation (b-grill-auto; b-flow deprecated — see docs/b-flow.md)`.

9. **`skills/_shared/subject-resolution.md`** — three edits:
   - Step 2 (lines 13-15): replace the entire step body with `> **Removed 2026-06-01.** b-flow is deprecated. This step is a no-op preserved for now. Skip to the next step.`
   - Renumber subsequent steps (Step 3 → Step 2, etc.).
   - Update the example menu in the (renumbered) "Present Selection" step: change the `b-flow-sdk-redesign (05-30) — phase 2/3` example entry to use a different subject (e.g. `cwd-restrict-mode (05-30) — plan`).
   - Update the phase-selection example (line 67) to use `cwd-restrict-mode` instead of `b-flow-sdk-redesign`.

10. **No re-enable attempts** — explicitly do not touch the b-flow tests (`extensions/b-flow/__tests__/`). They should continue to pass because they test the `wire` function in isolation, not the boot-time `wireBFlow(pi)` invocation.

11. **Audit run** — after all edits, run the following from the repo root and verify only expected matches remain:
    - `rg -n "wireBFlow" --type ts -g '!*.test.ts'` → 0 matches in `extensions/index.ts`; matches allowed in `extensions/b-flow/index.ts` (the export name) and historical `.context/**`
    - `rg -n "xstate" --type ts -g '!extensions/b-flow/**' -g '!.context/**'` → 0 matches
    - `rg -n "b-flow" -g '!extensions/b-flow/**' -g '!.context/**' -g '!docs/b-flow.md' -g '!presentations/b-flow-sdk-redesign/**'` → only deprecation markers in `docs/buck-workflow.md`, `README.md`, `AGENTS.md`, and `skills/_shared/subject-resolution.md`
    - `rg -n "orchestration\.json" --type ts -g '!extensions/b-flow/**' -g '!.context/**'` → 0 matches in active source

## Verification

- **Typecheck**: `pnpm tsc --noEmit` — must report 0 new errors. The b-flow removal drops ~5 xstate type imports but those are local to `extensions/b-flow/`; the only top-level import of b-flow was `wireBFlow` in `extensions/index.ts`, which we removed.
- **Tests**: `pnpm vitest run` — must report the same pass count as before (77 b-flow tests + everything else). The b-flow tests will continue to pass because `wire.test.ts` exercises the `wire` export directly and does not depend on the boot-time call.
- **Boot smoke**: `pnpm exec pi --help` (or equivalent minimal launch) must not throw — no module-load-time error from the missing `wireBFlow`.
- **Manifest audit**: `rg "b-flow" package.json README.md AGENTS.md docs/buck-workflow.md skills/_shared/subject-resolution.md extensions/index.ts` — every match should either be a deprecation marker, a historical cross-reference, or the H1/H2 anchor kept for backward compatibility.
- **No new xstate import**: `rg '"xstate"' --type ts -g '!extensions/b-flow/**' -g '!.context/**'` — must return 0.
- **No live wiring**: `rg 'wireBFlow\(' extensions/index.ts` — must return 0.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Removing the `xstate` dep breaks a transitive type resolution in some other file that was relying on it (e.g. a `.d.ts` lookup) | Low | Low | `pnpm tsc --noEmit` is the verification step; xstate is only used inside `extensions/b-flow/` per the source-level audit |
| A test outside `extensions/b-flow/__tests__/` imports something from b-flow transitively | Low | Medium | `rg "from ['\"].*b-flow"` against the full source shows only the `wireBFlow` import in `extensions/index.ts` and the test files in `extensions/b-flow/__tests__/` |
| `docs/b-flow.md` is referenced from a doc we haven't audited (e.g. a `presentations/` source) and removing the body breaks that reader | Low | Low | The plan keeps the H1 title and the filename; the body becomes a deprecation stub. Search for `docs/b-flow.md` cross-refs before merging if the audit grep shows unexpected hits |
| Future agent attempts revival despite the deprecation banner | Medium | Medium | The banner + `DEPRECATED.md` cover the convention, but the only durable guard is human review. The `DEPRECATED.md` should be explicit: "Do not revive without explicit user direction and a fresh architecture review" |
| Removing the `wireBFlow(pi)` call leaves dangling references in `extensions/b-flow/index.ts` that are now dead code | Certain | None (cosmetic) | This is intentional — the file stays so the export and tests remain valid. The banner documents the dormant state |
| `package.json` removal of `xstate` triggers a lockfile churn that breaks other workflows | Low | Low | `pnpm install` after the edit will re-prune the lockfile; verify no other workspace package depends on xstate |
| `skills/_shared/subject-resolution.md` step renumbering creates an off-by-one if any external doc references step numbers | Low | Low | The protocol file is the only consumer of these step numbers; the renumbering is internal to it |

## Ralph Instructions

This is a non-phased Ralph-ready plan (10 implementation steps, all in one `extensions/**` + `docs/**` + `package.json` layer, low per-step ambiguity). Single-unit cycle:

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan. Reviewer should specifically check the `rg` audits in step 11 and the verification commands.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` before `ralph_done` so memory, draft commits, and review/iteration artifacts are durable. The b-save should also back-fill the `memory:` field in this plan's frontmatter with the relevant b-flow memory files (`.context/memory/b-flow-*.md`, `.context/memory/b-orchestration-extension-2026-05-08.md`, `.context/memory/b-phase-bflow-plan-2026-05-08.md`, `.context/memory/subject-phase-detection-2026-05-17.md`).
5. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next iteration.
