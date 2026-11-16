---
name: b-grill
description: Relentlessly stress-test a plan or design through structured interviewing. User mode challenges against domain documentation (CONTEXT.md, ADRs) by default unless --no-docs is passed; auto mode sends questions to a different AI model via RPC. Tracks decision-tree complexity and evaluates separation-of-concerns boundaries at the assessment threshold.
---

# b-grill: Plan Stress-Testing

Durable Buck artifacts are addressed through `workflow_state` or `bun skills/_shared/scripts/workflow-state-cli.ts`, per `skills/_shared/workflow-state-access.md`. The logical names below are the artifact identity. A `.context/` path is only the repo-files projection, not a required input. Do not construct SQL or call `sql_memory`.

Interview relentlessly about every aspect of a plan or design. Track question complexity as metadata that feeds into `b-phase` for plan sizing, while keeping the project's documented domain language (`CONTEXT.md`) and architecture decisions (`docs/adr/`) honest by default.

## Modes & Flags

### User Mode (Default — `/b-grill-me`, `/b-grill-with-docs`, or `/skill:b-grill --mode user`)
- Asks questions to the user one at a time
- User provides answers and makes decisions
- User steers the conversation
- **Domain-documentation awareness (`CONTEXT.md` + `docs/adr/` challenge, glossary sharpening, and inline updates) is enabled by default**
- Pass **`--no-docs`** (e.g. `/b-grill-me --no-docs` or `/skill:b-grill --no-docs`) to explicitly skip `CONTEXT.md` / `docs/adr/` lookups and inline documentation writes

