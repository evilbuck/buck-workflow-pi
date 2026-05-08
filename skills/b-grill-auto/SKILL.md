---
name: b-grill-auto
description: Interview a different AI model relentlessly about a plan or design, tracking decision-tree complexity as metadata. When question count reaches a configurable assessment threshold (default 20), evaluates whether decision domains cross subject boundaries or separation-of-concerns lines that warrant phasing. Use when user wants automated stress-testing of a plan using a different AI model to answer grilling questions.
---

# b-grill-auto: Automated Grilling with Different Model

> **Note**: For runtime behavior, use the `/b-grill-auto` extension command. This SKILL.md remains as documentation for the question taxonomy, session file format, and metadata schema.

Interview a different AI model (via Pi RPC mode) relentlessly about every aspect of their plan. Track question complexity as metadata that feeds into `b-phase` for plan sizing.

## Core Behavior

Instead of asking the user questions, this skill:
1. Breaks down the plan/design using the same decision tree as `b-grill-me`
2. Spawns a separate Pi instance with a **different model** via RPC mode
3. Sends each question to that model
4. Uses the model's answers as input to traverse the decision tree
5. Makes resolution decisions based on the model's responses

## Key Difference from b-grill-me

| b-grill-me | b-grill-auto |
|------------|--------------|
| Asks questions to user | Sends questions to different model via RPC |
| User provides answers | Different model provides answers |
| User makes decisions | Model's answers inform decisions |
| User steers the conversation | Model's context shapes the path |

## Model Selection

### Configuration Options

**Option 1: Inline specification**
```
/skill:b-grill-auto --model openai/gpt-4o
```

**Option 2: Config file**
Create `.context/grill-model.txt`:
```
openai-codex/gpt-5.4
```

**Option 3: Automatic detection**
Finds a different model than the current session automatically.

### Default Behavior
If no model is specified for `b-grill-auto`, its RPC helper defaults to `openai-codex/gpt-5.4` with thinking level `high`. This default is scoped to `b-grill-auto` only.

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
- **Model answer**: The response from the different model
- **Resolution**: `resolved` | `deferred` | `blocked` | `model_aligned` | `model_diverged`

### Phasing Assessment Threshold

The threshold (default 20) is **not a hard limit** — it is a signal to pause and evaluate whether the session has crossed boundaries that warrant phasing.

### Question Grouping

Group questions into **decision domains** as they accumulate:

```
Domain 1: Data Model (Q1-Q7) — 7 questions, 5 resolved, 2 model_aligned
Domain 2: API Design (Q8-Q14) — 7 questions, 6 resolved, 1 deferred, 1 model_diverged
Domain 3: Auth & Permissions (Q15-Q22) — 8 questions, 3 resolved, 5 pending
```

## Session File

Write `grill-auto-session-<topic>.md` in the subject folder.

### Frontmatter

```yaml
---
type: grill-auto-session
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
total_questions: N
assessment_threshold: 20
boundary_assessment: boundaries_found|cohesive
break_points: [7, 14, 22]
grilling_model: <model-id>
decision_domains:
  - name: Data Model
    questions: [1-7]
    resolved: 5
    deferred: 0
    model_aligned: 5
    model_diverged: 0
  - name: API Design
    questions: [8-14]
    resolved: 6
    deferred: 1
    model_aligned: 4
    model_diverged: 2
status: active|completed
---
```

### Body

```markdown
# Grill Auto Session: <Topic>

**Grilling Model**: <model-id>

## Decision Domains

### Domain: <Name>
- Q1: <question> → model_aligned: <model's answer>
- Q2: <question> → model_diverged: <model's answer> (your resolution: <how you resolved>)

## Model Divergence Analysis

When the model's answer diverges from optimal:
- **Q5**: Model suggested X, but you determined Y is better because <reason>
- **Q12**: Model flagged concern about Z, which you confirmed is valid

## Boundary Assessment

> Triggered at Q<N> (threshold: <N>)

**Assessment**: {boundaries_found|cohesive}

{If boundaries_found:}
**Recommended phases:**
- Phase 1: Data Model + Migrations
- Phase 2: API Endpoints
- Phase 3: Auth & Permissions

Run `/skill:b-phase` to formalize.

## Deferred Questions
- Q3: <question> — blocked on <reason>
```

## The Grilling Process

### Step 1: Setup

1. Identify the plan/design to grill
2. Create or join subject folder
3. Initialize the Grill RPC session
4. Send initial context

### Step 2: Initialize RPC Session

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

### Step 3: Traverse Decision Tree

For each question, send to the grilling model:

```python
response = grill.ask("Q1: What is explicitly in scope vs out of scope?")
print(response.text)
```

Record in session file with resolution status.

### Step 4: Track Complexity

Show running count: *"Q15 of ~25 (threshold: 20) — 3 model divergences"*

### Step 5: Cleanup

```python
grill.close()
```

## Decision Tree Questions

Use the same question categories as b-grill-me:

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

## Model Divergence Handling

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

## Feeding b-phase

When `b-phase` runs, it reads `grill-auto-session-*.md` files in the subject folder. The `decision_domains`, `break_points`, and `boundary_assessment` provide concrete signals for phase boundaries.

The `model_diverged` questions are especially valuable — they highlight areas where the automated grilling found weak points that required human judgment.

## Usage Examples

### Command Line

```bash
# List available models
python3 grill.py --list-models

# Ask a single question
python3 grill.py "What are the edge cases?" --model openai-codex/gpt-5.4

# Interactive session
python3 -c "
from grill import grill_session
with grill_session(model='gpt-5.4', provider='openai-codex') as g:
    print(g.ask('What is the rollback strategy?').text)
"
```

### As a Skill

```
/skill:b-grill-auto --model openai-codex/gpt-5.4

# Or with plan context
/skill:b-grill-auto @my-plan.md --model openai-codex/gpt-5.4
```

## Helper Module: `grill.py`

Located in the skill directory, `grill.py` provides:

- `Grill` class: Full RPC session management
- `GrillConfig`: Configuration dataclass
- `GrillResponse`: Response with text, thinking, tool_calls
- `grill_session()`: Context manager for sessions
- `list_available_models()`: Discover available models

### GrillResponse Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `text` | str | The model's answer |
| `thinking` | str? | Thinking/reasoning trace |
| `tool_calls` | list | Any tool calls made |
| `stop_reason` | str | Why generation stopped |
| `raw_events` | list | All events received |
