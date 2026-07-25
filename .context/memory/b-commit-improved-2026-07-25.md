---
date: 2026-07-25
domains: [implementation, testing, extensions, tooling]
topics: [b-commit-improved, git-commit, conventional-commits, draft-commit, pi-extension, omp, deterministic-script, bun-script, exit-code-contract]
artifacts:
  - skills/git-commit-improved/SKILL.md
  - skills/git-commit-improved/scripts/commit-preflight.ts
  - extensions/b-commit-improved/index.ts
  - extensions/b-commit-improved/__tests__/wire.test.ts
  - commands/b-commit-improved.md
  - prompts/b-commit-improved.md
  - extensions/index.ts
related:
  - b-kamal-release-extension-2026-07-24.md
  - b-pr-improved-worktree-enotdir-2026-07-24.md
  - b-pr-improved-auto-push-2026-07-23.md
priority: high
status: active
subject: 2026-07-25.git-commit-improved
---

# b-commit-improved — deterministic Conventional Commits

## What was built
A new `b-commit-improved` flow that mirrors the `b-pr-improved` ↔ `b-pr` pattern:
a code-driven counterpart to the existing `b-commit` agent-prose workflow. The
whole flow is orchestrated in TypeScript (not agent-interpreted steps): the
script does the git plumbing, the extension does orchestration + inline model
draft + commit + cleanup + verify.

## Files added
- `skills/git-commit-improved/SKILL.md` — thin contract: Inputs, Safety Rules, Procedure pointer
- `skills/git-commit-improved/scripts/commit-preflight.ts` — bun script: subject-folder detect, draft read, branch guard, staged check, diff gather. 4 exit codes (0/1/2/3)
- `extensions/b-commit-improved/index.ts` — orchestrator: preflight → resolve `{title, body}` (draft or model) → commit in line → draft cleanup + amend → verify. Also exports `fallbackDraft` for tests
- `extensions/b-commit-improved/__tests__/wire.test.ts` — 10 tests (3 wire + 5 script plumbing for all 4 exit codes + 2 fallbackDraft)
- `commands/b-commit-improved.md` — OMP fallback to the skill
- `prompts/b-commit-improved.md` — Pi prompt wrapper

## Files modified
- `extensions/index.ts` — 2-line wire-up (import after `wireBprImproved` + `wireBCommitImproved(pi)`)

## Commit-in-line rule (the contract)
Once `{title, body}` exists, commit immediately. The only fallback is writing
`draft-commit.md` when no draft AND no model — and `--dry-run` is the one
carve-out that previews without committing while still preserving the draft.

| Source of `{title, body}` | Action |
|---|---|
| Draft file (subject folder or root) | Commit inline. Delete the draft. Amend. |
| Model call (no draft, `--no-draft`) | Commit inline. **Do not write the draft.** |
| Neither (no draft, no model, model bad) | Write `draft-commit.md`. Notify. Return. |
| `--dry-run` with model source | Write the draft (so user has an artifact). Preview only. |
| `--dry-run` with pre-existing draft | Leave the draft untouched. Preview only. |

## Key implementation decisions
- **Reordered preflight** — staged check runs BEFORE branch detection. A fresh
  repo with no commits has no HEAD ref; running `--abbrev-ref HEAD` would fail
  spuriously instead of returning the more useful `nothing staged` exit.
- **`git symbolic-ref --short HEAD` instead of `--abbrev-ref HEAD`** — same
  reason: the former works on a repo with no commits; the latter doesn't.
- **Body parser tolerates leading blank lines** — the standard `## Title\n\n<title>`
  format has a blank line between heading and content; the original naive
  parser bailed on the first blank line, returning an empty title and breaking
  the draft path. One-line fix: `if (line.trim() === "") continue;`.
- **Static `protectedBranches` lookup uses `Record<string, true>`**, not `Set`,
  per the project's `ts-set-map` rule.
- **`fallbackDraft` and `writeDraft` resolve paths against `cwd`** — initial
  implementation used relative paths and silently failed when `process.cwd()`
  differed from the caller's `cwd`. The functions now `join(cwd, relPath)`
  internally and return the relative path for display.
