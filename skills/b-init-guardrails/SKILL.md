---
name: b-init-guardrails
description: One-shot, idempotent initialization of quality guardrails (lint, unit tests, functional tests, coverage, cyclomatic complexity) with a brownfield ratchet. Detects the stack, proposes tooling, measures the baseline, writes guardrails.json, installs a managed AGENTS.md block, and vendors the guardrails skills that block references into the repo.
---

# b-init-guardrails: Quality Guardrails Initialization

Initialize quality guardrails in any codebase — greenfield or brownfield. Detects the language stack, proposes tooling changes (with user approval), measures coverage and cyclomatic complexity, records the baseline, writes `guardrails.json`, installs a managed `AGENTS.md` block, and copies the skills that block loads into the repo.

**Idempotent**: safe to re-run. Refresh mode updates the managed block and the vendored skill trees in place.

**Brownfield-safe**: measures where the repo is, then plans a gradual path to the target. Never sets an unreachable goal on day one.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | baseline measurement, patch gate |
| `bun` | runs detect-stack.ts |

## Invocation

```
/b-init-guardrails
```

## Procedure

> **`<skill_dir>`** = the directory of the loaded `b-init-guardrails` skill. Resolve relative to this skill's location.

### Phase 0: Idempotency Check

Check if `guardrails.json` exists at the repo root.

- **If exists and `version == 1`**: enter **refresh mode** with a v1→v2 upgrade. Re-detect the stack, run the v1→v2 field upgrade through the Phase 2 propose-then-approve flow, then re-measure with the recorded/approved commands, and apply only asymmetric improvements: raise `ratchet.baseline_coverage`, shrink complexity inventory, never lower the coverage baseline, never add new complexity debt without explicit user approval. The `lint_cmd: null`, `lint_accepts_paths: false`, `functional_test_cmd: null`, and `ratchet.baseline_lint_clean: null` placeholders for v1 are filled by the same Phase 2 flow.
- **If exists and `version == 2`**: enter **refresh mode** — re-detect the stack, re-measure with the recorded/approved commands, and apply only asymmetric improvements.
- **If absent**: enter **create mode** — proceed to Phase 1.

### Phase 1: Detect Stack

Run the detection script:

```bash
bun <skill_dir>/scripts/detect-stack.ts
```

Parse the JSON output. Display the detected ecosystems and the resolved patch-gate compare branch to the user:

```
Detected ecosystems:
- TypeScript (package.json) — vitest: installed, diff-cover: not installed, lizard: installed
- Python (*.py) — pytest: not installed, diff-cover: not installed

Patch gate compare branch: origin/master
```

When `git_compare_branch` is `null`, show `Patch gate compare branch: not resolvable — patch gate will be skipped` instead.

### Phase 2: Propose and Confirm Tooling

Before measuring, resolve the commands needed for tests, coverage, lint, patch coverage, and cyclomatic complexity. The resolved candidates from `detect-stack.ts` are presented as a per-ecosystem proposal:

```
Proposed tooling setup for <ecosystem>:

1. Test runner: <test_runner>
2. Coverage: <coverage_tool> --coverage-reporter=<coverage_format>
3. Lint: <lint_cmd> (accepts paths: <true|false>)
4. Functional tests: <functional_test_cmd or "none detected">
5. Patch gate: diff-cover <coverage.xml> --compare-branch=<git_compare_branch> --fail-under=90
6. Complexity: <complexity_cmd>
```

When `lint_cmd` is `null`, the proposal must ask: `No lint tool resolved for <ecosystem>. Enter a lint command, or leave blank to skip the lint gate.` Same prompt shape for `functional_test_cmd` when `null` and a detection signal was absent — leave blank to skip the functional-test gate.

Use the actual resolved `git_compare_branch` value from Phase 1 detection in place of the placeholder above (e.g. `origin/master`), not the literal token. If `git_compare_branch` is `null`, omit step 5 entirely and note in the proposal that the patch gate cannot run without a resolvable compare branch (the global ratchet still applies).

WAIT for user approval before modifying files. If the user declines a tool, record that ecosystem's missing command as `null` and report which verification gates cannot run yet.

### Phase 3: Measure Baseline

For each detected ecosystem with approved/available commands, run the recorded commands:

```bash
<test_runner>
<functional_test_cmd>          # when non-null
<coverage_tool>
# Run lint once over the whole repo to record ratchet.baseline_lint_clean (do not record a lint error count).
<lint_cmd>
<complexity_cmd>
```

For each step:

- `test_runner` exit non-zero → blocker. Report which suite failed; require the user to fix the suite or explicitly record `null` to disable the unit-test gate. Init never records a "known failing" state.
- `functional_test_cmd` exit non-zero → same blocker rule as the unit suite.
- `lint_cmd` exit code is recorded in `ratchet.baseline_lint_clean` (true/false). Do not record a lint error count.
- Coverage and complexity parse as below.

Parse the output and extract:
- Current coverage percentage (global)
- Current cyclomatic complexity inventory (per-function, functions with complexity > 10)

Record these as the baseline in `guardrails.json`:

```json
{
  "ratchet": {
    "baseline_coverage": 42.5,
    "baseline_complexity_inventory": [
      {"file": "src/foo.ts", "function": "bar", "complexity": 18}
    ],
    "complexity_baseline_file": null,
    "baseline_lint_clean": true
  }
}
```

