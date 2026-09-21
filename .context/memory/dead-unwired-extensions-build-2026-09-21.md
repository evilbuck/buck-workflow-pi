---
date: 2026-09-21
domains: [extensions, skills, docs, testing]
topics: [dead-code, grill-document-mode, guardrails, codex-plugin, backlog]
related: []
priority: medium
status: completed
subject: 2026-09-21.skill-command-extension-audit
artifacts:
  - phase-1-dead-unwired-extensions.md
  - plan-skill-surface-cleanup-phases.md
  - plan-skill-surface-cleanup.md
  - draft-commit.md
  - review-zz-buck-loop-2026-09-21T14-20-06-440Z.md
---

# Dead unwired extensions — Phase 1 build and review

Deleted `extensions/grill-me-dialog.ts`, `extensions/tmux-window-status.ts`, its test, and the five-file `extensions/b-grill-auto/` subsystem. `extensions/index.ts` was unchanged and continues to wire the same eight modules plus model auto-switch.

Replaced all `grill-me_dialog` instructions in `b-grill`, `b-grill-me`, and `b-grill-with-docs` with a deterministic QA-file handoff: create the next unused `.context/<subject>/grill-qa-<slug>-<n>.md`, tell the user its path, wait for a chat message, then parse the file on the next turn. Canonical and Codex-bundled copies remain byte-identical. `b-grill-auto` remains a skill-only workflow.

Removed the three deleted-function rows from `guardrails.json`, updated live extension documentation, and archived both the obsolete live-extension test backlog item and the completed phase backlog item. The umbrella cleanup remains active for Phase 2.

Independent `/b-review` passed with no in-plan or out-of-plan findings. It confirmed every Phase 1 acceptance criterion, found no additional documentation or how-to impact, and created no iterate artifact. Phase 2 remains pending, so the parent plan and subject stay active.

## Verification

- `npx vitest run extensions/buck-mode.test.ts` — 7/7 passed.
- `npx vitest run scripts/codex-plugin.test.ts` — 18/18 passed.
- `diff -rq` for all three canonical/bundled grill directories — no differences.
- Live-source searches for deleted paths and `grill-me_dialog` — no matches.
- `npm run guardrails:check` — pass; unit pass, coverage 84.5% vs 84% baseline, complexity 30/30 with no violations.
- `/b-review` — Pass; no findings; durable guardrails pass at 84.5% coverage with 30/30 complexity hotspots.

## Files Modified

- Deleted the three unwired extension surfaces under `extensions/`.
- Updated `guardrails.json`, `README.md`, `docs/extension-loading.md`, and `docs/buck-workflow.md`.
- Updated canonical and bundled grill skill instructions.
- Updated phase, plan, review, backlog, archive, draft-commit, and memory artifacts under `.context/`.
