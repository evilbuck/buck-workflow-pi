---
status: active
date: 2026-05-31
subject: 2026-05-31.subject-selection-prompting
topics: [subjects, prompting, selection, tui, convention, skills]
---

# Plan: Subject Selection Prompting for b-* Commands

## What we might build

A convention-driven mechanism so that when any `b-*` skill is invoked without arguments or context, the agent **scans `.context/` for subject folders** and **presents a selection to the user** before proceeding. This replaces the current behavior where each skill independently implements its own context resolution with varying depth.

Additionally, for phased plans, the user should be presented with a phase selection (active/pending phases) alongside or after subject selection.

The goal is **speed and token efficiency** — by convention, not by adding runtime infrastructure.

## Why it matters

1. **Current problem**: Running `/b-build` with no arguments triggers a multi-step resolution scan inside the skill (check session state → scan subject folders → check flat dirs → check backlog). Each skill duplicates this. The agent burns tokens reading `current-session.json`, scanning directories, reading plan files, and often still guesses wrong.

2. **User experience**: The user knows which subject they want. Making them type a full path is friction. Presenting a numbered list and letting them pick `2` is fast and unambiguous.

3. **Token savings**: A short selection menu (5-10 items) costs ~200 tokens. A full context resolution scan (reading session state, scanning 15+ subject folders, reading frontmatter) costs ~2,000-5,000 tokens. This is a 10-25x savings per invocation.

## What exists today

### Current context resolution (per-skill, duplicated)

Every b-* skill implements its own variant of this resolution chain:

```
1. Explicit argument → use it
2. Session state (current-session.json) → active subject
3. All subject folders → scan for active plans/phases/iterates
4. Flat directories (legacy) → .context/plans/, .context/specs/active/
5. Backlog → .context/backlog/todo.md
```

This chain runs at the start of every `/b-build`, `/b-plan`, `/b-review`, `/b-iterate`, etc.

### Existing infrastructure

- **`extensions/b-flow/scan-context.ts`**: Already scans `.context/` for subjects, plans, phases, tasks, iterates, backlog items. Returns structured `ScanResult` with typed `ArtifactRef` objects.
- **`extensions/b-flow/queue-builder.ts`**: Builds work queues from scanned artifacts.
- **`extensions/index.ts`**: Tracks session state in `.context/workflow/current-session.json`, including `memory_file`, `files_modified`, `buck_workflow_mode_active`.
- **Subject folder convention**: `YYYY-MM-DD.<kebab-slug>/` with standardized artifacts inside.
- **Global AGENTS.md** (`~/.pi/agent/AGENTS.md`): Already defines the "Three Universal Statuses" convention (`draft`/`active`/`completed`) and "Subject-Level State (Derived)" rules. Managed by chezmoi at `~/.local/share/chezmoi/dot_pi/agent/AGENTS.md`.

### Key observation

The scanning logic already exists in `scan-context.ts`. The missing piece is a **convention for presenting the scan results to the user as a selection menu** at the skill level, rather than silently auto-resolving.

## Constraints / preferences

1. **Convention-driven, not infrastructure-driven**: This should work through skill instructions (SKILL.md files), not through new extension code or TUI dialogs. The agent reads the convention and follows it.
2. **Must work across all b-* skills**: b-build, b-plan, b-review, b-iterate, b-explore, b-research, b-brainstorm all need the same behavior.
3. **Skip when context is clear**: If the user provides an argument, or if there's only one active subject, or if session state already points to a subject — skip the menu entirely.
4. **Present phases when relevant**: If the selected subject has a phased plan, show phase options too.
5. **Numbered selection**: Present a numbered list. User types a number. No complex UI.
6. **Must be backward-compatible**: Existing subject folders, legacy flat dirs, and old session state all need to keep working.
7. **Agent stops and waits**: After presenting the selection menu, the agent stops and waits for the user to respond before proceeding. No timeout, no default selection.

## Subject Status: Declarative and Concrete

### Relying on existing convention

The global AGENTS.md already defines **Three Universal Statuses** and **Subject-Level State (Derived)**:

> A subject is:
> - **active** → at least one entity is `draft` or `active`
> - **completed** → all entities are `completed`

