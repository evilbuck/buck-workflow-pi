import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeWorkflowState, withConfiguredStore } from "../../../skills/_shared/scripts/workflow-state.js";
import { runApply } from "../../../skills/b-save-improved/scripts/save-apply.js";
import { classifyContextPath, consumerKey } from "../../../skills/_shared/storage/consumers.js";
import { completeSaveAttempt, loadSaveAttempt, prepareSaveAttempt, recordSaveMetadata, saveSqlFacts, verifySqlSave } from "../sql-save.js";

const PREFLIGHT = resolve(import.meta.dirname, "../../../skills/b-save-improved/scripts/save-preflight.ts");
const SUBJECT = "2026-10-15.save-repair";
const original = { cwd: process.cwd(), config: process.env.BUCK_WORKFLOW_CONFIG, xdg: process.env.XDG_CONFIG_HOME, sql: process.env.SQL_MEMORY_URL };
let root = "";
afterEach(() => {
  process.chdir(original.cwd);
  for (const [name, value] of [["BUCK_WORKFLOW_CONFIG", original.config], ["XDG_CONFIG_HOME", original.xdg], ["SQL_MEMORY_URL", original.sql]] as const) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  if (root) rmSync(root, { recursive: true, force: true });
});
async function fixture(adapter: string) {
  root = mkdtempSync(join(tmpdir(), "save-adapter-repair-"));
  execFileSync("git", ["init", "-b", "save-repair"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "--allow-empty", "-qm", "init"], { cwd: root, stdio: "ignore" });
  process.env.XDG_CONFIG_HOME = join(root, "xdg");
  process.env.BUCK_WORKFLOW_CONFIG = join(root, "config.yaml");
  const option = adapter === "sqlite" ? `  database: ${join(root, "state.sqlite")}\n` : adapter === "external-files" ? `  root: ${join(root, "external")}\n` : adapter === "postgres" ? "  connection_env: BUCK_WORKFLOW_TEST_DATABASE_URL\n" : "";
  writeFileSync(process.env.BUCK_WORKFLOW_CONFIG, `version: 1\nstorage:\n  adapter: ${adapter}\n${option}`);
  process.chdir(root);
  await withConfiguredStore(root, async (store, context) => {
    for (const [name, body] of Object.entries({ "index.md": "---\nstatus: active\n---\n# Save\n", "plan-x.md": "---\nstatus: active\nspec: spec-x.md\n---\n# Canonical plan\n", "spec-x.md": "---\nstatus: active\nplans: []\n---\n# Specification\n" })) {
      await executeWorkflowState({ cwd: root, store, context, role: "save", request: { operation: "write", ref: { subjectId: SUBJECT, kind: name === "index.md" ? "subject-index" : name.startsWith("plan") ? "plan" : "spec", logicalName: name }, body, expectedRevision: null, ...(name === "plan-x.md" ? { links: [{ subjectId: SUBJECT, kind: "spec" as const, logicalName: "spec-x.md" }] } : {}) } });
    }
  });
  rmSync(join(root, ".context"), { recursive: true, force: true });
}
function payload(preflight: { storage_snapshot: unknown }, sqlReceipt?: { path: string; ids: string[] }) {
  const crossrefs = sqlReceipt
    ? sqlReceipt.ids.map(value => ({ path: `.context/${SUBJECT}/plan-x.md`, key: "sql_memory_ids", value }))
    : [{ path: `.context/${SUBJECT}/plan-x.md`, key: "memory", value: "../memory/save-repair.md" }];
  return { today: "2026-10-15", subject: { name: SUBJECT, path: `.context/${SUBJECT}` }, storage_snapshot: preflight.storage_snapshot, memory: { path: ".context/memory/save-repair.md", frontmatter: { date: "2026-10-15", domains: ["storage"], topics: ["save"], related: [], artifacts: [], priority: "high", status: "active", subject: SUBJECT }, title: "Save repair", body: "## What shipped\n\nDurable save repair." }, index_entry: { summary: "Save repair", status: "active" }, spec_plans: [{ spec: "spec-x.md", plan: "plan-x.md" }], crossrefs, ...(sqlReceipt ? { sql_receipt: sqlReceipt } : {}) };
}
function preflight() { return JSON.parse(execFileSync("bun", [PREFLIGHT, "--subject", SUBJECT], { cwd: root, encoding: "utf8", env: process.env })); }

