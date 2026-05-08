---
title: b-grill-auto RPC agent harness
status: completed
priority: high
created: 2026-05-08
updated: 2026-05-08
completed: 2026-05-08
related:
  - .context/2026-05-08.b-grill-auto/research-b-grill-auto-review.md
  - skills/b-grill-auto/SKILL.md
  - skills/b-grill-auto/grill.py
  - items/ts-extension-b-grill-auto.md
  - extensions/b-grill-auto/harness.ts
  - extensions/b-grill-auto/rpc-client.ts
---

# b-grill-auto RPC Agent Harness

## Description

Define and implement a small prompt harness for the RPC answer model (`openai-codex/gpt-5.4`) so it answers grilling questions consistently, concisely, and in a structured format the orchestrator can consume.

## Context

Currently, `b-grill-auto` sends raw questions to the RPC answer model with no harness. This leads to:
- Verbose, rambling answers
- Inconsistent format
- Hard for orchestrator to parse and extract key info
- Risk of the answerer going off-topic or trying to "solve" rather than "answer"

## Design Decisions Needed

### 1. Output Format

**Recommended: Structured JSON**

The answer model returns JSON so the orchestrator can reliably extract:
- `answer` — direct answer to the question
- `assumptions` — what the model assumed to answer
- `risks` — risks or concerns raised by this answer
- `unknowns` — things the model is uncertain about
- `follow_up` — suggested next question or branch to pursue

### 2. Tools Allowed?

**Recommended: Read-only tools**

- Allow: `read`, `grep`, `find`, `ls`, `bash` (exploration only)
- Block: `write`, `edit`, `rm`, mutating operations
- Rationale: The answerer should be able to explore context, but not modify anything

### 3. Context Window

**Recommended: Include**

- The plan/design being grilled
- The question being asked
- Any prior context from earlier questions in this session
- NOT the full conversation history

### 4. Answerer Persona

**Recommended:**

```
You are a design reviewer answering questions about a plan or design.
Your role is to identify concerns, edge cases, risks, and assumptions.
Be direct and concise. Focus on the question asked.
Do not propose solutions or refactor the plan.
If something is unclear, say so and explain what you assumed.
```

### 5. Halted States

The answerer should signal when it:
- Doesn't have enough context to answer
- Is uncertain about key assumptions
- Spots a fundamental flaw
- Should defer to human judgment

## Recommended Harness Template

```
SYSTEM:
You are a design reviewer answering questions about a plan or design.
Your role is to identify concerns, edge cases, risks, and assumptions.
Be direct and concise. Focus on the question asked.
Do not propose solutions or refactor the plan.
If something is unclear, say so and explain what you assumed.
Output valid JSON with these fields:
- answer: direct answer to the question
- assumptions: list of assumptions made
- risks: list of risks or concerns
- unknowns: list of things you're uncertain about
- follow_up: suggested next question or branch
- halted: true/false (true if you cannot answer confidently)

USER:
## Plan/Design Context
{plan_content}

## Question
{question}

## Prior Context
{prior_qa_summary}
```

## Implementation Notes

### Where to Implement

This harness lives in the TypeScript extension (`items/ts-extension-b-grill-auto.md`) as the initial prompt sent to the RPC subprocess, not as a separate file.

### Orchestrator Split

The design preserves the two-model split:

| Role | Model | Responsibility |
|------|-------|----------------|
| Orchestrator | Fast model (current session or mini) | Generate questions, sequence branches, adjudicate |
| Answerer | `openai-codex/gpt-5.4` | Answer questions, identify risks, suggest follow-ups |

### JSON Parsing

The orchestrator must parse the answerer's JSON response. Handle:
- Malformed JSON (retry or fallback to text extraction)
- Missing fields (use defaults)
- `halted: true` (mark question as blocked, move on)

### Tools Configuration

The answerer subprocess should be started with restricted tools. In the extension, this can be done with `--no-tools` or by spawning with specific tool allowlist.

Example Pi RPC invocation:
```bash
pi --mode rpc \
   --provider openai-codex \
   --model gpt-5.4 \
   --no-tools \
   --no-session
```

Or with restricted tools:
```bash
pi --mode rpc \
   --provider openai-codex \
   --model gpt-5.4 \
   --tools read,bash \
   --no-session
```

### Testing the Harness

Before wiring into the extension, test the harness standalone:

```bash
pi --mode rpc \
   --provider openai-codex \
   --model gpt-5.4 \
   --no-tools \
   --no-session
```

Then send the harness + a test question to verify output format.

## Verification

- [ ] Harness produces valid JSON on clean questions
- [ ] Harness handles "I don't know" gracefully
- [ ] Orchestrator can parse JSON and extract fields
- [ ] Tool restrictions prevent unintended writes
- [ ] `halted: true` is returned appropriately
- [ ] Follow-up suggestions are useful

## Open Questions

1. Should the harness allow the answerer to ask clarifying questions back, or should it always answer with assumptions stated?
2. How much prior context should be included? (Full history vs last N Q&A pairs vs summary)
3. Should the answerer be told the "type" of question (scope, constraint, edge-case, etc.) to guide its response style?
4. Should there be different harness variants for different question types?
