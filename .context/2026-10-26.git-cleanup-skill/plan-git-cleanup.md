---
status: active
date: 2026-10-26
subject: 2026-10-26.git-cleanup-skill
topics: [git, worktree, branch-cleanup, landedness]
research: []
iterations:
  - iterate-git-cleanup.md
  - iterate-phase-1-classify-json-review.md
  - iterate-phase-1-context-metadata-rereview.md
  - iterate-phase-1-refname-collision-review.md
memory: []
sql_memory_ids:
  - "01a1803b-e27b-7687-82a8-b63f2a8f4202"
---

# Plan: Landed worktree and branch cleanup

## User Goal

A developer with many local worktrees and branches can delete the ones whose code is already in the integration branch — including after a squash, rebase, or rewritten history — and then decide, from a one-line description and a planning / building / finished label, what to do with everything that is not proven landed.

Synthesized from the request. Correct it if the beneficiary or the outcome is wrong.

## Goal

Ship one canonical skill, `git-cleanup`, that classifies every local branch and every worktree registered to the current repo, deletes only the proven-landed clean set, and stops for a decision on the rest. `git-clean-orphans` becomes a redirect to that procedure so agents do not keep a second, ancestry-only cleanup.

## Context used / assumptions

- User-provided context: scan worktrees and branches; treat a pull request, merge, or rebase as landed only after the work is verified in the integration branch when history was rewritten; delete that set; ask about the remainder with a description and a planning / building / finished state.
- Session context: this checkout is `feat/git-cleanup-skill` at `5197bfde8a1e110286c5470ae00abd2bfeff7b7c`. Registered worktrees are not all under the main repo parent: `~/.worktrees/buck-workflow-pi/feat.git-cleanup-skill`, sibling `*.wt` directories, and prunable `/tmp/phase8-omp/*` entries whose gitdir is gone.
- Artifacts used: none in this subject. Prior art is `skills/git-clean-orphans/SKILL.md` (ancestry test, confirm every delete, skip paths outside the repo parent, local only). Managed skills `branch-landedness-check` and `safe-worktree-cleanup` already reject ancestry as the merge test; they are not in this repo and are not edited here.
- SQL recall (`git@github.com:evilbuck/buck-workflow-pi.git`, query text `git worktree branch cleanup orphan merged rebase master skill`): no prior cleanup-skill decision. Related facts used as evidence, not instructions: publication closeout on `feat/storage-adapter` rejects patch-id alone for rewritten history; `.context/2026-10-06.worktrees-active-recap/` is a separate read-only report and stays out of this plan.
- Probe: Buck capability `full`. Probe source: system available-skills catalog (`b-build`, `b-review`, `b-save`).
- Light Grill skipped. The delete gate, the `.context` exception, and the redirect were closed from the request plus the fixtures below.

## Decision Closure

Selected course: one procedure, `git-cleanup`. A deterministic classifier proves code containment. Apply re-runs that classifier and deletes only the fresh proven set. Unique `.context` blocks auto-delete and is shown on the ask list. `git-clean-orphans` loads this procedure instead of keeping the ancestry-and-always-confirm contract.

Evidence:

- User: delete when the work is in the integration branch even if history was rewritten; then ask about the rest with description and state.
- Fixture, git 2.56.0: a two-commit squash is not an ancestor, `git cherry` prints `+` for both commits, and `git merge-tree --write-tree` still yields the integration-branch tree.
- Fixture: code landed and only `.context/notes.md` differs → merge-tree exit 0, `git diff <base> <tree> -- . ':(exclude).context'` empty.
- Fixture: content conflict only in `.context/plan.md` → merge-tree exit 1, still emits a tree oid, conflict path is `.context/plan.md`, code diff against that tree is empty.
- Fixture: content conflict in `src/app.ts` → conflict path outside `.context`.
- This repo's `git worktree list` includes checkouts outside the main repo parent. The old parent-directory skip would refuse the trees this skill is for.

