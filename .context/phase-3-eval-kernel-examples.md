---
status: pending
phase: 3
order: 3
plan: plan-cross-harness-kernel.md
phases_overview: plan-cross-harness-kernel-phases.md
difficulty: medium
model_hint: capable general model preferred; needs to author two non-trivial Python cells that pass ast.parse
buck_hint: /b-build
ralph_complexity: single
goal: "Prove the eval-kernel works end-to-end with two non-trivial patterns: review-audit (per-phase parallel agent() review) and migration-sweep (per-directory sweep with llm() judge)."
omp_execution: none
files:
  - .context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py
  - .context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py
  - skills/b-plan/SKILL.md
  - .context/2026-06-06.omp-integration-buck-workflow/index.md
from_plan_steps: [1, 2, 3, 4]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] eval-review-audit.py exists in the subject folder, parses with ast.parse, has __main__ guard"
  - "[ ] eval-migration-sweep.py exists in the subject folder, parses with ast.parse, has __main__ guard"
  - "[ ] PHASES lists in both cells reference real phase files (not placeholders)"
  - "[ ] Both schemas use additionalProperties: false"
  - "[ ] The llm() judge in migration-sweep uses a multi-criterion schema (compatibility_score, effort_estimate, blockers)"
  - "[ ] b-plan eval template section has a new \"Example cells\" subsection pointing at both files"
  - "[ ] npx vitest run still 163/163 passing"
completed_at: null
completed_by: null
---

# Phase 3: Real kernel usage examples

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

This phase hard-depends on Phase 2: the two example cells import helpers
whose signatures must be stable in the new `docs/eval-kernel.md` before
the cells can be written against them. The schema shape
(`additionalProperties: false`) is also first documented in Phase 2.

The goal here is to **demonstrate the kernel end-to-end** with two
non-trivial patterns. The F6 deliverable was a starter template with
placeholders. Phase 3 swaps the placeholders for real values pointing at
this subject's actual phase files, then adds a second cell that uses a
different shape (`parallel()` per directory, `llm()` judge) so the
documentation covers more than one pattern.

## Implementation Details

From the parent plan, `Phase 3: Real kernel usage examples`:

1. **Create `.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py`**
   — a review-audit example:
   - Replace `<subject-folder-name>` and `<slug-N>` placeholders with
     concrete values for this subject (`2026-06-06.omp-integration-buck-workflow`,
     `cross-harness-compat`, `kernel-contract-doc`, `eval-kernel-examples`,
     `b-grill-integration`).
   - Use a real `PHASES` list pointing at this subject's actual phase files.
   - Schema: per-phase `{verdict, evidence, risks, open_questions}` (already
     in the F6 template).
   - `build_prompt()` references the actual file paths in
     `.context/2026-06-06.omp-integration-buck-workflow/`.
   - Add a `__main__` guard so the cell can also be run as a plain Python
     script for syntax checking without the prelude.

2. **Create `.context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py`**
   — a migration-sweep example with a different shape:
   - Each phase produces a `blockers` list (forward-portable to a
     follow-up plan).
   - `parallel()` runs the sweep per directory.
   - `pipeline()` synthesizes a single "ready to migrate" verdict.
   - Demonstrates the `llm()` judge with a multi-criterion schema
     (`compatibility_score`, `effort_estimate`, `blockers`).

3. **Append an "Example cells" subsection to `skills/b-plan/SKILL.md`'s
   "Eval Cell Template" section** — pointers to both files with
   one-sentence descriptions of when to use each.

4. **Verify both cells parse**:
   `python3 -c "import ast; [ast.parse(open(p).read()) for p in ['eval-review-audit.py', 'eval-migration-sweep.py']]"`.

### Shape of the review-audit cell

The F6 template already has the right structure; Phase 3 fills in the
values:

