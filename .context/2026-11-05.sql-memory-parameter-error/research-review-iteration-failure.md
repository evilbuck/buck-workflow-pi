---
status: active
date: 2026-11-05
subject: 2026-11-05.sql-memory-parameter-error
topics: [code-review, git-rebase, diagnostics]
informs: []
---

# Review iteration base-preparation failure

## Incident evidence

- Run `20261106T010556-50u1co` failed before pass 1; its `passes/` directory is empty. The report is not a code review and contains no reviewer findings.
- The checkout reflog records checkpoint `61903a73e36f6fd7d38ed532e39a97f1ccc6e5a1`, a rebase starting at fetched base `8ef13100be02c7eef6ab95b512a6a6ce78cd29d6`, and an abort returning to that checkpoint. The fetch therefore succeeded. The checkpoint includes the user's existing category-tabs iteration work; it was not reverted or rewritten.
- A virtual merge of that checkpoint with `origin/master` reports conflicts in `.context/backlog/todo.md` and `.context/memory/index.md`. The first commit alone conflicts in the backlog. These are concrete obstacles to integrating the base, but do not prove what caused the recorded abort: its persisted terminal reason contains only `base preparation failed: failed`, and no original error or Fixer transcript was retained.
- Failure candidates were an unresolved conflict/failing conflict Fixer, another rebase failure, or a failed rebase continuation. Fetch failure is ruled out for this run by the reflog. The virtual merge does not execute the original failed review and does not prove which failure branch occurred.

## Repair

The review loop now propagates the failed preparation step, underlying error and conflicting paths to both `state.json` and the terminal report; URL userinfo, bearer tokens and common secret assignments are redacted. The existing hard-stop and rebase-abort behavior remain. A synthetic local-Git regression demonstrated that the previous code lost both a fetch error and a failed conflict Fixer's error; both passed after the fix. A separate live local-repository smoke confirmed that an unavailable origin produces a report naming `git fetch origin master` and the Git cause.

The conflict-Fixer path also chose the first `hard` catalog entry without checking enablement, role, authentication or the available-model set. This can cause recovery to fail before review even when another eligible hard model is available. It now uses the normal hard-tier selection and fallback path, keeps an explicit Fixer override, records the attempted Fixer model, and aborts the rebase if model discovery fails. Local-Git regressions went red before the change and green afterward. This is a plausible contributor to the original failure, not proof of its exact cause.

The manual category-tabs review also found that putting the unavailable suffix after a long model ID clipped away the status in both columns. The editor now prefixes unavailable IDs with `!` and shows a legend before the filter. The new rendering regression failed on the old code and passed after the change. In an isolated OMP 18.16.0 TUI, the marker and legend were visible at 80×24 and 60×24; removing the model then cancelling left project and global config files byte-identical.

The direct review also exposed an independent rebase-safety defect: the loop staged whatever the Fixer left behind and could commit conflict markers when the Fixer reported success without resolving them. A local-Git regression reproduced a false `clean` result before the fix. Staged resolutions are now checked for leftover conflict markers before continuation; a failed check aborts the rebase without changing the original HEAD. Whitespace-only Git warnings remain non-blocking.

With the user's approval, `feat/tabbed-buck-model` was rebased onto `origin/master` at `8ef13100be02c7eef6ab95b512a6a6ce78cd29d6`; both backlog sections and both memory entries were preserved. Git reapplied the autostash, and a line-by-line comparison of the six pre-rebase patch file deltas showed no missing or extra lines. The original report was retained. Its automatic-resume hint is conditional on matching HEAD and worktree fingerprint; the rebase and subsequent edits make that old run evidence, not a resumable match.

## Additional review findings

`extensions/workflow-state/execution.ts:30-34` resolves and bind-mounts the checkout's `node_modules` target on each `workflow_exec` call. In a disposable checkout, one sandboxed call created a symlink to a synthetic host-private directory and a second call on the same tool instance read its synthetic private file. The checkout is writable from the sandbox, so the dependency path is not a trusted mount authority. No real private data was accessed. This pre-existing isolation issue is outside the review-loop change and is tracked at `.context/backlog/items/workflow-exec-dependency-sandbox-escape.md`; avoid untrusted `workflow_exec` stages until its trust boundary is repaired.

The direct review also found a packaging dependency on two currently untracked user files: `skills/b-pr/description-prompt.md` and `plugins/buck-workflow/skills/b-pr/description-prompt.md`. In a disposable checkout containing only the tracked patch, `b-pr-improved`'s drafting test failed with `ENOENT` for the missing canonical prompt. The files are byte-identical and remain untouched in the original worktree; both must be included when committing the corresponding b-pr changes.

## Verification

- The focused review-loop and model-editor suites pass: 91 tests across four files. A separate real-Git smoke left markers unresolved, observed a failed continuation, and confirmed the original HEAD was restored without committing markers.
- The required full guardrails check fails in this worktree: the workflow-state isolation test cannot import `yaml` through its two-hop dependency symlink, so coverage could not complete. In a disposable checkout with the same code changes, both untracked prompt templates, and a physical dependency directory, the full unit gate passes, but the global coverage ratchet fails at 88.3% against the required 89.6%; complexity passes. Neither the test nor the ratchet was weakened.
- Independent reviewer agents were unavailable or stalled; the completed review was performed directly rather than by an independent model.
