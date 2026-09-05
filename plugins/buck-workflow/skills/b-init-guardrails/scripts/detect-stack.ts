#!/usr/bin/env bun
// skills/b-init-guardrails/scripts/detect-stack.ts
//
// Deterministic stack detection from repo files. Emits JSON on stdout.
// Pure: no network, no writes, no model inference. File signals → ecosystem
// list → per-ecosystem tool presence → JSON.
//
// Usage (run from the repo root):
//   bun skills/b-init-guardrails/scripts/detect-stack.ts
//
// Exit codes:
//   0 = success (even if no ecosystems detected)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

interface EcosystemDetection {
  name: string;
  detected: boolean;
  test_runner: string | null;
  coverage_tool: string | null;
  coverage_format: string | null;
  lint_cmd: string | null;
  lint_accepts_paths: boolean;
  functional_test_cmd: string | null;
  complexity_tool: string | null;
  complexity_cmd: string | null;
  detection_signals: string[];
  configured_not_installed: string[];
}

interface ToolPresence {
  [tool: string]: boolean;
}

interface DetectionResult {
  ecosystems: EcosystemDetection[];
  tools_installed: ToolPresence;
  git_compare_branch: string | null;
}

interface RepoSignals {
  root: string;
  files: string[];
  basenames: Set<string>;
  packageJson: PackageJson | null;
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  jest?: unknown;
  vitest?: unknown;
}

const IGNORED_DIRS = new Set([
  ".git",
  ".context",
  ".venv",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "vendor",
  "target",
  ".next",
  ".nuxt",
  ".turbo",
]);

const LIZARD_EXCLUDES = Array.from(IGNORED_DIRS).map((dir) => `-x "*/${dir}/*"`).join(" ");
const LIZARD_CMD = `lizard -C 10 -w --csv ${LIZARD_EXCLUDES} .`;
const MAX_WALK_FILES = 20_000;

function walkFiles(root: string): string[] {
  const files: string[] = [];

  function visit(dir: string): void {
    if (files.length >= MAX_WALK_FILES) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          files.push(relative(root, absolute));
          visit(absolute);
        }
        continue;
      }

      if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(relative(root, absolute));
        if (files.length >= MAX_WALK_FILES) return;
      }
    }
  }

  visit(root);
  return files.sort();
}

function readPackageJson(root: string): PackageJson | null {
  const path = join(root, "package.json");
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

function collectSignals(root: string): RepoSignals {
  const files = walkFiles(root);
  return {
    root,
    files,
    basenames: new Set(files.map((file) => file.split("/").at(-1) ?? file)),
    packageJson: readPackageJson(root),
  };
}

function hasFile(signals: RepoSignals, filename: string): boolean {
  return signals.files.includes(filename);
}

function hasBasename(signals: RepoSignals, filename: string): boolean {
  return signals.basenames.has(filename);
}

function hasExt(signals: RepoSignals, extensions: string[]): boolean {
  return signals.files.some((file) => extensions.some((ext) => file.endsWith(ext)));
}

function hasPackageDep(pkg: PackageJson | null, dep: string): boolean {
  if (!pkg) return false;
  return Boolean(pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep]);
}

function hasPackageScript(pkg: PackageJson | null, needle: string): boolean {
  if (!pkg?.scripts) return false;
  return Object.values(pkg.scripts).some((script) => script.includes(needle));
}

function commandToken(command: string): string {
  return command.split(/\s+/)[0] ?? command;
}

function isPathCommand(tool: string): boolean {
  return tool.startsWith("./") || tool.startsWith("../") || tool.startsWith("/");
}

