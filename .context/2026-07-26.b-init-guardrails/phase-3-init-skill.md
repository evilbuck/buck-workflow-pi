---
status: completed
phase: 3
order: 3
plan: plan-b-init-guardrails.md
phases_overview: plan-b-init-guardrails-phases.md
difficulty: medium
model_hint: capable general model preferred — core skill authoring
buck_hint: /b-build
goal: Write the b-init-guardrails SKILL.md and the managed AGENTS.md block template.
files:
  - skills/b-init-guardrails/SKILL.md
  - skills/b-init-guardrails/docs/agents-block.md
from_plan_steps: [5, 6]
depends_on: [1, 2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] SKILL.md has frontmatter (name, description) and follows the b-pr skill structure"
  - "[ ] Skill flow: Phase 0 idempotency → Phase 1 detect → Phase 2 measure → Phase 3 propose → Phase 4 write guardrails.json → Phase 5 wire block → Phase 6 report"
  - "[x] SKILL.md has frontmatter (name, description) and follows the b-pr skill structure"
  - "[x] Skill flow: Phase 0 idempotency → Phase 1 detect → Phase 2 measure → Phase 3 propose → Phase 4 write guardrails.json → Phase 5 wire block → Phase 6 report"
  - "[x] Phase 3 (propose) shows the exact tooling + config diff and waits for user approval before applying"
  - "[x] Phase 5 (wire block) uses the managed-block markers <!-- BEGIN b-init-guardrails --> / <!-- END b-init-guardrails -->"
  - "[x] agents-block.md template tells agents when to dispatch b-guardrails-check, how to read a verdict, and what to do on failure"
  - "[x] Coherent-point dispatch rule from Light Grill Q3 is explicit in the block template"
---
completed_at: 2026-07-26
# Phase 3: Init Skill

## Context

Parent plan's user goal: a developer in any codebase runs one command and gets quality guardrails with a brownfield ratchet and non-blocking subagent checks.

This phase writes the main skill that developers invoke once to bootstrap guardrails. The skill is guided, idempotent, and proposes (never silently applies) tooling changes. It also writes the managed `AGENTS.md` block that governs ongoing behavior — the enforcement home for the guardrails.

This phase HARD-depends on Phase 1 (schema fields, ratchet semantics, thresholds) and Phase 2 (the detection script's output shape).

## Implementation Details

From the parent plan, steps 5 and 6:

### Step 5: Write b-init-guardrails/SKILL.md

Create `skills/b-init-guardrails/SKILL.md` with frontmatter:

```yaml
---
name: b-init-guardrails
description: One-shot, idempotent initialization of quality guardrails (tests, coverage, cyclomatic complexity) with a brownfield ratchet. Detects the stack, measures the baseline, proposes tooling, writes guardrails.json, and installs a managed AGENTS.md block.
---
```

**Skill structure** — follows the `b-pr` precedent (frontmatter, prerequisites, invocation, procedure):

```markdown
# b-init-guardrails: Quality Guardrails Initialization

<one-paragraph overview>

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | baseline measurement, patch gate |
| `bun` | runs detect-stack.ts |

## Invocation

/b-init-guardrails

## Procedure

> **`<skill_dir>`** = the directory of the loaded `b-init-guardrails` skill. Resolve relative to this skill's location.

### Phase 0: Idempotency Check

Check if `guardrails.json` exists at the repo root.

- **If exists**: enter **refresh mode** — skip detection, re-measure baseline, update `guardrails.json` in place.
- **If absent**: enter **create mode** — proceed to Phase 1.

### Phase 1: Detect Stack

Run the detection script:

```bash
bun <skill_dir>/scripts/detect-stack.ts
```

Parse the JSON output. Display the detected ecosystems to the user:

```
Detected ecosystems:
- TypeScript (package.json) — vitest: installed, diff-cover: not installed, lizard: installed
- Python (pyproject.toml) — pytest: installed, diff-cover: not installed
```

### Phase 2: Measure Baseline

For each detected ecosystem, run the recorded coverage and complexity commands:

```bash
<coverage_tool> --coverage-reporter=<coverage_format>
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
      {"file": "src/foo.ts", "function": "bar", "complexity": 18},
      ...
    ]
  }
}
```

If the inventory exceeds ~200 entries, offer to split to `.guardrails/complexity-baseline.json` and set `complexity_baseline_file` to the path.

### Phase 3: Propose and Confirm

**Never silently mutate a manifest.** Show the user exactly what will be added/changed:

```
Proposed tooling setup:

1. Install diff-cover (patch gate):
   npm install --save-dev diff-cover

2. Add coverage script to package.json:
   "scripts": {
     "test:coverage": "vitest --coverage --coverage.reporter=lcov"
   }

3. Add patch gate command (for CI / manual check):
   diff-cover coverage.lcov --fail-under=90

