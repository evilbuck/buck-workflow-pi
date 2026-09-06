# Tooling Matrix

Consolidated reference for quality guardrails tooling across ecosystems. Prefer tooling the project already uses. Every invocation is for **machine-readable** CI gating where supported.

**Source**: consolidated from `research-tooling-web-dynamic.md`, `research-tooling-compiled.md`, `research-tooling-jvm-and-fallback.md` (2026-07-26).

## Critical Warnings

### scc is NOT McCabe Cyclomatic Complexity

**scc's `COMPLEXITY` column is a keyword-count approximation at file level, explicitly not McCabe.** Verbatim from scc README:

> "It's my own definition, but tries to be an approximation of cyclomatic complexity … although done only at a file level."
> "The reason it's an approximation is that it's calculated almost for free from a CPU point of view (since its a cheap lookup when counting), whereas a real cyclomatic complexity count would need to parse the code."

**Rule**: use scc for quick file-level heatmaps / language inventory; **never** as the authoritative per-function CCN gate. Use `lizard` for per-function cyclomatic complexity.

### lizard Gaps

**lizard does not support Shell/Bash or Elixir.** Verbatim supported-language list from lizard README:

- C#, C/C++, Erlang, Fortran, GDScript, Golang, Java, JavaScript (ES6/JSX), Kotlin, Lua, Objective-C, Perl, PHP, PL/SQL, Python, R, Ruby, Rust, Scala, Solidity, Structured Text, Swift, TTCN-3, TypeScript (TSX), VueJS, Zig

**Not listed**: Shell/Bash, Elixir, Haskell, etc. (Erlang is listed; Elixir is not.)

For Shell: **complexity-unsupported** — document explicitly.
For Elixir: use native `credo` (`Credo.Check.Refactor.CyclomaticComplexity`).

---

## JavaScript / TypeScript (Node, Bun, Deno)

**Detection signals**: `package.json`, `tsconfig.json`, lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `bun.lock`, `deno.json`, `deno.lock`)

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| vitest | `vitest run` / `npx vitest run` | Prefer when `vitest` in `package.json` / `vitest.config.*` present. |
| jest | `jest --json --outputFile=jest-results.json` | Config: `jest.config.*` or `package.json#jest`. |
| node:test | `node --test` (Node ≥18) | Built-in; no install. |
| bun test | `bun test` | Built into Bun runtime. |
| deno test | `deno test` | Built into Deno. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| vitest + `@vitest/coverage-v8` | `vitest run --coverage --coverage.reporter=lcov` | lcov | Provider default **`v8`** since modern Vitest. Thresholds: `--coverage.thresholds.lines=N`. |
| jest | `jest --coverage --coverageReporters=lcov` | lcov | Thresholds via config `coverageThreshold` (not CLI). |
| c8 | `c8 --reporter=lcov --check-coverage --lines N <cmd>` | lcov | V8 coverage wrapper; good with `node --test`. |
| nyc (Istanbul) | `nyc --reporter=lcov --check-coverage --lines N <cmd>` | lcov | Older instrumenting path. |
| node:test built-in | `node --test --experimental-test-coverage --test-reporter=lcov` | lcov | Coverage flags marked **Experimental** [UNVERIFIED stability]. |
| bun test | `bun test --coverage --coverage-reporter=lcov` | lcov | Thresholds in `bunfig.toml`: `coverageThreshold = 0.9`. |
| deno test + coverage | `deno test --coverage` then `deno coverage --lcov` | lcov | Two-step. CLI `--threshold` is whole-number %. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| ESLint | `eslint --format stylish` | Behavior expanded via `.eslintrc*`. Promoted from complexity vehicle. | yes |
| Oxlint | `oxlint` | Rust-based, fast. Newer ecosystem. | yes |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| ESLint core `complexity` | `eslint . --format json` with rule `"complexity": ["error", N]` | Default max **20**. |
| `eslint-plugin-sonarjs` | `"sonarjs/cognitive-complexity": ["error", N]` | Default max **15**. Distinct from McCabe. |
| escomplex / complexity-report | Library only | **UNMAINTAINED** — do not introduce as new default. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Python