function checkToolPresence(root: string, tool: string): boolean {
  if (!tool) return false;

  if (isPathCommand(tool)) {
    return existsSync(join(root, tool));
  }

  const localBin = join(root, "node_modules", ".bin", tool);
  if (existsSync(localBin)) return true;

  try {
    execFileSync("which", [tool], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function firstAvailable(root: string, commands: string[]): string | null {
  return commands.find((command) => checkToolPresence(root, commandToken(command))) ?? null;
}

function resolveLint(root: string, candidates: Array<[cmd: string, acceptsPaths: boolean]>): { lint_cmd: string | null; lint_accepts_paths: boolean } {
  for (const [cmd, acceptsPaths] of candidates) {
    if (checkToolPresence(root, commandToken(cmd))) return { lint_cmd: cmd, lint_accepts_paths: acceptsPaths };
  }
  return { lint_cmd: null, lint_accepts_paths: false };
}

function resolveFunctionalSignals(signals: RepoSignals, ecosystem: string): string | null {
  if (ecosystem === "typescript") {
    if (signals.files.some((file) => /^playwright\.config\.(js|ts|mjs|cjs)$/.test(file))) return "playwright test";
    if (signals.files.some((file) => /^cypress\.config\.(js|ts|mjs|cjs)$/.test(file))) return "cypress run";
    return null;
  }
  if (ecosystem === "python") {
    if (existsSync(join(signals.root, "tests/e2e"))) return "pytest tests/e2e";
    if (existsSync(join(signals.root, "tests/functional"))) return "pytest tests/functional";
    return null;
  }
  if (ecosystem === "go") {
    const integration = signals.files
      .filter((file) => file.endsWith("_test.go"))
      .slice(0, 50)
      .some((file) => {
        try {
          const content = readFileSync(join(signals.root, file), "utf8");
          const first5 = content.split("\n").slice(0, 5).join("\n");
          return first5.includes("//go:build integration");
        } catch {
          return false;
        }
      });
    return integration ? "go test -tags=integration ./..." : null;
  }
  if (ecosystem === "ruby") {
    if (existsSync(join(signals.root, "spec/system"))) return "rspec spec/system";
    if (existsSync(join(signals.root, "spec/features"))) return "rspec spec/features";
    return null;
  }
  if (ecosystem === "java" || ecosystem === "kotlin") {
    if (fileContains(signals.root, "pom.xml", "maven-failsafe-plugin")) return "mvn failsafe:integration-test";
    const gradleFile = signals.files.find((file) => /^build\.gradle/.test(file));
    if (gradleFile && fileContains(signals.root, gradleFile, "integrationTest")) return "./gradlew integrationTest";
    return null;
  }
  if (ecosystem === "rust") {
    return signals.files.some((file) => file.startsWith("tests/") && file.endsWith(".rs")) ? "cargo test --test '*'" : null;
  }
  return null;
}

function addTools(tools: Set<string>, commands: Array<string | null>): void {
  for (const command of commands) {
    if (command) tools.add(commandToken(command));
  }
}

function detectTypeScript(signals: RepoSignals, tools: Set<string>): EcosystemDetection | null {
  const pkg = signals.packageJson;
  const detected = hasFile(signals, "package.json") || hasFile(signals, "tsconfig.json") || hasFile(signals, "deno.json") || hasExt(signals, [".ts", ".tsx", ".js", ".jsx"]);
  if (!detected) return null;

  const detectionSignals = [
    hasFile(signals, "package.json") ? "package.json" : null,
    hasFile(signals, "tsconfig.json") ? "tsconfig.json" : null,
    hasFile(signals, "deno.json") ? "deno.json" : null,
    hasExt(signals, [".ts", ".tsx"]) ? "*.ts" : null,
  ].filter((signal): signal is string => Boolean(signal));

  const vitestConfigured = hasPackageDep(pkg, "vitest") || hasPackageScript(pkg, "vitest") || signals.files.some((file) => /^vitest\.config\./.test(file));
  const jestConfigured = hasPackageDep(pkg, "jest") || hasPackageScript(pkg, "jest") || Boolean(pkg?.jest) || signals.files.some((file) => /^jest\.config\./.test(file));
  const denoConfigured = hasFile(signals, "deno.json") || hasFile(signals, "deno.lock");
  const bunConfigured = hasFile(signals, "bun.lock") || hasFile(signals, "bun.lockb");

  const configuredCandidates = [
    vitestConfigured ? "vitest" : null,
    jestConfigured ? "jest" : null,
    bunConfigured ? "bun test" : null,
    denoConfigured ? "deno test" : null,
  ].filter((command): command is string => Boolean(command));

  const candidates = [...configuredCandidates, "node --test"];

  const testRunner = firstAvailable(signals.root, candidates);
  const coverageTool = testRunner?.startsWith("vitest")
    ? "vitest --coverage --coverage.reporter=lcov"
    : testRunner?.startsWith("jest")
      ? "jest --coverage --coverageReporters=lcov"
      : testRunner?.startsWith("bun")
        ? "bun test --coverage --coverage-reporter=lcov"
        : testRunner?.startsWith("deno")
          ? "deno test --coverage && deno coverage --lcov"
          : null;

  const configuredNotInstalled = configuredCandidates
    .map((command) => commandToken(command))
    .filter((tool) => !checkToolPresence(signals.root, tool));

  const lint = resolveLint(signals.root, [
    ["eslint --format stylish", true],
    ["oxlint", true],
  ]);
  const functionalTestCmd = resolveFunctionalSignals(signals, "typescript");

  addTools(tools, [...candidates, coverageTool, "diff-cover", "lizard", lint.lint_cmd, lint.lint_cmd ? commandToken(lint.lint_cmd) : null, "eslint", "oxlint", functionalTestCmd]);

  return {
    name: "typescript",
    detected: true,
    test_runner: testRunner,
    coverage_tool: coverageTool,
    coverage_format: coverageTool ? "lcov" : null,
    lint_cmd: lint.lint_cmd,
    lint_accepts_paths: lint.lint_accepts_paths,
    functional_test_cmd: functionalTestCmd,
    complexity_tool: "lizard",
    complexity_cmd: LIZARD_CMD,
    detection_signals: detectionSignals,
    configured_not_installed: configuredNotInstalled,
  };
}

function fileContains(root: string, filename: string, needle: string): boolean {
  const path = join(root, filename);
  if (!existsSync(path)) return false;
  try {
    return readFileSync(path, "utf8").includes(needle);
  } catch {
    return false;
  }
}

function detectPython(signals: RepoSignals, tools: Set<string>): EcosystemDetection | null {
  const detected = ["pyproject.toml", "setup.py", "requirements.txt", "Pipfile"].some((file) => hasBasename(signals, file)) || hasExt(signals, [".py"]);
  if (!detected) return null;

  const pytestConfigured =
    hasBasename(signals, "pytest.ini") ||
    hasBasename(signals, "conftest.py") ||
    fileContains(signals.root, "pyproject.toml", "pytest") ||
    fileContains(signals.root, "requirements.txt", "pytest") ||
    fileContains(signals.root, "requirements-dev.txt", "pytest") ||
    fileContains(signals.root, "Pipfile", "pytest");

  const testRunner = firstAvailable(signals.root, ["pytest", "python"]);
  const usesPytest = testRunner === "pytest";
  const coverageTool = usesPytest ? "pytest --cov --cov-report=xml" : firstAvailable(signals.root, ["coverage"])
    ? "coverage run -m unittest discover && coverage xml"
    : null;

  const lint = resolveLint(signals.root, [
    ["ruff check", true],
    ["flake8", true],
  ]);
  const functionalTestCmd = resolveFunctionalSignals(signals, "python");

  addTools(tools, ["pytest", "python", "coverage", coverageTool, "diff-cover", "lizard", "ruff", "flake8", lint.lint_cmd, functionalTestCmd]);

  const configuredNotInstalled = pytestConfigured && !usesPytest ? ["pytest"] : [];

  return {
    name: "python",
    detected: true,
    test_runner: usesPytest ? "pytest" : testRunner ? "python -m unittest discover" : null,
    coverage_tool: coverageTool,
    coverage_format: coverageTool ? "cobertura" : null,
    lint_cmd: lint.lint_cmd,
    lint_accepts_paths: lint.lint_accepts_paths,
    functional_test_cmd: functionalTestCmd,
    complexity_tool: "lizard",
    complexity_cmd: LIZARD_CMD,
    detection_signals: [
      hasBasename(signals, "pyproject.toml") ? "pyproject.toml" : null,
      hasBasename(signals, "requirements.txt") ? "requirements.txt" : null,
      hasExt(signals, [".py"]) ? "*.py" : null,
    ].filter((signal): signal is string => Boolean(signal)),
    configured_not_installed: configuredNotInstalled,
  };
}

function detectShell(signals: RepoSignals, tools: Set<string>): EcosystemDetection | null {
  const detected = hasExt(signals, [".sh", ".bash", ".bats"]);
  if (!detected) return null;

  const batsConfigured = hasExt(signals, [".bats"]);

  const testRunner = firstAvailable(signals.root, ["bats"]);
  const coverageTool = firstAvailable(signals.root, ["kcov"]);
  const lint = resolveLint(signals.root, [["shellcheck", true]]);

  addTools(tools, ["bats", "kcov", coverageTool, "diff-cover", "shellcheck", lint.lint_cmd]);

  const configuredNotInstalled = batsConfigured && !testRunner ? ["bats"] : [];

  return {
    name: "shell",
    detected: true,
    test_runner: testRunner ? "bats" : null,
    coverage_tool: coverageTool ? "kcov" : null,
    coverage_format: coverageTool ? "cobertura" : null,
    lint_cmd: lint.lint_cmd,
    lint_accepts_paths: lint.lint_accepts_paths,
    functional_test_cmd: null,
    complexity_tool: null,
    complexity_cmd: null,
    detection_signals: [hasExt(signals, [".sh"]) ? "*.sh" : null, hasExt(signals, [".bash"]) ? "*.bash" : null, hasExt(signals, [".bats"]) ? "*.bats" : null].filter((signal): signal is string => Boolean(signal)),
    configured_not_installed: configuredNotInstalled,
  };
}

function detectJvm(signals: RepoSignals, tools: Set<string>): EcosystemDetection[] {
  const ecosystems: EcosystemDetection[] = [];
  const hasMaven = hasBasename(signals, "pom.xml");
  const hasGradle = hasBasename(signals, "build.gradle") || hasBasename(signals, "build.gradle.kts") || hasFile(signals, "gradlew");
  const hasKotlin = hasExt(signals, [".kt", ".kts"]);
  const hasScala = hasBasename(signals, "build.sbt") || hasExt(signals, [".scala"]);

  if (hasMaven || hasGradle || hasExt(signals, [".java"])) {
    const gradle = hasGradle && !hasMaven;
    const gradlewPresent = existsSync(join(signals.root, "gradlew"));
    const testRunner = gradle ? (gradlewPresent ? "./gradlew test" : "gradle test") : "mvn test";
    const coverageTool = gradle ? (hasKotlin ? "./gradlew koverXmlReport" : "./gradlew jacocoTestReport") : "mvn test jacoco:report";
    const lint = gradle
      ? resolveLint(signals.root, [["./gradlew checkstyleMain", false]])
      : fileContains(signals.root, "pom.xml", "checkstyle")
        ? resolveLint(signals.root, [["mvn checkstyle:check", false]])
        : { lint_cmd: null, lint_accepts_paths: false };
    const functionalTestCmd = resolveFunctionalSignals(signals, hasKotlin ? "kotlin" : "java");
    addTools(tools, [testRunner, coverageTool, "diff-cover", "lizard", lint.lint_cmd, functionalTestCmd]);
    const configuredNotInstalled = gradle
      ? (gradlewPresent || checkToolPresence(signals.root, "gradle") ? [] : ["gradle"])
      : (checkToolPresence(signals.root, "mvn") ? [] : ["mvn"]);
    ecosystems.push({
      name: hasKotlin ? "kotlin" : "java",
      detected: true,
      test_runner: testRunner,
      coverage_tool: coverageTool,
      coverage_format: "xml",
      lint_cmd: lint.lint_cmd,
      lint_accepts_paths: lint.lint_accepts_paths,
      functional_test_cmd: functionalTestCmd,
      complexity_tool: hasKotlin ? "detekt" : "lizard",
      complexity_cmd: hasKotlin ? "detekt --input src --report checkstyle:reports/detekt.xml" : LIZARD_CMD,
      detection_signals: [hasMaven ? "pom.xml" : null, hasGradle ? "build.gradle*" : null, hasKotlin ? "*.kt" : null, hasExt(signals, [".java"]) ? "*.java" : null].filter((signal): signal is string => Boolean(signal)),
      configured_not_installed: configuredNotInstalled,
    });
  }

  if (hasScala) {
    const lint = resolveLint(signals.root, [["sbt scalastyle", false]]);
    addTools(tools, ["sbt", "diff-cover", "lizard", lint.lint_cmd]);
    ecosystems.push({
      name: "scala",
      detected: true,
      test_runner: "sbt test",
      coverage_tool: "sbt clean coverage test coverageReport",
      coverage_format: "xml",
      lint_cmd: lint.lint_cmd,
      lint_accepts_paths: lint.lint_accepts_paths,
      functional_test_cmd: null,
      complexity_tool: "lizard",
      complexity_cmd: LIZARD_CMD,
      detection_signals: [hasBasename(signals, "build.sbt") ? "build.sbt" : null, hasExt(signals, [".scala"]) ? "*.scala" : null].filter((signal): signal is string => Boolean(signal)),
      configured_not_installed: checkToolPresence(signals.root, "sbt") ? [] : ["sbt"],
    });
  }

  return ecosystems;
}

type SimpleEcosystemConfig = {
  name: string;
  detected: boolean;
  runner: string;
  coverage: string;
  format: string;
  complexityTool: string | null;
  complexityCmd: string | null;
  lint: Array<[cmd: string, acceptsPaths: boolean]>;
  functional: string | null;
  signals: string[];
};

function detectSimple(signals: RepoSignals, tools: Set<string>): EcosystemDetection[] {
  const configs: SimpleEcosystemConfig[] = [
    { name: "ruby", detected: hasBasename(signals, "Gemfile") || hasExt(signals, [".rb"]), runner: "rspec", coverage: "simplecov", format: "json", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["rubocop", true]], functional: "ruby", signals: ["Gemfile", "*.rb"] },
    { name: "php", detected: hasBasename(signals, "composer.json") || hasExt(signals, [".php"]), runner: "phpunit", coverage: "phpunit --coverage-cobertura", format: "cobertura", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["phpcs", true], ["phpstan analyse --no-progress", false]], functional: null, signals: ["composer.json", "*.php"] },
    { name: "dart", detected: hasBasename(signals, "pubspec.yaml") || hasExt(signals, [".dart"]), runner: "dart test", coverage: "flutter test --coverage", format: "lcov", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["dart analyze", true]], functional: null, signals: ["pubspec.yaml", "*.dart"] },
    { name: "go", detected: hasBasename(signals, "go.mod") || hasExt(signals, [".go"]), runner: "go test", coverage: "go test -coverprofile=cover.out", format: "coverprofile", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["golangci-lint run", false], ["go vet ./...", false]], functional: "go", signals: ["go.mod", "*.go"] },
    { name: "rust", detected: hasBasename(signals, "Cargo.toml") || hasExt(signals, [".rs"]), runner: "cargo test", coverage: "cargo llvm-cov", format: "lcov", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["cargo clippy --all-targets -- -D warnings", false]], functional: "rust", signals: ["Cargo.toml", "*.rs"] },
    { name: "cpp", detected: hasBasename(signals, "CMakeLists.txt") || hasExt(signals, [".c", ".cc", ".cpp", ".h", ".hpp"]), runner: "ctest", coverage: "gcovr", format: "cobertura", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["cppcheck --enable=warning,style --error-exitcode=1", true]], functional: null, signals: ["CMakeLists.txt", "Makefile", "*.c", "*.cpp"] },
    { name: "swift", detected: hasBasename(signals, "Package.swift") || hasExt(signals, [".swift"]) || signals.files.some((file) => file.endsWith(".xcodeproj") || file.endsWith(".xcworkspace")), runner: "swift test", coverage: "swift test --enable-code-coverage", format: "lcov", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["swiftlint lint --strict", true]], functional: null, signals: ["Package.swift", "*.xcodeproj", "*.xcworkspace", "*.swift"] },
    { name: "csharp", detected: signals.files.some((file) => file.endsWith(".sln") || file.endsWith(".csproj") || file.endsWith(".cs")), runner: "dotnet test", coverage: "dotnet test --collect:\"XPlat Code Coverage\"", format: "cobertura", complexityTool: "lizard", complexityCmd: LIZARD_CMD, lint: [["dotnet format --verify-no-changes", false]], functional: null, signals: ["*.sln", "*.csproj", "*.cs"] },
    { name: "elixir", detected: hasBasename(signals, "mix.exs") || hasExt(signals, [".ex", ".exs"]), runner: "mix test", coverage: "mix test --cover", format: "html", complexityTool: "credo", complexityCmd: "mix credo --format json", lint: [["mix credo --strict", false]], functional: null, signals: ["mix.exs", "*.ex", "*.exs"] },
  ];

  const detections: EcosystemDetection[] = [];
  for (const config of configs) {
    if (!config.detected) continue;
    const lintResolved = resolveLint(signals.root, config.lint);
    const functionalTestCmd = config.functional ? resolveFunctionalSignals(signals, config.functional) : null;
    addTools(tools, [config.runner, config.coverage, config.complexityCmd, "diff-cover", config.complexityTool, lintResolved.lint_cmd, functionalTestCmd]);
    const runnerInstalled = checkToolPresence(signals.root, commandToken(config.runner));
    detections.push({
      name: config.name,
      detected: true,
      test_runner: config.runner,
      coverage_tool: config.coverage,
      coverage_format: config.format,
      lint_cmd: lintResolved.lint_cmd,
      lint_accepts_paths: lintResolved.lint_accepts_paths,
      functional_test_cmd: functionalTestCmd,
      complexity_tool: config.complexityTool,
      complexity_cmd: config.complexityCmd,
      detection_signals: config.signals.filter((signal) => signal.includes("*") ? hasExt(signals, [signal.slice(1)]) : hasBasename(signals, signal)),
      configured_not_installed: runnerInstalled ? [] : [commandToken(config.runner)],
    });
  }
  return detections;
}

