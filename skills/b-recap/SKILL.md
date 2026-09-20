---
name: b-recap
description: Summarize the current session in one scan-friendly page (<500 words) — initial purpose, why it mattered, work covered, direction changes, important files, and latest user request. Also include commits since branching and uncommitted work via a scout. Read-only orientation; does not replace /b-save.
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

1. **Primary: This Session** — the user's prompts, steering, and clarifications; assistant turns and confirmed tool actions in the visible transcript. Always recap this session, even when it is empty.
2. **Secondary: Compaction & Artifacts** — compaction blocks; active subject folder (`.context/YYYY-MM-DD.<topic>/`), plan (`plan-*.md`), or session memory (`.context/memory/`).
3. **Additional: Branch Delta** — commits since the default-base merge-base, plus staged, unstaged, and untracked work. Required. Extra orientation; never a substitute for the session recap.

Conversation wins on “what this chat requested.”

## Synthesis Procedure

1. **Inspect Branch Delta via scout** (required, before writing):
   Dispatch **one** read-only scout (`agent: "scout"`). Copy the command block and return schema below into the scout's task. Mainline does not run these git commands — the scout keeps raw git output out of recap context.

   ```
   task({
     i: "Inspecting branch delta",
     context: "Read-only git inspect for /b-recap. No edits.",
     tasks: [{
       name: "BranchDelta",
       agent: "scout",
       task: "<paste this section's command blocks and return schema; run only those commands; return only the compact delta; do not recap the session>"
     }]
   })
   ```

   Scout runs **only** this block, in order. Local git only (no fetch, checkout, stash, or stage):

   ```bash
   git rev-parse --abbrev-ref HEAD
   git symbolic-ref -q refs/remotes/origin/HEAD
   git rev-parse --verify --quiet origin/main
   git rev-parse --verify --quiet origin/master
   git rev-parse --verify --quiet origin/trunk
   ```

   Base = `symbolic-ref` with `refs/remotes/` stripped; else the first of `origin/main`, `origin/master`, `origin/trunk` that `rev-parse` accepted.

   If base resolved and HEAD is not that base:

   ```bash
   git merge-base HEAD <base>
   git log --oneline --no-decorate <merge-base>..HEAD
   git diff --stat <merge-base>...HEAD
   ```

   Always:

   ```bash
   git status --porcelain
   git diff --stat
   git diff --cached --stat
   ```

   Scout returns **only** this compact delta (no raw dumps; cap commit subjects at 20):

   ```
   branch: <name>
   base: <ref>|unresolved
   merge_base: <short-sha>|empty
   commits_ahead: <N>
   commits:
   - <subject>
   committed_stat: <one-line summary>
   unstaged_stat: <summary or clean>
   staged_stat: <summary or clean>
   untracked:
   - <path>
   ```

   Done when that payload is in hand. Mainline synthesizes from the session **plus** this payload.
2. **Identify Initial Purpose & Why**:
   - Earliest substantive user instruction in this session.
   - If this chat has none, say so. Then add branch-delta purpose as extra context, labeled as branch not chat.
3. **Cluster Work Covered**:
   - Session areas first (2–4 objective-level groups). Label the last session area **Latest Focus** when the session had work.
   - Add a **Branch Delta** area when commits-since-branch or the working tree contain work not already in those session areas.
4. **Detect Material Direction Changes**:
   - Session pivots only. If none: `No material direction changes; work progressed along the initial plan.`
5. **Select Important Files (3–6 Paths)**:
   - Session-touched files first, then fill remaining slots from the branch delta (commits since merge-base, then staged / unstaged / untracked).
   - Prefer behavior-bearing source, crucial configuration, verification tests, or primary documentation.
   - **Group closely related paths** (e.g., a skill + its prompt wrapper + command symlink) as one item.
   - One clause per path (or group) plus evidence: conversation, commit-since-branch, or working-tree.
   - Empty fallback only when the session, artifacts, commits-since-branch, *and* the working tree are all empty: `No session-attributable file changes found.`
6. **Capture Latest Request & Current State**:
   - Latest User Request = last substantive user request before `/b-recap`. If none, say none. Never the recap invocation.
   - Current State = session progress **and** `branch <name> · N commits ahead of <base> · dirty: unstaged/staged/untracked` (or `clean`).

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