for (const adapter of ["repo-files", "external-files", "sqlite", "postgres"]) {
  describe.skipIf(adapter === "postgres" && !process.env.BUCK_WORKFLOW_TEST_DATABASE_URL)(`${adapter} save repairs`, () => {
    it.each([{ facts: [] }, { facts: ["Reusable decision"] }])("uses one loop-prepared attempt with facts $facts and complete readback", async ({ facts }) => {
      await fixture(adapter);
      process.env.SQL_MEMORY_URL = "configured-save-mode";
      expect(existsSync(join(root, ".context"))).toBe(false);
      const pre = preflight();
      expect(pre.subject).toMatchObject({ name: SUBJECT, created: false, status: "active" });
      expect(pre.plans).toMatchObject([{ path: "plan-x.md", spec: "spec-x.md" }]);
      const prepared = prepareSaveAttempt(root, SUBJECT, false, `.context/${SUBJECT}/phase-5.md`);
      if ("error" in prepared) throw new Error(prepared.error);
      const ids = await saveSqlFacts(root, prepared, facts);
      expect(await runApply(payload(pre, { path: prepared.receiptRel, ids }))).toBe(0);
      expect(await loadSaveAttempt(root)).toEqual(prepared);
      expect(await verifySqlSave(root, SUBJECT, {}, true, prepared.attemptId)).toEqual({ status: "verified" });
      await withConfiguredStore(root, async (store, context) => {
        expect(await store.readReceipt(context.projectId, prepared.runId)).toMatchObject({ runId: prepared.runId, attemptId: prepared.attemptId, status: "complete", artifactRevisions: ids, kind: facts.length ? "rows" : "no-fact", metadataDuties: ["save-metadata", facts.length ? "readback" : "probe"] });
        const plan = await store.read({ projectId: context.projectId, branchId: context.branchId, subjectId: SUBJECT, kind: "plan", logicalName: "plan-x.md" });
        expect(plan?.links).toMatchObject([{ subjectId: SUBJECT, kind: "spec", logicalName: "spec-x.md" }]);
        expect(new TextDecoder().decode(plan!.bytes)).toContain("Canonical plan");
      });
      rmSync(join(root, ".context"), { recursive: true });
      expect(await verifySqlSave(root, SUBJECT, {}, true, prepared.attemptId)).toEqual({ status: "verified" });
    });

    it("completes standalone file-mode metadata and refuses a stale captured revision", async () => {
      await fixture(adapter);
      delete process.env.SQL_MEMORY_URL;
      const pre = preflight();
      expect(await runApply(payload(pre))).toBe(0);
      const attempt = await loadSaveAttempt(root);
      expect(attempt?.subject).toBe(SUBJECT);
      await withConfiguredStore(root, async (store, context) => {
        expect(await store.readReceipt(context.projectId, attempt!.runId)).toMatchObject({ status: "complete", metadataDuties: ["save-metadata", "probe"] });
      });
      const failed = await runApply(payload(pre));
      expect(failed).toBe(1);
      await withConfiguredStore(root, async (store, context) => {
        const plan = await store.read({ projectId: context.projectId, branchId: context.branchId, subjectId: SUBJECT, kind: "plan", logicalName: "plan-x.md" });
        expect(plan?.links).toMatchObject([{ kind: "spec", logicalName: "spec-x.md" }]);
      });
    });

    it.each(["spec-x.md", "index.md"])("tombstones explicitly captured %s without recreating the source", async name => {
      await fixture(adapter);
      delete process.env.SQL_MEMORY_URL;
      const pre = preflight();
      const path = `.context/${SUBJECT}/${name}`;
      const apply = payload(pre);
      apply.spec_plans = [];
      Object.assign(apply, { deleted_sources: [path] });
      expect(await runApply(apply)).toBe(0);
      expect(existsSync(join(root, path))).toBe(false);
      await withConfiguredStore(root, async (store, context) => {
        const classified = classifyContextPath(path);
        expect(await store.read(consumerKey({ ...context, worktreeId: context.worktreeId!, runId: context.runId! }, classified.kind, classified.subjectId, classified.logicalName))).toBeNull();
        expect(await store.read({ projectId: context.projectId, branchId: context.branchId, subjectId: SUBJECT, kind: "plan", logicalName: "plan-x.md" })).not.toBeNull();
      });
    });

    it("archives adapter-only backlog bytes and retires the original scoped key", async () => {
      await fixture(adapter);
      delete process.env.SQL_MEMORY_URL;
      await withConfiguredStore(root, async (store, context) => {
        for (const [logicalName, body] of [["todo.md", "# Backlog\n\n- [ ] [Done](items/done.md)\n"], ["items/done.md", "---\ntitle: Done\nstatus: active\n---\n# Done\n\nKeep this evidence.\n"]]) {
          await executeWorkflowState({ cwd: root, store, context, role: "save", request: { operation: "write", ref: { subjectId: "backlog", kind: "backlog", logicalName: logicalName! }, body: body!, expectedRevision: null, links: [{ subjectId: SUBJECT, kind: "plan", logicalName: "plan-x.md" }] } });
        }
      });
      rmSync(join(root, ".context"), { recursive: true, force: true });
      const pre = preflight();
      const apply = payload(pre);
      Object.assign(apply, { backlog: { complete_explicit: [{ slug: "done", outcome: "Verified completion" }] } });
      expect(await runApply(apply)).toBe(0);
      await withConfiguredStore(root, async (store, context) => {
        const key = { projectId: context.projectId, branchId: context.branchId, subjectId: "backlog", kind: "backlog" as const };
        expect(await store.read({ ...key, logicalName: "items/done.md" })).toBeNull();
        const archived = await store.read({ ...key, logicalName: "archive/2026-10/done.md" });
        expect(new TextDecoder().decode(archived!.bytes)).toContain("Keep this evidence.");
        expect(archived?.links).toMatchObject([{ subjectId: SUBJECT, kind: "plan", logicalName: "plan-x.md" }]);
      });
    });

    it("binds explicit identity registries to the same native receipt and preserves completed replay", async () => {
      await fixture(adapter);
      process.env.SQL_MEMORY_URL = "configured-save-mode";
      const deps = { identityPath: join(root, "custom-identity.json"), configPath: process.env.BUCK_WORKFLOW_CONFIG };
      const attempt = prepareSaveAttempt(root, SUBJECT);
      if ("error" in attempt) throw new Error(attempt.error);
      const facts = ["Custom-registry decision"];
      const ids = await saveSqlFacts(root, attempt, facts, deps);
      await recordSaveMetadata(root, attempt, [], [], deps);
      await completeSaveAttempt(root, attempt, deps);
      expect(await saveSqlFacts(root, attempt, facts, deps)).toEqual(ids);
      rmSync(join(root, ".context"), { recursive: true, force: true });
      expect(await verifySqlSave(root, SUBJECT, deps, true, attempt.attemptId)).toEqual({ status: "verified" });
      await withConfiguredStore(root, async (store, context) => {
        const native = await executeWorkflowState({ cwd: root, store, context, identityPath: deps.identityPath, role: "read", request: { operation: "read-receipt" } });
        expect(native).toMatchObject({ runId: attempt.runId, attemptId: attempt.attemptId, status: "complete", artifactRevisions: ids });
      }, deps);
    });

    it("repairs an interrupted attempt-pointer write without duplicating facts or authorizing incomplete metadata", async () => {
      await fixture(adapter);
      process.env.SQL_MEMORY_URL = "configured-save-mode";
      const pre = preflight();
      const attempt = prepareSaveAttempt(root, SUBJECT);
      if ("error" in attempt) throw new Error(attempt.error);
      await withConfiguredStore(root, async (store, context) => {
        const deps = { store, context };
        const writeBatch = store.writeBatch.bind(store);
        store.writeBatch = async rows => {
          if (rows.some(row => row.key.subjectId === "save-attempts")) throw new Error("pointer fault");
          return writeBatch(rows);
        };
        await expect(saveSqlFacts(root, attempt, ["Retained decision"], deps)).rejects.toThrow("pointer fault");
        const facts = await store.list({ ...context, subjectId: SUBJECT, kind: "memory" });
        expect(await loadSaveAttempt(root, deps)).toBeNull();
        expect((await verifySqlSave(root, SUBJECT, deps)).status).not.toBe("verified");
        store.writeBatch = writeBatch;
        const ids = await saveSqlFacts(root, attempt, ["Retained decision"], deps);
        expect(ids).toEqual(facts.map(item => item.revision));
        expect(await loadSaveAttempt(root, deps)).toEqual(attempt);
        expect(await runApply(payload(pre, { path: attempt.receiptRel, ids }), deps)).toBe(0);
        expect(await verifySqlSave(root, SUBJECT, deps, true, attempt.attemptId)).toEqual({ status: "verified" });
      });
    });

    it.each(["update", "delete"])("keeps a published metadata predecessor in its owning branch during %s", async action => {
      await fixture(adapter);
      delete process.env.SQL_MEMORY_URL;
      const pre = preflight();
      await withConfiguredStore(root, async (store, context) => {
        const owner = { ...context, branchId: "published-owner" };
        const ref = { subjectId: SUBJECT, kind: "plan" as const, logicalName: "plan-published.md" };
        const original = "---\nstatus: active\n---\n# Published predecessor\n";
        await executeWorkflowState({ cwd: root, store, context: owner, role: "save", request: { operation: "write", ref, body: original, expectedRevision: null, links: [{ subjectId: SUBJECT, kind: "spec", logicalName: "spec-x.md" }] } });
        const predecessor = await store.read({ projectId: context.projectId, branchId: owner.branchId, ...ref });
        const consumer = { ...context, publishedRevisionIds: [predecessor!.revision] };
        const path = `.context/${SUBJECT}/${ref.logicalName}`;
        const apply = payload(pre);
        apply.spec_plans = [];
        apply.crossrefs = action === "update" ? [{ path, key: "memory", value: "../memory/save-repair.md" }] : [];
        Object.assign(apply, { storage_snapshot: { ...pre.storage_snapshot, [path]: { revision: predecessor!.revision, origin: "stored" } }, deleted_sources: action === "delete" ? [path] : [] });
        expect(await runApply(apply, { store, context: consumer })).toBe(0);
        const untouched = await store.read(predecessor!.key);
        expect(new TextDecoder().decode(untouched!.bytes)).toBe(original);
        expect(untouched?.revision).toBe(predecessor!.revision);
        const branchLocal = await store.read({ projectId: context.projectId, branchId: context.branchId, ...ref });
        if (action === "delete") expect(branchLocal).toBeNull();
        else {
          expect(new TextDecoder().decode(branchLocal!.bytes)).toContain("memory: [../memory/save-repair.md]");
          expect(branchLocal?.links).toEqual(predecessor?.links);
        }
      });
    });

    it.each(["fact", "metadata", "receipt", "readback"])("cannot report success after a %s boundary fault", async boundary => {
      await fixture(adapter);
      process.env.SQL_MEMORY_URL = "configured-save-mode";
      const pre = preflight();
      const attempt = prepareSaveAttempt(root, SUBJECT);
      if ("error" in attempt) throw new Error(attempt.error);
      await withConfiguredStore(root, async (store, context) => {
        const writeBatch = store.writeBatch.bind(store);
        const writeReceipt = store.writeReceipt.bind(store);
        const readReceipt = store.readReceipt.bind(store);
        store.writeBatch = async rows => {
          if (rows.some(row => boundary === "fact" ? row.key.kind === "memory" : boundary === "metadata" && row.source === "save-apply")) throw new Error(`${boundary} fault`);
          return writeBatch(rows);
        };
        if (boundary === "fact") {
          await expect(saveSqlFacts(root, attempt, ["fact"], { store, context })).rejects.toThrow("fact fault");
          expect(await readReceipt(context.projectId, attempt.runId)).toBeNull();
          return;
        }
        const ids = await saveSqlFacts(root, attempt, ["fact"], { store, context });
        store.writeReceipt = async receipt => {
          if (boundary === "receipt" && receipt.status === "complete") throw new Error("receipt fault");
          return writeReceipt(receipt);
        };
        store.readReceipt = async (projectId, runId) => {
          const receipt = await readReceipt(projectId, runId);
          return boundary === "readback" && receipt?.status === "complete" ? { ...receipt, metadataDuties: [] } : receipt;
        };
        expect(await runApply(payload(pre, { path: attempt.receiptRel, ids }), { store, context })).toBe(1);
        expect((await verifySqlSave(root, SUBJECT, { store, context })).status).not.toBe("verified");
      });
    });
  });
}
