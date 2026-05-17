---
status: active
date: 2026-05-17
subject: 2026-05-17.global-agents-buck-workflow-mode
topics: [agents, buck-workflow, mode, portability, routing, context]
research: []
iterations: []
spec: null
memory: [global-agents-buck-workflow-mode-build-2026-05-17.md]
---

# Plan: Global AGENTS cleanup and Buck-workflow mode

## Goal
Make Buck workflow more portable by shrinking the always-loaded global `~/.pi/agent/AGENTS.md` down to baseline operating guidance, while moving Buck-specific workflow semantics into Buck-owned docs/runtime behavior and introducing a clearer extension-owned `buck-workflow mode` entrypoint.

## Context used / assumptions
- User-provided context: `.context/2026-05-17.global-agents-buck-workflow-mode/grill-session-global-agents-buck-workflow-mode.md`
- Subject artifacts used:
  - `brainstorm-global-agents-buck-workflow-mode.md`
  - `grill-session-global-agents-buck-workflow-mode.md`
- Session/workflow context used:
  - `.context/workflow/current-session.json`
  - `.context/memory/2026-05-17-planning-mode-write-guards.md`
  - `.context/memory/planning-mode-guards-2026-05-17.md`
  - `.context/memory/subject-phase-detection-2026-05-17.md`
  - `.context/memory/prompt-to-skill-build-2026-05-13.md`
  - `.context/backlog/todo.md`
  - `.context/backlog.md`
- Code/docs inspected:
  - `README.md`
  - `prompts/b-plan.md`
  - `extensions/index.ts`
  - `docs/buck-workflow.md`
  - `/home/buckleyrobinson/.pi/agent/AGENTS.md`
  - `/home/buckleyrobinson/.pi/agent/docs/context-workflow.md`
- Confirmed decisions from the grill session:
  - durable artifacts remain globally valuable
  - `.context/` remains a global convention, but Buck owns the detailed taxonomy and workflow semantics
  - global AGENTS should mention Buck directly and recommend it for most non-trivial work
  - `buck-workflow mode` should be extension-owned, narrow auto-enable, and latched for the session
  - manual control should use `/b-mode on|off|status`
- Assumptions / open questions:
  - The exact trigger vocabulary for narrow auto-enable is still open (Q9 in the grill session)
  - Buck availability can be assumed in this environment; missing-Buck fallback is not a primary constraint
  - The existing `plan_mode_active` state likely becomes either a sub-mode or the enforcement layer inside the broader Buck-mode design

## Scope
- Define a cleaner split between global Pi agent guidance and Buck-owned workflow behavior
- Slim the global AGENTS file to baseline rules, a durable-artifact principle, a minimal shared `.context/` contract, and a Buck workflow hint
- Define/document what `buck-workflow mode` owns at runtime versus what remains explicit skill execution
- Add a canonical manual UX surface for mode control (`/b-mode on|off|status`)
- Add narrow auto-enable behavior based on workflow intent plus accumulated session state
- Update Buck docs so the repo becomes the source of truth for the stronger workflow semantics

## Out of scope
- Pi core/internal changes when extension points are sufficient
- Generalizing for environments where Buck is not installed
- Reworking Buck subject-folder, memory, or backlog taxonomy beyond clarifying ownership
- Large unrelated extension cleanup outside mode/routing/documentation concerns
- Full natural-language command sugar if `/b-mode` already provides the needed manual control

## Affected files
Likely files for a future implementation pass:

- `/home/buckleyrobinson/.pi/agent/AGENTS.md` — reduce always-loaded workflow detail; keep baseline rules, `.context/` principle, and Buck recommendation
- `/home/buckleyrobinson/.pi/agent/docs/context-workflow.md` — absorb or clarify detailed `.context` conventions that should not stay in the compact global AGENTS file
- `README.md` — document the global-vs-Buck split and Buck mode’s place in the layered architecture
- `docs/buck-workflow.md` — define Buck-mode semantics, triggers, manual control, and the shared `.context` contract; also correct outdated plan-mode details
- `extensions/index.ts` — implement extension-owned Buck-mode state/commands/auto-enable behavior and reconcile it with the existing plan-mode guardrail logic
- Potential global skill/entrypoint under `/home/buckleyrobinson/.pi/agent/skills/` if the generic-but-Buck-aware routing skill is implemented in the same pass
- `.context/workflow/current-session.json` schema handling via `extensions/index.ts` (state shape changes should be code-driven, not hand-edited)

