import { describe, expect, it } from "vitest";
import { checkSqlStatement } from "./sql-gate.js";

import { checkSqlForRole } from "./sql-gate.js";

describe("stage SQL policy", () => {
  it.each([
    ["SELECT id FROM memories WHERE id = $1", "recall", true],
    ["UPDATE memories SET invalid_at = now() WHERE id = $1", "recall", true],
    ["INSERT INTO memories (body) VALUES ($1)", "save", true],
    ["UPDATE memories SET invalid_at = now() WHERE id = $1", "save", true],
    ["UPDATE memories SET superseded_by = $1 WHERE id = $2 AND project = $3", "save", true],
    ["UPDATE memories SET body = $1 WHERE id = $2", "save", false],
    ["UPDATE public.memories SET category = $1 WHERE id = $2", "save", false],
    ["UPDATE memories SET invalid_at = now(), body = $1 WHERE id = $2", "save", false],
    ["UPDATE memories SET context = $1 WHERE id = $2", "save", false],
    ["UPDATE memories SET invalid_at = now() WHERE id = $1", "recall", true],
    ["INSERT INTO public.memories (body) VALUES ($1)", "save", true],
    ["UPDATE public.users SET email = $1 WHERE id = $2", "save", true],
    ["INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING", "save", true],
    ["INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = $1", "save", false],
    ["UPDATE users SET skill_weight = 100 WHERE email = $1", "save", false],
    ["UPDATE public.users SET users.skill_weight = 100 WHERE id = $1", "save", false],
    ["INSERT INTO users (email, skill_weight) VALUES ($1, 100)", "save", false],
    ['UPDATE users SET "skill_weight" = 100 WHERE email = $1', "save", false],
    ["INSERT INTO private.memories (body) VALUES ($1)", "save", false],
    ["SELECT id FROM memories WHERE id = $1", "save", true],
    ["SELECT id FROM memories m JOIN projects p ON p.id = m.project WHERE p.origin_url = $1 AND m.context @> $2", "save", true],
    ["SELECT id FROM memory_ranks", "save", false],
    ["DELETE FROM memories", "save", false],
  ] as const)("applies %s policy for %s", (sql, role, allowed) => {
    expect(checkSqlForRole(sql, role).allowed).toBe(allowed);
  });
});
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

  it.each([
    [
      "SELECT ts_rank(m.search, plainto_tsquery('english', $1)) FROM memories m WHERE m.id = $2",
    ],
  ])("allows PostgreSQL's plainto_tsquery in bound recall queries: %s", (sql) => {
    expect(checkSqlStatement(sql)).toEqual({ allowed: true });
  });

  it.each([
    ["SELECT ts_rank(m.search, plaintext_to_tsquery('english', $1)) FROM memories m WHERE m.id = $2", "PLAINTEXT_TO_TSQUERY"],
  ])("rejects the non-existent plaintext_to_tsquery (%s)", (sql, expected) => {
    const result = checkSqlStatement(sql);
    expect(result.allowed).toBe(false);
    if (result.allowed === false) expect(result.reason).toContain(expected);
  });
});
