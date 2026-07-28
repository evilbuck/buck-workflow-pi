---
status: active
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [guardrails, coverage, cyclomatic-complexity, tooling-matrix]
informs: [plan-b-init-guardrails.md]
---

# Coverage & Complexity Tooling — JVM, functional & the universal fallback

Primary sources verified 2026-07-26. Flags and config keys copied from official docs / repo READMEs / source. Anything not confirmed is tagged `[UNVERIFIED]`.

## Matrix

### Java
| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | JUnit 5 (Jupiter) — https://junit.org/junit5/ | Maven: `mvn test` (Surefire). Gradle: `./gradlew test` | Surefire/Gradle XML under `target/surefire-reports` or `build/test-results/test` | Standard JVM unit-test runner. Detect via `pom.xml` `junit-jupiter` / `build.gradle(.kts)` `useJUnitPlatform()`. |
| coverage | JaCoCo Maven plugin — https://www.eclemma.org/jacoco/trunk/doc/maven.html | Report: `mvn test jacoco:report` (goal `report`). Check: `mvn verify` / `mvn jacoco:check` | HTML + XML + CSV (default `formats=HTML,XML,CSV`). XML typically `target/site/jacoco/jacoco.xml` | Plugin: `org.jacoco:jacoco-maven-plugin`. Goals: `prepare-agent`, `report`, `check`. Docs: https://www.eclemma.org/jacoco/trunk/doc/report-mojo.html , https://www.eclemma.org/jacoco/trunk/doc/check-mojo.html |
| coverage | JaCoCo Gradle plugin — https://docs.gradle.org/current/userguide/jacoco_plugin.html | Report: `./gradlew jacocoTestReport`. Verify: `./gradlew jacocoTestCoverageVerification` | XML/CSV/HTML via `jacocoTestReport { xml.required = true; csv.required = true }` | Verification: `jacocoTestCoverageVerification { violationRules { rule { limit { minimum = 0.5 } } } }`. Not on `check` by default — wire `check.dependsOn jacocoTestCoverageVerification`. |
| cyclomatic complexity | PMD `CyclomaticComplexity` — https://docs.pmd-code.org/latest/pmd_rules_java_design.html#cyclomaticcomplexity | `pmd check -d src/main/java -R category/java/design.xml -f json` (also `-f xml`, `-f csv`, `-f sarif`) | json / xml / csv / sarif (CLI `-f` / `--format`) | Rule ref `category/java/design.xml/CyclomaticComplexity`. Properties: `classReportLevel` (default **80**), `methodReportLevel` (default **10**). Docs state methods with complexity ≥ 10 and classes whose methods' complexities sum to 80. PMD 7 also has `CognitiveComplexity` with property `reportLevel` (default 15 in docs examples). CLI formats: https://docs.pmd-code.org/latest/pmd_userdocs_report_formats.html |
| cyclomatic complexity | Checkstyle `CyclomaticComplexity` — https://checkstyle.sourceforge.io/checks/metrics/cyclomaticcomplexity.html | `java -jar checkstyle-*.jar -c config.xml -f xml -o checkstyle-result.xml src` | `-f xml` \| `sarif` \| `plain` (default plain) — https://checkstyle.org/cmdline.html | Module property `max` (default **10**). Optional `switchBlockAsSingleDecisionPoint`. Config: `<module name="CyclomaticComplexity"><property name="max" value="10"/></module>` under `TreeWalker`. |
| cognitive complexity (if distinct) | PMD `CognitiveComplexity` — https://docs.pmd-code.org/latest/pmd_rules_java_design.html#cognitivecomplexity | Same PMD CLI as above with rule enabled | Same PMD report formats | Property `reportLevel` (docs example value 15). Distinct from cyclomatic. |

