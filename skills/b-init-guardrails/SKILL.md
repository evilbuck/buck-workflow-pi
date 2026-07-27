---
name: b-init-guardrails
description: One-shot, idempotent initialization of quality guardrails (tests, coverage, cyclomatic complexity) with a brownfield ratchet. Detects the stack, proposes tooling, measures the baseline, writes guardrails.json, and installs a managed AGENTS.md block.
---

# b-init-guardrails: Quality Guardrails Initialization

Initialize quality guardrails in any codebase — greenfield or brownfield. Detects the language stack, proposes tooling changes (with user approval), measures coverage and cyclomatic complexity, records the baseline, writes `guardrails.json`, and installs a managed `AGENTS.md` block that governs ongoing behavior.

**Idempotent**: safe to re-run. Refresh mode updates in place without duplicating the managed block.

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

- **If exists**: enter **refresh mode** — re-detect the stack, re-measure with the recorded/approved commands, and apply only asymmetric improvements: raise `ratchet.baseline_coverage`, shrink complexity inventory, never lower the coverage baseline, never add new complexity debt without explicit user approval.
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

Before measuring, resolve the commands needed for tests, coverage, patch coverage, and cyclomatic complexity.

**Never silently mutate a manifest.** Show the user exactly what will be added/changed:

```
Proposed tooling setup:

1. Install diff-cover (patch gate):
   uv tool install diff-cover
   # or: pipx install diff-cover

2. Add coverage script to package.json:
   "scripts": {
     "test:coverage": "vitest --coverage --coverage.reporter=lcov"
   }

3. Add complexity command:
   lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .

4. Add patch gate command (for CI / manual check):
   diff-cover coverage/lcov.info --compare-branch=<git_compare_branch> --fail-under=90

Apply these changes? [y/N]
```

Use the actual resolved `git_compare_branch` value from Phase 1 detection in place of the placeholder above (e.g. `origin/master`), not the literal token. If `git_compare_branch` is `null`, omit step 4 entirely and note in the proposal that the patch gate cannot run without a resolvable compare branch (the global ratchet still applies).

WAIT for user approval before modifying files. If the user declines a tool, record that ecosystem's missing command as `null` and report which verification gates cannot run yet.

### Phase 3: Measure Baseline

For each detected ecosystem with approved/available commands, run the recorded coverage and complexity commands:

```bash
<coverage_tool>
<complexity_cmd>
```

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
    "complexity_baseline_file": null
  }
}
```

If the inventory exceeds ~200 entries, offer to split to `.guardrails/complexity-baseline.json` and set `complexity_baseline_file` to the path.

### Phase 4: Write guardrails.json

On approval, write `guardrails.json` at the repo root with the schema from `docs/ratchet-protocol.md`, including the `git_compare_branch` field from Phase 1's detection output. In refresh mode, apply only the approved asymmetric updates from the latest measurement.

### Phase 5: Wire Managed Block

Read `docs/agents-block.md` (this skill's docs). Insert the managed block into `AGENTS.md` (or `CLAUDE.md` if that's the project's convention):

- If the markers `<!-- BEGIN b-init-guardrails -->` / `<!-- END b-init-guardrails -->` already exist, replace the content between them in place.
- If the markers are absent, append the block to the end of the file.
- Preserve all hand-authored content outside the markers.

### Phase 6: Report Gradual-Improvement Plan

Display the burn-down plan:

```
Guardrails initialized.

Current state:
- Coverage: 42.5% (baseline) → target: 75%
- Complexity hotspots: 12 functions > 10 (baseline) → goal: 0

Gradual improvement path:
1. Patch gate is active now: all new/changed code must be ≥90% covered.
2. Global ratchet: coverage baseline can increase monotonically as you add tests.
3. Complexity burn-down: refactor the 12 hotspots; the next coherent update shrinks the baseline.

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

## Risks

- **Idempotency bugs**: refresh mode must update in place without duplicating the managed block.
- **Brownfield shock**: a repo with 5% coverage will fail the patch gate on day one. The skill records the measured baseline, not an unreachable target.
- **Managed block conflicts**: if the user has hand-authored content between the markers, refresh mode will overwrite it. Document this clearly.