```python
# .context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py
"""
Cross-harness kernel phasing — workflow-mode review-audit.

Edit this cell before invoking the `workflow` keyword in omp. The kernel
imports the helpers below; the cell runs as the workflow's first turn.

Hard contract:
  - This is a deliverable artifact, not throwaway scratch.
  - One `agent()` call per phase, returning a structured findings object
    with the `schema=` parameter.
  - A barrier stage verifies the findings; a synthesis stage adjudicates.
"""

from __future__ import annotations

# eval-kernel prelude helpers (always in scope inside the omp eval tool).
from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401

SUBJECT = "2026-06-06.omp-integration-buck-workflow"
PHASES = [
    (1, "cross-harness-compat",    "easy",   "Make new OMP surfaces no-op on non-OMP harnesses"),
    (2, "kernel-contract-doc",     "medium", "Document the eval-kernel contract for downstream skills"),
    (3, "eval-kernel-examples",    "medium", "Two real example cells proving the kernel end-to-end"),
    (4, "b-grill-integration",     "hard",   "b-grill-me/with-docs auto-derive PHASES from decision_domains"),
]

# Findings schema — every agent() returns a dict matching this shape.
FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "phase": {"type": "integer"},
        "slug":  {"type": "string"},
        "verdict": {"type": "string", "enum": ["pass", "warn", "fail", "blocked"]},
        "evidence": {"type": "array", "items": {"type": "string"}},
        "risks":    {"type": "array", "items": {"type": "string"}},
        "open_questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["phase", "slug", "verdict", "evidence", "risks", "open_questions"],
    "additionalProperties": False,
}


def build_prompt(phase_num: int, slug: str, difficulty: str, brief: str) -> str:
    """Compose the per-phase subagent prompt. Edit freely."""
    return (
        f"You are reviewing Phase {phase_num} ({slug}, difficulty={difficulty}) "
        f"of the {SUBJECT!r} plan.\n\n"
        f"Brief: {brief}\n\n"
        f"Read the active phase file at `.context/{SUBJECT}/phase-{phase_num}-{slug}.md`. "
        f"Verify each acceptance criterion against the actual current repo state — "
        f"do not trust checkboxes or commit messages. Return structured findings "
        f"matching the schema: verdict, evidence (cite file:line or test name), "
        f"risks, open_questions. If you cannot run a check, mark it as a risk, "
        f"not a pass."
    )


# Stage 1 — fan out one `agent()` per phase in parallel.
phase("workflow: fan out per-phase review")
findings_per_phase = parallel(
    [lambda n=num, s=slug, d=diff, b=brief: agent(
        build_prompt(n, s, d, b),
        agent_type="task",
        model=None,
        schema=FINDINGS_SCHEMA,
        label=f"phase-{n}-{s}",
    ) for (num, slug, diff, brief) in PHASES]
)

# Stage 2 — barrier: all phases reviewed before synthesis.
phase("workflow: synthesize")
overall = pipeline(
    findings_per_phase,
    lambda findings: [
        log(f"phase {f['phase']} ({f['slug']}): {f['verdict']} — "
            f"{len(f['evidence'])} evidence, {len(f['risks'])} risks")
        for f in findings
    ] or findings,
    lambda findings: llm(
        "Synthesize these per-phase findings into a single go/no-go verdict "
        "for the plan. Cite the per-phase evidence. Do not paraphrase "
        "the findings — adjudicate.",
        model="default",
        schema={
            "type": "object",
            "properties": {
                "verdict": {"type": "string", "enum": ["go", "iterate", "block"]},
                "rationale": {"type": "string"},
                "blocking_phases": {"type": "array", "items": {"type": "integer"}},
            },
            "required": ["verdict", "rationale", "blocking_phases"],
            "additionalProperties": False,
        },
    ),
)

# Stage 3 — surface the final verdict to the user.
log(f"workflow verdict: {overall.get('verdict', 'unknown')}")
log(f"rationale: {overall.get('rationale', '')}")
if overall.get("blocking_phases"):
    log(f"blocking phases: {overall['blocking_phases']}")

# Hard stop if a hard ceiling is set and the cell is about to exceed it.
if budget.remaining() is not None and budget.remaining() < 5_000:
    log(f"workflow eval cell: budget remaining {budget.remaining()}; "
        f"halting fan-out and surfacing partial results.")


# Allow `python3 eval-review-audit.py` for syntax checking without the prelude.
if __name__ == "__main__":
    # The cell relies on the omp eval prelude; outside the kernel, just
    # confirm the module is syntactically valid and the schema is a dict.
    assert isinstance(FINDINGS_SCHEMA, dict)
    assert FINDINGS_SCHEMA.get("additionalProperties") is False
    assert all(isinstance(p, tuple) and len(p) == 4 for p in PHASES)
    print("eval-review-audit.py: syntax + schema OK")
```

