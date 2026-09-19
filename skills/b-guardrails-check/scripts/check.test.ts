import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  parseArgv,
  parseLcov,
  parseComplexityCsv,
  evaluateComplexity,
  resolveEnforcement,
  applyEnforcement,
  runCheck,
} from "./check.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join("/tmp", "guardrails-check-test-" + process.pid);

function fixtureRepo(name: string, guardrails: unknown): string {
  const dir = join(FIXTURE_ROOT, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "guardrails.json"),
    typeof guardrails === "string" ? guardrails : JSON.stringify(guardrails, null, 2),
  );
  return dir;
}

function baseContract(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 2,
    targets: {
      coverage_min: 60,
      coverage_target: 75,
      cyclomatic_max: 10,
      cyclomatic_hard_ceiling: 15,
      patch_coverage_min: 90,
    },
    ratchet: {
      baseline_coverage: null,
      baseline_complexity_inventory: [],
      complexity_baseline_file: null,
      baseline_lint_clean: null,
    },
    ecosystems: [
      {
        name: "fixture",
        detected: true,
        test_runner: null,
        coverage_tool: null,
        coverage_format: null,
        complexity_tool: null,
        complexity_cmd: null,
        lint_cmd: null,
        lint_accepts_paths: false,
        functional_test_cmd: null,
        configured_not_installed: [],
        detection_signals: ["package.json"],
      },
    ],
    git_compare_branch: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseArgv — recorded commands must run without a shell
// ---------------------------------------------------------------------------

describe("parseArgv", () => {
  it("splits a simple command", () => {
    expect(parseArgv("vitest run")).toEqual(["vitest", "run"]);
  });

  it("keeps double-quoted segments as single argv entries", () => {
    const argv = parseArgv(
      'lizard -C 10 -w --csv -x "*/.git/*" -x "*/node_modules/*" .',
    );
    expect(argv).toEqual([
      "lizard",
      "-C",
      "10",
      "-w",
      "--csv",
      "-x",
      "*/.git/*",
      "-x",
      "*/node_modules/*",
      ".",
    ]);
  });

  it("supports quoted arguments containing spaces", () => {
    expect(parseArgv('echo "hello world"')).toEqual(["echo", "hello world"]);
  });
});

// ---------------------------------------------------------------------------
// parseLcov — global coverage percentage
// ---------------------------------------------------------------------------

describe("parseLcov", () => {
  it("computes global line coverage across files", () => {
    const lcov = [
      "SF:src/a.ts",
      "LF:10",
      "LH:8",
      "end_of_record",
      "SF:src/b.ts",
      "LF:10",
      "LH:5",
      "end_of_record",
    ].join("\n");
    expect(parseLcov(lcov)).toBe(65);
  });

  it("returns null when the report has no lines", () => {
    expect(parseLcov("SF:src/a.ts\nend_of_record")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// parseComplexityCsv — lizard --csv output
// ---------------------------------------------------------------------------

describe("parseComplexityCsv", () => {
  it("extracts file, function, and CCN from lizard CSV rows", () => {
    const csv = [
      "5,1,33,2,6,\"die@82-87@skills/x.ts\",\"skills/x.ts\",\"die\",\"die ( msg )\",82,87",
      "13,12,82,1,14,\"f@1-2@./skills/y.ts\",\"./skills/y.ts\",\"f\",\"f ( a , b )\",1,2",
      "8,2,40,1,9,\"g@1-9@./skills/a,b.ts\",\"./skills/a,b.ts\",\"g\",\"g ( )\",1,9",
      "summary-garbage-line,that,is,not,a,row",
    ].join("\n");
    const rows = parseComplexityCsv(csv);
    expect(rows).toEqual([
      { file: "skills/x.ts", function: "die", complexity: 1 },
      { file: "skills/y.ts", function: "f", complexity: 12 },
      { file: "skills/a,b.ts", function: "g", complexity: 2 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// evaluateComplexity — baseline burn-down semantics
// ---------------------------------------------------------------------------

describe("evaluateComplexity", () => {
  const opts = { max: 10, hardCeiling: 15 };

  it("unchanged baseline hotspots pass and remain counted", () => {
    const out = evaluateComplexity(
      [{ file: "a.ts", function: "f", complexity: 17 }],
      [{ file: "a.ts", function: "f", complexity: 17 }],
      opts,
    );
    expect(out.measurement).toBe("pass");
    expect(out.hotspots_remaining).toBe(1);
    expect(out.new_violations).toEqual([]);
    expect(out.hard_ceiling_violations).toEqual([]);
  });

  it("a new function above the warning threshold fails", () => {
    const out = evaluateComplexity(
      [{ file: "a.ts", function: "g", complexity: 11 }],
      [],
      opts,
    );
    expect(out.measurement).toBe("fail");
    expect(out.new_violations).toEqual([{ file: "a.ts", function: "g", complexity: 11 }]);
  });

  it("a new function above the hard ceiling is a hard-ceiling violation", () => {
    const out = evaluateComplexity(
      [{ file: "a.ts", function: "g", complexity: 20 }],
      [],
      opts,
    );
    expect(out.measurement).toBe("fail");
    expect(out.hard_ceiling_violations).toEqual([
      { file: "a.ts", function: "g", complexity: 20 },
    ]);
  });

  it("a worsened baseline function above the hard ceiling fails", () => {
    const out = evaluateComplexity(
      [{ file: "a.ts", function: "f", complexity: 18 }],
      [{ file: "a.ts", function: "f", complexity: 12 }],
      opts,
    );
    expect(out.measurement).toBe("fail");
    expect(out.hard_ceiling_violations).toEqual([
      { file: "a.ts", function: "f", complexity: 18 },
    ]);
  });

  it("an improved baseline hotspot proposes a burn-down shrink", () => {
    const out = evaluateComplexity(
      [{ file: "a.ts", function: "f", complexity: 9 }],
      [{ file: "a.ts", function: "f", complexity: 17 }],
      opts,
    );
    expect(out.measurement).toBe("pass");
    expect(out.hotspots_remaining).toBe(0);
    expect(out.baseline_shrunk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// enforcement states
// ---------------------------------------------------------------------------

describe("resolveEnforcement", () => {
  it("defaults every gate when the contract is silent", () => {
    expect(resolveEnforcement({})).toEqual({
      unit_test_gate: "required",
      functional_test_gate: "required",
      lint_gate: "advisory",
      patch_gate: "required",
      global_ratchet: "required",
      complexity_gate: "required",
    });
  });

  it("applies explicit overrides", () => {
    expect(
      resolveEnforcement({ enforcement: { patch_gate: "advisory", lint_gate: "disabled" } }),
    ).toMatchObject({ patch_gate: "advisory", lint_gate: "disabled" });
  });

  it("rejects unknown states as malformed", () => {
    expect(() => resolveEnforcement({ enforcement: { patch_gate: "sometimes" } })).toThrow();
  });
});

describe("applyEnforcement", () => {
  it("required failure fails, advisory failure advises, disabled never runs", () => {
    expect(applyEnforcement("fail", "required")).toBe("fail");
    expect(applyEnforcement("fail", "advisory")).toBe("advisory");
    expect(applyEnforcement("fail", "disabled")).toBe("skipped");
    expect(applyEnforcement("pass", "advisory")).toBe("pass");
    expect(applyEnforcement("skipped", "required")).toBe("skipped");
  });
});

// ---------------------------------------------------------------------------
// runCheck — fixture repos
// ---------------------------------------------------------------------------

describe("runCheck", () => {
  beforeEach(() => mkdirSync(FIXTURE_ROOT, { recursive: true }));
  afterEach(() => rmSync(FIXTURE_ROOT, { recursive: true, force: true }));

  it("a required unit-gate failure fails the verdict", async () => {
    const dir = fixtureRepo(
      "required-fail",
      baseContract({ ecosystems: [ecosystem({ test_runner: "node -e process.exit(1)" })] }),
    );
    const verdict = await runCheck({ cwd: dir });
    expect(verdict.gates.unit_test_gate).toBe("fail");
    expect(verdict.status).toBe("fail");
    expect(verdict.tests.unit_exit_code).toBe(1);
  });

  it("an advisory unit-gate failure does not fail the verdict", async () => {
    const dir = fixtureRepo(
      "advisory-fail",
      baseContract({
        enforcement: { unit_test_gate: "advisory" },
        ecosystems: [ecosystem({ test_runner: "node -e process.exit(1)" })],
      }),
    );
    const verdict = await runCheck({ cwd: dir });
    expect(verdict.gates.unit_test_gate).toBe("advisory");
    expect(verdict.status).toBe("pass");
  });

  it("a disabled gate is skipped and its command never runs", async () => {
    const dir = fixtureRepo(
      "disabled",
      baseContract({
        enforcement: { unit_test_gate: "disabled" },
        ecosystems: [
          ecosystem({
            test_runner: `node -e "require('fs').writeFileSync('marker.txt','x')"`,
          }),
        ],
      }),
    );
    const verdict = await runCheck({ cwd: dir });
    expect(verdict.gates.unit_test_gate).toBe("skipped");
    expect(existsSync(join(dir, "marker.txt"))).toBe(false);
  });

  it("a null command is skipped without surprise", async () => {
    const dir = fixtureRepo("null-cmd", baseContract());
    const verdict = await runCheck({ cwd: dir });
    expect(verdict.gates.unit_test_gate).toBe("skipped");
    expect(verdict.gates.functional_test_gate).toBe("skipped");
    expect(verdict.gates.lint_gate).toBe("skipped");
    expect(verdict.status).toBe("pass");
  });

  it("skips the global ratchet when coverage is unmeasurable", async () => {
    const dir = fixtureRepo(
      "ratchet-regression",
      baseContract({
        ratchet: ratchet({ baseline_coverage: 54.9 }),
        ecosystems: [
          ecosystem({ coverage_tool: "node -e process.exit(0)", coverage_format: "lcov" }),
        ],
      }),
    );
    // No lcov file produced → coverage unmeasurable → ratchet skipped.
    const verdict = await runCheck({ cwd: dir });
    expect(verdict.gates.global_ratchet).toBe("skipped");
  });

  it("fails the global ratchet when lcov coverage is below the baseline", async () => {
    const dir = fixtureRepo(
      "ratchet-regression-with-lcov",
      baseContract({
        ratchet: ratchet({ baseline_coverage: 54.9 }),
        ecosystems: [
          ecosystem({ coverage_tool: "node -e process.exit(0)", coverage_format: "lcov" }),
        ],
      }),
    );
    mkdirSync(join(dir, "coverage"), { recursive: true });
    writeFileSync(join(dir, "coverage", "lcov.info"), "LF:10\nLH:5\n");
    const verdict = await runCheck({ cwd: dir });
    expect(verdict.gates.global_ratchet).toBe("fail");
  });

  it("missing guardrails.json is a hard error", async () => {
    const dir = join(FIXTURE_ROOT, "no-contract");
    mkdirSync(dir, { recursive: true });
    await expect(runCheck({ cwd: dir })).rejects.toThrow(/guardrails\.json/);
  });

  it("malformed guardrails.json is a hard error", async () => {
    const dir = fixtureRepo("malformed", "{ not json");
    await expect(runCheck({ cwd: dir })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// CLI exit-code contract
// ---------------------------------------------------------------------------

describe("check.mjs CLI", () => {
  beforeEach(() => mkdirSync(FIXTURE_ROOT, { recursive: true }));
  afterEach(() => rmSync(FIXTURE_ROOT, { recursive: true, force: true }));

  function runCli(cwd: string) {
    return spawnSync(process.execPath, [join(scriptDir, "check.mjs"), "--cwd", cwd], {
      encoding: "utf8",
    });
  }

  it("exits nonzero only when a required gate fails", () => {
    const failDir = fixtureRepo(
      "cli-fail",
      baseContract({ ecosystems: [ecosystem({ test_runner: "node -e process.exit(1)" })] }),
    );
    const advisoryDir = fixtureRepo(
      "cli-advisory",
      baseContract({
        enforcement: { unit_test_gate: "advisory" },
        ecosystems: [ecosystem({ test_runner: "node -e process.exit(1)" })],
      }),
    );

    const failing = runCli(failDir);
    expect(failing.status).toBe(1);
    const verdict = JSON.parse(failing.stdout);
    expect(verdict.status).toBe("fail");
    expect(verdict.contract).toBe("durable");
    expect(verdict.contract_version).toBe(2);

    const advisory = runCli(advisoryDir);
    expect(advisory.status).toBe(0);
  });

  it("emits verdict JSON on stdout and keeps command output out of it", () => {
    const dir = fixtureRepo(
      "cli-stdout",
      baseContract({
        ecosystems: [ecosystem({ test_runner: 'node -e "console.log(42); process.exit(0)"' })],
      }),
    );
    const proc = runCli(dir);
    expect(proc.status).toBe(0);
    const verdict = JSON.parse(proc.stdout);
    expect(verdict.gates.unit_test_gate).toBe("pass");
    expect(verdict.tests.unit_exit_code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function ecosystem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "fixture",
    detected: true,
    test_runner: null,
    coverage_tool: null,
    coverage_format: null,
    complexity_tool: null,
    complexity_cmd: null,
    lint_cmd: null,
    lint_accepts_paths: false,
    functional_test_cmd: null,
    configured_not_installed: [],
    detection_signals: ["package.json"],
    ...overrides,
  };
}

function ratchet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    baseline_coverage: null,
    baseline_complexity_inventory: [],
    complexity_baseline_file: null,
    baseline_lint_clean: null,
    ...overrides,
  };
}
