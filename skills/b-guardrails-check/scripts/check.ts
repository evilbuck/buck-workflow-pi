#!/usr/bin/env bun

/**
 * check.ts — deterministic guardrails verdict engine.
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

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const CHECK_VERSION = "1.0.0";

export const GATE_NAMES = [
  "unit_test_gate",
  "functional_test_gate",
  "lint_gate",
  "patch_gate",
  "global_ratchet",
  "complexity_gate",
] as const;

export type GateName = (typeof GATE_NAMES)[number];
export type EnforcementState = "required" | "advisory" | "disabled";
export type GateValue = "pass" | "fail" | "skipped" | "advisory";

const ENFORCEMENT_STATES = ["required", "advisory", "disabled"] as const;

export interface ComplexityEntry {
  file: string;
  function: string;
  complexity: number;
}

export interface GuardrailsEcosystem {
  detection_signals?: string[];
  test_runner?: string | null;
  functional_test_cmd?: string | null;
  lint_cmd?: string | null;
  lint_accepts_paths?: boolean;
  coverage_tool?: string | null;
  coverage_format?: string | null;
  complexity_cmd?: string | null;
}

export interface GuardrailsContract {
  version: number;
  ecosystems: GuardrailsEcosystem[];
  enforcement?: Partial<Record<GateName, string>>;
  targets?: {
    coverage_target?: number | null;
    patch_coverage_min?: number | null;
    cyclomatic_max?: number | null;
    cyclomatic_hard_ceiling?: number | null;
  };
  git_compare_branch?: string | null;
  ratchet?: {
    baseline_coverage?: number | null;
    baseline_complexity_inventory?: ComplexityEntry[];
    complexity_baseline_file?: string | null;
    baseline_lint_clean?: boolean | null;
  };
}

interface TestVerdict {
  unit_gate: GateValue;
  unit_exit_code: number | null;
  functional_gate: GateValue;
  functional_exit_code: number | null;
  unit_output_tail?: string;
  functional_output_tail?: string;
}

interface LintVerdict {
  lint_gate: GateValue;
  mode: string;
  files_linted: number;
  exit_code: number | null;
  output_tail?: string;
}

interface CoverageVerdict {
  current: number | null;
  baseline: number | null;
  target: number | null;
  patch: number | null;
  patch_threshold: number | null;
  patch_gate: GateValue;
}

interface ComplexityVerdict {
  hotspots_remaining: number | null;
  baseline_size: number;
  new_violations: ComplexityEntry[];
  hard_ceiling_violations: ComplexityEntry[];
  complexity_gate: GateValue;
}

interface RatchetUpdate {
  baseline_coverage_rewrites: boolean;
  new_baseline_coverage: number | null;
  complexity_inventory_rewrites: boolean;
  new_complexity_baseline_size: number;
  complexity_baseline_file: string | null;
}

export interface GuardrailsVerdict {
  status: "pass" | "fail";
  contract: string;
  contract_version: number;
  runner_version: string;
  enforcement: Record<GateName, EnforcementState>;
  diagnostics: string[];
  tests: TestVerdict;
  lint: LintVerdict;
  coverage: CoverageVerdict;
  complexity: ComplexityVerdict;
  gates: Partial<Record<GateName, GateValue>>;
  ratchet_update: RatchetUpdate;
}

/**
 * Defaults preserve documented v2 semantics for contracts that predate the
 * `enforcement` field: tests, ratchet, patch, and complexity block; lint is
 * advisory until a clean baseline exists.
 */
export const DEFAULT_ENFORCEMENT: Record<GateName, EnforcementState> = {
  unit_test_gate: "required",
  functional_test_gate: "required",
  lint_gate: "advisory",
  patch_gate: "required",
  global_ratchet: "required",
  complexity_gate: "required",
};

function isEnforcementState(value: string): value is EnforcementState {
  return (ENFORCEMENT_STATES as readonly string[]).includes(value);
}

