# git-commit-improved: deterministic Conventional Commit plugin

**memory:** [../memory/b-commit-improved-2026-07-25.md](../memory/b-commit-improved-2026-07-25.md), [../memory/b-commit-improved-placeholder-sentinels-2026-08-26.md](../memory/b-commit-improved-placeholder-sentinels-2026-08-26.md)

## Context



`skills/git-commit/SKILL.md` is the existing skill — agent-interpreted prose that walks through 11 steps to draft a Conventional Commits message and run `git commit`. The user wants a sibling (`git-commit-improved`) that codifies the deterministic parts (detect active session, find the draft, run the commit, clean up the draft, verify) into a Pi extension + script, mirroring the `b-pr-improved` ↔ `b-pr` pattern. Contract: **once a usable message exists (from a draft file or an inline model call), commit in line — never defer.** The LLM step (drafting the message from the staged diff) stays inline via `createAgentSession`. The only fallback is writing a `draft-commit.md` when no model is available AND no draft exists — and that is a last resort so `/b-commit` (or a future `/b-commit-improved` run) can finish it later. End state: `/b-commit-improved [--force] [extra context]` is a registered Pi command that performs the commit end-to-end without the agent re-reading the skill.

### Commit-in-line rule

The whole point of `git-commit-improved` over `git-commit` is that it never waits once it has a message. Three sources of truth, one rule:

| Source of `{title, body}`               | Action                                                |
|-----------------------------------------|-------------------------------------------------------|
| Draft file (subject folder or root)     | Commit inline. Delete the draft. Amend.               |
| Model call (no draft, `--no-draft`)     | Commit inline. **Do not write the draft.**            |
| Neither (no draft, no model, model bad) | Write a `draft-commit.md`. Notify. Return.            |

`--dry-run` is the one carve-out: it previews only (no commit, no amend), but it MUST still write the draft file when the source was the model — otherwise the user's dry-run produces nothing they can later commit from. On `--dry-run` with an existing draft on disk, leave the draft untouched (it's already there).

## Approach

### 1. New deterministic script — `skills/git-commit-improved/scripts/commit-preflight.ts`

Mirrors `skills/b-pr/scripts/pr-preflight.ts` (same `bun` shebang, same exit-code convention, same JSON-on-stdout shape). It owns the git plumbing so the extension stays a thin orchestrator.

**Args** (parsed before any git work):
- `--force` — bypass the protected-branch check (set `force: true` in output).
- `--no-draft` — skip reading a draft; force the LLM-draft path (escape hatch).
- `--dry-run` — never mutate; print the plan and exit 0.

**Exit codes** (match `pr-preflight.ts`):
- `0` — ready to commit; payload includes `{ staged: [...], diff: string, current_branch, force, draft? }` where `draft?` is the parsed draft (if any) with `{ title, body }`.
- `2` — protected branch and `--force` not set (deterministic refusal).
- `3` — no staged changes (deterministic refusal).
- `1` — git itself is broken (not a repo, etc.) — message in JSON `error` field.

**Procedure** (every step deterministic; no model calls):
1. `git rev-parse --is-inside-work-tree` — bail with code 1 on failure.
2. `git rev-parse --abbrev-ref HEAD` — get current branch. If `HEAD` (detached), bail code 1.
3. **Detect active subject folder**: `ls -dt .context/????-??-??.*/ 2>/dev/null | head -1` — strip trailing `/`. (No re-implementation: this is the exact command the current skill uses on line 31.)
4. **Detect draft**: if subject folder found, read `.context/<subject>/draft-commit.md`; else read `.context/draft-commit.md`. Parse `## Title` and `## Body` (everything between `## Body` and the next `## ` heading or EOF). A draft is "usable" iff `## Title` is non-empty after `trim()`.
5. **Branch guard**: if branch ∈ `{main, master, dev, develop}` AND `!args.force`, exit 2 with JSON `{ error: "protected branch …", current_branch }`.
6. **Staged check**: `git diff --cached --name-only`. If empty, exit 3 with JSON `{ error: "nothing staged" }`.
7. **Gather diff**: `git diff --cached` (full patch — the model needs it for the no-draft path; the extension also forwards it as part of the model prompt).
8. **Output**: print JSON `{ code: 0, current_branch, subject_folder, draft_path|null, draft: { title, body } | null, staged_files: [...], diff }` and exit 0.