## Implementation steps
1. **Write the ownership split explicitly before code changes.** ✅ DONE
   Created `ownership-split.md` mapping content into: keep global, move to global reference docs, move to Buck docs, move to Buck runtime behavior.

2. **Trim the global AGENTS file to the agreed minimum.** ✅ DONE
   Reduced from ~250 to ~120 lines. Kept baseline operating principles, safe-change rules, durable-artifact preference, `.context/` mention, and Buck recommendation. Removed Buck-specific substructure.

3. **Promote the detailed `.context` rules into reference docs.** ✅ DONE
   Updated `docs/context-workflow.md` with `.context/workflow/` in layout. Global AGENTS now references this doc.

4. **Define Buck-mode semantics in the Buck package docs.** ✅ DONE
   Added "Buck Workflow Mode" section to `docs/buck-workflow.md` covering: what mode owns, activation model, what mode does NOT do, relationship to global AGENTS.

5. **Extend the runtime state model in `extensions/index.ts`.** 🔲 DEFERRED
   Requires b-build-hard.

6. **Add canonical manual mode control.** 🔲 DEFERRED
   Requires b-build-hard.

7. **Implement narrow auto-enable and latching.** 🔲 DEFERRED
   Requires b-build-hard.

8. **Add or defer the generic Buck-aware routing entrypoint deliberately.** ✅ DEFERRED
   Documented as deferred in Buck-mode section.

9. **Update repo docs and consistency points.** ✅ DONE
   Updated `README.md`, corrected plan mode allowed paths in `docs/buck-workflow.md`.

10. **Add focused verification around mode behavior.** 🔲 DEFERRED
    Requires runtime implementation from steps 5-7 first.

## Verification
- Confirm the global `AGENTS.md` is materially smaller and no longer hardcodes Buck-specific substructures beyond the top-level `.context/` convention and Buck recommendation
- Confirm the detailed `.context` rules still exist in reference docs and are linked from the compact global AGENTS file
- Confirm `/b-mode on|off|status` works and stays in sync with the status indicator and persisted session state
- Confirm explicit workflow-shaped asks auto-enable Buck mode, while trivial ad-hoc asks do not
- Confirm auto-enabled mode latches for the session until manually disabled or the session ends
- Confirm plan-mode/write-guard behavior still blocks writes outside `.context/` and `docs/` when the planning phase is active
- Confirm `/b-build`, `/b-build-hard`, `/b-iterate`, `/b-review`, and `/b-save` interactions remain coherent after the state-model change
- Run the narrowest relevant checks for extension/documentation work (at minimum `npm test`, and `npx tsc --noEmit` if TypeScript/runtime code changes)

## Risks
- **Instruction split drift**: global AGENTS, global docs, and Buck docs may contradict each other if the migration is only partially completed
- **State-model confusion**: broadening from `plan_mode_active` to a more general Buck-mode concept can introduce subtle bugs if write-guard state and workflow-intent state are not separated cleanly
- **Over-eager auto-enable**: heuristics may activate Buck mode for ordinary requests and make the workflow feel intrusive
- **Under-eager auto-enable**: if trigger vocabulary is too narrow, the portability benefit is lost because Buck mode rarely activates when users expect it to
- **External-file coupling**: this work spans both the repo and the user’s global Pi configuration/docs, which raises review and rollout complexity

## Recommended next step
This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to split it into sequential phases (for example: ownership/docs split, runtime mode command/state, and auto-routing/verification).

If executing without phasing, prefer `b-build-hard` because this crosses runtime behavior, documentation contracts, and global-vs-package ownership boundaries.
