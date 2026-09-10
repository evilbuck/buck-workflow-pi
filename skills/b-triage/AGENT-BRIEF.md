# Writing Agent Briefs

An agent brief is a structured comment posted on an issue or PR when it
moves to `ready-for-agent`. It is the authoritative specification an AFK
agent works from. The original body and discussion are context: the agent
brief is the contract.

For an issue, the brief describes building the change from nothing; for a
PR, it describes what's left to do *to the existing diff*: finish it, close
gaps, address review points. Same principles either way.

## Principles

### Durability over precision

The issue may sit in `ready-for-agent` for days or weeks. The codebase will
change in the meantime. Write the brief so it stays useful even as files
are renamed, moved, or refactored.

- **Do** describe interfaces, types, and behavioral contracts
- **Do** name specific types, function signatures, or config shapes the
  agent should look for or modify
- **Don't** reference file paths — they go stale
- **Don't** reference line numbers
- **Don't** assume the current implementation structure will remain the
  same

### Behavioral, not procedural

Describe **what** the system should do, not **how** to implement it. The
agent explores the codebase fresh and makes its own implementation
decisions.

- **Good:** "The `SkillConfig` type should accept an optional `schedule`
  field of type `CronExpression`"
- **Bad:** "Open src/types/skill.ts and add a schedule field on line 42"

### Complete acceptance criteria

The agent needs to know when it's done. Every agent brief must have
concrete, testable acceptance criteria. Each criterion should be
independently verifiable.

- **Good:** "Running `gh issue list --label needs-triage` returns issues
  that have been through initial classification"
- **Bad:** "Triage should work correctly"

### Explicit scope boundaries

State what is out of scope. This prevents the agent from gold-plating or
making assumptions about adjacent features.

## Template

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** one-line description of what needs to happen

**Current behavior:**
Describe what happens now. For bugs, this is the broken behavior.
For enhancements, this is the status quo the feature builds on.

**Desired behavior:**
Describe what should happen after the agent's work is complete.
Be specific about edge cases and error conditions.

**Key interfaces:**
- `TypeName`: what needs to change and why
- `functionName()` return type: what it currently returns vs what it should return
- Config shape: any new configuration options needed

**Acceptance criteria:**
- [ ] Specific, testable criterion 1
- [ ] Specific, testable criterion 2
- [ ] Specific, testable criterion 3

**Out of scope:**
- Thing that should NOT be changed or addressed in this issue
- Adjacent feature that might seem related but is separate
```

## Bad agent brief (for contrast)

```markdown
## Agent Brief

**Summary:** Fix the triage bug

**What to do:**
The triage thing is broken. Look at the main file and fix it.
The function around line 150 has the issue.

**Files to change:**
- src/triage/handler.ts (line 150)
- src/types.ts (line 42)
```

This is bad because: no category, vague description, references file
paths and line numbers that will go stale, no acceptance criteria, no
scope boundaries, no current-vs-desired behavior split.
