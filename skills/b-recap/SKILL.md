---
name: b-recap
description: Summarize the current session in one scan-friendly page (<500 words) — initial purpose, why it mattered, work covered, direction changes, important files, and latest user request. Read-only orientation; does not replace /b-save.
---

# b-recap: Session Recap

Provide a concise, evidence-grounded summary of the current session in one scan-friendly page.

`/b-recap` is an orientation tool: run it mid-session or when returning to an in-progress session to understand what was requested, what was built, what changed, and where things stand. It is **read-only** and produces chat output only. It does not replace `/b-save`, which remains the authoritative command for persisting durable session artifacts.

## Constraints

- **Length Ceiling**: Output MUST NOT exceed **500 words**. Keep bullet points tight and scannable.
- **Read-Only**: NEVER create, modify, or delete files, memory entries, backlog items, or workflow state.
- **Grounding**: Base claims strictly on available evidence. Never fabricate actions or files. If transcript compaction obscures earlier details, disclose the gap inline (e.g. `[compacted context]`).
- **Exclusion of Self**: The `/b-recap` command invocation is not the "Latest User Request". Report the latest substantive user request preceding the recap call.

## Evidence Hierarchy

When reconstructing the session narrative, apply this strict precedence order:

1. **Primary: Active Conversation & Direct User Messages**
   - The user's prompts, instructions, steering, and clarifications.
   - Assistant turns and confirmed tool actions within the visible transcript.
2. **Secondary: Compaction Summaries & Session Artifacts**
   - System compaction blocks summarizing prior conversation turns.
   - Explicit active subject folder artifacts (`.context/YYYY-MM-DD.<topic>/`), active plan (`plan-*.md`), or session memory (`.context/memory/`).
3. **Corroborating: Repository Status & Working Tree**
   - `git status` and `git diff` only corroborate files mentioned in conversation, tool calls, or active subject plans.
   - **Do not** attribute pre-existing, unrelated dirty files to this session unless conversation or artifact evidence links them to the session's work.

## Synthesis Procedure

1. **Identify Initial Purpose & Why**:
   - Locate the earliest substantive user instruction in the session.
   - State the core goal and why it mattered (the business, architectural, or technical motivation).
2. **Cluster Work Covered**:
   - Group work into 2–4 objective-level areas rather than a chronological play-by-play.
   - If multiple areas exist, highlight the final area as the **Latest Focus** with slightly richer detail.
3. **Detect Material Direction Changes**:
   - Document explicit pivots, scope adjustments, or design course corrections instructed by the user or necessitated by discovery.
   - If work proceeded along the initial path without a major pivot, explicitly state:
     `No material direction changes; work progressed along the initial plan.`
4. **Select Important Files (3–6 Paths)**:
   - Identify representative changed or added files that bear behavior, crucial configuration, verification tests, or primary documentation.
   - Provide one concise clause per path explaining its role.
   - If no files were touched in the session, state: `No session-attributable file changes found.`
5. **Capture Latest Request & Current State**:
   - Extract the last substantive request made by the user before invoking `/b-recap`.
   - State the current state of that work (e.g., in progress, implemented awaiting verification, ready for review).

## Output Template

Use this exact Markdown layout:

```markdown
# Session Recap: <Descriptive Topic Title>

**Initial Purpose**: <1–2 sentences on what was requested at session start>
**Why It Mattered**: <1 sentence on motivation, impact, or consequence>

## Work Covered
- **<Objective / Area 1>**: <Summary of what was done>
- **<Objective / Area 2 (Latest Focus)>**: <Summary of latest focus with concrete details>

## Direction Changes
<Summary of material pivots, or "No material direction changes; work progressed along the initial plan.">

## Important Files
- `<path/to/file1>` — <Why this file is significant>
- `<path/to/file2>` — <Why this file is significant>
- `<path/to/file3>` — <Why this file is significant>

## Latest Request & Current State
- **Latest User Request**: <Substantive request prior to /b-recap>
- **Current State**: <Current status, next recommended action>
```
