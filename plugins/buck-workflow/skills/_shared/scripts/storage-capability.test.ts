import { describe, expect, it } from "vitest";
import { loadSQLiteModule } from "../storage/sqlite-capability.js";

describe("SQLite runtime capability", () => {
  it("loads the platform module lazily when supported", async () => {
    const sqlite = await loadSQLiteModule();
    expect(sqlite.DatabaseSync).toBeTypeOf("function");
  });

  it("fails with an actionable adapter-specific refusal when unavailable", async () => {
    await expect(loadSQLiteModule(async () => { throw new Error("unsupported"); })).rejects.toThrow(/SQLite adapter unavailable.*node:sqlite/);
  });
});
