---
status: completed
date: 2026-05-06
subject: 2026-05-06.b-phase-discrete-files
topics: [b-phase, discrete-phase-files, plan-state-tracking, session-resume, b-build, b-build-hard, b-save]
research: []
spec:
memory: [b-phase-discrete-files-2026-05-06.md]
---

# Plan: Discrete Phase Files + Plan State Tracking for Session Resume

## Goal

Give b-phase discrete phase files (one file per phase) and make b-build/b-build-hard update phase state *and* the parent plan's phase state on completion — so any future b-* session can pick up exactly where the last one left off without guessing.

## Context used / assumptions

- **User-provided context**: "b-phase should create discrete phase files and link to them in the greater plan. During b-build and b-build-hard, they should not only update each phase state, but update the plan-\* file state for each phase so we can come back without context, run a b-\* workflow prompt or skill, and it should be able to pickup where it left off."
- **Session context**: Prior work (2026-05-01, 2026-05-02) built b-phase as a single `plan-*-phases.md` file. The extension reads acceptance-criteria checkboxes to determine the active phase for model auto-switch. This works for model routing but provides no durable per-phase state.
- **Artifacts used**: 
  - `skills/b-phase/SKILL.md` — current single-file phasing workflow
  - `prompts/b-build.md` — phased plan awareness section
  - `prompts/b-build-hard.md` — phased plan awareness section
  - `extensions/index.ts` — `findActivePhaseDifficulty()` reads checkbox state
  - `docs/buck-workflow.md` — full workflow docs
- **Assumptions / open questions**:
  - The current `plan-*-phases.md` single-file format still has value as an *overview* (dependency matrix, execution order) but phases themselves need their own files
  - The extension's `findActivePhaseDifficulty()` needs to be updated to read discrete phase files
  - b-save should be updated to handle phase completion state updates
  - The format should be backwards-compatible — projects with existing single-file phases shouldn't break

## Scope

### In scope
1. **b-phase skill** — rewrite to create one `phase-N-<slug>.md` file per phase, plus an overview `plan-*-phases.md` that links to them
2. **Discrete phase file format** — frontmatter with `status`, `order`, acceptance criteria as checkable items; body with implementation details from the current template
3. **b-build / b-build-hard prompts** — add explicit instructions to update the phase file's frontmatter (`status: completed`) and acceptance criteria checkboxes upon completion, then update the parent `plan-*-phases.md` overview to reflect the new state
4. **Extension `findActivePhaseDifficulty()`** — update to scan discrete phase files for the first non-completed phase
5. **b-save** — add phase state consolidation to its responsibilities (ensure phase files and overview are consistent)
6. **docs/buck-workflow.md** — update the b-phase section to document the new discrete file format

### Out of scope
- Changing the b-grill-me or b-grill-with-docs skills
- Changing the model auto-switch logic (it already works; just needs updated file reader)
- Adding parallel execution support (phases are still sequential for now)
- Changing how b-plan recommends b-phase (already works)

## Affected files

| File | Change |
|------|--------|
| `skills/b-phase/SKILL.md` | Major rewrite — new discrete phase file workflow, updated templates |
| `prompts/b-build.md` | Add phase file state update instructions to closeout section |
| `prompts/b-build-hard.md` | Add phase file state update instructions to closeout section |
| `extensions/index.ts` | Update `findActivePhaseDifficulty()` to read discrete phase files |
| `docs/buck-workflow.md` | Update b-phase section, add discrete phase file format docs |

## Implementation steps

### Step 1: Define discrete phase file format

Create a concrete file format for `phase-N-<slug>.md` files:

```yaml
---
status: pending | in-progress | completed
phase: N
order: N
plan: plan-<topic>.md
phases_overview: plan-<topic>-phases.md
difficulty: easy | medium | hard
model_hint: <description>
buck_hint: /b-build | /b-build-hard
goal: "<one sentence>"
files: [path/to/file1, path/to/file2]
from_plan_steps: [3, 4, 5]
depends_on: [1]          # phase numbers this depends on
dependency_type: HARD | SOFT | NONE
acceptance_criteria:
  - "[ ] <checkable outcome>"
  - "[ ] <checkable outcome>"
completed_at: null | YYYY-MM-DD
completed_by: null | session-id or memory-file reference
---
```

Body: implementation details, context, risks, verification steps.

**Status flow**: `pending` → `in-progress` (when b-build picks it up) → `completed` (when acceptance criteria pass)

### Step 2: Update b-phase skill (SKILL.md)

**Changes to the skill:**

1. **Step 5 (Write Phases File)** becomes two outputs:
   - `plan-<topic>-phases.md` — *overview only*: summary table, dependency matrix, execution order, links to discrete phase files
   - `phase-N-<slug>.md` × N — one file per phase with full implementation details