If the inventory exceeds ~200 entries, offer to split to `.guardrails/complexity-baseline.json` and set `complexity_baseline_file` to the path.

### Phase 4: Write guardrails.json

On approval, write `guardrails.json` at the repo root with the schema from `docs/ratchet-protocol.md`, including the `git_compare_branch` field from Phase 1's detection output and an explicit `enforcement` block. Propose the initial states from *Enforcement States* in `docs/ratchet-protocol.md` (tests + ratchet + complexity `required`; absent commands `disabled`; lint `advisory` until `baseline_lint_clean`; patch `advisory` until the CI compare base and coverage artifact are proven reproducible, then `required`). In refresh mode, apply only the approved asymmetric updates from the latest measurement, and never demote an enforcement state or weaken a baseline without recorded user approval — promotion is the only automatic direction.

### Phase 5: Wire Managed Block

Read `docs/agents-block.md` (this skill's docs). Insert the managed block into `AGENTS.md` (or `CLAUDE.md` if that's the project's convention):

- If the markers `<!-- BEGIN b-init-guardrails -->` / `<!-- END b-init-guardrails -->` already exist, replace the content between them in place.
- If the markers are absent, append the block to the end of the file.
- Preserve all hand-authored content outside the markers.

### Phase 5b: Install referenced skills locally

The managed block loads `skills/b-guardrails-check/` and `skills/b-init-guardrails/` from the target repo. Those paths are not a global plugin install. After Phase 5, in both create and refresh mode, run:

```bash
node <skill_dir>/scripts/install-project-skills.mjs --cwd <repo root>
```

The script copies those two skills (skill, docs, and scripts; files named `*.test.js`, `*.test.ts`, `*.test.cjs`, `*.test.cts`, `*.test.mjs`, or `*.test.mts` are skipped) into `<repo>/skills/` as regular files, never symlinks. Re-runs overwrite only those managed files and never delete anything: files dropped from the source keep existing in the target until removed by hand. Every other path under `skills/` is left alone. Local edits inside the two managed skill directories are replaced — fix them in buck-workflow-pi and re-run init. If `package.json` has no `guardrails:check` script, it adds `node skills/b-guardrails-check/scripts/check.mjs --cwd .`, creating a `scripts` object when the file has none. A different existing value is reported and left unchanged. When `guardrails.json` records a lizard `complexity_cmd`, the script adds excludes for the two vendored trees so plugin copies are not project complexity debt. It does not rewrite the command otherwise.

Do not skip this phase because the current machine already has the plugin. The next engineer may not. If the script reports `self: true`, it was pointed at the skill source tree; run it with `<skill_dir>` from the loaded plugin and `--cwd` set to the target repo.


### Phase 6: Report Gradual-Improvement Plan

Display the burn-down plan:

```
Guardrails initialized.

Current state:
- Coverage: 42.5% (baseline) → target: 75%
- Complexity hotspots: 12 functions > 10 (baseline) → goal: 0
- Lint: <test_runner> exit 0; <functional_test_cmd> exit 0 / "none detected"; lint_cmd "<lint_cmd>" recorded; baseline_lint_clean: <true|false>
- Lint mode: <diff-scoped | whole-repo-enforced | whole-repo-advisory | skipped>

Gradual improvement path:
1. Patch gate is active now: all new/changed code must be ≥90% covered.
2. Global ratchet: coverage baseline can increase monotonically as you add tests.
3. Unit-test gate: runs <test_runner>; exit 0 required.
4. Functional-test gate: runs <functional_test_cmd>; exit 0 required (or "none detected").
5. Lint gate: diff-scoped when lint_accepts_paths is true; whole-repo-enforced only when baseline_lint_clean is true; otherwise advisory.
6. Complexity burn-down: refactor the 12 hotspots; the next coherent update shrinks the baseline.

Next steps:
- Run /b-guardrails-check to verify guardrails are working
- Add tests to increase coverage
- Refactor high-complexity functions
```

## Verification

1. **Idempotency**: run init twice; the managed block updates in place, not duplicates.
2. **Propose-then-apply**: Phase 2 shows the exact tooling + config diff and waits for user approval.
3. **Schema compliance**: `guardrails.json` matches the schema in `docs/ratchet-protocol.md`.
4. **Managed block**: uses the correct markers; preserves hand-authored content outside.
5. **Gradual improvement**: displays the burn-down plan with current state and next steps.
6. **Local skills**: the installer leaves `skills/b-guardrails-check/SKILL.md`, `docs/contract-resolution.md`, `scripts/check.mjs`, and `skills/b-init-guardrails/scripts/detect-stack.ts` present, does not copy `*.test.[cm]?[jt]s` files, and does not modify unrelated skills. A second run with unchanged sources reports every managed file `unchanged` and copies nothing.

## Risks

- **Idempotency bugs**: refresh mode must update in place without duplicating the managed block.
- **Brownfield shock**: a repo with 5% coverage will fail the patch gate on day one. The skill records the measured baseline, not an unreachable target.
- **Managed block conflicts**: if the user has hand-authored content between the markers, refresh mode will overwrite it. Document this clearly.
- **Vendored skill overwrite**: Phase 5b replaces files under `skills/b-guardrails-check/` and `skills/b-init-guardrails/`. Do not keep project-only patches there.