Excluded scope: remote branch deletion, `git push --prune`, reflog expiry, `git gc`, editing managed skills outside this repo, adding the skill to the Codex curated bundle (`scripts/codex-plugin.test.ts` inventory; `git-clean-orphans` is not in it either), and the read-only `/worktrees-active-recap` command.

Next action: `/b-build-hard` against [phase-1-classify-json.md](phase-1-classify-json.md). No delete path until Phase 2.

## Assumptions Ledger

### A-1

- statement: The integration branch is `refs/remotes/origin/HEAD`, otherwise local `master`, otherwise local `main`. The user's "master" means that branch, not a hardcoded name.
- status: validated
- blocking: false
- evidence: the request names master as the destination of landed work; `origin/HEAD` is the repo's actual default when it exists. Classifier stops if none of the three exist.
- validation_path: not required

### A-2

- statement: Code is contained when `git merge-tree --write-tree -z` yields a tree oid, every conflict path is under `.context/`, and `git diff --quiet <base> <oid> -- . ':(exclude).context'`.
- status: validated
- blocking: false
- evidence: fixtures in Context used. `git cherry` / patch-id is explanatory only. A `+` line does not block a passing containment check. A `-` line does not authorize deletion.
- validation_path: not required

### A-3

- statement: A branch whose code is contained but whose `.context` diff against the integration branch is non-empty is not auto-deleted.
- status: validated
- blocking: false
- evidence: feature branches in this repo routinely carry unmerged plans and notes. Ignoring `.context` would delete the only copy. Auto-delete remains for contained branches with an empty `.context` diff.
- validation_path: not required

### A-4

- statement: The proven set is deleted without a second per-item confirmation. The ask list is only the non-proven remainder.
- status: validated
- blocking: false
- evidence: the request says delete the landed set, then ask about the remaining.
- validation_path: not required

### A-5

- statement: Cleanup is local. A live `origin/<branch>` is reported and left in place.
- status: validated
- blocking: false
- evidence: the request names worktrees and branches, not remotes. `git-clean-orphans` is already local-only.
- validation_path: not required

### A-6

- statement: Every worktree registered to this repo's common git dir is in scope, whatever its path. The current checkout and the integration branch are never removed.
- status: validated
- blocking: false
- evidence: `git worktree list` on 2026-10-26 includes `~/.worktrees/buck-workflow-pi/feat.git-cleanup-skill` and sibling `*.wt` paths. Common dir is `/home/buckleyrobinson/projects/development_tools/buck-workflow-pi/.git`.
- validation_path: not required

## Material Risks

### False proven classification deletes unique code

- failure_mode: containment parser treats a source conflict or a non-empty code diff as landed.
- impact: the only copy of a patch is removed from the local branch and its worktree.
- mitigation: fail closed unless A-2 passes; dirty or untracked porcelain blocks auto-delete; apply deletes only names present in a fresh classify result; no `--force`, no `rm -rf`.
- rollback_or_fallback: do not expire reflog. Restore with `git branch <name> <sha>` from `git reflog`. A refused `git worktree remove` leaves the directory on disk.
- validation_path: fixture tests for unique commit, `src/` conflict, dirty porcelain, untracked file, and apply refusing a stale proven name. Skill text forbids `git reflog expire` and `git gc`.

### Unique `.context` discarded with a landed branch

- failure_mode: apply treats code containment as sufficient and deletes a branch that still has the only copy of a plan or notes.
- impact: unmerged `.context` is gone except for reflog of the branch tip.
- mitigation: A-3. Those items are `finished` on the ask list with the unique `.context` paths named.
- rollback_or_fallback: same reflog restore. The ask step is the primary prevention.
- validation_path: fixture where code is contained and `.context/notes.md` differs; disposition is `ask`, not `auto-delete`.

### `git-clean-orphans` callers expect a confirm-everything pause

- failure_mode: an existing invocation deletes the proven set without the old Step 5 prompt.
- impact: behavior change on a published command name.
- mitigation: the redirect's first lines state the new contract. README and `docs/buck-workflow.md` drop "destructive steps gated on confirmation" for that command.
- rollback_or_fallback: restore `skills/git-clean-orphans/SKILL.md` and the prompt description from git. No data migration.
- validation_path: `b-review` checks the redirect and the two doc sentences against this plan.