Reuse no existing utility — none covers "find subject folder + read draft". Pure Node: `existsSync`, `readFileSync`, `execFileSync`.

### 2. New extension — `extensions/b-commit-improved/index.ts`

Mirrors `extensions/b-pr-improved/index.ts`. The extension does ONLY orchestration; the script does the git plumbing.

**Layout** (same sections in this order, modeled line-for-line on `b-pr-improved/index.ts`):
- Imports: `ExtensionAPI`, `createAgentSession`, `SessionManager`, `SettingsManager`, `getModel`, `Model`, `execFileSync`, `dirname`, `join`, `fileURLToPath`, plus `readFileSync`, `unlinkSync`.
- `HERE` + `PREFLIGHT` path resolution: `join(HERE, "..", "..", "skills", "git-commit-improved", "scripts", "commit-preflight.ts")`. Comment: "Single source of truth for git plumbing — same pattern as b-pr-improved."
- **Helpers**:
  - `execText(bin, args, cwd)` — copy from `b-pr-improved/index.ts:37-49` (throws with stderr on failure).
  - `execGit(args, cwd)` — thin wrapper over `execText("git", ...)`.
  - `runPreflight(args, cwd)` — copy from `b-pr-improved/index.ts:87-109` (captures stdout even on non-zero exit, parses JSON). Returns `{ code, json }`.
  - `lastAssistantText(messages)` — copy from `b-pr-improved/index.ts:113-121`.
  - `resolveModel(override)` — copy from `b-pr-improved/index.ts:123-133`.
  - `runModelSession(cwd, tools, prompt, modelOverride?, timeoutMs = 60_000)` — copy from `b-pr-improved/index.ts:135-164` (60s default — commit drafts are shorter than PR descriptions).
- **`fallbackDraft(cwd, subjectFolder, diff, stagedFiles, extraContext, reason)`** — writes `<subjectFolder>/draft-commit.md` (or `.context/draft-commit.md` if no subject folder) using the exact `## Title` / `## Body` heading shape the existing skill consumes. Body contains the full staged diff verbatim (wrapped in a fenced `diff` block), the file list, the extra context, and a top comment block explaining why this draft was generated (no model / model failed) and the literal command to re-run. Returns the path written. No-op if `dryRun`.
- **`writeDraft(cwd, subjectFolder, title, body)`** — write `<subjectFolder>/draft-commit.md` (or `.context/draft-commit.md`) with `## Title\n<title>\n\n## Body\n<body>\n`. Used when the model successfully drafts the message but a `--dry-run` (or similar) wants the draft preserved. Also used by the success-cleanup path? **No** — on success we delete the draft, not rewrite it. So this is only for the no-commit edge cases below.
- **`deleteDraft(path)`** — `unlinkSync` wrapped; tolerate ENOENT.
- **`extractDraft(content)`** — parse `## Title` (line after the heading until blank line or next `## `) and `## Body` (everything after the heading line until next `## ` heading or EOF). Returns `{ title, body }` (both `""` if missing).
- **`parseArgs(args)`** — returns `{ force: boolean, noDraft: boolean, dryRun: boolean, model?: string, extraContext: string }`. `extraContext` = the arg string with flag tokens stripped (join remaining tokens with spaces). Mirrors `b-pr-improved/index.ts:276-289`.
- **`draftFromModel(cwd, diff, stagedFiles, currentBranch, extraContext, modelOverride, dryRun, subjectFolder)`** — calls `runModelSession(cwd, ["read"], <prompt>, modelOverride)`. On success returns `{ title, body }`. On failure (no model / exception / empty response) → call `fallbackDraft(...)` with `reason` set to the failure message, then `return null` (caller stops). On `--dry-run` after a successful model call, also write the draft for the user to inspect.
- **`buildCommitArgs(title, body)`** — returns `["commit", "-m", title]` when `body.trim() === ""`; else `["commit", "-m", title, "-m", body]`. No `$TITLE`/`$BODY` literals are ever in either string (caller guarantees by parsing / model generation).
- **`verifyCommit(cwd)`** — runs `git log -1 --format=%B`. Returns `{ ok: boolean, message: string, placeholders: boolean }`. If `placeholders` is true, amend with the same title/body via `git commit --amend -m <title> -m <body>`.
- **`commitHandler(args, ctx)`** — top-level orchestrator. Steps below.
- **`wire(pi)`** — `pi.registerCommand("b-commit-improved", { description, getArgumentCompletions, handler })`.

