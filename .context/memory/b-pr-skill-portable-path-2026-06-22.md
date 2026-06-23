---
date: 2026-06-22
domains: [skill, buck-workflow, docs]
topics: [b-pr, skill-path, skill_dir, context-artifacts, implementation-vs-research, omp-install, portable-skills]
related: [b-pr-skill-build-2026-06-11.md]
priority: medium
status: completed
subject: 2026-06-22.b-pr-skill-portable-path
artifacts:
  - skills/b-pr/scripts/pr-preflight.ts
  - skills/b-pr/SKILL.md
  - prompts/b-pr.md
  - commands/b-pr.md
---

# b-pr: portable script path + `.context/**` as research (not implementation)

## Context

`/b-pr` failed from a separate omp instance with a module-not-found on `scripts/pr-preflight.ts`. Root cause: the skill hardcoded `bun skills/b-pr/scripts/pr-preflight.ts`, a path that only resolves from the buck-workflow-pi repo root. Installed via `omp install <path>`, the script lives at the skill's installed location, not under the target repo's `skills/b-pr/`.

Separately, the user wanted `.context/**` treated strictly as the research/development that *informed* the implementation — never as part of the deliverable.

## Decisions

1. **Path convention: `<skill_dir>`.** Resolve to the directory containing the loaded `SKILL.md`. This is the repo's existing portable convention (`skills/pi-rpc/SKILL.md` already uses it). It works in-repo and post-`omp install` because the agent resolves it to the skill's real location independent of the target repo cwd. Preferred over `b-auto-fix`'s `<path-to-buck-workflow>` (assumes a single checkout) and over hardcoded `skills/b-pr/...` (only works from one cwd).
2. **Command wrappers use a sibling reference, not `<skill_dir>`.** A command file (e.g. `commands/b-pr.md`) is read before the skill is loaded, so `<skill_dir>` is undefined there. `install.mjs` installs commands and skills as sibling trees, so the command points to `../skills/b-pr/SKILL.md`. `<skill_dir>` is reserved for inside the skill and the prompt wrapper (which loads the skill first).
3. **Split the diff contract.** Replaced the single `changed_files[]` with `implementation_files[]` (everything except `.context/**`) + `context_files[]` (all changed `.context/**`). `diff_stat` is computed implementation-only (`git diff --stat ... :(exclude).context`) so it stays self-consistent with `implementation_files[]`.
4. **`context_artifacts[]` is changed-only.** Previously a whole-tree scan of `.context/YYYY-MM-DD.*/` — stale unrelated plans could leak in. Now derived from `context_files[]` (the changed `.context/**` set), parsed for `plan-/spec-/brainstorm-/research-/phase-*.md`. Paths normalized to repo-relative (they were absolute before, which would have broken a changed-set membership check).

## Key gotcha

`git diff --stat base..HEAD -- . :(exclude).context` must be passed via `execFileSync` (no shell) — the `:(...)` pathspec parens break the pi-natives shell when typed into a bash invocation, but git accepts the literal arg fine when passed as an array element.

## Verification

- Base-detection run: exit 0, valid JSON.
- No-shell node mirror: pathspec accepted; split classifies 4 impl / 5 context on a real range.
- `tsc -p tsconfig.json`: 0 errors in `pr-preflight.ts`.

## Files

- `skills/b-pr/scripts/pr-preflight.ts` — contract split + `<skill_dir>` usage + changed-only artifacts.
- `skills/b-pr/SKILL.md` — `<skill_dir>` paths; `.context/**` reframed throughout; new "`.context/**` Is Research, Not Implementation" section.
- `prompts/b-pr.md` — `<skill_dir>` paths + resolution note; field/section updates.
- `commands/b-pr.md` — sibling `../skills/b-pr/SKILL.md` reference.