### Kotlin
| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | JUnit 5 / Kotest — https://junit.org/junit5/ , https://kotest.io/ | `./gradlew test` | JUnit XML under `build/test-results` | Kotest often runs on JUnit platform. Detect `io.kotest` deps or `kotest` plugins. |
| coverage | JaCoCo (same as Java) — Gradle/Maven as above | `./gradlew jacocoTestReport` / `jacocoTestCoverageVerification` | XML/HTML/CSV | Works for Kotlin bytecode; still the default when Kover is absent. |
| coverage | Kover (`org.jetbrains.kotlinx.kover` / kotlinx-kover) — https://kotlin.github.io/kotlinx-kover/gradle-plugin/ , https://github.com/Kotlin/kotlinx-kover | Report: `./gradlew koverXmlReport` (JaCoCo-compatible XML). Verify: `./gradlew koverVerify` | XML via `koverXmlReport`; HTML via `koverHtmlReport` | DSL under `kover { reports { verify { rule { minBound(N) } } } }` or `bound { minValue = N }`. Source confirms `minBound(minValue: Int)` and `bound(config: Action<KoverVerifyBound>)` on `KoverVerifyRule`. Default coverage unit LINE / COVERED_PERCENTAGE. |
| cyclomatic complexity | detekt `CyclomaticComplexMethod` — https://detekt.dev/docs/rules/complexity/ , default config https://github.com/detekt/detekt/blob/main/detekt-core/src/main/resources/default-detekt-config.yml | `detekt --input src --report checkstyle:reports/detekt.xml` (also `html`, `md`, `sarif`) | Report IDs: `checkstyle`, `html`, `md`, `sarif` via `--report` / `-r` (`report-id:path`). CLI: https://detekt.dev/docs/gettingstarted/cli/ | **Config key is `allowedComplexity` (default 14), not `threshold`.** Rule class renamed from historical `ComplexMethod` → `CyclomaticComplexMethod` (source: `detekt-rules-complexity/.../CyclomaticComplexMethod.kt`). Active by default. |
| cognitive complexity (if distinct) | detekt `CognitiveComplexMethod` — same complexity ruleset | Same `detekt --report ...` | Same | Config key **`allowedComplexity` (default 15)**. **Inactive by default** in `default-detekt-config.yml`. Do not enable both cyclomatic + cognitive as the only gate without intent. |

### Scala
| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | ScalaTest / munit via sbt — https://www.scalatest.org/ , https://scalameta.org/munit/ | `sbt test` | sbt test reports (JUnit XML with plugins) | Detect `build.sbt`, `project/build.properties`, deps `scalatest` / `munit`. |
| coverage | sbt-scoverage — https://github.com/scoverage/sbt-scoverage | `sbt clean coverage test coverageReport` (aggregate: `coverageAggregate`) | HTML + XML under `target/scala-<ver>/scoverage-report/` | Plugin `org.scoverage` % `sbt-scoverage`. Minimums: `coverageMinimumStmtTotal`, `coverageMinimumBranchTotal`, `coverageMinimumStmtPerPackage`, `coverageMinimumBranchPerPackage`, `coverageMinimumStmtPerFile`, `coverageMinimumBranchPerFile`; fail with `coverageFailOnMinimum := true`. Enforced when reports are generated. Cobertura: scoverage reporter historically writes Cobertura XML (`CoberturaXmlWriter`) — treat as available alongside scoverage XML; path may vary by version `[UNVERIFIED exact default filename in latest sbt-scoverage]`. |
| cyclomatic complexity | Scalastyle `CyclomaticComplexityChecker` — http://www.scalastyle.org/ , checker source https://github.com/scalastyle/scalastyle/blob/master/src/main/scala/org/scalastyle/scalariform/CyclomaticComplexityChecker.scala | `sbt scalastyle` (or standalone scalastyle CLI with `scalastyle-config.xml`) | Scalastyle XML report (sbt plugin) `[UNVERIFIED exact CLI --format flag name for standalone]` | Checker id/errorKey `cyclomatic.complexity`. Params: `maximum` (default **10**), `countCases` (default true). **Maintenance: upstream `scalastyle/scalastyle` last push 2022-09-16 (not archived); fork `beautiful-scala/scalastyle` archived 2023-01-30.** Still the de-facto Scala style/complexity check, but stagnant — prefer `lizard` as CI safety net for Scala CCN. |
| cognitive complexity (if distinct) | — | — | — | No first-class Scala cognitive-complexity tool in common use. WartRemover is **not** a complexity metric tool. Fallback: lizard. |

