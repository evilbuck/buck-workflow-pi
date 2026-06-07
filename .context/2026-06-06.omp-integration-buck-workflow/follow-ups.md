---
status: active
date: 2026-06-06
subject: 2026-06-06.omp-integration-buck-workflow
topics: [follow-ups, next-steps, omp-integration, buck-workflow]
informs: []
---

# Follow-ups: omp × buck-workflow integration

These are the concrete next actions that should be taken **after** this research, ordered by effort / payoff.

## Quick wins (≤ 1 hour each, no behavior change to existing skills)

### F1. Add three cross-platform slash-command stubs

`buck-workflow-pi` already follows the `prompts/` ↔ `commands/` symlink mirror pattern. Adding three new command stubs is a one-line change per command:

```
prompts/omp-orchestrate.md   ->  commands/omp-orchestrate.md
prompts/omp-workflow.md      ->  commands/omp-workflow.md
prompts/omp-goal.md          ->  commands/omp-goal.md
```

Each prompt is a 5–10-line body that says "use the omp primitive; here's the contract" and points at the in-repo skill. This is **observation only** — it gives the user a discoverable way to invoke the keyword, but does not change how any `b-*` skill runs.

**Verification**: `omp -p "what does /omp-orchestrate do"` returns the expected text.

### F2. Document the three primitives in `docs/buck-workflow.md`

Add a section "OMP autonomous loops" that explains the three primitives and points at the relevant omp source files. Cross-references the in-repo skill `cross-platform-pi-omp-loading`.

### F3. Cross-reference from `AGENTS.md`

Add a one-liner to the project `AGENTS.md` "Architecture" section explaining the three primitives and that b-* skills do not currently opt into them, only recommend them.

## Medium-effort (≤ half a day, additive skill work)

### F4. New field on `b-phase` phase files: `omp_execution`

Extend the phase file frontmatter with one optional field:

```yaml
omp_execution: none | orchestrate | workflow | goal
```

Default: omitted (= `none`). When set to anything else, the phase file's "Ralph Mini-Cycle Instructions" section expands with a sentence telling the user to drop the keyword in the first turn of the phase. `b-plan` proposes the field, `b-phase` carries it through, `b-build` surfaces it at start-of-phase.

`goal` mode adds an optional `omp_goal_budget: <tokens>` field that b-plan sets based on the plan's complexity.

### F5. `b-plan` recommends the field

When the plan is phased and meets one of the criteria below, `b-plan` outputs a recommendation in the plan's "Ralph Instructions" section:

- ≥ 4 phases with ≥ 1 hard dependency between them → recommend `orchestrate`
- Phases contain "review" / "audit" / "sweep" / "migrate" → recommend `workflow`
- The plan User Goal is one sentence with no clear phase boundary → recommend `goal`

`b-plan` does **not** auto-set the field. It surfaces the recommendation and asks the user to confirm.

### F6. `b-plan` writes an `eval` cell template for `workflow` plans

When `omp_execution: workflow` is selected, `b-plan` writes a starter `.context/<subject>/eval-<topic>.py` (or `.js` — let the user pick) that fans one `agent()` per phase and returns a structured findings object. The cell is a **deliverable artifact** the user can edit before invoking the workflow keyword.

## Larger work (≥ 1 day, semantics change)

### F7. `b-review` adopts the goal-mode completion-audit protocol

The 6-step protocol from `goal-continuation.md` is currently re-invented poorly across `b-review`'s completion matrix. Tightening the matrix to mirror the protocol — every unchecked box requires direct current-state evidence, uncertainty is treated as not-achieved, no "looks right" — gives `b-review` the same hardening goal mode gives the runtime.

Optional: add a `goal_mode_aware: true | false` field to plan/phase files. When true, `b-review` runs the full audit; when false, it runs the current matrix.

### F8. `b-save` is goal-budget-aware

When a `/goal` session is active and `b-save` runs, persist the goal's `tokensUsed` and `timeUsedSeconds` into the memory file's frontmatter. Lets a resumed session pick up where it left off and surfaces "how much budget is left" in the memory index.

### F9. `b-grill*` feeds the workflow-kernel cell

When a plan follows a `b-grill*` session that produced `decision_domains`, auto-derive the `eval` cell's `agent()` fan-out (one agent per decision domain). This makes the `workflow` mode a first-class output of the grilling flow.

## What NOT to do

- **Do not auto-insert the magic keywords in b-build's first prompt.** omp explicitly guards `if (!options?.synthetic)` in `agent-session.ts:4274` — synthetic/agent-initiated turns never trigger the notices. The user must say the keyword, period.
- **Do not auto-`/goal set` for the user.** Goal mode is a user-toggled runtime state. The plan can recommend, not enable.
- **Do not write a new b-flow-style extension.** The b-flow deprecation is a recent lesson: extension-based orchestration that isn't observably invoked in normal sessions is dead weight. All five integration surfaces here are **prompt-level or skill-level changes** the user runs from the TUI — no Pi extensions, no new state machines.

## Open decisions for the user

These should be answered in the next session (b-plan or b-grill-me), not in this research:

1. Should the F1 slash-command stubs be added now, or after F4/F5 ship together? (F1 is independent and zero-risk; F4-F5 are bundled.)
2. Should the new `omp_execution` field be required, recommended, or omitted by default? (Recommend: omitted by default, surfaced as a recommendation in the plan's "Ralph Instructions" section.)
3. For the `eval` cell (F6), Python or JavaScript? omp supports both. Default to Python because the workflow-notice's examples are in Python; expose a JS variant if the user asks.
4. Is F7 (goal-aware `b-review`) in scope for the first integration pass, or is it a follow-up? (Recommend: follow-up — F4-F5-F6 are the core; F7 is a hardening pass.)

## Next step

Run `/b-plan` (or `/b-grill-me` first) on the F4 + F5 + F6 bundle, with the `b-explore` artifacts as research inputs. The plan should make explicit what the `omp_execution` field looks like, when `b-plan` recommends which value, and what the `eval` cell template contains. The plan does not need to ship the F1 stubs — those are independent and can be done in 10 minutes after the plan is approved.
