---
name: b-guardrails-check
description: Measure coverage and cyclomatic complexity, compare against guardrails.json gates, and return a structured verdict. Invokable standalone or dispatched as a subagent by the mainline agent. Measures and reports only — never edits.
---

# b-guardrails-check: Guardrails Measurement Contract

Measure coverage and cyclomatic complexity, compare against the gates defined in `guardrails.json`, and return a structured verdict. Invokable standalone or dispatched as a background subagent by the mainline agent during development.

**Measure-never-edit constraint**: This skill reads `guardrails.json`, runs the recorded commands, and returns a verdict. It does not modify `guardrails.json`, does not add tests, does not refactor code. If the check fails, the mainline agent acts on the verdict; the check skill only reports.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | patch gate (diff-cover needs a diff) |
| `bun` | runs commands (if TS ecosystem) |

## Invocation

```
/b-guardrails-check
```

## Procedure

### Step 1: Resolve guardrails.json

Check if `guardrails.json` exists at the repo root.

- **If absent**: error with a clear message:
  ```
  guardrails.json not found. Run /b-init-guardrails first.
  ```
  Exit with code 1.

- **If present**: parse and validate the schema (version, required fields).

### Step 2: Run Coverage Commands

For each ecosystem in `guardrails.json.ecosystems[]`:

1. Run the recorded coverage command:
   ```bash
   <coverage_tool> --coverage-reporter=<coverage_format>
   ```

2. Parse the output and extract:
   - Global coverage percentage
   - Per-file coverage (for patch gate)

3. If `git` is available and `guardrails.json.git_compare_branch` is not `null`, run the patch gate using the recorded compare branch:
   ```bash
   diff-cover <coverage.xml> --compare-branch=<git_compare_branch> --fail-under=<targets.patch_coverage_min>
   ```

   Capture the patch coverage percentage. If `git` is missing or `git_compare_branch` is `null`, skip the patch gate entirely — no comparison target is available, so only the global ratchet applies.

### Step 3: Run Complexity Commands

For each ecosystem:

1. Run the recorded complexity command:
   ```bash
   <complexity_cmd>
   ```

2. Parse the output and extract:
   - Current complexity inventory: functions with cyclomatic complexity > `targets.cyclomatic_max` (10)
   - Hard-ceiling candidates: functions with cyclomatic complexity > `targets.cyclomatic_hard_ceiling` (15)

### Step 4: Compare Against Gates

**Patch gate** (hard):
- If patch coverage < `targets.patch_coverage_min` (90%): **FAIL**

**Global ratchet** (monotonic):
- If current coverage < `ratchet.baseline_coverage`: **FAIL** (regression)
- If current coverage > `ratchet.baseline_coverage`: **PASS** (improvement; report a baseline update)

**Complexity gate**:
- If any **new or worsened non-baseline** function has complexity > `targets.cyclomatic_hard_ceiling` (15): **FAIL**
- If any **new** function (not in baseline) has complexity > `targets.cyclomatic_max` (10): **FAIL**
- If existing baseline hotspots remain unchanged or improve: **PASS** and report burn-down progress. A baseline hotspot above 15 does not fail day one unless it is new or worsened.

### Step 5: Return Structured Verdict

Emit the verdict as JSON:

```json
{
  "status": "pass",
  "coverage": {
    "current": 45.2,
    "baseline": 42.5,
    "target": 75,
    "patch": 92.0,
    "patch_threshold": 90,
    "patch_gate": "pass"
  },
  "complexity": {
    "hotspots_remaining": 10,
    "baseline_size": 12,
    "new_violations": [],
    "hard_ceiling_violations": [],
    "complexity_gate": "pass"
  },
  "gates": {
    "patch_gate": "pass",
    "global_ratchet": "pass",
    "complexity_gate": "pass"
  },
  "ratchet_update": {
    "baseline_coverage_rewrites": true,
    "new_baseline_coverage": 45.2,
    "complexity_inventory_rewrites": true,
    "new_complexity_baseline_size": 10,
    "complexity_baseline_file": null
  }
}
```

**Ratchet update logic:**
- If current coverage > baseline: set `baseline_coverage_rewrites: true`, `new_baseline_coverage: <current>`.
- If current coverage < baseline: set `baseline_coverage_rewrites: false`, keep baseline unchanged, and fail `global_ratchet`.
- If baseline complexity hotspots disappear or drop to ≤10: set `complexity_inventory_rewrites: true` and report the new baseline size/path.
- The check skill is read-only. It reports the update; `/b-init-guardrails` refresh mode or the mainline agent applies it at a coherent point after reviewing the verdict.

### Step 6: Dispatch Contract

This skill is the measurement procedure once invoked. It does **not** dispatch itself.

**OMP (async caller mode):**

The managed `AGENTS.md` block or mainline agent may dispatch this skill as a background `task`:

```typescript
task({
  tasks: [{
    task: "Run b-guardrails-check in the current repo and return the verdict",
    agent: "task"
  }]
})
```

The mainline agent keeps working; the verdict auto-delivers when ready.

**Portable (blocking caller mode):**

If the harness is not OMP, the caller runs this skill synchronously at a coherent checkpoint and waits for the verdict.

**Runtime detection rule** (quoted from `b-loop`):

> The live OMP `task` tool is genuinely async (fire-and-forget + auto-delivery). No other harness has an equivalent; they get checkpoint-blocking.

## Verification

1. **Verdict schema**: matches the template from the managed `AGENTS.md` block, including `gates` and `ratchet_update`.
2. **Gate logic**:
   - Patch gate: fails if patch coverage < 90%
   - Global ratchet: fails if current < baseline, reports an update if current > baseline
   - Complexity gate: fails for new/worsened non-baseline hard-ceiling violations or new >10 violations; unchanged baseline hotspots pass with burn-down reporting
3. **Dispatch modes**: OMP callers may dispatch this skill as a background `task`; portable callers run synchronously.
4. **Error handling**: missing `guardrails.json` → clear error, exit 1; missing `git` or `git_compare_branch: null` → patch gate skipped.
5. **Measure-never-edit**: skill does not modify `guardrails.json` or the codebase.

## Risks

- **Tree contention**: the check reads a half-written tree and yields a false failure. Mitigation: the managed block enforces coherent-point dispatch. If a check fails, re-verify before escalating.
- **Coverage tool incompatibility**: the recorded command fails because the tool version changed. Out of scope for v1; the user must re-run init to update the command.
- **Patch gate without git**: non-git projects, or repos with no resolvable compare branch (`guardrails.json.git_compare_branch: null`), get global-ratchet only. The skill checks for `git` and a non-null `git_compare_branch` before running the patch gate and skips it if either is missing.
