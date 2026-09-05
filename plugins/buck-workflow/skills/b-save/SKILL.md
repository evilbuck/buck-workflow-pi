---
name: b-save
description: Record session history — checkpoint memory, backlog, cross-references, and optional OMP retain
triggers:
  - /b-save
---

# b-save: Session Record Checkpoint

Record the current session's work into durable `.context/` artifacts. Optionally mirror key facts into OMP native memory (`retain` / `learn`) when those tools exist. Run at natural stopping points and at session end.

## When to Use

- End of a work session (before closing the agent or switching tasks)
- After completing a plan, build, or review phase
- Before yielding an OMP execution session
- Any time you want durable state that survives context compaction

## How It Works

`/b-save` is a pure prompt — no extension backing. The prompt body lives at `prompts/b-save.md` and is exposed as a slash command in both Pi (via `prompts/`) and OMP (via the `commands/b-save.md` symlink).

When invoked, the LLM receives the prompt instructions and executes them directly. No extension coordination or state injection is required.

## The 12 Responsibilities

1. **Read Session State** — Read `.context/workflow/current-session.json` for context
2. **Subject Folder** — Create if missing; consolidate loose artifacts
3. **Memory Creation** — Create/update session memory file with proper frontmatter
4. **Cross-Reference Stitching** — Back-fill `memory:` arrays in plan/spec files
5. **Backlog Update** — Mark completed items, add new/deferred items
6. **Spec Status Updates** — Set `status: completed` on finished specs
7. **Index Update** — Update `.context/memory/index.md` with entry at top
8. **Native agent memory (OMP only)** — If running in OMP and `retain` is available, retain 1–N self-contained session facts (decisions, conventions, risks, paths). If only `learn` exists, learn one reusable lesson. Skip when neither tool exists or not in OMP. Do not call Hindsight HTTP; do not run full `b-memory-import` on routine saves.
9. **Memory skill re-index (non-OMP, optional)** — Best-effort only when a memory skill is configured in the project's `AGENTS.md` and the agent is not OMP; never required; failures must not block save
10. **Phase State Consolidation** — Verify phased plan file states match reality
11. **Iterate Artifact Consolidation** — Verify and update iterate artifact states
12. **User Goal Check** — Scan plan and brainstorm artifacts in the active subject. If any lack a `## User Goal` section and have no `Technical chore — <reason>` waiver, warn the user. Do not block.

## Two memory layers

| Layer | Role |
|-------|------|
| `.context/memory/*.md` | Git-portable, reviewable session record (required) |
| OMP `retain` / `learn` | Harness LTM for next-session recall (optional mirror) |

Bulk seed of existing markdown into Hindsight: `skills/b-memory-import` (deterministic script), not this skill.

## Key Principle

Plans live in subject folders (intent). History lives in `.context/memory/` (record). `/b-save` turns intent into record, then optionally mirrors into harness memory.


## Commit Integration

`/b-save` prepares durable context (memory, backlog, draft commit material) for `/b-commit`, but does not commit itself. The standard completion sequence is:

```
/b-review → /b-iterate (if in-plan issues) → /b-docs (if doc impact) → /b-save → /b-commit
```

Out-of-plan findings (new scope beyond the plan) do not iterate — close accepted work, then start a separate `/b-plan` → `/b-build`.

Run `/b-save` before `/b-commit` so that memory and draft-commit artifacts are included in the commit.

## Related

- `prompts/b-save.md` — the prompt body executed when `/b-save` is invoked
- `skills/b-memory-import/SKILL.md` — bulk `.context/memory` → Hindsight import
- `skills/b-build/SKILL.md` — recommends `/b-save` at session end
- `skills/b-review/SKILL.md` — recommends `/b-save` after review
- Global AGENTS.md — defines memory frontmatter, backlog, and cross-reference conventions
