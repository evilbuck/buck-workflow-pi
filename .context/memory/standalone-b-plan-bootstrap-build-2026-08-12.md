---
date: 2026-08-12
domains: [implementation, skill, docs, testing]
topics: [b-plan, standalone, capability-probe, bootstrap, install-detection, github, cross-harness]
related:
  - .context/2026-08-12.standalone-b-plan-bootstrap/plan-standalone-b-plan-bootstrap.md
  - .context/backlog/items/active-subject-discovery.md
  - skills/b-plan/SKILL.md
  - prompts/b-plan.md
  - agent-install_instructions.md
  - README.md
priority: high
status: completed
subject: 2026-08-12.standalone-b-plan-bootstrap
artifacts:
  - plan-standalone-b-plan-bootstrap.md
  - draft-commit.md
---

# Standalone B-Plan bootstrap build

## Summary

Made B-Plan self-contained when it is the only Buck skill loaded. It now probes the active harness's loader-native catalog for `b-build`, `b-review`, and `b-save`, classifies `full` / `partial` / `standalone` / `unknown`, and selects either the existing full workflow or a bounded standalone planning path.

The standalone path resolves or creates a subject without `_shared`, writes an active subject index plus complete plan, skips unavailable backlog/memory/phasing/review/commit behavior, and gives a safe harness-specific GitHub install or repair handoff with mandatory reload and sentinel recheck.

## Decisions

- Active-session loader evidence is authoritative. Source checkouts, manifests, install records, harness executables, bootstrap files, `.context/`, and filesystem reads are not proof that a companion skill is loaded.
- `full` means all three minimum execution-cycle sentinels resolve. `partial` names missing sentinels; `standalone` requires an authoritative zero-result catalog; `unknown` never becomes a false absence claim.
- Full-mode cross-reference stitching, backlog creation, phasing, OMP execution recommendations, eval cells, and downstream handoffs remain gated behind `full`.
- Standalone subject resolution validates a session pointer, then scans canonical subject indexes. It presents every active subject rather than selecting newest or truncating to a structured-prompt shortlist.
- The canonical repository is `evilbuck/buck-workflow-pi`. A live OMP install proved the previous `buckleyrobinson/buck-workflow-pi` commands returned GitHub 404; all active B-Plan/install/README guidance was corrected.
- Subject-discovery efficiency and stale-state authority are separate follow-up work, recorded in `.context/backlog/items/active-subject-discovery.md` rather than added to this build.

## Files Modified

- `skills/b-plan/SKILL.md`
- `prompts/b-plan.md`
- `agent-install_instructions.md`
- `README.md`
- `.context/2026-08-12.standalone-b-plan-bootstrap/plan-standalone-b-plan-bootstrap.md`
- `.context/2026-08-12.standalone-b-plan-bootstrap/index.md`
- `.context/backlog/items/active-subject-discovery.md`
- `.context/backlog/todo.md`
- `.context/memory/standalone-b-plan-bootstrap-build-2026-08-12.md`
- `.context/memory/index.md`
- `.context/workflow/current-session.json`

Unrelated user changes in `package.json`, `scripts/publish.mjs`, and `skills/b-init-guardrails/scripts/detect-stack.ts` were not modified.

## Verification

- RED: isolated OMP with only B-Plan falsely reported `full` by scanning the source checkout and listing 45 skill directories.
- GREEN states in isolated OMP profiles:
  - authoritative catalog with B-Plan only → `standalone`, missing all three sentinels;
  - B-Plan + `b-build` → `partial`, missing `b-review` and `b-save`, repair handoff;
  - B-Plan + all sentinels → `full`, no missing sentinels, full handoff;
  - no authoritative inventory → `unknown`, missing set remains unknown and guidance is conditional.
- Real OMP transition in one isolated profile: pre-install `standalone` → `omp plugin install git:github.com/evilbuck/buck-workflow-pi` → fresh unfiltered session `full`; the isolated plugin was uninstalled afterward.
- Repository identity verified through GitHub as `evilbuck/buck-workflow-pi`; the stale owner command reproduced a 404 before correction.
- `npx vitest run scripts/install.test.mjs --reporter=verbose`: 35/35 passed, including non-force real-file conflict safety.
- `npm run context:validate`: 0 errors, 71 pre-existing legacy warnings.
- `npm test`: 16 files passed; 3 unrelated suites failed (31 tests) because the npm/Vitest runtime lacks Bun globals, Kamal is not installed, and an existing fallbackDraft cwd assertion fails. The changed installer suite passes independently.
- `/b-save`: plan/memory cross-reference stitched, subject marked completed, memory index already current. `qmd update` could not run because its global `better-sqlite3` binary targets Node module ABI 127 while the active Node runtime requires ABI 147.

## Next

Proceed to `/b-commit`, then `/b-pr` as explicitly requested. Pre-commit `/b-review` was not run in this session.
