---
status: active
date: 2026-05-31
subject: 2026-05-31.subject-selection-prompting
topics: [subjects, prompting, selection, convention, skills]
research: brainstorm-subject-selection-prompting.md
---

# Plan: Subject Selection Prompting for b-* Commands

## Goal

Add a convention-driven subject selection mechanism to all b-* skills. When invoked without arguments, skills scan `.context/` for subject folders and present a numbered menu — replacing the current per-skill duplicate resolution chains with a shared protocol.

## Context Used

- `brainstorm-subject-selection-prompting.md` — full design from b-brainstorm session

## Scope

### In scope

1. Create `skills/_shared/subject-resolution.md` with the shared protocol
2. Add `index.md status` field convention to global AGENTS.md (chezmoi)
3. Replace "Context Resolution" / "Scope Resolution" sections in 8 SKILL.md files with the shared reference
4. Update b-plan's subject folder creation to set initial `index.md status: draft`

### Out of scope

- No new extension code (this is purely convention/documentation)
- No changes to `scan-context.ts` or b-flow infrastructure
- No changes to existing subject folder contents (only new ones get the `status` field)
- No agent code changes — convention is followed via SKILL.md instructions

## Affected Files

### New files

| File | Purpose |
|------|---------|
| `skills/_shared/subject-resolution.md` | Shared Subject Resolution Protocol |

### Modified files

| File | Change |
|------|--------|
| `skills/b-plan/SKILL.md` | Replace "Context Resolution Protocol" (lines 41-56) with shared reference |
| `skills/b-build/SKILL.md` | Replace "Context Resolution" (lines 221-239) with shared reference |
| `skills/b-review/SKILL.md` | Replace "Scope Resolution" (lines 26-34) with shared reference |
| `skills/b-iterate/SKILL.md` | Replace "Context Resolution" (lines 10-21) with shared reference |
| `skills/b-explore/SKILL.md` | Add shared reference (no existing resolution section) |
| `skills/b-research/SKILL.md` | Add shared reference (no existing resolution section) |
| `skills/b-brainstorm/SKILL.md` | Add subject menu when detecting multiple existing subjects |
| `skills/b-phase/SKILL.md` | Add shared reference before reading plan |
| `~/.local/share/chezmoi/dot_pi/agent/AGENTS.md` | Add `index.md` status field convention |

## Implementation Steps

### Step 1: Create `skills/_shared/subject-resolution.md`

Write the shared Subject Resolution Protocol. This is a 50-line instruction block that replaces all per-skill resolution chains.

**Key elements:**
- Step 1: Explicit argument → skip
- Step 2: Check b-flow active session → skip if managed
- Step 3: Check session memory's `memory_file` for `subject:` frontmatter → use if folder exists
- Step 4: Scan subject folders, read only `index.md status:` line per folder
- Step 5: Present menu only if 2+ active subjects; auto-select if 1; skip if 0
- Step 6: Phase selection for phased plans (same pattern: 0 → skip, 1 → auto, 2+ → menu)
- Step 7: Proceed with skill work

**Menu format:**
```
Subjects found. Which one are you working on?

1. b-flow-sdk-redesign (05-30) — plan
2. cwd-restrict-mode (05-30) — plan
3. subject-selection-prompting (05-31) — brainstorm
4. Other (describe what you want to work on)
```

Artifact classification is by filename only (no full reads):
- `plan-*-phases.md` + `phase-*.md` → `"phase N/M"`
- `plan-*.md` → `"plan"`
- `iterate-*.md` → `"iteration pending"`
- `research-*.md` → `"research"`
- `brainstorm-*.md` → `"brainstorm"`

### Step 2: Update each SKILL.md

For each skill, replace the existing resolution section with:

```markdown
## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for all downstream artifact discovery.
If the protocol finds no subject, proceed as a fresh session.
```

**Skills with existing resolution (replace):**
- `b-plan`: Lines 41-56 "Context Resolution Protocol"
- `b-build`: Lines 221-239 "Context Resolution"
- `b-review`: Lines 26-34 "Scope Resolution"
- `b-iterate`: Lines 10-21 "Context Resolution"

**Skills without existing resolution (add new section):**
- `b-explore`: Add after "Subject Folder Creation" section
- `b-research`: Add after "Subject Folder Creation" section

**Skills needing behavior changes (more than just a reference):**
- `b-brainstorm`: Add menu logic in Step 1 (topic hint matches existing subject). Also update `index.md status: draft` on creation.
- `b-phase`: Add reference in "Input" section before reading plan. Also update plan file status to `active` when phases are created.

### Step 3: Add `index.md` status convention to AGENTS.md

Add to `~/.local/share/chezmoi/dot_pi/agent/AGENTS.md` under **Subject-Level State (Derived)**:

```markdown
### Subject-Level State

A subject folder's `index.md` carries an explicit `status:` field:
- `draft` — brainstorm/research in progress
- `active` — plan/spec exists, work underway or available
- `completed` — all objectives met

Skills that create or modify artifacts must update `index.md` status accordingly.
If `index.md` is absent or has no `status:`, derive from artifact frontmatter as before.
```

Also update the **b-plan** skill instruction to set `index.md status: draft` when first creating the subject folder.

### Step 4: Update subject folder creation in b-plan

Modify b-plan's "Subject Folder Creation" section to create `index.md` with `status: draft`:

```markdown
## Subject Folder Creation (Required)

Every b-plan session creates a subject folder. This is not opt-in.

1. **Infer subject name** from the conversation topic (kebab-case)
2. **Create dated folder**: `.context/YYYY-MM-DD.<subject-name>/`
3. **Create `index.md`** with `status: active` (plan now exists, work is underway)
4. **Write plan file inside**: `plan-<topic>.md`
```

Note: b-plan sets `status: active` (not draft) since the plan itself is the activation event. b-brainstorm and b-research set `status: draft`.

## Verification

1. **Draft review**: Read `skills/_shared/subject-resolution.md` — verify protocol covers all resolution cases
2. **Cross-reference check**: For each SKILL.md, verify the shared reference is inserted correctly and the old resolution text is removed
3. **AGENTS.md check**: Verify chezmoi source file has the new convention
4. **No-op test**: Invoke each skill with no arguments — verify behavior matches expected (menu when 2+ subjects, auto-select when 1, skip when 0)
5. **Phase menu test**: Create a phased plan, invoke b-build with no args — verify phase sub-menu appears when subject has 2+ non-completed phases
6. **Legacy compat**: A subject folder without `index.md` still appears in menu (defaults to `active`)

## Risks

1. **Stale status**: If `index.md status:` says `active` but all artifacts are `completed` — the lazy verification on selection self-heals. Low risk.
2. **Edge case: no `index.md`**: Existing subject folders without `index.md` default to `active`. Backward compatible.
3. **Agent doesn't follow shared reference**: If an agent (Pi, Claude Code) can't follow cross-file references, the skill author copies the protocol inline. Low risk — fallback exists.

## Dependencies

- None. This is purely a documentation/convention change.
- No code changes to extensions, b-flow, or any runtime infrastructure.
