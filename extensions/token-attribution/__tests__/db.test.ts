import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { deferred, fixture, openLedger, record } from "./fixtures.js";
import { resolveConsumerContext, withBoundStore } from "../../../skills/_shared/scripts/workflow-state.js";
import { SQLiteStorageStore } from "../../../skills/_shared/storage/sqlite-store.js";
import { buildTokenReport } from "../report.js";

for (const adapter of ["repo-files", "external-files", "sqlite", "postgres"] as const) {
  describe.skipIf(adapter === "postgres" && !process.env.BUCK_WORKFLOW_TEST_DATABASE_URL)(`attribution ${adapter}`, () => {
    it("reads and dedupes after restart without exports, ignoring poisoned local rows", async () => {
      const { root, projection } = fixture(adapter);
      const ledger = openLedger(projection);
      const original = record(root);
      expect(await ledger.insert(original)).toBe(true);
      expect(await ledger.insert({ ...original, sessionFile: `${original.sessionFile}.other` })).toBe(true);
      const local = new DatabaseSync(projection);
      local.exec("UPDATE buck_token_attribution SET total_tokens = 999999; INSERT INTO buck_token_attribution SELECT recorded_at, session_file, session_id, 'local-only', project_key, branch, worktree_root, provider, model, api, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, total_tokens, cost_usd, cost_source FROM buck_token_attribution LIMIT 1;");
      local.close();
      rmSync(join(root, ".context"), { recursive: true, force: true });
      const restarted = openLedger(projection);
      expect((await restarted.records(root)).sort((a, b) => a.sessionFile.localeCompare(b.sessionFile))).toEqual([original, { ...original, sessionFile: `${original.sessionFile}.other` }]);
      expect(await restarted.insert(original)).toBe(false);
      expect(await buildTokenReport(restarted, root, original.projectKey, "")).toContain("330 tokens");
      expect(existsSync(join(root, ".context"))).toBe(false);
      expect(await restarted.insert({ ...original, entryKey: "local-only" })).toBe(true);
    });

    it("reconciles fallback and canonical IDs durably without collapsing distinct entries", async () => {
      const { root } = fixture(adapter);
      const ledger = openLedger();
      const fallback = record(root, { entryKey: "timestamp:openai:gpt-5:165" });
      expect(await ledger.insert(fallback)).toBe(true);
      expect(await ledger.insertReconciled({ ...fallback, entryKey: "entry-1" }, fallback.entryKey)).toBe(false);
      const restarted = openLedger();
      expect(await restarted.insert(fallback)).toBe(false);
      expect(await restarted.insertReconciled({ ...fallback, entryKey: "entry-2" }, fallback.entryKey)).toBe(true);
      const records = await restarted.records(root);
      expect(records.map((row) => row.entryKey).sort()).toEqual(["entry-1", "entry-2"]);
      expect(await buildTokenReport(restarted, root, fallback.projectKey, "")).toContain("330 tokens");
    });

    it("never falls back to the populated local projection when configuration fails", async () => {
      const { root, config, projection } = fixture(adapter);
      const ledger = openLedger(projection);
      const original = record(root);
      expect(await ledger.insert(original)).toBe(true);
      writeFileSync(config, "version: 1\nstorage:\n  adapter: invalid\n");
      await expect(ledger.records(root)).rejects.toThrow("storage.adapter");
      await expect(ledger.insert(original)).rejects.toThrow("storage.adapter");
      await expect(ledger.flush()).rejects.toThrow("Attribution persistence failed");
    });
  });
}

