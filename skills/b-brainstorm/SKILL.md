---
name: b-brainstorm
description: Interview-style intake — capture initial thinking and save a loose first-draft plan to a subject folder. Use when starting new work that needs scoping before formal planning.
---

# b-brainstorm: Intake Interview

Interview the user one question at a time to understand what they want to build, then save a loose first-draft plan to a **subject folder** in `.context/`. This is an **intake step** — it captures initial thinking, not formal planning.

## Write Boundary

- You may write only to `.context/**` and temporary scratch locations.
- **Every b-brainstorm creates a subject folder immediately**: `.context/YYYY-MM-DD.<subject-name>/`
- **Create `index.md`** with `status: draft` in the subject root linking the draft and any other artifacts. This is the stable entrypoint for downstream commands.
- Maintain sidecar state inside the subject folder (`brainstorm-state-<slug>.json`).
- Do not modify source files outside `.context/`.

## Core Behavior

**Scope**: Stay subject-local by default. Only create backlog entries when the user explicitly asks to add items to the backlog.

### Interview Flow

**Subject Resolution**: Before starting, apply the shared protocol at `skills/_shared/subject-resolution.md` to detect existing subjects. If multiple subjects are found, present the numbered menu and wait for the user to pick. If exactly one subject is found, use it. If none, start a new subject folder.

**Note**: `b-brainstorm` creates new subject folders with `index.md status: draft`. If the protocol resolves an existing subject, you may either resume that subject's brainstorm or start a new one alongside it.
2. **Start**: If the user provided a topic hint, use it to derive a draft slug. If a matching draft already exists in the resolved subject, offer to resume it.
3. **Ask one question at a time**. Keep a soft cap of ~4 questions before attempting a draft.
4. **Draft when ready**: If you have enough information (or the user says "enough"), write a loose first draft.
5. **Show the path**: After saving, tell the user exactly where the draft lives.
6. **Review and gap-check**: Read the saved draft back and critique it for ambiguous language, missing constraints, unclear success criteria, or unstated assumptions.
7. **Continue or stop**: Ask if the user wants to flesh out gaps or if they're satisfied (or want to edit manually).
8. **Never auto-invoke `/b-plan`**: Only recommend it when the user explicitly asks to formalize.
### Artifact Type Guidance (When User Is Unsure)

If the user seems confused about whether they want a "plan" vs a "spec" vs something else, offer:

```
Not sure what you need? Here's a quick guide:

1. "I want a quick todo list" → I'll create a backlog item (`.context/backlog/items/<slug>.md` + entry in `todo.md`) if you explicitly ask; otherwise I'll keep notes in the brainstorm draft
2. "I want a loose first draft" → I'll save a brainstorm draft (what we're doing now)
3. "I want a formal plan with steps" → I'll hand off to `/b-plan` for a bounded plan
4. "I want a full spec/PRD/roadmap" → I'll hand off to `/b-plan` for a strategic spec

Just tell me which number matches what you need, or describe it in your own words.
```

### Draft Format

Save drafts in this loose structure:

```markdown
# Plan: <working title>

## What we might build
- ...

## Why it matters
- ...

## Constraints / preferences
- ...

## Open questions
- ...

## Brainstorm notes
- ...
```

This stays intentionally light — `/b-plan` can formalize it later.

## Resume Behavior

### Detecting Resume

1. **Topic hint matches existing subject**: Look for matching subject folder `.context/YYYY-MM-DD.<subject>/` containing a brainstorm draft.
2. **Draft already in conversation**: If the conversation already has a draft path active, continue that draft.
3. **Sidecar hash changed**: If the sidecar's `last_ai_hash` differs from the current file content, the user edited externally. Summarize what changed, then ask if they want to continue or start fresh.

### Sidecar State

After each AI-authored save, compute a SHA256 hash of the visible draft text and store it in the subject folder:

`.context/YYYY-MM-DD.<subject>/brainstorm-state-<slug>.json`

```json
{
  "plan_path": ".context/YYYY-MM-DD.<subject>/brainstorm-<slug>.md",
  "subject": "YYYY-MM-DD.<subject>",
  "slug": "<slug>",
  "question_count": 3,
  "last_ai_hash": "<sha256>",
  "last_reviewed_at": "2026-04-01T12:00:00Z"
}
```

**Fail-open**: If the sidecar is missing or malformed, trust the current draft file and recreate sidecar state after the next save.

## Slug Generation

Generate a slug from the topic hint:
- Lowercase, hyphenated
- Remove special characters
- Max 50 characters
- Example: "add oauth login" → "add-oauth-login"

If no hint given, use "brainstorm-<timestamp>" as fallback.

## Output Format

```
<interview question>

---
Draft saved to: .context/YYYY-MM-DD.<subject>/brainstorm-<slug>.md
Subject folder created: .context/YYYY-MM-DD.<subject>/

[if resuming or reviewing:]
I noticed the draft was edited externally. Key changes:
- ...

Ready for your next input, or let me know if you'd like to:
- Continue brainstorming
- Edit the draft manually
- Formalize with /b-plan
```
