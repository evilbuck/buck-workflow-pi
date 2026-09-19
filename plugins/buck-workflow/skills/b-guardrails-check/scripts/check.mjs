#!/usr/bin/env node

/**
 * check.mjs — deterministic guardrails verdict engine.
 *
 * The single computation source for the six guardrail verdict gates. Both
 * `b-guardrails-check` (agent-invoked) and pull-request CI invoke this script;
 * neither re-implements gate logic.
 *
 * Contract:
 * - Reads `guardrails.json` from --cwd (default: process.cwd()).
 * - Runs the recorded commands directly (argv spawn, never a shell string).
 * - Emits the structured verdict JSON on stdout.
 * - Exits 1 only when a gate whose enforcement state is `required` fails.
 *   Advisory failures and skipped gates never fail the run.
 * - Exits 2 when guardrails.json is absent (contract resolution — the
 *   five-step chain in docs/contract-resolution.md — belongs to the skill).
 * - Exits 1 on a malformed guardrails.json with a clear error.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
export const CHECK_VERSION = "1.0.0";

export const GATE_NAMES = [
  "unit_test_gate",
  "functional_test_gate",
  "lint_gate",
  "patch_gate",
  "global_ratchet",
  "complexity_gate",
];

const ENFORCEMENT_STATES = ["required", "advisory", "disabled"];

/**
 * Defaults preserve documented v2 semantics for contracts that predate the
 * `enforcement` field: tests, ratchet, patch, and complexity block; lint is
 * advisory until a clean baseline exists.
 */
export const DEFAULT_ENFORCEMENT = {
  unit_test_gate: "required",
  functional_test_gate: "required",
  lint_gate: "advisory",
  patch_gate: "required",
  global_ratchet: "required",
  complexity_gate: "required",
};

export function resolveEnforcement(contract) {
  const declared = contract.enforcement || {};
  const resolved = { ...DEFAULT_ENFORCEMENT };
  for (const gate of GATE_NAMES) {
    if (declared[gate] !== undefined) {
      if (!ENFORCEMENT_STATES.includes(declared[gate])) {
        throw new Error(
          `malformed guardrails.json: enforcement.${gate} is "${declared[gate]}" — expected one of ${ENFORCEMENT_STATES.join(", ")}`,
        );
      }
      resolved[gate] = declared[gate];
    }
  }
  return resolved;
}

/**
 * Map a measurement to a gate value under an enforcement state.
 * Disabled gates are never run; this guards miswiring.
 */
export function applyEnforcement(measurement, state) {
  if (state === "disabled") return "skipped";
  if (measurement === "fail") return state === "advisory" ? "advisory" : "fail";
  return measurement; // pass | skipped
}

// ---------------------------------------------------------------------------
// Command execution — argv spawn only, no shell string is ever evaluated
// ---------------------------------------------------------------------------

/**
 * Quote-aware split of a recorded command string into argv. Double-quoted
 * segments become single argv entries; quotes are stripped. Recorded
 * commands come from the repo's own guardrails.json, so single quotes and
 * escapes are not needed beyond double quotes.
 */
