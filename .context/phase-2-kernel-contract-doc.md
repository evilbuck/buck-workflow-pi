---
status: pending
phase: 2
order: 2
plan: plan-cross-harness-kernel.md
phases_overview: plan-cross-harness-kernel-phases.md
difficulty: medium
model_hint: capable general model preferred; cross-references research and several files
buck_hint: /b-build
ralph_complexity: single
goal: "Capture the eval-kernel contract for downstream skills and the next agent: helpers, budget, schemas, failure modes, cross-platform notes."
omp_execution: none
files:
  - docs/eval-kernel.md
  - skills/b-plan/SKILL.md
  - .context/2026-06-06.omp-integration-buck-workflow/index.md
from_plan_steps: [1, 2, 3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] docs/eval-kernel.md exists with the 6 sections (What it is, Helpers, Budget, Schemas, Failure modes, Cross-platform)"
  - "[ ] Every helper in the prelude has a signature, return shape, and one example"
  - "[ ] Budget section cites src/goals/runtime.ts:87-99 and src/eval/py/prelude.py"
  - "[ ] b-plan eval template section cross-references the new doc with a one-liner"
  - "[ ] npx vitest run still 163/163 passing (no code changes — this phase is docs + 1 cross-ref)"
completed_at: null
completed_by: null
---

# Phase 2: Kernel contract doc

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

This phase hard-depends on Phase 1: the new `docs/eval-kernel.md` "Cross-platform"
section must point at the runtime probe that Phase 1 added to `b-plan`'s
eval cell template (the `try / except ImportError` block) and at the
header-guard in the three `omp-*.md` slash-command stubs. If Phase 1
drifted, Phase 2's cross-references drift with it.

The goal here is **durable knowledge**, not new code. `b-plan`'s
"Eval Cell Template" section already documents the cell shape; what is
missing is the surrounding contract (helpers, budget semantics, schemas,
failure modes) so the next agent does not have to re-derive it from omp
source. The F6 deliverable was a one-shot starter template; Phase 2 turns
it into a referenced contract.

## Implementation Details

From the parent plan, `Phase 2: Kernel contract doc`:

1. **Create `docs/eval-kernel.md`** with the following six sections:
   - **What it is** — the persistent Python (or JS) kernel exposed by omp's
     `eval` tool. State persists across cells, tool calls, and subagents.
   - **Helpers** — `agent()` / `parallel()` / `pipeline()` / `llm()` /
     `phase()` / `log()` / `budget()`. Each with signature, return shape,
     and one example.
   - **Budget** — `budget.remaining()` semantics, hard vs. soft ceiling,
     `+Nk!` / Goal Mode interaction. Cite `src/eval/py/prelude.py` and
     `src/goals/runtime.ts:87-99`.
   - **Schemas** — `schema=` parameter passes a JSON Schema to the
     subagent; output is a parsed object. State the
     `additionalProperties: false` rule.
   - **Failure modes** — `agent()` raises past a hard ceiling;
     `parallel()` propagates the first throw; `pipeline()` barrier
     semantics.
   - **Cross-platform** — link to
     `docs/buck-workflow.md#omp-autonomous-loops`; the eval cell is
     OMP-only; on other harnesses the cell is a no-op (Phase 1's
     runtime probe).

2. **Edit `skills/b-plan/SKILL.md`** — in the "Eval Cell Template" section,
   after the closing ` ``` `, add a `> **See also:** docs/eval-kernel.md
   for the full helper API, budget semantics, and failure modes.` line.

3. **Update `.context/2026-06-06.omp-integration-buck-workflow/index.md`** —
   add `docs/eval-kernel.md` to the `artifacts:` list and note Phase 2 status.

### Source citations to use

The doc must reference real omp source. Use these locations
(verified in `research-omp-integration.md`):

| Concern | Source path |
|---|---|
| Prelude helpers | `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/eval/py/prelude.py` |
| Goal runtime / budget | `src/goals/runtime.ts:87-99` |
| Eval tool wrapper | `src/eval/` (tool definition) |
| Workflow notice | `src/prompts/system/workflow-notice.md` |
| Orchestrator notice | `src/prompts/system/orchestrate-notice.md` |

When citing, use the **repo-relative** form (`src/...`) since the reader
may have a different omp install root. The full resolved path is
documented in `research-omp-integration.md` "Key files in omp (v15.10.0)".

### Helper signature format

For each helper, document:

```python
# Signature (one line)
agent(prompt: str, *, agent_type: str = "task", model: str | None = None,
      schema: dict | None = None, label: str | None = None) -> dict

