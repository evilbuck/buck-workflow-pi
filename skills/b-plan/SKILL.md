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

## Active Capability Probe (Run First)

This is the first executable step. Run it **before** Subject Resolution and
before reading `_shared`, sibling skills, repository documentation, OMP
examples, package manifests, or installer files.

Probe the active harness's loader-native skill catalog or exact-name resolver
for these canonical sentinels:

- `b-build`
- `b-review`
- `b-save`

An injected "available skills" catalog, a loader API that resolves an exact
skill name for the current session, or a harness command that reports
session-resolved skills is authoritative. A source checkout, readable
`SKILL.md`, package manifest, harness executable, `.context/` directory,
bootstrap `AGENTS.md`/`CLAUDE.md`, or install record is **not** evidence that a
skill is loaded. Do not shell-scan known global skill directories and do not
read sentinel files merely to prove they exist.

**Hard evidence gate:** when the session context already injects an available
skills catalog, use it directly without tool calls. Record a `probe_source`
such as `system available-skills catalog` or the exact loader-native resolver.
If the only possible check would use filesystem listing, globbing, file reads,
package metadata, environment variables, or install directories, set
`probe_source: unavailable` and classify `unknown`; do not run those checks.


Classify the result deterministically:

| State | Evidence | Mode |
|---|---|---|
| `full` | All 3 sentinels resolve in an authoritative active-session probe | Full Buck Workflow |
| `partial` | 1–2 sentinels resolve in an authoritative probe | Standalone mini workflow; name the missing sentinels and offer repair guidance |
| `standalone` | 0 sentinels resolve in an authoritative probe | Standalone mini workflow; offer installation guidance |
| `unknown` | The runtime exposes no reliable inventory or resolver | Standalone mini workflow; make installation guidance conditional and never claim absence |

State the result and its evidence once near the start. The current skill proves
only that B-Plan is available. If the probe is `unknown`, do not turn a
successful filesystem read into `full`, `partial`, or `standalone`.

In `full` mode, continue through the existing full-workflow sections below.
Optional companions such as `b-phase`, `b-explore`, and `b-research` still
require their own loader-native availability check before recommendation. In
every other state, use only the self-contained mini workflow and installation
handoff below; do not touch full-workflow-only dependencies.

## Write Boundary

- You may write to `.context/**` and temporary scratch locations using native file tools (write/edit).
- Save plans where the user can reuse them outside the context window.
- Do not modify source files outside `.context/`.
- **Allowed**: Native directory, listing, read, write, and edit tools for relevant `.context/**` artifacts and temporary scratch files.
- **Blocked**: Bash redirects (`>`) and file modifications outside `.context/**`.

## Subject Folder Use (Required)

**Every b-plan session uses a subject folder.** Reuse the explicitly selected
active subject when appropriate; otherwise create one:

1. Infer a subject name from the conversation topic (kebab-case).
2. Create `.context/YYYY-MM-DD.<subject-name>/`.
3. Create `index.md` with `status: active`.
4. Write `plan-<topic>.md` inside it.

**Example:**
```
.context/
└── 2026-04-08.auth-feature/
    ├── index.md    ← status: active
    └── plan-oauth-login.md
```

## Subject Resolution

### Full mode

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If it resolves a subject, use it for all downstream artifact discovery. If it
finds no subject, proceed as a fresh session.

### Partial, standalone, or unknown mode

Do **not** read `skills/_shared/subject-resolution.md`. Resolve locally:

1. Use an explicit subject path/name from the user when provided.
2. If `.context/workflow/current-session.json` exists, use its memory file's
   `subject:` only when that subject folder exists and its `index.md` is still
   `status: active`; a stale pointer is not selection evidence.
3. Inspect the `status:` in each present
   `.context/YYYY-MM-DD.<subject>/index.md`. A generated
   `.context/index/subjects.json` may be used only as a cache when its
   freshness is verifiable; the subject `index.md` files remain canonical.
4. Zero active subjects means create a fresh folder. Exactly one may be
   selected silently. For multiple active subjects, present **every** active
   subject in a numbered list and wait for selection. A tool's option cap is
   not permission to truncate or rank the list: use a plain menu or paginate.
   Never infer that the newest active folder is the intended subject.


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

## Standalone Mini Workflow

When the capability state is `partial`, `standalone`, or `unknown`, B-Plan
still completes the planning deliverable:

1. Start from explicit user and session context. Inspect only relevant local
   code and `.context/` artifacts that actually exist.
2. Use the Clarification Interview Protocol and User Goal Requirement below.
   Ask only questions that materially change scope, acceptance criteria,
   risks, or verification.
3. Resolve or create the subject folder with the local protocol above.
4. Write `index.md` with `status: active` and a `plan-*.md` using the Plan
   Frontmatter Template. The plan must include User Goal, Goal, context and
   assumptions, scope and out-of-scope, affected files, implementation steps,
   acceptance criteria, verification, and risks.
5. Do not create or update backlog, memory, phase, eval-cell, review, or commit
   artifacts. Do not recommend unavailable Buck skills as executable next
   steps.
6. Finish with the saved plan path, detected state, missing sentinels when
   known, the applicable install/repair handoff, and the post-reload sentinel
   verification.

This mini workflow is the boundary: it does not emulate build, review, save,
documentation, phasing, or commit behavior.

## Installation and Repair Handoff

Do not install automatically. For `partial`, call this a **repair**; for
`standalone`, call it an **installation**; for `unknown`, make it conditional
on the user wanting the full workflow.