### Elixir
| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | ExUnit via Mix — https://hexdocs.pm/ex_unit/ExUnit.html | `mix test` | ExUnit console; optional JUnit formatters via libs | Detect `mix.exs`, `test/test_helper.exs`. |
| coverage | Built-in `mix test --cover` — https://hexdocs.pm/mix/Mix.Tasks.Test.html | `mix test --cover` | OTP cover HTML under `cover/` by default; summary can fail build | `:test_coverage` in `mix.exs` accepts `summary: [threshold: N]` — “exit with status of 1 if the total coverage is below the threshold.” Also `--export-coverage` for `.coverdata`. |
| coverage | excoveralls — https://github.com/parroty/excoveralls | `MIX_ENV=test mix coveralls.json` / `mix coveralls.cobertura` / `mix coveralls.html` / `mix coveralls.xml` / `mix coveralls` | JSON → `cover/excoveralls.json`; Cobertura → `cover/cobertura.xml`; HTML | Set `test_coverage: [tool: ExCoveralls]` in `mix.exs`. **Fail under:** `"minimum_coverage": N` in project `coveralls.json` (0–100). Applies to `mix coveralls` and `mix coveralls.html` (exit 1 below threshold). |
| cyclomatic complexity | Credo `Credo.Check.Refactor.CyclomaticComplexity` — https://hexdocs.pm/credo/Credo.Check.Refactor.CyclomaticComplexity.html | `mix credo --format json` (also `sarif`, `flycheck`, `oneline`) | JSON / SARIF / flycheck / oneline | Param **`:max_complexity` default 9**. Enabled by default. Format switch is **`--format`** (not `--output-format`); values from Suggest help: `json,flycheck,sarif,oneline` (source: `SuggestOutput` + `Switch.string("format")`). |
| cognitive complexity (if distinct) | Credo `Credo.Check.Refactor.ABCSize` — https://hexdocs.pm/credo/Credo.Check.Refactor.ABCSize.html | Same `mix credo --format json` | Same | ABC (assignments/branches/conditions), not Sonar cognitive complexity. Param **`:max_size` default 30**. Disabled by default; tagged `:controversial`. |

### Shell / Bash
| Concern | Tool | Invocation (machine-readable output) | Output format | Notes |
| --- | --- | --- | --- | --- |
| test runner | bats-core — https://github.com/bats-core/bats-core | `bats --formatter tap test/` or `bats --formatter junit test/` | TAP / JUnit XML via formatters | Detect `*.bats`, `test/test_helper`, bats shebang. |
| coverage | kcov — https://github.com/SimonKagstrom/kcov | `kcov /path/to/outdir bats test/` or `kcov outdir ./script.sh` | **Cobertura XML** at `outdir/<exec-name>/cobertura.xml`; **generic `coverage.json`**; lcov-style HTML. Coveralls upload: `kcov --coveralls-id=$ID outdir cmd` | Confirmed: “write cobertura-compatible XML output and generic JSON coverage information”. Does **not** require special compile flags for bash. No native “fail under N%” flag in README — enforce by parsing cobertura/JSON in CI `[UNVERIFIED if a --threshold flag exists in latest kcov]`. |
| cyclomatic complexity | **shellcheck does NOT compute cyclomatic complexity** — https://github.com/koalaman/shellcheck | `shellcheck -f json script.sh` (lint only) | JSON/GCC/etc. for lint findings | shellcheck = static analysis/lint (bugs, style, POSIX). **Not a CCN tool.** |
| cyclomatic complexity | **lizard** (fallback) — https://github.com/terryyin/lizard | `lizard -C 15 -w path/to/scripts` | default table; `--csv`, `-X/--xml`, `-H/--html`, `--checkstyle` | **Lizard does not list Shell/Bash among supported languages** (verbatim list below). `lizard_languages/` has no `bash`/`shell` reader — only a generic `script_language.py` mixin used by Ruby/Python-like readers. For shell CCN, lizard is **best-effort / likely ineffective**; still the polyglot fallback the skill documents. Mark shell CCN as weak. |

---

## Detection signals

