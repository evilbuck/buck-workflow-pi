import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { wire, parseArgs, reviewExecTool } from "../index.js";
import { loadCatalog } from "../catalog.js";
import { loadPersonas } from "../prompts.js";
import { parseExecPolicy, readOnlyGitCommands, checkContractCommands } from "../policy.js";
import { runtimeRoot, branchKey } from "../run-state.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const HERE = dirname(fileURLToPath(import.meta.url));

function createMockApi(): { api: ExtensionAPI; commands: Map<string, Record<string, unknown>> } {
  const commands = new Map<string, Record<string, unknown>>();
  const api = {
    registerCommand: (name: string, options: Record<string, unknown>) => {
      commands.set(name, options);
    },
    on: () => ({ action: "continue" as const }),
  } as unknown as ExtensionAPI;
  return { api, commands };
}

function handlerNotifications(args: string, cwd: string): Promise<string[]> {
  const notifications: string[] = [];
  const { api, commands } = createMockApi();
  wire(api);
  const handler = commands.get("code-review")!.handler as (a: string, ctx: unknown) => Promise<void>;
  return handler(args, { cwd, ui: { notify: (m: string) => notifications.push(m) } })
    .then(() => notifications, () => notifications);
}


describe("code-review wire", () => {
  it("registers the code-review command with completions and an async handler", () => {
    const { api, commands } = createMockApi();
    wire(api);
    expect(commands.has("code-review")).toBe(true);
    const registered = commands.get("code-review")!;
    expect(typeof registered.handler).toBe("function");
    const completionSource = registered.getArgumentCompletions as (prefix: string) => Array<{ value: string }>;
    expect(completionSource("--fixer").map((c) => c.value)).toEqual(["--fixer-model", "--fixer-role"]);
    expect(completionSource("--prune").map((c) => c.value)).toEqual(["--prune"]);
    expect(completionSource("--zzz")).toEqual([]);
  });

  it("handler rejects invalid flags without touching the repo", async () => {
    const { api, commands } = createMockApi();
    wire(api);
    const notifications: string[] = [];
    await (commands.get("code-review")!.handler as (args: string, ctx: unknown) => Promise<void>)(
      "--max-passes twelve",
      { cwd: HERE, ui: { notify: (m: string) => notifications.push(m) } },
    );
    expect(notifications.join("\n")).toMatch(/Invalid arguments.*max-passes/);
  });

  it("review_exec tool delegates to onCommand and does not invent evidence ids", async () => {
    const onCommand = async () => ({
      command_id: "git-status",
      evidence_id: "c1",
      argv: ["git", "status"],
      cwd: ".",
      started_at: "t0",
      ended_at: "t1",
      duration_ms: 1,
      exit_code: 0,
      signal: null,
      timed_out: false,
      stdout_excerpt: "",
      stderr_excerpt: "",
      stdout_sha256: "",
      stderr_sha256: "",
      stdout_truncated: false,
      stderr_truncated: false,
      denied_reason: null,
      network_exposed: true,
    });
    const tool = reviewExecTool(onCommand);
    const result = await tool.execute!("call-1", { id: "git-status", argv: ["git", "status"] });
    const payload = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(payload.evidence_id).toBe("c1");
    expect(payload.command_id).toBe("git-status");
  });
});

