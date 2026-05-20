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

## Scope Resolution

Resolve the review target in this order:

1. **User-provided path** (if given): load the explicit plan/spec/phase/subject artifact
2. **Active subject folder** (from session context): `.context/YYYY-MM-DD.[:subject]/plan-*.md`, `spec-*.md`, `phase-*.md`
3. **All subject folders**: `.context/*/plan-*.md`, `*/spec-*.md`, `*/phase-*.md`
4. **Flat directories** (legacy): `.context/plans/`, `.context/specs/active/`
5. **Backlog**: `.context/backlog/todo.md` (legacy fallback: `.context/backlog.md`)

When a subject folder is provided or resolved, load its best matching active artifact:
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
| `goal` | Does the implementation appear to achieve the goal? |
| `scope` / `affected files` | Are these files changed? Are changes appropriate? |
| `out of scope` | Any unplanned changes in these areas? |
| `implementation steps` | Each step: complete / partial / missing / not-verifiable |
| `verification` | Does the work satisfy verification criteria? |
| `risks` | Any unmitigated risks visible in the code? |

For each step, mark status:
- ✅ **complete** — appears done, evidence found
- 🔄 **partial** — some evidence, incomplete
- ❌ **missing** — no evidence found
- ⚠️ **not-verifiable** — cannot determine from available evidence

## Phased Plan Handling

For `plan-*-phases.md` inputs:
- Default to **current active phase** only (first non-completed phase in summary table)
- User can ask for **all phases** to review the full plan

For `phase-*.md` inputs:
- Review only that phase's scope and acceptance criteria
- Do not require other phases to be complete

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
- Scope adhered: <yes/no/exceptions>
- Out-of-scope changes: <list if any>

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

After accepted work, recommend `/b-save` to record the completed work in history:
- Check `.context/memory/index.md` to verify the work is recorded
- Point user to `/b-save` if memory hasn't been updated
