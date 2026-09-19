---
name: b-guardrails-check
description: Measure lint, unit tests, functional tests, coverage, and cyclomatic complexity; compare against guardrails.json gates; return a structured verdict. Invokable standalone or dispatched as a subagent by the mainline agent. Measures and reports only — never edits.
---

# b-guardrails-check: Guardrails Measurement Contract

Measure lint, unit tests, functional tests, coverage, and cyclomatic complexity. Compare against the gates defined in `guardrails.json`. Resolve the contract by the chain in `docs/contract-resolution.md`. Return a structured verdict. Invokable standalone or dispatched as a background subagent by the mainline agent during development.

**Measure-never-edit constraint**: This skill reads `guardrails.json`, runs the recorded commands, and returns a verdict. It does not modify `guardrails.json`, does not add tests, does not refactor code. If the check fails, the mainline agent acts on the verdict; the check skill only reports.

## Prerequisites

| Tool | Purpose |
|---|---|
| `node` | runs the deterministic verdict engine (`scripts/check.mjs`) |
| `git` | patch gate (diff-cover needs a diff), diff-scoped lint |
| `diff-cover`, `lizard` | patch + complexity measurements, when configured |
| `bun` | runs `detect-stack.ts` when `guardrails.json` is missing (step 3 of the resolution chain) |

## Invocation

```
/b-guardrails-check
```

## Procedure

### Step 1: Resolve the Check Contract

Follow the five-step chain in `docs/contract-resolution.md`. Set `contract` and `contract_version` on the verdict from the chain outcome.

- **Authoritative `guardrails.json`**: proceed to Step 1b (the deterministic runner). `contract: "durable"`.
- **Managed block present but `guardrails.json` missing**: emit the broken-contract warning and fall through to step 3.
- **`detect-stack.ts` reports ≥ 1 ecosystem**: build an ephemeral contract, run only the unit-test, functional-test, and lint gates. Skip coverage, patch, and complexity gates (no recorded baseline). `contract: "ephemeral"`. Emit the verbose warning.
- **No ecosystem detected**: scan `README.md` for the first fenced code block after a heading matching `/^#{1,4}\s*(tests?|testing|development|dev|quality|checks?|contributing)\b/i`. Print it verbatim as unverified suggestions. Never execute it. `contract: "suggested"`.
- **Nothing found**: emit the no-contract warning. `contract: "none"`. Gate result `unenforceable`.

**Only fails hard on a malformed `guardrails.json`** (unparseable JSON, or missing `version`/`ecosystems`). A missing file is not an error.

### Step 1b: Run the Deterministic Verdict Engine (durable path)

```bash
node <skill_dir>/scripts/check.mjs --cwd <repo root>
```

The runner reads `guardrails.json`, executes the recorded commands (argv spawn — never a shell string), applies the `enforcement` states (`required` / `advisory` / `disabled`; defaults when the field is absent), and emits the structured verdict JSON on stdout. It exits `1` only when a **required** gate fails, `2` when `guardrails.json` is absent, and `1` on a malformed contract with a clear error.

**The runner is the single computation source.** Do not re-implement gate logic in prose or re-derive gate values by hand — interpret the emitted verdict (`gates`, `diagnostics`, `ratchet_update`, `enforcement`). The same command (`npm run guardrails:check` in this repo) runs in pull-request CI; local and CI verdicts are byte-identical by construction. Contract resolution and the no-contract diagnostics (steps 2–5 of the chain) remain the skill's job; the runner never writes files.


### Step 2: Ephemeral Path — Test and Lint Gates Only

These steps apply **only to the ephemeral contract** (no `guardrails.json`; detected commands). The durable path computed everything inside the runner in Step 1b — do not repeat it by hand.

**Test gates.** For each detected ecosystem:

1. Run `test_runner`; capture exit code. On failure, capture the last 50 lines of output for the verdict.
2. Run `functional_test_cmd` when non-null; capture exit code. On failure, capture the last 50 lines.

Both gates are exit-code binary. `null` → `skipped`. Non-zero exit → `fail`. Zero → `pass`.

**Lint gate.** Per-ecosystem:

- `lint_cmd: null` → `lint_gate: "skipped"`.
- `lint_accepts_paths: true` and a compare branch is resolvable → diff-scoped: compute the changed file set (`git diff --name-only --diff-filter=ACMR <compare>...HEAD`, same for `HEAD`, plus `git ls-files --others --exclude-standard`), de-duplicate, filter to the ecosystem's own file extensions, append to `lint_cmd`. Empty set → `skipped`. Exit 0 → `pass`. Non-zero → `fail`.
- `lint_accepts_paths: false` → run `lint_cmd` over the whole repo and report the exit code as `advisory` — no `baseline_lint_clean` exists on an ephemeral contract, so whole-repo lint never fails the run.

