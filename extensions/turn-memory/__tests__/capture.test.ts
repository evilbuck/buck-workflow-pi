import { describe, expect, it, vi } from "vitest";
import { captureTurnMemory } from "../capture.js";

const window = { id: "session:1:2:3", text: "User: choose SQL" };

function yesJudge(noul = 0.91) {
  return async () => ({ ok: true, result: { answers: { durable: { type: "noul", noul } } } });
}

describe("captureTurnMemory", () => {
  it("persists consumption before saving one durable fact", async () => {
    const order: string[] = [];
    const remember = vi.fn(async () => {
      order.push("remember");
      return "mem-1";
    });

    const result = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => {
          order.push("persist");
        },
        judge: async () => {
          order.push("judge");
          return { ok: true, result: { answers: { durable: { type: "noul", noul: 0.91 } } } };
        },
        extract: async () => {
          order.push("extract");
          return "Store decisions in SQL.";
        },
        remember,
      },
    );

    expect(order).toEqual(["persist", "judge", "extract", "remember"]);
    expect(result).toEqual({ savedId: "mem-1" });
    expect(remember).toHaveBeenCalledWith({
      cwd: "/repo",
      body: "Store decisions in SQL.",
      subject: "turn-memory",
      phase: "session:1:2:3",
      category: "project",
    });
  });

  it("does not judge or write again when the window was already consumed", async () => {
    const consumed: Record<string, true> = {};
    const judge = vi.fn(yesJudge());
    const remember = vi.fn(async () => "mem-1");
    const deps = {
      isConsumed: (id: string) => consumed[id] === true,
      persistConsumed: (id: string) => {
        consumed[id] = true;
      },
      judge,
      extract: async () => "Store decisions in SQL.",
      remember,
    };

    await captureTurnMemory({ window, cwd: "/repo" }, deps);
    const replay = await captureTurnMemory({ window, cwd: "/repo" }, deps);

    expect(replay).toEqual({ savedId: null });
    expect(judge).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledTimes(1);
  });

  it("does not extract or remember when Jev is below 0.70", async () => {
    const extract = vi.fn(async () => "Store decisions in SQL.");
    const remember = vi.fn(async () => "mem-1");

    const result = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: yesJudge(0.69),
        extract,
        remember,
      },
    );

    expect(result).toEqual({ savedId: null });
    expect(extract).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
  });

  it("does not escape or remember when judgment or extraction fails", async () => {
    const remember = vi.fn(async () => "mem-1");
    const thrown = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: async () => {
          throw new Error("jev down");
        },
        extract: async () => "Store decisions in SQL.",
        remember,
      },
    );
    const hung = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: yesJudge(),
        extract: () => new Promise(() => undefined),
        remember,
        deadlines: { extractMs: 20 },
      },
    );

    expect(thrown).toEqual({ savedId: null });
    expect(hung).toEqual({ savedId: null });
    expect(remember).not.toHaveBeenCalled();
  });

  it("skips empty, multi-sentence, and secret-bearing extractions", async () => {
    const remember = vi.fn(async () => "mem-1");
    for (const body of ["", "Use SQL.\n\nAlso cache.", "Use SQL. Also cache.", "Authorization: Bearer abcdef", "SQL_MEMORY_URL=[REDACTED]"]) {
      await captureTurnMemory(
        { window, cwd: "/repo" },
        {
          isConsumed: () => false,
          persistConsumed: () => undefined,
          judge: yesJudge(),
          extract: async () => body,
          remember,
        },
      );
    }
    expect(remember).not.toHaveBeenCalled();
  });

  it("catches a thrown writer and still returns no id", async () => {
    const result = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: yesJudge(),
        extract: async () => "Store decisions in SQL.",
        remember: async () => {
          throw new Error("sql down");
        },
      },
    );
    expect(result).toEqual({ savedId: null });
  });

  it("saves at 0.70 and skips an unavailable or incomplete judgment", async () => {
    const saved = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: yesJudge(0.7),
        extract: async () => "Store decisions in SQL.",
        remember: async () => "mem-boundary",
      },
    );
    const extract = vi.fn(async () => "Store decisions in SQL.");
    const unavailable = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: async () => ({ ok: false, failure: { code: "provider_unavailable" } }),
        extract,
        remember: async () => "mem-no",
      },
    );
    expect(saved).toEqual({ savedId: "mem-boundary" });
    expect(unavailable).toEqual({ savedId: null });
    expect(extract).not.toHaveBeenCalled();
  });

  it("does not judge after a failed consumed-marker write and does not escape a hung writer", async () => {
    const judge = vi.fn(yesJudge());
    const missed = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => {
          throw new Error("session write failed");
        },
        judge,
        extract: async () => "Store decisions in SQL.",
        remember: async () => "mem-1",
      },
    );
    const hung = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: yesJudge(),
        extract: async () => "Store decisions in SQL.",
        remember: () => new Promise(() => undefined),
        deadlines: { rememberMs: 20 },
      },
    );
    expect(missed).toEqual({ savedId: null });
    expect(judge).not.toHaveBeenCalled();
    expect(hung).toEqual({ savedId: null });
  });

  it("rejects non-finite scores and keeps one technical sentence", async () => {
    const remember = vi.fn(async () => "mem-tech");
    for (const noul of [Number.NaN, Number.POSITIVE_INFINITY, 1.1, -0.1]) {
      await captureTurnMemory(
        { window, cwd: "/repo" },
        {
          isConsumed: () => false,
          persistConsumed: () => undefined,
          judge: yesJudge(noul),
          extract: async () => "Store decisions in SQL.",
          remember,
        },
      );
    }
    const saved = await captureTurnMemory(
      { window, cwd: "/repo" },
      {
        isConsumed: () => false,
        persistConsumed: () => undefined,
        judge: yesJudge(0.8),
        extract: async () => "Use Node.js 22.1 for scripts.",
        remember,
      },
    );
    expect(saved).toEqual({ savedId: "mem-tech" });
    expect(remember).toHaveBeenCalledTimes(1);
  });
});
