# Ratchet Protocol

The `guardrails.json` schema and the two-gate semantics that govern quality enforcement. This document is the load-bearing contract consumed by the init skill, the check skill, and the managed `AGENTS.md` block.

## Schema Definition

`guardrails.json` lives at the repo root. Version 1:

```json
{
  "version": 1,
  "targets": {
    "coverage_min": 60,
    "coverage_target": 75,
    "cyclomatic_max": 10,
    "cyclomatic_hard_ceiling": 15,
    "patch_coverage_min": 90
  },
  "ratchet": {
    "baseline_coverage": null,
    "baseline_complexity_inventory": [],
    "complexity_baseline_file": null
  },
  "ecosystems": [
    {
      "name": "typescript",
      "detected": true,
      "test_runner": "vitest",
      "coverage_tool": "vitest --coverage",
      "coverage_format": "lcov",
      "complexity_tool": "lizard",
      "complexity_cmd": "lizard -C 10 -w --csv -x \"*/.git/*\" -x \"*/.context/*\" -x \"*/.venv/*\" -x \"*/coverage/*\" -x \"*/dist/*\" -x \"*/build/*\" -x \"*/node_modules/*\" -x \"*/vendor/*\" -x \"*/target/*\" -x \"*/.next/*\" -x \"*/.nuxt/*\" -x \"*/.turbo/*\" .",
      "detection_signals": ["package.json"]
    }
  ],
  "git_compare_branch": "origin/master",
  "complexity_baseline": []
}
```

### Field Descriptions

**`version`** — Schema version. Currently `1`. Increment on breaking changes.

**`targets`** — The quality thresholds. All values are cited (see Threshold Table below).
- `coverage_min` — Minimum acceptable global coverage (60%). Below this is a warning.
- `coverage_target` — Target global coverage (75%). The ratchet aims here.
- `cyclomatic_max` — Cyclomatic complexity warning threshold (10). Functions above this are flagged.
- `cyclomatic_hard_ceiling` — Cyclomatic complexity hard ceiling (15). Functions above this block merge.
- `patch_coverage_min` — Patch gate threshold (90%). Changed lines must meet this coverage.

**`ratchet`** — The measured baseline and its update rules.
- `baseline_coverage` — The current baseline coverage percentage. Starts `null` on init; recorded after the first measurement. Can only increase (improve), never decrease.
- `baseline_complexity_inventory` — Array of functions with cyclomatic complexity > 10 at baseline time. Each entry: `{"file": "path/to/file.ts", "function": "functionName", "complexity": 18}`. The goal is to reduce this array to zero (burn-down).
- `complexity_baseline_file` — Optional pointer to an external baseline file. Default is `null` (inline in `guardrails.json`). When `baseline_complexity_inventory` exceeds ~200 entries, the init skill offers to split to `.guardrails/complexity-baseline.json` and set this field to the path. This is the escape hatch for large brownfield repos.

**`ecosystems[]`** — Detected language ecosystems. Each entry:
- `name` — Ecosystem identifier (e.g. `typescript`, `python`, `go`).
- `detected` — Whether this ecosystem was detected in the repo.
- `test_runner` — Command to run tests (e.g. `vitest`, `pytest`, `go test`).
- `coverage_tool` — Command to run coverage (e.g. `vitest --coverage`, `pytest --cov`).
- `coverage_format` — Machine-readable output format (e.g. `lcov`, `cobertura`).
- `complexity_cmd` — Full command to run complexity analysis at the warning threshold (e.g. `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`). The check skill treats entries above `cyclomatic_hard_ceiling` as hard-ceiling candidates during verdict comparison.
- `detection_signals` — Manifest files that indicate this ecosystem (e.g. `["package.json"]`).

**`git_compare_branch`** — The resolved git ref `diff-cover --compare-branch` should target (e.g. `origin/master`). Repo-wide, not per-ecosystem — `diff-cover` runs once against the whole diff regardless of how many ecosystems are detected. `null` when the repo has no git remote or no resolvable default branch, in which case the patch gate is skipped and only the global ratchet applies.

**`complexity_baseline`** — Legacy inline baseline. Same as `ratchet.baseline_complexity_inventory`. Kept for backward compatibility; new repos should use `ratchet.baseline_complexity_inventory`.

## Two-Gate Semantics

Quality enforcement uses two gates: a hard **patch gate** on changed lines, and a monotonic **global ratchet** from the measured baseline. This is what makes day-one brownfield enforcement possible without a grace period.

### Patch Gate (Hard)

**What it measures:** Coverage on changed lines only (the diff).

**How it works:**
1. Run coverage tool with machine-readable output (lcov/cobertura).
2. Run `diff-cover <coverage.xml> --compare-branch=<git_compare_branch> --fail-under=<targets.patch_coverage_min>`. If `git_compare_branch` is `null` (no git remote or no resolvable default branch), skip this step entirely — same as the existing non-git behavior; only the global ratchet applies.
3. If patch coverage < 90%, the gate fails.

**Why it matters:** The patch gate blocks merge on new/changed code that is under-tested. It is non-negotiable. Even if the global baseline is low (e.g. 42% coverage), all new work must be ≥90% covered. This prevents the baseline from becoming permanent debt suppression.

**Enforcement:** The skill emits the exact `diff-cover` command for local or CI wiring. Writing CI workflow files is out of scope for v1.

### Global Ratchet (Monotonic)

**What it measures:** Global coverage percentage compared to the measured baseline.

