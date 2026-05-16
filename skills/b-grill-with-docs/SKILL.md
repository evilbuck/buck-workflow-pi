---
name: b-grill-with-docs
description: Interview the user relentlessly about a plan while challenging it against existing domain documentation (CONTEXT.md, ADRs). Tracks decision-tree complexity as metadata and evaluates separation-of-concerns boundaries at the assessment threshold. Use when stress-testing a plan against documented domain decisions.
---

# b-grill-with-docs: Grilling with Domain Docs + Complexity Tracking

Extends `b-grill` (user mode) with domain-awareness from project documentation (CONTEXT.md, ADRs). Grills the user while keeping the project's documented language, decisions, and architecture honest.

## Core Behavior

Ask questions one at a time. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Domain Awareness

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

**Update CONTEXT.md inline**: When a term is resolved, update `CONTEXT.md` immediately. Don't batch. Follow the format in [CONTEXT-FORMAT.md](../b-grill-with-docs/CONTEXT-FORMAT.md). Only include terms meaningful to domain experts — not implementation details.

**Offer ADRs sparingly**: Only when all three are true: hard to reverse, surprising without context, result of a real trade-off. Follow [ADR-FORMAT.md](../b-grill-with-docs/ADR-FORMAT.md).

## Complexity Tracking (from b-grill)

This skill includes all metadata tracking from `b-grill` (user mode):

- **Subject folder**: Create or join `.context/YYYY-MM-DD.<subject-name>/`
- **Session file**: Write `grill-session-<topic>.md`
- **Track**: question count, decision domains, question types, resolutions
- **Break points**: Model identifies natural division points in the decision tree
- **Phasing signal**: When threshold is exceeded, recommend `/skill:b-phase`

See `b-grill-me` skill for full session file format and frontmatter schema.

Note: The `assessment_threshold` (default 20) is **not a hard limit**. When reached, the model evaluates whether the grilling has crossed subject boundaries or separation-of-concerns lines that warrant phasing. A high question count without boundary-crossing means the plan is large but unified.

### Domain-Specific Additions to Session File

The session file includes an extra section for documentation decisions:

```markdown
## Documentation Decisions

### Terms Resolved
- "account" → **Customer** (not User) — updated in CONTEXT.md
- "cancellation" → **Order Cancellation** (not refund) — updated in CONTEXT.md

### ADRs Created
- ADR-0007: Payment provider selection (Stripe vs Braintree)

### Conflicts Found
- CONTEXT.md defines "fulfillment" as warehouse-only, but user described it including digital delivery — resolved: split into Warehouse Fulfillment and Digital Fulfillment
```

These documentation decisions also feed into the boundary assessment. If a grilling session produces many glossary conflicts or ADRs across different domains, that's a signal the plan crosses multiple domain boundaries and likely warrants phasing.

## Workflow Integration

Same as `b-grill-me`:
1. Show running count with estimated remaining
2. At assessment threshold, evaluate separation-of-concerns boundaries
3. If boundaries found: write break point recommendations, recommend `/skill:b-phase`
4. If cohesive: note explicitly, continue grilling
5. Continue if user wants

Plus: documentation updates (CONTEXT.md, ADRs) happen inline as decisions crystallize.

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

### Domain-Docs Awareness
In doc mode, CONTEXT.md and ADR updates happen as usual when decisions crystallize. The grill document captures Q&A pairs; CONTEXT.md/ADRs capture the canonical decisions.

### Non-interactive Mode
If running in a non-interactive context (no TUI), use `action: "read"` instead of `action: "wait"` to read answers without showing the selector.
