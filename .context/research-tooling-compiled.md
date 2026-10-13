---
status: active
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [guardrails, coverage, cyclomatic-complexity, tooling-matrix]
informs: [plan-b-init-guardrails.md]
---

# Coverage & Complexity Tooling — Compiled & systems languages

Source-verified matrix for **Go, Rust, C/C++, Swift, C#/.NET**. Prefer tooling already present in a repo. URLs point at primary docs/repos. Anything not confirmed is tagged `[UNVERIFIED]`.

**Critical Go note:** the Go toolchain has **no native coverage fail-under flag**. Threshold enforcement requires a third-party checker (e.g. `go-test-coverage`) or a script over `go tool cover -func`.

## Matrix

### Go

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | `go test` (stdlib) — https://pkg.go.dev/cmd/go#hdr-Test_packages / https://go.dev/doc/tutorial/add-a-test | `go test ./...` · verbose: `go test -json ./...` | text · JSON lines (`-json`) | Default runner; packages with `*_test.go`. |
| coverage | `go test` + `go tool cover` — https://go.dev/blog/cover · flags in https://github.com/golang/go/blob/master/src/cmd/go/alldocs.go | Profile: `go test -coverprofile=cover.out -covermode=atomic\|count\|set ./...` · Func table: `go tool cover -func=cover.out` · HTML: `go tool cover -html=cover.out` | Go coverprofile text · func table text · HTML | `-covermode`: `set` (default unless `-race`), `count`, `atomic` (required with `-race`). **No native `--fail-under`.** |
| coverage (lcov convert) | `gcov2lcov` — https://github.com/jandelgado/gcov2lcov | `gcov2lcov -infile=cover.out -outfile=coverage.lcov` | lcov | Reads Go coverprofile; optional `-use-absolute-source-path`. |
| coverage (cobertura convert) | `gocover-cobertura` — https://github.com/t-yuki/gocover-cobertura | `gocover-cobertura < cover.out > coverage.xml` | Cobertura XML | Stdin coverprofile → Cobertura XML. |
| coverage threshold (third-party) | `go-test-coverage` — https://github.com/vladopajic/go-test-coverage | `go-test-coverage --config=.testcoverage.yml` after `go test -coverprofile=cover.out ...` | text (CI exit code) · badges optional | Config keys: `profile`, `threshold.file` / `threshold.package` / `threshold.total` (0–100). Standard fail-under **idiom** when Go itself cannot gate. Alternatives seen in wild: `overcover`, `limgo` — prefer whichever the repo already vendors. |
| cyclomatic complexity | `gocyclo` — https://github.com/fzipp/gocyclo | `gocyclo -over N .` · `gocyclo -top N .` · `gocyclo -avg .` | text lines: `<complexity> <package> <function> <file:line:col>` | **No native JSON flag** in upstream README. `-over N` exits 1 if any function > N. Ignore via `//gocyclo:ignore`. |
| cognitive complexity | `gocognit` — https://github.com/uudashr/gocognit | `gocognit -over N -json .` · also `-top N`, `-avg`, `-f format` | text or **JSON** (`-json`) | `-over N` exits 1 if output non-empty. Ignore via `//gocognit:ignore`. |
| complexity (aggregator) | `golangci-lint` linters `gocyclo` / `gocognit` / `cyclop` — https://golangci-lint.run/docs/linters/ · schema https://github.com/golangci/golangci-lint | **v1:** `golangci-lint run --out-format=json` · **v2:** `golangci-lint run --output.json.path=stdout` (or file path) | JSON (also checkstyle, code-climate, sarif, junit-xml, …) | `.golangci.yml` settings (v2 schema): `linters.settings.gocyclo.min-complexity` (default 30), `linters.settings.gocognit.min-complexity` (default 30), `linters.settings.cyclop.max-complexity` (default 10), `cyclop.package-average`. Enable via `linters.enable: [gocyclo, gocognit, cyclop]`. v1 used `linters-settings:`; v2 nests under `linters.settings`. `--out-format` deprecated in v2 → `--output.json.path`. |

