---
status: active
date: 2026-05-17
subject: 2026-05-17.planning-mode-write-guards
topics: [plan-mode, write-guards, extension-hooks, b-research, b-plan, b-grill-me, b-grill-with-docs]
informs: []
---

# Research: Planning Mode Write Guards

## Context

The user reports that the last two sessions had b-research implementing half-baked solutions mid-research/explore. The existing plan mode infrastructure exists in `extensions/index.ts` but has gaps:

1. **b-grill-me and b-grill-with-docs are not in `PLAN_MODE_COMMANDS`** — so they never activate write protection.
2. **Plan mode only activates via registered commands** (`/b-plan`, `/b-brainstorm`, `/b-research`) — skills loaded via `/skill:b-research` without the command don't get the guard.
3. **`isAllowedPlanWritePath` allows any `.md` or `.txt` anywhere** — this means `src/feature.md` or `lib/notes.txt` would pass, not just `.context/` and `docs/`.
4. **No prompt templates exist for b-grill-me or b-grill-with-docs** — they're skill-only, so the command trigger path doesn't apply.

## Current Architecture

### What Exists (in `extensions/index.ts`)

| Component | Status | Details |
|-----------|--------|---------|
| `PLAN_MODE_COMMANDS` | Partial | `["b-plan", "b-brainstorm", "b-research"]` — missing grill commands |
| `isAllowedPlanWritePath()` | Too permissive | Allows `.md`/`.txt` anywhere, not just `.context/` and `docs/` |
| `tool_call` hook (write/edit) | Working | Blocks write/edit to non-allowed paths |
| `tool_call` hook (bash) | Working | Blocks mutating git, redirects, and AI-reviews ambiguous commands |
| `before_agent_start` system prompt injection | Working | Tells the model it's in plan mode |
| Auto-disable on `IMPLEMENTATION_COMMANDS` | Working | `/b-build`, `/b-build-hard`, `/b-iterate` disable plan mode |
| Status bar indicator | Working | Shows "📝 planning" |

### What's Missing

1. **`b-grill-me` and `b-grill-with-docs` not in `PLAN_MODE_COMMANDS`** — they need to be added.
2. **No prompt templates for grill commands** — `prompts/` has no `b-grill-me.md` or `b-grill-with-docs.md`. Skills loaded via `/skill:b-grill-me` don't trigger the command handler.
3. **`.md`/`.txt` extension allowlist too broad** — currently allows writing to `src/readme.md` or `lib/notes.txt`. Should restrict to `.context/` and `docs/` paths only.
4. **No mechanism to detect skill loading** — if someone loads a skill via `/skill:b-research` instead of the `/b-research` command, plan mode doesn't activate.

## Analysis

### Root Cause of the Problem

The user's problem is that b-research implements code mid-research. This can happen two ways:

1. **Plan mode doesn't activate** — if the skill was loaded via `/skill:b-research` instead of the `/b-research` command prompt template, the extension hook never fires and plan mode never enables.
2. **Plan mode activates but is too permissive** — the `.md`/`.txt` extension allowlist means the model can write to source-adjacent markdown files. And more importantly, **write/edit guards only work for write and edit tools** — they don't prevent the model from using bash to write files (though redirects are blocked).

### Write Boundary Gaps

Current `isAllowedPlanWritePath` logic:
```
Path starts with ".context/" → allowed ✓
Path starts with "docs/" → allowed ✓
Path ends with ".md" → allowed ✗ (too broad)
Path ends with ".txt" → allowed ✗ (too broad)
```

Should be:
```
Path starts with ".context/" → allowed ✓
Path starts with "docs/" → allowed ✓
All other paths → blocked ✓
```

### Skill vs Command Activation

Pi skills can be activated two ways:
1. **Prompt template commands** (`/b-research`, `/b-plan`) — these go through the `registerCommand` handler in the extension, which triggers `enablePlanMode()`.
2. **Direct skill loading** (`/skill:b-research`) — these don't trigger any command handler. The skill is loaded as instructions but the extension is unaware.

