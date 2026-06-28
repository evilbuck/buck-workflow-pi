---
name: b-review
description: Review implementation changes for correctness, edge cases, regressions, and workflow compliance. Use after b-build, b-build-hard, or b-iterate to validate work before committing. Optionally provide a plan/spec/phase/subject path as the acceptance contract.
---

# b-review: Review Agent

Review **implementation changes** for correctness, edge cases, regressions, and workflow compliance.

You review code after `b-build`, `b-build-hard`, or `b-iterate`. When given a plan, spec, phase, or subject path, you use it as the **acceptance contract** — you verify whether the planned work appears complete, not whether the plan itself is good.

## Invocation Inputs

You accept these optional arguments:

| Input | Example | Behavior |
|---|---|---|
| Plan path | `.context/.../plan-*.md` | Use as acceptance contract; verify planned steps |
| Spec path | `.context/.../spec-*.md` | Use as acceptance contract; verify requirements |
| Phase path | `.context/.../phase-*.md` | Review only that phase's scope |
| Subject folder | `.context/YYYY-MM-DD.subject/` | Scan for active plan/spec/phase artifact |
| Freeform target | file path, description | Review as normal code review |

If no path is provided, fall back to **scope resolution order** below.

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for all downstream artifact discovery.
After subject resolution, load the best matching artifact from the resolved subject:
- `plan-*-phases.md` → current active phase (first non-completed) unless user asks for all phases
- `phase-*.md` → that specific phase only
- `plan-*.md` (no phases) → the full plan

## Work Discovery Protocol

**A user-provided diff is not required.** Discover evidence from these sources:

| Source | Command / Method | What it shows |
|---|---|---|
| Git status | `git status` | Unstaged changes, untracked files |
| Git diff | `git diff` | What changed since last commit |
| Git staged | `git diff --cached` | Staged changes ready to commit |
| Recent commits | `git log --oneline -10` | Work since plan date/baseline |
| Subject artifacts | Read plan, spec, phase files | What was planned |
| Workflow state | Session memory, current-session.json | Active session context |
| Plan affected files | Parse plan's `affected files` list | Expected touched files |
| Source inspection | Read modified files directly | Verify behavior |

When baseline-inference is noisy (long-lived branches), state the baseline/evidence used and fall back to source-state verification.

## Plan Completion Review Protocol

When reviewing against a plan (`plan-*.md`), parse these fields and produce a **completion matrix**:

| Plan Field | What to Verify |
|---|---|
| `user goal` | Does the implementation deliver on the user-facing goal? If absent, note as a review finding (not blocking, but a gap). |
| `goal` | Does the implementation appear to achieve the goal? |
| `scope` / `affected files` | Are these files changed? Are changes appropriate? |
| `out of scope` | Any unplanned changes in these areas? |
| `implementation steps` | Each step: complete / partial / missing / not-verifiable |
| `verification` | Does the work satisfy verification criteria? |
| `risks` | Any unmitigated risks visible in the code? |

For each step, mark status:
- ✅ **complete** — appears done, **direct current-state evidence found** (file:line, passing test, CLI output, screenshot — not just a status field or commit hash)
- 🔄 **partial** — some evidence, **with the missing piece named** ("Step 1 done; Step 2 missing the type-import of `Foo`")
- ❌ **missing** — no evidence found, **paired with a fix proposal** in the `iterate-*.md` artifact
- ⚠️ **not-verifiable** — cannot determine from available evidence, **with the reason stated** (env missing, fixture absent, permission denied)

## Phased Plan Handling

For `plan-*-phases.md` inputs:
- Default to **current active phase** only (first non-completed phase in summary table)
- User can ask for **all phases** to review the full plan

For `phase-*.md` inputs:
- Review only that phase's scope and acceptance criteria
- Do not require other phases to be complete

## Goal-Mode Completion-Audit Protocol

`b-review` mirrors the 6-step protocol from omp's `goal-continuation.md`.
Apply it on every review, regardless of whether the active session is in
goal mode. The protocol is the same shape — the matrix is the per-step
evidence; the audit is a one-time pass at the end.

