---
name: b-grill-with-docs
description: Interview the user relentlessly about a plan while challenging it against existing domain documentation (CONTEXT.md, ADRs). Tracks decision-tree complexity as metadata and identifies break points for b-phase. Use when stress-testing a plan against documented domain decisions.
---

# b-grill-with-docs: Grilling with Domain Docs + Complexity Tracking

Combines the domain-awareness of `grill-with-docs` with the complexity tracking of `b-grill-me`. Grills the user while keeping the project's documented language, decisions, and architecture honest.

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

## Complexity Tracking (from b-grill-me)

This skill includes all metadata tracking from `b-grill-me`:

- **Subject folder**: Create or join `.context/YYYY-MM-DD.<subject-name>/`
- **Session file**: Write `grill-session-<topic>.md`
- **Track**: question count, decision domains, question types, resolutions
- **Threshold**: Default 20 questions, configurable by user
- **Break points**: Model identifies natural division points in the decision tree
- **Phasing signal**: When threshold is exceeded, recommend `/skill:b-phase`

See `b-grill-me` skill for full session file format and frontmatter schema.

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

These documentation decisions also count toward complexity. If a grilling session produces many glossary conflicts or ADRs, that's an additional signal that the plan touches many domain boundaries and may need phasing.

## Workflow Integration

Same as `b-grill-me`:
1. Show running count with threshold
2. Pause at threshold, show break points
3. Recommend `/skill:b-phase`
4. Continue if user wants

Plus: documentation updates (CONTEXT.md, ADRs) happen inline as decisions crystallize.