describe("attribution projection and retention faults", () => {
  it("never changes host attribution/messages tables, even when attribution matches the old Buck schema", async () => {
    const { root, projection } = fixture();
    const seed = new DatabaseSync(projection);
    seed.exec(`
      CREATE TABLE attribution AS SELECT 'host' recorded_at, 'session' session_file,
        'host-session' session_id, 'key' entry_key, 'host-project' project_key,
        'host-branch' branch, 'host-root' worktree_root, 'host-provider' provider,
        'host-model' model, 'host-api' api, 4 input_tokens, 2 output_tokens,
        0 cache_read_tokens, 0 cache_write_tokens, NULL reasoning_tokens, 6 total_tokens,
        NULL cost_usd, 'none' cost_source;
      CREATE INDEX attribution_delivery_idx ON attribution(entry_key);
      CREATE TABLE messages (id TEXT PRIMARY KEY, payload TEXT);
      INSERT INTO messages VALUES ('kept', 'omp');
    `);
    const hostRows = seed.prepare("SELECT * FROM attribution").all();
    const before = seed.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY name").all();
    seed.close();
    const ledger = openLedger(projection);
    expect(await ledger.insert(record(root))).toBe(true);
    const inspect = new DatabaseSync(projection, { readOnly: true });
    expect(inspect.prepare("SELECT * FROM attribution").all()).toEqual(hostRows);
    expect(inspect.prepare("SELECT * FROM messages").all()).toEqual([{ id: "kept", payload: "omp" }]);
    expect(inspect.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE '%buck_token_attribution%' ORDER BY name").all()).toEqual(before);
    expect(inspect.prepare("SELECT total_tokens FROM buck_token_attribution").all()).toEqual([{ total_tokens: 165 }]);
    inspect.close();
  });

  it("awaits receipt retention, surfaces failure at drain, and repairs the same delivery", async () => {
    const { root } = fixture();
    const ledger = openLedger();
    const original = record(root);
    const write = vi.spyOn(SQLiteStorageStore.prototype, "writeReceipt").mockRejectedValueOnce(new Error("receipt unavailable"));
    await expect(ledger.insert(original)).rejects.toThrow("receipt unavailable");
    await expect(ledger.flush()).rejects.toThrow("receipt unavailable");
    expect(await ledger.insert(original)).toBe(false);
    expect(await ledger.records(root)).toEqual([original]);
    expect(write).toHaveBeenCalledTimes(2);
    const context = await resolveConsumerContext(root);
    const receipt = write.mock.calls[1]![0];
    expect(receipt.runId).not.toBe(context.runId);
    expect(receipt.worktreeId).toBe(context.worktreeId);
    await withBoundStore(root, context, async (store) => {
      expect(await store.readReceipt(context.projectId, receipt.runId)).toMatchObject(receipt);
      const rows = await store.list({ ...context, subjectId: "token-attribution", kind: "attribution" });
      expect(rows.map((row) => ({ name: row.key.logicalName, run: row.key.runId, worktree: row.key.worktreeId }))).toEqual([{
        name: `rows/${encodeURIComponent(original.sessionFile)}/${encodeURIComponent(original.entryKey)}.json`, run: context.runId, worktree: context.worktreeId,
      }]);
    });
  });

  it("keeps insertion pending until real retention finishes and shutdown observes an in-flight fault", async () => {
    const { root } = fixture();
    const ledger = openLedger();
    const gate = deferred();
    const entered = deferred();
    const original = SQLiteStorageStore.prototype.writeReceipt;
    vi.spyOn(SQLiteStorageStore.prototype, "writeReceipt").mockImplementationOnce(async function (this: SQLiteStorageStore, receipt) {
      entered.resolve();
      await gate.promise;
      return original.call(this, receipt);
    });
    let settled = false;
    const inserted = ledger.insert(record(root)).then((value) => { settled = true; return value; });
    await entered.promise;
    expect(settled).toBe(false);
    gate.resolve();
    expect(await inserted).toBe(true);
    vi.spyOn(SQLiteStorageStore.prototype, "writeReceipt").mockRejectedValueOnce(new Error("shutdown retain fault"));
    const failed = ledger.insert(record(root, { entryKey: "pending" }));
    const observed = expect(failed).rejects.toThrow("shutdown retain fault");
    await expect(ledger.flush()).rejects.toThrow("shutdown retain fault");
    await observed;
  });

  it("repairs canonical reconciliation after tombstone failure without double counting", async () => {
    const { root } = fixture();
    const ledger = openLedger();
    const fallback = record(root, { entryKey: "fallback" });
    await ledger.insert(fallback);
    vi.spyOn(SQLiteStorageStore.prototype, "correct").mockRejectedValueOnce(new Error("correction fault"));
    await expect(ledger.insertReconciled({ ...fallback, entryKey: "canonical" }, "fallback")).rejects.toThrow("correction fault");
    await expect(ledger.flush()).rejects.toThrow("correction fault");
    expect((await ledger.records(root)).map((row) => row.entryKey)).toEqual(["canonical"]);
    expect(await ledger.insertReconciled({ ...fallback, entryKey: "canonical" }, "fallback")).toBe(false);
    expect(await ledger.insert(fallback)).toBe(false);
    expect((await ledger.records(root)).map((row) => row.entryKey)).toEqual(["canonical"]);
  });

  it("targets checkout B from process A and refuses destination changes across restart", async () => {
    const { base, root, config, database } = fixture();
    const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
    git(root, "init", "-b", "main");
    git(root, "-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "--allow-empty", "-m", "fixture");
    const right = join(base, "right");
    git(root, "worktree", "add", "-b", "right", right);
    const ledger = openLedger();
    const row = record(right);
    expect(process.cwd()).not.toBe(right);
    expect(await ledger.insert(row)).toBe(true);
    expect(await ledger.records(root)).toEqual([]);
    expect(await openLedger().records(right)).toEqual([row]);
    writeFileSync(config, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${database}.redirected\n`);
    const restarted = openLedger();
    await expect(restarted.insert(row)).rejects.toThrow("destination changed");
    await expect(restarted.flush()).rejects.toThrow("destination changed");
    expect(existsSync(`${database}.redirected`)).toBe(false);
  });

  it("captures destination before waiting in the ledger queue", async () => {
    const { root, config, database } = fixture();
    const ledger = openLedger();
    const entered = deferred();
    const release = deferred();
    const original = SQLiteStorageStore.prototype.writeReceipt;
    vi.spyOn(SQLiteStorageStore.prototype, "writeReceipt").mockImplementationOnce(async function (this: SQLiteStorageStore, receipt) {
      entered.resolve();
      await release.promise;
      return original.call(this, receipt);
    });
    const first = ledger.insert(record(root));
    await entered.promise;
    const second = ledger.insert(record(root, { entryKey: "second" }));
    // Wait for trusted binding, not queue execution.
    await resolveConsumerContext(root);
    writeFileSync(config, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${database}.redirected\n`);
    release.resolve();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(existsSync(`${database}.redirected`)).toBe(false);
  });
});
