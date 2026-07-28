---
status: completed
phase: 1
order: 1
plan: plan-b-init-guardrails.md
phases_overview: plan-b-init-guardrails-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: Define the guardrails.json schema and write the ratchet-protocol.md reference doc that every later phase consumes.
files:
  - skills/b-init-guardrails/docs/ratchet-protocol.md
from_plan_steps: [2, 3]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] ratchet-protocol.md exists with versioned schema, two-gate semantics, asymmetric update rules, and cited threshold table"
  - "[x] Schema includes targets, ratchet, ecosystems[], complexity_baseline[], and complexity_baseline_file escape hatch"
  - "[x] Patch gate uses diff-cover with --fail-under; complexity gate uses lizard -C 15"
  - "[x] All thresholds carry cited authorities (McCabe/NIST/Google Testing Blog)"
completed_at: 2026-07-26
completed_by: null
---

# Phase 1: Schema & Protocol

## Context

Parent plan's user goal: a developer in any codebase runs one command and gets quality guardrails with a brownfield ratchet and non-blocking subagent checks.

This phase defines the data contract every other phase depends on. The `guardrails.json` schema and the ratchet protocol document are the load-bearing artifacts — field names, gate semantics, and threshold values flow into the detection script (Phase 2), the init skill (Phase 3), the check skill (Phase 4), and the registration wiring (Phase 5).

## Implementation Details

From the parent plan, steps 2 and 3:

1. **Create `skills/b-init-guardrails/docs/ratchet-protocol.md`** containing:

   a. **Schema definition** — `guardrails.json` shape:
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
            "complexity_cmd": "lizard -C 15 -w --csv .",
            "detection_signals": ["package.json"]
          }
        ],
        "complexity_baseline": []
      }
      ```

   b. **Two-gate semantics:**
      - **Patch gate** (hard): `diff-cover <coverage.xml> --fail-under=<patch_coverage_min>` — blocks merge on changed-line coverage below threshold.
      - **Global ratchet** (monotonic): measured baseline can only improve, never regress. If current > baseline, baseline rewrites. If current < baseline, check fails, baseline unchanged.

   c. **Asymmetric update rules:**
      - Improve → baseline rewrites upward automatically.
      - Regress → check fails, baseline unchanged, burn-down reported.
      - Explicit re-baseline (manual opt-in) is the only way to add new complexity entries.

   d. **Burn-down rule:** The complexity baseline inventory's goal is to reach zero. Every check reports current baseline size. Baseline is debt suppression, not permanent tolerance.

   e. **Cited threshold table:**

      | Metric | Value | Authority |
      |--------|-------|-----------|
      | Cyclomatic complexity (warning) | 10 | McCabe; NIST SP 500-235 §2.5 |
      | Cyclomatic complexity (hard ceiling) | 15 | NIST SP 500-235 |
      | Coverage (minimal) | 60% | Google Testing Blog 2020 |
      | Coverage (target) | 75% | Google Testing Blog 2020 |
      | Coverage (excellent) | 90% | Google Testing Blog 2020 |
      | Patch coverage | ≥90% | Google Testing Blog 2020 |

      Include Fowler's caution against worshipping the number in the doc's prose.

   f. **`complexity_baseline_file` escape hatch:** Default is inline `complexity_baseline[]` in `guardrails.json`. When inventory exceeds ~200 entries, the skill offers to split to `.guardrails/complexity-baseline.json` and set `complexity_baseline_file` to the path. The schema ships with this pointer field from day one.

2. **Directory structure:**
   ```
   skills/b-init-guardrails/
   └── docs/
       └── ratchet-protocol.md
   ```

## Risks

- **Schema drift**: field names chosen here are consumed by 4 later phases. Pick carefully, document clearly.
- **Threshold authority accuracy**: the research files carry the citations. Copy them verbatim; do not paraphrase or invent.

## Verification

- [ ] File exists at `skills/b-init-guardrails/docs/ratchet-protocol.md`
- [ ] Schema JSON example is valid JSON (parse it with `jq .`)
- [ ] All six threshold rows have cited authorities
- [ ] `complexity_baseline_file` field is documented with the ~200-entry split rule
- [ ] Two-gate semantics are clearly separated (patch vs. global)
- [ ] Asymmetric update rules are explicit (improve rewrites / regress fails)
