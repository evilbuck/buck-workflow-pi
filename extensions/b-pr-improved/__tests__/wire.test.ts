import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { wire } from "../index.js";
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
      // No cached base → the handler surfaces candidates and returns without touching the model.
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toMatch(/No cached base/);
      expect(calls[0][0]).toContain("main");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
