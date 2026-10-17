---
status: active
date: 2026-09-18
updated: 2026-09-18
subject: 2026-09-18.good-ideas
topics: [review, iteration]
informs: []
addresses: plan-buck-workflow-factory-improvements.md
completed: null
from_review: b-review
---

# Iteration: good-ideas

## Source
- Reviewed after: `/b-build`
- Plan: `plan-buck-workflow-factory-improvements.md`
- Spec: none

## Critical Issues

### 1. Unit-test CI job lost `npm ci`
- **File**: `.github/workflows/test.yml:12-22`
- **Problem**: HEAD's `test` job ran `npm ci` then `npm test`. The diff moved `npm ci` into the new `guardrails` job and left `test` with only `npm test`. `actions/setup-node` `cache: npm` fills `~/.npm`, not `node_modules`. On a fresh runner `vitest` is missing (exit 127). Violates plan step 3.6 ("Keep the existing unit-test job").
- **Proposed fix**: Restore `- run: npm ci` before `- run: npm test` in the `test` job. Leave the `guardrails` job's own `npm ci` in place.

## Warnings

### 1. `hooks install --source` is parsed and ignored
- **File**: `scripts/install.mjs:779-829`
- **Problem**: `main()` calls `runHooks(args)` with no source. `runHooks` defaults to `REPO_ROOT` and never reads `args.source`. `--source` is a documented global option. Tests at `scripts/hooks.test.mjs:250,272` pass `--source` at the repo root, so they cannot catch the ignore.
- **Suggested approach**: `runHooks(args, args.source ? resolve(args.source) : REPO_ROOT)`, or reject `--source` on the hooks path with a clear error. Add a test that `--source /nonexistent` is either honored or refused.

### 2. `splitCsvLine` never toggles `inQuotes`
- **File**: `skills/b-guardrails-check/scripts/check.mjs:157-173`
- **Problem**: The quote branch is an empty `if (ch.charCodeAt(0) === 34) {}` (lizard-literal workaround) but does not set `inQuotes`. Quoted commas in lizard CSV would shift File/Name columns. Current fixtures only quote a later unused field.
- **Suggested approach**: `inQuotes = !inQuotes` in that branch (keep `charCodeAt` to avoid lizard glue). Fixture with a quoted comma inside the Name field.

### 3. "Coverage regression" test never regresses
- **File**: `skills/b-guardrails-check/scripts/check.test.ts:301-314`
- **Problem**: Plan verification asked for a coverage-regression contract test. The test named that way asserts `global_ratchet === "skipped"` because no lcov is produced. `runGlobalRatchet`'s `current < baseline` path is untested.
- **Suggested approach**: Rename the skip case. Add a fixture that writes `coverage/lcov.info` below baseline and asserts `gates.global_ratchet === "fail"` and `status === "fail"`.

### 4. Packed-package test leaves `buck-workflow-*.tgz` in the repo root
- **File**: `scripts/install.test.mjs:992-1010`
- **Problem**: `npm pack` runs with `cwd: repoRoot` and is never unlinked. Violates step 2.5 hermeticity. Current tree has untracked `buck-workflow-0.2.0.tgz`.
- **Suggested approach**: `--pack-destination PACK_ROOT`, or unlink the tarball in `afterEach`.

### 5. Catalog invariant omits directory/name equality
- **File**: `scripts/skill-frontmatter.test.ts:66-117`
- **Problem**: Plan step 1.2 requires asserting `name` equals the skill directory. The live catalog currently matches (checked 2026-09-18); the test does not lock it.
- **Suggested approach**: One assertion: `parseFrontmatter(...).name === dir` for every direct `skills/*/SKILL.md`.

### 6. `hooks.test.mjs` uses `import.meta.dirname` under `engines.node >= 18`
- **File**: `scripts/hooks.test.mjs:203,235,250,272`
- **Problem**: `import.meta.dirname` is Node ≥20.11. CI is Node 22; a Node 18/20.10 contributor (within `engines`) crashes this file.
- **Suggested approach**: `dirname(fileURLToPath(import.meta.url))`, matching `check.test.ts`.

### 7. Docs claim a bare-remote `git push` smoke the tests do not run
- **File**: `docs/buck-workflow.md` (Git pre-push section)
- **Problem**: Docs say a clean local push succeeds, a seeded finding blocks, and `hooks remove` restores prior push behavior. Tests exec the launcher with `bash [hook]` (exits 0 and 1 only); no bare remote, no `git push`, no exit 2, no post-remove push.
- **Suggested approach**: Either add the planned bare-remote smoke, or rewrite the sentence to match launcher-exec evidence.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan.
Critical #1 is the merge blocker; warnings 1–4 are the next slice.
Do not treat complexity-inventory growth, coverage floor 79.4, the 13 `.context/` audit hits, or lizard JS-parse workarounds as iterate work — those are recorded, in-scope-excluded, or already disclosed.
For larger rework, use `/b-build` or `/b-build-hard`.
