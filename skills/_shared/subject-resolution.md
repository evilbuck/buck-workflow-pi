# Subject Resolution Protocol

Shared protocol for all b-* skills. Replaces any existing "Context Resolution" or "Scope Resolution" section in individual skill files.

## When to Apply

Apply this protocol **before** beginning skill-specific work when invoked without arguments or explicit context.

## Step 1: Check for Explicit Context

If the user provided a path, subject name, or inline description — use it. Skip to Step 7.

## Step 2: Check for b-flow Session

If `.context/workflow/orchestration.json` exists with a `currentState` that is not `idle`, `done`, or `aborted` — b-flow is managing this session. Use the b-flow subject. Skip to Step 7.

## Step 3: Check Session Memory for Subject

Read `.context/workflow/current-session.json`. If it exists, extract the subject from the `memory_file` path:
- Memory files follow the pattern `.context/memory/<topic>-YYYY-MM-DD.md`
- Check the memory file's frontmatter for a `subject:` field
- If the subject folder exists on disk → use it. Skip to Step 7.
- If the subject folder does not exist → fall through to Step 4.

## Step 4: Scan Subject Folders

List all `.context/YYYY-MM-DD.*/` directories. For each, read **only** the `status:` line from `index.md` frontmatter. If `index.md` is missing, classify as `active` (legacy compat).

**Artifact classification** (from filenames only — no full reads):

| Filename pattern | Classification |
|------------------|---------------|
| `plan-*-phases.md` + `phase-N-*.md` | `"phase N/M"` where N is the active phase: single `in-progress`, else first non-completed |
| `plan-*.md` | `"plan"` |
| `iterate-*.md` | `"iteration pending"` |
| `review-pass-*.md` | `"review-pass present"` (informational; does not select subject alone) |
| `research-*.md` only | `"research"` |
| `brainstorm-*.md` only | `"brainstorm"` |
| No recognized artifacts | `"active"` |

## Step 5: Present Selection (If Needed)

Filter to subjects with `status: active` (or `draft` if no active subjects).

- **Zero subjects** → proceed with skill as starting fresh.
- **Exactly one subject** → use it silently. Log: "Auto-selected: `<subject>`".
- **Multiple subjects** → **STOP and present numbered menu. WAIT for user input.**

```
Subjects found. Which one are you working on?

1. b-flow-sdk-redesign (05-30) — phase 2/3
2. cwd-restrict-mode (05-30) — plan
3. subject-selection-prompting (05-31) — brainstorm
4. Other (describe what you want to work on)
```

After user picks, proceed with that subject.

## Step 6: Phase Selection (If Phased)

If the subject has `plan-*-phases.md`, read only phase filenames + their `status:` frontmatter line. Apply the shared lifecycle rule from `skills/_shared/lifecycle-artifacts.md`:

1. **Exactly one `in-progress` phase** → use it silently (outranks any later `pending`).
2. **Multiple `in-progress` phases** → **STOP and present numbered menu. WAIT for user input.**
3. **No `in-progress`, exactly one non-completed (`pending`) phase** → use it silently.
4. **Multiple non-completed without a single `in-progress`** → **STOP and present numbered menu. WAIT for user input.**

```
Subject: b-flow-sdk-redesign
Phased plan found. Which phase?

1. Phase 2: SDK Worker Core — medium — [in-progress]
2. Phase 3: Test Coverage — easy — [pending]
3. All phases (sequential execution)
```

Never auto-select a later `pending` phase while an earlier or sibling phase remains `in-progress`.

## Step 7: Proceed with Skill Work

Subject (and optionally phase) are now resolved. Continue with the skill's specific behavior.

## Status Field Convention

Every subject folder's `index.md` carries an explicit `status:` field:

| Status | Meaning | When shown in menu |
|--------|---------|-------------------|
| `draft` | Brainstorm/research in progress, no plan yet | Only when no active subjects exist |
| `active` | Plan/spec exists, work underway or available | Always |
| `completed` | All objectives met | Never (use `--all` to include) |

**Who sets the status:**
- `b-brainstorm` / `b-research` / `b-explore` → `status: draft` when creating the subject folder
- `b-plan` → `status: active` when writing the first plan artifact
- `b-save` → `status: completed` when all artifacts are completed

**Legacy fallback:** If `index.md` is absent or has no `status:` field, derive from artifact frontmatter. Classify as `active` if any artifact has `status: draft` or `active`.