describe("handler-level command runs", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("prunes only terminated runs and refuses while one is still running", async () => {
    const repo = mkdtempSync(join(tmpdir(), "wire-prune-"));
    cleanup.push(repo);
    const git = (args: string[]): string =>
      execFileSync("git", args, { cwd: repo, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    git(["init", "-q", "-b", "master", "."]);
    git(["config", "user.email", "t@t"]);
    git(["config", "user.name", "t"]);
    writeFileSync(join(repo, "a.txt"), "a\n");
    git(["add", "-A"]);
    git(["commit", "-qm", "init"]);
    const runs = join(runtimeRoot(join(repo, ".git")), branchKey("master"));
    mkdirSync(join(runs, "20260916T000000-done"), { recursive: true });
    writeFileSync(join(runs, "20260916T000000-done", "state.json"), JSON.stringify({ schema_version: 1, status: "clean" }));
    mkdirSync(join(runs, "20260916T000001-live"), { recursive: true });
    writeFileSync(join(runs, "20260916T000001-live", "state.json"), JSON.stringify({ schema_version: 1, status: "running" }));
    const refused = await handlerNotifications("--prune", repo);
    expect(refused.join("\n")).toMatch(/Refusing to prune 1 running/);
    writeFileSync(join(runs, "20260916T000001-live", "state.json"), JSON.stringify({ schema_version: 1, status: "clean" }));
    const pruned = await handlerNotifications("--prune", repo);
    expect(pruned.join("\n")).toMatch(/Pruned 2 code-review runtime artifact/);
  });

  it("runs the wired loop end to end far enough to fail outside a git checkout", async () => {
    const nowhere = mkdtempSync(join(tmpdir(), "wire-nowhere-"));
    cleanup.push(nowhere);
    const notifications = await handlerNotifications("--persona balanced", nowhere);
    const text = notifications.join("\n");
    expect(text).toMatch(/Reviewer: /);
    expect(text).toMatch(/non-bare git checkout/);
    expect(text).toMatch(/Review loop ended failed/);
  });
});

describe("parseArgs", () => {
  it("parses every flag with = and space forms", () => {
    const parsed = parseArgs("--base main --persona security --reviewer-temperature=0.4 --min-blocking high --max-passes 5 --no-resume --prune");
    expect(parsed.base).toBe("main");
    expect(parsed.persona).toBe("security");
    expect(parsed.reviewerTemperature).toBe(0.4);
    expect(parsed.minBlocking).toBe("high");
    expect(parsed.maxPasses).toBe(5);
    expect(parsed.resume).toBe(false);
    expect(parsed.prune).toBe(true);
    expect(() => parseArgs("--context @/nonexistent")).toThrow(/cannot read/);
  });

  it("applies the documented defaults", () => {
    const parsed = parseArgs("");
    expect(parsed.minBlocking).toBe("medium");
    expect(parsed.maxPasses).toBe(3);
    expect(parsed.resume).toBe(true);
    expect(parsed.prune).toBe(false);
    expect(parsed.reviewerModel).toBeUndefined();
  });

  it("rejects out-of-range temperatures and blocking tiers", () => {
    expect(() => parseArgs("--reviewer-temperature 9")).toThrow(/temperature/);
    expect(() => parseArgs("--min-blocking low")).toThrow(/min-blocking/);
    expect(() => parseArgs("--max-passes 0")).toThrow(/max-passes/);
  });
});

describe("seeded extension-owned markdown", () => {
  it("ships a valid model catalog with the calibrated tiers", () => {
    const result = loadCatalog(join(HERE, "..", "models"));
    expect(result.errors).toEqual([]);
    const byCapability = new Map(result.entries.map((e) => [e.selector, e.fixerCapability]));
    expect(byCapability.get("zai/glm-5.3")).toBe("hard");
    expect(byCapability.get("openai-codex/gpt-5.6-sol")).toBe("hard");
    expect(byCapability.get("xai-oauth/grok-4.6")).toBe("hard");
    expect(byCapability.get("anthropic/claude-opus-5")).toBe("hard");
    expect(byCapability.get("opencode-go/kimi-k3")).toBe("hard");
    expect(byCapability.get("openai-codex/gpt-5.6-terra")).toBe("medium");
    expect(byCapability.get("anthropic/claude-sonnet-5")).toBe("medium");
    expect(byCapability.get("zai/glm-5.3-flash")).toBe("medium");
    expect(byCapability.get("meta/muse-spark-1.3")).toBe("medium");
    expect(byCapability.get("opencode-go/qwen3.7-plus")).toBe("medium");
    expect(byCapability.get("openai-codex/gpt-5.6-luna")).toBe("easy");
    expect(byCapability.get("minimax-code/MiniMax-M3")).toBe("easy");
    // provider alternates share families at lower priority
    const alternates = result.entries.filter((e) => e.selector === "opencode-go/grok-4.6" || e.selector === "opencode-go/glm-5.3");
    expect(alternates).toHaveLength(2);
    expect(alternates.every((e) => e.priority > 200)).toBe(true);
  });

  it("ships the balanced persona plus four styles and five neutral launchers", () => {
    const { personas, errors } = loadPersonas(join(HERE, "..", "personas"));
    expect(errors).toEqual([]);
    for (const name of ["balanced", "correctness", "security", "performance", "zai-glm-5.3", "openai-codex-gpt-5.6-terra", "anthropic-claude-sonnet-5", "xai-oauth-grok-4.6", "opencode-go-kimi-k3"]) {
      expect(personas.has(name)).toBe(true);
    }
    for (const persona of personas.values()) {
      expect(persona.defaultTemperature).toBe(0.2);
    }
  });

  it("ships a parseable exec policy and reviewer guidance", () => {
    const policy = parseExecPolicy(readFileSync(join(HERE, "..", "review-exec-policy.md"), "utf-8"));
    expect(policy.allowNetwork).toBe(true);
    expect(policy.commands).toEqual([]);
    // effective runtime policy layers builtins + check contract on top
    const { entries } = checkContractCommands(["npm test", "sh -c 'evil'"]);
    expect(entries).toHaveLength(1);
    const ids = [...policy.commands, ...readOnlyGitCommands(), ...entries].map((c) => c.id);
    expect(ids).toContain("git-status");
    expect(ids).toContain("check-npm-test");
    const guidance = readFileSync(join(HERE, "..", "prompts", "reviewer.md"), "utf-8");
    expect(guidance).toMatch(/non-prescriptive/i);
  });
});