### Shape of the migration-sweep cell

The migration-sweep demonstrates a different pattern: `parallel()` per
directory (not per phase), and a `llm()` judge with a multi-criterion
schema. This is the "review/audit/sweep/migrate" pattern from the
F5 recommendation rules in `b-plan`.

```python
# .context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py
"""
Cross-harness kernel phasing — workflow-mode migration-sweep.

Edit this cell before invoking the `workflow` keyword in omp. The cell
demonstrates the per-directory `parallel()` + multi-criterion `llm()`
judge pattern (vs the per-phase `parallel()` in eval-review-audit.py).

Use when the work is a migration-sweep: enumerate directories, fan out
per-directory review, then a judge adjudicates readiness with a
multi-criterion schema.
"""

from __future__ import annotations

from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401

# Migration target — directories to sweep.
TARGETS = [
    "skills/cross-platform-pi-omp-loading",
    "prompts",
    "commands",
    "docs",
]

# Per-target findings schema.
TARGET_SCHEMA = {
    "type": "object",
    "properties": {
        "target": {"type": "string"},
        "blockers": {"type": "array", "items": {"type": "string"}},
        "compatibility_notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["target", "blockers", "compatibility_notes"],
    "additionalProperties": False,
}

# Judge schema — multi-criterion (the F5 sweep pattern).
JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "ready_to_migrate": {"type": "boolean"},
        "compatibility_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
        },
        "effort_estimate": {
            "type": "string",
            "enum": ["trivial", "small", "medium", "large", "epic"],
        },
        "blockers": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["ready_to_migrate", "compatibility_score",
                 "effort_estimate", "blockers"],
    "additionalProperties": False,
}


def build_prompt(target: str) -> str:
    return (
        f"Sweep the directory `{target}` for cross-harness compatibility "
        f"issues. Look for:\n"
        f"  - Slash-command stubs that lack a harness-note blockquote\n"
        f"  - Hard-coded OMP runtime assumptions in skills\n"
        f"  - Symlink drift between `prompts/` and `commands/`\n\n"
        f"Return structured findings matching the schema: target, blockers, "
        f"compatibility_notes. Cite file:line for each blocker."
    )


# Stage 1 — fan out one `agent()` per target directory.
phase("workflow: sweep per-directory")
findings_per_target = parallel(
    [lambda t=target: agent(
        build_prompt(t),
        agent_type="task",
        model=None,
        schema=TARGET_SCHEMA,
        label=f"sweep-{t}",
    ) for target in TARGETS]
)

# Stage 2 — synthesize a single "ready to migrate" verdict with
# multi-criterion judge.
phase("workflow: judge")
verdict = pipeline(
    findings_per_target,
    lambda findings: [
        log(f"target {f['target']}: {len(f['blockers'])} blockers, "
            f"{len(f['compatibility_notes'])} notes")
        for f in findings
    ] or findings,
    lambda findings: llm(
        "Synthesize these per-target findings into a single ready-to-migrate "
        "verdict. Score compatibility on [0, 1]. Estimate effort on the "
        "trivial..epic scale. Forward-port the blockers list verbatim — "
        "do not paraphrase.",
        model="default",
        schema=JUDGE_SCHEMA,
    ),
)

log(f"ready_to_migrate: {verdict.get('ready_to_migrate')}")
log(f"compatibility_score: {verdict.get('compatibility_score')}")
log(f"effort_estimate: {verdict.get('effort_estimate')}")
if verdict.get("blockers"):
    log(f"blockers: {verdict['blockers']}")

if budget.remaining() is not None and budget.remaining() < 5_000:
    log(f"workflow eval cell: budget remaining {budget.remaining()}; halting.")


if __name__ == "__main__":
    assert isinstance(TARGET_SCHEMA, dict)
    assert TARGET_SCHEMA.get("additionalProperties") is False
    assert isinstance(JUDGE_SCHEMA, dict)
    assert JUDGE_SCHEMA.get("additionalProperties") is False
    assert all(isinstance(t, str) for t in TARGETS)
    print("eval-migration-sweep.py: syntax + schemas OK")
```

