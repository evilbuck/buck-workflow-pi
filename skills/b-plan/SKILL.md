---
name: b-plan
description: Turn user-provided context, session context, and optional artifacts into a bounded implementation plan with scope, risks, and verification. Use when the user wants a formal, structured plan.
---

# b-plan: Planning Agent

Turn the user's request into a bounded implementation plan using:

- explicit context provided in the request,
- existing context already established in the session,
- optional brainstorm/research/spec artifacts,
- and relevant code you inspect.

**Do not require an existing `research-*.md` file to proceed.**

## Write Boundary

- You may write to `.context/**` and temporary scratch locations using native file tools (write/edit).
- Save plans where the user can reuse them outside the context window.
- Do not modify source files outside `.context/`.
- **Allowed**: Native `write` and `edit` tools for `.context/**` files.
- **Allowed**: Bash commands for `.context/**` directory operations (mkdir, find, cat, ls).
- **Blocked**: Bash redirects (`>`) and file modifications outside `.context/**`.

## Subject Folder Creation (Required)

**Every b-plan session creates a subject folder.** This is not opt-in.

1. **Infer subject name** from the conversation topic (kebab-case)
2. **Create dated folder**: `.context/YYYY-MM-DD.<subject-name>/`
3. **Create `index.md`** with `status: active` (plan now exists, work is underway)
4. **Write plan file inside**: `plan-<topic>.md`

**Example:**
```
.context/
└── 2026-04-08.auth-feature/
    ├── index.md    ← status: active
    └── plan-oauth-login.md
```

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for all downstream artifact discovery.
If the protocol finds no subject, proceed as a fresh session.

After subject resolution, gather planning context from these additional sources:

1. **Explicit user context** — the current request, pasted notes, links, constraints, examples, desired outcomes, and any files the user points at
2. **Session context** — prior messages, prior decisions, referenced files, and already-established assumptions in this chat
3. **Relevant subject-folder artifacts** — check the chosen subject folder for:
   - `index.md` — **read this first** if it exists; it links all other artifacts in the subject
   - `brainstorm-*.md` or `plan-draft-*.md`
   - `research-*.md` (from either `b-explore` or `b-research`)
   - `spec-*.md`
   - existing `plan-*.md` when refining or replacing a plan
4. **Relevant code** — read the code/config/tests needed to make the plan concrete

Use these sources together. Artifacts are helpful inputs, not prerequisites.

## Clarification Interview Protocol

If the work definition is ambiguous, underspecified, or hiding important tradeoffs:

