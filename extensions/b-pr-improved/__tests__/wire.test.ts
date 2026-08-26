import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pushBranchIfAhead, wire } from "../index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Minimal mock: only the ExtensionAPI surface b-pr-improved touches (registerCommand).
function createMockApi(): { api: ExtensionAPI; commands: Map<string, Record<string, unknown>> } {
  const commands = new Map<string, Record<string, unknown>>();
  const api = {
    on: vi.fn(),
    registerCommand: vi.fn((name: string, opts: Record<string, unknown>) => {
      commands.set(name, opts);
    }),
    registerTool: vi.fn(),
  } as unknown as ExtensionAPI;
  return { api, commands };
}

describe("b-pr-improved wire", () => {
  it("registers the b-pr-improved command with a handler and description", () => {
    const { api, commands } = createMockApi();
    wire(api);
    expect(commands.has("b-pr-improved")).toBe(true);
    const cmd = commands.get("b-pr-improved") as { handler: Function; description?: string };
    expect(typeof cmd.handler).toBe("function");
    expect(cmd.description).toBeTruthy();
  });

  it("completes the known flags", () => {
    const { api, commands } = createMockApi();
    wire(api);
    const cmd = commands.get("b-pr-improved") as { getArgumentCompletions: (p: string) => Array<{ value: string }> };
    const completions = cmd.getArgumentCompletions("--");
    expect(completions.some((c) => c.value === "--draft")).toBe(true);
    expect(completions.some((c) => c.value === "--base")).toBe(true);
    expect(completions.some((c) => c.value === "--model")).toBe(true);
  });

  it("parseArgs-style behaviour: handler is async and accepts an args string", async () => {
    const { api, commands } = createMockApi();
    wire(api);
    const cmd = commands.get("b-pr-improved") as { handler: (args: string, ctx: unknown) => Promise<void> };
    // Invocation requires a real repo + gh + (for AI steps) a live model; covered by
    // the skill smoke tests. Here we only assert the handler shape is invokable.
    expect(cmd.handler.length).toBeLessThanOrEqual(2);
  });
});

// Build a throwaway git repo with a commit on `main` and a checked-out feature branch.
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "bpr-imp-"));
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  const g = (a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", env, stdio: ["pipe", "pipe", "pipe"] });
  g(["init", "-q", "-b", "main"]);
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "# test\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "init"]);
  g(["checkout", "-q", "-b", "feature/x"]);
  return dir;
}

describe("b-pr-improved deterministic plumbing", () => {
  it("cache-miss path shells out to preflight and reports candidates (no model/gh)", async () => {
    const dir = makeRepo();
    try {
      const { api, commands } = createMockApi();
      wire(api);
      const cmd = commands.get("b-pr-improved");
      if (!cmd || typeof cmd.handler !== "function") throw new Error("b-pr-improved not registered");
      const handler = cmd.handler as (args: string, ctx: unknown) => Promise<void>;
      const calls: Array<[string, string]> = [];
      await handler("", { cwd: dir, ui: { notify: (m: string, l: string) => calls.push([m, l]) } });
      expect(calls[0][0]).toMatch(/preflight/i);
      expect(calls.some(([m]) => /No cached base/.test(m))).toBe(true);
      expect(calls.some(([m]) => m.includes("main"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("pr-preflight dirty-tree rebase", () => {
  // Resolve the skill script the same way the extension does (repo-relative from this test file).
  const PREFLIGHT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills", "b-pr", "scripts", "pr-preflight.ts");

  function runPreflight(dir: string, args: string[]): { code: number; json: Record<string, unknown> | null; stderr: string } {
    try {
      const stdout = execFileSync("bun", [PREFLIGHT, ...args], {
        cwd: dir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { code: 0, json: JSON.parse(stdout) as Record<string, unknown>, stderr: "" };
    } catch (e: unknown) {
      const err = e as Error & { status?: number; stdout?: string; stderr?: string };
      const stdout = err.stdout?.toString() ?? "";
      let json: Record<string, unknown> | null = null;
      try {
        json = stdout.trim() ? (JSON.parse(stdout) as Record<string, unknown>) : null;
      } catch {
        json = null;
      }
      return { code: typeof err.status === "number" ? err.status : 1, json, stderr: err.stderr?.toString() ?? "" };
    }
  }

  it("rebases with unstaged tracked changes via --autostash and restores them", () => {
    const dir = makeRepo();
    const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
    const g = (a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", env, stdio: ["pipe", "pipe", "pipe"] });
    try {
      // Feature commit first.
      writeFileSync(join(dir, "feature.txt"), "feature\n");
      g(["add", "feature.txt"]);
      g(["commit", "-qm", "feature"]);

      // Advance main so feature is behind (the condition that triggers rebase).
      g(["checkout", "-q", "main"]);
      writeFileSync(join(dir, "base.txt"), "base advance\n");
      g(["add", "base.txt"]);
      g(["commit", "-qm", "base advance"]);
      g(["checkout", "-q", "feature/x"]);

      // Dirty tracked file — this used to make plain `git rebase` refuse and exit 1.
      writeFileSync(join(dir, "README.md"), "# test\nWIP local edit\n");

      const result = runPreflight(dir, ["--base", "main"]);
      expect(result.code).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json!.rebased).toBe(true);
      expect(result.json!.behind_count).toBe(0);
      expect(result.json!.chosen_base).toBe("main");

      // WIP must survive the autostash round-trip.
      const readme = readFileSync(join(dir, "README.md"), "utf-8");
      expect(readme).toContain("WIP local edit");
      // Feature tip should now sit on top of the advanced main (throws if not ancestor).
      expect(() => g(["merge-base", "--is-ancestor", "main", "HEAD"])).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("die() emits JSON on stdout so orchestrators can surface the message", () => {
    const dir = mkdtempSync(join(tmpdir(), "bpr-notgit-"));
    try {
      const result = runPreflight(dir, ["--base", "main"]);
      expect(result.code).toBe(1);
      expect(result.json).not.toBeNull();
      expect(String(result.json!.error)).toMatch(/git /);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("pushBranchIfAhead", () => {
  it("pushes only local commits and force-updates only after an explicit rebase", async () => {
    const dir = makeRepo();
    const origin = mkdtempSync(join(tmpdir(), "bpr-origin-"));
    const g = (a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    try {
      execFileSync("git", ["init", "-q", "--bare", origin]);
      g(["remote", "add", "origin", origin]);

      expect(await pushBranchIfAhead("feature/x", dir)).toBe(true);
      expect(g(["rev-parse", "HEAD"]).trim()).toBe(g(["rev-parse", "origin/feature/x"]).trim());
      expect(await pushBranchIfAhead("feature/x", dir)).toBe(false);

      writeFileSync(join(dir, "feature.txt"), "changed\n");
      g(["add", "feature.txt"]);
      g(["commit", "-qm", "feature"]);
      expect(await pushBranchIfAhead("feature/x", dir)).toBe(true);

      g(["commit", "--amend", "-qm", "feature rebased"]);
      await expect(pushBranchIfAhead("feature/x", dir)).rejects.toThrow(/refusing to overwrite/);
      expect(await pushBranchIfAhead("feature/x", dir, true)).toBe(true);
      expect(g(["rev-parse", "HEAD"]).trim()).toBe(g(["rev-parse", "origin/feature/x"]).trim());
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
    }
  });
});