**Orchestrator (`commitHandler`) steps — in order, gated on `pf.code`:**

1. `parseArgs(args)`. Resolve cwd, notify.
2. `runPreflight(flags, cwd)` where `flags = []` plus `--force`/`--no-draft`/`--dry-run` as applicable. Map:
   - `code === 2` (protected branch): notify, return.
   - `code === 3` (nothing staged): notify, return.
   - `code !== 0` (other failure): notify `error` field, return.
   - `code === 0`: continue.
3. Destructure `pf.json` → `{ current_branch, subject_folder, draft_path, draft, staged_files, diff }`.
4. **Resolve `{title, body}` — commit in line once you have them** (see "Commit-in-line rule" above):
   - If `draft && draft.title.trim() !== ""` → use `draft.title`, `draft.body`. **No model call.**
   - Else (no draft, or draft title empty, OR `--no-draft` set) → call `draftFromModel(...)`.
     - Returns `{title, body}` → commit in line. Do NOT write the draft file.
     - Returns `null` (model failed / unavailable) → `fallbackDraft(...)` was already called; notify "Drafted to <path>. Re-run /b-commit-improved (or /b-commit) to commit." and return. **No commit.**
5. **Pre-commit safety check** (cheap, deterministic, runs even on dry-run): scan `title` and `body` for the literal strings `$TITLE` and `$BODY`. If found, refuse and notify. (The existing skill does the same check; the extension must not regress it.)
6. If `--dry-run`: notify the resolved `title` + first line of `body`. **If the message came from the model (draft was null/missing), call `writeDraft(...)` so the user has an artifact they can re-run `/b-commit-improved` against.** If the message came from a pre-existing draft on disk, leave the draft untouched. Return.
7. `execGit(["commit", ...buildCommitArgs(title, body)], cwd)`. If it throws: **do not abort** — capture stderr and check `git diff --cached --name-only`. If new staged files exist (hook auto-modified something), `execGit(["commit", ...buildCommitArgs(title, body)], cwd)` again with the same args. If still fails, notify the stderr and return — draft is NOT deleted on failure.
8. **Success cleanup** (only on confirmed commit):
   - If `draft_path` non-null AND `existsSync(draft_path)`: `deleteDraft(draft_path)` (best-effort — tolerate ENOENT).
   - If a draft was deleted above: `try { execGit(["add", "--", draft_path], cwd) } catch { /* file gone — race with another process */ }` — `git add` of a deleted path stages the deletion, then `execGit(["commit", "--amend", "--no-edit"], cwd)` folds the deletion into the just-made commit.
   - **Use `commit --amend --no-edit`** because the title/body are already correct; this is exactly what the existing skill does (lines 75-77). Wrap the `git add` + `amend` pair in try/catch — a race (another process deletes the draft first) leaves the original commit intact, which is the desired outcome.
9. **Verify**: `verifyCommit(cwd)`. If `placeholders` is true (paranoid, should never trigger with our strict step 5): amend with explicit `-m` flags, notify a warning.
10. **Final output**: notify the final title + body, then `git status -sb` and `git log -1 --oneline` via `execGit` (errors swallowed — best-effort tail).

**Inline model prompt** for `draftFromModel` (this is the only LLM step; keep it tight):

```
You are drafting a Conventional Commits commit message for the staged changes below.

Repository: <cwd basename>
Current branch: <current_branch>
Extra context from the user: <extraContext || "(none)">

Staged files:
<stagedFiles joined with "\n">

Staged diff (truncated to 8000 chars):
<diff.slice(0, 8000)>

Return a JSON object with EXACTLY two string fields, no markdown fencing:
{"title":"<type>(<scope>): <short summary <=72 chars>","body":"<1-3 line body about WHY, not what>"}

Rules:
- Title format: <type>(<optional-scope>): <summary>
- Type ∈ {feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert}
- If breaking, include `BREAKING CHANGE: <note>` in body
- Do NOT include the literal strings `$TITLE` or `$BODY`
- Body is optional — empty string is fine for trivial changes
```