export function parseArgv(cmd) {
  const argv = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch.charCodeAt(0) === 34) {
      inQuotes = !inQuotes;
    } else if (ch === " " && !inQuotes) {
      if (current.length > 0) {
        argv.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (inQuotes) throw new Error(`unbalanced quotes in command: ${cmd}`);
  if (current.length > 0) argv.push(current);
  return argv;
}

function runCommand(argv, cwd) {
  const env = {
    ...process.env,
    PATH: [join(cwd, "node_modules", ".bin"), process.env.PATH || ""]
      .filter(Boolean)
      .join(":"),
  };
  const proc = spawnSync(argv[0], argv.slice(1), {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  if (proc.error) {
    return { code: null, missing: true, output: "" };
  }
  const output = `${proc.stdout || ""}${proc.stderr || ""}`;
  return { code: proc.status, missing: false, output };
}

function tail(output, lines = 50) {
  const split = output.trimEnd().split("\n");
  return split.length <= lines ? output : split.slice(-lines).join("\n");
}

// ---------------------------------------------------------------------------
// Output parsers
// ---------------------------------------------------------------------------

function toCount(s) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Global line-coverage percentage from lcov text; null when unmeasurable. */
export function parseLcov(text) {
  let lf = 0;
  let lh = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("LF:")) lf += toCount(line.slice(3));
    else if (line.startsWith("LH:")) lh += toCount(line.slice(3));
  }
  if (lf === 0) return null;
  return Math.round((lh / lf) * 1000) / 10;
}
function splitCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch.charCodeAt(0) === 34) {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * lizard `--csv` rows: NLOC,CCN,Token,Param,Length,Location,File,Name,...
 * Non-data lines (headers, summaries) are skipped by shape, not by index.
 */
export function parseComplexityCsv(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const fields = splitCsvLine(line);
    if (fields.length < 8) continue;
    const complexity = Number(fields[1]);
    if (!Number.isFinite(complexity)) continue;
    const raw = fields[6];
    const file = raw.startsWith("./") ? raw.slice(2) : raw;
    const fn = fields[7];
    if (!file || !fn) continue;
    rows.push({ file, "function": fn, complexity });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Gate computations
// ---------------------------------------------------------------------------

function baselineKey(entry) {
  return `${entry.file}::${entry.function}`;
}

/**
 * Complexity burn-down semantics:
 * - new (non-baseline) functions above `max` fail;
 * - new or worsened functions above `hardCeiling` fail;
 * - unchanged or improved baseline hotspots pass, with shrink reporting.
 */
function classifyEntry(entry, recorded, max, hardCeiling) {
  const inBaseline = recorded !== undefined;
  const isNewOver = !inBaseline && entry.complexity > max;
  const worsened = inBaseline && entry.complexity > recorded;
  if (entry.complexity > hardCeiling && (!inBaseline || worsened)) {
    return { isNewOver, overCeiling: true, stillHotspot: inBaseline };
  }
  return { isNewOver, overCeiling: false, stillHotspot: inBaseline && entry.complexity > max };
}

export function evaluateComplexity(current, baseline, { max, hardCeiling }) {
  const baselineBy = new Map();
  for (const entry of baseline) baselineBy.set(baselineKey(entry), entry.complexity);

  const new_violations = [];
  const hard_ceiling_violations = [];
  let hotspots_remaining = 0;

  for (const entry of current) {
    const cls = classifyEntry(entry, baselineBy.get(baselineKey(entry)), max, hardCeiling);
    if (cls.isNewOver) new_violations.push(entry);
    if (cls.overCeiling) hard_ceiling_violations.push(entry);
    if (cls.stillHotspot) hotspots_remaining += 1;
  }

  const failed = new_violations.length > 0 || hard_ceiling_violations.length > 0;
  const shrunk = hotspots_remaining < baseline.length;

  return {
    measurement: failed ? "fail" : "pass",
    new_violations,
    hard_ceiling_violations,
    hotspots_remaining,
    baseline_size: baseline.length,
    baseline_shrunk: shrunk,
  };
}
function runGitCapturing(args, cwd) {
  const proc = runCommand(["git", ...args], cwd);
  if (proc.missing || proc.code !== 0) return null;
  return proc.output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function changedFiles(cwd, compareBranch, diagnostics) {
  const merged = new Set();
  for (const args of [
    ["diff", "--name-only", "--diff-filter=ACMR", `${compareBranch}...HEAD`],
    ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    const files = runGitCapturing(args, cwd);
    if (files === null) {
      diagnostics.push(`git ${args.join(" ")} failed — changed-file set incomplete`);
      continue;
    }
    for (const f of files) merged.add(f);
  }
  return [...merged].sort();
}

function extensionsFor(ecosystem) {
  const exts = [];
  for (const signal of ecosystem.detection_signals || []) {
    if (isExtensionSignal(signal)) exts.push(signal.slice(1));
  }
  return exts;
}

/** A `*.ts`-style signal denotes a lintable extension; directory globs do not. */
function isExtensionSignal(signal) {
  return signal.startsWith("*.") && signal.indexOf("/", 2) === -1;
}

// ---------------------------------------------------------------------------
// runCheck — the durable-contract path
// ---------------------------------------------------------------------------

function loadContract(cwd) {
  const path = join(cwd, "guardrails.json");
  if (!existsSync(path)) {
    const err = new Error(
      `no guardrails.json at ${path} — contract resolution (the five-step chain) belongs to the b-guardrails-check skill`,
    );
    err.code = "NO_CONTRACT";
    throw err;
  }
  let contract;
  try {
    contract = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new Error(`malformed guardrails.json at ${path}: ${cause.message}`);
  }
  if (contract.version === undefined || !Array.isArray(contract.ecosystems)) {
    throw new Error(
      `malformed guardrails.json at ${path}: missing "version" or "ecosystems[]"`,
    );
  }
  return contract;
}

function nz(value) {
  return value === undefined ? null : value;
}

function initialVerdict(contract, enforcement, diagnostics) {
  const ratchet = contract.ratchet || {};
  const targets = contract.targets || {};
  const inventory = Array.isArray(ratchet.baseline_complexity_inventory)
    ? ratchet.baseline_complexity_inventory
    : [];
  return {
    status: "pass",
    contract: "durable",
    contract_version: contract.version,
    runner_version: CHECK_VERSION,
    enforcement,
    diagnostics,
    tests: { unit_gate: "skipped", unit_exit_code: null, functional_gate: "skipped", functional_exit_code: null },
    lint: { lint_gate: "skipped", mode: "skipped", files_linted: 0, exit_code: null },
    coverage: {
      current: null,
      baseline: nz(ratchet.baseline_coverage),
      target: nz(targets.coverage_target),
      patch: null,
      patch_threshold: nz(targets.patch_coverage_min),
      patch_gate: "skipped",
    },
    complexity: {
      hotspots_remaining: null,
      baseline_size: inventory.length,
      new_violations: [],
      hard_ceiling_violations: [],
      complexity_gate: "skipped",
    },
    gates: {},
    ratchet_update: {
      baseline_coverage_rewrites: false,
      new_baseline_coverage: nz(ratchet.baseline_coverage),
      complexity_inventory_rewrites: false,
      new_complexity_baseline_size: inventory.length,
      complexity_baseline_file: nz(ratchet.complexity_baseline_file),
    },
  };
}

const SUITES = [
  { key: "unit", env: "test_runner", gate: "unit_test_gate", slot: "unit_gate", exitSlot: "unit_exit_code" },
  { key: "functional", env: "functional_test_cmd", gate: "functional_test_gate", slot: "functional_gate", exitSlot: "functional_exit_code" },
];

function runTestSuites(ctx) {
  for (const suite of SUITES) {
    if (ctx.enforcement[suite.gate] === "disabled") continue;
    let measurement = "skipped";
    let exitCode = null;
    for (const eco of ctx.contract.ecosystems) {
      const cmd = eco[suite.env];
      if (!cmd) continue;
      const proc = ctx.run(parseArgv(cmd));
      if (proc.missing) {
        ctx.diagnostics.push(`${suite.key} gate: tool not found for "${cmd}" — skipped`);
        continue;
      }
      exitCode = proc.code;
      if (proc.code !== 0) {
        measurement = "fail";
        ctx.verdict.tests[`${suite.key}_output_tail`] = tail(proc.output);
        break;
      }
      if (measurement === "skipped") measurement = "pass";
    }
    ctx.verdict.tests[suite.exitSlot] = exitCode;
    ctx.verdict.tests[suite.slot] = applyEnforcement(measurement, ctx.enforcement[suite.gate]);
  }
}

function lintDiffScoped(ctx, eco) {
  const exts = extensionsFor(eco);
  const files = changedFiles(ctx.dir, ctx.contract.git_compare_branch, ctx.diagnostics).filter(
    (f) => exts.length === 0 || exts.some((ext) => f.endsWith(ext)),
  );
  if (files.length === 0) return { mode: "diff-scoped", files: 0, proc: null };
  const proc = ctx.run([...parseArgv(eco.lint_cmd), ...files]);
  return { mode: "diff-scoped", files: files.length, proc };
}

function lintWholeRepo(ctx, eco) {
  const proc = ctx.run(parseArgv(eco.lint_cmd));
  const enforced = ctx.contract.ratchet?.baseline_lint_clean === true;
  const mode = enforced ? "whole-repo-enforced" : "whole-repo-advisory";
  const measurement = proc.code === 0 ? "pass" : enforced ? "fail" : "advisory";
  return { mode, files: 0, proc, measurement };
}

function lintOnce(ctx, eco) {
  if (eco.lint_accepts_paths && ctx.contract.git_compare_branch) {
    return lintDiffScoped(ctx, eco);
  }
  if (!eco.lint_accepts_paths) {
    return lintWholeRepo(ctx, eco);
  }
  // Path-accepting linter with no compare branch: nothing to scope to.
  return { mode: "skipped", files: 0, proc: null };
}

function lintOutcome(ctx, eco, result) {
  if (!result.proc) return { measurement: "skipped", exitCode: null, failed: false };
  if (result.proc.missing) {
    ctx.diagnostics.push(`lint gate: tool not found for "${eco.lint_cmd}" — skipped`);
    return { measurement: "skipped", exitCode: null, failed: false };
  }
  const failed = result.proc.code !== 0;
  if (failed) ctx.verdict.lint.output_tail = tail(result.proc.output);
  if (result.measurement === undefined) {
    return { measurement: failed ? "fail" : "pass", exitCode: result.proc.code, failed };
  }
  return { measurement: result.measurement, exitCode: result.proc.code, failed };
}

function runLintGate(ctx) {
  let measurement = "skipped";
  let mode = "skipped";
  let filesLinted = 0;
  let exitCode = null;
  for (const eco of ctx.contract.ecosystems) {
    if (!eco.lint_cmd) continue;
    const result = lintOnce(ctx, eco);
    mode = result.mode;
    filesLinted += result.files;
    const outcome = lintOutcome(ctx, eco, result);
    exitCode = outcome.exitCode;
    measurement = outcome.measurement;
    if (outcome.failed) break;
  }
  Object.assign(ctx.verdict.lint, {
    mode,
    files_linted: filesLinted,
    exit_code: exitCode,
    lint_gate: applyEnforcement(measurement, ctx.enforcement.lint_gate),
  });
}

function runCoverageTool(ctx) {
  for (const eco of ctx.contract.ecosystems) {
    if (!eco.coverage_tool) continue;
    if ((eco.coverage_format || "lcov") !== "lcov") {
      ctx.diagnostics.push(
        `coverage gate: format "${eco.coverage_format}" not parseable (lcov only) — skipped`,
      );
      continue;
    }
    const proc = ctx.run(parseArgv(eco.coverage_tool));
    if (proc.missing) {
      ctx.diagnostics.push(`coverage gate: tool not found for "${eco.coverage_tool}" — skipped`);
      continue;
    }
    if (proc.code !== 0) {
      ctx.diagnostics.push(`coverage command failed (exit ${proc.code})`);
      continue;
    }
    const candidate = join(ctx.dir, "coverage", "lcov.info");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
/** Parse diff-cover's "Total coverage: N%" line without a regex. */
function extractPatchPercent(output) {
  const idx = output.indexOf("Total coverage:");
  if (idx === -1) return null;
  const pct = Number.parseFloat(output.slice(idx + 15).trimStart());
  return Number.isFinite(pct) ? pct : null;
}

function runPatchGate(ctx, lcovPath) {
  if (!lcovPath) {
    ctx.diagnostics.push("patch gate: no coverage artifact — skipped");
    return;
  }
  if (!ctx.contract.git_compare_branch) {
    ctx.diagnostics.push("patch gate: git_compare_branch is null — skipped");
    return;
  }
  const proc = ctx.run([
    "diff-cover",
    lcovPath,
    `--compare-branch=${ctx.contract.git_compare_branch}`,
    `--fail-under=${ctx.contract.targets?.patch_coverage_min ?? 90}`,
  ]);
  if (proc.missing) {
    ctx.diagnostics.push("patch gate: diff-cover not found on PATH — skipped");
    return;
  }
  const pct = extractPatchPercent(proc.output);
  if (pct !== null) ctx.verdict.coverage.patch = pct;
  ctx.verdict.coverage.patch_gate = applyEnforcement(
    proc.code === 0 ? "pass" : "fail",
    ctx.enforcement.patch_gate,
  );
}

function runGlobalRatchet(ctx) {
  const current = ctx.verdict.coverage.current;
  const baseline = ctx.contract.ratchet?.baseline_coverage;
  if (current === null || current === undefined || baseline === null || baseline === undefined) {
    ctx.diagnostics.push("global ratchet: coverage or baseline unmeasurable — skipped");
    ctx.verdict.gates.global_ratchet = "skipped";
    return;
  }
  if (current < baseline) {
    ctx.verdict.gates.global_ratchet = applyEnforcement("fail", ctx.enforcement.global_ratchet);
    return;
  }
  if (current > baseline) {
    ctx.verdict.ratchet_update.baseline_coverage_rewrites = true;
    ctx.verdict.ratchet_update.new_baseline_coverage = current;
  }
  ctx.verdict.gates.global_ratchet = applyEnforcement("pass", ctx.enforcement.global_ratchet);
}

function loadComplexityBaseline(ctx) {
  const ratchet = ctx.contract.ratchet || {};
  if (!ratchet.complexity_baseline_file) return ratchet.baseline_complexity_inventory || [];
  const external = join(ctx.dir, ratchet.complexity_baseline_file);
  if (!existsSync(external)) {
    ctx.diagnostics.push(
      `complexity gate: baseline file ${ratchet.complexity_baseline_file} missing — using empty baseline`,
    );
    return [];
  }
  return JSON.parse(readFileSync(external, "utf8"));
}

function runComplexityCommand(ctx, eco, baseline, agg) {
  if (!eco.complexity_cmd) return;
  const proc = ctx.run(parseArgv(eco.complexity_cmd));
  if (proc.missing) {
    ctx.diagnostics.push(`complexity gate: tool not found for "${eco.complexity_cmd}" — skipped`);
    return;
  }
  if (proc.code !== 0) {
    ctx.diagnostics.push(`complexity command failed (exit ${proc.code})`);
    return;
  }
  const result = evaluateComplexity(parseComplexityCsv(proc.output), baseline, {
    max: ctx.max,
    hardCeiling: ctx.hardCeiling,
  });
  agg.new_violations.push(...result.new_violations);
  agg.hard_ceiling_violations.push(...result.hard_ceiling_violations);
  agg.hotspots += result.hotspots_remaining;
  agg.count += 1;
  if (result.baseline_shrunk) agg.shrunk = true;
}

function runComplexityGate(ctx) {
  const baseline = loadComplexityBaseline(ctx);
  const agg = { new_violations: [], hard_ceiling_violations: [], hotspots: 0, shrunk: false, count: 0 };
  for (const eco of ctx.contract.ecosystems) {
    runComplexityCommand(ctx, eco, baseline, agg);
  }
  if (agg.count === 0) return;
  const failed = agg.new_violations.length > 0 || agg.hard_ceiling_violations.length > 0;
  ctx.verdict.complexity.hotspots_remaining = agg.hotspots;
  ctx.verdict.complexity.new_violations = agg.new_violations;
  ctx.verdict.complexity.hard_ceiling_violations = agg.hard_ceiling_violations;
  if (agg.shrunk && !failed) {
    ctx.verdict.ratchet_update.complexity_inventory_rewrites = true;
    ctx.verdict.ratchet_update.new_complexity_baseline_size = agg.hotspots;
  }
  ctx.verdict.complexity.complexity_gate = applyEnforcement(
    failed ? "fail" : "pass",
    ctx.enforcement.complexity_gate,
  );
}

export async function runCheck({ cwd = process.cwd() } = {}) {
  const dir = resolve(cwd);
  const contract = loadContract(dir);
  const enforcement = resolveEnforcement(contract);
  const diagnostics = [];
  const verdict = initialVerdict(contract, enforcement, diagnostics);
  const ctx = {
    dir,
    contract,
    enforcement,
    diagnostics,
    verdict,
    targets: contract.targets || {},
    max: contract.targets?.cyclomatic_max ?? 10,
    hardCeiling: contract.targets?.cyclomatic_hard_ceiling ?? 15,
    run: (argv) => runCommand(argv, dir),
  };

  if (contract.version === 1) {
    diagnostics.push("guardrails.json is v1 — run /b-init-guardrails to add lint and test gates.");
  }

  runTestSuites(ctx);
  if (enforcement.lint_gate !== "disabled") runLintGate(ctx);

  const needsCoverage =
    enforcement.global_ratchet !== "disabled" || enforcement.patch_gate !== "disabled";
  const lcovPath = needsCoverage ? runCoverageTool(ctx) : null;
  if (lcovPath) verdict.coverage.current = parseLcov(readFileSync(lcovPath, "utf8"));
  if (enforcement.patch_gate !== "disabled") runPatchGate(ctx, lcovPath);
  if (enforcement.global_ratchet !== "disabled") runGlobalRatchet(ctx);
  if (enforcement.complexity_gate !== "disabled") runComplexityGate(ctx);

  verdict.gates.unit_test_gate = verdict.tests.unit_gate;
  verdict.gates.functional_test_gate = verdict.tests.functional_gate;
  verdict.gates.lint_gate = verdict.lint.lint_gate;
  verdict.gates.patch_gate = verdict.coverage.patch_gate;
  if (verdict.gates.global_ratchet === undefined) verdict.gates.global_ratchet = "skipped";
  verdict.gates.complexity_gate = verdict.complexity.complexity_gate;
  verdict.status = GATE_NAMES.some((g) => verdict.gates[g] === "fail") ? "fail" : "pass";
  return verdict;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  let cwd = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cwd") cwd = argv[++i];
    else if (argv[i] === "--version") {
      console.log(`guardrails-check ${CHECK_VERSION}`);
      process.exit(0);
    } else if (argv[i] === "--help") {
      console.log(
        "usage: node check.mjs [--cwd <repo>] — emit the guardrails verdict JSON; exit 1 iff a required gate fails",
      );
      process.exit(0);
    }
  }

  runCheck({ cwd })
    .then((verdict) => {
      for (const d of verdict.diagnostics) console.error(`[guardrails] ${d}`);
      console.log(JSON.stringify(verdict, null, 2));
      process.exit(verdict.status === "fail" ? 1 : 0);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(err.code === "NO_CONTRACT" ? 2 : 1);
    });
}

const invokedAsScript = process.argv[1]
  ? resolve(process.argv[1]) === resolve(__filename)
  : false;
if (invokedAsScript) main();
