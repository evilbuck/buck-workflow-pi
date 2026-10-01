import { afterEach, describe, expect, it, vi } from "vitest";
import { createLazyPool } from "./db.js";
import { correctSqlMemory, sqlMemoryRows, sqlMemorySaveTransaction, sqlMemoryTool, wire } from "./index.js";
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

describe("supervisor SQL activity", () => {
  const statement = "INSERT INTO memories (body, category) VALUES ($1, $2) RETURNING id";

  it("reports committed writes and stays silent without a sink", async () => {
    const sink = vi.fn();
    await sqlMemoryRows(pool, statement, ["settled choice", "decision"], "save", sink);
    expect(sink.mock.calls.map(([event]) => event)).toEqual([
      { kind: "toolEnd", tool: "sql_memory", ok: true, message: 'Memory wrote · decision · "settled choice"' },
    ]);
    await sqlMemoryRows(pool, statement, ["silent choice", "decision"], "save");
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("does not report a rolled-back transaction as a successful write", async () => {
    const sink = vi.fn();
    await expect(sqlMemorySaveTransaction(pool, async (query) => {
      await query(statement, ["rolled back", "decision"]);
      expect(sink).not.toHaveBeenCalled();
      throw new Error("commit aborted");
    }, sink)).rejects.toThrow("commit aborted");
    expect(sink.mock.calls.map(([event]) => event)).toEqual([
      { kind: "toolEnd", tool: "sql_memory", ok: false, message: "Memory failed · commit aborted" },
    ]);
    sink.mockClear();
    await sqlMemorySaveTransaction(pool, async (query) => {
      await query(statement, ["committed", "decision"]);
      expect(sink).not.toHaveBeenCalled();
    }, sink);
    expect(sink.mock.calls.map(([event]) => event)).toEqual([
      { kind: "toolEnd", tool: "sql_memory", ok: true, message: 'Memory wrote · decision · "committed"' },
    ]);
  });

  it("reports one denial or redacted connection failure", async () => {
    const sink = vi.fn();
    await expect(sqlMemoryRows(pool, "DELETE FROM memories", [], "save", sink)).rejects.toThrow();
    expect(sink.mock.calls.map(([event]) => event)).toEqual([
      { kind: "toolEnd", tool: "sql_memory", ok: false, message: "Memory denied · operation not allowed" },
    ]);
    sink.mockClear();
    const failedPool = { ...pool, connect: async () => { throw new Error("postgres://secret@host/db"); } };
    await expect(sqlMemoryRows(failedPool, "SELECT id FROM memories", [], "recall", sink)).rejects.toThrow();
    expect(sink.mock.calls.map(([event]) => event)).toEqual([
      { kind: "toolEnd", tool: "sql_memory", ok: false, message: "Memory failed · redacted" },
    ]);
  });
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
  it("renders one notice when collapsed and retains JSON when expanded", async () => {
    const tool = sqlMemoryTool(pool, "recall");
    const result = await tool.execute("call", { op: "sql", statement: "SELECT id FROM memories", values: ["project", "buck-loop"] }, undefined, undefined, {} as never);
    expect(result.details).toMatchObject({ notice: "Memory recall · 1 row · \"buck-loop\"" });
    expect(result.content[0]!.type === "text" && result.content[0]!.text).toContain('"rows"');
    const theme = {} as never;
    const context = {} as never;
    const collapsed = tool.renderResult!(result, { expanded: false } as never, theme, context) as { render(width: number): string[] };
    const expanded = tool.renderResult!(result, { expanded: true } as never, theme, context) as { render(width: number): string[] };
    expect(collapsed.render(100).join("").trim()).toBe("Memory recall · 1 row · \"buck-loop\"");
    expect(expanded.render(100).join("")).toContain('"rows"');
    expect(tool.renderCall!({ op: "sql", statement: "SELECT 1" } as never, theme, context))
      .toMatchObject({ render: expect.any(Function) });
  });

  it("attaches a write synopsis without changing the model-facing JSON", async () => {
    const testPool: MigrationPool = {
      async query() { return { rows: [] }; },
      async connect() {
        return {
          async query(text) {
            if (text.startsWith("SELECT id::text AS id FROM projects")) return { rows: [{ id: "project-id" }] };
            if (text.startsWith("UPDATE memories SET invalid_at")) return { rows: [{ id: "m" }] };
            if (text.startsWith("SELECT m.id::text AS id")) return { rows: [] };
            if (text.startsWith("INSERT INTO memories")) return { rows: [{ id: "successor" }] };
            if (text.startsWith("UPDATE memories SET superseded_by")) return { rows: [{ id: "m" }] };
            return { rows: [] };
          },
          release() {},
        };
      },
    };
    const tool = sqlMemoryTool(testPool, "save");
    const result = await tool.execute("call", {
      op: "correct", project: "p", previousId: "m", author: "a", branchName: null, commitSha: null,
      body: "decision body", context: { source_key: "k", subject: "s", phase: null, source: "test" },
      category: "decision", seq: 1,
    }, undefined, undefined, {} as never);
    expect(result.details).toMatchObject({ id: "successor", notice: 'Memory wrote · decision · "decision body"' });
    expect(result.content[0]!.type === "text" && result.content[0]!.text).toBe('{"id":"successor"}');
    const sink = vi.fn();
    await correctSqlMemory(testPool, {
      op: "correct", project: "p", previousId: "m", author: "a", branchName: null, commitSha: null,
      body: "decision body", context: { source_key: "k", subject: "s", phase: null, source: "test" },
      category: "decision", seq: 1,
    }, sink);
    expect(sink.mock.calls.map(([event]) => event)).toEqual([
      { kind: "toolEnd", tool: "sql_memory", ok: true, message: 'Memory wrote · decision · "decision body"' },
    ]);
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
    expect(result.details).toMatchObject({ rows: [{ id: 7 }], rowCount: 1, notice: "Memory recall · 1 row" });
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
    expect(result.details).toMatchObject({ rows: [], rowCount: 1, notice: "Memory wrote" });
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
    expect(identity.details).toMatchObject({ rows: [], rowCount: 1, notice: "Memory wrote" });
    expect(commands).toContain("INSERT INTO public.users (email) VALUES ($1)");

    const denied = await tool.execute("call", {
      op: "sql", statement: "UPDATE users SET skill_weight = 100 WHERE email = $1", values: ["a@example.test"],
    }, undefined, undefined, {} as never);
    expect(denied.details).toMatchObject({ error: true, message: expect.stringContaining("skill_weight") });
    expect(connect).toHaveBeenCalledOnce();
  });
  it("uses bound memory body and category for a SQL write notice", async () => {
    const tool = sqlMemoryTool({
      async query() { return { rows: [] }; },
      async connect() {
        return { async query(text) { return { rows: [], rowCount: text.startsWith("INSERT") ? 1 : undefined }; }, release() {} };
      },
    }, "save");
    const result = await tool.execute("call", {
      op: "sql",
      statement: "INSERT INTO memories (body, category) VALUES ($1, $2)",
      values: ["important decision", "decision"],
    }, undefined, undefined, {} as never);
    expect(result.details).toMatchObject({ notice: 'Memory wrote · decision · "important decision"' });
    expect(result.content[0]!.type === "text" && result.content[0]!.text).toContain('"rows":[]');
  });
});

describe.skipIf(!process.env.SQL_MEMORY_TEST_URL)("portable correction on disposable PostgreSQL", () => {
  it("commits one linked successor, retries it, and rolls back failed link and superseded targets", async () => {
    const pool = createLazyPool(process.env.SQL_MEMORY_TEST_URL!)();
    const project = `https://example.test/portable-correction-${crypto.randomUUID()}.git`;
    const author = "portable-correction@example.test";
    const tool = sqlMemoryTool(pool, "save");
    const call = (params: Parameters<typeof tool.execute>[1]) => tool.execute("call", params, undefined, undefined, {} as never);
    const sql = async (statement: string, values: unknown[] = []) => {
      const result = await call({ op: "sql", statement, values });
      const details = result.details as { error?: boolean; rows?: Array<Record<string, unknown>> };
      if (details.error) throw new Error(JSON.stringify(details));
      return details.rows ?? [];
    };
    try {
      await sql("INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING", [author]);
      await sql("INSERT INTO projects (origin_url, name) VALUES ($1, $2)", [project, "portable correction"]);
      const id = (await sql("SELECT id::text AS id FROM projects WHERE origin_url = $1", [project]))[0]!.id;
      const predecessor = (await sql(
        "INSERT INTO memories (author, project, body, context, category, seq) VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING id::text AS id",
        [author, id, "before", "{}", "project", 1],
      ))[0]!.id as string;
      const params = {
        op: "correct" as const, project, previousId: predecessor, author,
        branchName: null, commitSha: null, body: "It's corrected",
        context: { source_key: `${project}:run:2`, subject: "portable", phase: ".context/demo/phase-2.md", source: "b-save" },
        category: "project", seq: 2,
      };
      const first = await call(params);
      const successor = (first.details as { id: string }).id;
      expect(successor).toBeTruthy();
      expect((await call(params)).details).toEqual({ id: successor });
      expect((await sql("SELECT superseded_by::text AS successor FROM memories WHERE id = $1", [predecessor]))[0]?.successor).toBe(successor);
      expect((await sql("SELECT context FROM memories WHERE id = $1", [successor]))[0]?.context)
        .toMatchObject({ phase: ".context/demo/phase-2.md" });
      const immutableWrite = await call({ op: "sql", statement: "UPDATE memories SET body = $1 WHERE id = $2", values: ["rewritten", successor] });
      expect(immutableWrite.details).toMatchObject({ error: true, message: expect.stringContaining("immutable") });
      const rejected = await call({ ...params, context: { ...params.context, source_key: `${project}:run:3` }, seq: 3 });
      expect(rejected.details).toMatchObject({ error: true, message: expect.stringContaining("superseded") });
      const linkFailingPool: MigrationPool = {
        query: pool.query.bind(pool),
        async connect() {
          const client = await pool.connect();
          return {
            async query(text, values) {
              if (text.startsWith("UPDATE memories SET superseded_by")) throw new Error("injected link failure");
              return client.query(text, values);
            },
            release() { client.release(); },
          };
        },
      };
      const failed = await sqlMemoryTool(linkFailingPool, "save").execute("call", {
        ...params, previousId: successor, context: { ...params.context, source_key: `${project}:run:4` }, seq: 4,
      }, undefined, undefined, {} as never);
      expect(failed.details).toMatchObject({ error: true, message: "injected link failure" });
      expect((await sql("SELECT invalid_at FROM memories WHERE id = $1", [successor]))[0]?.invalid_at).toBeNull();
      expect(await sql("SELECT id FROM memories WHERE project = $1 AND seq = $2", [id, 4])).toEqual([]);
      const missing = await sql("SELECT m.id::text AS id FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.id = $2 AND m.invalid_at IS NULL", [project, predecessor]);
      expect(missing).toEqual([]);
      expect((await sql("SELECT m.id::text AS id FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.id = $2 AND m.invalid_at IS NULL", [project, successor]))[0]?.id).toBe(successor);
      const denied = await sqlMemoryTool(pool, "recall").execute("call", params, undefined, undefined, {} as never);
      expect(denied.details).toMatchObject({ error: true });
    } finally {
      await pool.query("DELETE FROM memories WHERE project = (SELECT id FROM projects WHERE origin_url = $1)", [project]);
      await pool.query("DELETE FROM projects WHERE origin_url = $1", [project]);
      await pool.end();
    }
  });
});
