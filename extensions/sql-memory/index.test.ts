import { afterEach, describe, expect, it, vi } from "vitest";
import { sqlMemoryTool, wire } from "./index.js";
import type { MigrationPool } from "./migrations.js";

const pool: MigrationPool = {
  async query() { return { rows: [] }; },
  async connect() {
    return {
      async query(text) { return { rows: text.startsWith("SELECT") ? [{ id: "mem-1" }] : [] }; },
      release() {},
    };
  },
};

afterEach(() => { delete process.env.SQL_MEMORY_URL; });

  it("binds SQL values as data and enforces recall and save roles", async () => {
    const commands: Array<[string, unknown[] | undefined]> = [];
    const tool = sqlMemoryTool({
      async query() { return { rows: [] }; },
      async connect() {
        return {
          async query(text, values) { commands.push([text, values]); return { rows: text.startsWith("SELECT") ? [{ body: "quoted ' text" }] : [] }; },
          release() {},
        };
      },
    }, "recall");
    const result = await tool.execute("call", { op: "sql", statement: "SELECT body FROM memories WHERE body = $1", values: ["x' OR true --"] }, undefined, undefined, {} as never);
    expect(commands).toContainEqual(["SELECT body FROM memories WHERE body = $1", ["x' OR true --"]]);
    expect(commands).toContainEqual(["SET TRANSACTION READ ONLY", undefined]);
    expect(result.details).toMatchObject({ rows: [{ body: "quoted ' text" }] });
    const migration = await tool.execute("call", { op: "migrate" }, undefined, undefined, {} as never);
    expect(migration.details).toMatchObject({ error: true, message: expect.stringContaining("unavailable") });
  });

describe("sql_memory tool", () => {
  it("does not register without SQL_MEMORY_URL", () => {
    delete process.env.SQL_MEMORY_URL;
    const registerTool = vi.fn();
    wire({ registerTool } as never);
    expect(registerTool).not.toHaveBeenCalled();
  });

  it("registers only with SQL_MEMORY_URL and returns query rows", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    const registerTool = vi.fn();
    wire({ registerTool } as never, { pool });
    expect(registerTool).toHaveBeenCalledTimes(1);
    const tool = registerTool.mock.calls[0]![0];
    const result = await tool.execute("call", { op: "sql", statement: "SELECT id FROM memories" }, undefined, undefined, {} as never);
    if (result.content[0]!.type === "text") expect(result.content[0]!.text).toContain("mem-1");
  });

  it("returns clear gate errors without sending denied SQL to PostgreSQL", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const connect = vi.fn(async () => ({ query, release() {} }));
    const testPool: MigrationPool = { query, connect };
    const tool = sqlMemoryTool(testPool);
    const result = await tool.execute("call", { op: "sql", statement: "DELETE FROM memories" }, undefined, undefined, {} as never);
    expect(result.content[0]!.type).toBe("text");
    if (result.content[0]!.type === "text") expect(result.content[0]!.text).toContain("DELETE");
    expect(connect).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("pins the SQL session and releases it after a permitted query", async () => {
    const commands: string[] = [];
    const release = vi.fn();
    const tool = sqlMemoryTool({
      async query() { throw new Error("must use scoped client"); },
      async connect() {
        return { async query(text) {
          commands.push(text);
          return { rows: text.startsWith("SELECT") ? [{ id: 7 }] : [] };
        }, release };
      },
    });
    const result = await tool.execute("call", { op: "sql", statement: "SELECT id FROM memories" }, undefined, undefined, {} as never);
    expect(result.details).toEqual({ rows: [{ id: 7 }], rowCount: 1 });
    expect(commands).toEqual(["BEGIN", "SET LOCAL search_path = public", "SET LOCAL standard_conforming_strings = on", "SELECT id FROM memories", "COMMIT"]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("reports affected rows for an UPDATE without RETURNING", async () => {
    const tool = sqlMemoryTool({
      async query() { return { rows: [] }; },
      async connect() {
        return {
          async query(text) {
            return text.startsWith("UPDATE") ? { rows: [], rowCount: 1 } : { rows: [] };
          },
          release() {},
        };
      },
    });
    const result = await tool.execute("call", {
      op: "sql", statement: "UPDATE memories SET invalid_at = now() WHERE id = '00000000-0000-0000-0000-000000000001'",
    }, undefined, undefined, {} as never);
    expect(result.details).toEqual({ rows: [], rowCount: 1 });
  });

  it("allows save-stage user identity writes but rejects skill-weight changes before connecting", async () => {
    const commands: string[] = [];
    const connect = vi.fn(async () => ({
      async query(text: string) { commands.push(text); return { rows: [], rowCount: 1 }; },
      release() {},
    }));
    const tool = sqlMemoryTool({ async query() { return { rows: [] }; }, connect }, "save");
    const identity = await tool.execute("call", {
      op: "sql", statement: "INSERT INTO public.users (email) VALUES ($1)", values: ["a@example.test"],
    }, undefined, undefined, {} as never);
    expect(identity.details).toEqual({ rows: [], rowCount: 1 });
    expect(commands).toContain("INSERT INTO public.users (email) VALUES ($1)");

    const denied = await tool.execute("call", {
      op: "sql", statement: "UPDATE users SET skill_weight = 100 WHERE email = $1", values: ["a@example.test"],
    }, undefined, undefined, {} as never);
    expect(denied.details).toMatchObject({ error: true, message: expect.stringContaining("skill_weight") });
    expect(connect).toHaveBeenCalledOnce();
  });
});
