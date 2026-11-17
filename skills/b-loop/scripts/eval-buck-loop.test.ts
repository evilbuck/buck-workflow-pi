import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAcceptanceCriteria, parseFrontmatter, unwrapToolResult } from "./frontmatter.js";
import { parseSubjectArgument, resolveAndPinPlan, validateBridges, validateStorageConfig } from "./validation.js";
import { runBuckLoop } from "./eval-buck-loop.js";
import type { EvalBridges } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const tempDirs: string[] = [];

function detectOmpBinary(): boolean {
  try {
    execSync("which omp", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const HAS_OMP = detectOmpBinary();

function createTempDir(prefix = "b-loop-p1-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function shellError(message: string, exitCode: number, output = ""): Error & { exitCode: number; output: string } {
  return Object.assign(new Error(message), { exitCode, output });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

interface MockWorkflowItem {
  token: string;
  revision: string;
  sha256: string;
  subjectId: string;
  kind: string;
  logicalName: string;
  text: string;
}

function makeWorkflowItems(subjectId: string, opts: { unphased?: boolean; duplicateOrder?: boolean } = {}): MockWorkflowItem[] {
  const items: MockWorkflowItem[] = [
    {
      token: `tok-index-${subjectId}`,
      revision: "rev-idx-1",
      sha256: "sha-idx-1",
      subjectId,
      kind: "subject-index",
      logicalName: "index.md",
      text: "---\nstatus: active\n---\n",
    },
    {
      token: `tok-plan-${subjectId}`,
      revision: "rev-plan-1",
      sha256: "sha-plan-1",
      subjectId,
      kind: "plan",
      logicalName: "plan-demo.md",
      text: "---\nstatus: active\n---\n# Demo Plan\n",
    },
  ];
  if (!opts.unphased) {
    items.push(
      {
        token: `tok-p2-${subjectId}`,
        revision: "rev-p2-1",
        sha256: "sha-p2-1",
        subjectId,
        kind: "phase",
        logicalName: "phase-2-second.md",
        text: [
          "---",
          "status: pending",
          "phase: 2",
          `order: ${opts.duplicateOrder ? 1 : 2}`,
          "difficulty: hard # high complexity",
          "buck_hint: /b-build-hard",
          "files:",
          "  - src/second.ts",
          "acceptance_criteria:",
          '  - "[ ] second criterion"',
          "---",
          "# Phase 2",
        ].join("\n"),
      },
      {
        token: `tok-p1-${subjectId}`,
        revision: "rev-p1-1",
        sha256: "sha-p1-1",
        subjectId,
        kind: "phase",
        logicalName: "phase-1-first.md",
        text: [
          "---",
          "status: pending",
          "phase: 1",
          "order: 1",
          "difficulty: medium",
          "buck_hint: /b-build",
          "files:",
          "  - src/first.ts",
          "acceptance_criteria:",
          '  - "[ ] first criterion"',
          "---",
          "# Phase 1",
        ].join("\n"),
      },
    );
  }
  return items;
}

function makeValidBridges(overrides: {
  subjectId?: string;
  branchRef?: string;
  headCommit?: string;
  remoteOrigin?: string;
  unphased?: boolean;
  duplicateOrder?: boolean;
  insideWorkTree?: boolean;
  listItems?: unknown[];
  listIsError?: boolean;
} = {}): { bridges: EvalBridges; calls: { agent: number; sh: string[]; workflow: unknown[] } } {
  const subjectId = overrides.subjectId ?? "2026-11-17.demo-subject";
  const calls = { agent: 0, sh: [] as string[], workflow: [] as unknown[] };
  const items = overrides.listItems ?? makeWorkflowItems(subjectId, {
    unphased: overrides.unphased,
    duplicateOrder: overrides.duplicateOrder,
  });

  const bridges: EvalBridges = {
    agent: vi.fn(async () => {
      calls.agent++;
      return { ok: true, wait: async () => ({ ok: true }) };
    }),
    wait: vi.fn(async () => [{ ok: true }]),
    judge: vi.fn(async () => ({ answers: {} })),
    phase: vi.fn(),
    log: vi.fn(),
    budget: { remaining: vi.fn(async () => 100_000) },
    sh: vi.fn(async (cmd: unknown) => {
      const command = String(cmd);
      calls.sh.push(command);
      if (command.includes("rev-parse --is-inside-work-tree")) {
        if (overrides.insideWorkTree === false) {
          throw shellError("not a git repository", 128, "fatal: not a git repository");
        }
        return "true\n";
      }
      if (command.includes("symbolic-ref --quiet HEAD")) {
        const ref = overrides.branchRef ?? "refs/heads/feat/demo";
        if (!ref) throw shellError("HEAD is detached", 1);
        return `${ref}\n`;
      }
      if (command.includes("rev-parse --verify HEAD^{commit}")) {
        const sha = overrides.headCommit ?? "a".repeat(40);
        if (!sha) throw shellError("Needed a single revision", 128, "fatal: Needed a single revision");
        return `${sha}\n`;
      }
      if (command.includes("config --get remote.origin.url")) {
        if (!overrides.remoteOrigin) throw shellError("no remote origin", 1);
        return `${overrides.remoteOrigin}\n`;
      }
      if (command.includes("checkpoint-cli.ts") && command.includes(" read ")) {
        return '{"found":false}\n';
      }
      return "";
    }),
    tool: {
      workflow_state: vi.fn(async (args: Record<string, unknown>) => {
        calls.workflow.push(args);
        if (overrides.listIsError) {
          return { isError: true, content: [{ type: "text", text: "workflow database locked" }] };
        }
        if (args.operation === "list") {
          return {
            content: [{ type: "text", text: JSON.stringify(items) }],
            details: items,
          };
        }
        return {};
      }),
    },
  };
  return { bridges, calls };
}

function extractPromptEvalCode(): string {
  const promptMd = readFileSync(join(REPO_ROOT, "prompts/b-loop.md"), "utf8");
  const codeMatch = promptMd.match(/code:\s*`([\s\S]*?)`\s*\}\s*\)/);
  if (!codeMatch) throw new Error("Missing eval code block in prompts/b-loop.md");
  return codeMatch[1];
}

describe("prompt & skill contract", () => {
  it("prompts/b-loop.md uses safe serialized args and explicit module import without %load or unguarded bridges", () => {
    const promptText = readFileSync(join(REPO_ROOT, "prompts/b-loop.md"), "utf8");
    const skillText = readFileSync(join(REPO_ROOT, "skills/b-loop/SKILL.md"), "utf8");

    expect(promptText).not.toContain("%load");
    expect(promptText).toContain("import(");
    expect(promptText).toContain("runBuckLoop");
    expect(promptText).toContain("$ARGUMENTS");
    expect(promptText).not.toContain('"$ARGUMENTS"');
    expect(promptText).toContain('typeof budget !== "undefined"');

    expect(skillText).not.toContain("%load");
    expect(skillText).not.toContain("--status");
    expect(skillText).not.toContain("--resume");
    expect(skillText).not.toContain("--stop");
    expect(skillText).toContain("/b-loop <subject>");
  });
});

describe("frontmatter & tool result helpers", () => {
  it("parses frontmatter scalars, inline comments, 1-char quotes, block lists, and quoted inline arrays", () => {
    const fm = parseFrontmatter([
      "---",
      'title: "Demo #1" # heading note',
      "order: 2 # explicit order",
      'single_quote_char: "',
      "difficulty: hard # requires care",
      'topics: ["a, b", c, \'d#e\'] # trailing',
      "files:",
      "  - skills/b-loop/scripts/eval-buck-loop.ts # main",
      "---",
      "# Body",
    ].join("\n"));
    expect(fm.title).toBe("Demo #1");
    expect(fm.order).toBe(2);
    expect(fm.single_quote_char).toBe('"');
    expect(fm.difficulty).toBe("hard");
    expect(fm.topics).toEqual(["a, b", "c", "d#e"]);
    expect(fm.files).toEqual(["skills/b-loop/scripts/eval-buck-loop.ts"]);
  });

  it("parses acceptance criteria checkbox counts", () => {
    const crit = parseAcceptanceCriteria([
      "---",
      "acceptance_criteria:",
      '  - "[x] done"',
      '  - "[ ] open"',
      '  - "[X] also done"',
      "---",
    ].join("\n"));
    expect(crit.total).toBe(3);
    expect(crit.checked).toBe(2);
  });

  it("unwraps tool results and throws when isError is true", () => {
    expect(unwrapToolResult({ details: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(unwrapToolResult({ content: [{ type: "text", text: '{"ok":true}' }] })).toEqual({ ok: true });
    expect(unwrapToolResult('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(unwrapToolResult({ plain: 2 })).toEqual({ plain: 2 });
    expect(() =>
      unwrapToolResult({ isError: true, content: [{ type: "text", text: "backend failed" }] }),
    ).toThrow(/backend failed/);
  });
});

describe("argument & subject validation", () => {
  it("requires one explicit subject ID and rejects empty input", () => {
    expect(() => parseSubjectArgument("")).toThrow(/subject/i);
    expect(() => parseSubjectArgument("   ")).toThrow(/subject/i);
    expect(parseSubjectArgument("2026-11-17.b-loop-repair")).toBe("2026-11-17.b-loop-repair");
  });

  it("rejects removed flags, arbitrary flags, extra args, and path inputs", () => {
    for (const bad of [
      "--status",
      "--resume",
      "--stop",
      "2026-11-17.foo --resume",
      "--profile fast 2026-11-17.foo",
      "-p 2026-11-17.foo",
      "2026-11-17.foo extra",
      ".context/2026-11-17.foo",
      "2026-11-17.foo/phase-1.md",
      "phase-1.md",
      "../escape",
    ]) {
      expect(() => parseSubjectArgument(bad)).toThrow();
    }
  });
});

describe("fail-closed bridge validation", () => {
  it("fails closed when required OMP bridges are missing and never creates mocks", async () => {
    const { bridges } = makeValidBridges();
    expect(() => validateBridges(undefined)).toThrow(/Missing required OMP bridges/i);
    expect(() => validateBridges({ ...bridges, agent: undefined })).toThrow(/agent/);
    expect(() => validateBridges({ ...bridges, wait: undefined })).toThrow(/wait/);
    expect(() => validateBridges({ ...bridges, judge: undefined })).toThrow(/judge/);
    expect(() => validateBridges({ ...bridges, sh: undefined })).toThrow(/sh/);
    expect(() => validateBridges({ ...bridges, tool: {} })).toThrow(/tool\.workflow_state/);
  });

  it("runBuckLoop blocks before any sh or agent call when bridges are missing", async () => {
    const shSpy = vi.fn(async () => "");
    const res = await runBuckLoop({
      args: "2026-11-17.demo-subject",
      cwd: createTempDir(),
      bridges: { sh: shSpy, log: vi.fn() },
    });
    expect(res.ok).toBe(false);
    expect(res.state).toBe("blocked");
    expect(res.message).toMatch(/Missing required OMP bridges/i);
    expect(shSpy).not.toHaveBeenCalled();
  });
});

describe("branch, storage config, and plan pinning pre-flight", () => {
  it("rejects detached HEAD, unborn branch, non-git dirs, and scopes git commands via git -C <cwd>", async () => {
    const dir = createTempDir();

    const detached = makeValidBridges({ branchRef: "" });
    const r1 = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, bridges: detached.bridges });
    expect(r1.ok).toBe(false);
    expect(r1.message).toMatch(/detached|named/i);
    expect(detached.calls.sh[0]).toContain(`git -C '${dir}'`);
    expect(detached.calls.agent).toBe(0);

    const unborn = makeValidBridges({ headCommit: "" });
    const r2 = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, bridges: unborn.bridges });
    expect(r2.ok).toBe(false);
    expect(unborn.calls.agent).toBe(0);

    const nonGit = makeValidBridges({ insideWorkTree: false });
    const r3 = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, bridges: nonGit.bridges });
    expect(r3.ok).toBe(false);
    expect(nonGit.calls.agent).toBe(0);

    const missingCwd = join(dir, "does-not-exist");
    const missing = makeValidBridges();
    const r4 = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: missingCwd, bridges: missing.bridges });
    expect(r4.ok).toBe(false);
    expect(r4.message).toMatch(/directory/i);
    expect(missing.calls.sh).toHaveLength(0);
  });

  it("handles key-reordered project storage, 4-space indentation, inline origins, flow mappings, and ambiguous matches", async () => {
    const cfgDir = createTempDir();

    // connection_env before adapter in 4-space project block with inline origins array
    const reorderedCfg = join(cfgDir, "reordered.yaml");
    writeFileSync(
      reorderedCfg,
      [
        "version: 1",
        "storage:",
        "  adapter: repo-files",
        "projects:",
        "    demo-four-space:",
        "        origins: [https://github.com/org/demo]",
        "        storage:",
        "            connection_env: PG_URL",
        "            adapter: postgres",
      ].join("\n"),
    );
    expect(() => validateStorageConfig({ configPath: reorderedCfg, origin: "https://github.com/org/demo" })).toThrow(/repo-files/i);

    // Flow mapping syntax fails closed
    const flowCfg = join(cfgDir, "flow.yaml");
    writeFileSync(
      flowCfg,
      [
        "version: 1",
        "projects:",
        "  demo:",
        "    origins: [https://github.com/org/demo]",
        "    storage: { adapter: postgres }",
      ].join("\n"),
    );
    expect(() => validateStorageConfig({ configPath: flowCfg, origin: "https://github.com/org/demo" })).toThrow(/flow/i);

    // Ambiguous duplicate origin across two project blocks fails closed
    const dupOriginCfg = join(cfgDir, "ambiguous.yaml");
    writeFileSync(
      dupOriginCfg,
      [
        "version: 1",
        "storage:",
        "  adapter: repo-files",
        "projects:",
        "  first:",
        "    origins:",
        "      - https://github.com/org/demo",
        "  second:",
        "    origins:",
        "      - https://github.com/org/demo/",
        "    storage:",
        "      adapter: sqlite",
      ].join("\n"),
    );
    expect(() => validateStorageConfig({ configPath: dupOriginCfg, origin: "https://github.com/org/demo" })).toThrow(/Ambiguous/i);

    // Quoted & or * in URLs is allowed while YAML anchors fail closed; empty env BUCK_WORKFLOW_CONFIG ignored
    const prevEnv = process.env.BUCK_WORKFLOW_CONFIG;
    process.env.BUCK_WORKFLOW_CONFIG = "";
    try {
      expect(() => validateStorageConfig({ xdgConfigHome: cfgDir })).not.toThrow();
    } finally {
      if (prevEnv === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
      else process.env.BUCK_WORKFLOW_CONFIG = prevEnv;
    }

    const anchorCfg = join(cfgDir, "anchor.yaml");
    writeFileSync(anchorCfg, "version: 1\nstorage: &ref\n  adapter: repo-files\n");
    expect(() => validateStorageConfig({ configPath: anchorCfg })).toThrow(/anchor/i);

    const listAnchorCfg = join(cfgDir, "list-anchor.yaml");
    writeFileSync(
      listAnchorCfg,
      [
        "version: 1",
        "projects:",
        "  demo:",
        "    origins:",
        "      - &alias https://github.com/org/demo",
      ].join("\n"),
    );
    expect(() => validateStorageConfig({ configPath: listAnchorCfg })).toThrow(/anchor/i);

    const inlineAliasCfg = join(cfgDir, "inline-alias.yaml");
    writeFileSync(inlineAliasCfg, "version: 1\nprojects:\n  demo:\n    origins: [*alias]\n");
    expect(() => validateStorageConfig({ configPath: inlineAliasCfg })).toThrow(/anchor/i);

    const dupKeyCfg = join(cfgDir, "dup-key.yaml");
    writeFileSync(
      dupKeyCfg,
      [
        "version: 1",
        "storage:",
        "  adapter: postgres",
        "storage:",
        "  adapter: repo-files",
      ].join("\n"),
    );
    expect(() => validateStorageConfig({ configPath: dupKeyCfg })).toThrow(/Duplicate/i);

    // Same-indent YAML sequence under origins:
    const sameIndentCfg = join(cfgDir, "same-indent.yaml");
    writeFileSync(
      sameIndentCfg,
      [
        "version: 1",
        "storage:",
        "  adapter: repo-files",
        "projects:",
        "  demo:",
        "    origins:",
        "    - https://github.com/org/demo",
        "    storage:",
        "      adapter: sqlite",
      ].join("\n"),
    );
    expect(() => validateStorageConfig({ configPath: sameIndentCfg, origin: "https://github.com/org/demo" })).toThrow(/repo-files/i);
  });

  it("rejects unphased plans, duplicate orders, malformed rows, tool errors, and wrong kind items", async () => {
    const dir = createTempDir();
    const xdg = createTempDir();

    const errWf = makeValidBridges({ listIsError: true });
    const rErr = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, xdgConfigHome: xdg, bridges: errWf.bridges });
    expect(rErr.ok).toBe(false);
    expect(rErr.message).toMatch(/workflow database locked/);

    const malformedWf = makeValidBridges({ listItems: [{ broken: true }] });
    const rMalformed = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, xdgConfigHome: xdg, bridges: malformedWf.bridges });
    expect(rMalformed.ok).toBe(false);
    expect(rMalformed.message).toMatch(/Malformed artifact/i);

    const wrongKind = makeValidBridges({
      listItems: [
        ...makeWorkflowItems("2026-11-17.demo-subject", { unphased: true }),
        {
          token: "tok-note",
          revision: "rev-note",
          sha256: "sha-note",
          subjectId: "2026-11-17.demo-subject",
          kind: "memory",
          logicalName: "phase-1-notes.md",
          text: "---\norder: 1\n---\n",
        },
      ],
    });
    const rWrongKind = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, xdgConfigHome: xdg, bridges: wrongKind.bridges });
    expect(rWrongKind.ok).toBe(false);
    expect(rWrongKind.message).toMatch(/discrete|unphased/i);

    const unphased = makeValidBridges({ unphased: true });
    const rUnphased = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, xdgConfigHome: xdg, bridges: unphased.bridges });
    expect(rUnphased.ok).toBe(false);
    expect(unphased.calls.agent).toBe(0);

    const dup = makeValidBridges({ duplicateOrder: true });
    const rDup = await runBuckLoop({ args: "2026-11-17.demo-subject", cwd: dir, xdgConfigHome: xdg, bridges: dup.bridges });
    expect(rDup.ok).toBe(false);
    expect(rDup.message).toMatch(/duplicate/i);

    const valid = makeValidBridges();
    const pinned = await resolveAndPinPlan(
      valid.bridges.tool!.workflow_state!,
      "2026-11-17.demo-subject",
      { branchRef: "refs/heads/feat/demo", branchName: "feat/demo", headCommit: "a".repeat(40) },
    );
    expect(pinned.phases.map(p => [p.order, p.logicalName, p.revision, p.buckHint])).toEqual([
      [1, "phase-1-first.md", "rev-p1-1", "/b-build"],
      [2, "phase-2-second.md", "rev-p2-1", "/b-build-hard"],
    ]);

    const rDefault = await runBuckLoop({
      args: "2026-11-17.demo-subject",
      cwd: dir,
      xdgConfigHome: xdg,
      bridges: valid.bridges,
      checkpointBackend: {
        async read() { return null; },
        async write({ checkpoint }) {
          const cloned = structuredClone(checkpoint);
          const { createHash } = await import("node:crypto");
          const sha256 = createHash("sha256").update(JSON.stringify(cloned), "utf8").digest("hex");
          return { revision: "r1", sha256, checkpoint: cloned };
        },
      },
    });
    expect(rDefault.subject).toBe("2026-11-17.demo-subject");
    expect(valid.calls.agent).toBeGreaterThanOrEqual(1);
  });
});