| Ecosystem | Proves ecosystem | Proves coverage already configured | Proves complexity already configured |
| --- | --- | --- | --- |
| Java (Maven) | `pom.xml` with `packaging`/`dependencies`; `src/main/java` | `pom.xml` plugin `jacoco-maven-plugin`; goals `prepare-agent`/`report`/`check`; `<rules>`/`<limit>`/`<minimum>` under jacoco `check` | `pmd-maven-plugin` or CLI ruleset ref `CyclomaticComplexity`; Checkstyle config module `CyclomaticComplexity`; `checkstyle.xml` / `pmd.xml` |
| Java (Gradle) | `build.gradle` / `build.gradle.kts`, `settings.gradle*` | plugin `jacoco`; task `jacocoTestCoverageVerification` / `jacocoTestReport`; `violationRules` | PMD/Checkstyle Gradle plugins; `config/checkstyle/checkstyle.xml`; detekt not typical for pure Java |
| Kotlin | `*.kt`, `build.gradle.kts` + Kotlin plugin, or `pom.xml` kotlin-maven-plugin | plugin `org.jetbrains.kotlinx.kover` / `kotlinx-kover`; or JaCoCo as above; `kover { reports { verify { ... } } }` | `detekt` plugin / `detekt.yml` with `CyclomaticComplexMethod` / `CognitiveComplexMethod`; `allowedComplexity` keys |
| Scala | `build.sbt`, `project/build.properties`, `*.scala` | `project/plugins.sbt` `sbt-scoverage`; `coverageEnabled` / `coverageMinimumStmtTotal` / `coverageFailOnMinimum` in `build.sbt` | `scalastyle-config.xml` with `CyclomaticComplexityChecker` / `cyclomatic.complexity`; sbt-scalastyle plugin |
| Elixir | `mix.exs`, `lib/**/*.ex`, `mix.lock` | `mix.exs` `test_coverage: [tool: ExCoveralls]` and/or dep `:excoveralls`; `coveralls.json` with `minimum_coverage`; or `:test_coverage` `summary: [threshold: N]` for built-in cover | dep `:credo`; `.credo.exs` checks `Credo.Check.Refactor.CyclomaticComplexity` / `ABCSize` with `max_complexity` / `max_size` |
| Shell/Bash | `*.sh`, `*.bash`, `*.bats`, shebang `#!/usr/bin/env bash` | kcov in CI scripts; `cobertura.xml` artifacts from kcov | shellcheck config (`.shellcheckrc`) = lint only; lizard in CI for CCN fallback |

---

## Threshold-enforcement knobs

| Ecosystem | Native "fail under N%" coverage flag | Native complexity max flag |
| --- | --- | --- |
| Java / Maven JaCoCo | `jacoco:check` XML: `<rules><rule><limits><limit><counter>LINE</counter><value>COVEREDRATIO</value><minimum>0.80</minimum></limit></limits></rule></rules>`; `jacoco.haltOnFailure` (default true) | PMD: ruleset props `methodReportLevel` / `classReportLevel` on `CyclomaticComplexity`; Checkstyle: `<property name="max" value="N"/>` on `CyclomaticComplexity` |
| Java / Gradle JaCoCo | `jacocoTestCoverageVerification { violationRules { rule { limit { minimum = 0.8 } } } }` | Same PMD/Checkstyle as Maven |
| Kotlin / Kover | `kover { reports { verify { rule { minBound(N) } } } }` then `./gradlew koverVerify` | detekt YAML: `complexity: CyclomaticComplexMethod: allowedComplexity: N` and/or `CognitiveComplexMethod: allowedComplexity: N` |
| Scala / sbt-scoverage | `coverageFailOnMinimum := true` + `coverageMinimumStmtTotal := N` (and branch/package/file variants) | Scalastyle `maximum` param on `CyclomaticComplexityChecker` (default 10) |
| Elixir / built-in cover | `mix test --cover` with `test_coverage: [summary: [threshold: N]]` in `mix.exs` | — |
| Elixir / excoveralls | `coveralls.json` → `"minimum_coverage": N` (0–100) | Credo: `max_complexity: N` on `Refactor.CyclomaticComplexity`; `max_size: N` on `Refactor.ABCSize` |
| Shell / kcov | No first-class fail-under in README — parse cobertura/JSON `[UNVERIFIED CLI threshold]` | shellcheck: **none** (not CCN). lizard: `-C N` / `--CCN N` (default 15) |
| Universal fallback lizard | N/A (not a coverage tool) | `-C N` / `--CCN N`; also `-L`/`--length`, `-a`/`--arguments`; `-T cyclomatic_complexity=N`; exit **1** when warning count exceeds `-i`/`--ignore_warnings` allowance (default effectively fail on any warning: `if 0 <= options.number < warning_count: return 1`) |

