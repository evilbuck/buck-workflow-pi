# Plan: Ralph Loop-Enabled Plan-Phase Artifacts

## What we might build

Enhance the Buck workflow `b-phase` (and optionally `b-plan`) output so that plan-phase files are **Ralph loop-ready** — containing embedded workflow navigation instructions that allow a Ralph loop to autonomously drive each phase through the full Buck workflow cycle (`b-build|b-build-hard` → `b-review` → `b-iterate` → `b-save`).

**Skills to modify:**
- **`b-phase`** — primary: always emits Ralph-ready phase files with instructions in both overview and discrete phase files
- **`b-plan`** — minor: recommend b-phase when plans are large, note non-phased plans support Ralph too
- **`b-build`** — minor: explicit Ralph-awareness (detect in-progress state, ensure durable writes before mid-cycle break)
- **`b-review`** — minor: ensure iterate artifacts are Ralph-readable
- **`b-iterate`** — minor: Ralph-awareness for picking up in-progress iteration artifacts

## Why it matters

Currently, each phase of a phased plan requires manual skill invocation. A user must read the phase, decide which skill to run, run it, then repeat for the next phase. Ralph loop support enables autonomous multi-phase execution with zero manual handoffs between phases.

## Design Decisions (Confirmed)

### Ownership
- **Buck owns the plan-phase files** — they live in `.context/YYYY-MM-DD.subject/`
- **Ralph is a consumer**, not an owner — Ralph reads the file via path argument, not by copying it to `.ralph/`
- No symlinks — single source of truth in `.context/`
- Ralph state file (`.ralph/<name>.state.json`) is lightweight bookkeeping only

### File Location
```
.context/YYYY-MM-DD.subject/
├── plan-<topic>-phases.md        ← Phase overview + Ralph instructions (Buck-owned, Ralph-readable)
├── phase-1-<slug>.md             ← Discrete phase file (Buck-owned)
├── phase-2-<slug>.md             ← Discrete phase file (Buck-owned)
└── ...
```

Ralph invoked via:
```
/ralph start .context/YYYY-MM-DD.subject/plan-<topic>-phases.md
```

### Ralph Task Format (Dual-Hat File)
The plan-phase overview file wears two hats:
1. **Buck phase overview** — existing format with summary table, dependency matrix, phase links
2. **Ralph task file** — embedded goals + checklist section Ralph can track

Ralph-specific content is **additive, not structural**. Without Ralph, the file works as a normal plan-phase document.

### Per-Iteration Cadence
Each Ralph iteration processes **one phase's complete Buck workflow cycle**:
```
1. Read phase overview → find first non-completed phase
2. Read discrete phase file for implementation details
3. Execute b-build (or b-build-hard per phase's buck_hint)
4. Execute b-review
5. If review finds issues → b-iterate → b-review (loop until pass)
6. Execute b-save (write durable artifacts: memory, commit draft)
7. Mark phase as completed (status, checkboxes, summary table)
8. If more phases → ralph_done
9. If all phases → <promise>COMPLETE</promise>
```

### Idempotency
- **Phase files are the real checkpoint** — `status: pending → in-progress → completed`
- If Ralph stops mid-cycle, next iteration re-runs skills for the same phase
- Skills are already idempotent — they read current state and act accordingly
- **Ralph checklist tracks phase-level progress** (not skill-level) — simpler, fewer partial states
- Bigger granularity is safer for idempotency — partial skill states live in durable artifacts (iterate files, phase status, memory)

