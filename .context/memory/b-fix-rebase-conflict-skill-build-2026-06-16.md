---
date: 2026-06-16
domains: [implementation, skill, docs, testing]
topics: [b-fix-rebase-conflict, rebase, merge-conflict, semantic-merge, bun-script]
related: [".context/2026-06-16.b-fix-rebase-conflict/plan-b-fix-rebase-conflict.md", "skills/b-fix-rebase-conflict/SKILL.md", "skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts", "skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.test.ts", "README.md"]
priority: medium
status: completed
subject: 2026-06-16.b-fix-rebase-conflict
artifacts: ["plan-b-fix-rebase-conflict.md", "index.md"]
---

# b-fix-rebase-conflict skill build

Built the new `b-fix-rebase-conflict` skill end-to-end.

## What changed
- Added `skills/b-fix-rebase-conflict/SKILL.md` with a phased conflict-resolution workflow, write boundary, semantic-merge strategy, safety rules, manual gate, and explicit rebase-vs-merge ours/theirs semantics.
- Added `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts`, a bun CLI that detects active merge/rebase state, parses conflict hunks including diff3 base blocks, gathers per-file commit intent, and scans `.context/` subject artifacts plus recent memory files.
- Added `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.test.ts` and expanded `vite.config.ts` so skill-script tests are discovered under `skills/**/scripts/**/*.test.ts`.
- Added thin wrapper `prompts/b-fix-rebase-conflict.md` and OMP mirror `commands/b-fix-rebase-conflict.md`.
- Updated `README.md` prompt, skill, and workflow tables.

## Verification
- `bun skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts` in this repo exited `2` with `no active rebase or merge conflict`.
- Synthetic merge-conflict repo: script reported `operation: merge`, `oursLabel: HEAD`, `theirsLabel: feature`, and preserved main-vs-feature content separation.
- Synthetic rebase-conflict repo: script reported `operation: rebase`, `ours` as upstream/base, `theirs` as replayed commit, and surfaced the replayed commit label in the hunk.
- `npx vitest run skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.test.ts` passed.
- `lsp diagnostics` returned OK for `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts`, `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.test.ts`, `skills/b-fix-rebase-conflict/SKILL.md`, and `vite.config.ts`.

## Notes
- The highest-risk behavior is the rebase ours/theirs inversion. The script now emits `sideSemantics` so the skill can repeat the meaning in its report instead of inferring from raw marker labels.
- Vitest previously only discovered `extensions/**/*.test.ts` and `scripts/**/*.test.mjs`; the new include keeps skill-local CLI tests first-class without widening unrelated globs.
