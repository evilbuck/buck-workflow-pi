---
name: b-fix-rebase-conflict
description: Resolve large rebase or merge conflicts by reasoning over commit messages, diffs, and .context/ artifacts to produce semantic merges that preserve both sides' functionality. Detects conflict state, gathers structured context, resolves in batch, stages results, and stops at a manual gate.
---

# b-fix-rebase-conflict: Context-Aware Conflict Resolver

Resolve an active rebase or merge conflict by understanding both sides' intent, writing the semantic merge, staging the result, and stopping before any `--continue` step.

## When to Use

Use this when:
- `git rebase` or `git merge` is already in progress and has conflicted files.
- The conflict spans multiple files or non-trivial behavior, so `ours`/`theirs` is unsafe.
- The repo has buck-workflow artifacts in `.context/` that can explain intent.
- The repo has no `.context/` at all, but commit history and diffs still need semantic resolution.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | detect conflict state, inspect commits, stage resolved files |
| `bun` | optional; runs the analysis script for deterministic context gathering |

If `bun` is unavailable, fall back to inline `git` commands and raw file reads. The skill still works; the helper script path is just the preferred gather step.

## Write Boundary

**Allowed**
- Edit conflicted working-tree files to remove conflict markers and preserve both sides' intended behavior.
- Stage resolved files with `git add <file>`.
- Write a resolution report under `.context/` when the session already uses buck-workflow artifacts.

**Blocked**
- Running `git rebase --continue`, `git merge --continue`, `git commit`, `git rebase --abort`, or `git merge --abort`.
- Pushing.
- Modifying non-conflicted files unless the semantic merge requires an adjacent refactor. If that happens, note it explicitly in the report.

## Invocation

```bash
/b-fix-rebase-conflict
```

No arguments. Detect the active rebase or merge state automatically. The skill always stops at a manual gate instead of advancing the git operation.

## Procedure

### Phase 1: Detect conflict state

Preferred path:

```bash
bun skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts
```

Interpret the result exactly:
- Exit `2` → no active rebase or merge conflict. Report that and stop.
- Exit `1` → error. If `bun` is missing, fall back to inline `git status`, `git diff --name-only --diff-filter=U`, and direct file reads. Otherwise surface the error and stop.
- Exit `0` → parse the JSON and continue.

The script output is the source of truth for:
- `operation`
- `sideSemantics`
- `conflictedFiles[]`
- `contextArtifacts[]`

### Phase 2: Read context artifacts

If `contextArtifacts[]` is non-empty, read the most relevant artifacts before editing code.

Prioritize:
1. Active subject folders whose topics overlap with the conflicted files' subsystem.
2. Plans and specs.
3. Recent memory files only when they explain intent or constraints that the plan/spec omitted.

Extract:
- user goal
- scope
- verification criteria
- risks or constraints

Use these artifacts to answer: what behavior must survive the merge, and which side was trying to do what.

If `.context/` does not exist or yields nothing useful, proceed from commit history and code alone.

### Phase 3: Resolve conflicts in batch

For each conflicted file:

1. Read the full file context needed to understand the conflict, not just the marker block.
2. For each hunk, build a resolution model:
   - **Intent (ours)**: what the our-side commits changed and why.
   - **Intent (theirs)**: what the their-side commits changed and why.
   - **Conflict root cause**: same lines edited, structural rewrite, delete-vs-modify, rename fallout, etc.
   - **Resolution**: merged code that preserves both sides' behavior whenever possible.
3. Apply the merged result. Remove all `<<<<<<<`, `=======`, and `>>>>>>>` markers.
4. Stage the file with `git add <file>`.

Default to semantic merge. Only keep one side unchanged when the two sides are genuinely incompatible and the artifact or commit intent makes the priority clear.

### Phase 4: Verification

After resolving and staging every conflicted file:

1. Confirm no conflict markers remain in the resolved files.
2. Confirm `git diff --name-only --diff-filter=U` is empty.
3. Run lightweight verification if the repo exposes it.
   - Prefer targeted build/typecheck/lint commands already defined in `package.json` or repo guidance.
   - Do not run unrelated project-wide suites just because they exist.
4. If language-server diagnostics are available for changed files, check them.

If verification fails, report the failure and stop. Do not hand off a broken staged resolution as complete.

### Phase 5: Resolution report

Present the result in this shape:

```markdown
## Conflict Resolution Report

**Operation**: rebase | merge
**Conflicts resolved**: N files

### <file>
- **Conflicts**: M hunks
- **Our side intent**: <commit + artifact summary>
- **Their side intent**: <commit + artifact summary>
- **Resolution strategy**: semantic merge | kept ours | kept theirs | refactor
- **Key decision**: <why this preserves required behavior>
- **Confidence**: high | medium | low

## Verification
- Conflict markers remaining: 0
- Unmerged paths: 0
- Targeted verification: pass | fail | not available

## Next Step
Review the staged resolutions.
If satisfied, run:
  git rebase --continue
or:
  git merge --continue
If a resolution is wrong, edit the file and re-stage with `git add`.
For broader validation, run `/b-review`.
```

If you had to touch a non-conflicted file, list it separately and explain why.

### Phase 6: Manual gate

Stop after the report. Never advance the git operation yourself.

## Resolution Strategy

- **Semantic merge first.** Understand both sides, then write the combined result.
- **Structural awareness.** Read surrounding imports, types, callers, and related symbols so the merged code remains valid.
- **Artifact-guided priority.** When `.context/` artifacts explain intent, they outrank a shallow `ours`/`theirs` pick.
- **Conservative on deletion.** Delete-vs-modify conflicts are dangerous. Do not silently choose. State what was dropped and why.
- **Never invent certainty.** If intent remains ambiguous after commits, diffs, and artifacts, mark the hunk low-confidence in the report.

## Conflict Semantics

The `ours` / `theirs` labels invert between merge and rebase. Get this wrong and you can silently drop the user's work.

| Operation | `<<<<<<< HEAD` (ours) | `>>>>>>> branch` (theirs) |
|---|---|---|
| `git merge incoming` | Current branch (where you are) | The incoming branch being merged in |
| `git rebase upstream` | **Upstream / base** (what you're rebasing onto) | **Your branch** being replayed |

In a rebase, the commit being replayed is treated as `theirs` and the upstream branch is treated as `ours`.

## Safety Rules

- Never run `git rebase --continue`, `git merge --continue`, or `git commit`.
- Never run `git rebase --abort` or `git merge --abort`.
- Never push.
- Always stage resolved files with `git add`.
- Always verify that unmerged paths are gone before reporting completion.
- Treat the analysis script output as authoritative for operation type and side semantics.

## Output

Always report:
- operation type
- changed files
- per-file resolution rationale
- verification outcome
- exact manual next step command

Optional:
- a draft Conventional Commits message if the user is resolving a merge and wants help with the eventual commit title

## Recommended Next Steps

1. Review the staged files.
2. Run `git rebase --continue` or `git merge --continue` yourself.
3. Run `/b-review` for broader validation.
4. Run `/b-save` if this resolution is part of a buck-workflow session.
5. If more conflicts appear on the next replayed commit, run `/b-fix-rebase-conflict` again.
