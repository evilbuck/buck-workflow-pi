---
name: b-grill-me
description: Interview the user relentlessly about a plan or design, tracking decision-tree complexity as metadata. When question count exceeds a configurable threshold (default 20), identifies natural break points for b-phase. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

# b-grill-me: Grilling with Complexity Tracking

Interview the user relentlessly about every aspect of their plan. Track question complexity as metadata that feeds into `b-phase` for plan sizing.

## Core Behavior

Ask questions one at a time, walking down each branch of the decision tree. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.

## Subject Folder (Required)

Every session creates or joins a subject folder:

1. Check `.context/YYYY-MM-DD.*/` for a matching topic
2. **Found**: Join it — write the grill session file there
3. **Not found**: Create `.context/YYYY-MM-DD.<subject-name>/`

## Metadata Tracking

### What to Track

For each question, record:

- **Question number**: Sequential counter
- **Topic/branch**: Which part of the decision tree this explores
- **Type**: `scope` | `constraint` | `edge-case` | `dependency` | `rollback` | `verification`
- **Resolution**: `resolved` | `deferred` | `blocked`

### Phasing Threshold

**Default**: 20 questions. User can override at any time.

When questions exceed the threshold:

1. **Pause** and notify the user
2. **Identify break points** — look for:
   - Topic boundaries (questions shift from "data model" to "API design")
   - Dependency boundaries (group A answers don't affect group B questions)
   - Risk boundaries (high-risk areas cluster together)
3. **Write break point recommendations** to the session file
4. **Recommend `/skill:b-phase`**

The model determines where break points exist based on decision tree shape, not linear count.

### Question Grouping

Group questions into **decision domains** as they accumulate:

```
Domain 1: Data Model (Q1-Q7) — 7 questions, 5 resolved
Domain 2: API Design (Q8-Q14) — 7 questions, 6 resolved, 1 deferred
Domain 3: Auth & Permissions (Q15-Q22) — 8 questions, 3 resolved
```

Domains emerge from the decision tree naturally. Don't pre-define them.

## Session File

Write `grill-session-<topic>.md` in the subject folder. Update every 5 questions or at domain boundaries.

### Frontmatter

```yaml
---
type: grill-session
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
total_questions: N
threshold: 20
phasing_recommended: true|false
break_points: [7, 14, 22]
decision_domains:
  - name: Data Model
    questions: [1-7]
    resolved: 5
    deferred: 0
  - name: API Design
    questions: [8-14]
    resolved: 6
    deferred: 1
status: active|completed
---
```

### Body

```markdown
# Grill Session: <Topic>

## Decision Domains

### Domain: <Name>
- Q1: <question> → resolved: <answer>
- Q2: <question> → deferred: <reason>

### Domain: <Name>
...

## Phasing Analysis

> Triggered at Q<N> (threshold: <N>)

**Break points identified:**
- After Q7 (end of Data Model): Clean boundary
- After Q14 (end of API Design): API surface defined
- Q15-Q22 (Auth & Permissions): High-risk cluster

**Recommended phases:**
- Phase 1: Data Model + Migrations (Domain 1)
- Phase 2: API Endpoints (Domain 2)
- Phase 3: Auth & Permissions (Domain 3)

Run `/skill:b-phase` to create the formal phased plan.

## Deferred Questions
- Q3: <question> — blocked on <reason>
```

## During the Session

- Show running count: *"Q15 of ~25 (threshold: 20)"*
- Update session file at domain boundaries or every 5 questions

### When Threshold is Hit

Tell the user: *"We've hit 20 questions across 3 decision domains. This plan is likely too large for one session."*

Show break point analysis, then ask: *"Want to continue grilling, or switch to `/skill:b-phase` to formalize the phases?"*

If user continues, keep tracking — the metadata is still valuable for `b-phase` later.

## Feeding b-phase

When `b-phase` runs, it reads `grill-session-*.md` files in the subject folder. The `decision_domains` and `break_points` provide concrete signals for phase boundaries. `b-phase` treats these as strong suggestions but may adjust based on code analysis.
