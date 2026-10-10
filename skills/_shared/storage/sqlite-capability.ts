export interface SQLiteModule {
  DatabaseSync: new (location: string) => unknown;
}

export async function loadSQLiteModule(load: () => Promise<unknown> = () => import("node:sqlite")): Promise<SQLiteModule> {
  try {
    const sqlite = await load() as SQLiteModule;
    if (typeof sqlite.DatabaseSync !== "function") throw new Error("node:sqlite has no DatabaseSync export");
    return sqlite;
  } catch (error) {
    throw new Error(`SQLite adapter unavailable in this runtime: node:sqlite could not be loaded${error instanceof Error ? ` (${error.message})` : ""}`);
  }
}
