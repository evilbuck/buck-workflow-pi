import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync(":memory:");
try {
  database.exec("CREATE TABLE storage_runtime_probe (value TEXT NOT NULL)");
  database.exec("BEGIN IMMEDIATE");
  database.prepare("INSERT INTO storage_runtime_probe(value) VALUES (?)").run("rolled-back");
  database.exec("ROLLBACK");
  if (Number(database.prepare("SELECT COUNT(*) AS count FROM storage_runtime_probe").get()?.count) !== 0) {
    throw new Error("SQLite rollback did not discard the uncommitted write");
  }
  database.exec("BEGIN IMMEDIATE");
  database.prepare("INSERT INTO storage_runtime_probe(value) VALUES (?)").run("committed");
  database.exec("COMMIT");
  const row = database.prepare("SELECT value FROM storage_runtime_probe").get() as { value: string } | undefined;
  if (row?.value !== "committed") throw new Error("SQLite committed write did not round-trip");
  console.log(`SQLite transaction smoke passed (${process.version})`);
} finally {
  database.close();
}
