import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { applyMigrations, type MigrationPool } from "./migrations.js";

describe("applyMigrations", () => {
  it("applies migrations by version and records checksums, then no-ops", async () => {
    const applied = new Map<string, string>();
    const queries: string[] = [];
    const pool: MigrationPool = {
      async query(text) {
        queries.push(text);
        if (text === "SELECT version, checksum FROM schema_migrations ORDER BY version") {
          return { rows: [...applied].map(([version, checksum]) => ({ version, checksum })) };
        }
        return { rows: [] };
      },
      async connect() {
        return {
          async query(text: string, values?: unknown[]) {
            queries.push(text);
            if (text.startsWith("INSERT INTO schema_migrations")) {
              applied.set(String(values?.[0]), String(values?.[1]));
            }
            return { rows: [] };
          },
          release() {},
        };
      },
    };
    const files = [
      { name: "1000_future.sql", sql: "CREATE TABLE IF NOT EXISTS future (id int);" },
      { name: "002_more.sql", sql: "CREATE TABLE IF NOT EXISTS tags (id int);" },
      { name: "999_late.sql", sql: "CREATE TABLE IF NOT EXISTS late (id int);" },
      { name: "001_initial_schema.sql", sql: "CREATE TABLE IF NOT EXISTS users (id int);" },
    ];
    const loadFiles = vi.fn(async () => files);

    const first = await applyMigrations(pool, { loadFiles });
    expect(first.applied).toEqual(["001_initial_schema.sql", "002_more.sql", "999_late.sql", "1000_future.sql"]);
    expect(applied.get("001")).toBe(createHash("sha256").update(files[3]!.sql).digest("hex"));
    expect(applied.get("002")).toBe(createHash("sha256").update(files[1]!.sql).digest("hex"));
    expect(applied.get("999")).toBe(createHash("sha256").update(files[2]!.sql).digest("hex"));
    expect(applied.get("1000")).toBe(createHash("sha256").update(files[0]!.sql).digest("hex"));

    const before = queries.length;
    const second = await applyMigrations(pool, { loadFiles });
    expect(second.applied).toEqual([]);
    expect(queries.slice(before).filter((query) => query.startsWith("CREATE TABLE IF NOT EXISTS tags"))).toEqual([]);
  });

  it("refuses modified applied migrations", async () => {
    const pool: MigrationPool = {
      async query(text) {
        if (text === "SELECT version, checksum FROM schema_migrations ORDER BY version") {
          return { rows: [{ version: "001", checksum: "old-checksum" }] };
        }
        return { rows: [] };
      },
      async connect() { throw new Error("must not open transaction"); },
    };
    await expect(applyMigrations(pool, {
      loadFiles: async () => [{ name: "001_initial.sql", sql: "CREATE TABLE users (id int);" }],
    })).rejects.toThrow(/checksum mismatch.*001_initial\.sql/i);
  });

  it.each([
    ["003_drop.sql", "DROP TABLE users;"],
    ["004_truncate.sql", "TRUNCATE users;"],
    ["005_delete.sql", "DELETE FROM users;"],
    ["009_hidden.sql", "SELECT 'foo\\'; DROP TABLE IF EXISTS memories; --'"],
    ["010_function.sql", "CREATE FUNCTION remove_row() RETURNS void LANGUAGE plpgsql AS $$ BEGIN DELETE FROM memories; END $$;"],
    ["011_rename.sql", "ALTER TABLE memories RENAME TO retired_memories;"],
    ["012_replace.sql", "CREATE OR REPLACE VIEW memories AS SELECT * FROM users;"],
    ["013_string_function.sql", "CREATE FUNCTION wipe() RETURNS void LANGUAGE plpgsql AS 'BEGIN DELETE FROM memories; END;';"],
    ["014_dynamic.sql", "DO $$ BEGIN EXECUTE 'TRU' || 'NCATE memories'; END $$;"],
    ["015_hidden_expression.sql", "CREATE TABLE IF NOT EXISTS x (id int DEFAULT nextval('seq'));"],
    ["016_empty_statement.sql", "CREATE TABLE IF NOT EXISTS x (id int);;"],
  ])("blocks non-additive file %s without exact acknowledgment", async (name, sql) => {
    const pool: MigrationPool = {
      async query() { return { rows: [] }; },
      async connect() { throw new Error("must not open transaction"); },
    };
    const loadFiles = async () => [{ name, sql }];
    await expect(applyMigrations(pool, { loadFiles })).rejects.toThrow(new RegExp(`non-additive.*${name}`, "i"));
    await expect(applyMigrations(pool, { loadFiles, destructive: "other.sql" })).rejects.toThrow(new RegExp(`non-additive.*${name}`, "i"));
  });

  it("accepts an explicit acknowledgment naming the destructive migration", async () => {
    const pool: MigrationPool = {
      async query() { return { rows: [] }; },
      async connect() {
        return { async query() { return { rows: [] }; }, release() {} };
      },
    };
    const applied = await applyMigrations(pool, {
      loadFiles: async () => [{ name: "003_drop.sql", sql: "DROP TABLE users;" }],
      destructive: "003_drop.sql",
    });
    expect(applied.applied).toEqual(["003_drop.sql"]);
  });

  it("applies an additive column without acknowledgment", async () => {
    const queries: string[] = [];
    const pool: MigrationPool = {
      async query() { return { rows: [] }; },
      async connect() {
        return { async query(text) { queries.push(text); return { rows: [] }; }, release() {} };
      },
    };
    const sql = "ALTER TABLE memories ADD COLUMN IF NOT EXISTS note text;";
    await expect(applyMigrations(pool, {
      loadFiles: async () => [{ name: "002_note.sql", sql }],
    })).resolves.toEqual({ applied: ["002_note.sql"] });
    expect(queries).toContain(sql);
  });

  it("trusts only the unchanged bootstrap when procedural SQL is unacknowledged", async () => {
    const sql = await readFile(new URL("../../migrations/001_initial_schema.sql", import.meta.url), "utf8");
    const queries: string[] = [];
    const pool: MigrationPool = {
      async query() { return { rows: [] }; },
      async connect() {
        return { async query(text) { queries.push(text); return { rows: [] }; }, release() {} };
      },
    };
    const loadFiles = async () => [{ name: "001_initial_schema.sql", sql }];
    await expect(applyMigrations(pool, { loadFiles })).resolves.toEqual({ applied: ["001_initial_schema.sql"] });
    expect(queries).toContain(sql);
    const prior = queries.length;
    await expect(applyMigrations(pool, { loadFiles: async () => [{
      name: "001_initial_schema.sql", sql: `${sql}\n-- changed`,
    }] })).rejects.toThrow(/non-additive.*001_initial_schema/i);
    expect(queries).toHaveLength(prior);
  });
});