2. **Phase overview file** (`plan-*-phases.md`) becomes a lightweight index:
   ```markdown
   ## Phase Summary

   | Phase | Status | Difficulty | File |
   |-------|--------|------------|------|
   | 1: Schema & Migrations | pending | medium | [phase-1-schema-migrations.md](phase-1-schema-migrations.md) |
   | 2: API Endpoints | pending | medium | [phase-2-api-endpoints.md](phase-2-api-endpoints.md) |
   ```

3. **Step 6 (Update Backlog)** — create per-phase backlog items that link to the discrete phase file

4. **Keep the dependency matrix and diagram** in the overview file

### Step 3: Update b-build.md prompt — phase state tracking

Add to the "Phased Plan Awareness" section:

```
### Phase State Updates (Required)

When working on a phased plan with discrete phase files:

1. **At start**: Read the phases overview to find the active phase (first non-completed). Read that phase file.
2. **Mark phase in-progress**: Update the phase file's frontmatter `status: in-progress`.
3. **Implement**: Execute only the current phase's scope.
4. **On completion**:
   a. Update acceptance criteria checkboxes in the phase file: `[ ]` → `[x]`
   b. Set `status: completed` and `completed_at: YYYY-MM-DD` in phase file frontmatter
   c. Update the phases overview file (`plan-*-phases.md`): change the phase's status from `pending`/`in-progress` to `completed` in the summary table
   d. Note the next phase to execute
5. Tell the user which phase was completed and what's next.
```

### Step 4: Update b-build-hard.md prompt — same phase state tracking

Same changes as Step 3, adapted for b-build-hard context (stronger verification, risk surfacing).

### Step 5: Update extension `findActivePhaseDifficulty()`

Current logic scans a single `plan-*-phases.md` for `## Phase N` sections and checks acceptance criteria inline.

New logic:
1. Find `plan-*-phases.md` overview files
2. For each, find linked discrete phase files
3. Scan phase files in order — return the difficulty of the first one with `status != completed`
4. Fallback: if no discrete phase files exist (legacy format), use current checkbox-scanning logic

This maintains backwards compatibility with existing single-file phased plans.

### Step 6: Update b-save handler (in extension)

Add to the b-save prompt instructions:

```
### Phase State Consolidation (Responsibility 9)

If phased plan files exist in the subject folder:
1. Read all `phase-N-*.md` files — verify their `status` matches reality (were acceptance criteria met?)
2. Read the phases overview `plan-*-phases.md` — verify the summary table matches phase file states
3. If any phase file shows `status: in-progress` but all criteria are checked, update to `completed`
4. If the overview table is stale, update it
```

### Step 7: Update docs/buck-workflow.md

Update the b-phase section to document:
- Discrete phase file format and location
- Status flow (`pending` → `in-progress` → `completed`)
- Overview file role (index + dependency matrix)
- Resume behavior (any b-* command reads overview → finds active phase → reads phase file)
- Backwards compatibility note for single-file legacy format

## Verification

- [ ] b-phase creates discrete phase files when run against a plan
- [ ] Each phase file has proper frontmatter with `status`, `difficulty`, `acceptance_criteria`
- [ ] The phases overview links to all phase files and shows a summary table
- [ ] b-build reads the active phase file, marks it `in-progress`, then `completed` on finish
- [ ] b-build updates the overview table when a phase completes
- [ ] Extension `findActivePhaseDifficulty()` works with both new (discrete) and legacy (single-file) formats
- [ ] b-save consolidates phase state correctly
- [ ] A cold-start agent can pick up where work left off by reading only the phases overview
- [ ] Existing single-file `plan-*-phases.md` plans still work (backwards compat)

## Risks

- **Migration path**: Existing projects with single-file phased plans won't automatically get discrete phase files. The extension fallback handles this, but users should know they can re-run b-phase to regenerate in the new format.
- **State drift**: If a user edits files manually and doesn't use b-build, phase state could drift from reality. b-save consolidation is the safety net.
- **File proliferation**: A 6-phase plan creates 7 new files (6 phases + 1 overview). Acceptable for the resumability benefit, but the overview file is critical to keep things scannable.

## Recommended execution

This plan has 7 steps across 5 files, touching the skill layer, prompt templates, extension, and docs. It spans multiple architectural layers (prompt → skill → extension → docs).

**Recommendation**: This plan benefits from phasing via `/skill:b-phase`. But since the primary deliverable *is* the phase system itself, I recommend `/b-build-hard` — it's self-referential (building the phasing system) and touches runtime code (extension).