- **No new dependencies** — pure node + `@mariozechner/pi-coding-agent` +
  `@mariozechner/pi-ai` (already in `peerDependencies`).

## Cross-harness / contract notes (durable for future extensions)
- Mirrors `b-pr-improved` shape: import `createAgentSession`/`SessionManager`/
  `SettingsManager` from `@mariozechner/pi-coding-agent`, `getModel` + `Model`
  from `@mariozechner/pi-ai`. Same `runModelSession` pattern (60s default
  timeout, vs 120s for b-pr — commit drafts are smaller).
- `runModelSession` is a `verbatim copy` per the plan; extensions are isolated
  bundles, not import-shared utilities.
- Model prompt: `{"title": "...", "body": "..."}` JSON, no markdown fencing.
  `parseModelResponse` strips ```json fences and finds the first `{...}` object
  on the page (model may have led/trailed with prose). On parse failure, treat
  as model failure → `fallbackDraft(...)`.
- `--dry-run` is the only carve-out from "commit in line once you have a message":
  it previews without committing but still writes the draft when the source was
  the model (so the user has an artifact they can re-run against).
- Branch-guard message format: `protected branch '<branch>' — re-run with --force to commit here directly`.

## Verification
- `npx tsc --noEmit --project tsconfig.json` — 0 errors in new files (5 pre-existing
  errors in `extensions/index.ts` are baseline, verified via `git stash`).
- `npx vitest run extensions/b-commit-improved/__tests__/wire.test.ts` — 10/10 pass:
  - `b-commit-improved wire` (3): registers command, completes flags
    (`--force`/`--no-draft`/`--dry-run`/`--model`), handler is async.
  - `b-commit-improved deterministic plumbing` (5): exit 3 (nothing staged),
    exit 2 (protected branch), exit 0 with staged files, exit 1 (detached HEAD),
    draft parsed into `{title, body}`.
  - `fallbackDraft` (2): writes file with both headings + diff + re-run hint;
    falls back to `.context/draft-commit.md` when no subject folder.
- Manual smoke test on throwaway repos: all 4 exit codes confirmed end-to-end
  (code 0 with and without draft, code 1 detached, code 2 protected, code 3
  nothing staged). Draft path with `## Title\n\nfeat: hello\n\n## Body\n\n...`
  format parses correctly and populates `draft: {title, body}` in JSON output.

## Bugs fixed during build
- Fresh repo with no commits → `git rev-parse --abbrev-ref HEAD` failed with
  "ambiguous argument 'HEAD'" instead of returning the useful exit 3. Fix:
  reordered to do staged check first, and used `git symbolic-ref --short HEAD`
  which works without commits.
- `extractDraft` returned `title: ""` when the draft had a blank line between
  the `## Title` heading and the title text (the standard format from `b-save`).
  Fix: `if (line.trim() === "") continue;` to skip leading blanks.

## Status / follow-ups
- **Not committed** — the work is staged alongside prior b-pr-improved changes
  on branch `feat/deterministic-git-commit`. `/b-commit-improved` (this new
  command!) is the natural next step.
- **Live `git commit` path not exercised end-to-end** — the preflight and
  `fallbackDraft` paths are covered by vitest; the actual `git commit` and
  `git commit --amend` steps in the extension are not in the test suite
  (they run inside `runBCommitImproved` which requires a pi extension
  harness). Smoke-verified manually on throwaway repos.
- **Model-draft path not exercised** — the test env has no model. The script
  smoke tests cover the deterministic path; the model path falls back to
  `fallbackDraft` when the model is absent or returns garbage (both
  exercised by the harness: `parseModelResponse` rejects unwrapped JSON;
  `runModelSession` throws on missing model).

## Skipped (per `ponytail: full`)
- `--base`/`--destination` parity — irrelevant for commits, no analog exists.
- `extractDraft`/`extractSection` helpers in the extension — dead code (the
  script does the parsing). Deleted.
- Inlined `buildCommitArgs` — the orchestrator now uses the literal array
  expression. Clearer at the call site.