The extension then `JSON.parse`s the response. On parse failure (model wrapped in fences, prose around it), strip ```json fences and retry once; if still bad, treat as model failure → call `fallbackDraft(...)` (which writes the diff into a `## Body` and stops the run). **Never commit on a malformed model response.**

### 3. Skill — `skills/git-commit-improved/SKILL.md`

Thin. Three sections: Inputs (forward to the extension — no LLM work the skill should do), Safety Rules (re-state the protected-branch + no-staged-changes rules so a human running `/skill:git-commit-improved` directly knows the contract), and a one-line Procedure pointing at the extension path. This is the canonical cross-platform fallback when the extension isn't loaded (same role as `commands/b-pr-improved.md`).

### 4. Command fallback — `commands/b-commit-improved.md`

Same shape as `commands/b-pr-improved.md`: frontmatter + `$ARGUMENTS` + note that the extension is the deterministic path + cross-platform pointer to `../skills/git-commit-improved/SKILL.md`. Cross-platform note (paraphrased from `commands/b-pr-improved.md:9-15`): "Under Pi/OMP with the extension loaded, `/b-commit-improved` runs the code path. Without it, the skill encodes the same contract."

### 5. Slash command / prompt — `prompts/b-commit-improved.md`

Mirror `prompts/b-commit.md`: frontmatter + `$ARGUMENTS` + `Load and follow the git-commit-improved skill: skills/git-commit-improved/SKILL.md`.

### 6. Wire into the extension entrypoint — `extensions/index.ts`

Two edits:
- Add import (after line 9): `import { wire as wireBCommitImproved } from "./b-commit-improved/index.js";`
- Add wire call (after line 324, mirroring line 323): `// --- b-commit-improved: deterministic commit ---` then `wireBCommitImproved(pi);`.

### 7. Tests — `extensions/b-commit-improved/__tests__/wire.test.ts`

Mirror `extensions/b-pr-improved/__tests__/wire.test.ts`. Use the same `createMockApi` helper (copy verbatim). Three `describe` blocks:
- `wire` block: registers `b-commit-improved`; handler is async + arity ≤2; description is non-empty; flag completions include `--force`, `--no-draft`, `--dry-run`, `--model`.
- **Script plumbing** block: spawn `bun skills/git-commit-improved/scripts/commit-preflight.ts` against a throwaway repo and assert JSON shapes for the four exit codes (0 with no staged → code 3; 0 with protected branch + no flag → code 2; 0 with staged → code 0; detached HEAD → code 1). No model, no gh.
- **`fallbackDraft`** block: directly import and call it with a stub subject folder; assert the file is written with both `## Title` and `## Body` headings and contains the diff body. Cleanup `rmSync` in `finally`.

The `buildCommitArgs` / `extractDraft` helpers get covered by the script-plumbing block (the script exercises `extractDraft` indirectly).

## Critical files & anchors

- **`skills/git-commit-improved/scripts/commit-preflight.ts`** (new, ~120 lines) — the deterministic core. Reuse `execFileSync("git", …)` exactly as `pr-preflight.ts:81-89` does; reuse `ls -dt .context/????-??-??.*/` from `skills/git-commit/SKILL.md:31`.
- **`extensions/b-commit-improved/index.ts`** (new, ~330 lines) — orchestrator. Reuse `runPreflight` / `lastAssistantText` / `resolveModel` / `runModelSession` from `extensions/b-pr-improved/index.ts:87-164` (copy, do not import — extensions are isolated bundles).
- **`extensions/index.ts:9,323-324`** — the two-line wire-up. Insert after `wireBprImproved`.
- **`skills/git-commit/SKILL.md:27-77`** — the canonical procedure this codifies. Every step maps to a deterministic call: step 1 (draft detection) → script step 4; steps 2-4 (branch guard + staged check) → script steps 5-6; step 6 (commit) → orchestrator step 7; steps 7-8 (cleanup + amend) → orchestrator step 8; step 10 (verify) → orchestrator step 9.
- **`extensions/b-pr-improved/__tests__/wire.test.ts`** — the test file the new test mirrors. Copy the `createMockApi` and `makeRepo` helpers verbatim.

## Verification