### Rust

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | `cargo test` — https://doc.rust-lang.org/cargo/commands/cargo-test.html | `cargo test` · JSON: `cargo test -- --format json` (libtest) `[UNVERIFIED` exact stable libtest JSON surface across editions — prefer cargo's own message format where needed`]` | text · JSON (libtest) | Workspace: `cargo test --workspace`. |
| coverage | `cargo-llvm-cov` — https://github.com/taiki-e/cargo-llvm-cov | `cargo llvm-cov --lcov --output-path lcov.info` · `--json --output-path cov.json` · `--cobertura --output-path cobertura.xml` · fail: `--fail-under-lines N` (also `--fail-under-functions`, `--fail-under-regions`, `--fail-under-file-lines`) | lcov · JSON (llvm-cov + extras) · Cobertura XML · HTML | Internally calls `llvm-cov export -format=lcov` / JSON. Verified flags in upstream README. |
| coverage | `cargo-tarpaulin` — https://github.com/xd009642/tarpaulin | `cargo tarpaulin --out Lcov --out Xml --out Json` · `--fail-under N` · `--output-dir PATH` | Lcov · Xml (Cobertura-style) · Json · Html · Stdout | `-o, --out [<FMT>...]` values: `Json`, `Stdout`, `Xml`, `Html`, `Lcov`. Config: `tarpaulin.toml` `fail-under`. |
| cognitive complexity | `clippy::cognitive_complexity` — https://github.com/rust-lang/rust-clippy · lint book https://doc.rust-lang.org/clippy/lint_configuration.html#cognitive-complexity-threshold | `cargo clippy -- -W clippy::cognitive_complexity` · JSON: `cargo clippy --message-format=json` | rustc/clippy JSON diagnostics | Lint group: **`restriction`** (not nursery) — confirmed in `clippy_lints/src/cognitive_complexity.rs`. Config in `clippy.toml` / `.clippy.toml`: `cognitive-complexity-threshold = 25` (default **25**). Enable explicitly; restriction lints are off by default. |
| cyclomatic + cognitive metrics | `rust-code-analysis-cli` — https://github.com/mozilla/rust-code-analysis · book https://mozilla.github.io/rust-code-analysis/ | `rust-code-analysis-cli --metrics -p path/to/src -O json -o outdir` · pretty: `--pr -O json` | JSON · TOML · YAML · CBOR | Emits both **cyclomatic** and **cognitive** metric trees (`metrics.cyclomatic`, `metrics.cognitive`). Not a threshold gate by itself — parse JSON and fail in CI. Do **not** use `cargo-geiger` (unsafe audit, not complexity). |

