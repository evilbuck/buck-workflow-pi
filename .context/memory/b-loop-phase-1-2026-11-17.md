---
date: 2026-11-17
domains: [b-loop, omp, validation, workflow]
topics: [b-loop, omp-eval, module-import, preflight-validation, a-4]
related: [.context/2026-11-17.b-loop-repair/phase-1-entry-and-validation.md, .context/2026-11-17.b-loop-repair/plan-b-loop-repair.md]
priority: high
status: completed
subject: 2026-11-17.b-loop-repair
artifacts:
  - phase-1-entry-and-validation.md
  - review-phase-1-entry-and-validation.md
  - iterate-phase-1-entry-and-validation.md
---

# Memory: Phase 1 — `/b-loop` Entry, Invocation Contract & Pre-Flight Validation

## Summary

Completed Phase 1 of `.context/2026-11-17.b-loop-repair/plan-b-loop-repair.md`, replacing `%load` startup and mock bridge fallbacks with installed ES module import and strict fail-closed pre-flight validation.

## Key Decisions & Implementation

- **`prompts/b-loop.md` & `skills/b-loop/SKILL.md`**: Kept `$ARGUMENTS` strictly outside executable JS strings/backticks (serialized via `"__BUCK_LOOP_ARGS__"`), resolved installed `skills/b-loop/scripts/eval-buck-loop.ts` across `BUCK_LOOP_RUNNER`, `cwd`, plugin roots, `PI_CONFIG_FILES`/`config.yml`, and skill dirs (`fs.statSync(...).isFile()` + `fs.realpathSync`), guarded all 8 OMP bridge globals with `typeof ... !== "undefined"`, and invoked `runBuckLoop` once (top-level auto-run removed).
- **`skills/b-loop/scripts/types.ts`, `frontmatter.ts`, `validation.ts`, `eval-buck-loop.ts`**:
  - Enforced single named subject ID via `parseSubjectArgument` (rejecting empty args, removed `--status`/`--resume`/`--stop`/profile flags, auto-selection, multiple tokens, and paths).
  - Enforced fail-closed `validateBridges` requiring `agent`, `wait`, `judge`, `sh`, `phase`, `log`, and `tool.workflow_state` (`object` or `function` host — OMP 18.22.0 exposes `typeof tool === "function"`).
  - Scoped Git probes (`validateNamedBranch`, `tryReadGitOrigin`) via `git -C <cwd>` and failed closed on `ShellError` throws or non-zero exits, detached `HEAD`, unborn branches, and non-Git directories.
  - Built a zero-bare-specifier indent-stack storage YAML validator (`validateStorageConfig`) rejecting non-`repo-files` adapters, `integration_ref`, flow mappings, YAML anchors/aliases, duplicate keys, and ambiguous multi-project origin matches.
  - Resolved and pinned plan + ordered discrete `phase-*.md` revisions via `tool.workflow_state({ operation: "list", subjectId })`, surfacing `isError: true` tool errors and rejecting unphased plans or duplicate orders.

## Verification

- **Assumption `A-4`**: Validated in `eval-buck-loop.test.ts` by extracting the JS eval snippet from `prompts/b-loop.md` and running 5 cases inside real `omp __omp_worker_js_eval_process` from an external Git worktree lacking `skills/`: plugin install (`--status` rejection + valid subject pinning without `budget`), `config.yml` `extensions:` resolution, shell/template injection payload safety, and missing `BUCK_LOOP_RUNNER` fail-closed.
- `npx vitest run skills/b-loop/scripts/eval-buck-loop.test.ts scripts/commands-mirror.test.ts`: 17/17 passed (with `A-4` real `omp` test unskipped).
- `lizard -C 10 -w skills/b-loop/scripts/*.ts`: 0 complexity warnings.
- `npx tsc --noEmit`: 0 errors in `skills/b-loop/`.
- `npm run guardrails:check`: `status: "pass"`, `coverage: 88.3%` (baseline `84%`), `hotspots_remaining: 27` (baseline `30`), 0 new complexity violations.
- `npm run subject-lifecycle:check`: `{"ok":true,"violations":[]}`.
