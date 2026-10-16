import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { proveAncestor, readPublicationLedger, recordRewriteMapping, resolvePublicationConflict } from "../storage/publication.js";
import { RepoFilesStorageStore, ExternalFilesStorageStore } from "../storage/file-store.js";
import { SQLiteStorageStore } from "../storage/sqlite-store.js";
import { PostgresStorageStore } from "../storage/postgres-store.js";
import { createLazyPool } from "../storage/db.js";
import { revisionHash } from "../storage/adapter-utils.js";
import type { ArtifactRevision, StorageStore } from "../storage/contract.js";
import { executeWorkflowState, resolveTrustedContext, type TrustedWorkflowContext, type WorkflowRequest } from "./workflow-state.js";

const roots: string[] = [];
const close: (() => unknown | Promise<unknown>)[] = [];
function git(cwd: string, ...args: string[]): string { return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "storage-publication-")); roots.push(root);
  git(root, "init", "-q", "-b", "main"); git(root, "config", "user.email", "test@example.invalid"); git(root, "config", "user.name", "test");
  writeFileSync(join(root, "file"), "base"); git(root, "add", "file"); git(root, "commit", "-qm", "base");
  return root;
}
function commit(cwd: string, name: string): string {
  writeFileSync(join(cwd, name), name); git(cwd, "add", name); git(cwd, "commit", "-qm", name); return git(cwd, "rev-parse", "HEAD");
}
function item(projectId: string, branchId: string, body: string, logicalName = "same-plan.md", kind: ArtifactRevision["key"]["kind"] = "plan"): ArtifactRevision {
  const bytes = new TextEncoder().encode(body);
  return { key: { projectId, branchId, subjectId: "subject", kind, logicalName }, revision: randomUUID(), bytes, sha256: revisionHash(bytes), author: "test", source: "fixture", createdAt: new Date().toISOString(), links: [] };
}
async function open(adapter: string, root: string): Promise<StorageStore> {
  if (adapter === "repo-files") return new RepoFilesStorageStore({ contextRoot: join(root, "projection"), manifestRoot: join(root, "manifest") });
  if (adapter === "external-files") return new ExternalFilesStorageStore({ projectKey: "fixture", root: join(root, "external") });
  if (adapter === "sqlite") { const store = await SQLiteStorageStore.open(join(root, "state.sqlite")); close.push(() => store.close()); return store; }
  const pool = createLazyPool(process.env.BUCK_WORKFLOW_TEST_DATABASE_URL!)(); close.push(() => pool.end());
  const store = new PostgresStorageStore(pool); await store.migrate(); return store;
}
function context(projectId: string, branchId: string): TrustedWorkflowContext {
  return { projectId, branchId, publishedRevisionIds: [], selection: { storage: { adapter: "repo-files" }, integrationRef: "refs/heads/main" } };
}
async function read(store: StorageStore, cwd: string, ctx: TrustedWorkflowContext, request: WorkflowRequest = { operation: "list", kind: "plan" }): Promise<Record<string, unknown>[]> {
  const result = await executeWorkflowState({ store, cwd, context: ctx, role: "admin", request });
  if (!Array.isArray(result)) throw new Error("expected artifact list");
  return result;
}
async function seal(store: StorageStore, cwd: string, revisions: ArtifactRevision[], baseline: string, source = git(cwd, "rev-parse", "HEAD")): Promise<string> {
  const id = await store.sealCheckpoint({ projectId: revisions[0]!.key.projectId, branchId: revisions[0]!.key.branchId!, commit: source, integrationTip: baseline, revisionSet: revisions.map(({ revision, sha256 }) => ({ revision, sha256 })) });
  await store.bindCheckpoint(id, git(cwd, "rev-parse", "HEAD"), cwd); return id;
}
async function correctPublished(store: StorageStore, cwd: string, ctx: TrustedWorkflowContext, predecessor: string, body: string): Promise<ArtifactRevision> {
  await executeWorkflowState({ store, cwd, context: ctx, role: "save", request: { operation: "correct", ref: { subjectId: "subject", kind: "plan", logicalName: "same-plan.md" }, predecessorRevision: predecessor, body, idempotencyKey: randomUUID() } });
  const result = (await store.checkpointSnapshot(ctx.projectId, ctx.branchId)).find(x => x.key.logicalName === "same-plan.md");
  if (!result) throw new Error("corrected artifact was not retained");
  return result;
}
afterEach(async () => { for (const dispose of close.splice(0)) await dispose(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const ADAPTERS = ["repo-files", "external-files", "sqlite", ...(process.env.BUCK_WORKFLOW_TEST_DATABASE_URL ? ["postgres"] : [])];

for (const adapter of ADAPTERS) describe(`${adapter} real Git publication`, () => {
  it.each(["--ff-only", "--no-ff"])("publishes sealed v1 after %s merge, retains v2 and run state privately, revokes on rewrite but not revert", async merge => {
    const cwd = repo(); const store = await open(adapter, cwd); const p = randomUUID(); const base = git(cwd, "rev-parse", "HEAD");
    git(cwd, "checkout", "-qb", "topic"); const source = commit(cwd, "source");
    const v1 = item(p, "topic", "sealed v1");
    const privateItems = (["run-state", "receipt", "audit", "checkpoint", "activity", "attribution"] as const).map(kind => item(p, "topic", `private ${kind}`, `${kind}.json`, kind));
    await store.writeBatch([v1, ...privateItems]); await seal(store, cwd, [v1, ...privateItems], base);
    const v2 = item(p, "topic", "unsealed v2"); await store.writeBatch([v2]);
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
    git(cwd, "checkout", "main"); git(cwd, "merge", merge, "topic", "-m", "integrate");
    expect(await read(store, cwd, context(p, "reader"))).toMatchObject([{ text: "sealed v1", revision: v1.revision }]);
    expect(await read(store, cwd, context(p, "reader"), { operation: "list" })).toMatchObject([{ text: "sealed v1", kind: "plan" }]);
    expect(await read(store, cwd, context(randomUUID(), "reader"))).toEqual([]);
    git(cwd, "revert", "--no-edit", source);
    expect(await read(store, cwd, context(p, "reader"))).toMatchObject([{ text: "sealed v1" }]);
    git(cwd, "update-ref", "refs/heads/main", base);
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
    expect(await store.read(v1.key, v1.revision)).toMatchObject({ sha256: v1.sha256 });
    git(cwd, "update-ref", "-d", "refs/heads/main");
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
  });

  it("proves bound OIDs, rejects unrelated binding, and never uses creation HEAD or mutable refs as authorization", async () => {
    const cwd = repo(); const store = await open(adapter, cwd); const p = randomUUID(); const base = git(cwd, "rev-parse", "HEAD");
    const v = item(p, "topic", "private"); await store.writeBatch([v]);
    await seal(store, cwd, [v], base, base);
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
    git(cwd, "checkout", "-qb", "topic"); const source = commit(cwd, "source");
    const id = await store.sealCheckpoint({ projectId: p, branchId: "topic", commit: base, integrationTip: base, revisionSet: [{ revision: v.revision, sha256: v.sha256 }] });
    await store.bindCheckpoint(id, "refs/heads/topic", cwd);
    expect((await store.listCheckpoints(p)).find(x => x.id === id)?.boundCommit).toBe(source);
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
    git(cwd, "checkout", "-qb", "other", base); const unrelated = commit(cwd, "other");
    const bad = await store.sealCheckpoint({ projectId: p, branchId: "topic", commit: source, integrationTip: base, revisionSet: [{ revision: v.revision, sha256: v.sha256 }] });
    await expect(store.bindCheckpoint(bad, unrelated, cwd)).rejects.toThrow(/unrelated/);
    git(cwd, "update-ref", "refs/heads/main", source); git(cwd, "update-ref", "refs/heads/topic", unrelated);
    expect(await read(store, cwd, context(p, "reader"))).toMatchObject([{ text: "private" }]);
    expect(proveAncestor(cwd, "missing", source).kind).toBe("error");
    expect(proveAncestor(cwd, source, base).kind).toBe("not-ancestor");
  });

  it.each(["squash", "rebase"])("keeps %s private until exact selected-checkpoint mapping and revokes unreachable mappings", async mode => {
    const cwd = repo(); const store = await open(adapter, cwd); const p = randomUUID(); const base = git(cwd, "rev-parse", "HEAD");
    git(cwd, "checkout", "-qb", "topic"); commit(cwd, "source");
    const a = item(p, "topic", "mapped A", "a.md"); const b = item(p, "topic", "mapped B", "b.md");
    await store.writeBatch([a, b]); const id = await seal(store, cwd, [a, b], base);
    git(cwd, "checkout", "main"); commit(cwd, "integration-change");
    if (mode === "squash") { git(cwd, "merge", "--squash", "topic"); git(cwd, "commit", "-qm", "squashed"); }
    else { git(cwd, "checkout", "topic"); git(cwd, "rebase", "main"); git(cwd, "checkout", "main"); git(cwd, "merge", "--ff-only", "topic"); }
    const target = git(cwd, "rev-parse", "HEAD");
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
    const mapping = { projectId: p, checkpointId: id, targetCommit: target, revisionSet: [a, b].map(({ revision, sha256 }) => ({ revision, sha256 })), evidence: ["operator-selected exact checkpoint to rewritten target"] };
    for (const invalid of [{ ...mapping, revisionSet: mapping.revisionSet.slice(0, 1) }, { ...mapping, checkpointId: "other" }, { ...mapping, revisionSet: [mapping.revisionSet[0]!, mapping.revisionSet[0]!] }, { ...mapping, evidence: ["patch-id:equal"] }]) {
      await expect(recordRewriteMapping(store, cwd, p, "main", invalid)).rejects.toThrow();
    }
    await recordRewriteMapping(store, cwd, p, "main", mapping);
    expect(await read(store, cwd, context(p, "reader"))).toEqual(expect.arrayContaining([expect.objectContaining({ text: "mapped A" }), expect.objectContaining({ text: "mapped B" })]));
    await executeWorkflowState({ store, cwd, context: context(p, "reader"), role: "admin", request: { operation: "revoke-mapping", checkpointId: id } });
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
    await recordRewriteMapping(store, cwd, p, "main", mapping);
    git(cwd, "update-ref", "refs/heads/main", base);
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
  });

  it("preserves logical-artifact conflicts and baseline, advances unrelated artifacts, and persists explicit resolution", async () => {
    const cwd = repo(); const store = await open(adapter, cwd); const p = randomUUID(); const base = git(cwd, "rev-parse", "HEAD");
    git(cwd, "checkout", "-qb", "seed"); const seedTip = commit(cwd, "seed");
    const baseline = item(p, "seed", "baseline"); await store.writeBatch([baseline]); await seal(store, cwd, [baseline], base);
    git(cwd, "checkout", "main"); git(cwd, "merge", "--ff-only", "seed");
    expect(await read(store, cwd, context(p, "reader"))).toMatchObject([{ text: "baseline" }]);
    git(cwd, "checkout", "-qb", "left"); commit(cwd, "left");
    const left = await correctPublished(store, cwd, context(p, "left"), baseline.revision, "left candidate");
    await seal(store, cwd, [left], seedTip);
    git(cwd, "checkout", "-qb", "right", seedTip); commit(cwd, "right");
    const right = await correctPublished(store, cwd, context(p, "right"), baseline.revision, "right candidate");
    const other = item(p, "right", "unrelated", "other.md"); await store.writeBatch([other]);
    // Code contains left, but this artifact still explicitly corrects only seed.
    git(cwd, "merge", "--no-ff", "left", "-m", "merge code without resolving knowledge");
    await seal(store, cwd, [right, other], seedTip);
    git(cwd, "checkout", "main"); git(cwd, "merge", "--no-ff", "left", "-m", "left"); git(cwd, "merge", "--no-ff", "right", "-m", "right");
    const values = await read(store, cwd, context(p, "reader")); expect(values.map(x => x.text).sort()).toEqual(["baseline", "unrelated"]);
    const ledger = await readPublicationLedger(store, p); expect(Object.values(ledger.value.view.conflicts)[0]?.map(x => x.revision).sort()).toEqual([left.revision, right.revision].sort());
    await resolvePublicationConflict(store, p, right.revision);
    expect((await read(store, cwd, context(p, "reader"))).map(x => x.text).sort()).toEqual(["right candidate", "unrelated"]);
    git(cwd, "checkout", "-qb", "third", seedTip); commit(cwd, "third");
    const third = item(p, "third", "third candidate"); await store.writeBatch([third]); await seal(store, cwd, [third], seedTip);
    git(cwd, "checkout", "main"); git(cwd, "merge", "--no-ff", "third", "-m", "third");
    await read(store, cwd, context(p, "reader"));
    const changed = await readPublicationLedger(store, p);
    expect(Object.values(changed.value.view.conflicts)[0]?.map(x => x.revision)).toContain(third.revision);
    await resolvePublicationConflict(store, p, third.revision);
    expect((await read(store, cwd, context(p, "reader"))).map(x => x.text).sort()).toEqual(["third candidate", "unrelated"]);
  });

  it("publishes an explicit tombstone snapshot without deleting immutable knowledge", async () => {
    const cwd = repo(); const store = await open(adapter, cwd); const p = randomUUID(); const base = git(cwd, "rev-parse", "HEAD");
    git(cwd, "checkout", "-qb", "topic"); const firstTip = commit(cwd, "first");
    const v1 = item(p, "topic", "retained original"); await store.writeBatch([v1]); await seal(store, cwd, [v1], base);
    git(cwd, "checkout", "main"); git(cwd, "merge", "--ff-only", "topic");
    expect(await read(store, cwd, context(p, "reader"))).toMatchObject([{ text: "retained original" }]);
    git(cwd, "checkout", "-qb", "deleter");
    const deletion: WorkflowRequest = { operation: "correct", ref: { subjectId: "subject", kind: "plan", logicalName: "same-plan.md" }, predecessorRevision: v1.revision, body: null, idempotencyKey: "delete" };
    const remove = () => executeWorkflowState({ store, cwd, context: context(p, "deleter"), role: "save", request: deletion });
    expect(await remove()).toBeNull();
    expect(await remove()).toBeNull();
    commit(cwd, "deletion");
    const snapshot = [...await store.checkpointSnapshot(p, "deleter")];
    await seal(store, cwd, snapshot, firstTip);
    git(cwd, "checkout", "main"); git(cwd, "merge", "--ff-only", "deleter");
    expect(await read(store, cwd, context(p, "reader"))).toEqual([]);
    expect(await store.read(v1.key, v1.revision)).toMatchObject({ sha256: v1.sha256 });
  });
});

it("actual configured save/commit binding and fresh trusted retrieval work across worktrees without project leakage", async () => {
  const cwd = repo(); const root = join(cwd, "machine"); mkdirSync(root);
  const config = join(root, "config.yaml"); const identity = join(root, "identity.json");
  git(cwd, "remote", "add", "origin", "https://example.invalid/project.git");
  writeFileSync(config, `version: 1\nprojects:\n  fixture:\n    origins: [https://example.invalid/project.git]\n    integration_ref: refs/heads/main\n    storage:\n      adapter: external-files\n      root: ${root}/artifacts\n`);
  const env = { ...process.env, BUCK_WORKFLOW_CONFIG: config, XDG_CONFIG_HOME: root };
  git(cwd, "checkout", "-qb", "topic");
  const run = (args: string[]) => JSON.parse(execFileSync("bun", [join(process.cwd(), "skills/_shared/scripts/workflow-state-cli.ts"), ...args], { cwd, env, encoding: "utf8" }));
  run(["write", "--subject", "subject", JSON.stringify({ kind: "plan", logicalName: "plan.md", body: "runtime seal v1" })]);
  const checkpointScript = `import {sealWorkflowCheckpoint,bindWorkflowCheckpoint} from ${JSON.stringify(join(process.cwd(), "skills/_shared/scripts/workflow-state.ts"))}; const id=await sealWorkflowCheckpoint(process.cwd()); console.log(JSON.stringify(id));`;
  const id = JSON.parse(execFileSync("bun", ["-e", checkpointScript], { cwd, env, encoding: "utf8" }));
  commit(cwd, "checkpoint");
  execFileSync("bun", ["-e", `import {bindWorkflowCheckpoint} from ${JSON.stringify(join(process.cwd(), "skills/_shared/scripts/workflow-state.ts"))}; await bindWorkflowCheckpoint(process.cwd(),${JSON.stringify(id)});`], { cwd, env });
  run(["write", "--subject", "subject", JSON.stringify({ kind: "plan", logicalName: "plan.md", body: "runtime unsealed v2" })]);
  const worktree = join(root, "reader"); git(cwd, "worktree", "add", "-q", worktree, "main"); git(worktree, "merge", "--ff-only", "topic");
  const result = JSON.parse(execFileSync("bun", [join(process.cwd(), "skills/_shared/scripts/workflow-state-cli.ts"), "list", "--subject", "subject"], { cwd: worktree, env, encoding: "utf8" }));
  expect(result).toMatchObject([{ text: "runtime seal v1" }]);
  const other = repo(); git(other, "remote", "add", "origin", "https://example.invalid/other.git");
  const ctx = await resolveTrustedContext(other, { configPath: config, identityPath: identity });
  expect(await executeWorkflowState({ cwd: other, context: ctx, request: { operation: "list", subjectId: "subject" }, role: "read", configPath: config, identityPath: identity })).toEqual([]);
});

it("fresh repo-files CLI keeps tracked post-seal projections out of the receiving branch overlay", () => {
  const cwd = repo(); const machine = join(cwd, "machine"); mkdirSync(machine);
  const config = join(machine, "config.yaml");
  git(cwd, "remote", "add", "origin", "https://example.invalid/projection.git");
  writeFileSync(config, "version: 1\nprojects:\n  projection:\n    origins: [https://example.invalid/projection.git]\n    integration_ref: refs/heads/main\n    storage:\n      adapter: repo-files\n");
  const env = { ...process.env, BUCK_WORKFLOW_CONFIG: config, XDG_CONFIG_HOME: machine };
  const cli = join(process.cwd(), "skills/_shared/scripts/workflow-state-cli.ts");
  const module = JSON.stringify(join(process.cwd(), "skills/_shared/scripts/workflow-state.ts"));
  const run = (at: string, op: string, input = {}) => JSON.parse(execFileSync("bun", [cli, op, "--subject", "subject", JSON.stringify(input)], { cwd: at, env, encoding: "utf8" }));
  const runtime = (code: string) => {
    const output = execFileSync("bun", ["-e", `import {sealWorkflowCheckpoint,bindWorkflowCheckpoint} from ${module}; ${code}`], { cwd, env, encoding: "utf8" });
    return JSON.parse(output);
  };
  git(cwd, "checkout", "-qb", "topic");
  const ref = { kind: "plan", logicalName: "plan-smoke.md" };
  const v1 = run(cwd, "write", { ...ref, body: "sealed v1" });
  const index = run(cwd, "write", { kind: "subject-index", logicalName: "index.md", body: "---\nstatus: active\n---\n" });
  const checkpoint = runtime("console.log(JSON.stringify(await sealWorkflowCheckpoint(process.cwd())));");
  git(cwd, "add", ".context"); git(cwd, "commit", "-qm", "sealed tracked snapshot");
  runtime(`await bindWorkflowCheckpoint(process.cwd(), ${JSON.stringify(checkpoint)}); console.log("null");`);
  writeFileSync(join(cwd, ".context/subject/plan-smoke.md"), "UNSEALED v2");
  writeFileSync(join(cwd, ".context/subject/index.md"), "---\nstatus: completed\n---\n");
  git(cwd, "add", ".context"); git(cwd, "commit", "-qm", "unsealed tracked edits");
  const reader = join(machine, "reader"); git(cwd, "worktree", "add", "-q", reader, "main");
  git(reader, "merge", "--ff-only", "topic");
  // Every request opens a fresh process and resolves its own trusted publication view.
  expect(run(reader, "list", { kind: "plan" })).toMatchObject([{ text: "sealed v1", revision: v1.revision }]);
  expect(run(reader, "search", { text: "UNSEALED" })).toEqual([]);
  expect(run(reader, "read", ref)).toMatchObject({ text: "sealed v1", revision: v1.revision });
  expect(run(reader, "discover").subjects).toMatchObject([{ revision: index.revision }]);
  expect(run(reader, "inspect-lifecycle").effectiveState).toBe("active");
  // New local files and direct edits still become branch-private drafts.
  writeFileSync(join(reader, ".context/subject/plan-local.md"), "local draft");
  expect(run(reader, "list", { kind: "plan" }).map((x: { text: string }) => x.text).sort()).toEqual(["local draft", "sealed v1"]);
  writeFileSync(join(reader, ".context/subject/plan-local.md"), "edited local draft");
  expect(run(reader, "read", { kind: "plan", logicalName: "plan-local.md" }).text).toBe("edited local draft");
  writeFileSync(join(reader, ".context/subject/plan-smoke.md"), "explicit reader edit");
  expect(run(reader, "list", { kind: "plan" }).map((x: { text: string }) => x.text).sort()).toEqual(["edited local draft", "explicit reader edit"]);
});

it.each(ADAPTERS)("%s lists deleted, renamed, recreated, detached and unborn scopes; selected recovery retains private bytes", async adapter => {
  const cwd = repo(); const identityPath = join(cwd, "identity.json"); const configPath = join(cwd, "config.yaml");
  writeFileSync(configPath, "version: 1\nprojects:\n  recovery:\n    origins: [https://example.invalid/recovery.git]\n    integration_ref: refs/heads/main\n");
  const store = await open(adapter, cwd);
  const resolve = () => resolveTrustedContext(cwd, { identityPath, configPath, origin: "https://example.invalid/recovery.git" });
  const call = async (request: WorkflowRequest) => executeWorkflowState({ cwd, store, context: await resolve(), role: "admin", identityPath, configPath, request });
  git(cwd, "checkout", "-qb", "topic"); const source = commit(cwd, "source"); const ctx = await resolve(); const v = item(ctx.projectId, ctx.branchId, "retained private"); await store.writeBatch([v]);
  git(cwd, "branch", "-m", "renamed"); git(cwd, "checkout", "main"); git(cwd, "branch", "-D", "renamed");
  git(cwd, "checkout", "-qb", "topic"); commit(cwd, "recreated"); const fresh = await resolve(); expect(fresh.branchId).not.toBe(ctx.branchId);
  expect(await call({ operation: "list", kind: "plan" })).toEqual([]);
  // In-process handler result; the request discriminant determines its shape.
  const scopes = await call({ operation: "recover" }) as { scopes: { branchId: string; reason: string; scopeToken: string }[] };
  const selected = scopes.scopes.find(x => x.branchId === ctx.branchId)!; expect(selected.reason).toBe("recreated-or-unprovable");
  await expect(call({ operation: "recover", action: "export" })).rejects.toThrow(/selected/);
  const exported = await call({ operation: "recover", scopeToken: selected.scopeToken, action: "export" }); expect(exported).toMatchObject({ items: [{ text: "retained private" }] });
  await call({ operation: "recover", scopeToken: selected.scopeToken, action: "rebind" }); expect(await call({ operation: "list", kind: "plan" })).toMatchObject([{ text: "retained private" }]);
  git(cwd, "checkout", "--detach", source); const detached = await resolve();
  const detachedItem = item(detached.projectId, detached.branchId, "detached private", "detached.md");
  await store.writeBatch([detachedItem]); await seal(store, cwd, [detachedItem], git(cwd, "rev-parse", "main"));
  git(cwd, "checkout", "--orphan", "unborn"); const unborn = await resolve();
  const unbornItem = item(unborn.projectId, unborn.branchId, "unborn private", "unborn.md");
  await store.writeBatch([unbornItem]);
  git(cwd, "commit", "--allow-empty", "-qm", "born workspace checkpoint");
  const bornTip = git(cwd, "rev-parse", "HEAD");
  await seal(store, cwd, [unbornItem], git(cwd, "rev-parse", "main"));
  git(cwd, "checkout", "main");
  git(cwd, "update-ref", "refs/heads/main", source);
  expect(await call({ operation: "list", kind: "plan" })).toEqual([]);
  git(cwd, "update-ref", "refs/heads/main", bornTip);
  expect(await call({ operation: "list", kind: "plan" })).toEqual([]);
  const all = await call({ operation: "recover" }) as { scopes: { branchId: string; reason: string; scopeToken: string }[] };
  expect(all.scopes.map(x => x.reason)).toEqual(expect.arrayContaining(["detached", "unborn"]));
  for (const scope of [detached, unborn]) {
    const selectedScope = all.scopes.find(x => x.branchId === scope.branchId)!;
    expect(await call({ operation: "recover", scopeToken: selectedScope.scopeToken, action: "export" })).toMatchObject({ items: [{ text: scope === detached ? "detached private" : "unborn private" }] });
  }
});