---

## Gaps

- **Scala complexity tooling is stagnant**: Scalastyle still ships `CyclomaticComplexityChecker`, but upstream is effectively unmaintained (last push 2022). **Fallback: `lizard`** (Scala is in lizard’s supported list).
- **Shell/Bash has no good native CCN tool**: shellcheck ≠ complexity. **lizard does not officially support Shell/Bash** (no reader in `lizard_languages/`). Fallback remains lizard for polyglot consistency, but expect weak/empty shell function metrics; consider documenting CCN as unsupported for pure-shell repos.
- **Elixir cognitive complexity**: Credo ABCSize ≠ Sonar cognitive complexity; no separate cognitive tool. Use ABCSize optionally; CCN via Credo CyclomaticComplexity.
- **Kotlin historical rename**: older blogs say detekt `ComplexMethod` + `threshold`; current source/default config use **`CyclomaticComplexMethod` + `allowedComplexity`**. Skill must write the new keys.
- **JaCoCo Gradle verification** is opt-in (not part of `check` unless wired).
- **scc is not a substitute for per-function CCN** (see fallback section) — keyword-count approximation at file level only.

---

## Universal fallback (polyglot safety net)

### lizard — https://github.com/terryyin/lizard

Extensible **true-ish cyclomatic complexity** analyzer (token/partial-parse based CCN per function; does not need full includes). Also optional copy-paste detection.

#### Supported languages (verbatim from README.rst “A list of supported languages”)

- C# (C Sharp)
- C/C++ (works with C++14)
- Erlang
- Fortran
- GDScript
- Golang
- Java
- JavaScript (With ES6 and JSX)
- Kotlin
- Lua
- Objective-C
- Perl
- PHP
- PL/SQL
- Python
- R
- Ruby
- Rust
- Scala
- Solidity
- Structured Text (St)
- Swift
- TTCN-3
- TypeScript (With TSX)
- VueJS
- Zig

**Not listed:** Shell/Bash, Elixir, Haskell, etc. (Elixir/Erlang: Erlang is listed; Elixir is not.)

#### Exact flags (from README + `lizard.py` argparse)

| Flag | Meaning |
| --- | --- |
| `-C N`, `--CCN N` | CCN warning threshold (default **15**). Functions with CCN **bigger than** N warn. |
| `-L N`, `--length N` | Max function length warning (default 1000). |
| `-a N`, `--arguments N` | Max parameter count. |
| `-w`, `--warnings_only` | Warnings only, clang/gcc warning format. |
| `-X`, `--xml` | XML in cppncss style (Jenkins-friendly). |
| `--csv` | CSV transform of default output. |
| `-H`, `--html` | Interactive HTML DataTables report. |
| `--checkstyle` | Checkstyle XML. |
| `-m`, `--modified` | **Exists.** Modified cyclomatic complexity: count a switch/case with multiple cases as one CCN. |
| `-E EXTENSION`, `--extension` | e.g. `-Eduplicate` for clone detection; `-Ecpre`, `-Ewordcount`, `-Eoutside`, `-EIgnoreAssert`, `-ENS`. |
| `-l LANG`, `--languages` | Restrict languages. |
| `-i N`, `--ignore_warnings N` | Exit 0 if warnings ≤ N; negative → always 0. |
| `-T field=N`, `--Threshold` | Generic threshold (`-T nloc=25`, etc.). |
| `-o FILE`, `--output_file` | Output path; format inferred from extension unless overridden. |

#### Exit-code behavior

README: “The exit code of lizard will be none-Zero if there are warnings.”  
Implementation (`lizard.py` `main`): returns **1** when `warning_count` is greater than `options.number` (`-i` / `--ignore_warnings`, default 0) and `options.number >= 0`; otherwise **0**. So by default **any** threshold warning → exit 1.

