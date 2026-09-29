import pg from "pg";
import type { MigrationPool } from "./migrations.js";

export function createLazyPool(connectionString: string): () => MigrationPool {
  let pool: MigrationPool | undefined;
  return (): MigrationPool => {
    if (!pool) {
      pool = new pg.Pool({ connectionString, max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
    }
    if (!pool) throw new Error("pg pool was not created");
    return pool;
  };
}
