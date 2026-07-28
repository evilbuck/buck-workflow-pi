---
status: active
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [guardrails, coverage, cyclomatic-complexity, tooling-matrix]
informs: [plan-b-init-guardrails.md]
---

# Coverage & Complexity Tooling — Web & dynamic languages

Primary-source matrix for JS/TS (Node/Bun/Deno), Python, Ruby, PHP, and Dart/Flutter. Prefer tools a project already uses. Every invocation below is for **machine-readable** CI gating where the tool supports it.

## Matrix

### JavaScript / TypeScript (Node, Bun, Deno)

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
|---|---|---|---|---|
| test runner | vitest | `vitest run` / `npx vitest run` — https://vitest.dev/guide/ | TAP/custom via reporters; default human | Prefer when `vitest` in `package.json` / `vitest.config.*` present. |
| test runner | jest | `jest --json --outputFile=jest-results.json` — https://jestjs.io/docs/cli | JSON results file | Also `jest --ci`. Config: `jest.config.*` or `package.json#jest`. |
| test runner | node:test | `node --test` (Node ≥18) — https://nodejs.org/api/test.html | `spec` (default), `tap`, custom via `--test-reporter` | Built-in; no install. Pair with coverage flags below. |
| test runner | bun test | `bun test` — https://bun.com/docs/cli/test | text (default) | Built into Bun runtime. |
| test runner | deno test | `deno test` — https://docs.deno.com/runtime/reference/cli/test/ | text (default) | Built into Deno. |
| coverage | vitest + `@vitest/coverage-v8` (default) or `@vitest/coverage-istanbul` | `vitest run --coverage` · CLI dots: `--coverage.enabled --coverage.provider=v8|istanbul --coverage.reporter=lcov --coverage.reporter=json --coverage.reporter=json-summary --coverage.reporter=cobertura --coverage.thresholds.lines=N --coverage.thresholds.functions=N --coverage.thresholds.branches=N --coverage.thresholds.statements=N` — https://vitest.dev/guide/coverage · https://vitest.dev/config/coverage | Istanbul reporters: default `['text','html','clover','json']`; also `lcov`, `json-summary`, `cobertura` (via istanbul-reports) | Provider default **`v8`** since modern Vitest. Thresholds: positive = min %; negative = max uncovered count. Config key `test.coverage`. |
| coverage | jest | `jest --coverage --coverageReporters=lcov --coverageReporters=json --coverageReporters=text` — https://jestjs.io/docs/configuration#coveragereporters-arraystring--string-options · thresholds via config `coverageThreshold` (not a one-shot CLI % flag) | Default reporters `["clover","json","lcov","text"]`; dir `coverage/` | `coverageProvider`: `babel` (default) or `v8`. `coverageThreshold.global.{branches,functions,lines,statements}` — positive min %, negative max uncovered. |
| coverage | c8 | `c8 --reporter=lcov --reporter=text --check-coverage --lines N --functions N --branches N --statements N <cmd>` or `c8 check-coverage --lines N` — https://github.com/bcoe/c8 | lcov/text/html/json (Istanbul reporters) | V8 coverage wrapper; good with `node --test` / plain node. |
| coverage | nyc (Istanbul) | `nyc --reporter=lcov --reporter=text-summary --check-coverage --lines N <cmd>` — https://github.com/istanbuljs/nyc | lcov/json/html/text | Older instrumenting path; still common. Thresholds also via `.nycrc` keys `lines`/`branches`/`functions`/`statements` + `check-coverage: true`. |
| coverage | node:test built-in | `node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=lcov.info` · thresholds: `--test-coverage-lines=N --test-coverage-functions=N --test-coverage-branches=N` — https://nodejs.org/api/test.html · https://nodejs.org/api/cli.html | lcov via built-in `lcov` reporter; summary on tap/spec | Coverage + threshold flags marked **Experimental**. Include/exclude: `--test-coverage-include` / `--test-coverage-exclude`. |
| coverage | bun test | `bun test --coverage --coverage-reporter=lcov` — https://bun.com/docs/test/code-coverage | text table; `coverage/lcov.info` with lcov reporter | Thresholds in `bunfig.toml`: `[test] coverageThreshold = 0.9` or `{ lines = 0.9, functions = 0.9, statements = 0.9 }` (fractions 0–1). Fail-on-low when any threshold set. |
| coverage | deno test + deno coverage | `deno test --coverage[=dir] [--coverage-threshold=N]` then `deno coverage [dir] --lcov --output=cov.lcov` or `deno coverage --threshold=90` — https://docs.deno.com/runtime/reference/cli/coverage/ | Deno summary table; `--lcov`; `--html` | Two-step. CLI `--threshold` / `--coverage-threshold` is whole-number % applied to line+branch+function. Per-metric via `deno.json` → `"coverage": { "thresholds": { "lines": 90, "branches": 80, "functions": 90 } }` (fractional % values in config). |
| cyclomatic complexity | ESLint core `complexity` | `eslint . --format json` with rule `"complexity": ["error", N]` or `["error", { "max": N, "variant": "classic"|"modified" }]` — https://eslint.org/docs/latest/rules/complexity | ESLint JSON formatter | Default max **20**. Shorthand number or `{ max }`. `variant: "modified"` counts each `switch` as +1 total. |
| cognitive complexity | `eslint-plugin-sonarjs` rule `sonarjs/cognitive-complexity` | `eslint . --format json` with `"sonarjs/cognitive-complexity": ["error", N]` — https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md | ESLint JSON | Default max **15**. Distinct from McCabe. |
| cyclomatic complexity | escomplex / complexity-report / typhonjs-escomplex | Library: `escomplex.analyse(source)` (escomplex) / `typhonjs-escomplex` `analyzeModule` — CLI `complexity-report` historically | JSON reports (library) | **Maintenance status:** `escomplex/complexity-report` README marks **UNMAINTAINED** (last push ~2020). `escomplex/escomplex` still unarchived but quiet. `typhonjs-node-escomplex/typhonjs-escomplex` is a Babel-parser fork; last push ~2022 — treat as **stale**, prefer ESLint rules for CI gates. |
| machine-readable lint | ESLint | `eslint [files] --format json` (also `-f json`) — https://eslint.org/docs/latest/use/formatters/ | JSON array of file results | Use exit code + JSON for complexity violations. |