**Detection signals**: `pyproject.toml`, `setup.cfg`, `requirements*.txt`, `Pipfile`, `*.py`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| pytest | `pytest` | Dominant. Config: `pytest.ini`, `pyproject.toml`. |
| unittest | `python -m unittest discover` | stdlib. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| coverage.py | `coverage run -m pytest` then `coverage xml --fail-under=N` | Cobertura XML, LCOV (since 6.3) | `--fail-under=MIN` exits status **2** if total % < MIN. |
| pytest-cov | `pytest --cov=PKG --cov-report=xml --cov-fail-under=N` | xml, json, lcov | Wraps coverage.py. LCOV needs coverage.py ≥6.3. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| ruff | `ruff check` | Fast, modern, ruff-config. Promoted from complexity vehicle. | yes |
| flake8 | `flake8` | Older stdlib. Promoted from complexity vehicle. | yes |

### Cyclomatic Complexity


| Tool | Invocation | Notes |
|------|------------|-------|
| radon | `radon cc PATH -j` | JSON via `-j`. Ranks A–F. Does **not** fail CI by itself. |
| xenon | `xenon -b B -m A -a A PATH` | Threshold values are **ranks** (A–F), not integers. Built on radon. |
| flake8 + mccabe | `flake8 --max-complexity=N` | Emits **C901**. [UNVERIFIED `flake8-json` plugin flag name]. |
| ruff | `ruff check --select C901 --output-format=json` | Rule code **C901**. Default max **10**. Prefer over flake8+mccabe when ruff already adopted. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Ruby

**Detection signals**: `Gemfile`, `Gemfile.lock`, `*.rb`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| RSpec | `rspec --format json --out rspec.json` | Dominant in Rails apps. |
| minitest | `ruby -Itest test/**/*_test.rb` / `rake test` | stdlib-adjacent default for non-RSpec. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| SimpleCov | Require in test helper; `SimpleCov.start` | HTML (default), JSON, LCOV (via `simplecov-lcov` gem) | Thresholds: `SimpleCov.minimum_coverage 90`. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| RuboCop | `rubocop` | Behavior expanded via `.rubocop.yml`. Promoted from complexity vehicle. | yes |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| RuboCop `Metrics/CyclomaticComplexity` | `rubocop --format json` | Default max **7**. |
| RuboCop `Metrics/PerceivedComplexity` | same | Default max **8**. Closest to "how hard it feels". |
| flog | `flog -g lib` | [UNVERIFIED JSON CLI]. Scoring heuristic, not strict McCabe. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## PHP

**Detection signals**: `composer.json`, `composer.lock`, `*.php`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| PHPUnit | `phpunit` / `./vendor/bin/phpunit` | `phpunit.xml` / `phpunit.xml.dist`. |
| Pest | `./vendor/bin/pest` | Prefer when `pestphp/pest` present. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| PHPUnit (PCOV or Xdebug) | `phpunit --coverage-cobertura cobertura.xml` | Clover XML, Cobertura XML | **Requires** Xdebug or PCOV extension. [UNVERIFIED built-in `--coverage-fail-under` flag]. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| phpcs | `phpcs` | PHP Code Sniffer. Introduced in v2. | yes |
| phpstan | `phpstan analyse --no-progress` | Static analysis. Introduced in v2. | no |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| PHPMD | `phpmd PATH json codesize` | Rule `CyclomaticComplexity` property `reportLevel` default **10**. |
| PhpMetrics | `php ./vendor/bin/phpmetrics --report-html=myreport <folder>` | Rich design metrics including complexity. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Dart / Flutter

**Detection signals**: `pubspec.yaml`, `analysis_options.yaml`, `.dart` sources

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| dart test | `dart test` | Pure Dart packages. [UNVERIFIED exact modern `-r json` flag]. |
| flutter test | `flutter test` | Flutter apps/widgets. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| flutter test --coverage | `flutter test --coverage` | LCOV (`coverage/lcov.info`) | First-choice for Flutter. [UNVERIFIED first-party `--fail-under` flag]. |
| package:coverage | `dart pub global run coverage:test_with_coverage` | JSON + LCOV | Use when not on Flutter tool. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| dart analyze | `dart analyze` | Built-in. Promoted from complexity-vehicle file. | yes |

