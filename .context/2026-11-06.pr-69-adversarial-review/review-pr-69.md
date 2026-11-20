# Adversarial Review — PR #69: fix(review-loop): surface prep failures and reject marker commits
**Mode:** local
**Head:** 298e436d8456c38efa90de60d4e1c2c2ff56a78c
**Event:** not posted
**Review:** not posted

## Summation
Pinned diff `8ef13100be02c7eef6ab95b512a6a6ce78cd29d6..298e436d8456c38efa90de60d4e1c2c2ff56a78c` (30 files). The PR body is empty. The title names a review-loop prep-failure and marker-commit fix. That code is in the diff, and the new fetch-failure and unresolved-marker tests match the paths they claim. No critical failure was proven on a diff line. The same pin also ships an unrelated tabbed `/buck-models` editor, a `b-pr` description-prompt rewrite, a guardrails coverage-baseline bump, and `.context/` notes.

## 1. Critical Failures
None proven.

## 2. Unaccounted Edge Cases
1. `extensions/code-review-iteration/loop.ts:154`. Input: a preparation error whose URL userinfo contains a raw `@`, for example `https://alice:p@ss@example.test/repo`. `safePreparationDetail` uses `[^s/@]*@`, so the match stops at the first `@`. The retained reason becomes `https://[REDACTED]@ss@example.test/repo`. The password tail `ss` is stored in the terminal report and `state.terminal.reason`. The pinned test at `loop.test.ts:648` only covers `alice:password` with no embedded `@`.

2. `extensions/code-review-iteration/loop.ts:165-185`. Input: rebase conflict with `options.fixerModel` set. `thinkingLevel` stays `null` and `runFixerSession` is called with `thinkingLevel: undefined`. The same conflict with no explicit fixer goes through `chooseFixer(..., "hard")` and passes `choice.thinking`. Explicit fixer precedence drops the hard-tier thinking level. No diff line shows that loss being recorded.

## 3. False Claims / Undocumented Drift
The title says this PR surfaces prep failures and rejects marker commits. Those paths exist (`loop.ts` preparation reasons, `git-ops.ts:139-162`). The pin also changes files the title does not name: `extensions/buck-models/model-picker.ts`, `extensions/buck-models/index.ts`, `skills/b-pr/SKILL.md`, `skills/b-pr/description-prompt.md`, the plugin copies of those skill files, `guardrails.json` (`baseline_coverage` 84 → 89.6), and new `.context/` plan, research, iterate, and backlog files. The PR body is empty, so none of that scope is stated.

`docs/oh-my-pi.md:103` says URL userinfo in those error details is redacted. That holds for `scheme://user:password@host`. It does not hold for userinfo that itself contains `@` (edge case 1). The same sentence admits other secret formats may remain; it does not admit this userinfo case.

## 4. Could-Not-Verify
- Whether `guardrails.json` `baseline_coverage: 89.6` is a measured suite result or a hand bump. Not executed.
- Whether host Ctrl+T bytes reach `matchesKey(data, "ctrl+t")` in `model-picker.ts` before `decodeKittyPrintable` appends `t` to the catalog filter. Not exercised in a TUI.
- `plugins/buck-workflow/skills/b-pr/` versus `skills/b-pr/` byte identity. The diff stats match; the files were not hashed.
