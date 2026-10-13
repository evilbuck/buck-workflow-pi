---
status: active
date: 2026-05-20
subject: 2026-05-20.b-plan-step-specificity
topics: [b-plan, step-specificity, build-readiness, skill-quality, plan-contract]
research: []
iterations: []
spec: null
memory: []
---

# Plan: Tighten b-plan Step Output for Build Readiness

## Goal

Make b-plan produce implementation steps that are concrete enough for b-build to execute without making architectural decisions. Add a "build readiness" self-check so the planner can catch vague steps before they reach the builder.

## Context used / assumptions

- **User-provided context**: Analysis session where we reviewed 7 real plans and 1 spec across `.context/` subject folders. The user observed that plans feel "loose" and wondered if they need to become harder specs or user stories.
- **Session context**: Concluded that the current three-tier model (research → spec → plan) works, but mid-sized plans sometimes produce vague implementation steps that force b-build to make design decisions mid-build.
- **Key finding**: The gap isn't structure (plans already have the right sections) — it's specificity of implementation steps. Tight plans (tmux bug fix) show exact before/after code. Loose plans (b-flow MVP, prompt-to-skill portability) give directions like "define types" or "add validation guidance."
- **Key finding**: Plans that are too loose already get escalated to specs or phasing. The gap is in the middle — plans that pass the size threshold but have steps that aren't concrete enough for b-build.
- **Assumption**: This is a skill-instruction change only. No TypeScript extension work, no new artifact types, no structural changes to `.context/`.
- **Assumption**: The change should not add ceremony for small plans. A 3-step bug-fix plan should not need a build-readiness checklist.

## Scope

- Add a **Step Specificity Standard** section to `b-plan/SKILL.md` that defines what a build-ready step looks like.
- Add a **Build Readiness Self-Check** section that b-plan runs before finalizing the plan.
- Update the **Recommended Plan Structure** template to include per-step acceptance.
- Add a corresponding **Step Specificity** note to `b-phase/SKILL.md` so discrete phase files inherit the same standard.
- Add a **Step Specificity** note to `b-build/SKILL.md` so the builder knows what to expect and when to push back.

## Out of scope

- Creating a new artifact type (spec, user story, or "build contract").
- Changing the `.context/` directory structure.
- Modifying b-research, b-brainstorm, or b-review.
- Adding automated validation of plan quality (this is a skill instruction, not a linter).
- Changing b-save behavior or session tracking.
- Forcing all plans through a rigidity gate — small plans stay lightweight.

## Affected files

| File | Change | Risk |
|------|--------|------|
| `skills/b-plan/SKILL.md` | **Primary** — Add step specificity standard, build-readiness self-check, update plan template | Medium — changes what b-plan produces |
| `skills/b-phase/SKILL.md` | **Minor** — Add step specificity note for discrete phase files | Low — additive guidance |
| `skills/b-build/SKILL.md` | **Minor** — Add step specificity expectations and push-back guidance | Low — additive guidance |

## Implementation steps

### Step 1: Add Step Specificity Standard to `b-plan/SKILL.md`

**What**: Add a new section (after "Behavior", before "Plan Frontmatter Template") that defines three levels of step specificity and what triggers each.

**Content**:

```markdown
## Step Specificity Standard

Every implementation step must be **build-ready**: b-build should be able to execute it without making architectural decisions. If a step requires design judgment, the plan isn't done.

### Specificity Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **Concrete** | The change is localized and well-understood | "In `TmuxAdapter.init()` (line ~196), remove the `savedName !== null` guard from the early return. Current: `if (!this.inTmux \|\| this.savedName !== null) return;`. New: `if (!this.inTmux) return;`" |
| **Directed** | The change spans multiple locations but the approach is clear | "Add a `build-readiness` boolean to the plan frontmatter. Update the template section, the output summary, and the plan-creation logic to set it." |
| **Scoped** | The change is architectural but the boundaries are defined | "Add a new `StepSpecificityStandard` section between 'Behavior' and 'Plan Frontmatter Template'. Cover: specificity levels, the self-check protocol, and the escalation rule." |

### Anti-patterns (not build-ready)

A step is **not build-ready** if it:
- Uses vague verbs without object: "add validation", "improve error handling", "refactor"
- Requires the builder to choose between approaches: "decide on a data structure", "pick a library"
- Describes a goal without the path: "make the UI responsive"
- Spans more than ~3 files without saying which: "update the API layer"
- Requires research or investigation that wasn't done: "figure out why X breaks"

### Escalation Rule

If you cannot write a step at least at the **Directed** level, that step needs:
- A `research-*` spike first, OR
- Breaking into smaller sub-steps, OR
- Promotion to a `spec-*` with its own requirements and acceptance criteria

Do not leave vague steps in the plan and hope b-build figures it out.
```

**Where**: Insert as a new section between "Behavior" and "Plan Frontmatter Template" in `skills/b-plan/SKILL.md`.

### Step 2: Add Build Readiness Self-Check to `b-plan/SKILL.md`

**What**: Add a protocol section that runs before the plan is finalized.

**Content**:

