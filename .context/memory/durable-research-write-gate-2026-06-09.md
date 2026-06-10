---
date: 2026-06-09
domains: [skill, docs, buck-workflow]
topics: [b-explore, b-research, write-gate, incremental-notes, durable-artifacts]
related: []
priority: medium
status: completed
subject: 2026-06-09.durable-research-write-gate
artifacts:
  - index.md
---

# Durable Research Write-Gate — 2026-06-09

## Decision

Made incremental note-taking **required** (not optional) in `b-explore` and `b-research` skills. Agents must write durable notes immediately after each discovery unit, not hoard findings in context until session end.

## What Changed

### `skills/b-explore/SKILL.md`
- **Subject Folder Creation**: Added `research/` subdirectory as step 3; updated example tree
- **Replaced soft "Persistence"** → **`Write-Gate Protocol (Required)`**: Mandates writing after each code trace / file-group read; consolidate every 3–5 findings
- **Deleted old "Incremental Updates"** section (subsumed by write-gate)

### `skills/b-research/SKILL.md`
- **Artifact Model**: "Incremental Notes (Optional but Recommended)" → **"Incremental Notes (Required)"**
- **Research Strategy**: Step 4 references write-gate protocol explicitly
- **Replaced soft "Incremental Research Behavior"** → **`Write-Gate Protocol (Required)`**: Mandates writing after each source; consolidate every 3–5 sources

## Write-Gate Protocol (both skills)

1. Create `research/` subdirectory immediately after subject folder
2. Write rolling notes after each discovery unit (code trace for explore, source for research)
3. Consolidate into canonical `research-<topic>.md` every 3–5 findings/sources or at natural breakpoints
4. Update `index.md` after each consolidation
5. Do NOT wait until session end

## Why

Agents hoard findings in context, then dump one file at session end. If interrupted, all intermediate work is lost. The old language ("persist as you go — don't wait until the end", "optional but recommended") was too soft to change behavior. The new language is a gate: you must persist before moving to the next discovery step.

## Branch

`research-with-durable-artifacts`
