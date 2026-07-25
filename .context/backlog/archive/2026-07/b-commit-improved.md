---
title: Make b-commit deterministic — b-commit-improved
status: completed
priority: high
created: 2026-07-25
updated: 2026-07-25
completed: 2026-07-25
related:
  - .context/2026-07-25.git-commit-improved/index.md
  - .context/2026-07-25.git-commit-improved/plan-git-commit-improved.md
  - .context/memory/b-commit-improved-2026-07-25.md
  - skills/git-commit/SKILL.md
  - extensions/b-pr-improved/index.ts
---

# Make b-commit deterministic — b-commit-improved

## Problem

The existing `git-commit` skill walks the agent through 11 agent-interpreted
steps to draft a Conventional Commits message and run `git commit`. Steps like
"detect active subject folder", "branch guard", "draft detection", and "amend
the commit to include the deleted draft" are fully deterministic — they should
be code, not prose. LLM steps (drafting the message from the staged diff)
deserve to stay inline via `createAgentSession`, but everything around them
should be a typed exit-code contract.

This mirrors the `b-pr-improved` ↔ `b-pr` pattern that already exists: code
owns the deterministic surface, prose owns only the un-modelable decisions.

## Desired outcome

`/b-commit-improved [--force] [--no-draft] [--dry-run] [--model <provider/id>]`
is a registered Pi/OMP command that performs the commit end-to-end without
the agent re-reading the skill. Cross-platform fallback (skill + command) for
non-Pi/OMP runtimes.

## Acceptance criteria

- `skills/git-commit-improved/SKILL.md` exists (contract).
- `skills/git-commit-improved/scripts/commit-preflight.ts` exists with 4 exit
  codes (0 ready, 2 protected, 3 nothing-staged, 1 git broken).
- `extensions/b-commit-improved/index.ts` orchestrates preflight → resolve
  `{title, body}` (draft or model) → commit in line → draft cleanup + amend →
  verify. Exports `fallbackDraft` for tests.
- `commands/b-commit-improved.md` (OMP) and `prompts/b-commit-improved.md`
  (Pi) cross-platform fallbacks exist.
- `extensions/index.ts` wired (`+wireBCommitImproved(pi)`).
- Unit tests cover: 3 wire tests, 5 script plumbing tests for all 4 exit
  codes + draft parsing, 2 fallbackDraft tests.
- 0 tsc errors in new files.

## Outcome

All criteria met on 2026-07-25. See `.context/2026-07-25.git-commit-improved/index.md`
and `.context/memory/b-commit-improved-2026-07-25.md`. 10/10 vitest pass;
0 tsc errors in new files; manual smoke test confirmed all 4 exit codes.
