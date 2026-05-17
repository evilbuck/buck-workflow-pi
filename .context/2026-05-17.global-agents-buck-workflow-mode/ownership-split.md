---
status: active
date: 2026-05-17
subject: 2026-05-17.global-agents-buck-workflow-mode
topics: [ownership, split, global-agents, buck-docs, context-workflow]
---

# Ownership Split: Global AGENTS vs Buck Workflow

Maps current content into: keep global, move to global reference docs, move to Buck docs, or move to Buck runtime behavior.

## Keep in Global AGENTS.md

| Section | Rationale |
|---------|-----------|
| Operating Principles | Universal agent behavior rules |
| Project Bootstrap (lightweight) | Universal: read AGENTS.md, check .context/, read README |
| Durable Artifact Principle | Always useful — prefer durable state over chat-only |
| `.context/` as shared convention | Cross-workflow home for durable artifacts |
| Safe Change Policy | Universal agent safety rules |
| Pi-Specific Guidance | Universal: prefer extension points over patches |
| Web UI Verification | Universal frontend verification guidance |
| Chezmoi / Dotfiles Safety | Universal for this user's dotfiles repo |
| Worktrees and QMD | Universal multi-worktree guidance |
| User Feedback Protocol | Universal interaction guidance |
| Completion Checklist | Universal quality gate |
| Buck workflow recommendation | Direct mention: use Buck for most non-trivial work |

## Move to Global Reference Docs (`~/.pi/agent/docs/context-workflow.md`)

| Section | Rationale |
|---------|-----------|
| Artifact Map (detailed) | Too much detail for always-loaded file; already in reference docs |
| Memory Rules (frontmatter template, sections) | Full taxonomy lives better in reference docs |
| Backlog Rules (layout, completion flow) | Full taxonomy lives better in reference docs |
| Plans/Specs/Research templates | Full templates belong in reference docs |
| Cross-reference system | Reference detail, not always-loaded |

## Move to Buck Workflow Docs (`docs/buck-workflow.md`)

| Section | Rationale |
|---------|-----------|
| Workflow Routing (`b-research`, `b-plan`, etc.) | Buck-specific labels — Buck docs already cover this |
| Memory frontmatter specifics | Buck-owned taxonomy |
| Backlog layout and completion flow | Buck-owned convention |
| Subject folder structure | Buck-owned convention |
| Artifact status rules | Buck-owned workflow semantics |
| Buck mode semantics (new) | New: what `buck-workflow mode` means at runtime |

## Move to Buck Runtime Behavior (`extensions/index.ts`)

| Feature | Rationale |
|---------|-----------|
| `/b-mode on\|off\|status` | New: canonical manual mode control |
| Buck mode session state | New: extends `plan_mode_active` to broader mode concept |
| Narrow auto-enable | New: intent detection + latching |
| Generic routing entrypoint | New or deferred: generic-but-Buck-aware skill |

## What Stays Where — Summary

```
~/.pi/agent/AGENTS.md          → baseline rules, .context/ principle, Buck recommendation
~/.pi/agent/docs/context-workflow.md → detailed .context/ taxonomy and templates (already exists)
buck-workflow-pi/docs/buck-workflow.md → Buck workflow semantics, mode docs, b-* commands
buck-workflow-pi/extensions/index.ts   → runtime mode state, /b-mode, auto-enable
```

## Decisions (from grill session)

1. **Global AGENTS mentions Buck directly** — recommends it as the default stronger workflow for most non-trivial work.
2. **`.context/` remains a global convention** — but Buck owns the detailed taxonomy (memory, backlog, subject folders).
3. **Durable artifacts remain a global principle** — always useful regardless of workflow.
4. **Buck mode is extension-owned** — narrow auto-enable, session-latched, manual `/b-mode` control.
5. **No missing-Buck fallback needed** — Buck is always available in this environment.
