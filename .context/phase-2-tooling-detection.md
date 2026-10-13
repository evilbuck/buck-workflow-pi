---
status: completed
phase: 2
order: 2
plan: plan-b-init-guardrails.md
phases_overview: plan-b-init-guardrails-phases.md
difficulty: medium
model_hint: capable general model preferred — first real code, needs testing
buck_hint: /b-build
goal: Build the tooling-matrix reference doc and the deterministic detect-stack.ts script.
files:
  - skills/b-init-guardrails/docs/tooling-matrix.md
  - skills/b-init-guardrails/scripts/detect-stack.ts
from_plan_steps: [1, 4]
depends_on: [1]
dependency_type: SOFT
acceptance_criteria:
  - "[x] tooling-matrix.md consolidates all three research files with [UNVERIFIED] markers preserved"
  - "[x] scc-is-not-McCabe warning is verbatim in the matrix"
  - "[x] detect-stack.ts is pure: no network, no writes, JSON on stdout"
  - "[x] detect-stack.ts runs on this repo (TS + Python + shell) and identifies vitest without hallucinating absent tooling"
  - "[x] Lizard fallback is documented with its exact supported-language list; gaps (Shell, Elixir) are explicit"
completed_by: null
completed_at: 2026-07-26

# Phase 2: Tooling & Detection

## Context

Parent plan's user goal: a developer in any codebase runs one command and gets quality guardrails with a brownfield ratchet and non-blocking subagent checks.

This phase produces the two reference artifacts that make the init skill's detection phase deterministic: a consolidated tooling matrix (human-readable reference) and a detection script (machine-executable).

The detection script is pure and deterministic — manifest glob → ecosystem list → per-ecosystem tool presence → JSON on stdout. No model inference. This is what makes tool detection reliable across repos.

## Implementation Details

From the parent plan, steps 1 and 4:

### Step 1: Consolidate the tooling matrix

Read the three research files in the subject folder:
- `research-tooling-web-dynamic.md` (JS/TS, Python, Ruby, PHP, Dart)
- `research-tooling-compiled.md` (Go, Rust, C/C++, Swift, C#/.NET)
- `research-tooling-jvm-and-fallback.md` (Java, Kotlin, Scala, Elixir, Shell + lizard/scc)

Create `skills/b-init-guardrails/docs/tooling-matrix.md` with:

**Per ecosystem, the matrix must include:**
- Test runner (command to run tests)
- Coverage tool (command + machine-readable output flag, e.g. `--coverage-reporter=lcov`)
- Cyclomatic tool (native if available, otherwise `lizard` fallback)
- Detection signals (manifest files that indicate this ecosystem)
- `lizard` fallback: exact supported-language list, explicit gaps

**Must preserve verbatim:**
- All `[UNVERIFIED]` markers from the research files
- The scc-is-not-McCabe warning: "scc's COMPLEXITY column is a keyword-count approximation at file level, explicitly not McCabe"
- Shell/Elixir complexity gaps: Shell is complexity-unsupported; Elixir uses native `credo`

**Structure suggestion:**
```markdown
# Tooling Matrix

## JavaScript / TypeScript
- **Detection signals**: `package.json`, `tsconfig.json`
- **Test runner**: `npm test`, `bun test`, `deno test`
- **Coverage**: `vitest --coverage --coverage.reporter=lcov` (lcov output)
- **Cyclomatic**: `lizard -C 15 -w --csv .` (lizard supports JS/TS)
- **Notes**: ...

## Python
...

## [each ecosystem]
```

### Step 2: Write detect-stack.ts

Create `skills/b-init-guardrails/scripts/detect-stack.ts`.

**Contract:**
- Input: none (reads the filesystem)
- Output: JSON on stdout
- Side effects: none (no writes, no network)
- Runtime: `bun run skills/b-init-guardrails/scripts/detect-stack.ts`

**Algorithm:**
1. Glob for manifest files from the project root:
   - `package.json` → JS/TS ecosystem
   - `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile` → Python
   - `Gemfile` → Ruby
   - `composer.json` → PHP
   - `pubspec.yaml` → Dart
   - `go.mod` → Go
   - `Cargo.toml` → Rust
   - `CMakeLists.txt`, `Makefile`, `*.xcodeproj`, `*.sln` → C/C++/Swift/C#
   - `build.gradle`, `pom.xml`, `build.sbt` → JVM (Java/Kotlin/Scala)
   - `mix.exs` → Elixir
   - `*.sh`, `*.bash` → Shell (complexity-unsupported)

2. For each detected ecosystem, check which tools are installed:
   - `which vitest`, `which jest`, `which pytest`, etc.
   - `which diff-cover` (patch gate spine)
   - `which lizard` (complexity fallback)

3. Emit JSON matching the `ecosystems[]` shape from Phase 1's schema:
   ```json
   {
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
     "tools_installed": {
       "vitest": true,
       "diff-cover": false,
       "lizard": true
     }
   }
   ```

**Implementation notes:**
- Use `Bun.glob` or `fs.readdir` for manifest detection (this repo uses Bun)
- Use `Bun.which` or `spawnSync("which", [...])` for tool presence
- Keep it under 150 lines; this is a detection script, not a framework
- Handle missing manifests gracefully (no crash, just omit the ecosystem)

## Risks

- **False positives**: a `package.json` in a subdirectory doesn't mean the root is a Node project. Mitigation: glob from root only; document this limitation in the matrix.
- **Tool version drift**: `which vitest` passes but the version is incompatible. Out of scope for v1; the init skill will propose the tool, not guarantee compatibility.
- **Polyglot repos**: multiple ecosystems detected. The schema supports `ecosystems[]` as an array; the script must emit all detected ecosystems, not pick one.

## Verification

1. **Tooling matrix completeness:**
   - [ ] All ecosystems from the three research files are present
   - [ ] `[UNVERIFIED]` markers are preserved
   - [ ] scc-is-not-McCabe warning is verbatim
   - [ ] Shell/Elixir gaps are explicit

2. **Detection smoke test — polyglot:**
   ```bash
   bun run skills/b-init-guardrails/scripts/detect-stack.ts
   ```
   - [ ] Runs on this repo (TS + Python + shell)
   - [ ] Identifies vitest (TS ecosystem)
   - [ ] Does not hallucinate tooling that is absent (e.g. does not claim `pytest` is installed if it isn't)
   - [ ] Output is valid JSON (pipe to `jq .`)

3. **Negative test — empty directory:**
   ```bash
   mkdir -p /tmp/empty-repo && cd /tmp/empty-repo
   bun run /path/to/detect-stack.ts
   ```
   - [ ] Outputs `{"ecosystems": [], "tools_installed": {}}`
   - [ ] Exit code 0

4. **Determinism:**
   - [ ] Run twice on the same repo; output is identical (no timestamps, no randomness)
