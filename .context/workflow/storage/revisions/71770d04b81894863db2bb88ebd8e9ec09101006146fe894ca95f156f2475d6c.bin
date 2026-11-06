---
status: completed
---

# b-pr skill: portable script path + .context-as-research reframing

## User Goal

Two fixes to `skills/b-pr/`:

1. **Module-not-found from a separate omp instance.** The skill hardcoded `bun skills/b-pr/scripts/pr-preflight.ts`, which only resolves from the buck-workflow-pi repo root. Installed via `omp install <path>` (or any skill loader), that path does not exist in the target repo, so `/b-pr` failed.
2. **`.context/**` is research, not implementation.** `.context/**` changes should be treated as the research/planning that *informed* the implementation — never listed as part of the deliverable.

## Changes

- `skills/b-pr/scripts/pr-preflight.ts`
  - Usage header now uses `<skill_dir>` (directory containing `SKILL.md`).
  - Split `changed_files[]` → `implementation_files[]` (everything except `.context/**`) + `context_files[]` (all changed `.context/**`).
  - `diff_stat` excludes `.context/**` via git pathspec `:(exclude).context` (matches `implementation_files[]`).
  - `context_artifacts[]` now derived from **changed** `.context/**` files only (no whole-tree scan), so stale unrelated plans can't leak in. Paths normalized to repo-relative.
  - Removed unused `readdirSync`/`statSync` imports.
- `skills/b-pr/SKILL.md`
  - Added `<skill_dir>` resolution note; Phase 1/2 commands use `<skill_dir>/scripts/...`.
  - Phase 3 table, description template (Files Changed → `implementation_files[]` only; "Context Artifacts" → "Research & Planning Context"), polish prompt, behavior rules, and a new "`.context/**` Is Research, Not Implementation" section all aligned.
  - Frontmatter description + intro reframed.
- `prompts/b-pr.md` — `<skill_dir>` paths + resolution note; fields/section names updated.
- `commands/b-pr.md` — sibling-tree reference `../skills/b-pr/SKILL.md` (command files live in a sibling `commands/` tree; `<skill_dir>` is reserved for inside the skill/prompt once loaded).

## Convention

`<skill_dir>` = directory containing the loaded `SKILL.md`. Adopted from `skills/pi-rpc/SKILL.md` (the repo's existing portable convention). Works in-repo and when installed via `omp install`, because the agent resolves it to the skill's actual location regardless of the target repo's cwd.

## Verification

- `bun skills/b-pr/scripts/pr-preflight.ts` (base detection): exit 0, valid JSON.
- No-shell node test mirroring the script: git accepts `:(exclude).context` pathspec → "4 files changed, 717 insertions" (impl-only); numstat split classifies 4 impl / 5 context on a real historical range.
- `tsc -p tsconfig.json`: 0 errors in `pr-preflight.ts`.
