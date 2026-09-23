import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { wire } from "../index.js";
import type { GitRunner } from "../git-identity.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function gitRunner(onCall?: (args: readonly string[]) => void): GitRunner {
  return async (args) => {
    onCall?.(args);
    const outputs: Record<string, string> = {
      "rev-parse --show-toplevel": "/repo/worktree\n",
      "rev-parse --git-common-dir": "/repo/.git\n",
      "remote get-url origin": "git@example.test:repo.git\n",
      "rev-parse --abbrev-ref HEAD": "feature/live\n",
    };
    const output = outputs[args.join(" ")];
    if (!output) throw new Error("unexpected git command");
    return output;
  };
}

function harness(existingCommands: string[] = []) {
  const handlers = new Map<string, Function[]>();
  const commands = new Map<string, { description: string; handler: Function }>();
  const appendEntry = vi.fn();
  let runtimeActive = false;
  const getCommands = vi.fn(() => {
    if (!runtimeActive) throw new Error("Extension runtime not initialized");
    return existingCommands.map((name) => ({ name }));
  });
  const api = {
    on(event: string, handler: Function) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    getCommands,
    registerCommand(name: string, command: { description: string; handler: Function }) {
      commands.set(name, command);
    },
    appendEntry,
  } as unknown as ExtensionAPI;
  const startSession = async () => {
    runtimeActive = true;
    await handlers.get("session_start")![0]({}, { sessionManager: { getEntries: () => [] } });
  };
  return { api, handlers, commands, appendEntry, getCommands, startSession };
}

describe("token attribution wire", () => {
  it("records a live assistant turn and reports it through /tokens", async () => {
    const root = mkdtempSync(join(tmpdir(), "token-wire-"));
    roots.push(root);
    const sessionFile = join(root, "session-1.jsonl");
    writeFileSync(sessionFile, "");
    const dbPath = join(root, "stats.db");
    const { api, handlers, commands, appendEntry, getCommands, startSession } = harness();
    expect(() => wire(api, { databasePath: dbPath, gitRunner: gitRunner() })).not.toThrow();
    expect(getCommands).not.toHaveBeenCalled();
    await startSession();
    const notices: string[] = [];
    const ctx = {
      cwd: "/repo/worktree",
      sessionManager: { getSessionFile: () => sessionFile },
      ui: { notify: (message: string) => notices.push(message) },
    };

    const event = {
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt-5",
        api: "openai-responses",
        timestamp: 1_758_624_000_000,
        usage: { input: 20, output: 10, cacheRead: 2, cacheWrite: 0, totalTokens: 32, cost: { total: 0.005 } },
      },
    };
    await handlers.get("message_end")![0](event, ctx);
    await commands.get("tokens")!.handler("", ctx);

    const inspect = new DatabaseSync(dbPath, { readOnly: true });
    expect(inspect.prepare("SELECT project_key, branch, total_tokens FROM attribution").get()).toEqual({
      project_key: "git@example.test:repo.git",
      branch: "feature/live",
      total_tokens: 32,
    });
    inspect.close();
    expect(appendEntry).toHaveBeenCalledOnce();
    expect(appendEntry).toHaveBeenCalledWith("buck.token-attribution.identity", expect.objectContaining({ branch: "feature/live" }));
    expect(notices.at(-1)).toContain("32 tokens");
    expect(getCommands).toHaveBeenCalledOnce();
  });

  it("registers /token-use after session start when /tokens is already present", async () => {
    const { api, commands, startSession } = harness(["tokens"]);
    wire(api, { databasePath: ":memory:", gitRunner: gitRunner() });
    expect(commands.size).toBe(0);
    await startSession();
    expect([...commands.keys()]).toEqual(["token-use"]);
    expect(commands.get("token-use")!.description).toContain("because /tokens already exists");
  });

  it("reuses identity across message_end and agent_end while HEAD is unchanged", async () => {
    const root = mkdtempSync(join(tmpdir(), "token-wire-cache-"));
    roots.push(root);
    const sessionFile = join(root, "session-1.jsonl");
    writeFileSync(sessionFile, "");
    const calls: string[] = [];
    const { api, handlers, startSession } = harness();
    wire(api, {
      databasePath: join(root, "stats.db"),
      gitRunner: gitRunner((args) => calls.push(args.join(" "))),
    });
    await startSession();
    const ctx = {
      cwd: "/repo/worktree",
      sessionManager: { getSessionFile: () => sessionFile },
      ui: { notify: vi.fn() },
    };
    await handlers.get("message_end")![0]({
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt-5",
        timestamp: 1_758_624_000_000,
        usage: { totalTokens: 1 },
      },
    }, ctx);
    await handlers.get("agent_end")![0]({}, ctx);

    expect(calls.filter((call) => call === "rev-parse --show-toplevel")).toHaveLength(1);
    expect(calls.filter((call) => call === "rev-parse --abbrev-ref HEAD")).toHaveLength(2);
  });
});
