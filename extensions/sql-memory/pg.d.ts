declare module "pg" {
  import type { MigrationPool } from "./migrations.js";

  const pg: {
    Pool: new (options: {
      connectionString: string;
      max: number;
      idleTimeoutMillis: number;
      connectionTimeoutMillis: number;
    }) => MigrationPool;
  };

  export default pg;
}