// Resolves the git ref diff-cover's patch gate should compare against.
// Pure and local-only: no network calls, only local git plumbing commands.
// Returns null when the repo isn't git-tracked or no comparable ref can be
// found (no remote HEAD and none of the common default-branch names exist).
function detectGitCompareBranch(root: string): string | null {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore" });
  } catch {
    return null; // not a git repo
  }
  try {
    const ref = execFileSync("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const m = ref.match(/^refs\/remotes\/(.+)$/);
    if (m) return m[1];
  } catch {
    // fall through to candidate probing
  }
  for (const candidate of ["origin/main", "origin/master", "origin/trunk"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", candidate], { cwd: root, stdio: "ignore" });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function detectStack(): DetectionResult {
  const signals = collectSignals(process.cwd());
  const toolsToCheck = new Set<string>();
  const ecosystems = [
    detectTypeScript(signals, toolsToCheck),
    detectPython(signals, toolsToCheck),
    ...detectJvm(signals, toolsToCheck),
    ...detectSimple(signals, toolsToCheck),
    detectShell(signals, toolsToCheck),
  ].filter((ecosystem): ecosystem is EcosystemDetection => Boolean(ecosystem));

  toolsToCheck.add("diff-cover");
  toolsToCheck.add("lizard");

  const tools_installed: ToolPresence = {};
  for (const tool of [...toolsToCheck].sort()) {
    tools_installed[tool] = checkToolPresence(signals.root, tool);
  }

  const git_compare_branch = detectGitCompareBranch(signals.root);

  return { ecosystems, tools_installed, git_compare_branch };
}

const result = detectStack();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
