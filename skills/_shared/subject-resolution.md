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
- Check the memory file's frontmatter for a `subject:` field.
- If that subject folder exists, run `bun skills/_shared/scripts/subject-lifecycle.ts inspect --subject <folder> --json`. Reuse the pointer only when `effectiveState` is `active` or `draft`; closed or malformed pointers fall through to Step 4.
- If the subject folder does not exist, fall through to Step 4.

## Step 4: Scan Subject Folders

List all `.context/YYYY-MM-DD.*/` directories. Inspect each with `bun skills/_shared/scripts/subject-lifecycle.ts inspect --subject <folder> --json`; use `effectiveState` and fail closed on malformed provenance.

**Artifact classification** (from filenames only — no full reads):

| Filename pattern | Classification |
|------------------|---------------|
| `plan-*-phases.md` + `phase-N-*.md` | `"phase N/M"` where N is first non-completed |
| `plan-*.md` | `"plan"` |
| `iterate-*.md` | `"iteration pending"` |
| `research-*.md` only | `"research"` |
| `notes/raw-capture-log.md` | `"capture"` |
| `brainstorm-*.md` only | `"brainstorm"` |
| No recognized artifacts | `"active"` |

## Step 5: Present Selection (If Needed)

Filter to subjects whose inspected `effectiveState` is `active` (or `draft` if no active subjects).

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

If the subject has `plan-*-phases.md`, read only phase filenames + their `status:` frontmatter line.

- **Exactly one non-completed phase** → use it silently.
- **Multiple non-completed phases** → **STOP and present numbered menu. WAIT for user input.**

```
Subject: b-flow-sdk-redesign
Phased plan found. Which phase?

1. Phase 2: SDK Worker Core — medium — [in-progress]
2. Phase 3: Test Coverage — easy — [pending]
3. All phases (sequential execution)
```

## Step 7: Proceed with Skill Work

Subject (and optionally phase) are now resolved. Continue with the skill's specific behavior.

## Status Field Convention

The compatible `status:` scalar is a projection owned by
`skills/_shared/scripts/subject-lifecycle.ts`. Callers express intent through:

| Intent | Legal transition |
|--------|------------------|
| `initialize` | missing → draft |
| `activate` | draft → active |
| `close-verified` | active → completed after internal evidence verification |
| `reopen --reason <text>` | completed → active after explicit confirmation |

Never write lifecycle fields directly. Use `inspect --json` for selection.
Legacy metadata is interpreted by the authority; verified-closed legacy subjects
are excluded from reuse until `close-verified` canonicalizes them.