#### Example enforcement command

```bash
lizard -C 15 -w -X -o lizard-report.xml .
# or warnings-only for CI annotations:
lizard -C 15 -w .
```

Duplicate detection:

```bash
lizard -Eduplicate .
```

---

### scc — https://github.com/boyter/scc

Fast SLOC/cloc-style counter **with a COMPLEXITY column**.

#### Is COMPLEXITY true McCabe cyclomatic?

**No. It is a keyword-count / branch-token approximation, not true per-function McCabe CCN.**

Verbatim from README “Complexity Estimates”:

> It's my own definition, but tries to be an approximation of cyclomatic complexity … although done only on a file level.
>
> The reason it's an approximation is that it's calculated almost for free from a CPU point of view (since its a cheap lookup when counting), whereas a real cyclomatic complexity count would need to parse the code. It gives a reasonable guess in practice though even if it fails to identify recursive methods. The goal was never for it to be exact.
>
> In short when scc is looking through what it has identified as code if it notices what are usually branch conditions it will increment a counter.

Also: “estimate code complexity similar to cyclomatic complexity calculators” in the project blurb — “similar to”, not “is”.

**Skill rule:** use scc for quick file-level heatmaps / language inventory; **never** as the authoritative per-function CCN gate.

#### Flags (from `scc -h` / README)

| Flag | Meaning |
| --- | --- |
| `-f`, `--format` | `tabular, wide, json, json2, csv, csv-stream, cloc-yaml, html, html-table, sql, sql-insert, openmetrics` |
| `--by-file` | Per-file breakdown |
| `-s`, `--sort` | Sort column: `files, name, lines, blanks, code, comments, complexity` |
| `-c`, `--no-complexity` | Skip complexity calculation |
| `--cognitive` | Cognitive (nesting-weighted) complexity — still an scc estimate, not Sonar cognitive |
| `-o`, `--output` | Output filename |

Examples:

```bash
scc --format json --by-file -s complexity .
scc -f json --by-file .
```

#### Language coverage

`languages.json` in boyter/scc currently defines **364** language entries (counted from upstream `languages.json` on 2026-07-26). Far broader inventory than lizard; still not per-function CCN.

---

### Other polyglot tools (named for completeness)

| Tool | URL | Complexity? | Notes |
| --- | --- | --- | --- |
| tokei | https://github.com/XAMPPRocky/tokei | **No** | Fast SLOC only. README has no complexity metric. Do not use for CCN. |
| scc | https://github.com/boyter/scc | Approximate file-level only | See above. |
| lizard | https://github.com/terryyin/lizard | **Yes — per-function CCN** | Preferred universal CCN fallback. |
| sonar-scanner CLI | https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/ | Yes (server-side, many languages) | Heavyweight: needs SonarQube/SonarCloud backend, project token, network. Valid polyglot option when org already runs Sonar; **not** the default offline skill fallback. |
| PMD CPD / etc. | https://docs.pmd-code.org/ | Java-centric rules; multi-language CPD | Not a universal CCN CLI for arbitrary languages. |

---

## Fallback decision rule

Given an **arbitrary unknown-language repo**, to obtain **per-function cyclomatic complexity** suitable for a quality gate:

1. **Prefer ecosystem-native CCN** when detection signals match (table above): PMD/Checkstyle (Java), detekt (Kotlin), Scalastyle or lizard (Scala), Credo (Elixir). Shell: no native CCN.
2. **If native is missing, unknown, or unmaintained → run lizard** over the tree (skip `node_modules`, `vendor`, build dirs via `-x` as needed).
3. **Do not treat scc’s COMPLEXITY column as the gate** — optional inventory only.
4. **Do not use tokei for complexity.**
5. **sonar-scanner** only when Sonar is already an org standard.

### Literal command (skill default)

```bash
lizard -C 15 -w --csv .
```

CI variant with non-zero exit on any over-threshold function and XML artifact:

```bash
lizard -C 15 -w -X -o lizard-ccn.xml .
```

Modified CCN (switch/case collapsed) when matching team convention:

```bash
lizard -C 15 -m -w .
```

Quick polyglot inventory (not a CCN gate):

```bash
scc --by-file --format json -s complexity .
```

