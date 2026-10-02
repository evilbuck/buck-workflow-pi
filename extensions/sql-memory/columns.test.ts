import { describe, expect, it } from "vitest";
import { COLUMNS, PUBLIC_TABLES, columnCard, columnList, fixFor, tableRefFromStatement } from "./columns.js";

describe("columns module", () => {
  it("lists the nine public tables from migration 001", () => {
    expect(PUBLIC_TABLES).toEqual([
      "users",
      "projects",
      "categories",
      "memories",
      "tags",
      "memory_tags",
      "memory_ranks",
      "memory_embeddings",
      "schema_migrations",
    ]);
  });

  it("documents users without an id and skills no rank column", () => {
    expect(columnList("users")).toBe("email, skill_weight");
    expect(COLUMNS.users.joined?.[0]).toContain("no users.id");
  });

  it("detects the referenced table from a statement", () => {
    expect(tableRefFromStatement("SELECT u.id FROM users u")).toBe("users");
    expect(tableRefFromStatement("SELECT * FROM information_schema.columns")).toBe("information_schema");
    expect(tableRefFromStatement("UPDATE memories SET body = $1")).toBe("memories");
  });

  it("fixes the column u.id incident", () => {
    const fix = fixFor("missing-column", "SELECT u.id FROM users u");
    expect(fix).toContain("users has no id");
    expect(fix).toContain("email");
  });

  it("fixes an information_schema gate denial without leaking it", () => {
    const fix = fixFor("catalog-deny", "SELECT column_name FROM information_schema.columns");
    expect(fix).toContain("Schema inspection is denied");
    expect(fix).toContain("remember");
    expect(PUBLIC_TABLES.every((name) => fix.includes(name))).toBe(true);
  });

  it("fixes a uuid/text operator failure", () => {
    const fix = fixFor("uuid-cast", "SELECT * FROM memories WHERE project = $1::text");
    expect(fix).toContain("uuid");
    expect(fix).toContain("remember");
  });

  it("fixes an unknown table gate denial", () => {
    const fix = fixFor("unknown-table", "SELECT * FROM secrets");
    expect(fix).toContain("allowlisted");
    expect(fix).toContain("remember");
  });

  it("recommends remember for raw write attempts", () => {
    const fix = fixFor("write-replace", "INSERT INTO memories ...");
    expect(fix).toContain("remember");
    expect(fix).toContain("body");
    expect(fix).toContain("subject");
  });

  it("column card includes all nine tables and joins", () => {
    const card = columnCard();
    expect(card).toContain("Schema");
    expect(PUBLIC_TABLES.every((name) => card.includes(name))).toBe(true);
    expect(card).toContain("users.email");
    expect(card).toContain("remember");
  });
});