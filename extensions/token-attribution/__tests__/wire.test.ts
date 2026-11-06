import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { wire } from "../index.js";
import type { GitRunner } from "../git-identity.js";
import { fixture, openLedger } from "./fixtures.js";
import { SQLiteStorageStore } from "../../../skills/_shared/storage/sqlite-store.js";

function gitRunner(onCall?: (args: readonly string[]) => void): GitRunner {
  return async (args, cwd) => {
    onCall?.(args);
    const outputs: Record<string, string> = {
      "rev-parse --show-toplevel": `${cwd}\n`, "rev-parse --git-common-dir": `${cwd}/.git\n`,
      "remote get-url origin": "git@example.test:repo.git\n", "rev-parse --abbrev-ref HEAD": "feature/live\n",
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
    on(event: string, handler: Function) { handlers.set(event, [...(handlers.get(event) ?? []), handler]); },
    getCommands,
    registerCommand(name: string, command: { description: string; handler: Function }) { commands.set(name, command); },
    appendEntry,
  } as unknown as ExtensionAPI;
  const startSession = async () => {
    runtimeActive = true;
    await handlers.get("session_start")![0]({}, { sessionManager: { getEntries: () => [] } });
  };
  return { api, handlers, commands, appendEntry, getCommands, startSession };
}

function context(root: string) {
  const sessionFile = join(root, "session-1.jsonl");
  writeFileSync(sessionFile, "");
  return {
    cwd: root, sessionManager: { getSessionFile: () => sessionFile }, ui: { notify: vi.fn() },
  };
}

const event = {
  message: {
    role: "assistant", provider: "openai", model: "gpt-5", api: "openai-responses", timestamp: 1_758_624_000_000,
    usage: { input: 20, output: 10, cacheRead: 2, cacheWrite: 0, totalTokens: 32, cost: { total: 0.005 } },
  },
};

describe("token attribution wire", () => {
  it("records a durable live turn and reports through /tokens without relying on the local export", async () => {
    const { root, projection } = fixture();
    const { api, handlers, commands, appendEntry, startSession } = harness();
    wire(api, { databasePath: projection, gitRunner: gitRunner() });
    await startSession();
    const ctx = context(root);
    await handlers.get("message_end")![0](event, ctx);
    const local = new DatabaseSync(projection);
    local.exec("DELETE FROM buck_token_attribution");
    local.close();
    await commands.get("tokens")!.handler("", ctx);
    expect(appendEntry).toHaveBeenCalledWith("buck.token-attribution.identity", expect.objectContaining({ branch: "feature/live" }));
    expect(ctx.ui.notify).toHaveBeenLastCalledWith(expect.stringContaining("32 tokens"), "info");
    expect((await openLedger().records(root)).map((row) => [row.branch, row.totalTokens])).toEqual([["feature/live", 32]]);
    await handlers.get("session_shutdown")![0]({}, ctx);
  });

  it("registers /token-use after session start when /tokens is already present", async () => {
    fixture();
    const { api, commands, startSession } = harness(["tokens"]);
    wire(api, { gitRunner: gitRunner() });
    expect(commands.size).toBe(0);
    await startSession();
    expect([...commands.keys()]).toEqual(["token-use"]);
    expect(commands.get("token-use")!.description).toContain("because /tokens already exists");
  });

  it("reuses identity across message_end and agent_end while HEAD is unchanged", async () => {
    const { root } = fixture();
    const calls: string[] = [];
    const { api, handlers, startSession } = harness();
    wire(api, { gitRunner: gitRunner((args) => calls.push(args.join(" "))) });
    await startSession();
    const ctx = context(root);
    await handlers.get("message_end")![0](event, ctx);
    await handlers.get("agent_end")![0]({}, ctx);
    expect(calls.filter((call) => call === "rev-parse --show-toplevel")).toHaveLength(1);
    expect(calls.filter((call) => call === "rev-parse --abbrev-ref HEAD")).toHaveLength(2);
    await handlers.get("session_shutdown")![0]({}, ctx);
  });

  it("warns without breaking the response and repairs the duplicate after failed retention", async () => {
    const { root } = fixture();
    const { api, handlers, startSession } = harness();
    wire(api, { gitRunner: gitRunner() });
    await startSession();
    const ctx = context(root);
    vi.spyOn(SQLiteStorageStore.prototype, "writeReceipt").mockRejectedValueOnce(new Error("retain unavailable"));
    await handlers.get("message_end")![0](event, ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith("Token attribution persistence failed: retain unavailable", "warning");
    await handlers.get("message_end")![0](event, ctx);
    // The explicit event drain preserves the earlier failure, rather than silently
    // clearing it when the repeated row repairs the receipt.
    expect((await openLedger().records(root)).map((row) => row.totalTokens)).toEqual([32]);
    await handlers.get("session_shutdown")![0]({}, ctx);
  });

  it("observes pending retention failure during shutdown", async () => {
    const { root } = fixture();
    const { api, handlers, startSession } = harness();
    wire(api, { gitRunner: gitRunner() });
    await startSession();
    const ctx = context(root);
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    vi.spyOn(SQLiteStorageStore.prototype, "writeReceipt").mockImplementationOnce(async () => {
      entered();
      await gate;
      throw new Error("shutdown retain fault");
    });
    const message = handlers.get("message_end")![0](event, ctx);
    await started;
    let shutdownFinished = false;
    const shutdown = handlers.get("session_shutdown")![0]({}, ctx).then(() => { shutdownFinished = true; });
    await Promise.resolve();
    expect(shutdownFinished).toBe(false);
    release();
    await Promise.all([message, shutdown]);
    expect(ctx.ui.notify.mock.calls.filter(([text]) => text === "Token attribution persistence failed: shutdown retain fault")).toHaveLength(2);
  });
});