# Returns
# Parsed dict matching `schema`; raises on parse error or hard budget ceiling.

# Example
result = agent("Review phase 1 acceptance criteria against the repo.",
               schema=FINDINGS_SCHEMA, label="phase-1-audit")
```

Keep examples short. Each one should fit in 5–10 lines of Python and
exercise one of the helper's parameters.

### Step-by-step

1. **Read `docs/buck-workflow.md`** around line 82 to confirm the
   "OMP Autonomous Loops" section anchor and the section-id style
   (`#omp-autonomous-loops`). The new doc cross-links there.
2. **Read `research-omp-integration.md`** to confirm the helper
   signatures and the budget semantics. The research is source-verified;
   use it as the source of truth, not as a guess.
3. **Write `docs/eval-kernel.md`** with the six sections above. Use the
   same frontmatter style as `docs/buck-workflow.md` (no frontmatter
   needed — `docs/` is flat). Cross-link `#omp-autonomous-loops` from the
   "Cross-platform" section.
4. **Edit `skills/b-plan/SKILL.md`** — find the eval cell template
   section (around line 207–342), locate the closing triple-backtick
   of the embedded Python block, and add the "See also" line after it.
5. **Edit `.context/2026-06-06.omp-integration-buck-workflow/index.md`** —
   add `docs/eval-kernel.md` to the `artifacts:` list (alphabetical or
   grouped — match the existing style).

### Verification steps (run yourself before yielding)

```bash
# 1. Tests still pass — Phase 2 doesn't change code, but a typo in
#    the b-plan cross-ref could break the Markdown structure.
npx vitest run

# 2. The new doc has all 6 section headers.
grep -E "^## (What it is|Helpers|Budget|Schemas|Failure modes|Cross-platform)$" \
  docs/eval-kernel.md | wc -l  # must be 6

# 3. Budget section cites the right source files.
grep -E "src/goals/runtime.ts:87-99|src/eval/py/prelude.py" \
  docs/eval-kernel.md

# 4. b-plan cross-ref is present.
grep -F "docs/eval-kernel.md" skills/b-plan/SKILL.md
```

## Risks

- **Doc content could drift from omp source.** Mitigation: cite specific
  source paths and line numbers; when omp updates (post v15.10.0),
  the doc's "last verified against" header should be updated.

- **Helper signatures could be wrong.** Mitigation: cross-check against
  `research-omp-integration.md` (which is source-verified) and against
  the eval cell template already in `b-plan` (which uses these helpers
  in real code).

- **`additionalProperties: false` rule could be misstated.** Mitigation:
  state the rule as "every schema dict in the eval kernel MUST set
  `additionalProperties: false`; the kernel rejects parsers that
  silently drop extras" — this matches the JSON-Schema strictness the
  F6 template already uses.

- **Phase 2 doesn't change code**, so the only "broken build" risk is
  in the `b-plan` cross-ref. A Markdown typo in `b-plan` doesn't fail
  tests but does fail the linter; run `npx vitest run` and
  `npx markdownlint docs/eval-kernel.md` to catch both.

## Verification

- `docs/eval-kernel.md` exists, has 6 sections, every helper documented.
- Budget section cites `src/goals/runtime.ts:87-99` and `src/eval/py/prelude.py`.
- `b-plan`'s "Eval Cell Template" section has a one-liner cross-ref to
  `docs/eval-kernel.md`.
- Subject `index.md` lists `docs/eval-kernel.md` in `artifacts:`.
- `npx vitest run` — 163/163 still pass.
- No code paths changed. Phase 2 is docs + 1 cross-ref.

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
