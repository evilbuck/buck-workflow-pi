---
status: completed
date: 2026-05-19
subject: 2026-05-19.ralph-loop-plan-phase
topics: [b-phase, b-plan, b-build, ralph-loop, workflow-automation]
brainstorm: [brainstorm-ralph-loop-plan-phase.md]
research: []
iterations: []
spec: null
memory: [ralph-loop-plan-phase-build-2026-05-19.md]
---

# Plan: Ralph Loop-Enabled Plan-Phase Artifacts

## Goal

Enhance Buck workflow skills so that plan-phase output is **Ralph loop-ready** — containing embedded workflow navigation instructions that enable autonomous multi-phase execution via Ralph with full idempotency and mid-cycle resume support.

## Context used / assumptions

- **User-provided context**: Full brainstorm session captured in `brainstorm-ralph-loop-plan-phase.md` with all design decisions confirmed
- **Session context**: Buck workflow skills (`b-phase`, `b-plan`, `b-build`, `b-review`, `b-iterate`) in `skills/` directory; Ralph extension in `pi-ralph-wiggum/` (read-only, no changes)
- **Key assumption**: Ralph instructions are additive — existing plan-phase functionality is preserved for non-Ralph users
- **Key assumption**: b-save is always available in the target environment
- **Open questions**: None — all design decisions confirmed in brainstorm

## Scope

- **In scope**:
  - Modify `b-phase/SKILL.md` to always emit Ralph-ready output
  - Modify `b-plan/SKILL.md` to recommend Ralph-enable and support non-phased Ralph plans
  - Modify `b-build/SKILL.md` to add Ralph-awareness for mid-cycle interruption handling
  - Minor updates to `b-review/SKILL.md` and `b-iterate/SKILL.md` for Ralph compatibility
- **Out of scope**:
  - No changes to the Ralph extension itself (`pi-ralph-wiggum/`)
  - No changes to Buck workflow commands, prompts, or extensions
  - No changes to `.context/` directory structure conventions
  - No new skills created — all changes are modifications to existing skills

## Affected files

| File | Change | Risk |
|------|--------|------|
| `skills/b-phase/SKILL.md` | **Primary** — Add Ralph instructions to overview + discrete phase file templates, add phase complexity field | Medium — largest change, affects output format |
| `skills/b-plan/SKILL.md` | **Minor** — Add Ralph-ready recommendation, note non-phased plan support | Low — additive only |
| `skills/b-build/SKILL.md` | **Minor** — Add mid-cycle interruption handling (b-save before ralph_done) | Low — additive guidance |
| `skills/b-review/SKILL.md` | **Minor** — Ensure iterate artifacts are Ralph-readable (status tracking) | Low — cosmetic alignment |
| `skills/b-iterate/SKILL.md` | **Minor** — Ensure Ralph-awareness for in-progress detection | Low — cosmetic alignment |

## Implementation steps

### Step 1: Update `b-phase/SKILL.md` — Phase file templates with Ralph instructions

**What**: Add Ralph Workflow Instructions and Ralph Execution Checklist to the phase overview template (Step 5b), and add a Ralph Mini-Cycle Instructions section to the discrete phase file template (Step 5a).

**Changes to `b-phase/SKILL.md`**:

1. **Step 5a (Discrete Phase Files)** — Add a `ralph_complexity` field to phase file frontmatter:
   - `ralph_complexity: single | multi` — signals to Ralph whether this phase should fit in one iteration or may need multiple
   - Add a "Ralph Mini-Cycle" body section after "Verification" that tells Ralph what to do if reading this file directly (the 4-step cycle: build → review → iterate → save)

2. **Step 5b (Phases Overview File)** — Add two sections after "Execution Order":
   - **"Ralph Workflow Instructions"** — full per-phase cycle instructions with mid-cycle interruption guidance
   - **"Ralph Execution Checklist"** — `[ ]` checkbox list of phases that Ralph tracks

3. **Step 7 (Summarize)** — Add Ralph invocation hint to the user-facing summary

### Step 2: Update `b-plan/SKILL.md` — Ralph awareness

**What**: Minor updates to recommend b-phase for large plans and note that non-phased plans also support Ralph.