For the MVP, we should focus on **ensuring the command path works correctly** since that's the primary user flow. The `/skill:` path is an edge case that can be addressed later if needed.

## Recommended Changes

### Change 1: Add grill commands to `PLAN_MODE_COMMANDS`

**File**: `extensions/index.ts`
**Line**: `const PLAN_MODE_COMMANDS = ["b-plan", "b-brainstorm", "b-research"];`

Add `b-grill-me` and `b-grill-with-docs`:
```typescript
const PLAN_MODE_COMMANDS = ["b-plan", "b-brainstorm", "b-research", "b-grill-me", "b-grill-with-docs"];
```

This requires prompt template files to exist so the commands are registered.

### Change 2: Create prompt templates for grill commands

**Files**: `prompts/b-grill-me.md`, `prompts/b-grill-with-docs.md`

Follow the existing pattern from `prompts/b-research.md`:
```markdown
---
name: /b-grill-me
description: Relentlessly stress-test a plan or design through structured interviewing
---

Load and follow the `b-grill-me` skill:

```
skills/b-grill-me/SKILL.md
```
```

### Change 3: Tighten `isAllowedPlanWritePath`

**File**: `extensions/index.ts`
**Function**: `isAllowedPlanWritePath()`

Remove the extension-based allowlist. Only allow paths under `.context/` and `docs/`:

```typescript
function isAllowedPlanWritePath(path: string): boolean {
  const normalizedPath = path.replace(/^\.\//, "").replace(/\/$/, "");
  for (const allowedPath of PLAN_MODE_ALLOWED_PATHS) {
    const normalizedAllowed = allowedPath.replace(/\/$/, "");
    if (normalizedPath.startsWith(normalizedAllowed) || normalizedPath === normalizedAllowed) {
      return true;
    }
  }
  return false;
}
```

Remove `PLAN_MODE_ALLOWED_EXTENSIONS` constant since it's no longer needed.

### Change 4: Update system prompt message

Update the `before_agent_start` injected instructions to reflect the tighter scope:
- Remove ".md and .txt files" from allowed writes
- Keep `.context/` and `docs/` only

## Risks

| Risk | Mitigation |
|------|------------|
| Grill commands are skills loaded via `/skill:` not commands — prompt template won't trigger | Create prompt templates so `/b-grill-me` and `/b-grill-with-docs` work as commands |
| Tighter path restriction blocks legitimate writes to README.md | README.md changes aren't research/plan artifacts; if needed, the user can exit plan mode first |
| `docs/` directory may not exist in all projects | Guard already only activates when `.context/` exists |
| Bash tool can still create files via `touch`, `cp`, `mv` | Redirect pattern blocks `>` and `>>`; `touch`/`cp`/`mv` would be caught by AI review |

## Key Files

- `extensions/index.ts` — Plan mode implementation (lines 32-750)
- `skills/b-research/SKILL.md` — Research skill with write boundary
- `skills/b-plan/SKILL.md` — Plan skill with write boundary
- `skills/b-grill-me/SKILL.md` — Grill skill (no write boundary!)
- `skills/b-grill-with-docs/SKILL.md` — Grill with docs skill (no write boundary!)
- `prompts/b-research.md` — Research prompt template (exists)
- `prompts/b-plan.md` — Plan prompt template (exists)

## Unknowns

1. Are there other commands that should be in `PLAN_MODE_COMMANDS`? (b-brainstorm is already there.)
2. Should the write boundary also block writes to `.context/workflow/` state files (e.g., `current-session.json`)? Currently allowed since it's under `.context/`.
3. Should `b-review` disable plan mode? It's already in `MODEL_SWITCH_COMMANDS` but not `IMPLEMENTATION_COMMANDS`.

## Recommended Next Step

→ `b-plan` — Create a plan to implement these 4 changes. The changes are small and well-scoped; this could also go straight to `b-build`.
