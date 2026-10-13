---
date: 2026-05-31
domains: [coding, docs]
topics: [subject-selection, skills, review, b-review]
related: [2026-05-31.subject-selection-prompting/plan-subject-selection-prompting.md]
priority: high
status: active
---

# Review: Subject Selection Prompting Implementation

## Scope
Reviewed implementation of `2026-05-31.subject-selection-prompting` plan against actual changes.

## Plan Steps vs Implementation

| Step | Planned | Status | Notes |
|------|---------|--------|-------|
| 1. Create `skills/_shared/subject-resolution.md` | Shared protocol (~50 lines) | ✅ Done | Well-structured, covers all 7 steps |
| 2. Update 8 SKILL.md files | Replace/add Subject Resolution | ✅ Done | All 8 skills updated correctly |
| 3. Update chezmoi AGENTS.md | Add index.md status convention | ❌ MISSING | No changes to `~/.local/share/chezmoi/dot_pi/agent/AGENTS.md` |
| 4. b-plan sets `status: active` | index.md on plan creation | ✅ Done | Line 32 in b-plan/SKILL.md |

## Issues Found

### Issue 1 (Required): chezmoi AGENTS.md not updated
- **Plan Step 3** requires adding `index.md status` field convention to `~/.local/share/chezmoi/dot_pi/agent/AGENTS.md`
- Searched file — no `status:` or `index.md` status convention found
- This breaks the convention's durability — skills reference it but the global agent bootstrap doc doesn't know about it

### Issue 2 (Medium): b-explore missing `status: draft` on creation
- Shared protocol (line 90) says `b-explore → status: draft`
- b-explore/SKILL.md line 31: "Create or update `index.md`" — no status specified
- b-brainstorm and b-research both correctly specify `status: draft`
- b-explore should match: `Create index.md with status: draft`

### Issue 3 (Low): b-save not updated for `status: completed`
- Shared protocol line 92 says `b-save → status: completed`
- b-save SKILL.md was not in scope per plan (only 8 skills listed)
- This is an informational gap — b-save will need updating before the status convention is fully operational
- Not a bug now since no index.md files have status yet, but should be tracked

## What's Correct

- **Shared protocol**: Clean 7-step flow, legacy fallback, menu format, phase selection
- **b-plan**: `status: active` on creation (correct — plan is the activation event)
- **b-research**: `status: draft` on creation ✅
- **b-brainstorm**: `status: draft` + menu behavior ✅
- **b-phase**: Step 5c updates plan + index.md to active ✅
- **b-build/b-review/b-iterate**: Clean reference replacement, old sections removed ✅
- **Backward compat**: Missing index.md defaults to active ✅

## Recommendation
Run `/b-iterate` to fix Issues 1 and 2. Issue 3 can be tracked for later.
