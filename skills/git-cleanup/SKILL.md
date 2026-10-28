---
name: git-cleanup
description: Deletes proven-landed clean local branches and registered worktrees, including squash/rebase equivalents, then asks what to keep or delete among the rest. Use for local Git housekeeping; dry-run previews without deleting.
---

<objective>
Delete only clean local work proven contained in the integration branch. Present every other branch or registered worktree with its recorded description and planning/building/finished state so the user can decide. Never delete remote branches.
</objective>

<safety>
- Use the bundled classifier as the source of proof. Do not substitute ancestry, `git cherry`, PR merge status, or a remote-gone label for containment.
- Scope is this repository's common Git directory: every registered worktree counts, including paths outside the main repository's parent. Unregistered directories are not cleanup targets.
- Preserve the current checkout, integration branch, main worktree, unique `.context` content, dirty, untracked or ignored work, and uncheckable/prunable entries. Ignored files must be preserved or explicitly discarded before cleanup.
- Fetch failure makes remote state unknown and blocks automatic deletion. Automatic deletion requires the fetched origin default branch and SHA to match the independently queried remote HEAD.
- Never construct `git branch -D` or `git worktree remove --force` yourself, expire reflogs, run garbage collection, or push/delete a remote. Every delete goes through the bundled apply path. Do not invent an apply implementation when the installed script lacks one: report the prerequisite failure and stop before deletion.
- This is a bounded safety decision: `skip`, `auto-delete`, or `ask`. The script computes it deterministically; do not replace proof with model judgment.
</safety>

<procedure>
1. Resolve this skill's installed directory as `<skill_dir>`; run from the target repository, not the skill directory:

   ```sh
   bun <skill_dir>/scripts/classify.ts
   ```

   Require exit 0 and one JSON object. A missing base, malformed JSON, or failed invocation stops the procedure. Classification contacts origin and may update or prune local remote-tracking refs, including in dry-run. Local master or main can serve as a preview base, but automatic deletion requires `base_verified: true`.

2. Show the base ref/SHA, `base_verified`, and fetch result. Print an `auto-delete` preview with names and exact worktree paths. Print all `ask` rows with name, path, description, `description_source`, state, containment, unique-context paths, dirty paths, cherry counts, PR/remote availability, and prunable status. Use the supplied description verbatim; unknown PR metadata is not evidence of no PR. List skipped rows and their skip reasons separately.

3. If the argument is `dry-run`, stop after the preview. Delete nothing.

4. Otherwise run the bundled fresh-proof apply path:

   ```sh
   bun <skill_dir>/scripts/classify.ts --apply
   ```

   Apply re-runs the classifier and deletes only names whose fresh disposition is `auto-delete`; it never replays the preview as an unchecked delete list. Against that fresh run, a name whose disposition is `ask` or `skip`, whose registration is prunable, or whose worktree is dirty is refused and left in place. Worktrees are removed with `git worktree remove <path>` and never `--force`; if that removal fails, the branch is not deleted and the directory stays on disk. The fresh proven set needs no second per-item confirmation. Report only the `applied` and `refused` entries the run actually emitted; a nonzero result is a failure, not success. If `--apply` is unsupported, stop and report that deletion is unavailable in this installation. Do not fall back to hand-written Git deletion commands.

5. Stop and wait for the user's keep/delete-locally choices for `ask` rows, individually or for an explicitly named abandoned subset. Do not delete those rows in the classify turn unless the user already supplied the relevant choice. A discard of dirty work must explicitly name the exact path in that same turn. If the bundled apply interface cannot express that choice safely, report that limitation and stop; do not add force flags or bypass its proof boundary.

6. Report observed results: the `applied` and `refused` entries apply emitted, skip reasons, and retained ask rows. Never claim successful removal merely from an `auto-delete` classification.
</procedure>

<success_criteria>
Dry-run produces a faithful preview and no deletions. Normal cleanup deletes only the freshly proven clean local set through the bundled apply path and waits for decisions about the rest. An unavailable apply path is reported as a prerequisite failure, never worked around.
</success_criteria>
