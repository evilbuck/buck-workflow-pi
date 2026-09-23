---
date: 2026-09-21
domains: [skills, docs, testing]
topics: [b-save, code-review, thin-wrapper, portable-paths, codex-plugin]
related: [dead-unwired-extensions-build-2026-09-21.md]
priority: medium
status: completed
subject: 2026-09-21.skill-command-extension-audit
artifacts:
  - phase-2-bsave-and-code-review.md
  - plan-skill-surface-cleanup-phases.md
  - plan-skill-surface-cleanup.md
  - draft-commit.md
  - review-zz-buck-loop-2026-09-21T14-29-18-468Z.md
---

# b-save thin loader and portable code-review paths

Phase 2 build and independent `/b-review` are complete.

`skills/b-save/SKILL.md` is now the canonical procedure. It retains all 12 responsibilities, including the full memory frontmatter example, explicit backlog archive flow, discrete-phase and iterate consolidation substeps, lifecycle closeout, OMP/non-OMP memory behavior, write scope, and the instruction to execute all responsibilities. `prompts/b-save.md` is a 13-line loader; `commands/b-save.md` remains a symlink; the Codex-bundled skill is byte-identical.

`skills/code-review/SKILL.md` now writes GitHub PR reports to `.context/YYYY-MM-DD.<pr-number>-<kebab-title>/review-pr-<N>.md`, initializes and activates new subject folders, and explicitly preserves no-argument local output at repository-root `CODE-REVIEW.md`. `prompts/code-review.md` documents the extension-backed local Reviewer/Fixer command versus the portable release-PR skill.

Independent review passed every Phase 2 acceptance criterion with no in-plan or out-of-plan findings and no iterate artifact. It flagged stale living-doc wording in `docs/extension-loading.md` and `docs/buck-workflow.md`; that non-blocking follow-up is tracked in `.context/backlog/items/sync-b-save-canonical-docs.md`.

## Verification

- `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` — 11/11 passed.
- `wc -l prompts/b-save.md` — 13.
- `readlink commands/b-save.md` — `../prompts/b-save.md`.
- `diff -rq skills/b-save plugins/buck-workflow/skills/b-save` — no differences.
- Search for `/mnt/c/Code/plans` under `skills/code-review/` — no matches.
- `npm run guardrails:check` — pass; unit pass, coverage 84.5% vs 84% baseline, complexity 30/30 with no violations.
- `/b-review` — Pass; all acceptance criteria complete, no findings, durable guardrails pass.

## Files Modified

- `skills/b-save/SKILL.md`
- `plugins/buck-workflow/skills/b-save/SKILL.md`
- `prompts/b-save.md`
- `skills/code-review/SKILL.md`
- `prompts/code-review.md`
- Phase, plan, memory, and draft-commit artifacts under `.context/`
