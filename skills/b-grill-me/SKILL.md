---
name: b-grill-me
description: Interview the user relentlessly about a plan or design, tracking decision-tree complexity as metadata. When question count reaches a configurable assessment threshold (default 20), the model evaluates whether decision domains cross subject boundaries or separation-of-concerns lines that warrant phasing. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
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

### Phasing Assessment Threshold

The threshold (default 20) is **not a hard limit** — it is a signal to pause and evaluate whether the session has crossed boundaries that warrant phasing. When the question count reaches the threshold:

1. **Assess** whether the accumulated questions reveal distinct separation-of-concerns boundaries:
   - **Subject boundaries**: Decision domains map to different architectural layers, services, or bounded contexts
   - **Dependency direction**: Groups of decisions are largely independent — answers in group A don't affect group B
   - **Concern isolation**: The plan touches concerns that should be designed, implemented, and reviewed separately
2. **If boundaries exist**: Identify break points and write recommendations to the session file
3. **If the plan is genuinely cohesive**: Note that explicitly — crossing the threshold without crossing boundaries means the plan is large but unified
4. **Recommend `/skill:b-phase`** when separation-of-concerns boundaries are found

The key question at threshold is: *"Do the decision domains we've explored represent concerns that should be separated?"* A high question count alone does not mandate phasing — boundary-crossing does.

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
assessment_threshold: 20
boundary_assessment: boundaries_found|cohesive
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

## Boundary Assessment

> Triggered at Q<N> (assessment threshold: <N>)

**Assessment**: {boundaries_found|cohesive}

{If boundaries_found:}
**Separation-of-concerns boundaries identified:**
- After Q7 (end of Data Model): Clean boundary — data layer is independent of API surface
- After Q14 (end of API Design): API surface defined, auth layer starts fresh

**Recommended phases:**
- Phase 1: Data Model + Migrations (Domain 1)
- Phase 2: API Endpoints (Domain 2)
- Phase 3: Auth & Permissions (Domain 3)

{If cohesive:}
**No phase boundaries**: All questions cluster around a single concern ({name}). Plan is large but unified.

Run `/skill:b-phase` to create the formal phased plan.

## Deferred Questions
- Q3: <question> — blocked on <reason>
```

## During the Session

- Show running count: *"Q15 of ~25 (threshold: 20)"*
- Update session file at domain boundaries or every 5 questions

### When Threshold is Hit

When the threshold is reached, evaluate and report:

**If boundaries are found:**
*"We've reached 20 questions across {N} decision domains. The questions reveal {N} distinct concern boundaries that suggest phasing:"*
Show break point analysis, then ask: *"Want to continue grilling, or switch to `/skill:b-phase` to formalize the phases?"*

**If the plan is cohesive despite size:**
*"We've reached 20 questions, but they all cluster around a single concern: {name}. The plan is large but unified — no clear phase boundary yet."*
Continue grilling, tracking domains as they emerge.

If user continues, keep tracking — the metadata is still valuable for `b-phase` later.

## Feeding b-phase

When `b-phase` runs, it reads `grill-session-*.md` files in the subject folder. The `decision_domains`, `break_points`, and `boundary_assessment` provide concrete signals for phase boundaries. `b-phase` treats these as strong suggestions but may adjust based on code analysis.