### Python

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
|---|---|---|---|---|
| test runner | pytest | `pytest` / `pytest -q` — https://docs.pytest.org/ | JUnit via `--junitxml=path` | Dominant. Config: `pytest.ini`, `pyproject.toml` `[tool.pytest.ini_options]`, `setup.cfg`. |
| test runner | unittest | `python -m unittest discover` — https://docs.python.org/3/library/unittest.html | text | stdlib. |
| coverage | coverage.py | `coverage run -m pytest` then `coverage report --fail-under=N` · `coverage json [-o coverage.json] [--fail-under=N]` · `coverage xml [-o coverage.xml] [--fail-under=N]` · `coverage lcov [-o coverage.lcov] [--fail-under=N]` — https://coverage.readthedocs.io/ (cmd pages in repo `doc/commands/`) | text summary; JSON; Cobertura-compatible XML; LCOV (since 6.3) | Config: `.coveragerc`, `pyproject.toml` `[tool.coverage.*]`, `setup.cfg`, `tox.ini`. `--fail-under=MIN` exits status **2** if total % < MIN. |
| coverage | pytest-cov | `pytest --cov=PKG --cov-report=xml --cov-report=json --cov-report=lcov --cov-report=term --cov-fail-under=N` — https://github.com/pytest-dev/pytest-cov/blob/master/docs/config.rst | term/html/xml/json/lcov/markdown (+ `:DEST` suffix for path) | Wraps coverage.py. `--cov-report=` (empty) suppresses output. LCOV needs coverage.py ≥6.3. |
| cyclomatic complexity | radon | `radon cc PATH -j` (JSON) · `radon cc PATH -n C` (min rank) · `radon cc -s -a` — https://radon.readthedocs.io/ · https://github.com/rubik/radon | JSON via `-j`/`--json`; also `--xml`, `--md` | Ranks A–F (1–5 A … 41+ F). Does **not** fail CI by itself — pair with xenon. |
| cyclomatic complexity | xenon | `xenon -b B -m A -a A PATH` / `xenon --max-absolute=B --max-modules=A --max-average=A` — https://github.com/rubik/xenon | text; **non-zero exit** on breach | Threshold values are **ranks** (A–F), not integers. Built on radon. |
| cyclomatic complexity | flake8 + mccabe | `flake8 --max-complexity=N` — https://flake8.pycqa.org/ · https://github.com/PyCQA/mccabe | flake8 text; JSON via `flake8 --format=json` if `flake8-json` plugin present [UNVERIFIED plugin flag name without plugin] | Emits **C901**. McCabe plugin disabled until `--max-complexity` set. |
| cyclomatic complexity | ruff | `ruff check --select C901 --output-format=json` · config `[tool.ruff.lint.mccabe] max-complexity = N` (default **10**) — https://docs.astral.sh/ruff/settings/ · rule https://docs.astral.sh/ruff/rules/complex-structure/ | `json`, `junit`, `github`, `gitlab`, `full`, … via `--output-format` / `output-format` | Rule code **C901** (`complex-structure`). Prefer over flake8+mccabe when ruff already adopted. |
| cognitive complexity | — | No widely standard free CLI equivalent to Sonar cognitive complexity in CPython core tooling | — | SonarQube/SonarCloud analyzers exist but are product-bound; not listed as a default local gate. |