### Classify/apply race

- failure_mode: a branch gains a unique commit after the report and before delete.
- impact: unique work deleted under a stale proof.
- mitigation: apply calls classify again and deletes only the intersection with the fresh `auto-delete` set.
- rollback_or_fallback: reflog, as above.
- validation_path: test that apply ignores a name the second classify does not mark `auto-delete`.

## Scope

- New skill `skills/git-cleanup/SKILL.md`, model-invoked, plus thin `prompts/git-cleanup.md` and `commands/git-cleanup.md` → `../prompts/git-cleanup.md`.
- Classifier/apply script under `skills/git-cleanup/scripts/`, Node-compatible, `execFile` argv only (no shell). `promisify(execFile)` from `node:child_process`. The script classifies and, with `--apply`, performs the proven deletes. The skill forbids the agent from constructing `git branch -D` or `git worktree remove --force` itself.
- `git-clean-orphans` skill and prompt become a redirect to `git-cleanup`.
- Catalog lines in `README.md` and `docs/buck-workflow.md` for both names.

## Out of scope

- Deleting or pruning remote branches.
- `git reflog expire`, `git gc`, stash cleanup.
- Merging or cherry-picking unlanded work (`merge-stale-branch-safely`).
- `/worktrees-active-recap` (read-only unmerged report; backlog item stays).
- Codex bundle copy. Do not add `git-cleanup` to `curatedBundle.canonicalCopies`.
- Managed skills in `~/.omp/agent/managed-skills/`.
- Force-removing a dirty worktree, including on the ask path, unless the user explicitly chooses discard for that path in the same turn.

## Affected files

- `skills/git-cleanup/SKILL.md` (new)
- `skills/git-cleanup/scripts/classify.ts` (new; classify + `--apply`)
- `skills/git-cleanup/scripts/classify.test.ts` (new)
- `prompts/git-cleanup.md` (new)
- `commands/git-cleanup.md` (new symlink)
- `skills/git-clean-orphans/SKILL.md` (redirect)
- `prompts/git-clean-orphans.md` (description + redirect)
- `README.md` (skills row; prompt row if the prompt table lists housekeeping commands)
- `docs/buck-workflow.md` (mapping row, quick-reference row, `/git-clean-orphans` section)

## Implementation steps

1. Add `classify.ts` that prints one JSON document and does not delete unless `--apply` is passed. Resolve the base per A-1. Run `git fetch --prune origin` first; on fetch failure set `remote: "unknown"` and do not treat any branch as remote-gone. Inventory `git worktree list --porcelain` and `git for-each-ref refs/heads`.
2. Containment per A-2. Parse the tree oid and conflict paths from `git merge-tree --write-tree -z`. Do not scrape `Auto-merging` prose. Also record `git cherry` `+`/`-` counts as evidence fields only.
3. Unique `.context`: `git diff --quiet <base> <branch> -- .context` is false → `unique_context: true`.
4. Dirty: in a worktree, any `git status --porcelain` line blocks auto-delete. Ignored files stay hidden. A prunable worktree whose gitdir is missing cannot be status-checked; disposition `ask`. `git worktree prune` of the stale registration is allowed only as admin metadata cleanup, never as directory removal.
5. State, from the branch tip (worktree if present, otherwise `git show <branch>:.context`):
   - `finished` when code is contained, or the subject is `completed` and there is no unique code outside `.context`.
   - `planning` when there is no unique code outside `.context`, the worktree is clean, and the tip has a draft subject, a draft plan, or only research / brainstorm / plan artifacts.
   - `building` otherwise (unique code, dirty source, open PR, active subject with an implementation diff).
   - Description, in order, from PR title, plan H1, tip commit subject, branch name. Record `description_source`. Do not invent a summary.