Run from the repo root (`/home/buckleyrobinson/projects/development_tools/buck-workflow-pi`):

1. **Build the new files compile** — `npx tsc --noEmit extensions/b-commit-improved/index.ts extensions/b-commit-improved/__tests__/wire.test.ts extensions/index.ts` — zero errors in the new files (existing repo-wide errors are tolerated; only assert the new files are clean).
2. **Unit tests pass** — `npx vitest run extensions/b-commit-improved/__tests__/wire.test.ts` — all green (≥5 tests: 3 wire + 2 fallbackDraft).
3. **Script smoke test (no model)** — in a throwaway repo:
   ```bash
   TMP=$(mktemp -d) && cd "$TMP" && git init -q -b main
   mkdir -p .context/2026-07-25.test-session && echo "x" > a.txt
   bun <repo>/skills/git-commit-improved/scripts/commit-preflight.ts
   # expect: JSON { current_branch: "main", draft: null, ... }, exit 2 (protected branch, no --force)
   echo "y" > a.txt && git add a.txt
   bun <repo>/skills/git-commit-improved/scripts/commit-preflight.ts --force
   # expect: JSON { staged_files: ["a.txt"], draft: null, ... }, exit 0
   echo -e "## Title\n\nfeat: hello\n\n## Body\n\nfirst body" > .context/draft-commit.md
   bun <repo>/skills/git-commit-improved/scripts/commit-preflight.ts --force
   # expect: JSON { draft: { title: "feat: hello", body: "first body" }, ... }, exit 0
   ```
4. **End-to-end draft path (no model)** — still in `$TMP` from step 3, with `draft: {title, body}` populated:
   ```bash
   cd "$TMP"
   # extension needs pi; simplest verification is to call the script + simulate the commit step:
   git commit -m "feat: hello" -m "first body"
   rm .context/draft-commit.md
   git add -A && git commit --amend --no-edit
   git log -1 --format='%s'
   # expect: "feat: hello"
   ```
5. **Fallback path** — write `fallbackDraft` directly: import `fallbackDraft` in a tiny `bun` script, pass a fake subject folder + diff, assert file written with both headings and a `Re-run:` hint. Already covered by `fallbackDraft` describe block.

The draft-path smoke test is the new-behavior proof: a draft on disk → script returns `draft: {title, body}` → commit runs with the parsed values → draft is deleted → amended commit preserves the message.

## Assumptions & contingencies

- **Subject folder detection unchanged.** Same `ls -dt .context/????-??-??.*/` as the current skill. If `qmd` ever replaces this (per `GLOBAL_OR_PROJECT-AGENTS.md`), both `git-commit-improved` and `git-commit` update together — out of scope here.
- **No `--message` / `--amend` overrides on the CLI.** The extension ignores arbitrary git flags; users wanting those should run `git commit` directly. Matches `b-pr-improved` (no `git`-flag passthrough).
- **Draft format unchanged.** `## Title` + blank line + title + blank line + `## Body` + blank line + body. Existing `b-save` writes this shape; no parser change required.
- **Model timeout 60s.** Same default as b-pr-improved (120s) but commit drafts are smaller — 60s is a safe ceiling. If a real run ever times out, raise to 120s.
- **Commit once a message exists.** If the model returns a usable `{title, body}`, the extension commits and never writes a draft file. If the model fails, returns garbage, or no model is available AND no draft was found, the extension writes `draft-commit.md` and stops — `/b-commit` or `/b-commit-improved` can pick it up on the next run. `--dry-run` is the only exception: it previews without committing but still writes the draft when the source was the model.
- **Cross-platform `git add` of deleted draft.** The skill's step 8 (`git add <draft-path> && git commit --amend --no-edit`) relies on the deletion being unstaged. If `git add` errors because the file no longer exists (race), wrap in try/catch and skip the amend — the commit already stands.
- **`force` flag applies only to protected branches.** It does NOT bypass "nothing staged" (code 3). Matches existing skill (line 47 only mentions force in the protected-branch context).
- **No `--base` / `--destination` parity.** This skill has no base branch; `git-commit-improved` is fully local. The `args.extraContext` field collects the rest of `$ARGUMENTS` after flag stripping, fed verbatim to the model — preserves the existing skill's "additional user context" behavior (line 16).