| Harness | GitHub handoff |
|---|---|
| Pi | `pi install git:github.com/evilbuck/buck-workflow-pi` |
| OMP | `omp install git:github.com/evilbuck/buck-workflow-pi` |
| Claude Code | Clone `https://github.com/evilbuck/buck-workflow-pi` to a durable path, then run `<clone>/scripts/install.mjs --source <clone> --harness claude`. |
| OpenCode | Clone the same repository to a durable path, then run `<clone>/scripts/install.mjs --source <clone> --harness opencode`. |
| Codex | Clone `https://github.com/evilbuck/buck-workflow-pi` to a durable path and link each `<clone>/skills/<name>/` into `~/.agents/skills/<name>/`; the current installer wires Codex bootstrap instructions only. |
| Unknown/other | First identify the harness, then use `https://github.com/evilbuck/buck-workflow-pi/blob/master/agent-install_instructions.md`; do not guess a global directory. |

For symlink-based installs, preserve real destination files and use the
installer's default non-force behavior (or `--dry-run`) first. Never point
links into an ephemeral clone. After install/repair, restart or reload the
agent session and repeat the exact `b-build`/`b-review`/`b-save` probe. Report
`full` only when all three resolve in the refreshed active session.


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

## Cross-Reference Stitching (Full Mode Only)

Run this section only when the active capability state is `full`. When creating
a plan:

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
- In `full` mode, create backlog items only for **clear near-term actionable
  units** that emerge from the plan. One backlog item = one pickup-able unit
  of work. Do not auto-expand specs/plans into a large queue.
- When creating full-mode backlog items, create the backing item file
  `.context/backlog/items/<slug>.md` with frontmatter (`title`,
  `status: active`, `priority`, `created`, `updated`, `completed: null`,
  `related`) and add a linked checkbox to `.context/backlog/todo.md`. If only
  `.context/backlog.md` exists (legacy), use that format instead.
- In `full` mode, recommend `b-build` for straightforward work and
  `b-build-hard` for ambiguous or high-risk work.
- Recommend `b-explore` or `b-research` only when the relevant skill is
  loader-discoverable and missing local or external understanding prevents a
  good plan.
- **Recommend `b-phase` only in `full` mode, only when it is
  loader-discoverable, and only if the plan exceeds any of these thresholds:**
  - More than ~8 implementation steps
  - Touches more than ~5 distinct files or directories
  - Spans multiple architectural layers (DB + API + UI)
  - Involves high-risk paths (auth, billing, data migrations)
  - Contains significant unknowns or research spikes
  - Verification alone would exhaust a single session
  - Phrasing: *"This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential OMP-ready execution phases with dependency analysis, per-phase model hints, and resume-safe execution instructions."*
- Only in `full` mode, when the user wants an automated execution session but
  the plan does **not** need phasing, add a minimal **Execution Instructions**
  section for the single-unit cycle: `/b-build` → `/b-review` → `/b-iterate`
  if in-plan issues → `/b-docs` if doc impact → `/b-save` → `/b-commit`.
  Out-of-plan findings spawn a separate `/b-plan` → `/b-build` cycle.

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

## Non-Phased Execution-Ready Plans (Full Mode Only)

Run this section only in `full` mode. Not every execution-session task needs
`b-phase`. If the plan is small enough for one build/review cycle but the user
wants an automated session to drive it, add a short **Execution Instructions**
section to the plan itself. Treat the whole plan as one unit and use the same
durable mini-cycle documented in `b-phase`'s Execution Instructions Template.

Recommended wording:

```markdown
## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` (or `/b-build-hard` if ambiguity appears) against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next turn.
```

## OMP Execution Recommendation
This section is full-mode-only. Do not read its linked repository docs or emit
OMP recommendations from the standalone mini workflow.


`b-plan` does **not** auto-set the `omp_execution` field. It surfaces a
recommendation in the plan's "Execution Instructions" section based on the
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

**Recommended wording** for the plan's "Execution Instructions" section when
a mode is recommended (omit the section entirely if no mode is recommended):

```markdown
## Execution Instructions

<!-- OMP opt-in: this plan is recommended to run under
     <orchestrate|workflow|goal> mode. <one-sentence rationale> -->

This is a phased execution-ready plan. Treat each phase as one unit:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. <If orchestrate|workflow: drop the matching omp keyword on the first turn before the build command. If goal: run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first. Either way, see the phase file's "Per-Phase Execution Loop" for the precondition.>
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` to consolidate memory, draft commits, and phase state.
7. Run `/b-commit` to checkpoint durable state.
```

## Eval Cell Template for `workflow` Plans
This section is full-mode-only and applies only when the active OMP capability
needed for `workflow` plans is available.


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

Two real example cells live in
`.context/2026-06-06.omp-integration-buck-workflow/`. In `full` mode, read them
before authoring a cell; in every other mode, do not probe for or read them.
They fill the placeholders in the F6 template above and demonstrate two
different fan-out shapes.
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


## Acceptance criteria
- [ ] ...

## Verification
- ...

## Execution Instructions
<!-- Full mode only. Optional when the user wants an automated execution session on a non-phased plan. -->

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

After saving a plan, always report:

```text
Goal
Scope / out of scope
Affected files
Implementation steps
Verification
Inputs used: [user context, session context, brainstorm: X, research: Y, spec: Z]
Subject folder used: .context/YYYY-MM-DD.<subject>/
Plan saved: plan-<topic>.md
Buck capability: <full|partial|standalone|unknown>
Probe source: <loader-native source or unavailable>
Missing sentinels: <names, none, or unknown>
Recommended next step
```

For `partial`, `standalone`, or `unknown`, replace unavailable Buck handoffs
with the relevant Installation and Repair Handoff plus the reload-and-reprobe
verification. For `full`, preserve the existing downstream recommendations.