### Step-by-step

1. **Read `b-plan` "Eval Cell Template"** (lines 207–342) to confirm the
   F6 template is the source of truth for the review-audit cell.
2. **Write `eval-review-audit.py`** — copy the F6 template, replace
   placeholders with this subject's values, add the `__main__` guard.
3. **Write `eval-migration-sweep.py`** — author from scratch using the
   shape above. Different pattern: per-directory `parallel()`,
   multi-criterion `llm()` judge.
4. **Verify both cells parse**:
   `python3 -c "import ast; [ast.parse(open(p).read()) for p in ['eval-review-audit.py', 'eval-migration-sweep.py']]"`.
5. **Append "Example cells" subsection to `b-plan`** — under the existing
   "Eval Cell Template" section, after the closing ` ``` ` and the
   "See also" line from Phase 2.

### Verification steps (run yourself before yielding)

```bash
# 1. Tests still pass
npx vitest run

# 2. Both cells parse
python3 -c "import ast; [ast.parse(open(p).read()) for p in \
  ['.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py', \
   '.context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py']]"

# 3. PHASES references real phase files
grep -E "cross-harness-compat|kernel-contract-doc|eval-kernel-examples|b-grill-integration" \
  .context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py

# 4. Schemas have additionalProperties: false
grep -c "additionalProperties.*False" \
  .context/2026-06-06.omp-integration-buck-workflow/eval-*.py

# 5. b-plan has the new "Example cells" subsection
grep -F "## Example cells" skills/b-plan/SKILL.md
```

## Risks

- **Placeholder leakage** — the F6 template's `<subject-folder-name>` and
  `<slug-N>` could survive the cell if a sed-style find-replace misses
  a spot. Mitigation: read both cells end-to-end after writing them and
  grep for `<` followed by a non-tag character.

- **The `__main__` guard could mask a real bug** (e.g., schema-typo
  the prelude would catch). Mitigation: the guard only checks
  `isinstance(...)` and `additionalProperties: false` — it does NOT
  call any helpers. The guard is a syntax + structural check, not a
  semantic check.

- **The migration-sweep cell's `JUDGE_SCHEMA` could be too narrow** — the
  four fields (`ready_to_migrate`, `compatibility_score`,
  `effort_estimate`, `blockers`) are the F5 minimum, but a real sweep
  might want `affected_files` too. Mitigation: keep the four required
  fields and add `affected_files` as a non-required field with a
  sensible schema if the user requests it.

- **The "1–2 example cells" question is open** — the plan defaults to
  two. If the user only wants one, Phase 3 is shorter. The acceptance
  criteria here assume two; if you only build one, drop the
  migration-sweep cell and update the criteria.

## Verification

- `eval-review-audit.py` exists, parses, has `__main__` guard, real
  `PHASES` list, `additionalProperties: false` schema.
- `eval-migration-sweep.py` exists, parses, has `__main__` guard,
  multi-criterion `JUDGE_SCHEMA`, `additionalProperties: false` schema.
- `b-plan`'s "Eval Cell Template" section has a new "Example cells"
  subsection pointing at both files.
- `npx vitest run` — 163/163 still pass.

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

**Optional `workflow` override.** If a `b-review` audit requires the
example cells to be exercised end-to-end (not just parsed), the
executor may declare `omp_execution: workflow` on a sub-iteration of
this phase, run the cell, and then revert to `none`. The phase file
defaults to `none` so the Ralph cycle stays plan-level `orchestrate`.
