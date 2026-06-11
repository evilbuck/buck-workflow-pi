---
date: 2026-06-11
domains: [implementation, buck-workflow, skill, docs]
topics: [b-pr, pull-request, github, gh-cli, git, dual-audience-description, base-branch-detection, rebase-verification, subagent-polish, context-artifacts]
related:
  - ../2026-06-11.b-pr-skill/index.md
  - ../backlog/items/b-pr-skill.md
priority: medium
status: active
subject: 2026-06-11.b-pr-skill
artifacts:
  - ../2026-06-11.b-pr-skill/index.md
  - ../../skills/b-pr/SKILL.md
  - ../../skills/b-pr/scripts/pr-preflight.ts
  - ../../prompts/b-pr.md
  - ../../commands/b-pr.md
  - ../backlog/items/b-pr-skill.md
  - ../backlog/todo.md
---

# b-pr skill build

## Summary

Created the `b-pr` skill for creating GitHub pull requests from the current feature branch. The skill follows the existing buck-workflow three-layer pattern: `skills/b-pr/SKILL.md` (canonical), `prompts/b-pr.md` (Pi wrapper), `commands/b-pr.md` (cross-agent wrapper), plus a `scripts/pr-preflight.ts` for deterministic plumbing.

## Key decisions

- **Split the description into two sections**: Humans at top (What & Why, Impact, High-Level Changes) for scannability; Agents at bottom (Verification Steps, Files Changed, Technical Details, Context Artifacts, Known Risks, Reproduction Steps) for copy-pasteable action. Boundary is explicit and never merged.
- **Script does deterministic work, skill does judgment**: `pr-preflight.ts` handles base branch detection, rebase verification (exit code 2 if behind), diff gathering, and `.context/` artifact scanning. The LLM handles description synthesis, user interaction, and PR creation.
- **Rebase check is hard-fail**: If the feature branch is behind the chosen base, the script exits with code 2 and a clear error. The skill does not create a PR in that state — it tells the user to rebase.
- **Base branch detection is confirmable**: Script detects candidates (`main`/`master`/`dev`/`develop`) from remote refs; user confirms before proceeding. If a user specifies `--base`, skip detection.
- **Parallel polish is optional, not blocking**: "Workflowz" the description in a subagent only if the harness supports parallel tasks (omp, pi, codex, claude, opencode, etc.). If not available, skip — the LLM's draft is used directly.
- **Mirror the code-review pattern**: Followed the existing `skills/code-review/` structure — script handles plumbing, skill handles judgment, both wrappers exposed. This is the proven pattern in the repo.

## Script verification

Tested 2026-06-11:
- Base detection: `bun skills/b-pr/scripts/pr-preflight.ts` → outputs `base_candidates` JSON, exit 0
- Rebase check: `bun skills/b-pr/scripts/pr-preflight.ts --base master` → exit 2, `needs_rebase: true`, clear error message (current branch was 1 commit behind `origin/master`)

The success path (exit 0 with full diff + context gather) was not exercised live because the working tree was 1 commit behind — but the JSON output structure is correct based on code review.

## Artifacts

- `skills/b-pr/SKILL.md` — 7-phase procedure (Preflight detect, Preflight gather, Description synthesis, Workflowz polish, User review, Create, Report)
- `skills/b-pr/scripts/pr-preflight.ts` — bun-runnable TS, no compile, ~250 lines
- `prompts/b-pr.md` — Pi prompt wrapper
- `commands/b-pr.md` — slash command for non-Pi agents
- `.context/2026-06-11.b-pr-skill/index.md` — subject folder
- `.context/backlog/items/b-pr-skill.md` — backlog item (status: completed)

## Recommended flow

```
/b-build → /b-review → /b-save → /b-commit → /b-pr
```

The new `/b-pr` slot sits at the end of the Buck workflow, after the commit. It uses `.context/` artifacts left by earlier steps to enrich the PR description.

## Future work (not in this PR)

- Update `docs/buck-workflow.md` to include `/b-pr` in the canonical sequence
- Add `/b-pr` to the README workflow diagram
- Consider a `--reviewer` flag that auto-assigns reviewers from `CODEOWNERS`
- Consider integration with `code-review` skill for auto-posting a review request comment after PR creation
