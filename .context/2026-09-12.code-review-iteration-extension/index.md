---
status: completed
date: 2026-09-12
subject: 2026-09-12.code-review-iteration-extension
topics: [omp, extensions, code-review, isolated-sessions, reviewer-personas, model-catalog, hardness-routing]
---

# Subject: Isolated Code Review Iteration Extension

**Subject**: code-review-iteration-extension
**Date**: 2026-09-12
**Status**: completed

## User Goal

An OMP user can start one command that runs an observable review → verify/fix → re-review loop in isolated contexts until the change is clean, blocked, or reaches a bounded stopping condition, without filling the user's main agent context.

## Goal

Intake for an OMP extension that drives configurable Reviewer and dynamically selected Fixer sessions through a full isolated review loop, records non-prescriptive evidence-led findings, and separates issue criticality from fix hardness.

## Artifacts

| File | Type | Description |
|------|------|-------------|
| `brainstorm-code-review-iteration-extension.md` | brainstorm | First-draft concept, constraints, and open questions |
| `brainstorm-state-code-review-iteration-extension.json` | state | Interview count and external-edit detection |
| `draft-commit.md` | commit draft | Conventional Commit proposal for the implemented extension |
| `../../extensions/code-review-iteration/` | extension | Command wiring, loop, runtime state, policy, reports, catalog, personas, and tests |

## Inputs Used

- User requirements supplied in this session.
- Confirmed full-loop ownership, current-worktree targeting, two runtime roles, one portable reviewer persona per pass, a hybrid capability catalog, one different Fixer at the pass's maximum hardness when available, guidance-only prompt replacement, and a medium-plus/three-review loop bound.
- Confirmed fresh `origin` base fetch plus auto-rebase, hard-Fixer conflict recovery, an initial dirty-state checkpoint, and one verified commit per Fixer pass.
- Confirmed git-common per-pass/runtime artifacts, a terminal `.context/` report, validated auto-resume, and removal only of extension-created worktrees after clean completion.
- Confirmed disposable detached Reviewer worktrees, structured contract/allowlist command execution, host network with stripped credentials, and recorded reproduction evidence.
- Confirmed exact-selector model catalog schema, user-calibrated easy/medium/hard seeds, neutral provider/model persona launchers, and a local-only boundary with no GitHub PR integration.
- Existing OMP model/session and live-activity extension conventions.
- Existing `code-review-universal` report and PR-plumbing precedent.
- Prior isolated-session research and the `b-flow` deprecation boundary.