### Ruby

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
|---|---|---|---|---|
| test runner | RSpec | `rspec --format json --out rspec.json` — https://rspec.info/ | JSON formatter | Dominant in Rails apps. |
| test runner | minitest | `ruby -Itest test/**/*_test.rb` / `rake test` — https://github.com/minitest/minitest | text | stdlib-adjacent default for non-RSpec. |
| coverage | SimpleCov | Require in test helper; `SimpleCov.start` · formatter `SimpleCov::Formatter::JSONFormatter` → `coverage.json` · LCOV via community gem `simplecov-lcov` — https://github.com/simplecov-ruby/simplecov · alternate formatters doc | HTML (default), built-in JSON; `.resultset.json` internal | Thresholds (exit non-zero): `SimpleCov.minimum_coverage 90` or `minimum_coverage line: 90, branch: 80`; per-file via `coverage :line { minimum_per_file N }` (legacy `minimum_coverage_by_file` deprecated). Also `maximum_coverage_drop`, `refuse_coverage_drop`. |
| cyclomatic complexity | RuboCop `Metrics/CyclomaticComplexity` | `rubocop --format json` · cop config `Max: N` (default **7**) — https://docs.rubocop.org/rubocop/cops_metrics.html · default.yml in rubocop repo | RuboCop JSON formatter | Enable/tune in `.rubocop.yml`. |
| cyclomatic complexity (perceived) | RuboCop `Metrics/PerceivedComplexity` | same `rubocop --format json` · `Max:` default **8** | JSON | Closest built-in to “how hard it feels”; not Sonar cognitive complexity. |
| complexity (ABC) | RuboCop `Metrics/AbcSize` | `rubocop --format json` · `Max:` (numeric magnitude) | JSON | Assignment/Branch/Condition size metric. |
| complexity (pain) | flog | `flog -g lib` — https://github.com/seattlerb/flog · http://docs.seattlerb.org/flog | text “pain” report | Scoring heuristic, not strict McCabe. No first-class JSON flag in README — parse text or use library API [UNVERIFIED JSON CLI]. |
| cognitive complexity | — | No standard free Ruby cop named cognitive-complexity in core RuboCop | — | Use PerceivedComplexity or external services. |

