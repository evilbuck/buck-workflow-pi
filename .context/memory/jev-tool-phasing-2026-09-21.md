---
date: 2026-09-21
domains: [planning, extensions, skills]
topics: [phasing, jev, typesafe, phase-difficulty, model-routing]
related: []
priority: high
status: completed
subject: 2026-09-21.jev-tool
artifacts:
  - plan-jev-tool-phases.md
  - phase-1-jev-tool-contract.md
  - phase-2-binary-difficulty-cutover.md
  - phase-3-b-phase-integration-and-proof.md
---

# Jev tool and boolean phase-difficulty phasing

`plan-jev-tool.md` is split into three sequential sessions:

1. **Jev Tool Contract** — hard, `/b-build-hard`: SDK dependency, generic registered tool, fail-closed contract, focused tests.
2. **Binary Difficulty Cutover** — hard, `/b-build-hard`: separate `PhaseDifficulty`, root/buck-loop consumer migration, legacy tolerance, review-Hardness separation.
3. **b-phase Integration and Proof** — medium, `/b-build`: one batched Noul request, threshold/audit stamp, canonical + Codex skill parity, docs, real-key smoke.

Dependencies form a HARD chain. Phases 1 and 2 share `extensions/index.ts`; Phase 3 joins the tool and parser contracts. `omp_execution` is omitted because the chain has shared files and no safe parallel frontier. Phase 1 is the only active backlog pickup; Phases 2–3 are listed as upcoming.

Current `b-phase` still uses the legacy three-tier phase-file schema, so these planning artifacts use `hard`/`medium`. Phase 2 explicitly preserves compatibility: historical `easy|medium` become `not-hard`; `hard` remains `hard`. Review Hardness stays three-tier.

## Verification

- Artifact consistency check: 15/15 checks passed across overview, phase ordering, dependencies, backlog links, memory links, and execution-loop sections.
- Marksman diagnostics: overview and all three phase files report `OK`.
- Subject lifecycle: canonical `active`, revision 2; three expected pending-phase blockers.
- Docs-only change set: deterministic code guardrails skipped.
- Commit not created: `git-commit` requires pre-staged changes and prohibits automatic staging; this worktree has no staged files plus unrelated unstaged `package.json`, Jev chooser, and `tools/` work.
