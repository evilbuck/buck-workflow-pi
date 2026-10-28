---
status: completed
phase: 3
order: 3
plan: plan-git-cleanup.md
phases_overview: plan-git-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Publish git-cleanup as the only delete procedure, and redirect git-clean-orphans to that contract."
files:
  - skills/git-cleanup/SKILL.md
  - prompts/git-cleanup.md
  - commands/git-cleanup.md
  - skills/git-clean-orphans/SKILL.md
  - prompts/git-clean-orphans.md
  - README.md
  - docs/buck-workflow.md
from_plan_steps: [8, 9, 10]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] `skills/git-cleanup/SKILL.md` is model-invoked. It loads `skills/git-cleanup/scripts/classify.ts`, runs it without `--apply`, prints the deleted-set preview and the ask list, then runs `--apply` unless the argument is `dry-run`."
  - "[x] The skill stops and waits on the ask list. It does not delete an ask-list item in the same turn as classify unless the user already answered keep or delete for that item."
  - "[x] The skill forbids the agent from constructing `git branch -D` or `git worktree remove --force` itself. Deletes go through the script."
  - "[x] `prompts/git-cleanup.md` is a thin wrapper that loads the skill. `commands/git-cleanup.md` is a symlink to `../prompts/git-cleanup.md`."
  - "[x] `skills/git-clean-orphans/SKILL.md` and `prompts/git-clean-orphans.md` contain no second delete procedure. Both load `git-cleanup`. The first lines state that proven-landed clean branches are deleted without the old confirmation pause, and that a path outside the repo parent is no longer a skip."
  - "[x] README skills-catalog row and `docs/buck-workflow.md` mapping row (near line 74), quick-reference row (near line 497), and the `/git-clean-orphans` section (near line 1824) describe the new contract for both names. The sentence 'destructive steps gated on confirmation' is gone for that command. `/git-cleanup` is added beside it."
  - "[x] `scripts/codex-plugin.test.ts` curated-bundle inventory is unchanged. `git-cleanup` is not added to `curatedBundle.canonicalCopies`."
  - "[x] Published procedure text has no remote delete, no `git push --prune`, no `git reflog expire`, and no `git gc`."
completed_at: 2026-10-27
completed_by: null
sql_memory_ids:
  - "01a1803b-e27b-7687-82a8-b63f2a8f4202"
---

# Phase 3: Skill, redirect, and docs

## Context

Parent user goal: a developer can delete local worktrees and branches whose code is already in the integration branch — including after a squash, rebase, or rewritten history — and then decide, from a one-line description and a planning / building / finished label, what to do with everything that is not proven landed.

Phases 1 and 2 must be completed first. This phase publishes the procedure against the landed script. It does not change classify or `--apply` behavior. If the script's CLI does not match this procedure, stop and route that to a follow-up plan; do not silently widen the script.

Parent assumptions A-1 through A-6 stay validated. No deferred assumption is owned here.

## Implementation Details

1. `skills/git-cleanup/SKILL.md`, model-invoked. Procedure:
   - Load and run `skills/git-cleanup/scripts/classify.ts` without `--apply`.
   - Print the `auto-delete` preview and the ask list (description, `description_source`, `state`, proof fields the JSON already carries).
   - Unless the argument is `dry-run`, run `--apply` for the fresh proven set. No second per-item confirmation on that set (A-4).
   - Stop and wait on the ask list. Questions are keep or delete locally, per item or for the abandoned subset. Do not delete from the ask list in the same turn as classify unless the user already answered. A user discard of a dirty path is explicit and per path; the skill still must not pass `--force` unless that same-turn answer named that path. Prefer leaving force-remove out of the script — the plan's out-of-scope line stands: no force-remove of a dirty worktree unless the user explicitly chooses discard for that path in the same turn. If the script cannot express that without `--force`, ask and stop; do not add `--force` in this phase.
   - The agent does not construct `git branch -D` or `git worktree remove --force`.
2. `prompts/git-cleanup.md`: thin wrapper, same shape as `prompts/git-clean-orphans.md` (`$ARGUMENTS`, then load the skill). Description states proven-landed clean locals are deleted, and the rest are asked.
3. `commands/git-cleanup.md`: symlink to `../prompts/git-cleanup.md`. Match `commands/git-clean-orphans.md` → `../prompts/git-clean-orphans.md`.
4. Replace the body of `skills/git-clean-orphans/SKILL.md` with a redirect to `git-cleanup`. Keep the `name: git-clean-orphans` so existing invocations still resolve, and point `description` at the new contract. First lines state both behavior changes: proven-landed clean branches are deleted without the old Step 5 confirmation pause, and a checkout outside the main repo parent is no longer skipped when it is registered to this common git dir. Delete the ancestry-and-always-confirm procedure. Do not leave a second inventory or a second `git worktree remove --force` path in that file.
5. `prompts/git-clean-orphans.md`: description plus a load of `git-cleanup`, not of a private delete procedure.
6. Docs:
   - `README.md` skills catalog: replace the `git-clean-orphans` confirmation sentence and add a `git-cleanup` row. There is no separate README prompt table for housekeeping commands; do not invent one.
   - `docs/buck-workflow.md`: mapping row, quick-reference row, and the `/git-clean-orphans` section. Add `/git-cleanup` beside it. Drop "destructive steps gated on confirmation" / "read-only by default; destructive steps are gated on explicit user confirmation" for this command. The new sentence is: proven-landed clean locals are deleted; everything else is asked.
7. Do not edit `scripts/codex-plugin.test.ts`. Do not add `git-cleanup` to `curatedBundle.canonicalCopies`. `git-clean-orphans` is not in that bundle either.
8. Do not edit managed skills under `~/.omp/agent/managed-skills/`. Do not touch `/worktrees-active-recap`.

## Risks

- Existing `/git-clean-orphans` callers expect a confirm-everything pause and get a delete of the proven set. Mitigation: the redirect's first lines state the new contract, and the two doc sentences drop the old confirmation gate. Rollback: restore `skills/git-clean-orphans/SKILL.md` and the prompt description from git. No data migration.
- A leftover ancestry procedure in the old skill, so agents keep a second cleanup. Mitigation: the old file is a redirect only; review checks there is no second delete procedure.
- Codex bundle drift. Mitigation: do not edit the inventory test.

## Verification

- Read the redirect and confirm it loads `git-cleanup` and contains no `git worktree remove`, `git branch -d`, or `git branch -D`.
- `ls -l commands/git-cleanup.md` shows a symlink to `../prompts/git-cleanup.md`.
- `git diff -- scripts/codex-plugin.test.ts` is empty.
- Docs-only session (every changed path is `.md` or under `docs/`) skips `guardrails:check` and says so. If any non-doc path changed, run `npm run guardrails:check`.
- Do not run `--apply` against this repo.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only. No `omp_execution` keyword and no `/goal set`.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces out-of-plan issues, do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