### Workflow Navigation in Plan-Phase File
Embed a dedicated section in the overview file:
```markdown
## Ralph Workflow Instructions

When executed as a Ralph loop, follow this cycle for each phase:

### Per-Phase Cycle
1. **Build**: Read the current phase file. Execute `/b-build` or `/b-build-hard` per the phase's `buck_hint`. If the work won't complete in this iteration, run **`b-save`** first (to write durable artifacts), then call `ralph_done`. Phase stays `in-progress`.
2. **Review**: Execute `/b-review` against the phase file as acceptance contract.
3. **Iterate (conditional)**: If b-review writes an `iterate-*.md` artifact, execute `/b-iterate` to fix issues, then re-run `/b-review`. Repeat until review passes. Run `b-save` before each `ralph_done` if mid-cycle.
4. **Save**: Run `/b-save` to write durable artifacts (session memory, draft commit).
5. **Advance**: Mark the phase `status: completed` in both the discrete phase file and this overview's summary table. Update the Ralph checklist below. Call `ralph_done`.

### Completion
When all phases show `completed` and all checklist items are checked, output `<promise>COMPLETE</promise>`.

## Ralph Execution Checklist

- [ ] Phase 1: <name> — b-build → b-review → b-save
- [ ] Phase 2: <name> — b-build → b-review → b-save
- [ ] Phase N: <name> — b-build → b-review → b-save
```

## Clarified Decisions

### Skill Ownership
- **`b-phase`** is the primary skill to modify — it generates Ralph-ready phase files
- **`b-plan`** may need a minor update — to recommend Ralph-enable when plans exceed thresholds and to note that non-phased plans can also be pointed at by Ralph (just with a simpler cycle)
- **`b-build`/`b-review`/`b-iterate`** may need minor Ralph-awareness updates (e.g., explicitly noting when running inside a Ralph loop and ensuring durable writes at each step), but the core behavior doesn't change

### Ralph Execution Model
- **`itemsPerIteration: 1`** — one phase per Ralph iteration (phase granularity, not skill granularity)
- Skills are invoked conceptually — Ralph instructions tell the agent *what to do*, referencing the skill files as the authority. The agent figures out invocation mechanics.
- **b-save is always available** — the Ralph cycle always includes a b-save step for durable artifact writing

### Ralph Instructions Placement
- **Always in the overview file** — this is Ralph's primary task file
- **Also in discrete phase files** — redundancy helps when Ralph re-reads the phase file for implementation details; the phase file contains its own mini-cycle instructions so Ralph doesn't need to cross-reference the overview for what to do next

### Ralph-Ready: Always On
- `b-phase` **always** emits Ralph-ready output — no flag needed
- Ralph is **always optional** — users who don't use Ralph just ignore the extra sections
- "Always be ready" — the output is usable with or without Ralph

### Non-Phased Plan Support
A Ralph loop can point at a flat `plan-*.md`. The Ralph section is minimal — no phase navigation, just one cycle: build → review → iterate → save. The same Ralph instructions template adapts gracefully: if no phases exist, treat the whole plan as one unit.

### Mid-Cycle Interruption Handling
If a phase's b-build (or any skill) is too large for one Ralph iteration:
1. **Detect upfront**: `b-phase` should rate phase complexity so Ralph knows if a phase might need multiple iterations
2. **Run `b-phase` before Ralph**: Best case — phases are sized for single iterations. If the plan wasn't phased, run b-phase first.
3. **If mid-cycle break needed**: Run **`b-save`** before `ralph_done`. This writes durable artifacts (memory, commit draft, partial state).
4. **Next iteration picks up**: Ralph re-reads the task file, sees phase is `in-progress`, finds the durable artifacts b-save wrote, and resumes from there.
5. **Phase stays `in-progress`** until b-review passes — that's the gate for completion.

## Informs

- [plan-ralph-loop-plan-phase.md](plan-ralph-loop-plan-phase.md)

## Constraints / Preferences

- Buck workflow skills should remain usable standalone — Ralph is opt-in
- No changes to the Ralph extension itself — only changes to Buck skill outputs and conventions
- Plan-phase files must remain valid plan-phase documents even without the Ralph section
- Idempotency is non-negotiable — interrupted loops must resume cleanly

## Brainstorm Notes

- Research confirmed Ralph extension uses `parseArgs` that detects `/` in the name arg and treats it as a file path instead of `.ralph/<name>.md`
- Ralph's `buildPrompt` re-reads the entire task file on every iteration — the file IS the prompt
- Existing b-phase already creates discrete phase files with `status` lifecycle — this maps cleanly to Ralph's checkpoint model
- b-build already has `Phased Plan Awareness` section — it reads phase files and updates status
- b-review already writes `iterate-*.md` artifacts — this creates the iterate loop naturally
