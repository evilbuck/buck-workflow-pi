---
name: spec-progress
description: Extract and present in-progress specs from .context/ directory as a markdown table summary. Use with specs workflow in AGENTS.md.
---

# Spec Progress Skill

Extract and present in-progress specs from `.context/` directory as a markdown table summary.

## When to Use

When you need to understand the current state of specs/planning work:
- Starting a new session and want to see where work left off
- Before working on a feature that has a spec
- Checking what specs are currently in progress
- Reporting on project progress

## Workflow

### Step 1: Locate Specs

Check for specs in this order (resolution order):

1. **Subject folders** (primary): `.context/YYYY-MM-DD.*/spec-*.md`
2. **Legacy flat specs** (fallback): `.context/specs/active/*.md`

### Step 2: Scan for Active Specs

Find all spec files and filter to only those with:
- `status: active`
- `status: draft` (optionally include)

**Note:** Completed specs have `status: completed` in frontmatter (no separate archive/ directory needed).

### Step 3: Parse Frontmatter

For each in-progress spec, parse the YAML frontmatter to extract:
- `status` (active, draft, completed)
- `date` (creation date)
- `subject` (subject folder name)
- `topics`
- `type` (epic, prd, milestone)
- `priority`
- `dependencies`
- `plans` (linked plans)

### Step 4: Cross-Reference Backlog

If `.context/backlog/` exists (canonical):
- Read `.context/backlog/todo.md` for active items
- Find items whose `related:` paths reference the spec
- Note which items are active vs completed

If only `.context/backlog.md` exists (legacy):
- Find tasks linked to each in-progress spec (via `See: .context/YYYY-MM-DD.*/spec-...`)
- Note which tasks are pending vs completed

### Step 5: Output Markdown Table

Present the summary as a markdown table:

```markdown
## Specs Progress

| Spec | Subject | Type | Priority | Status | Dependencies |
|------|---------|------|----------|--------|--------------|
| [v1-auth-mvp](./2026-04-08.auth-feature/spec-v1-auth-mvp.md) | 2026-04-08.auth-feature | epic | high | active | none |
| [v2-payments](./2026-04-01.payment-integration/spec-v1-payments.md) | 2026-04-01.payment-integration | epic | medium | active | v1-auth-mvp |

### Linked Backlog Tasks

- [ ] Complete Phase 2 of auth feature
- [ ] Start payments implementation
```

### Edge Cases

**No specs found:**
```
No specs with status 'active' found in subject folders or specs/active/.
```

**Missing frontmatter fields:**
Use `-` for missing optional fields like `dependencies`.

## File Structure (Subject Folders)

```
.context/
├── 2026-04-08.auth-feature/
│   ├── research-oauth-providers.md
│   ├── plan-oauth-login.md
│   └── spec-v1-auth-mvp.md          # ← Spec here
├── 2026-04-01.payment-integration/
│   └── spec-v1-payments.md          # ← Spec here
└── specs/active/                     # ← Legacy fallback
    └── old-spec.md
```

## Example Output

### Basic Output

```markdown
## Specs Progress

| Spec | Subject | Type | Priority | Status | Dependencies |
|------|---------|------|----------|--------|--------------|
| [v1-auth-mvp](./2026-04-08.auth-feature/spec-v1-auth-mvp.md) | 2026-04-08.auth-feature | epic | high | active | none |
| [v1-payments](./2026-04-01.payment-integration/spec-v1-payments.md) | 2026-04-01.payment-integration | epic | medium | active | v1-auth-mvp |

### Linked Backlog Tasks

- [ ] Implement auth middleware (See: 2026-04-08.auth-feature/spec-v1-auth-mvp.md)
- [ ] Design payment API
```

### With Draft Status

```markdown
## Specs Progress

| Spec | Subject | Type | Priority | Status | Dependencies |
|------|---------|------|----------|--------|--------------|
| [v1-search](./2026-02-05.search-feature/spec-v1-search.md) | 2026-02-05.search-feature | epic | high | active | none |
| [v2-analytics](./2026-02-12.analytics/spec-v1-analytics.md) | 2026-02-12.analytics | epic | medium | draft | v1-search |

### Draft Specs

- **v1-analytics**: Still in drafting phase, depends on search completion
```
