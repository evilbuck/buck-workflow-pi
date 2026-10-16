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

`skills/b-save/SKILL.md` is the canonical `/b-save` procedure. The thin
`prompts/b-save.md` loader exposes it as a slash command in Pi; OMP follows the
`commands/b-save.md` symlink to that same loader. There is no extension backing.

When invoked, load this skill and execute all 12 responsibilities below. No
extension coordination or state injection is required.

Before running the responsibilities, resolve `SUBJECT_LIFECYCLE` to the absolute
path `../_shared/scripts/subject-lifecycle.ts` relative to this loaded
`SKILL.md`. Never resolve the helper from the session project's working directory.


## Durable memory writes

Follow `skills/_shared/workflow-state-access.md`. Write reusable facts with `workflow_state` `write` (`kind: memory`) and corrections with `correct`. Do not call `sql_memory` or construct SQL. The tool binds project and branch and returns a revision id. Do not require a physical `.context/memory/` path.

Do not create or update `.context/memory/` files or `.context/memory/index.md` as a second canonical store. Backlog, phase, spec, and subject-lifecycle duties still run through the same artifact surface.

When the supervisor supplies a directive, it names `attemptId`, `runId`, `subject`, `project`, `phase`, `receipt`, and the exact fact/apply commands. That directive owns one persisted attempt. Treat the responsibilities below as inputs to its metadata payload, not instructions for separate manual writes.

1. Collect reusable facts/corrections and run the directive's `facts` command with its exact attempt ID. Use `[]` only when no reusable fact exists. The helper persists facts and returns verified `receipt.path` and `receipt.ids`; do not write independent facts or receipts alongside it.
2. Run the associated `save-preflight.ts --subject <subject>` from the owning checkout. Preserve its canonical `storage_snapshot` unchanged for conditional metadata updates. Missing checkout exports are not a missing store.
3. Assemble the normal `save-apply.ts` JSON payload from preflight, consolidated narrative/backlog changes, and verified completion decisions. Include that snapshot and the returned path/IDs in `sql_receipt`. Do not create `.context/memory` bodies/index entries in this mode.
4. Run the directive's apply command. It seals metadata, moves/deletions and lifecycle duties, then completes and reads back the same durable receipt. Any fact, metadata, receipt or readback failure blocks save success.
5. Never manually stamp `completed: true` on local JSON, issue a read-back SELECT, or manufacture missing duty evidence. Only the helper's exact complete-receipt readback authorizes completion. Do not record database URLs, passwords or connection strings.

## The 12 Responsibilities

1. **Read Session State** — Read `.context/workflow/current-session.json` for context.
2. **Subject Folder** — Inspect with `bun "$SUBJECT_LIFECYCLE" inspect --subject <folder> --json`. If missing, create the folder and invoke `initialize`, then immediately inspect again and retain the refreshed state. Consolidate loose artifacts without editing lifecycle fields.
3. **Memory Facts** — Consolidate the session's reusable facts with the required frontmatter; use the directive's fact/metadata payload when present, otherwise the native artifact surface above:

   ```yaml
   ---
   date: YYYY-MM-DD
   domains: [tooling, refactor]
   topics: [keyword, list]
   subject: YYYY-MM-DD.subject-name
   artifacts: [plan-file.md]
   related: []
   priority: high
   status: active
   ---
   ```

4. **Cross-Reference Stitching** — Back-fill `memory:` arrays in plan/spec files in file mode; in SQL mode, back-fill `sql_memory_ids:` arrays from verified receipt IDs instead of nonexistent Markdown paths.
5. **Backlog Update** — Read `.context/backlog/todo.md` (legacy fallback: `.context/backlog.md`).
   - For explicitly completed items: remove the item from `todo.md`; set its item file to `status: completed` and `completed: YYYY-MM-DD`; move it to `archive/YYYY-MM/<slug>.md`; add a summary to `archive/completed.md`.
   - For new or deferred items: create `items/<slug>.md` and add a linked checkbox to `todo.md`.
   - Only auto-archive explicitly completed items. If completion is inferred, surface it for user decision.
