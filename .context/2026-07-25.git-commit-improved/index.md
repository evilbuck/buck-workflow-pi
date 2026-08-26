---
status: completed
date: 2026-07-25
subject: 2026-07-25.git-commit-improved
---

# b-commit-improved

Code-driven counterpart to `b-commit`: deterministic Conventional Commits
flow mirroring the `b-pr-improved` ↔ `b-pr` pattern. Script owns the git
plumbing, extension owns orchestration + inline model draft + commit + cleanup
+ verify.

## Artifacts

- `plan-git-commit-improved-plan.md` — implementation plan (the plan file is
  copied to the subject folder from the OMP session storage; the canonical
  location remains the session `local://` URI referenced by the user prompt)

## Implementation

All work landed in this session:
- `skills/git-commit-improved/SKILL.md`
- `skills/git-commit-improved/scripts/commit-preflight.ts` (4 exit codes)
- `extensions/b-commit-improved/index.ts` (orchestrator + `fallbackDraft` export)
- `extensions/b-commit-improved/__tests__/wire.test.ts` (10/10 pass)
- `commands/b-commit-improved.md` (OMP fallback)
- `prompts/b-commit-improved.md` (Pi prompt wrapper)
- `extensions/index.ts` (2-line wire-up)

## Memory

- `.context/memory/b-commit-improved-2026-07-25.md`
- `.context/memory/b-commit-improved-placeholder-sentinels-2026-08-26.md` (2026-08-26 follow-up)

## Status

- 0 tsc errors in new files (5 pre-existing in `extensions/index.ts` baseline)
- 10/10 vitest pass on the new test file
- Follow-up 2026-08-26: unfilled drafts use dollar-sign sentinels; leftover angle-bracket titles refused. See `.context/2026-08-26.b-commit-placeholder-sentinels/`
- Manual smoke test: all 4 exit codes (0/1/2/3) confirmed end-to-end
- **Not committed** (original 2026-07-25 closeout note)