describe("installed path resolution & zero-bare-specifier constraints (Assumption A-4)", () => {
  it("contains zero bare npm package specifiers in skills/b-loop/scripts/*.ts", () => {
    const scriptsDir = join(REPO_ROOT, "skills/b-loop/scripts");
    const tsFiles = readdirSync(scriptsDir).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(tsFiles.length).toBeGreaterThan(0);

    for (const file of tsFiles) {
      const src = readFileSync(join(scriptsDir, file), "utf8");
      const importRegex = /(?:from|import)\s+["']([^"']+)["']/g;
      for (const match of src.matchAll(importRegex)) {
        const spec = match[1];
        const allowed = spec.startsWith("node:") || spec.startsWith("./") || spec.startsWith("../");
        expect(allowed, `Unexpected bare specifier "${spec}" in ${file}`).toBe(true);
      }
    }
  });

  it.skipIf(!HAS_OMP)(
    "executes prompts/b-loop.md in installed OMP from a separate worktree across plugin, config.yml, BUCK_LOOP_RUNNER, injection args, and missing globals (A-4)",
    { timeout: 90_000 },
    () => {
      const makeA4Repo = (prefix: string) => {
        const repo = createTempDir(prefix);
        execSync("git init -b feat/a4-test", { cwd: repo, stdio: "ignore" });
        execSync('git config user.email "test@example.com" && git config user.name "Test"', { cwd: repo, stdio: "ignore" });
        const subjDir = join(repo, ".context", "2026-11-17.a4-fixture");
        mkdirSync(subjDir, { recursive: true });
        mkdirSync(join(repo, "src"), { recursive: true });
        writeFileSync(join(repo, "README.md"), "# External Project\n");
        writeFileSync(join(repo, "src", "first.ts"), "export const first = 0;\n");
        writeFileSync(join(repo, "src", "second.ts"), "export const second = 0;\n");
        const fixtureItems = makeWorkflowItems("2026-11-17.a4-fixture");
        for (const item of fixtureItems) {
          writeFileSync(join(subjDir, item.logicalName), item.text);
        }
        execSync("git add . && git commit -m init", { cwd: repo, stdio: "ignore" });
        expect(existsSync(join(repo, "skills"))).toBe(false);
        return { repo, fixtureItems };
      };

      const { repo: fixtureRepo, fixtureItems: items } = makeA4Repo("a4-target-repo-");
      const { repo: cfgRepo } = makeA4Repo("a4-cfg-repo-");

      const isolatedHome = createTempDir("a4-omp-home-");
      const pluginPkg = join(isolatedHome, ".omp", "plugins", "node_modules", "buck-workflow");
      mkdirSync(join(isolatedHome, ".omp", "plugins", "node_modules"), { recursive: true });
      symlinkSync(REPO_ROOT, pluginPkg);

      // config.yml fallback home (no plugins dir, ignores models list, reads extensions list)
      const cfgHome = createTempDir("a4-cfg-home-");
      mkdirSync(join(cfgHome, ".omp", "agent"), { recursive: true });
      writeFileSync(
        join(cfgHome, ".omp", "agent", "config.yml"),
        [
          "models:",
          "  - /nonexistent/model",
          "extensions:",
          `  - ${REPO_ROOT} # main buck repo`,
        ].join("\n"),
      );

      const rawCode = extractPromptEvalCode();
      const buildCell = (argStr: string): string => rawCode.replace('"__BUCK_LOOP_ARGS__"', JSON.stringify(argStr));

      const injectionArg = '2026-11-17.bad"; throw new Error("pwned"); //\n${1+1}';
      const driver = join(createTempDir("a4-driver-"), "run-a4.ts");
      writeFileSync(
        driver,
        `
import { execSync as hostExecSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const items = ${JSON.stringify(items)};
const runCell = (env: Record<string, string | undefined>, repoDir: string, cellCode: string) => new Promise((resolveRun, rejectRun) => {
  let out = "";
  let agentSeq = 0;
  let revSeq = 10;
  const agentLabels = new Map<string, { label: string; prompt: string }>();
  const artifacts = new Map<string, Record<string, unknown>>(
    items.map((it) => [it.subjectId + ":" + it.kind + ":" + it.logicalName, it as unknown as Record<string, unknown>]),
  );
  let receipt: Record<string, unknown> | null = null;
  const wfReply = (val: unknown) => ({ ok: true, value: { content: [{ type: "text", text: JSON.stringify(val) }], details: val } });

  const proc = Bun.spawn({
    cmd: ["omp", "__omp_worker_js_eval_process"],
    env: { ...process.env, ...env },
    ipc(msg) {
      if (msg.type === "text") out += msg.chunk;
      if (msg.type === "tool-call") {
        if (msg.name === "__shell__") {
          try {
            const stdout = hostExecSync(msg.args.command, { cwd: msg.args.cwd || repoDir, env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
            proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { output: stdout, exitCode: 0 } } });
          } catch (err) {
            const e = err as { status?: number; stdout?: string; stderr?: string };
            proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { output: String(e.stderr || e.stdout || ""), exitCode: e.status ?? 1 } } });
          }
          return;
        }
        if (msg.name === "__agent__") {
          agentSeq += 1;
          const id = "a4-agent-" + agentSeq;
          agentLabels.set(id, { label: String(msg.args?.label ?? ""), prompt: String(msg.args?.prompt ?? "") });
          proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { id, agent: "task" } } });
          return;
        }
        if (msg.name === "__wait__") {
          const waitItems = Array.isArray(msg.args?.items) ? msg.args.items : [];
          const results = waitItems.map((entry: { id: string }) => {
            const meta = agentLabels.get(entry.id);
            const label = meta?.label ?? "";
            if (label.startsWith("b-build-hard")) {
              writeFileSync(join(repoDir, "src", "second.ts"), "export const second = 1;\\n");
              return { status: "completed", text: "## Acceptance evidence\\n- second criterion: verified\\n" };
            }
            if (label.startsWith("b-build")) {
              writeFileSync(join(repoDir, "src", "first.ts"), "export const first = 1;\\n");
              return { status: "completed", text: "## Acceptance evidence\\n- first criterion: verified\\n" };
            }
            if (label.startsWith("b-review")) {
              return { status: "completed", text: JSON.stringify({ verdict: "clean", criticalCount: 0, warningCount: 0, summary: "clean", findings: [], reportMarkdown: "# Review\\nClean.\\n" }) };
            }
            if (label.startsWith("b-save")) {
              revSeq += 1;
              const rev = "a4-mem-rev-" + revSeq;
              const memDir = join(repoDir, ".context", "memory");
              mkdirSync(memDir, { recursive: true });
              const memName = "a4-saved-" + revSeq + ".md";
              writeFileSync(join(memDir, memName), "# Saved\\n");
              const memItem = { token: "workflow-artifact:a4-mem-" + revSeq, revision: rev, sha256: "sha-" + rev, subjectId: "memory", kind: "memory", logicalName: memName, text: "# Saved\\n" };
              artifacts.set("memory:memory:" + memName, memItem);
              return { status: "completed", text: JSON.stringify({ summary: "saved", savedArtifacts: [{ subjectId: "memory", kind: "memory", logicalName: memName, revision: rev, token: memItem.token }] }) };
            }
            if (label.startsWith("b-commit")) {
              return { status: "completed", text: JSON.stringify({ title: "feat(a4): complete " + label, body: "Verified" }) };
            }
            return { status: "completed", text: "ok" };
          });
          proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { items: results } } });
          return;
        }
        if (msg.name === "__judge__") {
          const q = (msg.args?.questions && typeof msg.args.questions === "object") ? msg.args.questions : {};
          const answers = Object.fromEntries(Object.keys(q).map((k) => [k, { type: "bool", bool: 0.95 }]));
          proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: { answers, model: "a4-jev" } } });
          return;
        }
        if (msg.name === "workflow_state") {
          const op = msg.args?.operation;
          if (op === "list") {
            const list = [...artifacts.values()].filter((a) => !msg.args.subjectId || a.subjectId === msg.args.subjectId);
            proc.send({ type: "tool-reply", id: msg.id, reply: wfReply(list) });
            return;
          }
          if (op === "read") {
            const hit = msg.args?.token
              ? [...artifacts.values()].find((a) => a.token === msg.args.token)
              : artifacts.get(msg.args?.subjectId + ":" + msg.args?.kind + ":" + msg.args?.logicalName) ?? null;
            proc.send({ type: "tool-reply", id: msg.id, reply: wfReply(hit ?? null) });
            return;
          }
          if (op === "write") {
            revSeq += 1;
            const rev = "a4-rev-" + revSeq;
            const k = msg.args?.subjectId + ":" + msg.args?.kind + ":" + msg.args?.logicalName;
            const subDir = msg.args?.subjectId === "memory" ? join(repoDir, ".context", "memory") : join(repoDir, ".context", String(msg.args?.subjectId));
            mkdirSync(subDir, { recursive: true });
            writeFileSync(join(subDir, String(msg.args?.logicalName)), String(msg.args?.body ?? ""));
            const sha256 = createHash("sha256").update(String(msg.args?.body ?? ""), "utf8").digest("hex");
            const saved = { token: "workflow-artifact:" + rev, revision: rev, sha256, subjectId: msg.args?.subjectId, kind: msg.args?.kind, logicalName: msg.args?.logicalName, text: msg.args?.body };
            artifacts.set(k, saved);
            proc.send({ type: "tool-reply", id: msg.id, reply: wfReply(saved) });
            return;
          }
          if (op === "write-receipt") {
            receipt = { projectId: "a4", branchId: "b1", worktreeId: "wt1", runId: "a4-run", attemptId: msg.args?.attemptId, status: msg.args?.status, artifactRevisions: msg.args?.artifactRevisions ?? [] };
            proc.send({ type: "tool-reply", id: msg.id, reply: wfReply(receipt) });
            return;
          }
          if (op === "read-receipt") {
            proc.send({ type: "tool-reply", id: msg.id, reply: wfReply(receipt) });
            return;
          }
        }
        proc.send({ type: "tool-reply", id: msg.id, reply: { ok: true, value: {} } });
        return;
      }
      if (msg.type === "result") {
        clearTimeout(cellTimer);
        proc.kill();
        resolveRun({ ok: msg.ok, error: msg.error, out });
      }
    },
    serialization: "advanced",
  });
  proc.send({ type: "init", snapshot: { cwd: repoDir, sessionId: "a4" } });
  setTimeout(() => proc.send({ type: "run", runId: "r1", code: cellCode, filename: "entry.ts", snapshot: { cwd: repoDir, sessionId: "a4" } }), 150);
  const cellTimer = setTimeout(() => { proc.kill(); rejectRun(new Error("timeout")); }, 30_000);
});

const wrap = (code: string) => "const __res = await (async () => {" + code + "})(); console.log('RES=' + JSON.stringify(__res));";
const wrapNoBudget = (code: string) => "const budget = undefined; " + wrap(code);

const rPluginInvalid = await runCell({ HOME: ${JSON.stringify(isolatedHome)}, XDG_CONFIG_HOME: ${JSON.stringify(join(isolatedHome, ".config"))} }, ${JSON.stringify(fixtureRepo)}, wrap(${JSON.stringify(buildCell("--status"))}));
const rPluginValid = await runCell({ HOME: ${JSON.stringify(isolatedHome)}, XDG_CONFIG_HOME: ${JSON.stringify(join(isolatedHome, ".config"))} }, ${JSON.stringify(fixtureRepo)}, wrapNoBudget(${JSON.stringify(buildCell("2026-11-17.a4-fixture"))}));
const rConfigValid = await runCell({ HOME: ${JSON.stringify(cfgHome)}, XDG_CONFIG_HOME: ${JSON.stringify(join(cfgHome, ".config"))} }, ${JSON.stringify(cfgRepo)}, wrap(${JSON.stringify(buildCell("2026-11-17.a4-fixture"))}));
const rInject = await runCell({ HOME: ${JSON.stringify(isolatedHome)}, XDG_CONFIG_HOME: ${JSON.stringify(join(isolatedHome, ".config"))} }, ${JSON.stringify(fixtureRepo)}, wrap(${JSON.stringify(buildCell(injectionArg))}));
const rBadExplicit = await runCell({ HOME: ${JSON.stringify(isolatedHome)}, BUCK_LOOP_RUNNER: "/tmp/definitely-missing-runner.ts" }, ${JSON.stringify(fixtureRepo)}, wrap(${JSON.stringify(buildCell("2026-11-17.a4-fixture"))}));
console.log("ALL=" + JSON.stringify({ rPluginInvalid, rPluginValid, rConfigValid, rInject, rBadExplicit }));
`,
      );

      const raw = execSync(`bun ${JSON.stringify(driver)}`, { encoding: "utf8", timeout: 85_000 });
      const line = raw.split(/\r?\n/).find((l) => l.startsWith("ALL="));
      expect(line).toBeDefined();
      const summary = JSON.parse(line!.slice(4));

      const parseOut = (entry: { ok: boolean; out: string }) => {
        expect(entry.ok).toBe(true);
        const match = entry.out.match(/RES=(.+)/);
        expect(match).not.toBeNull();
        return JSON.parse(match![1]);
      };

      const invalid = parseOut(summary.rPluginInvalid);
      expect(invalid.ok).toBe(false);
      expect(invalid.state).toBe("blocked");

      const pinnedPlugin = parseOut(summary.rPluginValid);
      expect(pinnedPlugin.ok, JSON.stringify(pinnedPlugin)).toBe(true);
      expect(pinnedPlugin.subject).toBe("2026-11-17.a4-fixture");
      expect(pinnedPlugin.state).toBe("done");
      expect(Object.keys(pinnedPlugin.completedPhaseCommits ?? {})).toEqual(["phase-1-first.md", "phase-2-second.md"]);

      const pinnedCfg = parseOut(summary.rConfigValid);
      expect(pinnedCfg.ok, JSON.stringify(pinnedCfg)).toBe(true);
      expect(pinnedCfg.subject).toBe("2026-11-17.a4-fixture");
      expect(pinnedCfg.state).toBe("done");
      expect(Object.keys(pinnedCfg.completedPhaseCommits ?? {})).toEqual(["phase-1-first.md", "phase-2-second.md"]);

      const injected = parseOut(summary.rInject);
      expect(injected.ok).toBe(false);
      expect(injected.state).toBe("blocked");

      expect(summary.rBadExplicit.ok).toBe(false);
    },
  );
});
