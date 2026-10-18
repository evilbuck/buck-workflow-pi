import { defineStorageConformance, type ConformanceBackend } from "../storage/conformance.js";
import { SQLiteStorageStore } from "../storage/sqlite-store.js";

const sqliteFixture: ConformanceBackend = {
  name: "in-memory SQLite adapter",
  async create() {
    const store = await SQLiteStorageStore.open(":memory:");
    return { store, dispose: () => store.close() };
  },
};

defineStorageConformance(sqliteFixture);