### PHP

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
|---|---|---|---|---|
| test runner | PHPUnit | `phpunit` / `./vendor/bin/phpunit` — https://phpunit.de/ | JUnit/logging via CLI/config | `phpunit.xml` / `phpunit.xml.dist`. |
| test runner | Pest | `./vendor/bin/pest` — https://pestphp.com/ | Pest wraps PHPUnit | Prefer when `pestphp/pest` present; coverage flags largely PHPUnit-compatible. |
| coverage | PHPUnit (driver: **PCOV** or **Xdebug**) | `phpunit --coverage-clover clover.xml --coverage-cobertura cobertura.xml --coverage-xml coverage-xml/ --coverage-text` — flags from PHPUnit Help.php source | Clover XML, Cobertura XML, directory XML, text; also `--coverage-html`, `--coverage-crap4j`, `--coverage-php`, `--coverage-openclover` | **Requires** Xdebug or PCOV extension — without a driver, coverage commands fail. Config `<coverage>` in `phpunit.xml` (schema `coverageType` + report children). Filters: `--coverage-filter <dir>`. Branch/path: `--branch-coverage` / `--path-coverage`. |
| cyclomatic complexity | PHPMD | `phpmd PATH json codesize` · rule `CyclomaticComplexity` property `reportLevel` default **10** — https://phpmd.org/rules/codesize.html · https://phpmd.org/documentation/index.html | Formats: `xml`, `text`, `html`, **`json`** | Ruleset short name `codesize`. Example property override via custom ruleset XML `reportLevel`. |
| complexity / metrics | PhpMetrics | `php ./vendor/bin/phpmetrics --report-html=myreport <folder>` — https://github.com/phpmetrics/PhpMetrics | HTML report; `--metrics` lists metrics | Rich design metrics including complexity; CI rule config via its config file [exact fail-under JSON flag: see project config docs]. |
| type analysis (not complexity) | PHPStan / Psalm | `phpstan analyse` / `psalm` | JSON formats available | **Do not conflate** with cyclomatic complexity — they are static type/analysis tools. |
| cognitive complexity | — | PHPMD focuses on cyclomatic / NPath / related size rules | — | SonarPHP offers cognitive complexity in Sonar products. |

### Dart / Flutter

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
|---|---|---|---|---|
| test runner | dart test | `dart test` — https://dart.dev/tools/dart-test | text; JSON reporter available via `-r json` [UNVERIFIED exact modern flag: historically `--reporter json`] | Pure Dart packages. |
| test runner | flutter test | `flutter test` — https://docs.flutter.dev/testing | text | Flutter apps/widgets. |
| coverage | flutter test --coverage | `flutter test --coverage` · optional `--coverage-path=coverage/lcov.info` (default **`coverage/lcov.info`**) · `--branch-coverage` — flags from `flutter_tools` `test.dart` | LCOV (`coverage/lcov.info`) | First-choice for Flutter. |
| coverage | package:coverage | `dart pub global activate coverage` then `dart pub global run coverage:test_with_coverage` → `coverage/coverage.json` + `coverage/lcov.info` · or `format_coverage --lcov -i coverage.json -o coverage/lcov.info` — https://pub.dev/packages/coverage · https://github.com/dart-lang/coverage | JSON + LCOV | Moved under `dart-lang/tools` pkgs/coverage. Use when not on Flutter tool. |
| cyclomatic / cognitive complexity | **DCM (Dart Code Metrics)** — commercial | DCM product CLI/metrics — https://dcm.dev/ · pricing https://dcm.dev/pricing/ | Product-specific | **`dart_code_metrics` on pub.dev is discontinued** (package page: “This package has been discontinued… purchase a license https://dcm.dev/pricing/”). Free OSS package is **not** maintained; metrics live in the commercial DCM product. |
| analysis (not complexity gates) | dart analyze | `dart analyze` — https://dart.dev/tools/dart-analyze | text / machine via analyzer protocols | Official analyzer: lints/errors/warnings only — **no built-in cyclomatic-complexity threshold metric** comparable to ESLint `complexity` or radon. |
| fallback complexity | lizard / scc (polyglot) | see fallback matrix (MatrixJvmFallback / polyglot tools) | CSV/JSON depending on tool | Use when DCM license is unavailable. |

## Detection signals

