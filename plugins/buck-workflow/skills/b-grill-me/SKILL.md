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

## Document Mode (Doc Mode)

### Activation
- User says "use doc mode", "document mode", or "doc mode"
- OR auto-detect when the conversation has accumulated 5+ questions in a single session

### Agent Protocol

1. **Start**: When doc mode activates, create the QA file:
   - Path: `.context/<subject-folder>/grill-qa-<slug>-<n>.md`
   - Call `grill-me_dialog` tool with `action: "create"` and the file path
   - Tell the user the file location so they can open it in their editor

2. **Write questions**: Write questions to the file as markdown:
   ```markdown
   ---

   ## Question 1
   <question text>

   ### Answer
   _(Edit your answer here)_

   ---
   ```
   Each question gets a `## Question N` header, `### Answer` section, and `---` dividers.

3. **Wait for answers**: Call `grill-me_dialog` tool with `action: "wait"` and the same file path — this renders an inline Done/Cancel selector in the chat. The agent pauses until the user presses Done.

4. **Read answers**: When the tool returns, parse the structured answer data from the tool result's `details.blocks` array. Each block has `question_number`, `question_text`, and `answer_text`.

5. **Append more questions**: Add new question blocks to the same file using the same format. Re-read the full file each turn. Call `grill-me_dialog` with `action: "wait"` again.

6. **Completion**: When grilling is done, the file remains on disk as a permanent record. Update the grill session file with a reference to the doc.

### Fallback
If the user cancels the Done/Cancel selector (the tool returns `cancelled: true`), fall back to inline Q&A for the rest of the session. The document is preserved on disk — the user can reference it later.

### Non-interactive Mode

## Feeding the workflow-kernel cell

After a grilling session produces a `grill-session-*.md`, the
`decision_domains` list can feed the eval cell's `PHASES` list when
the plan declares `omp_execution: workflow` AND the plan's `b-plan`
wrote a starter `eval-<topic>.py`. **Both conditions must hold**;
otherwise the user fills the cell by hand.

### Mapping table

The `decision_domains[*].name` field becomes the slug of a `PHASES`
entry; the domain's `rationale` (if present) becomes the brief.

| `decision_domains[*].name` | `PHASES` entry |
|---|---|
| Domain name (any string) | `(N, slug_of(name), "medium", rationale or "see grill-session")` |

The mapping is **one row per domain**. The auto-derive algorithm
enumerates `decision_domains` in order and emits one `agent()` per
domain. The domain's `name` becomes the `slug` (kebab-cased); the
domain's `rationale` (if present) becomes the `brief`; difficulty
defaults to `medium` unless the model has a signal otherwise.

### Auto-derive algorithm

1. Read the active plan's `omp_execution` field. If not `workflow`,
   skip this section.
2. Read `.context/<subject>/grill-session-*.md` (most recent). If
   absent or `decision_domains` is empty, skip.
3. For each `decision_domain` in order:
   - `N` = 1-indexed position in the list.
   - `slug` = `domain.name.lower().replace(" ", "-")`. If two domains
     slug to the same value, append `-2`, `-3`, etc.
   - `difficulty` = `"medium"`. (The grilling session does not emit
     a difficulty signal; the user can edit by hand.)
   - `brief` = `domain.rationale or f"see grill-session-{topic}.md (domain {N})"`.
4. Emit `.context/<subject>/eval-<topic>.py` using the F6 template
   (see `skills/b-plan/SKILL.md` § Eval Cell Template) as the body
   and the derived `PHASES` list.
5. Tell the user: "I derived the cell's `PHASES` from your grill
   session's `decision_domains`. Edit by hand if the auto-derived
   values are off."

### Why this is opt-in

`b-grill-me` does **not** auto-write the cell. The user must invoke
`b-plan` first, see the `omp_execution: workflow` recommendation,
then return to the grilling session output. The auto-derive only
runs in the **next** `b-plan` invocation (the one that produces a
plan with `omp_execution: workflow`). This keeps the grilling
session pure (decision capture) and the planning session pure
(artifact emission). The `b-flow` deprecation (2026-06-01) is the
lesson: **prompt-level / skill-level changes only, no new Pi
extension or state machine** for this auto-derive.

### Schema stability note

The mapping depends on the `decision_domains` data shape emitted by
this skill's session file. If a future revision of `b-grill-me`
adds fields like `complexity:` per domain, this mapping must be
updated to use the new field. Treat the frontmatter schema in
`## Session File` above as the source of truth for what the
auto-derive can read.
