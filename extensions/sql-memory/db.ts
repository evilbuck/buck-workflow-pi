import { createRequire } from "node:module";
import type { MigrationPool } from "./migrations.js";

const require = createRequire(import.meta.url);

type PgModule = { Pool: new (options: { connectionString: string; max: number; idleTimeoutMillis: number; connectionTimeoutMillis: number }) => MigrationPool };

export function createLazyPool(connectionString: string): () => MigrationPool {
  let pool: MigrationPool | undefined;
  return () => {
    if (!pool) {
      const { Pool } = require("pg") as PgModule;
      pool = new Pool({ connectionString, max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
    }
    return pool;
  };
}