Apply these changes? [y/N]
```

WAIT for user approval. Do not proceed until they confirm.

### Phase 4: Write guardrails.json

On approval, write `guardrails.json` at the repo root with the schema from `docs/ratchet-protocol.md`.

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
2. Global ratchet: coverage baseline will increase monotonically as you add tests.
3. Complexity burn-down: refactor the 12 hotspots; the baseline shrinks automatically.

Next steps:
- Run /b-guardrails-check to verify guardrails are working
- Add tests to increase coverage
- Refactor high-complexity functions
```
```

### Step 6: Write the managed-block template

Create `skills/b-init-guardrails/docs/agents-block.md` containing the template that gets inserted into `AGENTS.md`:

```markdown
<!-- BEGIN b-init-guardrails -->
# Quality Guardrails (managed block)

This block is managed by `b-init-guardrails`. Do not edit manually; re-run the skill to refresh.

## When to Run Guardrails Checks

Run `/b-guardrails-check` **at coherent points** — after a completed edit batch, never per-file. Examples:
- After finishing a feature or bug fix
- Before committing
- When the mainline agent is about to yield

Do **not** run mid-edit; the working tree may be in an inconsistent state and yield false failures.

## How to Read a Verdict

`/b-guardrails-check` returns a structured verdict:

```json
{
  "status": "pass" | "fail",
  "coverage": {
    "current": 45.2,
    "baseline": 42.5,
    "target": 75,
    "patch": 92.0,
    "patch_threshold": 90
  },
  "complexity": {
    "hotspots_remaining": 10,
    "baseline_size": 12,
    "new_violations": []
  }
}
```

- `status: pass` — all gates passed. Continue.
- `status: fail` — one or more gates failed. The verdict shows which gate failed and by how much.

## What to Do on Failure

**Patch gate failure** (changed lines < 90% covered):
- Add tests for the changed lines before committing.
- Do not lower the threshold; the patch gate is non-negotiable.

**Global ratchet failure** (coverage regressed below baseline):
- Add tests to bring coverage back to or above the baseline.
- Do not re-baseline unless explicitly approved by the user (re-baseline is a manual opt-in, not automatic).

**Complexity violation** (new function > 10 cyclomatic):
- Refactor the function before committing.
- If the function is legitimately complex, document the exception and add it to the baseline via explicit re-baseline (manual opt-in).

## Dispatch Modes

**OMP (async):**
```
/b-guardrails-check
```
The check runs as a background `task` and auto-delivers the verdict. The mainline agent keeps working.

**Portable (blocking):**
```
/b-guardrails-check
```
The check runs synchronously. The mainline agent waits for the verdict before proceeding.

The skill auto-detects the harness and chooses the appropriate mode.

## Coherent-Point Dispatch Rule

The mainline agent must dispatch checks **at coherent points** — after a completed edit batch, never per-file. This avoids false failures from tree contention (the check reading a half-written tree).

If a check fails, re-verify before escalating:
1. Ensure the working tree is in a consistent state (no mid-edit files).
2. Re-run the check.
3. If it fails again, treat it as a real failure and act on the verdict.

<!-- END b-init-guardrails -->
```

## Risks

- **Idempotency bugs**: refresh mode must update in place without duplicating the managed block. Test this explicitly.
- **Brownfield shock**: a repo with 5% coverage will fail the patch gate on day one. The skill must record the measured baseline, not set an unreachable target. The gradual-improvement plan is what makes day-one brownfield enforcement defensible.
- **Managed block conflicts**: if the user has hand-authored content between the markers, refresh mode will overwrite it. Document this clearly in the block template.

## Verification

1. **Skill structure:**
   - [ ] `SKILL.md` has frontmatter with `name` and `description`
   - [ ] Skill follows the `b-pr` precedent (prerequisites, invocation, procedure sections)
   - [ ] All six phases are present and in order

2. **Idempotency:**
   - [ ] Run init twice on the same repo; the managed block updates in place, not duplicates
   - [ ] Hand-authored content outside the markers survives refresh

3. **Propose-then-apply:**
   - [ ] Phase 3 shows the exact tooling + config diff
   - [ ] Skill waits for user approval before applying (no silent mutation)

4. **Managed block:**
   - [ ] Block uses the correct markers: `<!-- BEGIN b-init-guardrails -->` / `<!-- END b-init-guardrails -->`
   - [ ] Block includes the coherent-point dispatch rule
   - [ ] Block explains how to read a verdict and what to do on failure
   - [ ] Block documents both dispatch modes (OMP async, portable blocking)

5. **Schema reference:**
   - [ ] Skill references field names from Phase 1's schema (e.g. `baseline_coverage`, `complexity_baseline_file`)
   - [ ] Skill references thresholds from Phase 1's ratchet protocol (e.g. patch ≥90%, cyclomatic ≤10)