6. Disposition:
   - `skip`: current checkout, integration branch, main worktree.
   - `auto-delete`: `finished`, code contained, `unique_context` false, not dirty, not skip, fetch status irrelevant.
   - `ask`: every other registered branch or worktree. Include proof fields and, when relevant, unique `.context` paths, dirty paths, conflict paths, remote live/gone/unknown, and PR state. PR state is a hint. `gh` missing or failing is `pr: null`, not "no PR".
7. `--apply` re-runs classify. Remove auto-delete worktrees with `git worktree remove` (no `--force`), then `git branch -d` when the tip is an ancestor, otherwise `git branch -D` only if the fresh result still says `auto-delete`. If worktree remove fails, do not delete that branch. Then `git worktree prune` for registrations already marked prunable. No network write.
8. Skill procedure: load the script, run it without `--apply`, print the deleted-set preview and the ask list, then run `--apply` for the proven set unless the argument is `dry-run`. Stop and wait on the ask list. Questions are keep or delete locally, per item or for the abandoned subset. Do not delete from the ask list in the same turn as classify unless the user already answered.
9. Replace `git-clean-orphans` body with a redirect. First lines state that proven-landed clean branches are deleted without the old confirmation pause, and that path-outside-parent is no longer a skip.
10. Update README and `docs/buck-workflow.md` so both names describe the new contract.

## Acceptance criteria

- [ ] `git cherry` printing `+` does not by itself keep a branch, and does not by itself delete one.
- [ ] Multi-commit squash whose code is in the integration branch, with no unique `.context` and a clean worktree, is `auto-delete`.
- [ ] Same fixture with a differing `.context` file is `finished` and `ask`, and `--apply` does not remove it.
- [ ] A source-file merge-tree conflict is not `auto-delete`.
- [ ] Dirty or untracked porcelain is not `auto-delete`. `--apply` never passes `--force`.
- [ ] Current checkout and the integration branch are `skip`.
- [ ] A worktree outside the main repo parent, registered to this common git dir, is classified. A prunable missing-gitdir entry is not directory-deleted.
- [ ] Ask-list rows have `planning`, `building`, or `finished`, plus a description whose source is PR title, plan H1, commit subject, or branch name.
- [ ] `git-clean-orphans` has no second delete procedure. Prompt and skill both load `git-cleanup`.
- [ ] `commands/git-cleanup.md` is a symlink to `../prompts/git-cleanup.md`. Codex curated-bundle inventory is unchanged.
- [ ] No remote delete, no reflog expiry.

## Verification

- `skills/git-cleanup/scripts/classify.test.ts` builds temp repos for: ancestor; single-commit squash; two-commit squash (`cherry` is `+`); cherry-pick equivalent; unique commit; `src/` conflict; `.context`-only conflict with code contained; unique `.context` file; dirty porcelain; untracked file; current branch; prunable missing gitdir; apply refusal of a stale name.
- `npm test` includes that file. `npm run guardrails:check` at the implementation checkpoint. This plan session does not touch code.
- Smoke, after the script exists: `bun skills/git-cleanup/scripts/classify.ts` in this repo with no `--apply`. Expect `feat/git-cleanup-skill` to be `skip`. Do not `--apply` against this repo as part of landing the skill.

## Phasing

Phased. Overview: [plan-git-cleanup-phases.md](plan-git-cleanup-phases.md).

1. [phase-1-classify-json.md](phase-1-classify-json.md) — classifier JSON + fixture tests. No delete flag. Hard. `/b-build-hard`.
2. [phase-2-apply-deletes.md](phase-2-apply-deletes.md) — `--apply`, re-classify intersection, refusal tests. Hard. `/b-build-hard`.
3. [phase-3-skill-redirect-docs.md](phase-3-skill-redirect-docs.md) — skill, prompt, symlink, `git-clean-orphans` redirect, README, `docs/buck-workflow.md`. Medium. `/b-build`.

Three HARD-ordered phases. Not split further, so no `omp_execution` field (orchestrate starts at ≥ 4 phases with a HARD dependency).