**How it works:**
1. Run coverage tool; extract global coverage percentage.
2. Compare to `ratchet.baseline_coverage`.
3. **If current > baseline:** improvement. The read-only check reports a `ratchet_update` that raises the baseline to `current`; the mainline agent or `/b-init-guardrails` refresh applies it at a coherent point.
4. **If current < baseline:** regression. The check fails. The baseline is unchanged. The developer must add tests to bring coverage back to or above the baseline.
5. **If current == baseline:** pass. No change.

**Why it matters:** The ratchet ensures coverage only improves over time. A repo that starts at 42% coverage will fail on day one if coverage drops to 41%, but will succeed if it improves to 43%. The baseline becomes the new floor. This is what makes brownfield enforcement defensible — you meet the repo where it is, then gradually improve.

**Enforcement:** The check skill runs the global ratchet comparison. The init skill records the initial baseline.

### Asymmetric Update Rules

The ratchet is **asymmetric**: it rewards improvement and punishes regression, but never auto-adds new entries to the complexity baseline.

**Improve → baseline update is proposed:**
- If coverage increases, the check reports a baseline raise.
- If complexity hotspots are refactored (removed from the inventory), the check reports an inventory shrink.
- The check skill remains read-only; the mainline agent or `/b-init-guardrails` refresh applies the reported update at a coherent point.

**Regress → check fails:**
- If coverage drops below the baseline, the check fails.
- If new complexity hotspots appear (not in the baseline), the check fails.
- The baseline is unchanged. The developer must fix the regression.

**Explicit re-baseline (manual opt-in):**
- The only way to add new entries to the complexity baseline is via explicit re-baseline.
- Re-baseline requires user approval. The init skill offers it; the check skill never does it automatically.
- This prevents the baseline from becoming a catch-all for accumulating debt.

## Burn-Down Rule

The complexity baseline inventory's goal is to reach zero. Every check reports the current baseline size. The baseline is debt suppression, not permanent tolerance.

1. On init, the skill measures all functions with cyclomatic complexity > 10 and records them in `ratchet.baseline_complexity_inventory`.
2. On each check, the skill compares the current inventory to the baseline.
3. If a function in the baseline has been refactored (complexity ≤ 10), the read-only check reports an inventory shrink.
4. If a new function appears with complexity > 10 (not in the baseline), the check fails. The developer must refactor it or explicitly re-baseline (manual opt-in).
5. After review at a coherent point, the mainline agent or `/b-init-guardrails` refresh applies approved shrink updates. The goal is to reduce the baseline to zero over time.

**Why it matters:** Without a burn-down rule, the baseline becomes a permanent debt suppression mechanism. Developers add to the baseline instead of refactoring. The burn-down rule makes the baseline a temporary tolerance, not a permanent escape hatch.

## Threshold Table

All thresholds are cited. Do not invent new thresholds; reference the authorities below.

| Metric | Value | Authority | Notes |
|--------|-------|-----------|-------|
| Cyclomatic complexity (warning) | 10 | McCabe; NIST SP 500-235 §2.5 | Functions above 10 are flagged for review. |
| Cyclomatic complexity (hard ceiling) | 15 | NIST SP 500-235 | Functions above 15 block merge. Non-negotiable. |
| Coverage (minimal) | 60% | Google Testing Blog 2020 | Below 60% is a warning. Not a gate. |
| Coverage (target) | 75% | Google Testing Blog 2020 | The ratchet aims here. |
| Coverage (excellent) | 90% | Google Testing Blog 2020 | Aspirational. Not enforced as a global gate. |
| Patch coverage | ≥90% | Google Testing Blog 2020 | Changed lines must meet this. Hard gate. |

**Fowler's caution:** Martin Fowler has cautioned against worshipping coverage numbers. The thresholds in this document are guidelines, not gospel. The patch gate (≥90%) is non-negotiable because it enforces discipline on new work. The global ratchet (75% target) is aspirational — the goal is improvement, not a specific number. Use judgment. If a repo legitimately has low coverage (e.g. legacy code with high business value), the ratchet ensures gradual improvement without blocking on day one.

## Implementation Notes

**`diff-cover` is the polyglot patch-gate spine.** It consumes lcov/cobertura/JaCoCo/Clover and has a real `--fail-under=N`. Nearly every coverage tool in the tooling matrix emits lcov or cobertura, so one patch gate covers every ecosystem.

**`lizard`, not `scc`, for complexity.** scc's `COMPLEXITY` column is a keyword-count approximation at file level, explicitly not McCabe. It must never be used as a per-function gate. The fallback command is `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`; verdict comparison treats entries above 15 as hard-ceiling candidates.

**`lizard` gaps.** Verified to have no Shell/Bash or Elixir reader. The "universal" fallback is not universal. Shell is complexity-unsupported (recorded explicitly in the tooling matrix). Elixir uses native `credo`.

**Tree contention.** The check skill reads the live working tree. If dispatched mid-edit, it may read a half-written tree and yield a false failure. The managed `AGENTS.md` block enforces coherent-point dispatch: run checks after a completed edit batch, never per-file. If a check fails, re-verify before escalating.

**Baseline size.** For large brownfield repos, `ratchet.baseline_complexity_inventory` can grow to thousands of entries. The `complexity_baseline_file` pointer field is the escape hatch. When the inventory exceeds ~200 entries, the init skill offers to split to `.guardrails/complexity-baseline.json` and set `complexity_baseline_file` to the path. The schema ships with this field from day one.