This is the right convention. The problem: it requires reading all artifact frontmatter to derive status. For the selection menu, we need a faster signal.

### Proposal: `index.md` status field

Every subject folder already has `index.md` (created by b-brainstorm, b-research, b-explore). Add a top-level `status:` field to `index.md` frontmatter:

```yaml
---
status: active          # draft | active | completed
date: 2026-05-31
subject: 2026-05-31.subject-selection-prompting
---
```

**Status rules:**

| index.md `status:` | Meaning | When shown in menu |
|--------------------|---------|--------------------|
| `draft` | Brainstorm/research in progress, no plan yet | Always (if `--all`) or when no active subjects exist |
| `active` | Plan/spec exists or work is in progress | Always |
| `completed` | All work done, plan/spec marked completed | Only with `--all` or when user selects "show completed" |

**Derivation is explicit, not inferred.** The skill that creates or updates artifacts in the subject folder is responsible for updating `index.md` status:

- `b-brainstorm` creates index.md with `status: draft`
- `b-plan` or `b-research` sets `status: active` when writing the first plan/research artifact
- `b-review` or `b-save` sets `status: completed` when all artifacts in the folder are completed

**Missing `index.md` fallback**: If `index.md` is absent or has no `status:` field, derive from artifact scan (the existing convention). This handles legacy subjects created before this change.

**Stale status — lazy verification on selection**: The menu trusts `index.md` status for speed. But once the user picks a subject, the skill reads only the `status:` lines from artifacts inside that folder. If all artifacts say `completed` but `index.md` says `active`, the skill:
1. Corrects `index.md` to `completed` (self-healing)
2. Notifies the user: "Subject was already completed. Re-showing menu."
3. Re-runs the selection

This costs ~3-5 extra single-line reads (only the selected subject), not a full scan. The first agent to notice staleness fixes it. Every subsequent invocation is correct.

### What needs updating in chezmoi

The global AGENTS.md (`~/.local/share/chezmoi/dot_pi/agent/AGENTS.md`) needs a small addition in the **Subject-Level State (Derived)** section:

```markdown
### Subject-Level State

A subject folder's `index.md` carries an explicit `status:` field:
- `draft` — brainstorm/research in progress
- `active` — plan/spec exists, work underway or available
- `completed` — all objectives met

Skills that create or modify artifacts must update `index.md` status accordingly.
If `index.md` is absent or has no `status:`, derive from artifact frontmatter as before.
```

This is additive — no existing convention changes, just adds an explicit status signal.

## Proposed Convention: "Subject Resolution Protocol"

A shared protocol section that gets included in (or referenced by) every `b-*` SKILL.md.

### The Protocol

```
## Subject Resolution Protocol

When invoked without arguments or explicit context, apply this protocol
BEFORE beginning skill-specific work. This REPLACES any existing
"Context Resolution" or "Scope Resolution" section in the skill.

### Step 1: Check for explicit context
If the user provided a path, subject name, or inline description — use it.
Skip to skill work.

### Step 2: Check for b-flow session
If `.context/workflow/orchestration.json` exists with a `currentState`
that is not `idle`, `done`, or `aborted` — b-flow is managing this session.
Use the b-flow subject. Skip to skill work.

### Step 3: Check session memory for subject
Read `.context/workflow/current-session.json`.
If it exists, extract the subject from the `memory_file` path:
  - Memory files follow the pattern `.context/memory/<topic>-YYYY-MM-DD.md`
  - Check the memory file's frontmatter for a `subject:` field
  - If the subject folder exists on disk → use it. Skip to Step 6.
  - If the subject folder does not exist → fall through to Step 4.

### Step 4: Scan subject folders
List all `.context/YYYY-MM-DD.*/` directories.
For each, read ONLY the `status:` line from `index.md` frontmatter.
If `index.md` is missing, classify as `active` (legacy compat).

### Step 5: Present selection (if needed)
Filter to subjects with `status: active` (or `draft` if no active subjects).
If zero subjects → proceed with skill as starting fresh.
If exactly one subject → use it silently. Log: "Auto-selected: <subject>"
If multiple subjects → STOP and present numbered menu. WAIT for user input.

```
Subjects found. Which one are you working on?

