---
status: active
date: 2026-05-31
updated: 2026-05-31
subject: 2026-05-31.subject-selection-prompting
topics: [review, iteration, skills, docs]
informs: []
addresses: plan-subject-selection-prompting.md
completed: null
ralph_status: pending
from_review: b-review
---

# Iteration: subject-selection-prompting

## Source
- Reviewed after: `/b-build` → `/b-review`
- Plan: `plan-subject-selection-prompting.md`

## Critical Issues

### 1. chezmoi AGENTS.md missing status convention
- **File**: `~/.local/share/chezmoi/dot_pi/agent/AGENTS.md`
- **Problem**: Plan Step 3 required adding `index.md status` field convention to the global agent bootstrap doc. Not done in original build.
- **Proposed fix**: Add "Subject-Level State" section under Subject Folders with draft/active/completed definitions.

### 2. b-explore missing status: draft
- **File**: `skills/b-explore/SKILL.md` line 31
- **Problem**: "Create or update `index.md`" — no status specified. Shared protocol says b-explore should set `status: draft`.
- **Proposed fix**: Change to "Create `index.md` with `status: draft`".