export function resolveEnforcement(contract: {
  enforcement?: Partial<Record<GateName, string>>;
}): Record<GateName, EnforcementState> {
  const declared = contract.enforcement || {};
  const resolved: Record<GateName, EnforcementState> = { ...DEFAULT_ENFORCEMENT };
  for (const gate of GATE_NAMES) {
    const state = declared[gate];
    if (state !== undefined) {
      if (!isEnforcementState(state)) {
        throw new Error(
          `malformed guardrails.json: enforcement.${gate} is "${state}" — expected one of ${ENFORCEMENT_STATES.join(", ")}`,
        );
      }
      resolved[gate] = state;
    }
  }
  return resolved;
}

/**
 * Map a measurement to a gate value under an enforcement state.
 * Disabled gates are never run; this guards miswiring.
 */
export function applyEnforcement(measurement: "pass" | "fail" | "skipped", state: EnforcementState): GateValue {
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
export function parseArgv(cmd: string): string[] {
  const argv: string[] = [];
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

interface CommandResult {
  code: number | null;
  missing: boolean;
  output: string;
  stdout: string;
}

function runCommand(argv: string[], cwd: string): CommandResult {
  const env = {
    ...process.env,
    PATH: [join(cwd, "node_modules", ".bin"), process.env.PATH || ""]
      .filter(Boolean)
      .join(delimiter),
  };
  const proc = spawnSync(argv[0], argv.slice(1), {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  if (proc.error) {
    return { code: null, missing: true, output: "", stdout: "" };
  }
  const stdout = proc.stdout || "";
  const output = `${stdout}${proc.stderr || ""}`;
  return { code: proc.status, missing: false, output, stdout };
}

function tail(output: string, lines = 50): string {
  const split = output.trimEnd().split("\n");
  return split.length <= lines ? output : split.slice(-lines).join("\n");
}

// ---------------------------------------------------------------------------
// Output parsers
// ---------------------------------------------------------------------------

function toCount(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Global line-coverage percentage from lcov text; null when unmeasurable. */
export function parseLcov(text: string): number | null {
  let lf = 0;
  let lh = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("LF:")) lf += toCount(line.slice(3));
    else if (line.startsWith("LH:")) lh += toCount(line.slice(3));
  }
  if (lf === 0) return null;
  return Math.round((lh / lf) * 1000) / 10;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
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
export function parseComplexityCsv(text: string): ComplexityEntry[] {
  const rows: ComplexityEntry[] = [];
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

function baselineKey(entry: ComplexityEntry): string {
  return `${entry.file}::${entry.function}`;
}

/**
 * Complexity burn-down semantics:
 * - new (non-baseline) functions above `max` fail;
 * - new or worsened functions above `hardCeiling` fail;
 * - unchanged or improved baseline hotspots pass, with shrink reporting.
 */
function classifyEntry(
  entry: ComplexityEntry,
  recorded: number | undefined,
  max: number,
  hardCeiling: number,
): { isNewOver: boolean; overCeiling: boolean; stillHotspot: boolean } {
  const inBaseline = recorded !== undefined;
  const isNewOver = !inBaseline && entry.complexity > max;
  const worsened = inBaseline && entry.complexity > recorded;
  if (entry.complexity > hardCeiling && (!inBaseline || worsened)) {
    return { isNewOver, overCeiling: true, stillHotspot: inBaseline };
  }
  return { isNewOver, overCeiling: false, stillHotspot: inBaseline && entry.complexity > max };
}

export interface ComplexityEvaluation {
  measurement: "pass" | "fail";
  new_violations: ComplexityEntry[];
  hard_ceiling_violations: ComplexityEntry[];
  hotspots_remaining: number;
  baseline_size: number;
  baseline_shrunk: boolean;
}

export function evaluateComplexity(
  current: ComplexityEntry[],
  baseline: ComplexityEntry[],
  { max, hardCeiling }: { max: number; hardCeiling: number },
): ComplexityEvaluation {
  const baselineBy = new Map<string, number>();
  for (const entry of baseline) baselineBy.set(baselineKey(entry), entry.complexity);

  const new_violations: ComplexityEntry[] = [];
  const hard_ceiling_violations: ComplexityEntry[] = [];
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

function runGitCapturing(args: string[], cwd: string): string[] | null {
  const proc = runCommand(["git", ...args], cwd);
  if (proc.missing || proc.code !== 0) return null;
  return proc.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function changedFiles(cwd: string, compareBranch: string, diagnostics: string[]): string[] | null {
  const compare = runGitCapturing(
    ["diff", "--name-only", "--diff-filter=ACMR", `${compareBranch}...HEAD`],
    cwd,
  );
  if (compare === null) {
    diagnostics.push(`git diff ${compareBranch}...HEAD failed — changed-file set unavailable`);
    return null;
  }
  const merged = new Set(compare);
  for (const args of [
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

function extensionsFor(eco: GuardrailsEcosystem): string[] {
  const exts: string[] = [];
  for (const signal of eco.detection_signals || []) {
    if (isExtensionSignal(signal)) exts.push(signal.slice(1));
  }
  return exts;
}

/** A `*.ts`-style signal denotes a lintable extension; directory globs do not. */
function isExtensionSignal(signal: string): boolean {
  return signal.startsWith("*.") && signal.indexOf("/", 2) === -1;
}

// ---------------------------------------------------------------------------
// runCheck — the durable-contract path
// ---------------------------------------------------------------------------

class ContractResolutionError extends Error {
  readonly code = "NO_CONTRACT";
}

/**
 * Single boundary guard for this self-contained vendored script: the parsed
 * guardrails.json shape is unknown at its one use site below, and there is
 * no shared type-guard module to import.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGuardrailsContract(value: unknown): value is GuardrailsContract {
  return isRecord(value) && value["version"] !== undefined && Array.isArray(value["ecosystems"]);
}

function loadContract(cwd: string): GuardrailsContract {
  const path = join(cwd, "guardrails.json");
  if (!existsSync(path)) {
    throw new ContractResolutionError(
      `no guardrails.json at ${path} — contract resolution (the five-step chain) belongs to the b-guardrails-check skill`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new Error(`malformed guardrails.json at ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!isGuardrailsContract(parsed)) {
    throw new Error(
      `malformed guardrails.json at ${path}: missing "version" or "ecosystems[]"`,
    );
  }
  return parsed;
}

function nz<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function initialVerdict(
  contract: GuardrailsContract,
  enforcement: Record<GateName, EnforcementState>,
  diagnostics: string[],
): GuardrailsVerdict {
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
] as const;

interface CheckContext {
  dir: string;
  contract: GuardrailsContract;
  enforcement: Record<GateName, EnforcementState>;
  diagnostics: string[];
  verdict: GuardrailsVerdict;
  targets: NonNullable<GuardrailsContract["targets"]>;
  max: number;
  hardCeiling: number;
  run: (argv: string[]) => CommandResult;
  coverageFailed: boolean;
}

function runTestSuites(ctx: CheckContext): void {
  for (const suite of SUITES) {
    if (ctx.enforcement[suite.gate] === "disabled") continue;
    let measurement: "pass" | "fail" | "skipped" = "skipped";
    let exitCode: number | null = null;
    for (const eco of ctx.contract.ecosystems) {
      const cmd = eco[suite.env];
      if (!cmd) continue;
      const proc = ctx.run(parseArgv(cmd));
      if (proc.missing) {
        ctx.diagnostics.push(`${suite.key} gate: tool not found for "${cmd}" — unavailable`);
        if (measurement !== "pass") measurement = "fail";
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

interface LintRun {
  mode: string;
  files: number;
  proc: CommandResult | null;
  unavailable?: boolean;
  measurement?: "pass" | "fail" | "advisory";
}

function lintDiffScoped(ctx: CheckContext, eco: GuardrailsEcosystem): LintRun {
  const listed = changedFiles(ctx.dir, ctx.contract.git_compare_branch || "", ctx.diagnostics);
  if (listed === null) return { mode: "diff-scoped", files: 0, proc: null, unavailable: true };
  const exts = extensionsFor(eco);
  const files = listed.filter(
    (f) => exts.length === 0 || exts.some((ext) => f.endsWith(ext)),
  );
  if (files.length === 0) return { mode: "diff-scoped", files: 0, proc: null };
  const proc = ctx.run([...parseArgv(eco.lint_cmd || ""), ...files]);
  return { mode: "diff-scoped", files: files.length, proc };
}

function lintWholeRepo(ctx: CheckContext, eco: GuardrailsEcosystem): LintRun {
  const proc = ctx.run(parseArgv(eco.lint_cmd || ""));
  const enforced = ctx.contract.ratchet?.baseline_lint_clean === true;
  const mode = enforced ? "whole-repo-enforced" : "whole-repo-advisory";
  const measurement = proc.code === 0 ? "pass" : enforced ? "fail" : "advisory";
  return { mode, files: 0, proc, measurement };
}

function lintOnce(ctx: CheckContext, eco: GuardrailsEcosystem): LintRun {
  if (eco.lint_accepts_paths && ctx.contract.git_compare_branch) {
    return lintDiffScoped(ctx, eco);
  }
  if (!eco.lint_accepts_paths) {
    return lintWholeRepo(ctx, eco);
  }
  // Path-accepting linter with no compare branch: nothing to scope to.
  return { mode: "skipped", files: 0, proc: null };
}

function lintOutcome(
  ctx: CheckContext,
  eco: GuardrailsEcosystem,
  result: LintRun,
): { measurement: GateValue; exitCode: number | null; failed: boolean } {
  if (result.unavailable) {
    ctx.diagnostics.push("lint gate: changed-file set unavailable");
    return { measurement: "fail", exitCode: null, failed: true };
  }
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

function runLintGate(ctx: CheckContext): void {
  let measurement: GateValue = "skipped";
  let mode = "skipped";
  let filesLinted = 0;
  let exitCode: number | null = null;
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
    lint_gate: applyEnforcement(measurement === "advisory" ? "fail" : measurement, ctx.enforcement.lint_gate),
  });
}

function runCoverageTool(ctx: CheckContext): { lcovPath: string | null; failed: boolean } {
  let failed = false;
  const candidate = join(ctx.dir, "coverage", "lcov.info");
  for (const eco of ctx.contract.ecosystems) {
    if (!eco.coverage_tool) continue;
    if ((eco.coverage_format || "lcov") !== "lcov") {
      ctx.diagnostics.push(
        `coverage gate: format "${eco.coverage_format}" not parseable (lcov only) — skipped`,
      );
      continue;
    }
    if (existsSync(candidate)) unlinkSync(candidate);
    const proc = ctx.run(parseArgv(eco.coverage_tool));
    if (proc.missing) {
      ctx.diagnostics.push(`coverage gate: tool not found for "${eco.coverage_tool}" — unavailable`);
      failed = true;
      continue;
    }
    if (proc.code !== 0) {
      ctx.diagnostics.push(`coverage command failed (exit ${proc.code})`);
      failed = true;
      continue;
    }
    if (existsSync(candidate)) return { lcovPath: candidate, failed: false };
    ctx.diagnostics.push("coverage gate: coverage/lcov.info missing after a successful coverage command — unavailable");
    failed = true;
  }
  return { lcovPath: null, failed };
}

/** Parse diff-cover's "Total coverage: N%" line without a regex. */
function extractPatchPercent(output: string): number | null {
  const idx = output.indexOf("Total coverage:");
  if (idx === -1) return null;
  const pct = Number.parseFloat(output.slice(idx + 15).trimStart());
  return Number.isFinite(pct) ? pct : null;
}

function runPatchGate(ctx: CheckContext, lcovPath: string | null): void {
  if (ctx.coverageFailed) {
    ctx.verdict.coverage.patch_gate = applyEnforcement("fail", ctx.enforcement.patch_gate);
    return;
  }
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
    ctx.verdict.coverage.patch_gate = applyEnforcement("fail", ctx.enforcement.patch_gate);
    return;
  }
  const pct = extractPatchPercent(proc.output);
  if (pct !== null) ctx.verdict.coverage.patch = pct;
  ctx.verdict.coverage.patch_gate = applyEnforcement(
    proc.code === 0 ? "pass" : "fail",
    ctx.enforcement.patch_gate,
  );
}

function runGlobalRatchet(ctx: CheckContext): void {
  if (ctx.coverageFailed) {
    ctx.verdict.gates.global_ratchet = applyEnforcement("fail", ctx.enforcement.global_ratchet);
    return;
  }
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

function loadComplexityBaseline(ctx: CheckContext): ComplexityEntry[] {
  const ratchet = ctx.contract.ratchet || {};
  if (!ratchet.complexity_baseline_file) return ratchet.baseline_complexity_inventory || [];
  const external = join(ctx.dir, ratchet.complexity_baseline_file);
  if (!existsSync(external)) {
    ctx.diagnostics.push(
      `complexity gate: baseline file ${ratchet.complexity_baseline_file} missing — using empty baseline`,
    );
    return [];
  }
  // The baseline file is written by the init skill; a cast keeps the exact
  // runtime behavior (a malformed file fails downstream exactly as before).
  return JSON.parse(readFileSync(external, "utf8")) as ComplexityEntry[];
}

interface ComplexityAggregate {
  new_violations: ComplexityEntry[];
  hard_ceiling_violations: ComplexityEntry[];
  hotspots: number;
  shrunk: boolean;
  count: number;
}

function runComplexityCommand(ctx: CheckContext, eco: GuardrailsEcosystem, baseline: ComplexityEntry[], agg: ComplexityAggregate): void {
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

function runComplexityGate(ctx: CheckContext): void {
  const baseline = loadComplexityBaseline(ctx);
  const agg: ComplexityAggregate = { new_violations: [], hard_ceiling_violations: [], hotspots: 0, shrunk: false, count: 0 };
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

export async function runCheck({ cwd = process.cwd() }: { cwd?: string } = {}): Promise<GuardrailsVerdict> {
  const dir = resolve(cwd);
  const contract = loadContract(dir);
  const enforcement = resolveEnforcement(contract);
  const diagnostics: string[] = [];
  const verdict = initialVerdict(contract, enforcement, diagnostics);
  const ctx: CheckContext = {
    dir,
    contract,
    enforcement,
    diagnostics,
    verdict,
    targets: contract.targets || {},
    max: contract.targets?.cyclomatic_max ?? 10,
    hardCeiling: contract.targets?.cyclomatic_hard_ceiling ?? 15,
    run: (argv) => runCommand(argv, dir),
    coverageFailed: false,
  };

  if (contract.version === 1) {
    diagnostics.push("guardrails.json is v1 — run /b-init-guardrails to add lint and test gates.");
  }

  runTestSuites(ctx);
  if (enforcement.lint_gate !== "disabled") runLintGate(ctx);

  const needsCoverage =
    enforcement.global_ratchet !== "disabled" || enforcement.patch_gate !== "disabled";
  const coverage = needsCoverage ? runCoverageTool(ctx) : { lcovPath: null, failed: false };
  ctx.coverageFailed = coverage.failed;
  if (coverage.lcovPath) verdict.coverage.current = parseLcov(readFileSync(coverage.lcovPath, "utf8"));
  if (enforcement.patch_gate !== "disabled") runPatchGate(ctx, coverage.lcovPath);
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

function main(): void {
  const argv = process.argv.slice(2);
  let cwd = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cwd") {
      i += 1;
      cwd = argv[i] ?? cwd;
    } else if (argv[i] === "--version") {
      console.log(`guardrails-check ${CHECK_VERSION}`);
      process.exit(0);
    } else if (argv[i] === "--help") {
      console.log(
        "usage: bun check.ts [--cwd <repo>] — emit the guardrails verdict JSON; exit 1 iff a required gate fails",
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
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(err instanceof ContractResolutionError ? 2 : 1);
    });
}

const invokedAsScript = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invokedAsScript) main();
