import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { RepoFilesStorageStore } from "../storage/file-store.js";
import { artifactToken, executeWorkflowState, parseArtifactToken, readPinnedScopeSync, resolveTrustedContext, type TrustedWorkflowContext } from "./workflow-state.js";

const roots: string[] = [];
const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;
afterEach(() => {
  if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
  else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temp(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
function repo(): string {
  const cwd = temp("wf-repo-");
  git(cwd, ["init", "-b", "topic"]);
  git(cwd, ["config", "user.email", "wf@example.test"]);
  git(cwd, ["config", "user.name", "wf"]);
  writeFileSync(join(cwd, "README.md"), "topic\n");
  git(cwd, ["add", "README.md"]);
  git(cwd, ["commit", "-m", "init"]);
  git(cwd, ["remote", "add", "origin", "git@github.com:example/work.git"]);
  return cwd;
}
function context(over: Partial<TrustedWorkflowContext> = {}): TrustedWorkflowContext {
  return { projectId: "project-1", branchId: "branch-1", publishedRevisionIds: [], ...over };
}
function storeFor(cwd: string): RepoFilesStorageStore {
  const manifest = join(cwd, ".context", "workflow", "storage");
  return new RepoFilesStorageStore({ root: manifest, contextRoot: join(cwd, ".context"), manifestRoot: manifest });
}
function config(dir: string, yaml: string): void {
  const path = join(dir, "config.yaml");
  writeFileSync(path, yaml);
  process.env.BUCK_WORKFLOW_CONFIG = path;
}
const RUN = { worktreeId: "worktree-11111111-1111-4111-8111-111111111111", runId: "run-11111111-1111-4111-8111-111111111111" };

describe("workflow artifact tokens", () => {
  it("round-trips a logical reference and rejects caller scope inside the token", () => {
    const token = artifactToken({ subjectId: "2026-10-12.demo", kind: "plan", logicalName: "plan-demo.md", revision: "rev-1" });
    expect(parseArtifactToken(token)).toEqual({ subjectId: "2026-10-12.demo", kind: "plan", logicalName: "plan-demo.md", revision: "rev-1" });
    const scoped = `workflow-artifact:${Buffer.from(JSON.stringify({ subjectId: "s", kind: "plan", logicalName: "a.md", projectId: "other" })).toString("base64url")}`;
    expect(() => parseArtifactToken(scoped)).toThrow(/cannot supply projectId/);
  });
});

describe("workflow_state trusted operations", () => {
  it("writes and reads by token without a physical path and refuses caller scope", async () => {
    const cwd = temp("wf-exec-");
    const store = storeFor(cwd);
    const written = await executeWorkflowState({
      cwd, store, context: context(), role: "write",
      request: { operation: "write", ref: { subjectId: "2026-10-12.demo", kind: "research", logicalName: "research-demo.md" }, body: "visible fact\n" },
    }) as { token: string; revision: string };
    expect(written.token.startsWith("workflow-artifact:")).toBe(true);
    expect(written).not.toHaveProperty("path");
    const read = await executeWorkflowState({ cwd, store, context: context(), role: "read", request: { operation: "read", token: written.token } }) as { text: string; revision: string };
    expect(read).toMatchObject({ text: "visible fact\n", revision: written.revision });
    await expect(executeWorkflowState({
      cwd, store, context: context(), role: "admin",
      request: { operation: "list", projectId: "other-project" } as never,
    })).rejects.toThrow(/cannot supply projectId/);
  });

  it("denies writes to read roles, corrections to write roles, and cross-branch inspect to children", async () => {
    const cwd = temp("wf-role-");
    const bound = { cwd, store: storeFor(cwd), context: context() };
    await expect(executeWorkflowState({ ...bound, role: "read", request: { operation: "write", ref: { subjectId: "s", kind: "plan", logicalName: "plan.md" }, body: "no" } })).rejects.toThrow(/read role/);
    await expect(executeWorkflowState({ ...bound, role: "write", request: { operation: "correct", ref: { subjectId: "s", kind: "plan", logicalName: "plan.md" }, predecessorRevision: "r", body: null, idempotencyKey: "k" } })).rejects.toThrow(/write role/);
    await expect(executeWorkflowState({ ...bound, role: "write", request: { operation: "inspect", branchRef: "refs/heads/other" } })).rejects.toThrow(/write role/);
  });

  it("completes a save receipt only after readback matches the trusted scope", async () => {
    const cwd = temp("wf-receipt-");
    const bound = { cwd, store: storeFor(cwd), context: context(RUN), role: "save" as const };
    const written = await executeWorkflowState({
      ...bound,
      request: { operation: "write", ref: { subjectId: "2026-10-12.demo", kind: "memory", logicalName: "fact.md" }, body: "fact\n" },
    }) as { revision: string };
    const attempt = { operation: "write-receipt" as const, attemptId: "attempt-1", status: "attempted" as const, artifactRevisions: [written.revision], metadataDuties: ["readback"], kind: "rows" as const };
    await executeWorkflowState({ ...bound, request: attempt });
    const complete = await executeWorkflowState({
      ...bound,
      request: { ...attempt, status: "complete" },
    }) as { status: string; attemptId: string; branchId: string };
    expect(complete).toMatchObject({ status: "complete", attemptId: "attempt-1", branchId: "branch-1" });
    await expect(executeWorkflowState({
      ...bound,
      context: context({ ...RUN, branchId: "branch-other" }),
      request: { ...attempt, status: "complete" },
    })).rejects.toThrow(/receipt/);
    await expect(executeWorkflowState({
      ...bound,
      context: context({ ...RUN, branchId: "branch-other" }),
      request: { operation: "read-receipt" },
    })).rejects.toThrow(/bound context/);
  });

  it("searches only the bound branch and returns rank metadata", async () => {
    const cwd = temp("wf-search-");
    const store = storeFor(cwd);
    await executeWorkflowState({ cwd, store, context: context(), role: "write", request: { operation: "write", ref: { subjectId: "2026-10-12.demo", kind: "memory", logicalName: "a.md" }, body: "---\nvalue_score: 4\n---\nneedle alpha\n" } });
    await executeWorkflowState({ cwd, store, context: context({ branchId: "branch-other" }), role: "write", request: { operation: "write", ref: { subjectId: "2026-10-12.demo", kind: "memory", logicalName: "b.md" }, body: "needle private\n" } });
    const found = await executeWorkflowState({ cwd, store, context: context(), role: "read", request: { operation: "search", text: "needle" } }) as Array<{ logicalName: string; rank: number; valueScore?: number }>;
    expect(found.map((item) => item.logicalName)).toEqual(["a.md"]);
    expect(found[0]).toMatchObject({ rank: 1, valueScore: 4 });
  });
});

describe("visible reference resolution", () => {
  it("reads published tokens, prefers current overlays, and denies unlisted private tokens", async () => {
    const cwd = temp("wf-published-");
    const store = storeFor(cwd);
    const ref = { subjectId: "s", kind: "memory" as const, logicalName: "fact.md" };
    const write = (branchId: string, body: string) => executeWorkflowState({ cwd, store, context: context({ branchId }), role: "write", request: { operation: "write", ref, body } }) as Promise<{ revision: string; token: string }>;
    const published = await write("branch-published", "published fact");
    const privateRow = await write("branch-private", "PRIVATE BODY");
    const bound = { cwd, store, role: "read" as const, context: context({ publishedRevisionIds: [published.revision] }) };
    const listed = await executeWorkflowState({ ...bound, request: { operation: "list" } }) as Array<{ token: string }>;
    expect(await executeWorkflowState({ ...bound, request: { operation: "read", token: listed[0]!.token } })).toMatchObject({ text: "published fact" });
    expect(await executeWorkflowState({ ...bound, request: { operation: "read", token: privateRow.token } })).toBeNull();
    await write("branch-1", "overlay fact");
    expect(await executeWorkflowState({ ...bound, request: { operation: "read", ref } })).toMatchObject({ text: "overlay fact" });
  });
});

describe("portable executable access", () => {
  it("honors a project override and round-trips lifecycle, correction, tokens and receipts on a named branch", async () => {
    const cwd = repo();
    const home = temp("wf-cli-home-");
    const configPath = join(home, "config.yaml");
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: repo-files\nprojects:\n  review-project:\n    origins: [git@github.com:example/work.git]\n    storage:\n      adapter: external-files\n      root: ${join(home, "external")}\n`);
    const env = { ...process.env, XDG_CONFIG_HOME: home, BUCK_WORKFLOW_CONFIG: configPath };
    const cli = resolve("skills/_shared/scripts/workflow-state-cli.ts");
    const call = (op: string, input: unknown, subject = "2026-10-12.cli") => JSON.parse(execFileSync("bun", [cli, op, ...(subject ? ["--subject", subject] : []), JSON.stringify(input)], { cwd, env, encoding: "utf8" }));
    const draft = call("transition", { fromRevision: null, expectedState: "missing", intent: { kind: "initialize" }, evidence: [] });
    call("transition", { fromRevision: draft, expectedState: "draft", intent: { kind: "activate" }, evidence: [] });
    expect(call("inspect-lifecycle", {})).toMatchObject({ state: "active" });
    const written = call("write", { kind: "memory", logicalName: "fact.md", body: "first fact" });
    expect(call("read", { token: written.token }, "")).toMatchObject({ text: "first fact" });
    const corrected = call("correct", { token: written.token, predecessorRevision: written.revision, body: "corrected fact", idempotencyKey: "correction-1" });
    expect(call("read", { token: corrected.token }, "")).toMatchObject({ text: "corrected fact" });
    const receipt = { attemptId: "attempt-cli", artifactRevisions: [corrected.revision], kind: "rows", metadataDuties: ["readback"] };
    call("write-receipt", { ...receipt, status: "attempted" }, "");
    call("write-receipt", { ...receipt, status: "complete" }, "");
    expect(call("read-receipt", {}, "")).toMatchObject({ attemptId: "attempt-cli", status: "complete", artifactRevisions: [corrected.revision] });
    expect(existsSync(join(cwd, ".context"))).toBe(false);
  });

  it("keeps one branch and all workspace registrations under concurrent processes", async () => {
    const cwd = repo();
    const home = temp("wf-concurrent-");
    const path = join(home, "identities.json");
    const configPath = join(home, "config.yaml");
    writeFileSync(configPath, "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
    const module = resolve("skills/_shared/scripts/workflow-state.ts");
    const code = `import { resolveTrustedContext } from ${JSON.stringify(module)}; console.log(JSON.stringify(await resolveTrustedContext(process.cwd(), ${JSON.stringify({ identityPath: path, configPath })})));`;
    const execute = promisify(execFile);
    const results = await Promise.all(Array.from({ length: 8 }, () => execute("bun", ["-e", code], { cwd })));
    const contexts = results.map(item => JSON.parse(item.stdout));
    expect(new Set(contexts.map(item => item.branchId)).size).toBe(1);
    expect(new Set(contexts.map(item => item.worktreeId)).size).toBe(1);
    expect((await resolveTrustedContext(cwd, { identityPath: path, configPath })).branchId).toBe(contexts[0].branchId);
    // Rendezvous before the identity transaction, then slow continuity probes:
    // no lock can preserve all of these competing workspace registrations.
    const workspaces = Array.from({ length: 8 }, () => temp("wf-workspace-"));
    const barrier = join(home, "barrier");
    mkdirSync(barrier);
    const racingCode = `import { execFileSync } from "node:child_process"; import { writeFileSync, readdirSync } from "node:fs"; import { resolveTrustedContext } from ${JSON.stringify(module)}; const git = (_cwd, args) => { if (args[0] === "rev-parse" && args[1] === "HEAD") { writeFileSync(${JSON.stringify(barrier)} + "/" + process.pid, "ready"); const deadline = Date.now() + 10000; while (readdirSync(${JSON.stringify(barrier)}).length < 8) { if (Date.now() > deadline) throw new Error("rendezvous timeout"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1); } } if (args[0] === "merge-base") Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50); return { status: 0, stdout: execFileSync("git", args, {cwd: ${JSON.stringify(cwd)}, encoding: "utf8"}).trim() }; }; console.log(JSON.stringify(await resolveTrustedContext(process.cwd(), { ...${JSON.stringify({ identityPath: path, configPath })}, git })));`;
    await Promise.all(workspaces.map(workspace => execute("bun", ["-e", racingCode], { cwd: workspace })));
    const registry = JSON.parse(readFileSync(path, "utf8"));
    expect(Object.keys(registry.projects[contexts[0].projectId].workspaces).sort()).toEqual([cwd, ...workspaces].sort());
  });
});

describe("receipt run binding at the CLI boundary", () => {
  it("completes independent saves and does not resume another branch", () => {
    const cwd = repo();
    const home = temp("wf-runs-");
    const configPath = join(home, "config.yaml");
    writeFileSync(configPath, "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
    const env = { ...process.env, XDG_CONFIG_HOME: home, BUCK_WORKFLOW_CONFIG: configPath };
    const cli = resolve("skills/_shared/scripts/workflow-state-cli.ts");
    const call = (input: Record<string, unknown>) => {
      try {
        return { status: 0, stdout: execFileSync("bun", [cli, "write-receipt", JSON.stringify(input)], { cwd, env, encoding: "utf8" }), stderr: "" };
      } catch (error) {
        const failed = error as { status?: number; stdout?: string; stderr?: string };
        return { status: failed.status ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
      }
    };
    const read = () => {
      try {
        return { status: 0, stdout: execFileSync("bun", [cli, "read-receipt", "{}"], { cwd, env, encoding: "utf8" }), stderr: "" };
      } catch (error) {
        const failed = error as { status?: number; stdout?: string; stderr?: string };
        return { status: failed.status ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
      }
    };
    const receipt = { artifactRevisions: [], kind: "no-fact", metadataDuties: ["probe"] };
    const first = JSON.parse(call({ ...receipt, attemptId: "attempt-1", status: "attempted" }).stdout) as { runId: string; branchId: string };
    const firstComplete = JSON.parse(call({ ...receipt, attemptId: "attempt-1", status: "complete" }).stdout) as { runId: string };
    expect(firstComplete.runId).toBe(first.runId);
    const second = JSON.parse(call({ ...receipt, attemptId: "attempt-2", status: "attempted" }).stdout) as { runId: string };
    const secondComplete = JSON.parse(call({ ...receipt, attemptId: "attempt-2", status: "complete" }).stdout) as { runId: string };
    expect(second.runId).not.toBe(first.runId);
    expect(secondComplete.runId).toBe(second.runId);
    expect(JSON.parse(read().stdout)).toMatchObject({ attemptId: "attempt-2", status: "complete", runId: second.runId, branchId: first.branchId });
    const repeated = call({ ...receipt, attemptId: "attempt-1", status: "attempted" });
    expect(repeated.status).not.toBe(0);
    expect(repeated.stderr).toMatch(/already complete/);
    git(cwd, ["checkout", "-b", "other"]);
    const foreign = read();
    expect(foreign.status).not.toBe(0);
    expect(foreign.stdout).not.toContain(first.runId);
    expect(foreign.stdout).not.toContain(first.branchId);
    const otherAttempt = JSON.parse(call({ ...receipt, attemptId: "attempt-1", status: "attempted" }).stdout) as { runId: string; branchId: string };
    expect(otherAttempt.runId).not.toBe(first.runId);
    expect(otherAttempt.branchId).not.toBe(first.branchId);
    git(cwd, ["checkout", "topic"]);
    expect(JSON.parse(read().stdout)).toMatchObject({ attemptId: "attempt-2", runId: second.runId, branchId: first.branchId });
    const open = JSON.parse(call({ ...receipt, attemptId: "attempt-3", status: "attempted" }).stdout) as { runId: string };
    git(cwd, ["checkout", "other"]);
    git(cwd, ["checkout", "topic"]);
    const resumed = JSON.parse(call({ ...receipt, attemptId: "attempt-3", status: "complete" }).stdout) as { runId: string; status: string };
    expect(resumed).toMatchObject({ runId: open.runId, status: "complete" });
  });
});

describe("repo-files machine authority", () => {
  it("projects editable bodies without putting the immutable store inside Git", async () => {
    const cwd = repo();
    const home = temp("wf-manifest-");
    const configPath = join(home, "config.yaml");
    writeFileSync(configPath, "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
    const context = await resolveTrustedContext(cwd, { configPath, identityPath: join(home, "identity.json") });
    const written = await executeWorkflowState({ cwd, context, role: "write", request: { operation: "write", ref: { subjectId: "subject", kind: "plan", logicalName: "subject/plan.md" }, body: "editable plan" } }) as { token: string };
    expect(readFileSync(join(cwd, ".context", "subject", "plan.md"), "utf8")).toBe("editable plan");
    expect(existsSync(join(cwd, ".context", "workflow", "storage"))).toBe(false);
    expect(existsSync(join(context.manifestRoot!, "manifest.json"))).toBe(true);
    expect(await executeWorkflowState({ cwd, context, role: "read", request: { operation: "read", token: written.token } })).toMatchObject({ text: "editable plan" });
  });
});

describe("trusted context binding", () => {
  it("reuses a branch incarnation while HEAD descends from the initial tip and mints a new one after rewrite", async () => {
    const cwd = repo();
    config(temp("wf-cfg-"), "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
    const identityPath = join(temp("wf-id-"), "branch-identity.json");
    const options = { identityPath, configPath: process.env.BUCK_WORKFLOW_CONFIG };
    const first = await resolveTrustedContext(cwd, options);
    expect((await resolveTrustedContext(cwd, options)).branchId).toBe(first.branchId);
    expect(first.projectId).toMatch(/^origin-/);
    writeFileSync(join(cwd, "next.md"), "next\n");
    git(cwd, ["add", "next.md"]);
    git(cwd, ["commit", "-m", "next"]);
    expect((await resolveTrustedContext(cwd, options)).branchId).toBe(first.branchId);
    git(cwd, ["checkout", "--orphan", "unrelated"]);
    git(cwd, ["commit", "-m", "unrelated"]);
    const unrelated = git(cwd, ["rev-parse", "HEAD"]);
    git(cwd, ["checkout", "topic"]);
    git(cwd, ["reset", "--hard", unrelated]);
    expect((await resolveTrustedContext(cwd, options)).branchId).not.toBe(first.branchId);
  });

  it("reads an existing trusted worktree scope without inventing identity", async () => {
    const cwd = repo();
    const previousXdg = process.env.XDG_CONFIG_HOME;
    const xdg = temp("wf-pinned-xdg-");
    process.env.XDG_CONFIG_HOME = xdg;
    config(temp("wf-pinned-config-"), "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
    try {
      const context = await resolveTrustedContext(cwd, { configPath: process.env.BUCK_WORKFLOW_CONFIG });
      expect(readPinnedScopeSync(cwd)).toEqual({
        projectId: context.projectId,
        branchId: context.branchId,
        worktreeId: context.worktreeId,
        runId: context.runId,
        publishedRevisionIds: [],
      });
    } finally {
      if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousXdg;
    }
  });
  it("does not materialize canonical .context bodies for sqlite or external-files writes", async () => {
    const cwd = repo();
    const home = temp("wf-home-");
    const identityPath = join(home, "branch-identity.json");
    config(home, "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
    config(home, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(home, "state.sqlite")}\n`);
    const sqliteContext = await resolveTrustedContext(cwd, { identityPath, configPath: process.env.BUCK_WORKFLOW_CONFIG });
    const ref = { subjectId: "2026-10-12.demo", kind: "plan" as const, logicalName: "plan-demo.md" };
    await executeWorkflowState({
      cwd, identityPath, configPath: process.env.BUCK_WORKFLOW_CONFIG, context: sqliteContext, role: "write",
      request: { operation: "write", ref, body: "sqlite body\n" },
    });
    expect(existsSync(join(cwd, ".context", "2026-10-12.demo", "plan-demo.md"))).toBe(false);
    config(home, `version: 1\nstorage:\n  adapter: external-files\n  root: ${join(home, "external")}\n`);
    const externalContext = await resolveTrustedContext(cwd, { identityPath, configPath: process.env.BUCK_WORKFLOW_CONFIG });
    await executeWorkflowState({
      cwd, identityPath, configPath: process.env.BUCK_WORKFLOW_CONFIG, context: externalContext, role: "write",
      request: { operation: "write", ref, body: "external body\n" },
    });
    expect(existsSync(join(cwd, ".context", "2026-10-12.demo", "plan-demo.md"))).toBe(false);
    const read = await executeWorkflowState({
      cwd, identityPath, configPath: process.env.BUCK_WORKFLOW_CONFIG, context: externalContext, role: "read",
      request: { operation: "read", ref },
    }) as { text: string };
    expect(read.text).toBe("external body\n");
  });
});

describe("postgres opener", () => {
  it("requires the configured connection env and does not read SQL_MEMORY_URL", async () => {
    const home = temp("wf-pg-");
    config(home, "version: 1\nstorage:\n  adapter: postgres\n  connection_env: BUCK_WORKFLOW_DATABASE_URL\n");
    const previous = process.env.SQL_MEMORY_URL;
    const previousDb = process.env.BUCK_WORKFLOW_DATABASE_URL;
    process.env.SQL_MEMORY_URL = "postgres://should-not-be-used";
    delete process.env.BUCK_WORKFLOW_DATABASE_URL;
    try {
      await expect(executeWorkflowState({
        cwd: temp("wf-pg-cwd-"), identityPath: join(home, "identity.json"),
        configPath: process.env.BUCK_WORKFLOW_CONFIG, context: context(), role: "read", request: { operation: "list" },
      })).rejects.toThrow(/BUCK_WORKFLOW_DATABASE_URL/);
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
      if (previousDb === undefined) delete process.env.BUCK_WORKFLOW_DATABASE_URL;
      else process.env.BUCK_WORKFLOW_DATABASE_URL = previousDb;
    }
  });
});