1. **Restate the objective as concrete deliverables.** Pull the
   acceptance criteria from the active plan, spec, or phase file. If
   they are missing, surface that as a finding (not a blocker — the soft
   gate from `b-build` applies).
2. **Map each deliverable to evidence.** Each acceptance criterion
   needs a file path, line range, test name, or run-command output.
   "Looks right" is not evidence.
3. **Inspect the actual current state.** Read the code. Run the tests.
   Do not trust checkboxes, status fields, or commit messages.
4. **Match verification scope to claim scope.** If the plan claims
   browser behavior, run a browser test. If it claims CLI behavior, run
   the CLI. What you can run is what counts.
5. **Treat uncertainty as not-yet-achieved.** "I couldn't reproduce
   the bug" is not "the bug is fixed." Mark it `⚠️ not-verifiable` or
   `🔄 partial`, never `✅ complete`.
6. **Budget exhaustion is not completion.** A truncated review is a
   `🔄 partial` review, not a pass. Surface the truncation explicitly
   in the report.

### Tightening the completion matrix

Apply these rules when filling out the matrix:

- **`✅ complete`** requires direct current-state evidence — a cited
  file:line, a passing test, a screenshot, or a CLI output. A status
  field or commit hash alone is not enough.
- **`🔄 partial`** must name what is missing. "Looks mostly done" is
  not a partial — name the unchecked criterion.
- **`❌ missing`** must be paired with a fix proposal in the
  `iterate-*.md` artifact if the review is producing one.
- **`⚠️ not-verifiable`** must include the reason verification was
  impossible (env missing, fixture absent, permission denied, etc.).
  The fix is to remove the blocker, not to soften the verdict.

### When the active session is in goal mode

If `.context/workflow/current-session.json` shows an active goal
(`goal` field non-null) or the user invoked `/goal set` during the
review, also run these checks:

- **Objective match** — does the implementation achieve the goal's
  objective verbatim, or only the plan's narrower scope?
- **Budget awareness** — has the goal spent >80% of its
  `token_budget`? If so, recommend the user run `/goal budget` to
  inspect and either raise the budget or wrap up.
- **6-step audit re-run** — apply the steps above as the review's
  closing block, after the per-step matrix. This is the auditable
  record the goal-mode completion handshake requires.

**Checkbox evidence**: Completed status and checkboxes in plan/phase files are evidence but not proof. Verify actual implementation, not just task completion markers.

## Issue Classification & Routing

Every issue found during review is classified by its relationship to the
plan/spec's stated scope. The classification drives **both** the artifact
written and the recommended next step — it is not cosmetic.

### In-plan issues (implementation defects)

The work was **planned** — it appears in the plan's scope, implementation
steps, affected files, or acceptance criteria — but it is broken,
incomplete, or incorrect. This is a bug in the implementation.

- Completes the existing plan; adds no scope.
- Route to **`/b-iterate`**.
- Write an `iterate-*.md` artifact (see "When review finds in-plan issues" below).

The completion matrix surfaces most in-plan issues as `🔄 partial`, `❌
missing`, or `⚠️ not-verifiable` steps; add any correctness defect found in a
file the plan named.

### Out-of-plan issues (scope discoveries)

The issue **falls outside the plan/spec's stated scope and acceptance
criteria** — a newly surfaced requirement, an unanticipated edge case, a
defect in adjacent code exposed by the change, or an improvement the plan
never anticipated. These are **not** implementation bugs against the current
plan; they are newly discovered work.

- Does **not** complete the current plan; it is new work.
- Do **not** route to `/b-iterate`. Do **not** write an `iterate-*.md` artifact — that file is reserved for in-plan defects of the plan under review.
- Route to a fresh **`/b-plan` → `/b-build`** cycle (or `/b-brainstorm` first if the work is genuinely unclear). `b-plan` needs no upstream artifact — it plans from the review report and session context, and may open a new subject folder.
- b-review writes **no artifact** for these — it reports them and recommends `/b-plan`. This keeps the current plan closable.

### Verdict vs. follow-up

In-plan issues drive the **verdict** for the current plan: any in-plan issue
makes the plan `Needs work`. Out-of-plan issues **do not** change the
current plan's verdict — the plan's own work can still pass — they are
follow-up work surfaced only in `Recommended Next Step`, never as a blocker
on the plan under review.

