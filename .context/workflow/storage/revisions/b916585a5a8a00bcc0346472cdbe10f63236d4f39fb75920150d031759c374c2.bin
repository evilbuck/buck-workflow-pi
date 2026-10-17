---
status: completed
date: 2026-08-26
subject: 2026-08-26.b-init-guardrails-on-repo
topics: [b-init-guardrails, guardrails.json, vitest, lizard, coverage, patch-gate]
memory: [b-init-guardrails-on-repo-2026-08-26.md]
---

# Init quality guardrails on buck-workflow-pi

## User Goal

Record a durable check contract on this repo so `/b-review` and session closeout use `guardrails.json` instead of ad-hoc `npx vitest run` / `npx tsc --noEmit`.

Confirmed with the user 2026-08-26: no Playwright/e2e gate; unit testing is the suite; Playwright stays as optional b-build scaffolding.

## What shipped

- `guardrails.json` v2 at repo root
- Managed `AGENTS.md` block (`<!-- BEGIN b-init-guardrails -->`)
- `@vitest/coverage-v8`; `coverage/` gitignored
- `vite.config.ts` excludes three Bun-only test files so `vitest run` exits 0

## First `/b-guardrails-check`

Durable v2. Unit pass (307). Lint/functional skipped. Global ratchet pass (54.9% == baseline). Complexity pass (34/34). **Patch gate fail: 51% vs 90%** on `origin/master...HEAD` plus dirty tree — uncovered lines in `b-kamal-release`, `b-pr-improved`, `b-commit-improved`, `command-progress` (pre-existing branch work, not init files).

## Related

Skill authoring subject: `.context/2026-07-26.b-init-guardrails/`
Memory: `.context/memory/b-init-guardrails-on-repo-2026-08-26.md`