1. b-flow-sdk-redesign (05-30) — phase 2/3
2. cwd-restrict-mode (05-30) — plan
3. b-research-b-explore-split (05-20) — research
4. ralph-loop-plan-phase (05-19) — phased
5. Other (describe what you want to work on)
```

After user picks, proceed with that subject.

### Step 6: Phase selection (if phased)
If the subject has `plan-*-phases.md`, read only phase filenames + their
`status:` frontmatter line.
If exactly one non-completed phase → use it silently.
If multiple non-completed phases → STOP and present menu. WAIT for user input.

```
Subject: b-flow-sdk-redesign
Phased plan found. Which phase?

1. Phase 2: SDK Worker Core — medium — [in-progress]
2. Phase 3: Test Coverage — easy — [pending]
3. All phases (sequential execution)
```

### Step 7: Proceed with skill work
Subject (and optionally phase) are now resolved.
Continue with the skill's specific behavior.
```

### Where to put it

**Create `skills/_shared/subject-resolution.md`** with the protocol above.
Each SKILL.md replaces its existing "Context Resolution" / "Scope Resolution" section with:

```markdown
## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for all downstream artifact discovery.
If the protocol finds no subject, proceed as a fresh session.
```

### Why shared file, not inline

- Single source of truth. The protocol is 30 lines. Duplicating across 9 skills creates drift risk.
- Agents (Pi, Claude Code) can follow cross-file references in skill instructions.
- If an agent can't follow the reference, the skill author copies it in (fallback to inline).

### Menu Format Convention

**Subject menu** — one line per subject:
```
N. <subject-slug> (<MM-DD>) — <artifact-summary>
```

Artifact summary is derived from filenames only (no full reads):
- Has `plan-*-phases.md` + `phase-N-*.md` → `"phase N/M"` where N is first non-completed
- Has `plan-*.md` → `"plan"`
- Has `iterate-*.md` → `"iteration pending"`
- Has `research-*.md` only → `"research"`
- Has `brainstorm-*.md` only → `"brainstorm"`

**Phase menu** — one line per phase:
```
N. Phase N: <name> — <difficulty> — [<status>]
```

Phase name and difficulty come from the frontmatter line, not the full file.

## How the scan works (token-efficient)

The scan reads **only filenames + one frontmatter line per file**:

```bash
# Step 1: List subjects and their index.md status
for d in .context/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].*/; do
  name=$(basename "$d")
  status=$(head -5 "${d}index.md" 2>/dev/null | grep '^status:' | head -1 | sed 's/status: *//')
  [ -z "$status" ] && status="active"  # legacy compat
  # Classify by artifacts
  if ls "${d}"plan-*-phases.md >/dev/null 2>&1; then
    echo "$name|$status|phased"
  elif ls "${d}"plan-*.md >/dev/null 2>&1; then
    echo "$name|$status|plan"
  elif ls "${d}"iterate-*.md >/dev/null 2>&1; then
    echo "$name|$status|iteration"
  elif ls "${d}"research-*.md >/dev/null 2>&1; then
    echo "$name|$status|research"
  elif ls "${d}"brainstorm-*.md >/dev/null 2>&1; then
    echo "$name|$status|brainstorm"
  else
    echo "$name|$status|empty"
  fi
done
```

Output for 20 subjects: ~20 lines, ~400 tokens. vs reading 20 plan files: ~10,000+ tokens.

For phase status (only if phased plan selected):
```bash
for f in .context/<subject>/phase-N-*.md; do
  status=$(head -10 "$f" | grep '^status:' | head -1 | sed 's/status: *//')
  difficulty=$(head -10 "$f" | grep '^difficulty:' | head -1 | sed 's/difficulty: *//')
  goal=$(head -10 "$f" | grep '^goal:' | head -1 | sed 's/goal: *//')
  echo "$(basename "$f")|$status|$difficulty|$goal"
done
```

## Skills that need updating