When review finds **only** out-of-plan issues, the current plan still
passes: close the accepted work first (`/b-docs` if documentation impact →
`/b-save` → `/b-commit`), then start the follow-up `/b-plan` → `/b-build`
as a separate cycle. Do not skip closing accepted work to chase follow-ups.

### Not the same as "out-of-scope changes"

`Out-of-scope changes` (the plan field) means the implementation *touched
code the plan said to leave alone* — a scope violation in the diff.
`Out-of-plan issues` means the review *found new work to do* that the plan
never covered. Opposite directions.

## Documentation Impact Check

After the completion matrix and verification, run a **non-blocking** check for
whether the implementation should be reflected in the project's **living
documentation**. This is the detector that triggers `/b-docs`.

**Signals that living docs may need updating:**
- A new or changed **convention** other agents/engineers should follow
- An **architecture decision** realized in the build (ADR candidate)
- New or shifted **domain language** now in code but not in `CONTEXT.md`
- New **module boundaries or data flows** absent from the architecture narrative
- A **constraint not visible in code** (compliance, performance contract)
- A **deviation** where living docs now contradict the code

**Hard rules — documentation impact is never a correctness issue:**
- It is **non-blocking.** A passing review stays a Pass; documentation impact
  never turns Pass into Needs work.
- It **never creates an `iterate-*.md` artifact.** Documentation impact is a
  separate path from in-plan correctness issues. Only **in-plan** correctness issues write to `iterate-*.md`; out-of-plan findings never do.
- It only adds a **Documentation Impact** section to the report and a
  recommended next step of `/b-docs`.

Canonical doc locations live in `skills/b-docs/SKILL.md`. If no signal is
present, state "No documentation impact" and move on.

## Cross-Reference Following

Follow these links for full context:
- Read plan's `research:` field → research files for context (from either `b-explore` or `b-research`)
- Read plan's `spec:` field → spec to verify requirements
- Read spec's `plans:` array → verify coverage

## Behavior Rules