```markdown
## Build Readiness Self-Check

Before saving the plan, evaluate every implementation step against this checklist:

1. **Can b-build execute this step without asking clarifying questions?**
   - If no → rewrite the step with more detail, or split it
2. **Does the step specify which file(s) and approximately where?**
   - If no → add file path and location context
3. **Would two different agents interpret this step the same way?**
   - If no → make it more specific
4. **Is the step free of design decisions?**
   - If no → either make the decision in the plan (with rationale) or flag it as an explicit choice point with the options and your recommendation

**For small plans** (≤4 steps, ≤2 files): The self-check is implicit. If you can write the steps concretely, the plan is ready.

**For medium plans** (5–8 steps, 3–5 files): Run the self-check mentally and fix any vague steps before saving.

**For large plans** (>8 steps, >5 files): Run the self-check explicitly. If more than 2 steps fail, recommend `/skill:b-phase` and note which steps need phasing.

### Self-Check Result in Output

When presenting the plan summary, include a one-line readiness verdict:

- `Build readiness: ✅ all steps concrete`
- `Build readiness: ⚠️ steps 3, 5 need directed-level detail (addressed)`
- `Build readiness: ❌ steps 4, 6, 7 are vague — recommend phasing or research`
```

**Where**: Insert as a new section after "Step Specificity Standard" and before "Plan Frontmatter Template".

### Step 3: Update Plan Template in `b-plan/SKILL.md`

**What**: Evolve the "Implementation steps" section in the Recommended Plan Structure to encourage per-step specificity.

**Current template** (implementation steps section):
```markdown
## Implementation steps
1. ...
```

**Updated template**:
```markdown
## Implementation steps

### Step 1: <verb phrase describing what to do>

<What to change, where, and why. Include file path(s). If showing code, include before/after snippets for small changes or describe the shape of the change for larger ones.>

**Acceptance**: <one-line checkable outcome for this step>

### Step 2: ...
```

**Rationale**: Per-step acceptance gives b-build a clear stopping condition and gives b-review a granular completion matrix. The verb-phrase heading makes the step scannable.

**For small/obvious plans**: Steps can be more compact. A one-liner per step is fine if it names the file and the change.

### Step 4: Add Step Specificity Note to `b-phase/SKILL.md`

**What**: Add a short paragraph in the "Design Phases" step (Step 4) and the "Discrete Phase Files" template (Step 5a) referencing b-plan's step specificity standard.

**Changes to `b-phase/SKILL.md`**:

In Step 4 (Design Phases), after item 9 ("Assign a model hint to every phase"), add:

> 10. **Ensure step specificity**: Each phase's implementation steps must meet the same build-readiness standard as b-plan. Steps in phase files should be at least **Directed** level — b-build should not need to make design decisions. If a phase step is vague, either resolve the ambiguity in the phase file or flag it as needing a research spike before execution.

In the Phase File body template (Step 5a), under "## Implementation Details", change the placeholder from:
```markdown
<Step-by-step instructions from the plan, adapted to this phase's scope>
```
to:
```markdown
<Step-by-step instructions from the plan, adapted to this phase's scope. Each step should name the file, describe the change, and include a one-line acceptance. Vague steps ("add validation", "improve error handling") must be rewritten with specifics before the phase file is saved.>
```

### Step 5: Add Step Specificity Expectations to `b-build/SKILL.md`

**What**: Add a short note in b-build so it knows what to expect from plans and when to push back.

**Add to the "Context Resolution" section**, after "If a spec exists, verify the implementation satisfies its requirements":

```markdown
### Step Specificity Expectations

Plans should contain build-ready steps. If you encounter a step that:
- Is vague ("add validation", "refactor", "improve error handling")
- Requires you to make an architectural decision not documented in the plan
- Spans many files without specifying which ones

**Push back** rather than guess. Tell the user: "Step N is not build-ready — it requires [design decision / file identification / scope clarification]. Please update the plan or confirm the approach."

Exception: if the ambiguity is trivial and the correct choice is obvious from surrounding context (existing patterns, project conventions), proceed and document your choice in the session memory.
```

## Verification

- [ ] `b-plan/SKILL.md` has Step Specificity Standard section with levels, anti-patterns, and escalation rule
- [ ] `b-plan/SKILL.md` has Build Readiness Self-Check section with per-plan-size guidance and verdict output
- [ ] `b-plan/SKILL.md` plan template uses per-step verb-phrase headings and per-step acceptance
- [ ] `b-phase/SKILL.md` Step 4 references step specificity; phase file template updated
- [ ] `b-build/SKILL.md` has step specificity expectations with push-back guidance
- [ ] Existing skill behavior is preserved — changes are additive, not restructuring
- [ ] Small plans are not burdened — self-check is implicit for ≤4 steps
- [ ] Read both skill files end-to-end and confirm no conflicting guidance

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Over-specification slows down simple plans | Medium | Size-tiered self-check (implicit for small, mental for medium, explicit for large) |
| Steps become too rigid and block legitimate builder judgment | Low | Push-back works both ways — b-build can proceed if the choice is obvious from context |
| Template bloat makes the plan template harder to follow | Medium | Per-step format is a recommendation, not a mandatory form — compact one-liners are fine for obvious steps |
| b-build pushes back too aggressively on vague steps | Low | Exception clause for trivial ambiguities with obvious context-based answers |
| b-phase doesn't inherit the standard | Low | Explicit step in this plan to add the note |

## Recommended next step

`/b-build` — straightforward skill file edits. All design decisions made in this plan. Three files, additive changes, no ambiguity.
