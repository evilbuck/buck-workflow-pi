import { describe, expect, it } from "vitest";
import { checkSqlStatement } from "./sql-gate.js";

describe("checkSqlStatement", () => {
  it.each([
    "SELECT id, body FROM memories WHERE project = $1",
    "INSERT INTO memories (author, body) VALUES ($1, $2) RETURNING id",
    "UPDATE memories SET invalid_at = now() WHERE id = $1",
    "SELECT m.id FROM public.memories AS m JOIN projects p ON p.id = m.project",
  ])("allows memory schema DML: %s", (sql) => {
    expect(checkSqlStatement(sql)).toEqual({ allowed: true });
  });

  it.each([
    ["DELETE FROM memories", "DELETE"],
    ["DROP TABLE memories", "DROP"],
    ["TRUNCATE memories", "TRUNCATE"],
    ["SELECT 1; DELETE FROM memories", "one SQL statement"],
    ["SELECT * FROM other_schema.memories", "schema"],
    ["SELECT * FROM app.memories", "database"],
    ["SELECT * FROM secrets", "not allowlisted"],
    ["WITH x AS (DELETE FROM memories RETURNING *) SELECT * FROM x", "DELETE"],
    ["SELECT * FROM memories; DELETE FROM users", "one SQL statement"],
    ["SELECT * FROM memories, secrets", "Comma-separated"],
    ["SELECT * FROM dblink('remote', 'SELECT 1') AS t(value int)", "DBLINK"],
    ["nonsense", "statement"],
    ["SELECT 'foo\\' FROM memories; DELETE FROM memories --'", "unparseable"],
    ["SELECT set_config('search_path', 'pg_temp, public', false)", "not allowlisted"],
    ["SELECT dblink_connect('host=127.0.0.1 dbname=postgres')", "not allowlisted"],
    ["SELECT pg_ls_dir('/')", "not allowlisted"],
    ["SELECT E'unsafe'", "unparseable"],
    ["SELECT U&'unsafe'", "unparseable"],
    ["SELECT $$unsafe$$", "unparseable"],
  ])("rejects unsafe SQL (%s)", (sql, expected) => {
    const result = checkSqlStatement(sql);
    expect(result.allowed).toBe(false);
    if (result.allowed === false && expected) expect(result.reason).toContain(expected);
  });

  it("does not treat keywords inside SQL strings or comments as executable", () => {
    expect(checkSqlStatement("SELECT 'DELETE FROM secrets' AS note FROM memories -- DROP TABLE users")).toEqual({ allowed: true });
  });
});