- Stay read-only unless writing an iteration artifact.
- Prioritize correctness over style.
- If no plan/spec is found, review against the user request, discovered diff, and code context — state assumptions explicitly.
- Check tests, security, and risky assumptions.
- Classify every issue as **in-plan** (implementation defect against the plan → `/b-iterate`) or **out-of-plan** (newly surfaced work beyond the plan's scope → fresh `/b-plan` → `/b-build`). See "Issue Classification & Routing."
- **Documentation impact is non-blocking.** When the implementation should be reflected in living docs (conventions, decisions, domain language), recommend `/b-docs` — but never fold it into the correctness verdict or the `iterate-*.md` artifact.

## Output

### Plan-Path Review Report

When reviewing against a plan/spec/phase path, include:

```markdown
## Plan Path Review: <plan name>

### Plan Source
- File: <path>
- Goal: <one-line summary>
- Baseline: <git baseline or date used for comparison>

### Evidence Sources
- Git status: <summary>
- Recent commits: <relevant commits>
- Modified files: <list>
- Plan affected files verified: <list>

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| Step 1 | ✅ complete | <file> changed, behavior verified |
| Step 2 | 🔄 partial | <file> changed but <missing> |
| Step 3 | ❌ missing | No evidence found |
| ... | ... | ... |

### Verification Status
- Goal achieved: <yes/no/partial>
- User goal: <met / partially met / not met> — <evidence from implementation>
- Scope adhered: <yes/no/exceptions>
- Out-of-scope changes: <list if any>

### User Goal Analysis
- Goal: <the user goal text, or "Not defined in plan">
- Met: <what's covered by the implementation>
- Partial: <what's partially addressed>
- Missing: <what's not addressed>
- Verdict: <met / partially met / not met / not defined>

### Documentation Impact
- <"No documentation impact" · or a bullet per flagged area: convention / decision / language / architecture / constraint / deviation>
- Recommended: <none · `/b-docs` before `/b-save`>

### Issue Classification
- In-plan issues (implementation defects → `/b-iterate`): <list, or "none">
- Out-of-plan issues (scope discoveries → fresh `/b-plan`): <list, or "none">

### Verdict
<Pass / Pass with warnings / Needs work> — driven by in-plan issues only; out-of-plan findings do not change this verdict

### Recommended Next Step
<In-plan issues present → `/b-iterate`. Only out-of-plan issues → close accepted work (`/b-docs` if impact → `/b-save` → `/b-commit`), then follow-up `/b-plan` → `/b-build`. Clean → `/b-save` → `/b-commit`.>
</markdown>
```

### When review passes (no in-plan issues):

```text
Summary
Documentation impact: <none | flagged — run /b-docs before /b-save>
Suggested next step
```

This branch also covers **pass with out-of-plan follow-up** — the plan's own work is complete and correct, but review found new scope. Do **not** write an `iterate-*.md`. List out-of-plan issues in the conditional user-facing report (below), and recommend closing the accepted work (`/b-save` → `/b-commit`), then a follow-up `/b-plan` → `/b-build`.

### When review finds in-plan issues needing iteration:

**Write an iteration artifact** to the active subject folder before reporting — but **only for in-plan issues** (implementation defects against the plan under review).
Only write this file when there are actual in-plan issues to address — do not create it for clean reviews.
Out-of-plan issues (scope discoveries) are **never** written here — they are follow-up work surfaced in the report's `Recommended Next Step` (route to a fresh `/b-plan`), with no `iterate-*.md`. b-review writes no artifact for them, and they do not block the current plan.
Documentation impact (conventions, decisions, language) is also **never** written here — it goes in the report's Documentation Impact section and routes to `/b-docs`, not `b-iterate`.

**Subject folder resolution:**
1. Use the **active subject folder** if one was resolved during scope resolution
2. If **no subject folder exists**, create one: `.context/YYYY-MM-DD.<subject>/`
3. Write the artifact inside: `.context/YYYY-MM-DD.<subject>/iterate-<subject>.md`

```
.context/YYYY-MM-DD.<subject>/
└── iterate-<subject>.md
```

**Date field guidance:**
- `date`: Use **review date** (when b-review runs), not the original folder date
- `subject`: Use the **original subject folder's subject** value (e.g., `2026-05-15.my-feature`)
- `updated`: Set to same as `date` initially; update whenever the file changes

**Iteration artifact format:**

```markdown
---
status: active
date: YYYY-MM-DD
updated: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
topics: [review, iteration]
informs: []          # Filled by b-plan when referencing this iteration
addresses: plan-*.md # Plan this iteration is about
completed: null      # Set when b-iterate marks it done
from_review: b-review
---

# Iteration: <subject>

## Source
- Reviewed after: `/b-build` | `/b-build-hard` | `/b-iterate`
- Plan: `plan-*.md` (if applicable)
- Spec: `spec-*.md` (if applicable)

## Critical Issues

### 1. <short title>
- **File**: `path/to/file`
- **Problem**: <what's wrong>
- **Proposed fix**: <specific change description>

## Warnings

### 1. <short title>
- **File**: `path/to/file`
- **Problem**: <potential issue>
- **Suggested approach**: <how to address>

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan or phase.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
```

**Lifecycle tracking:**
- When `b-iterate` works on this artifact, it updates `status: completed` and `completed: YYYY-MM-DD`
- When `b-plan` references this iteration, it adds the plan path to `informs:` field
- This creates bidirectional traceability: iteration → plan (via `informs`) and plan → iteration (via b-plan's `research:` or new `iterations:` field)

### User-facing report:

```text
Summary
In-plan issues: <N or "none"> · Out-of-plan issues: <N or "none">
Warnings
Suggested next step: <`/b-iterate` if in-plan issues · close accepted work then `/b-plan` if only out-of-plan · `/b-save` → `/b-commit` if none>
```

## History & Closeout

After accepted work: if documentation impact was flagged, recommend `/b-docs` to update living docs first; then `/b-save` to record the session; then `/b-commit` to commit:
- Check `.context/memory/index.md` to verify the work is recorded
- Point user to `/b-save` if memory hasn't been updated

If review surfaced **only out-of-plan issues**, the current plan still passed: close it here (`/b-save` → `/b-commit`) before starting the follow-up `/b-plan` → `/b-build` as a new subject. Do not leave accepted work uncommitted to chase follow-ups.
