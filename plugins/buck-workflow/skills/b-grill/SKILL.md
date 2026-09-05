---
name: b-grill
description: Relentlessly stress-test a plan or design through structured interviewing. Mode 'user' interviews the user directly; mode 'auto' sends questions to a different AI model via RPC. Tracks decision-tree complexity and evaluates separation-of-concerns boundaries at the assessment threshold.
---

# b-grill: Plan Stress-Testing

Interview relentlessly about every aspect of a plan or design. Track question complexity as metadata that feeds into `b-phase` for plan sizing.

## Modes

### User Mode (`b-grill-me`)
- Asks questions to the user one at a time
- User provides answers and makes decisions
- User steers the conversation

### Auto Mode (`b-grill-auto`)
- Sends questions to a different AI model via RPC
- Model's answers inform decision traversal
- Model's context shapes the path
- Tracks model divergence (where the model's answer differed from optimal)

### Mode Selection
- `/b-grill-me` or `/skill:b-grill --mode user` → user mode
- `/b-grill-auto` or `/skill:b-grill --mode auto` → auto mode
- Default: user mode

## Core Behavior (Both Modes)

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

## Boundary Assessment

> Triggered at Q<N> (assessment threshold: <N>)

**Assessment**: {boundaries_found|cohesive}

{If boundaries_found:}
**Separation-of-concerns boundaries identified:**
- After Q7 (end of Data Model): Clean boundary — data layer is independent of API surface

**Recommended phases:**
- Phase 1: Data Model + Migrations (Domain 1)
- Phase 2: API Endpoints (Domain 2)

Run `/skill:b-phase` to create the formal phased plan.

{If cohesive:}
**No phase boundaries**: All questions cluster around a single concern ({name}). Plan is large but unified.

## Deferred Questions
- Q3: <question> — blocked on <reason>
```

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

### When Threshold is Hit

When the threshold is reached, evaluate and report:

**If boundaries are found:**
*"We've reached 20 questions across {N} decision domains. The questions reveal {N} distinct concern boundaries that suggest phasing:"*
Show break point analysis, then ask: *"Want to continue grilling, or switch to `/skill:b-phase` to formalize the phases?"*

**If the plan is cohesive despite size:**
*"We've reached 20 questions, but they all cluster around a single concern: {name}. The plan is large but unified — no clear phase boundary yet."*
Continue grilling, tracking domains as they emerge.

## Feeding b-phase

When `b-phase` runs, it reads `grill-session-*.md` and `grill-auto-session-*.md` files in the subject folder. The `decision_domains`, `break_points`, and `boundary_assessment` provide concrete signals for phase boundaries. `b-phase` treats these as strong suggestions but may adjust based on code analysis.

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
If running in a non-interactive context (no TUI), use `action: "read"` instead of `action: "wait"` to read answers without showing the selector.

## Helper Module (Auto Mode)

Located in the skill directory, `grill.py` provides:

- `Grill` class: Full RPC session management
- `GrillConfig`: Configuration dataclass
- `GrillResponse`: Response with text, thinking, tool_calls
- `grill_session()`: Context manager for sessions
- `list_available_models()`: Discover available models