| Skill | Section to replace | Change |
|-------|-------------------|--------|
| `b-build` | "Context Resolution" (lines 222-239) | Replace with `skills/_shared/subject-resolution.md` reference |
| `b-iterate` | "Context Resolution" (lines 13-21) | Same |
| `b-review` | "Scope Resolution" (lines 29-36) | Same |
| `b-plan` | "Context Resolution Protocol" (lines 43-56) | Same |
| `b-explore` | No existing resolution | Add reference |
| `b-research` | No existing resolution | Add reference |
| `b-brainstorm` | "Resume Behavior" (lines 76-98) | Add menu when multiple matches |
| `b-phase` | "Input" section (line 24) | Add reference before reading plan |

**Key point**: The Subject Resolution Protocol **replaces** the per-skill resolution chains. Skills no longer implement their own scanning logic. They delegate to the shared protocol and receive back a resolved subject + optional phase.

## Edge cases

1. **No subjects exist**: Skip the menu entirely. Proceed with the skill as if starting fresh.
2. **Only one subject**: Use it silently. Log what was auto-selected.
3. **User provides "new"**: If user selects "Other" or says "new", the skill creates a fresh subject folder.
4. **Legacy flat directories**: If no subject folders exist but `.context/plans/` does, offer those as options.
5. **Subject with no plan**: Still show them — the user might want to continue exploration or formalize.
6. **Cross-project sessions**: `current-session.json` might reference a subject from a different project. If the folder doesn't exist in the current project, fall through to scanning.
7. **No `index.md`**: Legacy subjects without `index.md` get `status: active` (safe default — shows in menu).
8. **`memory_file` has no `subject:` frontmatter**: Fall through to scanning. Don't block on missing metadata.
9. **`index.md` status is stale** (says `active`, all artifacts `completed`): Lazy verification on selection catches this — self-heals, re-shows menu.

## Token budget analysis

| Approach | Token cost | When used |
|----------|-----------|-----------|
| Full context resolution (current) | ~2,000-5,000 | Every invocation |
| Subject menu + user selection | ~200-400 | Only when ambiguous |
| Single subject auto-select | ~100 | Only when one subject |
| Explicit argument | ~0 | User provides path |

Savings: 80-95% on ambiguous invocations. The menu only appears when needed.

## Open questions

1. **Should completed subjects appear in the menu?**
   - Show only `active` and `draft` by default.
   - Add option `5. Show completed subjects` at the bottom of the menu.
   - If the user selects this, re-show the menu with completed subjects included.

2. **Should the extension pre-compute the subject list?**
   - No. The bash scan is fast (~50ms for 20 subjects). No caching needed.

3. **Should b-brainstorm also show existing subjects?**
   - Yes. The user might want to resume or add to an existing subject.
   - "Other" option starts fresh.

4. **How does this interact with b-flow?**
   - b-flow manages its own state machine. The protocol checks for b-flow first (Step 2).
   - If b-flow is active, skip the menu entirely — b-flow already knows the subject.

5. **What about subjects from the `b-review-b-phase` or `test-*` backlog items?**
   - These don't have subject folders (they're backlog items, not subjects).
   - They won't appear in the menu. The user would need to invoke the skill with the backlog item path explicitly, or select "Other" and describe the work.

## Brainstorm notes

- **Key insight**: convention over infrastructure. We don't need a new extension. We need a shared instruction block that all skills reference.
- The `scan-context.ts` code already does the heavy lifting for b-flow. Skills don't use it directly — they follow the protocol convention.
- **This is a documentation + convention change**, not a code change. The implementation is:
  1. Create `skills/_shared/subject-resolution.md`
  2. Update 8 SKILL.md files to reference it
  3. Update global AGENTS.md to codify `index.md` status field
  4. Update chezmoi source for the AGENTS.md change
- The phase selection sub-menu follows the same pattern: scan → present → user picks → proceed.
- For agents that don't support interactive menus (unlikely with pi/omp), the convention degrades gracefully: the agent lists subjects and asks "which number?" in natural language. The user responds in chat. No special TUI needed.
- **Step 3 (session memory)** is tightened from the original draft. Instead of guessing the subject from the `memory_file` path (which was unreliable), we read the memory file's `subject:` frontmatter field. This is explicit and already part of the memory frontmatter convention defined in global AGENTS.md.