### C / C++

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | GoogleTest — https://google.github.io/googletest/ · Catch2 — https://github.com/catchorg/Catch2 · CTest — https://cmake.org/cmake/help/latest/manual/ctest.1.html | GTest binary / `ctest --output-on-failure` · Catch2: `./tests -r junit` / `-r xml` `[UNVERIFIED` exact Catch2 v3 reporter flag spelling if project pins older major`]` | JUnit/XML (framework-dependent) · CTest text | Detect via `CMakeLists.txt` (`enable_testing`, `gtest_discover_tests`, Catch2 cmake). |
| coverage | `gcov` + `lcov` + `genhtml` — https://gcc.gnu.org/onlinedocs/gcc/Gcov.html · https://github.com/linux-test-project/lcov | Build with `-fprofile-arcs -ftest-coverage` then: `lcov --capture --directory . --output-file coverage.info` · HTML: `genhtml coverage.info --output-directory coverage-html` | lcov `.info` · HTML | Classic GCC path. |
| coverage | `llvm-cov export` — https://llvm.org/docs/CommandGuide/llvm-cov.html | `llvm-cov export -format=lcov -instr-profile=default.profdata ./binary > lcov.info` · `-format=text` → JSON | lcov · JSON (`text` = JSON) | Pair with Clang `-fprofile-instr-generate -fcoverage-mapping` + `llvm-profdata merge`. |
| coverage | `gcovr` — https://gcovr.com/ · https://github.com/gcovr/gcovr | `gcovr --xml-pretty -o coverage.xml` · `gcovr --json -o coverage.json` · `gcovr --cobertura -o cobertura.xml` · `gcovr --fail-under-line N` | Cobertura XML (`--xml`/`--xml-pretty` aliases `--cobertura`/`--cobertura-pretty`) · JSON · HTML · … | `--fail-under-line MIN` exits status **2** if line coverage < MIN. Also `--fail-under-branch` (4), `--fail-under-decision` (8), `--fail-under-function` (16); statuses OR together. |
| cyclomatic complexity | `lizard` — https://github.com/terryyin/lizard | `lizard -C N --xml` · `lizard --CCN N --csv` · `lizard -Tcyclomatic_complexity=N` | XML (cppncss style) · CSV · HTML · Checkstyle · default table | Default CCN warning threshold **15**. Non-zero exit when warnings exceed `-i/--ignore_warnings`. Languages include `cpp`, `c`, etc. |
| cyclomatic complexity | `pmccabe` — https://manpages.ubuntu.com/manpages/focal/man1/pmccabe.1.html · https://people.debian.org/~bame/pmccabe/overview.html | `pmccabe -v file.c…` | columnar text (Modified McCabe + Traditional McCabe columns) | No first-class JSON/XML. No native max-N fail flag — pipe/awk and exit in CI. Ignores cpp directives by design. |
| cyclomatic complexity | `cppcheck` metrics — https://github.com/danmar/cppcheck · `cli/cmdlineparser.cpp` help text | `cppcheck --enable=metrics --xml-version=3 …` | XML v3 `<metric id="cyclomaticComplexity" …/>` (also HIS* metrics via addons) | Help string: *"metrics — Calculate metrics. Metrics are only reported in xmlv3 output."* Confirmed metric id `cyclomaticComplexity` in `test/cli/metrics_test.py`. Not a dedicated complexity CLI; lizard/pmccabe are clearer gates. |
| cognitive complexity | `clang-tidy` `readability-function-cognitive-complexity` — https://clang.llvm.org/extra/clang-tidy/checks/readability/function-cognitive-complexity.html | `clang-tidy -checks='-*,readability-function-cognitive-complexity' -config='{CheckOptions: [{key: readability-function-cognitive-complexity.Threshold, value: N}]}' sources…` · export: `-export-fixes=fixes.yaml` or SARIF via clang-tidy/clangd pipelines | clang diagnostics · YAML fixes · SARIF (toolchain-dependent) | Default **Threshold = 25**. Options: `DescribeBasicIncrements`, `IgnoreMacros`. |

### Swift

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | XCTest (Xcode / SPM) · swift-testing — https://developer.apple.com/documentation/xctest · https://developer.apple.com/documentation/testing | SPM: `swift test` · Xcode: `xcodebuild test -scheme S …` | text · xcresult | swift-testing may coexist with XCTest in modern packages. |
| coverage (SPM) | `swift test --enable-code-coverage` + `llvm-cov` — SPM flag widely documented; llvm-cov https://llvm.org/docs/CommandGuide/llvm-cov.html | `swift test --enable-code-coverage` then `llvm-cov export -format=lcov -instr-profile=.build/*/codecov/*.profdata <test-binary> > lcov.info` | profdata + `llvm-cov` lcov/JSON | Exact profdata path varies by SPM/Swift version (often under `.build/debug/codecov/`). No native fail-under — gate via parsed lcov or external service. |
| coverage (Xcode) | `xcodebuild -enableCodeCoverage YES` + `xccov` — Apple `xccov` (Xcode CLI) | `xcodebuild test -scheme S -enableCodeCoverage YES -resultBundlePath TestResults.xcresult` · `xcrun xccov view --report --json TestResults.xcresult` · legacy: `xcrun xccov view --json path/to.xccovreport` | xcresult · xccovreport/xccovarchive · JSON | `--report --json` on `.xcresult` is the modern CI form; older demos use `--json` on `.xccovreport` directly. |
| cyclomatic complexity | SwiftLint `cyclomatic_complexity` — https://github.com/realm/SwiftLint | `swiftlint lint --reporter json` | JSON (also checkstyle, sarif, junit, …) | Rule id `cyclomatic_complexity`. Defaults in source: **warning 10**, **error 20**; `ignores_case_statements: false`. Config shape (`.swiftlint.yml`): `cyclomatic_complexity: { warning: 10, error: 20, ignores_case_statements: true }`. |

### C# / .NET

| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | xUnit / NUnit / MSTest via `dotnet test` — https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-test | `dotnet test --logger "trx;LogFileName=results.trx"` · `--logger junit` (with adapter) | TRX · JUnit (adapter) · console | Detect `*.csproj` test SDK + package refs. |
| coverage | Coverlet collector — https://github.com/coverlet-coverage/coverlet · MS Learn https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage | `dotnet test --collect:"XPlat Code Coverage"` · formats: `dotnet test --collect:"XPlat Code Coverage;Format=json,lcov,cobertura,opencover,teamcity"` | default **cobertura** XML under `TestResults/**/coverage.cobertura.xml` · also json, lcov, opencover, teamcity | Package: `coverlet.collector`. Requires VSTest mode (on .NET 10 MTP-default projects set `<TestingPlatformDotnetTestSupport>false</TestingPlatformDotnetTestSupport>` or use `coverlet.MTP`). |
| coverage (MSBuild driver + thresholds) | `coverlet.msbuild` — https://github.com/coverlet-coverage/coverlet/blob/master/Documentation/MSBuildIntegration.md | `dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura` · threshold: `/p:Threshold=N /p:ThresholdType=line /p:ThresholdStat=total` | json (default msbuild) · lcov · opencover · cobertura · teamcity | `ThresholdType`: `line`, `branch`, `method` (comma-separated). `ThresholdStat`: `Minimum` (default, per module), `Total`, `Average`. **Threshold gating is on the MSBuild driver**, not the collector string alone. |
| coverage reports | ReportGenerator — https://github.com/danielpalme/ReportGenerator · cited by MS Learn | `reportgenerator -reports:**/coverage.cobertura.xml -targetdir:coveragereport -reporttypes:Html;Cobertura` | HTML · many | Post-process Coverlet output for humans/CI badges. |
| cyclomatic complexity (analyzer) | Roslyn CA1502 `AvoidExcessiveComplexity` — https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca1502 | Enable: `.editorconfig` → `dotnet_diagnostic.CA1502.severity = warning` · build emits standard analyzer diagnostics (SARIF via `dotnet build -p:ErrorLog=...`) | compiler/analyzer diagnostics · SARIF | **Still ships.** Default threshold **25**. **Disabled by default in .NET 10.** Custom threshold via `CodeMetricsConfig.txt` content `CA1502: 10` marked as `<AdditionalFiles Include="CodeMetricsConfig.txt" />`. |
| cyclomatic complexity (metrics report CLI) | `Microsoft.CodeAnalysis.Metrics` NuGet / `Metrics.exe` — https://learn.microsoft.com/en-us/visualstudio/code-quality/how-to-generate-code-metrics-data | After package install: `msbuild /t:Metrics` · override out: `msbuild /t:Metrics /p:MetricsOutputFile=metrics.xml` · raw: `Metrics.exe /project:App.csproj /out:report.xml` | XML `CodeMetricsReport` with `<Metric Name="CyclomaticComplexity" Value="…" />` | This is the real CLI path for a metrics XML dump. **Not** `dotnet-counters` (runtime counters) and not a coverage tool. Does not by itself fail the build on high CC — pair with CA1502 or an XML gate. |

## Detection signals