1. Ask targeted follow-up questions before finalizing the plan.
2. Prefer one question at a time; if needed, ask a short batch of tightly related questions.
3. Focus on missing information that changes the plan: user goal (who benefits, what changes for them), goals, constraints, non-goals, success criteria, rollout, verification, dependencies, or risk tolerance.
4. **User goal gate**: if the plan has no `## User Goal` and the user has not waived with an explicit "technical chore", ask for one before finalizing. See the [User Goal Requirement](#user-goal-requirement) for details.
5. If the user wants to move forward without answering everything, proceed with explicit assumptions and list open questions in the plan.

## Light Grill (Plan Evaluation)

When the plan draft has material ambiguities — hidden assumptions, fuzzy scope edges, missing acceptance criteria, or unclear verification paths — run a short structured pass over the plan itself before finalizing. This is the **plan-targeted** counterpart to the upstream [Clarification Interview Protocol](#clarification-interview-protocol): the Clarification Protocol targets ambiguity in the *user's ask*; the Light Grill targets ambiguity in the *plan* you just drafted.

**Use your judgment.** Straightforward, well-bounded plans do not need this. The protocol exists for plans where a 3–10 question pass would meaningfully change the deliverable. Skip without ceremony when the plan is already tight.

### When to invoke

The Light Grill is worth running when the draft has any of:

- **Hidden assumptions** — claims stated as fact that the user knows are conditional
- **Scope edges** — the in/out boundary is fuzzy enough that different answers would produce different plans
- **Acceptance criteria gaps** — "done" is undefined or unmeasurable
- **Risk / rollback holes** — failure modes that would change the plan if surfaced
- **Verification gaps** — no concrete way to prove the plan worked end-to-end

If none of these apply, skip the Light Grill and write the plan straight to the subject folder. The absence of a `## Light Grill` section in the plan is the signal that the plan was bounded enough to skip.

### How to run it

1. After the plan draft is complete, identify the **3–10 most material ambiguities** — skip the rest. The goal is resolution, not exhaustive coverage. (Contrast with `b-grill-me`, which interviews relentlessly up to a 20-question threshold.)
2. Ask **one question at a time**, with a recommended answer. The user may accept, modify, defer, or skip.
3. After each answer, **update the plan draft** and re-evaluate whether the next-most-material ambiguity is now obvious (an early answer can dissolve a later question or surface a new one).
4. Stop at 10 questions or when the user says stop. The [User Goal gate](#user-goal-requirement) is the only hard floor — the Light Grill never blocks on its own.
5. If a question reveals a new artifact is needed (research, spec, brainstorm), record the gap and recommend the right skill in the "Recommended next step" output. Do not auto-spawn a new skill.

### When to skip

The Light Grill is **discretionary, not mandatory**. Common skip cases:

- **Plan is bounded and unambiguous** — the implementation steps follow directly from the user's request, with no fuzzy edges. This is the default for mechanical / well-specified work.
- **Upstream `b-grill-me` ran** — a `grill-session-*.md` exists in the subject folder with non-empty `decision_domains` and the domains already cover the plan's material ambiguities. Reference the session file in the plan's "Context used / assumptions" section.
- **Technical chore** — the work is mechanically specified and carries an explicit `Technical chore — <reason>` waiver.

### Output

When the Light Grill runs, add a `## Light Grill` section to the plan body with this shape:

```markdown
## Light Grill

- Q1: <question text> → resolved: <answer> (recommended: <rec>)
- Q2: <question text> → deferred: <reason>
- Q3: <question text> → resolved: <answer>
- ...
```

The Q&A lives in the plan itself — no separate session file. The distinction from `b-grill-me` is intentional: `b-grill-me` writes a separate `grill-session-*.md` because it is a multi-session, threshold-tracking artifact; the Light Grill is a one-shot planning step whose audit trail belongs inside the plan. If a more exhaustive interview is later needed, run `b-grill-me` separately and stitch its session file to the plan via the "Context used / assumptions" section.

## Cross-Reference Stitching

When creating a plan:

1. Check for related artifacts in the chosen subject folder.
2. **Research is optional**:
   - If relevant `research-*.md` files exist and informed the plan, populate the plan's `research:` field with those filenames
   - Back-fill each research file's `informs:` field to include this plan
3. **Brainstorm is optional**:
   - If a `brainstorm-*.md` or draft file exists, use it as planning input
   - Capture its useful conclusions in the plan body under `Context used / assumptions`
4. **Iterations (from b-review findings):**
   - If relevant `iterate-*.md` files exist in the subject folder, populate the plan's `iterations:` field with those filenames
   - Back-fill each iteration file's `informs:` field to include this plan
5. **If implementing a spec:**
   - Populate the plan's `spec:` field with the spec filename
   - The spec's `plans:` array will be updated by b-save after execution
6. **If no artifacts exist**, continue using the user's provided context, session context, and code reading. Do not block or require `/b-research` first.

## Behavior

- Read the relevant code before deciding.
- Combine user-provided context, session context, and any relevant artifacts.
### User Goal Requirement

Every plan MUST include a `## User Goal` section immediately after the title. The user goal is the user-facing north star — *who* benefits from this work and *what* changes for them.

Behavior:
- If the user provided a user goal, record it verbatim under `## User Goal`.
- If the upstream brainstorm (`b-brainstorm`) defined one, carry it forward.
- If neither, **synthesize** a draft from the user's loose requirements and ask them to confirm or refine before finalizing.
- The user may waive with an explicit "technical chore" — record `Technical chore — <reason>` so the waiver is visible to downstream skills (`b-build`, `b-review`, `b-phase`, `b-save`).
- This section is **REQUIRED**. Plans without it are incomplete. Do not finalize a plan that lacks `## User Goal` (or an explicit waiver) — if the user resists, surface it as a gap, not a silent omission.

Downstream skills read the user goal as the user-facing intent. A missing user goal is a visible gap in the plan, not a stylistic preference.

- Interview the user when clarification is needed to make the plan bounded and actionable.
- **Light Grill the draft when it has material ambiguities** (hidden assumptions, fuzzy scope, missing acceptance criteria, verification gaps). 3–10 questions, one at a time, with a recommended answer — see [Light Grill (Plan Evaluation)](#light-grill-plan-evaluation). Skip without ceremony for well-bounded plans.
- Define scope, out-of-scope, affected files, assumptions, risks, and verification.
- Write tactical implementation plans as `plan-*.md` in the subject folder.
- Write strategic specs as `spec-*.md` in the subject folder (for multi-session epics/PRDs).
- If a spec already exists in the subject folder, reference it in the plan.
- Create backlog items only for **clear near-term actionable units** of work that emerge from the plan. One backlog item = one pickup-able unit of work. Do not auto-expand specs/plans into a large queue.
- When creating backlog items: create the backing item file `.context/backlog/items/<slug>.md` with frontmatter (`title`, `status: active`, `priority`, `created`, `updated`, `completed: null`, `related`) and add a linked checkbox to `.context/backlog/todo.md`. If only `.context/backlog.md` exists (legacy), use that format instead.
- Recommend `b-build` for straightforward work and `b-build-hard` for ambiguous or high-risk work.
- Recommend `b-explore` when missing code or architecture understanding prevents a good plan.
- Recommend `b-research` when missing external information (APIs, libraries, documentation) prevents a good plan.
- **Recommend `b-phase`** if the plan exceeds any of these thresholds:
  - More than ~8 implementation steps
  - Touches more than ~5 distinct files or directories
  - Spans multiple architectural layers (DB + API + UI)
  - Involves high-risk paths (auth, billing, data migrations)
  - Contains significant unknowns or research spikes
  - Verification alone would exhaust a single session
  - Phrasing: *"This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential Ralph-ready phases with dependency analysis, per-phase model hints, and resume-safe execution instructions."*
- If the user wants Ralph automation but the plan does **not** need phasing, keep the plan non-phased and add a minimal **Ralph Instructions** section for the single-unit cycle: `/b-build` → `/b-review` → `/b-iterate` if needed → `/b-docs` if doc impact → `/b-save` → `/b-commit` → `ralph_done`.

## Plan Frontmatter Template

```yaml
---
status: active
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
topics: [keyword, list]
research: [research-file.md]  # Research that informed this plan (if any)
iterations: [iterate-*.md]     # Iteration artifacts from b-review (if any)
spec: spec-file.md            # Spec this plan implements (if any)
memory: []                    # Filled by b-save after execution
---
```

## Non-Phased Ralph Plans

Not every Ralph-run task needs `b-phase`. If the plan is small enough for one build/review cycle but the user wants Ralph to drive it, add a short **Ralph Instructions** section to the plan itself. Treat the whole plan as one unit and use the same durable mini-cycle documented in `b-phase`'s Ralph Instructions Template.

Recommended wording:

```markdown
## Ralph Instructions

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` (or `/b-build-hard` if ambiguity appears) against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state before `ralph_done`.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next iteration.
```

## OMP Execution Recommendation

`b-plan` does **not** auto-set the `omp_execution` field. It surfaces a
recommendation in the plan's "Ralph Instructions" section based on the
plan's shape, then asks the user to confirm. See
`docs/buck-workflow.md#omp-autonomous-loops` for the full contract.

Apply these rules in order. The first rule that matches wins. If multiple
match, pick the strongest one (goal > workflow > orchestrate > none).

| Trigger | Recommend | Rationale |
|---|---|---|
| If the active harness is not OMP, return `none` (omit) immediately. The remaining rules assume OMP. | `none` (omit) | Prevents recommending a primitive the harness cannot invoke. Detect from session state (omp has an `omp` tool / `omp.runtime` field; Pi has `pi.runtime`; Claude Code has none) or from the package's `package.json` `omp` field presence. |
| Plan is phased and ≥ 4 phases with at least one HARD dependency between them | `orchestrate` | The orchestrator contract ("do not yield between phases", "parallelize maximally", "verify after every phase") maps to phased work with hard gates. |
| Plan User Goal is one sentence with no clear phase boundary, AND total work is one persistent objective | `goal` | A single `/goal` session is the right envelope when the work is unified. The plan's phases compete for one budget. |
| Plan title / scope / affected files contain `review`, `audit`, `sweep`, `migrate`, or `coverage-check` | `workflow` | Cross-cutting review/audit work benefits from `eval`-cell fan-out with a budget ceiling. The user edits `eval-<topic>.py` before invoking. |
| Plan is non-phased, single-session, bounded, low-risk | `none` (omit) | Default. No opt-in. |
| All other cases | `none` (omit) | Default. No opt-in. |

**When recommending `goal`**, also estimate `omp_goal_budget`:
- 4k tokens per easy phase, 8k per medium phase, 16k per hard phase,
  summed across the plan and rounded to the nearest 5k.
- For non-phased plans, default to 12k tokens.
- The user can override; the field is a hint.

**Recommended wording** for the plan's "Ralph Instructions" section when
a mode is recommended (omit the section entirely if no mode is recommended):

```markdown
## Ralph Instructions

<!-- OMP opt-in: this plan is recommended to run under
     <orchestrate|workflow|goal> mode. <one-sentence rationale> -->

This is a phased Ralph-ready plan. Treat each phase as one unit:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. <If orchestrate|workflow|goal: drop the matching omp keyword on the first turn
    before the build command — see the phase file's "Ralph Mini-Cycle Instructions"
    for the precondition.>
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` to consolidate memory, draft commits, and phase state.
7. Run `/b-commit` to checkpoint durable state before `ralph_done`.
```

## Eval Cell Template for `workflow` Plans

When the recommendation above is `workflow`, `b-plan` writes a starter
`.context/<subject>/eval-<topic>.py` file into the subject folder. The
cell is a **deliverable artifact** the user edits before invoking the
`workflow` keyword. omp's `eval` tool executes it in the persistent
Python kernel; `agent()` / `parallel()` / `pipeline()` are imported
from the kernel prelude (see omp `src/eval/py/prelude.py`).

**Why an artifact, not a hint.** A real `.py` file is:

- Editable in the IDE / kernel (with autocomplete and type checks).
- Verifiable — `python -c "import ast; ast.parse(open(path).read())"`
  catches syntax errors before the workflow keyword is invoked.
- Self-contained — the cell carries the imports, schema, and per-phase
  dispatch in one place. Hint-only snippets get fragmented across turns.

**Template** (replace `<…>` placeholders):

```python
# .context/<subject>/eval-<topic>.py
"""
<plan title> — workflow-mode fan-out.

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
try:
    from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401
except ImportError:
    # The eval cell is OMP-specific. On non-OMP runtimes, the helpers do not
    # exist; surface a clear no-op so the user knows the cell is not portable.
    def _no_op(*_args, **_kwargs):
        print("eval cell: omp runtime required (prelude helpers missing); skipped.")
        return None
    agent = parallel = pipeline = llm = phase = log = budget = _no_op  # type: ignore

SUBJECT = "<subject-folder-name>"
PHASES = [
    # (phase_number, slug, difficulty, brief)
    (1, "<slug-1>", "medium", "<one-sentence phase-1 brief>"),
    (2, "<slug-2>", "easy",   "<one-sentence phase-2 brief>"),
    # ...
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
        model=None,  # let the kernel pick per-tick
        schema=FINDINGS_SCHEMA,
        label=f"phase-{n}-{s}",
    ) for (num, slug, diff, brief) in PHASES]
)

# Stage 2 — barrier: all phases reviewed before synthesis.
phase("workflow: synthesize")
overall = pipeline(
    findings_per_phase,
    # stage 1: aggregate verdicts, log per-phase summary
    lambda findings: [
        log(f"phase {f['phase']} ({f['slug']}): {f['verdict']} — "
            f"{len(f['evidence'])} evidence, {len(f['risks'])} risks")
        for f in findings
    ] or findings,
    # stage 2: judge — escalate any `fail` or `blocked` to the user
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
```

> **See also:** [`docs/eval-kernel.md`](../../docs/eval-kernel.md) for the full
> helper API, budget semantics, schemas, and failure modes. The eval cell is
> OMP-only — on other harnesses the prelude is absent and the cell degrades to
> a no-op via the runtime probe above.

### Example cells
Two real example cells live in `.context/2026-06-06.omp-integration-buck-workflow/`.
They fill the placeholders in the F6 template above and demonstrate two
different fan-out shapes. **Read them before authoring your own cell** —
they are the most concrete documentation of the eval-kernel pattern.
| Cell | Pattern | When to use |
|---|---|---|
| `eval-review-audit.py` | `parallel()` per phase → `pipeline()` log → `llm()` judge | Plan is phased; you want one review subagent per phase and a single go/no-go verdict at the end. |
| `eval-migration-sweep.py` | `parallel()` per directory → `pipeline()` log → `llm()` multi-criterion judge | Work is a migration / sweep / audit across multiple directories; the judge returns a structured ready-to-migrate verdict with a `compatibility_score` and a `blockers` list. |
Both cells:
- Use the runtime probe from Phase 1, so they degrade to a no-op on non-OMP.
- Use a `__main__` guard that exits cleanly when run as `python3 eval-*.py`
  for plain-Python syntax checking without the prelude.
- Cite [`docs/eval-kernel.md`](../../docs/eval-kernel.md) for the full
  helper API and failure modes.
If you write a cell that combines both shapes (e.g., per-target *and*
per-phase), copy the cell whose first half matches and graft the second
half from the other. The two patterns compose — there is no third shape.
**`b-plan` writes this file** to `.context/<subject>/eval-<topic>.py`
when the recommendation table above yields `workflow`. The cell is
always emitted as a **starter** — the user edits the `PHASES` list and
`build_prompt()` body before invoking. If a JavaScript variant is
requested, swap `prelude` imports for `tool.eval-py` and re-emit in JS.

## Recommended Plan Structure

```markdown
# Plan: <title>

## User Goal
<who benefits and what changes for them, or: Technical chore — <reason>>

## Goal
...

## Context used / assumptions
- User-provided context: ...
- Session context: ...
- Artifacts used: ...
- Assumptions / open questions: ...

## Scope
...

## Out of scope
...

## Affected files
...

## Implementation steps
1. ...

## Verification
- ...

## Ralph Instructions
<!-- Optional: include when the user wants Ralph execution on a non-phased plan. Reference b-phase's Ralph Instructions Template and use the single-unit cycle. -->

## Risks
- ...
```

## Output

If you need clarification first:

```text
Clarification needed
What is ambiguous
Question(s) for the user
```

After saving a plan:

```text
Goal
Scope / out of scope
Affected files
Implementation steps
Verification
Inputs used: [user context, session context, brainstorm: X, research: Y, spec: Z]
Subject folder created: .context/YYYY-MM-DD.<subject>/
Plan saved: plan-<topic>.md
Recommended next step
```