| Ecosystem | Proves ecosystem | Proves coverage already configured | Proves complexity already configured |
|---|---|---|---|
| JS/TS (Node) | `package.json` with `"type"`/engines; lockfiles `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` | `package.json` devDeps `@vitest/coverage-v8` / `@vitest/coverage-istanbul` / `jest`+`--coverage` scripts; `vitest.config.*` → `test.coverage`; `jest.config.*` → `collectCoverage`/`coverageThreshold`/`coverageReporters`; `.nycrc*` / `nyc` config in package.json; `c8` devDep; CI invoking `--coverage` | ESLint config (`eslint.config.js` / `.eslintrc*`) rule `complexity` or `sonarjs/cognitive-complexity`; devDep `eslint-plugin-sonarjs` |
| JS/TS (Bun) | `bun.lockb` / `bun.lock`; `bunfig.toml` | `bunfig.toml` `[test] coverage = true` / `coverageThreshold` / `coverageReporter` | same ESLint signals (Bun often still uses ESLint) |
| JS/TS (Deno) | `deno.json` / `deno.jsonc`; `deno.lock` | `deno.json` `"coverage"` key / `"tasks"` with `deno test --coverage`; committed `coverage/` profiles | `deno lint` config — complexity rules limited; often external |
| Python | `pyproject.toml` / `setup.cfg` / `requirements*.txt` / `Pipfile` / `*.py` | `pyproject.toml` `[tool.coverage.*]` or `[tool.pytest.ini_options] addopts` with `--cov`; `.coveragerc`; dev deps `coverage`, `pytest-cov` | `pyproject.toml` `[tool.ruff.lint.mccabe] max-complexity`; ruff select includes `C901` / `mccabe`; `.flake8` / `setup.cfg` `[flake8] max-complexity`; `xenon` in CI; `radon.cfg` |
| Ruby | `Gemfile` / `Gemfile.lock`; `*.rb` | `Gemfile` `simplecov` (group :test); `test_helper.rb` / `spec_helper.rb` `SimpleCov.start`; `minimum_coverage` in SimpleCov block; `simplecov-lcov` gem | `.rubocop.yml` `Metrics/CyclomaticComplexity` / `PerceivedComplexity` / `AbcSize` with `Max:`; `flog` in CI |
| PHP | `composer.json` / `composer.lock`; `*.php` | `phpunit.xml*` `<coverage>` element or report children; CI `phpunit --coverage-*`; ext-pcov/xdebug in CI image; `pestphp/pest` scripts | `phpmd.xml` / ruleset referencing `codesize` / `CyclomaticComplexity`; Composer require-dev `phpmd/phpmd`, `phpmetrics/phpmetrics` |
| Dart/Flutter | `pubspec.yaml`; `analysis_options.yaml`; `.dart` sources; Flutter → `sdk: flutter` | `flutter test --coverage` in CI; committed/ignored `coverage/lcov.info`; dev_dep or global `coverage` package; scripts calling `format_coverage` / `test_with_coverage` | Historical `dart_code_metrics` in `pubspec.yaml` (legacy); modern `dcm` CI step / `dcm_*.yaml` config; **absence is common** after DCM commercialization |

## Threshold-enforcement knobs