| Ecosystem | Proves ecosystem | Proves coverage already configured | Proves complexity already configured |
| --- | --- | --- | --- |
| Go | `go.mod`, `*.go`, `*_test.go` | `go test` scripts with `-coverprofile` / `-cover` · CI uploading `cover.out`/`coverage.lcov` · `.testcoverage.yml` (`go-test-coverage`) · Makefile targets calling `gcov2lcov` / `gocover-cobertura` | `.golangci.yml` / `.golangci.yaml` with `gocyclo` / `gocognit` / `cyclop` under `linters.enable` or `linters.settings` · direct CI steps `gocyclo -over` / `gocognit -over` |
| Rust | `Cargo.toml`, `src/**/*.rs`, `tests/` | `Cargo.toml`/`Cargo.lock` deps or CI: `cargo-llvm-cov`, `cargo-tarpaulin` · `tarpaulin.toml` · codecov/lcov artifacts from `cargo llvm-cov` | `clippy.toml` / `.clippy.toml` key `cognitive-complexity-threshold` · CI `clippy::cognitive_complexity` · `rust-code-analysis-cli` in scripts |
| C/C++ | `CMakeLists.txt`, `meson.build`, `Makefile`, `*.c`/`*.cpp`/`*.h`/`*.hpp`, `compile_commands.json` | Compile flags `-fprofile-arcs -ftest-coverage` or Clang coverage flags · `lcov`/`gcovr`/`llvm-cov` in CI · `gcovr.cfg` / `gcovr.toml` `[UNVERIFIED` all gcovr config filenames`]` | `lizard` / `pmccabe` in CI · `.clang-tidy` check `readability-function-cognitive-complexity` · cppcheck `--enable=metrics` |
| Swift | `Package.swift`, `*.xcodeproj` / `*.xcworkspace`, `*.swift` | `swift test --enable-code-coverage` in CI · `xcodebuild … -enableCodeCoverage YES` · xccov/lcov artifacts | `.swiftlint.yml` rule `cyclomatic_complexity` · `SwiftLint` build phase |
| C#/.NET | `*.sln`, `*.csproj` (`Microsoft.NET.Sdk`), `global.json` | Package refs `coverlet.collector` / `coverlet.msbuild` / `coverlet.MTP` · `dotnet test --collect:"XPlat Code Coverage"` · `/p:CollectCoverage=true` · `CoverletOutputFormat` · runsettings `Format` | `.editorconfig` `dotnet_diagnostic.CA1502.severity` · `CodeMetricsConfig.txt` + `AdditionalFiles` · package `Microsoft.CodeAnalysis.Metrics` · `msbuild /t:Metrics` |

## Threshold-enforcement knobs

| Ecosystem | Native "fail under N%" coverage flag | Native complexity max flag |
| --- | --- | --- |
| Go | **None in `go test` / `go tool cover`.** Idiom: third-party `go-test-coverage` with `threshold.total: N` (or script: parse `go tool cover -func=cover.out` total line and `exit 1`). | `gocyclo -over N` (exit 1) · `gocognit -over N` (exit 1) · golangci-lint: `linters.settings.gocyclo.min-complexity: N`, `gocognit.min-complexity: N`, `cyclop.max-complexity: N` (issues fail the run per golangci-lint exit rules) |
| Rust | `cargo llvm-cov --fail-under-lines N` (also `--fail-under-functions` / `--fail-under-regions` / `--fail-under-file-lines`) · `cargo tarpaulin --fail-under N` | `clippy.toml` → `cognitive-complexity-threshold = N` + deny/warn `clippy::cognitive_complexity` · no first-class rustc cyclomatic lint; use `rust-code-analysis-cli` JSON + CI gate |
| C/C++ | `gcovr --fail-under-line N` (exit 2); also `--fail-under-branch` / `--fail-under-decision` / `--fail-under-function` · lcov/llvm-cov: **no** built-in fail-under — script or gcovr | `lizard -C N` / `lizard --CCN N` (non-zero exit on warnings; tune with `-i COUNT`) · clang-tidy `readability-function-cognitive-complexity.Threshold` · pmccabe: no native max flag · cppcheck metrics: report-only unless wrapped |
| Swift | **No native fail-under** on `swift test` / `xccov` — parse JSON/lcov in CI or upload to a coverage gate | SwiftLint `cyclomatic_complexity` `error: N` (and/or `warning: N`); `swiftlint` exits non-zero on violations when configured as error / strict CI |
| C#/.NET | Coverlet MSBuild: `/p:Threshold=N` + `/p:ThresholdType=line\|branch\|method` + `/p:ThresholdStat=Minimum\|Total\|Average` · collector-only path has no identical `/p:Threshold` unless MSBuild package also present `[prefer msbuild driver for gates]` | CA1502 via severity + `CodeMetricsConfig.txt` threshold · Metrics XML is informational unless gated externally |

## Gaps

