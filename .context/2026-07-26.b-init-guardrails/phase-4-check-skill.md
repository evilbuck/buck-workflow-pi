---
status: completed
phase: 4
order: 4
plan: plan-b-init-guardrails.md
phases_overview: plan-b-init-guardrails-phases.md
difficulty: medium
model_hint: capable general model preferred — standalone skill, gate logic
buck_hint: /b-build
goal: Write the b-guardrails-check SKILL.md that implements the measurement contract.
files:
  - skills/b-guardrails-check/SKILL.md
from_plan_steps: [7]
depends_on: [1, 3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] SKILL.md has frontmatter (name, description) and follows the b-pr skill structure"
  - "[x] SKILL.md has frontmatter (name, description) and follows the b-pr skill structure"
  - "[x] Skill resolves guardrails.json, runs the recorded commands, compares against gates, returns a structured verdict"
  - "[x] Verdict schema matches the template in the managed AGENTS.md block from Phase 3"
  - "[x] Both dispatch modes are documented: OMP async task, portable checkpoint-blocking"
  - "[x] Runtime detection rule is quoted from b-loop"
  - "[x] Measure-never-edit constraint is explicit"
completed_by: null
completed_at: 2026-07-26

# Phase 4: Check Skill

## Context

Parent plan's user goal: a developer in any codebase runs one command and gets quality guardrails with a brownfield ratchet and non-blocking subagent checks.

This phase writes the standalone check skill that the managed `AGENTS.md` block (from Phase 3) dispatches. The skill is the canonical contract: resolve `guardrails.json`, run the recorded commands, compare against gates, return a structured verdict.

**The check skill measures and reports only — it never edits.** This is a hard constraint. The init skill (Phase 3) writes `guardrails.json`; the check skill only reads it and compares.

This phase HARD-depends on Phase 1 (schema fields, gate semantics, thresholds) and Phase 3 (verdict schema template from the managed block, dispatch modes).

## Implementation Details

From the parent plan, step 7:

### Write b-guardrails-check/SKILL.md

Create `skills/b-guardrails-check/SKILL.md` with frontmatter:

```yaml
---
name: b-guardrails-check
description: Measure coverage and cyclomatic complexity, compare against guardrails.json gates, and return a structured verdict. Invokable standalone or dispatched as a subagent by the mainline agent. Measures and reports only — never edits.
---
```

**Skill structure:**

```markdown
# b-guardrails-check: Guardrails Measurement Contract

<one-paragraph overview>

**Measure-never-edit constraint**: This skill reads `guardrails.json`, runs the recorded commands, and returns a verdict. It does not modify `guardrails.json`, does not add tests, does not refactor code. If the check fails, the mainline agent acts on the verdict; the check skill only reports.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | patch gate (diff-cover needs a diff) |
| `bun` | runs commands (if TS ecosystem) |

## Invocation

/b-guardrails-check

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

3. If `git` is available, run the patch gate:
   ```bash
   diff-cover <coverage.xml> --fail-under=<targets.patch_coverage_min>
   ```

   Capture the patch coverage percentage.

### Step 3: Run Complexity Commands

For each ecosystem:

1. Run the recorded complexity command:
   ```bash
   <complexity_cmd>
   ```

2. Parse the output and extract:
   - List of functions with cyclomatic complexity > `targets.cyclomatic_max` (10)
   - Count of functions at or above `targets.cyclomatic_hard_ceiling` (15)

### Step 4: Compare Against Gates

**Patch gate** (hard):
- If patch coverage < `targets.patch_coverage_min` (90%): **FAIL**

**Global ratchet** (monotonic):
- If current coverage < `ratchet.baseline_coverage`: **FAIL** (regression)
- If current coverage > `ratchet.baseline_coverage`: **PASS** (improvement, baseline will rewrite)

**Complexity gate**:
- If any function has complexity > `targets.cyclomatic_hard_ceiling` (15): **FAIL**
- If any **new** function (not in baseline) has complexity > `targets.cyclomatic_max` (10): **FAIL**
- If existing baseline hotspots remain unchanged: **PASS** (burn-down in progress)

### Step 5: Return Structured Verdict

Emit the verdict as JSON:

```json
{
  "status": "pass" | "fail",
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
    "baseline_coverage_rewrites": false,
    "new_baseline_coverage": null
  }
}
```

**Ratchet update logic:**
- If current coverage > baseline: set `baseline_coverage_rewrites: true`, `new_baseline_coverage: <current>`. The init skill (or the user) will update `guardrails.json` to record the improvement.
- If current coverage < baseline: `baseline_coverage_rewrites: false`, baseline unchanged.

### Step 6: Dispatch Modes

**OMP (async):**
```
/b-guardrails-check
```
The skill detects OMP harness and dispatches as a background `task`:
```
task({
  tasks: [{
    task: "Run /b-guardrails-check and return the verdict",
    agent: "task"
  }]
})
```
The mainline agent keeps working; the verdict auto-delivers when ready.

**Portable (blocking):**
```
/b-guardrails-check
```
The skill detects the harness is not OMP (or the user explicitly requested blocking) and runs synchronously. The mainline agent waits for the verdict.

**Runtime detection rule** (quoted from `b-loop`):
> The live OMP `task` tool is genuinely async (fire-and-forget + auto-delivery). No other harness has an equivalent; they get checkpoint-blocking.

The skill auto-detects the harness:
- If OMP: dispatch as background `task`
- Otherwise: run synchronously

## Risks

- **Tree contention**: the check reads a half-written tree and yields a false failure. Mitigation: the managed block (Phase 3) enforces coherent-point dispatch. If a check fails, re-verify before escalating.
- **Coverage tool incompatibility**: the recorded command fails because the tool version changed. Out of scope for v1; the user must re-run init to update the command.
- **Patch gate without git**: non-git projects get global-ratchet only. The skill checks for `git` before running the patch gate and skips it if absent.

## Verification

1. **Skill structure:**
   - [ ] `SKILL.md` has frontmatter with `name` and `description`
   - [ ] Measure-never-edit constraint is explicit in the overview

2. **Verdict schema:**
   - [ ] Verdict matches the template from Phase 3's managed block
   - [ ] All fields are present: `status`, `coverage`, `complexity`, `gates`, `ratchet_update`

3. **Gate logic:**
   - [ ] Patch gate: fails if patch coverage < 90%
   - [ ] Global ratchet: fails if current < baseline, rewrites if current > baseline
   - [ ] Complexity gate: fails if any function > 15, or any new function > 10

4. **Dispatch modes:**
   - [ ] OMP async: dispatches as background `task`
   - [ ] Portable blocking: runs synchronously
   - [ ] Runtime detection rule is quoted from `b-loop`

5. **Error handling:**
   - [ ] Missing `guardrails.json` → clear error message, exit 1
   - [ ] Missing `git` → patch gate skipped, global ratchet still runs
   - [ ] Coverage command fails → verdict `status: fail`, error included in output

6. **Measure-never-edit:**
   - [ ] Skill does not modify `guardrails.json`
   - [ ] Skill does not add tests or refactor code
   - [ ] Skill only reads and reports
