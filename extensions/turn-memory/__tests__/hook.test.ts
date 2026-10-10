import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTurnMemoryHook, resetTurnMemoryPool, turnMemoryPool, turnMemoryStatus } from "../../../hooks/post/turn-memory.js";

const require = createRequire(import.meta.url);
const originalUrl = process.env.SQL_MEMORY_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.SQL_MEMORY_URL;
  else process.env.SQL_MEMORY_URL = originalUrl;
});

function message(role: "user" | "assistant", text: string, timestamp: number) {
  return { role, content: text, timestamp };
}

function session() {
  const entries: unknown[] = [];
  const handlers = new Map<string, Function>();
  const notify = vi.fn();
  const sendUserMessage = vi.fn();
  const sendMessage = vi.fn();
  const pi = {
    on: (event: string, handler: Function) => handlers.set(event, handler),
    appendEntry: (customType: string, data: unknown) => {
      entries.push({ type: "custom", customType, data });
    },
    sendUserMessage,
    sendMessage,
  };
  const ctx = {
    cwd: "/repo",
    hasUI: true,
    ui: { notify },
    sessionManager: {
      getEntries: () => entries,
      getSessionFile: () => "/tmp/session.jsonl",
    },
  };
  return { entries, handlers, notify, sendUserMessage, sendMessage, pi, ctx };
}

describe("turn-memory hook", () => {
  it("names the off reason and does not load pg when SQL is unset", async () => {
    delete process.env.SQL_MEMORY_URL;
    const before = new Set(Object.keys(require.cache));
    const hook = await import("../../../hooks/post/turn-memory.js");
    const added = Object.keys(require.cache).filter((key) => !before.has(key) && /\/pg\//.test(key));
    expect(added).toEqual([]);
    expect(turnMemoryStatus("/repo", {})).toBe("turn-memory: off (no SQL_MEMORY_URL)");
    expect(typeof hook.default).toBe("function");
  });

  it("observes only session start and agent end, and does not start a turn", async () => {
    process.env.SQL_MEMORY_URL = "postgres://db";
    const remember = vi.fn(async () => "mem-1");
    const { handlers, notify, sendUserMessage, sendMessage, pi, ctx } = session();
    createTurnMemoryHook({
      judge: async () => ({ ok: true, result: { answers: { durable: { type: "noul", noul: 0.91 } } } }),
      extract: async () => "Store decisions in SQL.",
      remember,
      home: "/empty-home",
    })(pi as never);

    expect([...handlers.keys()].sort()).toEqual(["agent_end", "session_start"]);
    await handlers.get("session_start")?.({}, ctx);
    expect(notify).toHaveBeenCalledWith("turn-memory: on", "info");

    await handlers.get("agent_end")?.({ willContinue: true, messages: [message("user", "skip", 1)] }, ctx);
    await handlers.get("agent_end")?.({ messages: [message("user", "one", 1), message("assistant", "a", 2)] }, ctx);
    await handlers.get("agent_end")?.({ messages: [message("user", "two", 3), message("assistant", "b", 4)] }, ctx);
    expect(remember).not.toHaveBeenCalled();
    await handlers.get("agent_end")?.({ messages: [message("user", "three", 5), message("assistant", "c", 6)] }, ctx);

    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith(expect.objectContaining({
      cwd: "/repo",
      subject: "turn-memory",
      category: "project",
      body: "Store decisions in SQL.",
    }));
    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("turn-memory: mem-1", "info");
  });

  it("does not remember across three prompts when opted out", async () => {
    process.env.SQL_MEMORY_URL = "postgres://db";
    process.env.BUCK_TURN_MEMORY = "0";
    const remember = vi.fn(async () => "mem-1");
    const { handlers, notify, pi, ctx } = session();
    createTurnMemoryHook({
      judge: async () => ({ ok: true, result: { answers: { durable: { type: "noul", noul: 0.91 } } } }),
      extract: async () => "Store decisions in SQL.",
      remember,
      home: "/empty-home",
    })(pi as never);
    await handlers.get("session_start")?.({}, ctx);
    for (const [text, timestamp] of [["one", 1], ["two", 2], ["three", 3]] as const) {
      await handlers.get("agent_end")?.({ messages: [message("user", text, timestamp), message("assistant", "noted", timestamp)] }, ctx);
    }
    expect(notify).toHaveBeenCalledWith("turn-memory: off (opt-out)", "info");
    expect(remember).not.toHaveBeenCalled();
    delete process.env.BUCK_TURN_MEMORY;
  });

  it("publishes hooks once and does not register a second copy", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { files: string[] };
    const files = readdirSync("hooks/post").filter((name) => name.endsWith(".ts") || name.endsWith(".js"));
    const index = readFileSync("extensions/index.ts", "utf8");
    expect(pkg.files).toContain("hooks");
    expect(files).toEqual(["turn-memory.ts"]);
    expect(index).not.toContain("turn-memory");
  });
});

describe("turnMemoryPool", () => {
  it("reuses one lazy getter for the same URL", () => {
    resetTurnMemoryPool();
    const create = vi.fn((url: string) => {
      const pool = { url };
      return () => pool;
    });
    const first = turnMemoryPool("postgres://one", create);
    const second = turnMemoryPool("postgres://one", create);
    expect(create).toHaveBeenCalledTimes(1);
    expect(first()).toBe(second());
    turnMemoryPool("postgres://two", create);
    expect(create).toHaveBeenCalledTimes(2);
    resetTurnMemoryPool();
  });
});