- **Go — no native coverage fail-under:** must document and implement a post-profile gate (`go-test-coverage` or script). Do not invent `go test --fail-under`.
- **Go — gocyclo has no JSON output:** machine-readable complexity is better via `gocognit -json` or `golangci-lint --output.json.path=stdout` (v2) / `--out-format=json` (v1).
- **Rust — cyclomatic complexity is second-class in Clippy:** only cognitive complexity lint ships, and it is in the **`restriction`** group (intentionally not on by default). For McCabe-style cyclomatic, use `rust-code-analysis-cli --metrics -O json` or multi-language `lizard`.
- **C/C++ — pmccabe lacks structured output and fail-under:** prefer `lizard` for CI gates; keep pmccabe as legacy detection signal only.
- **C/C++ — cppcheck is not a primary complexity tool:** it can emit `cyclomaticComplexity` under `--enable=metrics` + `--xml-version=3`, but lizard/clang-tidy are clearer intent signals.
- **Swift — no first-class coverage threshold CLI:** coverage is collect/export only (`llvm-cov` / `xccov`); threshold must be external. Cognitive complexity is not a separate SwiftLint rule from cyclomatic in the built-in set researched here — use `cyclomatic_complexity` (and optional custom rules) `[UNVERIFIED` whether a distinct cognitive rule exists in third-party SwiftLint plugins`]`.
- **C#/.NET — CA1502 disabled by default (.NET 10):** enabling severity is mandatory for enforcement. `Microsoft.CodeAnalysis.Metrics` produces XML but does not fail builds alone. `dotnet-counters` is unrelated (runtime metrics). Prefer Coverlet **MSBuild** driver when threshold exit codes are required; collector is ideal for Cobertura artifacts.
- **Cross-cutting fallback:** when an ecosystem lacks a native complexity CLI, multi-language **lizard** (`-C N --xml/--csv`) is the practical fallback for Go/Rust/C/C++/Swift/C# sources it supports.

## Source index (primary)

| Tool | Primary URL | Version/ref investigated |
| --- | --- | --- |
| Go cover flags | https://github.com/golang/go/blob/master/src/cmd/go/alldocs.go (`-covermode`, `-coverprofile`) | master tip at clone time |
| gocyclo | https://github.com/fzipp/gocyclo | HEAD |
| gocognit | https://github.com/uudashr/gocognit | HEAD |
| gcov2lcov | https://github.com/jandelgado/gcov2lcov | HEAD |
| gocover-cobertura | https://github.com/t-yuki/gocover-cobertura | HEAD |
| golangci-lint schema/settings | https://github.com/golangci/golangci-lint (`jsonschema/golangci.v2.11.jsonschema.json`, migration guide) | HEAD |
| go-test-coverage | https://github.com/vladopajic/go-test-coverage | HEAD |
| cargo-llvm-cov | https://github.com/taiki-e/cargo-llvm-cov/blob/main/README.md | HEAD |
| cargo-tarpaulin | https://github.com/xd009642/tarpaulin/blob/master/README.md | HEAD |
| clippy cognitive_complexity | https://github.com/rust-lang/rust-clippy (`clippy_lints/src/cognitive_complexity.rs`, lint_configuration.md) | HEAD — group **restriction**, default threshold 25 |
| rust-code-analysis-cli | https://github.com/mozilla/rust-code-analysis | HEAD |
| gcovr | https://github.com/gcovr/gcovr (`src/gcovr/configuration.py`) | HEAD |
| lizard | https://github.com/terryyin/lizard/blob/master/README.rst | HEAD |
| pmccabe | https://manpages.ubuntu.com/manpages/focal/man1/pmccabe.1.html | manpage |
| cppcheck metrics | https://github.com/danmar/cppcheck (`cli/cmdlineparser.cpp`, `test/cli/metrics_test.py`) | HEAD |
| clang-tidy cognitive | https://clang.llvm.org/extra/clang-tidy/checks/readability/function-cognitive-complexity.html | LLVM docs (Threshold default 25) |
| llvm-cov export | https://llvm.org/docs/CommandGuide/llvm-cov.html | `-format=lcov` / `text` (JSON) |
| SwiftLint cyclomatic_complexity | https://github.com/realm/SwiftLint (`CyclomaticComplexityConfiguration.swift`) | HEAD — warning 10 / error 20 / `ignores_case_statements` |
| Coverlet | https://github.com/coverlet-coverage/coverlet | HEAD |
| CA1502 | https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca1502 | default threshold 25; disabled by default in .NET 10 |
| Code metrics CLI | https://learn.microsoft.com/en-us/visualstudio/code-quality/how-to-generate-code-metrics-data | `Microsoft.CodeAnalysis.Metrics` / `Metrics.exe` |
| .NET coverage guide | https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage | Coverlet + ReportGenerator |
