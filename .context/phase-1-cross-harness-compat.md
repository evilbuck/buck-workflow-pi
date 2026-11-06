---
status: pending
phase: 1
order: 1
plan: plan-cross-harness-kernel.md
phases_overview: plan-cross-harness-kernel-phases.md
difficulty: easy
model_hint: smaller / faster general model is fine; work is mechanical and bounded
buck_hint: /b-build
ralph_complexity: single
goal: "Make the new OMP surfaces (3 slash-command stubs + 2 b-plan sections) no-op cleanly on every harness, not just OMP."
omp_execution: none
files:
  - prompts/omp-orchestrate.md
  - prompts/omp-workflow.md
  - prompts/omp-goal.md
  - skills/b-plan/SKILL.md
  - docs/buck-workflow.md
from_plan_steps: [1, 2, 3, 4, 5, 6]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] prompts/omp-{orchestrate,workflow,goal}.md each have a harness-note blockquote in the first 5 lines"
  - "[ ] b-plan \"OMP Execution Recommendation\" table has a harness guard as row 1"
  - "[ ] b-plan eval cell template prelude is wrapped in try / except ImportError and the cell still parses"
  - "[ ] docs/buck-workflow.md \"OMP Autonomous Loops\" mentions the guard/probe in the \"does NOT\" list"
  - "[ ] npx vitest run still 163/163 passing"
  - "[ ] diff <(ls prompts/) <(ls commands/) still empty (no drift)"
  - "[ ] python3 -c 'import ast; ast.parse(open(\"<eval template>\").read())' succeeds"
completed_at: null
completed_by: null
---

# Phase 1: Cross-harness compat

## User Goal

Inherited from the parent plan. *Skip duplication* — see `## Context`
below for the restated goal.

## Context

**Parent plan user goal** (inherited): "Maintainer of `buck-workflow-pi`
(and downstream packages following the same pattern) who installs on
**any** of the five supported harnesses (Pi, OMP, Claude Code, OpenCode,
Codex). The work makes the omp-integration surfaces safely no-op on
non-OMP harnesses instead of producing misleading slash commands, and it
elevates the eval-kernel work from a one-shot starter template into a
phased workstream with concrete deliverables."

This phase is the **foundation** of the plan. The F1–F7 build added
three OMP-aware slash-command stubs (`/omp-orchestrate`, `/omp-workflow`,
`/omp-goal`) plus OMP-Execution-Recommendation and Eval-Cell-Template
sections in `b-plan`. On non-OMP harnesses (Pi, Claude Code, OpenCode,
Codex) these surfaces currently look authoritative even though the
underlying primitives (`orchestrate` keyword, `workflow` keyword, the
`/goal` slash command namespace) are OMP-specific. This phase adds
small, targeted guard text so each surface is unambiguous on every
harness.

The work is six small edits, all of them textual. No new code paths,
no new state, no schema changes.

## Implementation Details

From the parent plan, `Phase 1: Cross-harness compat`:

1. **Edit `prompts/omp-orchestrate.md`** — prepend a header guard:

   ```markdown
   > **Harness note:** This command documents the omp `orchestrate` keyword contract.
   > On non-OMP harnesses (Pi, Claude Code, OpenCode, Codex) it is a no-op — the keyword
   > does not exist and the orchestrator contract does not apply. Skip this command on
   > non-OMP sessions; use `/b-plan` + `/skill:b-phase` for normal phased execution.
   ```

2. **Edit `prompts/omp-workflow.md`** — same shape, `workflow`-flavored.

3. **Edit `prompts/omp-goal.md`** — same shape, `/goal`-flavored. Note that `/goal` is
   **also** an omp slash command at `src/slash-commands/builtin-registry.ts:97`; on
   Claude Code the `/goal` slash command is a different namespace entirely.

4. **Edit `skills/b-plan/SKILL.md` "OMP Execution Recommendation" table** — add a
   top-row guard:

   ```markdown
   | If the active harness is not OMP, return `none` (omit) immediately. The remaining rules assume OMP. | `none` (omit) | Prevents recommending a primitive the harness cannot invoke. Detect from session state (omp has an `omp` tool / `omp.runtime` field; Pi has `pi.runtime`; Claude Code has none) or from the package's `package.json` `omp` field presence. |
   ```

5. **Edit `skills/b-plan/SKILL.md` "Eval Cell Template" prelude** — replace the bare
   `from prelude import ...` with a guarded import:

   ```python
   try:
       from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401
   except ImportError:
       # The eval cell is OMP-specific. On non-OMP runtimes, the helpers do not
       # exist; surface a clear no-op so the user knows the cell is not portable.
       def _no_op(*_args, **_kwargs):
           print("eval cell: omp runtime required (prelude helpers missing); skipped.")
           return None
       agent = parallel = pipeline = llm = phase = log = budget = _no_op  # type: ignore
   ```

