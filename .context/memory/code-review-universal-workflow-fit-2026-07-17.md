---
date: 2026-07-17
domains: [skill, buck-workflow, docs]
topics: [code-review-universal, pr-review, inline-comments, submit-review, frontmatter, workflow-integration]
related: [skills/code-review-universal/SKILL.md, skills/code-review/scripts/submit-review.ts, skills/code-review/scripts/pr-context.ts, skills/code-review/scripts/pr-ref.ts, prompts/code-review-universal.md, commands/code-review-universal.md, README.md]
priority: medium
status: completed
---

# code-review-universal: buck-workflow fit + GitHub PR inline commenting

## What changed

- **Fixed broken frontmatter** in `skills/code-review-universal/SKILL.md`: the file was missing the opening `---` fence (skill loaders would fail to parse name/description) and carried a repo-unique `allowed-tools` block (Claude-style, Chinese comments) — removed per repo convention (name/description only).
- **Added "Invocation Modes" + "Buck Workflow Integration"**: local-diff vs GitHub-PR mode; boundary table vs `b-review` (workflow gate) / `code-review` (brutal tone, same plumbing) / `b-pr-review-2-issues` (inverse direction); subject resolution via `skills/_shared/subject-resolution.md`; findings route to `/b-iterate` (small) or `/b-plan` (substantial).
- **Added "Output: The Review Report"**: durable artifact in `.context/` — PR reviews go to `.context/YYYY-MM-DD.<pr-number>-<slug>/review-pr-<N>.md`, same subject-folder convention as `b-pr-review-2-issues` so both skills share one folder per PR. Status lifecycle: draft → active (delivered) → completed (addressed).
- **Added "GitHub PR Mode: Inline Comments"**: reuses `skills/code-review/scripts/pr-context.ts` + `submit-review.ts` (no second posting mechanism). Documents findings.json contract, severity mapping (🔴→critical, all others→warning with label kept in body), event mapping (any 🔴 → REQUEST_CHANGES; own PR → COMMENT since GitHub 422s APPROVE/REQUEST_CHANGES on own PRs), side/line mechanics, 422 handling, raw `gh api` fallback.
- **Fixed `submit-review.ts` event bug**: usage string advertised `APPROVE`/`REQUEST_CHANGES` but `ReviewEvent` union + `REVIEW_EVENTS` only allowed COMMENT/PENDING. Widened both.
- Updated `prompts/code-review-universal.md` (URL/shorthand args, inline-comment mention), added `commands/code-review-universal.md` symlink (OMP mirror convention), updated README skill row.

## Verified

- YAML frontmatter parses (name + description).
- `submit-review.ts --dry-run --event REQUEST_CHANGES` and `--event APPROVE` both accepted; payload pins `commit_id`, numeric `line`, side default RIGHT; validation rejects paths outside the PR's changed files.
- Raw `gh api ... -f 'comments[][path]=x' -F 'comments[][line]=10'` verified against live API: `-f` groups array-of-objects correctly; `line` as string → 422 "not a number", so `-F` is mandatory for `line`.

## Note for future sessions

`skills/code-review/SKILL.md` has **uncommitted WIP** (working tree = node5 "Release PR Code Review" text with `/mnt/c/Code/plans` paths; committed = "Brutally Honest" two-mode skill). Left untouched as user work — but `prompts/code-review.md` currently promises inline commenting that the WIP SKILL.md doesn't deliver. The scripts/ dir (pr-context.ts, submit-review.ts) is unmodified and shared by both review skills.

## Follow-up: #N parser fix

`prompts/code-review-universal.md` advertised `#123` but `pr-context.ts::parsePrArg` rejected it. Extracted pure matcher `skills/code-review/scripts/pr-ref.ts` (`matchPrRef`: URL / owner/repo#N / #N / N), rewired `parsePrArg` to delegate (num kinds resolve owner/repo via `gh repo view`), updated usage strings. Unit test `pr-ref.test.ts` (vitest, repo convention) — 7 tests pass. Import style: `./pr-ref.js` (NodeNext/tsc-clean, resolves under bun + vitest); repo tsc baseline is dirty (94 lines pre-existing, incl. b-auto-fix TS5097) — this change adds zero.

## Follow-up: analyzer script paths

`code-review-universal/SKILL.md` had three runnable commands using bare `python scripts/pr-analyzer.py` — relative to the skill dir the path is correct, but executed from a project root it fails. Fixed by switching to `<skill_dir>` (pi-rpc convention) with an explicit resolution note. Same fix applied to the four sibling-skill plumbing commands (`pr-context.ts`, `submit-review.ts`) which now reference `<skill_dir>/../code-review/scripts/...`. **User ruling:** this skill always ships inside buck-workflow, never standalone — the sibling reference is the right design, no vendoring.

## Follow-up: pr-analyzer git prefix bug

Real bug found while proving the analyzer command: this repo has `diff.mnemonicprefix=true`, so `git diff HEAD` emits `diff --git c/... w/...` — the analyzer's `a/... b/...` regexes matched nothing, returning 0 files silently on a 511-line diff. First fix widened the regex to `[a-z]/(.+?)`/`[a-z]/\1` but that traded one bug for another (the noprefix test path `s/x.py` got misread as prefixed). Rewrote the parser as a small state machine keyed off the `diff --git` header: it stores `header_prefixed` (True iff the two header tokens differ — true under a//b/, c//i//w//o/, false under noprefix and under same-token renames), then defers FileStats creation until the authoritative path line arrives: `rename to` for renames (no prefix, used verbatim), `+++ <path>` for add/modify, or `--- <path>` + `+++ /dev/null` for deletions (old_path stored on `---`, adopted on `+++ /dev/null`). The helper `_strip_diff_path_prefix(raw, header_prefixed)` only strips `[a-z]/` when the header is prefixed, and also unquotes C-quoted paths.

A subsequent round added a best-effort same-path fallback at the `diff --git` header so binary and chmod-only entries (which never produce `---`/`+++`/`rename to`) are still tracked with zero +/- counts. The fallback tries the prefix-styled same-path regex `^[a-z]/(.+?) [a-z]/\1$` first (covers a/foo b/foo AND c/foo w/foo), then the noprefix same-token path equality. The `+++`/`rename to` handlers still override this when they fire by re-issuing `current_file = FileStats(...)`. 52 tests pass (47 base + 5 new: binary under default a//b/, binary under mnemonicprefix, binary under noprefix, chmod-only under default, chmod-only under mnemonicprefix). End-to-end `git diff HEAD -- skills/` reports 3 files, +175/-242, complexity 0.48, ~30 min — matching `git diff --stat`.
