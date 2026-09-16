---
date: 2026-09-16
domains: [docs]
topics: [buck-workflow-doc, extension-loading-doc, readme-catalog, commands-mirror-drift, mermaid]
related: []
priority: medium
status: completed
---

# Docs catalog sync: buck-workflow.md, extension-loading.md, README

Session goal: explore the project and update the docs (especially `docs/buck-workflow.md`) for anything outdated or missing. Docs-only session — guardrails gate not applicable (all changed paths are `.md`).

## What was outdated (wrong statements, now fixed)

1. **Extension scope was under-documented everywhere.** Docs claimed `extensions/index.ts` wires only model auto-switch + TPS tracking. Reality (verified against `extensions/index.ts` imports + `wire()` calls): it composes 7 subsystems — model auto-switch (with `omp-models.ts` role mapping), TPS tracker, `/b-pr-improved`, `/b-commit-improved`, `/b-save-improved`, `/b-kamal-release` (all `registerCommand`), and the opt-in `plan-artifact.ts` `turn_end` bridge (`buckPlanArtifact.enabled` / `BUCK_PLAN_ARTIFACT=1`) that persists exited OMP plan-mode plans into `.context/` subject folders. Fixed in `docs/buck-workflow.md` (Runtime Extension Scope, Runtime Extension, implementation note, Key Concepts), `docs/extension-loading.md` (Extension contents, Current State tree), and `README.md` (Layered Architecture, Runtime mapping, Extension section + new Extension-Backed Commands table).
2. **Mermaid node-ID collisions in the Complete Flow Diagram.** `G2` was defined as both `/b-research` and `/skill:b-grill-me`; `N` as both `Implementation` and `/b-review`; `O` as both `HTML Presentation` and the issues-found decision. Mermaid merges re-declared nodes, so the rendered diagram was wrong. Renamed to `GR`/`IMP`/`RV`/`PR`/`IS` and added the missing `/b-commit` step before Done.
3. **Discoverability section** listed ~12 commands; actual catalog is 44 `commands/` entries + skill-only skills. Rewritten as a grouped full catalog.
4. **`Typical Next Step**` markdown typo (missing opening `**`) fixed.
5. Version stamp 2026-07-19 → 2026-09-16.

## What was missing (now documented)

- `docs/buck-workflow.md` gained mapping-table rows, Quick Reference rows, and detailed sections for: `b-arch-qa`, `b-blueprint`, `b-grill` (unified), `b-loop` (also cross-referenced from OMP Autonomous Loops), `b-backlog`, `b-fix-rebase-conflict`, `b-pr`, `b-pr-review-2-issues`, `b-issue-create`, `b-auto-fix`, `b-eval-upstream-prs`, `code-review`, `code-review-universal`, `skill-explainer`, `git-clean-orphans`, `product-tour`, `b-hindsight-import-projects`, and a grouped "Deterministic Extension Commands" section (`/b-pr-improved`, `/b-commit-improved`, `/b-save-improved`, `/b-kamal-release`). New §7 "Utilities & Housekeeping".
- Recommended Workflows gained optional `/b-pr` tail, Issue Lifecycle flow (`b-issue-create` → `b-triage` → `b-auto-fix`), rebase-conflict flow, fork-maintenance flow.
- `README.md` prompt table gained `/b-eval-upstream-prs`, `/b-phase`, `/b-pr`, `/b-pr-review-2-issues`, `/code-review`, `/code-review-universal`; skills table gained ~24 missing rows.
- Pi Implementation Matrix annotated as core-loop-only; QR table is the authoritative catalog.

## Key discovery: commands/ mirror drift

`commands/` has 44 entries: 36 symlinks + **8 real files**. Four diverged twins (full body in `prompts/`, thin loader in `commands/`): `b-pr`, `b-pr-review-2-issues`, `b-commit-improved`, `b-save-improved`. Four OMP-only (no `prompts/` twin): `b-kamal-release`, `b-pr-improved`, `git-clean-orphans`, `product-tour`. Documented in `docs/extension-loading.md` ("Current exceptions") and README's OMP Command Mirror section; fix deferred to backlog item `commands-mirror-drift`.

Counts for future reference: 67 skill dirs, 40 prompts, 44 commands.

## Files changed

- `docs/buck-workflow.md` (1697 → 2100 lines)
- `docs/extension-loading.md`
- `README.md` (428 → 472 lines; tail verified intact)
- `.context/backlog/items/commands-mirror-drift.md` (new), `.context/backlog/todo.md`
