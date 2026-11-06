---
status: active
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [guardrails, ratchet, baseline, thresholds, diff-coverage, brownfield]
informs: [plan-b-init-guardrails.md]
---

# Ratchet, Baselines & Defensible Thresholds

Primary sources verified 2026-07-26. This is the **brownfield strategy** research: how to move an
existing codebase toward a quality target without failing the build on day one.

## The two-gate model (core conclusion)

Every mature prior-art tool converges on the same shape. A single global threshold is unusable on a
brownfield repo — it either fails immediately (useless) or is set so low it enforces nothing.

| Gate | Scope | Enforcement | Day-one safe? |
|---|---|---|---|
| **Patch gate** | Only lines/symbols changed in this diff | **Hard** — fail the check | Yes — legacy debt is invisible to it |
| **Global ratchet** | Whole repo | **Monotonic** — fail only on regression below the recorded baseline | Yes — baseline starts at measured reality |

The patch gate is what makes new code good. The ratchet is what stops old code getting worse.
Neither alone is sufficient; together they need no "grace period" and no arbitrary starting number.

## Diff / patch coverage tooling

| Name | Ecosystem | Input | Threshold on changed lines? | URL |
|---|---|---|---|---|
| **diff-cover** | Polyglot (Python-installed) | Cobertura / Clover / JaCoCo XML **or LCov** + `git diff` | **Yes** — `--fail-under=N` | https://github.com/Bachmann1234/diff_cover |
| **undercover** | Ruby | SimpleCov JSON + git diff (`--compare ref`) | **Yes (structural)** — fails on changed methods/classes/blocks lacking coverage | https://github.com/grodowski/undercover |
| **Codecov `patch` status** | SaaS, any language | Uploaded coverage + PR diff | **Yes** — `coverage.status.patch.default.target` (`auto` \| N) + `threshold` slack | https://docs.codecov.com/docs/commit-status |
| **Coveralls** | SaaS | Uploaded coverage | **Partial** — UI-level "coverage threshold" / "decrease threshold"; no verified `codecov.yml`-equivalent patch API | https://docs.coveralls.io/app-notifications |
| **SonarQube Clean as You Code** | Polyglot (server) | Scanner analysis + New Code definition | **Yes (issue-centric)** — quality gate conditions on new code | https://docs.sonarsource.com/sonarqube-server/user-guide/about-new-code |
| `jest --changedSince` | JS/TS | — | **No** — selects *which tests run*, not a patch-coverage gate | https://jestjs.io/docs/cli#--changedsince |
| `go test -coverprofile` | Go | — | **No first-party patch enforcer** | — |

**`diff-cover` is the recommended default** for `b-init-guardrails`: it is the only genuinely
polyglot, self-hosted, LCov-consuming patch gate with a real `--fail-under`. Verbatim from its
README: *"compares an XML coverage report with the output of `git diff`"*; `diff-cover coverage.xml
--fail-under=80` returns non-zero below threshold. Version verified: **10.4.1**.

Since nearly every coverage tool in the matrix can emit **lcov** or **cobertura**, `diff-cover`
composes with all of them. That is the mechanism that makes the patch gate language-agnostic.

## Ratchet state persistence — prior art

| Tool | What ratchets | Persistence | Auto-bump? |
|---|---|---|---|
| **betterer** | Arbitrary metrics (ESLint counts, coverage totals/per-file, TS, regex) | Checked-in **`.betterer.results`** | Yes on improvement; `-u` forces; `betterer merge` resolves conflicts |
| **PHPStan** | Existing analyser errors | Checked-in **`phpstan-baseline.neon`**, `includes:`-ed | `--generate-baseline`; unmatched entries reported by default |
| **Psalm** | Existing issues | Checked-in **`psalm-baseline.xml`** | `--update-baseline` removes fixed only; `--set-baseline` rewrites |
| **eslint-formatter-ratchet** | Per-file × per-rule counts | Checked-in **`eslint-ratchet.json`** (+ gitignored temp) | Yes on pure improvement |
| **eslint-baseline** | Known errors | Checked-in **`.eslint-baseline.json`** | `--update-baseline` |
| **jest-coverage-ratchet** | Jest `coverageThreshold` floors | Rewrites **jest config / package.json** | Yes — raises any threshold where current > configured |
| **Codecov `target: auto`** | vs. parent commit | SaaS-side, no repo file | Implicit only |
| **SonarQube New Code** | New-code issues | Server-side | N/A |

