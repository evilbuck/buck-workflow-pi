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
- Recommend either `b-iterate` for small fixes or `b-build` / `b-build-hard` for larger follow-up work.

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

### Verdict
<Pass / Pass with warnings / Needs work>

### Recommended Next Step
</markdown>
```

### When review passes (no issues):

```text
Summary
Suggested next step
```

### When review finds issues needing iteration:

**Write an iteration artifact** to the active subject folder before reporting.
Only write this file when there are actual issues to address — do not create it for clean reviews.

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
ralph_status: pending # pending | completed; lets Ralph detect active iteration work
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
If running inside Ralph, do not call `ralph_done` until the iterate artifact is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
```

**Lifecycle tracking:**
- When `b-iterate` works on this artifact, it updates `status: completed`, `ralph_status: completed`, and `completed: YYYY-MM-DD`
- When `b-plan` references this iteration, it adds the plan path to `informs:` field
- This creates bidirectional traceability: iteration → plan (via `informs`) and plan → iteration (via b-plan's `research:` or new `iterations:` field)

### User-facing report:

```text
Summary
Critical issues (see iterate-<subject>.md)
Warnings
Suggested next step: `/b-iterate` to fix
```

## History & Closeout

After accepted work, recommend `/b-save` to record the completed work, then `/b-commit` to commit:
- Check `.context/memory/index.md` to verify the work is recorded
- Point user to `/b-save` if memory hasn't been updated