**Changes to `b-plan/SKILL.md`**:

1. In the "Behavior" section, update the `b-phase` recommendation to also note that b-phase output is Ralph-ready
2. Add a "Non-Phased Ralph Plan" note: if a plan doesn't need phasing but the user wants Ralph, the plan file should contain a minimal Ralph section (single cycle: build → review → iterate → save)
3. In the "Recommended Plan Structure", add an optional "Ralph Instructions" section to the template

### Step 3: Update `b-build/SKILL.md` — Mid-cycle interruption handling

**What**: Add guidance for when b-build runs inside a Ralph loop and can't complete in one iteration.

**Changes to `b-build/SKILL.md`**:

1. Add a "Ralph Loop Awareness" section under "Session Awareness Protocol" (or as a new section)
2. Key guidance: if the phase work won't complete in this iteration, run b-save first to write durable artifacts (memory, commit draft), then call `ralph_done`
3. Phase file status should be `in-progress` — next iteration will detect this and resume
4. Also note in the "Phased Plan Awareness" section that Ralph loops may trigger mid-phase resumption

### Step 4: Update `b-review/SKILL.md` — Ralph-compatible iterate artifacts

**What**: Ensure the iterate artifact format is Ralph-readable and status tracking is clear.

**Changes to `b-review/SKILL.md`**:

1. Add `ralph_status: pending | completed` to the iterate artifact frontmatter (minor addition)
2. Ensure the "Recommended Workflow" section explicitly tells Ralph to run b-iterate then re-run b-review

### Step 5: Update `b-iterate/SKILL.md` — Ralph awareness

**What**: Ensure b-iterate picks up in-progress iteration artifacts and signals completion back to the phase file.

**Changes to `b-iterate/SKILL.md`**:

1. In "Context Resolution", note that if running inside a Ralph loop, the agent should check the phase file's `in-progress` status and resume from the iterate artifact
2. In "Closeout", note that after completing iteration, the agent should re-run b-review (per Ralph cycle) before calling ralph_done

### Step 6: Write Ralph Instructions Template

**What**: Create a reusable template snippet for the Ralph Workflow Instructions section that both b-phase and b-plan will embed.

**Content**: The full "Ralph Workflow Instructions" + "Ralph Execution Checklist" markdown blocks that get inserted into phase overview files (and adapted for non-phased plan files).

This should be written as a new section in `b-phase/SKILL.md` (as a "Ralph Instructions Template" reference section) so that b-phase and b-plan both reference the same canonical text.

## Verification

- [x] `b-phase/SKILL.md` contains Ralph instructions in both overview and discrete phase file templates
- [x] `b-phase/SKILL.md` includes a reusable Ralph Instructions Template section
- [x] `b-plan/SKILL.md` recommends b-phase and supports non-phased Ralph plans
- [x] `b-build/SKILL.md` has mid-cycle interruption guidance (b-save → ralph_done)
- [x] `b-review/SKILL.md` iterate artifacts are Ralph-compatible
- [x] `b-iterate/SKILL.md` has Ralph awareness for resume
- [x] All changes are additive — existing skill behavior preserved for non-Ralph users
- [x] No changes to Ralph extension code
- [x] Skills pass self-consistency check (cross-references between skills still valid)

## Risks

| Risk | Mitigation |
|------|-----------|
| Ralph instructions clutter the phase files for non-Ralph users | Keep instructions in clearly labeled sections; non-Ralph users naturally ignore them |
| Mid-cycle interruption creates stale artifacts | b-save writes durable state before ralph_done; next iteration re-reads and resumes cleanly |
| Phase complexity rating is wrong (marked "single" but needs multiple iterations) | Bakes into the mid-cycle interruption handling — b-build detects this at runtime and calls b-save + ralph_done |
| Skills become too large/complex | Changes are additive and small; existing sections are preserved, not rewritten |
| Non-phased plan Ralph instructions don't match phased format | Use same template with conditional: if phases exist, use full cycle; if not, treat whole plan as one unit |

## Recommended next step

`/b-build` — straightforward skill file edits, no ambiguity. All design decisions confirmed in brainstorm.
