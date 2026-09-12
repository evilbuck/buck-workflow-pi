---
name: deprecated-b-save
description: Prompt-driven session checkpoint fallback — the pre-engine /b-save workflow
triggers:
  - /deprecated-b-save
---

# deprecated-b-save: Prompt-driven session checkpoint

Unchanged prompt-driven `/b-save` workflow, kept as the cross-harness fallback. The deterministic OMP engine is `/b-save`.

## When to Use

- Harnesses without the OMP `/b-save` extension
- Compatibility with the twelve-step prompt contract

## How It Works

`/deprecated-b-save` is a pure prompt — no extension backing. The prompt body lives at `prompts/deprecated-b-save.md`.

When invoked, the LLM receives the prompt instructions and executes them directly.


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
/b-review → /b-iterate (if in-plan issues) → /b-docs (if doc impact; follows /b-howto when needed) → /b-howto (if only how-to impact) → /b-save → /b-commit
```

Out-of-plan findings (new scope beyond the plan) do not iterate — close accepted work, then start a separate `/b-plan` → `/b-build`.

Run `/b-save` before `/b-commit` so that memory and draft-commit artifacts are included in the commit.

## Related

- `prompts/deprecated-b-save.md` — prompt body for `/deprecated-b-save`
- `skills/b-save/SKILL.md` — deterministic OMP engine
- `skills/b-memory-import/SKILL.md` — bulk `.context/memory` → Hindsight import
- Global AGENTS.md — memory frontmatter, backlog, and cross-reference conventions