Set `lint.mode` to one of `"diff-scoped" | "whole-repo-advisory" | "skipped"`.

Coverage, patch, complexity, and ratchet comparison exist only under a durable contract (they need recorded baselines) and are computed exclusively by the runner.

### Step 3: Return Structured Verdict

On the durable path, forward the runner's emitted verdict (add the contract-resolution outcome if the runner exited `2`). On the ephemeral path, assemble the verdict manually from Step 2.

```json
{
  "status": "pass",
  "contract": "durable",
  "contract_version": 2,
  "runner_version": "1.0.0",
  "enforcement": {
    "unit_test_gate": "required",
    "functional_test_gate": "disabled",
    "lint_gate": "disabled",
    "patch_gate": "advisory",
    "global_ratchet": "required",
    "complexity_gate": "required"
  },
  "diagnostics": [],
  "tests": {
    "unit_gate": "pass",
    "unit_exit_code": 0,
    "functional_gate": "skipped",
    "functional_exit_code": null
  },
  "lint": {
    "lint_gate": "pass",
    "mode": "diff-scoped",
    "files_linted": 3,
    "exit_code": 0
  },
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
    "unit_test_gate": "pass",
    "functional_test_gate": "skipped",
    "lint_gate": "pass",
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

`lint.mode` is one of `"diff-scoped" | "whole-repo-enforced" | "whole-repo-advisory" | "skipped"`. Every gate value is one of `"pass" | "fail" | "skipped" | "advisory"`. `status` is `"fail"` iff any gate is `"fail"`; `"advisory"` never fails the run.

**Ratchet update logic:**
- If current coverage > baseline: set `baseline_coverage_rewrites: true`, `new_baseline_coverage: <current>`.
- If current coverage < baseline: set `baseline_coverage_rewrites: false`, keep baseline unchanged, and fail `global_ratchet`.
- If baseline complexity hotspots disappear or drop to ≤10: set `complexity_inventory_rewrites: true` and report the new baseline size/path.
- The check skill is read-only. It reports the update; `/b-init-guardrails` refresh mode or the mainline agent applies it at a coherent point after reviewing the verdict.

When `contract_version: 1`, append the one-line upgrade hint exactly: `guardrails.json is v1 — run /b-init-guardrails to add lint and test gates.`

### Step 4: Dispatch Contract

This skill is the measurement procedure once invoked. It does **not** dispatch itself. On the durable path the dispatched work is one deterministic command — `node skills/b-guardrails-check/scripts/check.mjs` — so a background `task` or CI step returns the identical verdict the mainline agent would compute.

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

1. **Verdict schema**: matches the template from the managed `AGENTS.md` block, including `contract`, `contract_version`, `tests`, `lint`, `gates`, and `ratchet_update`.
2. **Gate logic**:
   - Patch gate: fails if patch coverage < 90%
   - Global ratchet: fails if current < baseline, reports an update if current > baseline
   - Complexity gate: fails for new/worsened non-baseline hard-ceiling violations or new >10 violations; unchanged baseline hotspots pass with burn-down reporting
   - Lint gate: diff-scoped when `lint_accepts_paths: true`; whole-repo-enforced only when `ratchet.baseline_lint_clean: true`; otherwise whole-repo-advisory or skipped
   - Unit/functional test gates: exit-code binary; `null` → `skipped`
3. **Dispatch modes**: OMP callers may dispatch this skill as a background `task`; portable callers run synchronously.
4. **Error handling**: malformed `guardrails.json` → clear error, exit 1; missing `git` or `git_compare_branch: null` → patch gate skipped; missing `guardrails.json` → contract-resolution chain (warn-and-offer, not exit 1).
5. **Measure-never-edit**: skill does not modify `guardrails.json` or the codebase.

## Risks

- **Tree contention**: the check reads a half-written tree and yields a false failure. Mitigation: the managed block enforces coherent-point dispatch. If a check fails, re-verify before escalating.
- **Coverage tool incompatibility**: the recorded command fails because the tool version changed. Out of scope for v1; the user must re-run init to update the command.
- **Patch gate without git**: non-git projects, or repos with no resolvable compare branch (`guardrails.json.git_compare_branch: null`), get global-ratchet only. The skill checks for `git` and a non-null `git_compare_branch` before running the patch gate and skips it if either is missing.
- **Whole-repo lint slow on large repos**: a `lint_accepts_paths: false` linter on a large repo can be slow. The check runs the linter once at a coherent point, never per-file.
