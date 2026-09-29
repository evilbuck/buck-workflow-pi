import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { createLazyPool } from "./db.js";
import { applyMigrations, type MigrationPool } from "./migrations.js";
import { checkSqlStatement } from "./sql-gate.js";

const SqlMemoryParams = Type.Union([
  Type.Object({ op: Type.Literal("sql"), statement: Type.String({ minLength: 1 }) }),
  Type.Object({ op: Type.Literal("migrate"), destructive: Type.Optional(Type.String()) }),
]);
interface SqlMemoryResponse { content: Array<{ type: "text"; text: string }>; details: unknown; }
type SqlMemoryParamsType = { op: "sql"; statement: string } | { op: "migrate"; destructive?: string };
interface SqlMemoryDeps { pool?: MigrationPool; }
 

function response(value: unknown): SqlMemoryResponse {
  const text = JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
  return { content: [{ type: "text", text }], details: value };
}

export function sqlMemoryTool(pool: MigrationPool): ToolDefinition<typeof SqlMemoryParams> {
  return {
    name: "sql_memory",
    label: "SQL Memory",
    description: "Query the shared agent-memory PostgreSQL schema. SQL mode allows only one SELECT, INSERT, or UPDATE against public memory tables. Migration mode applies numbered files; destructive migrations require destructive to exactly name the file.",
    promptSnippet: "sql_memory: SQL access to shared memories and additive schema migrations.",
    parameters: SqlMemoryParams,
    async execute(_id, rawParams) {
      const params = rawParams as SqlMemoryParamsType;
      try {
        if (params.op === "migrate") return response(await applyMigrations(pool, { destructive: params.destructive }));
        const gate = checkSqlStatement(params.statement);
        if (!gate.allowed) return response({ error: true, message: gate.reason });
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SET LOCAL search_path = public");
          await client.query("SET LOCAL standard_conforming_strings = on");
          const result = await client.query(params.statement);
          await client.query("COMMIT");
          return response({ rows: result.rows, rowCount: result.rowCount ?? result.rows.length });
        } catch (error) {
          try { await client.query("ROLLBACK"); } catch { /* Preserve the query error. */ }
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        return response({ error: true, message: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}

export function wire(api: ExtensionAPI, deps: SqlMemoryDeps = {}): void {
  const connectionString = process.env.SQL_MEMORY_URL;
  if (!connectionString) return;
  const getPool = deps.pool ? () => deps.pool! : createLazyPool(connectionString);
  api.registerTool({
    ...sqlMemoryTool({
      async query(text, values) { return getPool().query(text, values); },
      async connect() { return getPool().connect(); },
    }),
  });
}
