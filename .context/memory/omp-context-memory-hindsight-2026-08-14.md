---
date: 2026-08-14
domains: [tooling, buck-workflow, omp, docs, memory]
topics:
  - b-save
  - b-memory-import
  - hindsight
  - retain
  - recall
  - qmd
  - omp-memory
  - context-memory
subject: 2026-08-14.omp-context-memory-hindsight
artifacts:
  - skills/b-memory-import/SKILL.md
  - skills/b-memory-import/scripts/import-context-memory.ts
  - skills/b-memory-import/scripts/import-context-memory.test.ts
  - skills/b-save/SKILL.md
  - prompts/b-save.md
  - skills/b-build/SKILL.md
  - skills/b-explore/SKILL.md
  - skills/b-iterate/SKILL.md
  - skills/b-plan/SKILL.md
  - GLOBAL_OR_PROJECT-AGENTS.md
  - AGENTS.md
  - README.md
  - docs/buck-workflow.md
  - docs/oh-my-pi.md
  - docs/context-artifacts.md
  - .gitignore
related: []
priority: high
status: completed
---

# OMP native memory + b-memory-import + b-save (2026-08-14)

## What I did

1. Designed two-layer memory: `.context/memory` (required, portable) vs OMP LTM (`retain`/`recall`/`reflect` when backend is hindsight/mnemopi).
2. Built deterministic importer `skills/b-memory-import/scripts/import-context-memory.ts` (Bun): walk `.context/memory/**/*.md`, stable `document_id`, sha manifest, batch retain to Hindsight using OMP config credentials/scoping.
3. Ran full import on this repo: **86/86** into bank `evilbuck`, tag `project:buck-workflow-pi`.
4. Unit tests: `bun test skills/b-memory-import/scripts/import-context-memory.test.ts` — **17 pass**.
5. Updated `/b-save` to **12 responsibilities**: step 8 OMP retain/learn mirror; step 9 qmd optional best-effort.
6. Demoted qmd across bootstrap (`GLOBAL_OR_PROJECT-AGENTS.md`, `~/.agents/AGENTS.md`), `b-explore`, optional recall on `b-plan`/`b-build`/`b-iterate`.
7. Synced docs: `AGENTS.md`, `README.md`, `docs/buck-workflow.md`, `docs/oh-my-pi.md`, `docs/context-artifacts.md`.

## Decisions

- **Do not** call Hindsight HTTP from routine `/b-save` — use harness `retain` tool only.
- **Do not** replace `.context/memory` with LTM alone (git/PR/multi-harness).
- **qmd** is optional index only; never required when OMP memory tools exist.
- **b-memory-import** is one-shot/backfill only, not every save.
- Idempotency: path-stable `document_id` + gitignored `.context/memory/.omp-hindsight-import-manifest.json`.
- Default scoping matches OMP: `per-project-tagged` with `project:<git-root-basename>`.

## Verification

- Importer dry-run then live: 86 imported, 0 failed.
- Tests: 17 pass.
- Slash `/b-save` may still inject an **old 11-step prompt** if the harness cached an older `commands/b-save.md` body — source of truth is `prompts/b-save.md` (12 steps). Reload/restart agent if the injected body is stale.

## Next

- `/b-commit` on branch `feat/buck-save-memory-refactor`.
- If other projects need Hindsight seed: run importer with `--root <project>`.
