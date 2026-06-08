---
date: 2026-06-07
domains: [implementation, buck-workflow, skill, docs, pi, omp]
topics: [code-review, pr-review, pr-context, submit-review, worktree, gh-api, bun-scripts, harsh-review, docs-reality-pass, README, OMP, cross-platform]
related:
  - ./docs-reality-pass-2026-06-07.md
  - ../2026-06-01.skill-universality-exploration/research-universal-skills.md
  - ../2026-06-01.deprecate-b-flow/plan-deprecate-b-flow.md
priority: high
status: active
subject: code-review-skill
artifacts:
  - skills/code-review/scripts/pr-context.ts
  - skills/code-review/scripts/submit-review.ts
  - skills/code-review/SKILL.md
  - prompts/code-review.md
  - commands/code-review.md
  - README.md
  - docs/buck-workflow.md
  - docs/b-flow.md
  - .gitignore
  - .context/memory/index.md
  - .context/2026-06-06.user-goal-requirement/plan-user-goal-requirement.md
---

# Code review skill build + docs reality pass (2026-06-07)

## What was built

**Universal code-review skill** (portable across Pi and OMP):

- `skills/code-review/scripts/pr-context.ts` — Arg parser + PR resolution via `gh` + worktree bootstrap at `.worktrees/pr-N/`. Writes `pr-context.json` (PR metadata, changed file detail) and `pr.diff`. 385 lines, zero deps (bun runtime + git + gh + jq).
- `skills/code-review/scripts/submit-review.ts` — Reads `findings.json` + `summary.md` from the worktree, validates paths/lines/body against the PR context, POSTs one review via `gh api` (all inline comments + body in one atomic call). 312 lines.
- `skills/code-review/SKILL.md` — Two-mode protocol (local / PR). PR mode delegates plumbing to the scripts; LLM owns the actual review. 261 lines.
- `prompts/code-review.md` — Universal prompt wrapper supporting `$ARGUMENTS`.
- `commands/code-review.md` — OMP symlink to `../prompts/code-review.md`.
- `.gitignore` — +2 entries (`.worktrees/`, `CODE-REVIEW.md`).

**Design choices:**
- Zero npm dependencies — `bun` runtime for TS execution, `git` + `gh` + `jq` for git/GitHub operations
- Scripts handle all plumbing (arg parse, PR resolution, worktree, fork fetch, API call) — LLM only reads files and writes findings
- Single POST for all inline comments (one `gh api` call, atomic)
- Remote-tracking ref namespace (`refs/remotes/_pr/<N>/head`) avoids worktree collision
- Strict typecheck with `bunx tsc --noEmit --strict` passes clean

**Verified end-to-end** on `https://github.com/evilbuck/qrpro/pull/2`:
- `pr-context.ts` — resolved PR, created worktree, captured 142KB diff
- `submit-review.ts --dry-run` — validated findings shape
- `submit-review.ts` — blocked on validation failure, then posted cleanly

**Docs reality pass:**
- `README.md` — Rewritten to describe Pi + OMP as maintained targets. References `~/.omp/agent/AGENTS.md` as primary global location. Removed stale claims about `/b-save` and `/b-mode` being extension-registered. Added OMP command mirror docs.
- `docs/buck-workflow.md` — Documented runtime mapping, current wired extension scope, `/b-save` as pure prompt/skill, OMP command mirror, b-flow as deprecated.
- `docs/b-flow.md` — Opens with deprecated/unwired archival status note.

**User-Goal Requirement plan** (`.context/2026-06-06.user-goal-requirement/plan-user-goal-requirement.md`):
- Status: completed. All 6 skill files updated with user goal sections/templates/gates.
- Key invariants: `b-build` gets a soft gate (flag, not block); `b-save` gets a warning; `b-phase` inherits parent goal by default; templates include `## User Goal` in canonical position.

## Why opt-in for code-review as a universal skill (vs b-review sibling)

The code-review skill avoids creating a new skill that duplicates b-review's scope. It stays opinionated, harsh, and script-backed — b-review is contract-verification, code-review is code-quality critique. Clear separation: b-review for "did we deliver what was planned"; `/code-review` for "is this code actually good."

## Cross-references

- User-goal requirement plan: `.context/2026-06-06.user-goal-requirement/plan-user-goal-requirement.md`
- Skill universality research: `.context/2026-06-01.skill-universality-exploration/research-universal-skills.md`
- b-flow deprecation lesson: `.context/2026-06-01.deprecate-b-flow/plan-deprecate-b-flow.md`