### Design rules extracted

1. **Checked-in state beats CI-only state.** Local agent and CI must read one truth. (PHPStan,
   Psalm, betterer, eslint-ratchet all do this; Codecov/Sonar do not, and that is their weakness
   for an agent workflow.)
2. **Asymmetric update.** Improvement rewrites the baseline; regression fails. Never auto-worsen.
   An explicit escape hatch (`--update` / regenerate) exists for deliberate rule upgrades.
3. **Granularity beats a single integer.** File×rule counts (eslint-ratchet) or per-issue
   fingerprints (betterer `issueHash`) prevent one area "paying for" a regression elsewhere.
4. **The baseline's goal is to not exist.** PHPStan docs say this explicitly — the inventory is
   debt to be burned down, not a permanent suppression list.

### Baseline formats worth copying

PHPStan (`phpstan-baseline.neon`) — message + count + path:
```neon
parameters:
	ignoreErrors:
		-
			message: "#^Only numeric types are allowed in pre\\-decrement...$#"
			count: 1
			path: src/Analyser/Scope.php
```

betterer (`.betterer.results`) — `path:fileHash` key, `[line, column, length, message, issueHash]`:
```js
// BETTERER RESULTS V2.
exports[`no hack comments`] = {
  value: `{ "packages/cli/src/cli.ts:1074837834": [[13, 0, 7, "RegExp match", "645651780"]] }`
};
```

**Recommended shape for a per-symbol complexity baseline** (synthesis of the two):
```json
{ "path": "src/foo.ts", "symbol": "doThing", "value": 18 }
```
Fail if: a **new** symbol exceeds target, or a **known** symbol's `value` increases.
Drop the entry when `value <= target`. Count-of-entries ratchets monotonically toward zero.

## Defensible default thresholds (cited — do not invent numbers)

| Metric | Number | Authority |
|---|---|---|
| Cyclomatic complexity per module | **10** | McCabe's original limit; **NIST SP 500-235 §2.5** |
| Cyclomatic relaxed upper bound | **≤15** | NIST SP 500-235 §2.5 — *"limits as high as 15 have been used successfully"*, but only with strong process |
| Cognitive complexity (method) | **15** | Sonar rule S3776 default `[UNVERIFIED — primary rules.sonarsource.com unreachable; corroborated by multiple secondary sources]` |
| Project coverage "acceptable" | **60%** | Google Testing Blog, *Code Coverage Best Practices* (2020) |
| Project coverage "commendable" | **75%** | ibid. |
| Project coverage "exemplary" | **90%** | ibid. |
| Per-commit (patch) coverage | **90% floor, 99% reasonable** | ibid. — *"per-commit coverage goals of 99% are reasonable, and 90% is a good lower threshold"* |
| Coverage as a quality score | **Do not worship it** | Martin Fowler, *TestCoverage* (2012) — *"of little use as a numeric statement of how good your tests are"*; expect upper 80s–90s, *"be suspicious of anything like 100%"* |

NIST's actual policy recommendation, verbatim: *"For each module, either limit cyclomatic
complexity to 10 ... or provide a written explanation of why the limit was exceeded."* — that
"written explanation" is precisely what a baseline entry is.

### Derived defaults for `b-init-guardrails`

| Gate | Day-one | Steady-state target |
|---|---|---|
| Patch coverage | ≥ 80% | ≥ 90% |
| Global line coverage | **measured baseline**, ratchet-only | 60 → 75 → 90 bands |
| Cyclomatic per function | inventory everything > 10 | no new > 10; burn the inventory down |
| Cyclomatic hard ceiling | > 15 fails outright, even on legacy | 15 |

The hard `>15` ceiling is the one number that applies to legacy code too — NIST treats above-15 as
requiring exceptional justification, so it is defensible as a never-cross line rather than a ratchet.

## Caveats

- Coveralls patch-% YAML parity with Codecov **not verified** in official docs.
- Sonar cognitive-complexity default 15 corroborated only via secondary sources this pass.
- No first-party Go patch-coverage enforcer verified.
- No SEI-specific numeric complexity standard independently retrieved — **do not cite one**.
- McCabe 1976 IEEE paper not opened; NIST SP 500-235 primary PDF **was** read for the 10/15 policy.