### Auto Mode (`/skill:b-grill --mode auto`)
- Sends questions to a different AI model via RPC (`grill.py`)
- Model's answers inform decision traversal
- Model's context shapes the path
- Tracks model divergence (where the model's answer differed from optimal)

### Mode & Flag Selection
- `/b-grill-me`, `/b-grill-with-docs`, or `/skill:b-grill` (or `--mode user`) → user mode with domain-documentation awareness enabled by default
- `/b-grill-me --no-docs` or `/skill:b-grill --no-docs` → user mode with domain-documentation awareness disabled
- `/skill:b-grill --mode auto` → auto mode

## Core Behavior (Both Modes)

Ask questions one at a time, walking down each branch of the decision tree and resolving dependencies between decisions one by one. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.

## Material Decision Closeout

Load `skills/_shared/decision-closure.md` before grilling. Apply its "When closure applies", "Low-risk path", "Confirming a changed problem framing", and "Calibrating pressure" headings. Preserve the question, decision-domain, boundary, break-point, and deferred/blocked-question metadata below, along with domain-documentation (`CONTEXT.md` / `docs/adr/`) behavior when `--no-docs` is not set.

Light Grill remains discretionary. If used, check for a material trigger; ask only when evidence and prior decisions cannot resolve the closure.

When a material trigger applies, include one `## Decision Closure` section in the session body using the shared protocol's "Closure-ready record", "Assumption ledger fields", and "Material-risk fields". Include selected course, evidence, assumptions, blocking/validation, material risks, excluded scope, and one bounded next action. Omit the section entirely on the low-risk path when evidence already suffices.

If evidence contradicts the stated problem, surface both framings and obtain explicit user confirmation before redirecting; record the prior framing, confirmed replacement, and confirming evidence. Calibrate questions to materiality; do not revisit decisions already closed by evidence. In auto mode, do not present model output as user confirmation; if the replacement lacks confirmation or any required closeout detail, state the gap and leave synthesis to `b-plan`.

## Turn Classification (User Mode)

Before recording a user turn as the resolution of the open question, classify it. Do this even when the turn looks like an answer.

Closed question: does this turn answer the open grill question, add a side constraint, or wander off?

Legal answers: `direct_answer`, `addendum`, `arbitrary`.

When a session `jev` tool is available, call that. Follow `typesafe-ai` and `jev-typesafe-choice-schema`. Do not use eval `judge()`. `judge()` can fall back to a chat model and is the slow path. Do not call TypeSafe HTTP from this skill. Do not embed an OMP-only client. If `jev` is unavailable, fail closed.

```js
await tool.jev({
  state: { open_question: "...", user_turn: "..." },
  questions: {
    turn_class: {
      type: "choice",
      instructions: "Classify the user turn against the open grill question. A short confirm or deny of that question is a direct answer. A new requirement that does not choose an option is an addendum.",
      criteria: {
        direct_answer: "Answers the open question, including a short confirm or deny.",
        addendum: "Adds a requirement, constraint, or side note and does not resolve the open question.",
        arbitrary: "Unrelated to the open question."
      }
    }
  }
})
```

`criteria` is a labelled object. Never an array. Read the answer at `answers.turn_class.choice`.

Act on the label:
- `direct_answer`: record the resolution, then ask the next question.
- `addendum`: append it under `## Addenda` in the grill session file. Do not resolve the open question. Acknowledge the addition, then repeat the open question.
- `arbitrary`: park one line under `## Parked`. Repeat the open question.

If `jev` is missing, errors, or returns a label outside those three, treat the turn as `addendum`. Never guess `direct_answer`. Never fall back to eval `judge()`.

## Domain Awareness (Default in User Mode; Opt Out with `--no-docs`)

Unless `--no-docs` is passed, user mode challenges the plan against existing domain documentation (`CONTEXT.md`, ADRs) and updates those documents inline as decisions crystallize. When `--no-docs` is passed, skip this section entirely.

### File Structure

Look for existing documentation:

**Single context:**
```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

**Multiple contexts** (if `CONTEXT-MAP.md` exists):
```
/
├── CONTEXT-MAP.md
├── src/
│   ├── ordering/
│   │   └── CONTEXT.md
│   └── billing/
│       └── CONTEXT.md
```

Create files lazily — only when you have something to write.

### During the Session

**Challenge against the glossary**: When the user uses a term that conflicts with `CONTEXT.md`, call it out immediately.

**Sharpen fuzzy language**: Propose precise canonical terms when the user is vague.

**Discuss concrete scenarios**: Invent scenarios that probe edge cases and force precise boundaries.

**Cross-reference with code**: When the user states how something works, check whether the code agrees.

**Update CONTEXT.md inline**: When a term is resolved, update `CONTEXT.md` immediately. Don't batch. Follow the format in [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md). Only include terms meaningful to domain experts — not implementation details.

**Offer ADRs sparingly**: Only when all three are true: hard to reverse, surprising without context, result of a real trade-off. Follow [ADR-FORMAT.md](ADR-FORMAT.md).

*Format note: `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` are derived from mattpocock/skills (MIT) — see `THIRD-PARTY-NOTICES.md`.*

## Subject Folder (Required)

Every session creates or joins a subject folder:

1. Check `.context/YYYY-MM-DD.*/` for a matching topic
2. **Found**: Join it — write the grill session file there
3. **Not found**: Create `.context/YYYY-MM-DD.<subject-name>/` and invoke lifecycle `initialize`.

## Metadata Tracking

### What to Track

For each question, record:

- **Question number**: Sequential counter
- **Topic/branch**: Which part of the decision tree this explores
- **Type**: `scope` | `constraint` | `edge-case` | `dependency` | `rollback` | `verification`
- **Resolution**: `resolved` | `deferred` | `blocked`

### Auto Mode Additional Tracking

- **Model answer**: The response from the grilling model
- **Resolution** (extended): `resolved` | `deferred` | `blocked` | `model_aligned` | `model_diverged`

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

Write `grill-session-<topic>.md` (user mode) or `grill-auto-session-<topic>.md` (auto mode) in the subject folder. Update every 5 questions or at domain boundaries.

### Frontmatter

```yaml
---
type: grill-session  # or grill-auto-session for auto mode
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
mode: user|auto
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

## Documentation Decisions

### Terms Resolved
- "account" → **Customer** (not User) — updated in CONTEXT.md
- "cancellation" → **Order Cancellation** (not refund) — updated in CONTEXT.md

### ADRs Created
- ADR-0007: Payment provider selection (Stripe vs Braintree)

### Conflicts Found
- CONTEXT.md defines "fulfillment" as warehouse-only, but user described it including digital delivery — resolved: split into Warehouse Fulfillment and Digital Fulfillment

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

## Addenda
- <turn> — filed, open question left unresolved

## Parked
- <turn> — not the open question
```

Note: `## Documentation Decisions` is included whenever domain-documentation decisions occur (omit when `--no-docs` is passed or when no domain terms/ADRs were touched). If a grilling session produces many glossary conflicts or ADRs across different domains, treat that as a signal the plan crosses multiple domain boundaries and likely warrants phasing.

## Auto Mode: Model Selection

### Configuration Options

**Option 1: Inline specification**
```
/skill:b-grill --mode auto --model openai/gpt-4o
```

**Option 2: Config file**
Create `.context/grill-model.txt`:
```
openai-codex/gpt-5.4
```

**Option 3: Automatic detection**
Finds a different model than the current session automatically.

### Default Behavior
If no model is specified for auto mode, the RPC helper defaults to `openai-codex/gpt-5.4` with thinking level `high`.

### Auto Mode: RPC Session

```python
from grill import Grill, GrillConfig

config = GrillConfig(
    provider="openai-codex",
    model="gpt-5.4",
    thinking="high"
)
grill = Grill(config)
grill.start(initial_context="You will be interviewed about this plan...")
```

Or use the helper script directly:
```bash
python3 grill.py "What is the scope?" --model openai-codex/gpt-5.4
```

### Auto Mode: Model Divergence Handling

When the grilling model's answer diverges from optimal:

1. **Document the divergence**: Record what the model said vs what you determined
2. **Explain the resolution**: Why did you override the model's suggestion?
3. **Flag for review**: Mark as `model_diverged` so stakeholders know this needs attention
4. **Update decision**: Use the resolved decision for the plan

Common divergence patterns:
- Model is overly conservative → you determine risk is acceptable
- Model is overly aggressive → you add safeguards
- Model missed a concern → you address it directly
- Model over-engineered → you simplified
- Model under-engineered → you enhanced

### Auto Mode: Session File Additions

The auto mode session file includes extra fields:

```yaml
grilling_model: <model-id>
decision_domains:
  - name: Data Model
    model_aligned: 5
    model_diverged: 0
  - name: API Design
    model_aligned: 4
    model_diverged: 2
```

And a model divergence analysis section:

```markdown
## Model Divergence Analysis

When the model's answer diverges from optimal:
- **Q5**: Model suggested X, but you determined Y is better because <reason>
- **Q12**: Model flagged concern about Z, which you confirmed is valid
```

## Decision Tree Questions

### Scope Questions
- What is explicitly in scope vs out of scope?
- What assumptions are being made about scope?
- How does this interact with adjacent systems?

### Constraint Questions
- What are the hard constraints (time, budget, tech)?
- What are the soft constraints that could bend?
- Are there regulatory or compliance requirements?

### Edge Case Questions
- What happens with empty/null inputs?
- How does this handle failure modes?
- What are the race conditions?

### Dependency Questions
- What does this depend on?
- What depends on this?
- What could block progress?

### Rollback Questions
- How do we undo this if it goes wrong?
- What's the migration path?
- What's the fallback strategy?

### Verification Questions
- How do we know this works?
- What are the acceptance criteria?
- What could break in production?

## During the Session

- Show running count: *"Q15 of ~25 (threshold: 20)"*
- Update session file at domain boundaries or every 5 questions
- Unless `--no-docs` is passed, update `CONTEXT.md` and `docs/adr/` inline as domain decisions crystallize

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

When `b-phase` runs, it reads `grill-session-*.md` and `grill-auto-session-*.md` files in the subject folder. The `decision_domains`, `break_points`, and `boundary_assessment` provide concrete signals for phase boundaries. `b-phase` treats these as strong suggestions but may adjust based on code analysis.

## Document Mode (Doc Mode)

### Activation
- User says "use doc mode", "document mode", or "doc mode"
- OR auto-detect when the conversation has accumulated 5+ questions in a single session

### Agent Protocol

1. **Start**: When doc mode activates, create the QA file directly:
   - Path: `.context/<subject-folder>/grill-qa-<slug>-<n>.md`
   - Choose the next unused positive integer for `<n>`; never overwrite an existing QA file
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

3. **Wait for answers**: Ask the user to edit the file and send a chat message when they are done. End the turn; do not poll the file or present a TUI selector.

4. **Read answers**: On the user's next message, read the full file and parse each `## Question N` / `### Answer` pair from the markdown.

5. **Append more questions**: Add new question blocks to the same file using the same format. Tell the user the file is ready, then wait for another chat message before reading it again.

6. **Completion**: When grilling is done, leave the file on disk as a permanent record. Update the grill session file with a reference to the document.

### Domain-Docs Awareness
In doc mode (unless `--no-docs` is passed), `CONTEXT.md` and ADR updates happen as usual when decisions crystallize. The grill document captures Q&A pairs; `CONTEXT.md` and `docs/adr/` capture the canonical decisions.

### Non-interactive Mode
Use the same file handoff. If the caller cannot provide a later chat turn, return the QA path and the required resume instruction; do not infer or fabricate answers.

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

`b-grill` does **not** auto-write the cell. The user must invoke
`b-plan` first, see the `omp_execution: workflow` recommendation,
then return to the grilling session output. The auto-derive only
runs in the **next** `b-plan` invocation (the one that produces a
plan with `omp_execution: workflow`). This keeps the grilling
session pure (decision capture, glossary + ADR updates) and the
planning session pure (artifact emission). The `b-flow` deprecation
(2026-06-01) is the lesson: **prompt-level / skill-level changes
only, no new Pi extension or state machine** for this auto-derive.

### Doc-mode interaction

In doc mode (when `--no-docs` is not set), glossary / ADR updates
crystallize in `CONTEXT.md` and `docs/adr/` rather than in the
`decision_domains` list. The auto-derive still works (the
`decision_domains[*].name` field is the source of truth), but the
rationale field may reference the canonical term rather than restate
the question. The user fills the cell by hand when:

- The user cancelled doc mode (the file has the Q&A pairs but
  `boundary_assessment: cohesive` and no `decision_domains`).
- The user resolved glossary conflicts across domains without
  grouping the resolutions into a single domain.

### Schema stability note

The mapping depends on the `decision_domains` data shape emitted by
this skill's session file. If a future revision of `b-grill` adds
fields like `complexity:` per domain, this mapping must be updated
to use the new field. Treat the frontmatter schema in `## Session File`
above as the source of truth for what the auto-derive can read.

## Helper Module (Auto Mode)

Located in the skill directory, `grill.py` provides:

- `Grill` class: Full RPC session management
- `GrillConfig`: Configuration dataclass
- `GrillResponse`: Response with text, thinking, tool_calls
- `grill_session()`: Context manager for sessions
- `list_available_models()`: Discover available models