6. **Edit `docs/buck-workflow.md`** — in the "OMP Autonomous Loops" section, add one
   sentence under "What the workflow does NOT do" pointing at the header guard and
   runtime probe as the cross-harness safety net.

### Step-by-step

1. Read the current state of the five files to confirm the line numbers and exact
   text to anchor edits on. Use the `read` tool with the relevant ranges. Do not
   re-read the whole file if a range is enough.
2. Apply edits 1–3 (the three `omp-*.md` stubs). Use `edit` with a `replace N..N:`
   hunk to insert the blockquote at the top of each file (after the frontmatter
   if present, or at the very start of the body). The blockquote must be in the
   first 5 lines of body content. The first `accept header guard as first 5 lines
   body` is the only constraint; order below that doesn't matter.
3. Apply edit 4 (the OMP Execution Recommendation table). The current table is in
   `skills/b-plan/SKILL.md` around line 162–178. Insert the new row as the first
   table row.
4. Apply edit 5 (the eval cell template prelude). The current prelude is at
   `skills/b-plan/SKILL.md:244` (`from prelude import ...`). Replace it with the
   `try / except ImportError` block. The rest of the template body
   (lines 246–335) stays unchanged.
5. Apply edit 6 (the docs one-liner). The current "What the workflow does NOT do"
   section is at `docs/buck-workflow.md:131-142`. Append a fourth bullet pointing
   at the header guard and runtime probe as the cross-harness safety net.

### Verification steps (run yourself before yielding)

```bash
# 1. Tests still pass
npx vitest run

# 2. Slash-command mirror is in sync
diff <(ls prompts/) <(ls commands/)

# 3. Eval template still parses (read the prelude from b-plan and check)
python3 -c "import ast; ast.parse(open('skills/b-plan/SKILL.md').read().split('\`\`\`python')[1].split('\`\`\`')[0])"

# 4. Each omp-*.md opens with a visible harness note
for f in prompts/omp-{orchestrate,workflow,goal}.md; do
  head -5 "$f" | grep -q "Harness note" || echo "MISSING: $f"
done
```

The `npx vitest run` is the gate — if it drops below 163/163, do not yield.

## Risks

- **Header guard wording could read as "the command is broken" on first glance.**
  Mitigation: use the word "no-op," not "unsupported" or "deprecated." The slash
  command still appears in the palette; the body explains the no-op nature.
  Acceptance criterion 1 is the wording gate.

- **Top-row guard could over-trigger on edge cases** (e.g., a session that started
  in OMP and was later swapped to a different harness). Mitigation: detect from
  runtime signal, not from a one-time check at skill load. The acceptance
  criterion for edit 4 includes the runtime detection rule.

- **Runtime probe in the eval template could mask legitimate import errors**
  (a typo in `prelude` would now be caught and turned into a no-op). Mitigation:
  the probe is specific to `ImportError`; other exceptions still propagate. The
  cell is a starter; the user is expected to read the prelude imports before
  editing.

- **The 3 compat fixes do not address the OpenCode `command/` vs `commands/`
  asymmetry** — pre-existing, not introduced by this plan.

## Verification

- `npx vitest run` — 163/163 still pass.
- `diff <(ls prompts/) <(ls commands/)` — empty.
- `python3 -c "import ast; ast.parse(open('skills/b-plan/SKILL.md').read().split('\`\`\`python')[1].split('\`\`\`')[0])"` — succeeds.
- Each `prompts/omp-*.md` opens with a visible harness-note blockquote.
- The first row of the OMP Execution Recommendation table in `b-plan` is the
  harness guard.
- The eval cell template prelude in `b-plan` is wrapped in `try / except ImportError`.
- The "What the workflow does NOT do" list in `docs/buck-workflow.md` mentions
  the guard/probe.

## Ralph Mini-Cycle Instructions

If executing this phase inside a Ralph loop:

1. Run the indicated Buck build command (`buck_hint: /b-build`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/git-commit` to checkpoint durable state before `ralph_done`.
6. If the phase is incomplete, leave `status: in-progress` so the next Ralph iteration resumes here.

If the phase's frontmatter declares `omp_execution: orchestrate | workflow | goal`,
expand step 1 above with a one-liner **before** the build command runs:

| `omp_execution` | First-turn precondition |
|---|---|
| `orchestrate` | "Type the `orchestrate` keyword anywhere in your first turn of this phase. omp will inject the orchestrator contract (parallel `task` subagents, no-yield between phases, verify-after-every-phase)." |
| `workflow` | "Open `.context/<subject>/eval-<topic>.py`, run the cell, then type the `workflow` keyword in your first turn. The eval kernel fans out one `agent()` per phase." |
| `goal` | "Run `/goal set <plan User Goal> --budget <omp_goal_budget>`, then begin the build. The active goal persists across turns and triggers the 6-step completion-audit on `goal({op:'complete'}).`" |

For this phase, `omp_execution: none` — no first-turn precondition.
The plan-level `orchestrate` recommendation (set on the first turn of the
*plan*) already covers the orchestrator contract for the full run.