| Ecosystem | Native "fail under N%" coverage flag | Native complexity max flag |
|---|---|---|
| Vitest | `--coverage.thresholds.lines=N` (also `.functions`/`.branches`/`.statements`); config `coverage.thresholds`; shortcut `--coverage.thresholds.100` | ESLint `"complexity": ["error", N]` or `{ "max": N }`; SonarJS `"sonarjs/cognitive-complexity": ["error", N]` (default 15) |
| Jest | Config only: `coverageThreshold: { global: { lines: N, ... } }` (positive min % or negative max uncovered) — enforced when `--coverage` runs | same ESLint rules |
| c8 | `c8 --check-coverage --lines N --functions N --branches N --statements N` or `c8 check-coverage --lines N`; `--100` | ESLint |
| nyc | `nyc --check-coverage --lines N …` or config `"check-coverage": true` + `"lines": N` | ESLint |
| node:test | `--test-coverage-lines=N --test-coverage-functions=N --test-coverage-branches=N` (experimental) | ESLint |
| bun test | `bunfig.toml` `[test] coverageThreshold = 0.9` or `{ lines = 0.9, functions = 0.9, statements = 0.9 }` (0–1 fractions) | ESLint |
| deno | `deno test --coverage --coverage-threshold=90` or `deno coverage --threshold=90`; `deno.json` `coverage.thresholds.{lines,branches,functions}` | No first-class deno-lint cyclomatic max equivalent to ESLint `complexity` [prefer ESLint on shared TS or polyglot lizard] |
| coverage.py | `coverage report\|json\|xml\|lcov --fail-under=N` (exit status 2) | — |
| pytest-cov | `pytest --cov-fail-under=N` | — |
| radon | (report only) | filter ranks: `radon cc -n <rank>` (display filter, not fail) |
| xenon | — | `--max-absolute=<rank>` / `-b`; `--max-modules` / `-m`; `--max-average` / `-a` (ranks A–F) |
| flake8+mccabe | — | `--max-complexity=N` → C901 |
| ruff | — | `[tool.ruff.lint.mccabe] max-complexity = N` (default 10) with rule C901; `ruff check --select C901` |
| SimpleCov | `SimpleCov.minimum_coverage N` or `line: N, branch: M`; `coverage :line { minimum N; minimum_per_file N }` | — |
| RuboCop | — | `Metrics/CyclomaticComplexity: Max: N` (default 7); `Metrics/PerceivedComplexity: Max: N` (default 8); `Metrics/AbcSize: Max: N` |
| flog | — | threshold via CI script comparing scores [no single official `--max` in README synopsis] |
| PHPUnit | No single universal `--coverage-min` in Help.php flags list — enforce via CI tools parsing clover/cobertura or third-party extensions [UNVERIFIED built-in min % flag] | — |
| PHPMD | — | rule property `reportLevel` (default 10) on `CyclomaticComplexity`; any violation fails depending on CI treating PHPMD exit code |
| PhpMetrics | config-driven CI thresholds [see phpmetrics configuration docs] | HTML/metrics include cyclomatic-related measures |
| flutter/dart coverage | No built-in `--fail-under` on `flutter test --coverage`; gate by parsing `coverage/lcov.info` in CI [UNVERIFIED first-party fail-under] | DCM commercial metrics thresholds; **not** in free `dart analyze` |

## Gaps

- **Dart/Flutter complexity:** Free `dart_code_metrics` is **discontinued**; metrics moved to **commercial DCM** (https://dcm.dev/pricing/). `dart analyze` does **not** provide cyclomatic/cognitive complexity thresholds. **Fallback:** polyglot `lizard` (or `scc` for counts only) in CI, or budget for DCM.
- **Deno complexity:** No strong built-in cyclomatic gate comparable to ESLint `complexity`. **Fallback:** run ESLint on TS sources if applicable, else `lizard`.
- **Bun complexity:** Same as Node — rely on ESLint; bun test has coverage thresholds but not complexity.
- **PHP coverage fail-under:** PHPUnit emits rich coverage formats but Help.php shows **no** native `--coverage-fail-under=N`; CI must parse Clover/Cobertura or use a helper. **Fallback:** `coverage-check` style Composer tools or xmllint/scripts on clover totals.
- **PHP cognitive complexity:** Not in PHPMD codesize defaults the way Sonar defines cognitive complexity. **Fallback:** PHPMD `CyclomaticComplexity`/`NPathComplexity`, PhpMetrics, or SonarPHP.
- **Ruby cognitive complexity:** RuboCop has PerceivedComplexity (default Max 8), not Sonar cognitive complexity. **Fallback:** PerceivedComplexity + AbcSize; flog for “pain”.
- **Python cognitive complexity:** No radon/xenon/ruff equivalent to Sonar cognitive complexity in the standard free set. **Fallback:** xenon/radon/ruff C901 (McCabe only).
- **JS escomplex ecosystem:** `complexity-report` explicitly **UNMAINTAINED**; typhonjs fork stale. **Do not introduce** as new default — prefer ESLint `complexity` + optional `sonarjs/cognitive-complexity`.
- **node:test coverage:** Powerful but flags still **Experimental**; many repos still choose c8 for stable lcov + `--check-coverage`.

### Prefer-existing decision cheat-sheet

1. Detect lockfile / manifest → ecosystem.
2. If coverage tool already configured (table signals) → reuse its fail-under knob; do not add a second coverage stack.
3. If ESLint/RuboCop/ruff/PHPMD already present → enable complexity cops/rules there before adding radon/xenon/flog/DCM.
4. Only when no complexity tool exists: Python→ruff C901 or xenon; JS→ESLint complexity; Ruby→RuboCop Metrics; PHP→PHPMD codesize; Dart→lizard unless DCM licensed.