### Cyclomatic Complexity


**Free `dart_code_metrics` is discontinued.** Metrics moved to **commercial DCM** (https://dcm.dev/pricing/). `dart analyze` does **not** provide cyclomatic complexity thresholds.

**Fallback**: `lizard` (or budget for DCM).

---

## Go

**Detection signals**: `go.mod`, `*.go`, `*_test.go`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| `go test` (stdlib) | `go test ./...` | Default runner; packages with `*_test.go`. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| `go test` + `go tool cover` | `go test -coverprofile=cover.out ./...` then `go tool cover -func=cover.out` | Go coverprofile text | **No native `--fail-under`.** |
| `gcov2lcov` | `gcov2lcov -infile=cover.out -outfile=coverage.lcov` | lcov | Reads Go coverprofile. |
| `gocover-cobertura` | `gocover-cobertura < cover.out > coverage.xml` | Cobertura XML | Stdin coverprofile → Cobertura XML. |
| `go-test-coverage` | `go-test-coverage --config=.testcoverage.yml` | text (CI exit code) | Standard fail-under **idiom** when Go itself cannot gate. Config keys: `threshold.total` (0–100). |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| golangci-lint | `golangci-lint run` | Driver for many linters. Promoted from complexity vehicle. | no |
| `go vet` | `go vet ./...` | Built-in. Introduced in v2. | no |

### Cyclomatic Complexity


| Tool | Invocation | Notes |
|------|------------|-------|
| `gocyclo` | `gocyclo -over N .` | [UNVERIFIED JSON flag]. `-over N` exits 1 if any function > N. |
| `gocognit` | `gocognit -over N -json .` | JSON via `-json`. |
| `golangci-lint` | `golangci-lint run --out-format=json` | Linters: `gocyclo`, `gocognit`, `cyclop`. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Rust

**Detection signals**: `Cargo.toml`, `src/**/*.rs`, `tests/`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| `cargo test` | `cargo test` | [UNVERIFIED exact stable libtest JSON surface]. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| `cargo-llvm-cov` | `cargo llvm-cov --lcov --output-path lcov.info --fail-under-lines N` | lcov, JSON, Cobertura XML | Verified flags in upstream README. |
| `cargo-tarpaulin` | `cargo tarpaulin --out Lcov --fail-under N` | Lcov, Xml, Json, Html | Config: `tarpaulin.toml` `fail-under`. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| clippy | `cargo clippy --all-targets -- -D warnings` | Treat warnings as errors. Promoted from complexity vehicle. | no |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| `clippy::cognitive_complexity` | `cargo clippy -- -W clippy::cognitive_complexity` | Lint group: **`restriction`** (not on by default). Config: `cognitive-complexity-threshold = 25`. |
| `rust-code-analysis-cli` | `rust-code-analysis-cli --metrics -p path/to/src -O json` | JSON. Emits both **cyclomatic** and **cognitive**. Not a threshold gate by itself. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## C / C++

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| GoogleTest | GTest binary | Detect via `CMakeLists.txt` (`enable_testing`, `gtest_discover_tests`). |
| Catch2 | `./tests -r junit` | [UNVERIFIED exact Catch2 v3 reporter flag spelling]. |
| CTest | `ctest --output-on-failure` | |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| `gcov` + `lcov` | Build with `-fprofile-arcs -ftest-coverage` then `lcov --capture --directory . --output-file coverage.info` | lcov `.info` | Classic GCC path. |
| `llvm-cov export` | `llvm-cov export -format=lcov -instr-profile=default.profdata ./binary > lcov.info` | lcov, JSON | Pair with Clang `-fprofile-instr-generate -fcoverage-mapping`. |
| `gcovr` | `gcovr --cobertura -o cobertura.xml --fail-under-line N` | Cobertura XML, JSON, HTML | `--fail-under-line MIN` exits status **2**. [UNVERIFIED all gcovr config filenames]. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| cppcheck | `cppcheck --enable=warning,style --error-exitcode=1` | Static analysis. Promoted from complexity vehicle. | yes |
| clang-tidy | `clang-tidy ...` | C++ linter. Promoted from complexity vehicle. | yes |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| `lizard` | `lizard -C N --xml` | Default CCN warning threshold **15**. |
| `pmccabe` | `pmccabe -v file.c` | No first-class JSON/XML. No native max-N fail flag. |
| `cppcheck` metrics | `cppcheck --enable=metrics --xml-version=3` | XML v3 `<metric id="cyclomaticComplexity"`. Not a dedicated complexity CLI. |
| `clang-tidy` | `clang-tidy -checks='-*,readability-function-cognitive-complexity'` | Default **Threshold = 25**. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Swift

**Detection signals**: `Package.swift`, `*.xcodeproj` / `*.xcworkspace`, `*.swift`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| XCTest (Xcode / SPM) | `swift test` / `xcodebuild test -scheme S` | |
| swift-testing | `swift test` | May coexist with XCTest. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| `swift test --enable-code-coverage` + `llvm-cov` | `swift test --enable-code-coverage` then `llvm-cov export -format=lcov` | profdata + lcov/JSON | **No native fail-under** — gate via parsed lcov. |
| `xcodebuild` + `xccov` | `xcodebuild test -enableCodeCoverage YES -resultBundlePath TestResults.xcresult` then `xcrun xccov view --report --json TestResults.xcresult` | xcresult, JSON | `--report --json` on `.xcresult` is the modern CI form. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| SwiftLint | `swiftlint lint --strict` | Promoted from complexity vehicle. | yes |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| SwiftLint `cyclomatic_complexity` | `swiftlint lint --reporter json` | Defaults: **warning 10**, **error 20**. [UNVERIFIED whether a distinct cognitive rule exists in third-party SwiftLint plugins]. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## C# / .NET

**Detection signals**: `*.sln`, `*.csproj` (`Microsoft.NET.Sdk`), `global.json`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| xUnit / NUnit / MSTest via `dotnet test` | `dotnet test --logger "trx;LogFileName=results.trx"` | Detect `*.csproj` test SDK + package refs. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| Coverlet collector | `dotnet test --collect:"XPlat Code Coverage;Format=cobertura"` | default **cobertura** XML | Package: `coverlet.collector`. |
| Coverlet MSBuild | `dotnet test /p:CollectCoverage=true /p:Threshold=N /p:ThresholdType=line` | json, lcov, opencover, cobertura | **Threshold gating is on the MSBuild driver**, not the collector string alone. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| dotnet format | `dotnet format --verify-no-changes` | Verify-only. Introduced in v2. | no |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| Roslyn CA1502 | `.editorconfig` → `dotnet_diagnostic.CA1502.severity = warning` | Default threshold **25**. **Disabled by default in .NET 10.** |
| `Microsoft.CodeAnalysis.Metrics` | `msbuild /t:Metrics` | XML `CodeMetricsReport`. Does not fail builds alone. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Java

**Detection signals**: `pom.xml`, `build.gradle` / `build.gradle.kts`, `src/main/java`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| JUnit 5 (Jupiter) | Maven: `mvn test`. Gradle: `./gradlew test` | Detect via `pom.xml` `junit-jupiter` / `build.gradle` `useJUnitPlatform()`. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| JaCoCo Maven | `mvn test jacoco:report` / `mvn jacoco:check` | HTML + XML + CSV | Plugin: `org.jacoco:jacoco-maven-plugin`. |
| JaCoCo Gradle | `./gradlew jacocoTestReport` / `jacocoTestCoverageVerification` | XML/CSV/HTML | Verification is **opt-in** (not part of `check` unless wired). |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| Checkstyle (Maven) | `mvn checkstyle:check` | Promoted from complexity vehicle. | no |
| Checkstyle (Gradle) | `./gradlew checkstyleMain` | Promoted from complexity vehicle. | no |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| PMD `CyclomaticComplexity` | `pmd check -d src/main/java -R category/java/design.xml -f json` | Properties: `methodReportLevel` (default **10**), `classReportLevel` (default **80**). |
| Checkstyle `CyclomaticComplexity` | `java -jar checkstyle-*.jar -c config.xml -f xml` | Module property `max` (default **10**). |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Kotlin

**Detection signals**: `*.kt`, `build.gradle.kts` + Kotlin plugin

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| JUnit 5 / Kotest | `./gradlew test` | Kotest often runs on JUnit platform. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| JaCoCo (same as Java) | `./gradlew jacocoTestReport` | XML/HTML/CSV | Works for Kotlin bytecode. |
| Kover | `./gradlew koverXmlReport` / `koverVerify` | XML (JaCoCo-compatible) | DSL: `kover { reports { verify { rule { minBound(N) } } } }`. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| detekt | `detekt --input src` | Static analysis. Promoted from complexity vehicle. | no |
| detekt (Gradle) | `./gradlew detekt` | Gradle form. Fallback to detekt CLI. | no |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| detekt `CyclomaticComplexMethod` | `detekt --input src --report checkstyle:reports/detekt.xml` | **Config key is `allowedComplexity` (default 14), not `threshold`.** Rule renamed from historical `ComplexMethod`. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .`

---

## Scala

**Detection signals**: `build.sbt`, `project/build.properties`, `*.scala`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| ScalaTest / munit via sbt | `sbt test` | Detect `build.sbt`, deps `scalatest` / `munit`. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| sbt-scoverage | `sbt clean coverage test coverageReport` | HTML + XML | [UNVERIFIED exact default Cobertura filename in latest sbt-scoverage]. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| scalastyle | `sbt scalastyle` | Promoted from complexity vehicle. | no |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| Scalastyle `CyclomaticComplexityChecker` | `sbt scalastyle` | Params: `maximum` (default **10**). **Maintenance: upstream last push 2022-09-16** — stagnant. [UNVERIFIED exact CLI `--format` flag name for standalone]. |

**Fallback**: `lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .` (Scala is in lizard's supported list).

---

## Elixir

**Detection signals**: `mix.exs`, `lib/**/*.ex`, `mix.lock`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| ExUnit via Mix | `mix test` | Detect `mix.exs`, `test/test_helper.exs`. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| Built-in `mix test --cover` | `mix test --cover` | OTP cover HTML | `test_coverage: [summary: [threshold: N]]` in `mix.exs`. |
| excoveralls | `mix coveralls.cobertura` | JSON, Cobertura XML | Fail under: `"minimum_coverage": N` in `coveralls.json`. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| Credo | `mix credo --strict` | Static analysis. Promoted from complexity vehicle. | no |

### Cyclomatic Complexity

| Tool | Invocation | Notes |
|------|------------|-------|
| Credo `CyclomaticComplexity` | `mix credo --format json` | Param **`:max_complexity` default 9**. Enabled by default. |

**Fallback**: `lizard` does **not** support Elixir. Use native `credo`.

---

## Shell / Bash

**Detection signals**: `*.sh`, `*.bash`, `*.bats`, shebang `#!/usr/bin/env bash`

### Test Runners

| Tool | Invocation | Notes |
|------|------------|-------|
| bats-core | `bats --formatter tap test/` | Detect `*.bats`, `test/test_helper`. |

### Coverage

| Tool | Invocation (machine-readable) | Output format | Notes |
|------|-------------------------------|---------------|-------|
| kcov | `kcov /path/to/outdir bats test/` | Cobertura XML, JSON | [UNVERIFIED if a `--threshold` flag exists in latest kcov]. |

### Lint

| Tool | Invocation | Notes | Accepts paths |
|------|------------|-------|---------------|
| shellcheck | `shellcheck` | Static analysis/lint (bugs, style, POSIX). | yes |

### Cyclomatic Complexity

**shellcheck does NOT compute cyclomatic complexity** — it is a static analysis/lint tool (bugs, style, POSIX), not a CCN tool.

**lizard does not officially support Shell/Bash** (no reader in `lizard_languages/`). Fallback remains lizard for polyglot consistency, but expect weak/empty shell function metrics.

**Status**: Shell is **complexity-unsupported**. Document explicitly.

---

## Functional / E2E Detection

Only the signals below produce a non-null `functional_test_cmd`. Everything else is `null` and `/b-init-guardrails` Phase 2 asks the user.

| Ecosystem | Signal | `functional_test_cmd` |
|---|---|---|
| typescript | `playwright.config.{js,ts,mjs,cjs}` at repo root | `playwright test` |
| typescript | `cypress.config.{js,ts,mjs,cjs}` at repo root | `cypress run` |
| python | directory `tests/e2e/` or `tests/functional/` exists | `pytest <that dir>` |
| go | any `*_test.go` whose first 5 lines contain `//go:build integration` | `go test -tags=integration ./...` |
| ruby | directory `spec/system/` (preferred) or `spec/features/` | `rspec <that dir>` |
| java / kotlin | `pom.xml` contains `maven-failsafe-plugin` | `mvn failsafe:integration-test` |
| java / kotlin | `build.gradle*` contains `integrationTest` | `./gradlew integrationTest` |
| rust | `tests/*.rs` exists | `cargo test --test '*'` |
| all others | — | `null` |

Precedence within an ecosystem is top-to-bottom; first match wins.

---

## Universal Fallback: lizard

**lizard** is the polyglot safety net for per-function cyclomatic complexity when ecosystem-native tools are missing, unknown, or unmaintained.

### Supported Languages (verbatim from README)

C#, C/C++, Erlang, Fortran, GDScript, Golang, Java, JavaScript (ES6/JSX), Kotlin, Lua, Objective-C, Perl, PHP, PL/SQL, Python, R, Ruby, Rust, Scala, Solidity, Structured Text, Swift, TTCN-3, TypeScript (TSX), VueJS, Zig

**Not supported**: Shell/Bash, Elixir, Haskell, etc.

### Exact Flags

| Flag | Meaning |
|------|---------|
| `-C N`, `--CCN N` | CCN warning threshold (default **15**). Functions with CCN **bigger than** N warn. |
| `-w`, `--warnings_only` | Warnings only, clang/gcc warning format. |
| `-X`, `--xml` | XML in cppncss style (Jenkins-friendly). |
| `--csv` | CSV transform of default output. |
| `-m`, `--modified` | Modified cyclomatic complexity: count a switch/case with multiple cases as one CCN. |
| `-i N`, `--ignore_warnings N` | Exit 0 if warnings ≤ N. |

### Exit-Code Behavior

README: "The exit code of lizard will be none-Zero if there are warnings."

Implementation: returns **1** when `warning_count > options.number` (`-i` / `--ignore_warnings`, default 0). So by default **any** threshold warning → exit 1.

### Example Enforcement Command

```bash
lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .
```

CI variant with XML artifact:

```bash
lizard -C 10 -w -X -o lizard-report.xml -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .
```

---

## scc (File-Level Heatmaps Only)

**scc** is a fast SLOC/cloc-style counter with a COMPLEXITY column. **It is NOT true McCabe cyclomatic complexity** (see Critical Warnings above).

### Use Case

Quick file-level heatmaps / language inventory. **Never** as the authoritative per-function CCN gate.

### Flags

| Flag | Meaning |
|------|---------|
| `-f`, `--format` | `tabular, wide, json, json2, csv, html, ...` |
| `--by-file` | Per-file breakdown. |
| `-s`, `--sort` | Sort column: `files, name, lines, blanks, code, comments, complexity`. |
| `--cognitive` | Cognitive (nesting-weighted) complexity — still an scc estimate, not Sonar cognitive. |

### Example

```bash
scc --by-file --format json -s complexity .
```

---

## Fallback Decision Rule

Given an **arbitrary unknown-language repo**, to obtain **per-function cyclomatic complexity** suitable for a quality gate:

1. **Prefer ecosystem-native CCN** when detection signals match (see per-ecosystem tables).
2. **If native is missing, unknown, or unmaintained → run lizard** over the tree.
3. **Do not treat scc's COMPLEXITY column as the gate** — optional inventory only.
4. **Do not use tokei for complexity** (SLOC only, no complexity metric).
5. **sonar-scanner** only when Sonar is already an org standard (heavyweight: needs SonarQube/SonarCloud backend).

### Literal Command (skill default)

```bash
lizard -C 10 -w --csv -x "*/.git/*" -x "*/.context/*" -x "*/.venv/*" -x "*/coverage/*" -x "*/dist/*" -x "*/build/*" -x "*/node_modules/*" -x "*/vendor/*" -x "*/target/*" -x "*/.next/*" -x "*/.nuxt/*" -x "*/.turbo/*" .
```