6. **Spec Status Updates** — Set `status: completed` on finished specs; do not move them.
7. **Index Update** — Update retained references through the selected artifact surface, not a second `.context/memory/index.md` authority. A supervisor attempt delegates this metadata duty to apply.
8. **Native agent memory (OMP only)** — Mirror only exact publication-proven adapter revisions into harness LTM.
   - Scribe/session facts and branch-local revisions alone are not publication proof.
   - Without that proof, skip both `retain` and `learn`, even when the tools exist. The current save handoff supplies no publication proof.
   - Do not call the Hindsight HTTP API or run `b-memory-import` during a routine save; that skill is for bulk backfill.
9. **Memory skill re-index (non-OMP, optional)** — If running outside OMP and a memory skill is configured in the project's `AGENTS.md`, load it and follow its indexing protocol for `.context/memory`. This is best-effort; failures do not block `/b-save`. Skip when no memory skill is configured or when running in OMP.
10. **Phase State Consolidation** — If discrete phased plan files exist in the subject folder:
    a. Read all `phase-N-*.md` files and verify each `status` against its acceptance criteria.
    b. Read `plan-*-phases.md` and verify its summary table matches the phase files.
    c. If a phase says `in-progress` but all criteria are checked, set it to `completed` and add `completed_at: YYYY-MM-DD`.
    d. If the overview is stale, update it to match the phase file.
    e. Skip this responsibility for legacy single-file phased plans.
11. **Iterate Artifact Consolidation** — Scan the subject folder for `iterate-*.md` files:
    a. If the session modified files named by an active iterate artifact, verify its acceptance items are addressed.
    b. If work against an active iterate artifact is complete, set its `status: completed`.
    c. Include iterate filenames in the memory file's `artifacts:` array.
    d. If an iterate artifact references its source plan, back-fill that plan with `iterations: [iterate-<subject>.md]`.
12. **User Goal Check** — Scan plan and brainstorm artifacts in the active subject. If any lack a `## User Goal` section and have no `Technical chore — <reason>` waiver, warn the user without blocking.

After responsibilities 10 and 11 and all loose-artifact consolidation, finish
subject lifecycle last. Use the latest inspection result, including the required
re-inspection after `initialize`. If the current state is `draft` and plan work
exists, invoke `activate`; then invoke `close-verified`. Exit 2 is a semantic
refusal: report its blockers, retain every other saved artifact, leave lifecycle
open, and never fall back to direct `index.md` edits.

## Two memory layers

| Layer | Role |
|-------|------|
| `.context/memory/*.md` | Git-portable, reviewable session record (required) |
| OMP `retain` / `learn` | Harness LTM for next-session recall (optional mirror) |

Bulk seed of existing markdown into Hindsight: `skills/b-memory-import` (deterministic script), not this skill.

## Key Principle

Plans live in subject folders (intent). History lives in `.context/memory/` (record). `/b-save` turns intent into record, then optionally mirrors into harness memory.

## Write Scope

- Write durable files only under `.context/`.
- Responsibility 8 may also call harness memory tools (`retain` / `learn`) when available.

Execute all 12 responsibilities now.


## Commit Integration

`/b-save` prepares durable context (memory, backlog, draft commit material) for `/b-commit`, but does not commit itself. The standard completion sequence is:

```
/b-review → /b-iterate (if in-plan issues) → /b-docs (if doc impact; follows /b-howto when needed) → /b-howto (if only how-to impact) → /b-save → /b-commit
```

Out-of-plan findings (new scope beyond the plan) do not iterate — close accepted work, then start a separate `/b-plan` → `/b-build`.

Run `/b-save` before `/b-commit` so that memory and draft-commit artifacts are included in the commit.

## Related

- `prompts/b-save.md` — thin slash-command loader for this canonical skill
- `skills/b-memory-import/SKILL.md` — bulk `.context/memory` → Hindsight import
- `skills/b-build/SKILL.md` — recommends `/b-save` at session end
- `skills/b-review/SKILL.md` — recommends `/b-save` after review
- Global AGENTS.md — defines memory frontmatter, backlog, and cross-reference conventions
