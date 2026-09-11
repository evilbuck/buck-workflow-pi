import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultRunState } from "../types.js";
import {
  acquireLock,
  load,
  markPaused,
  migrate,
  reconcile,
  releaseLock,
  resolvePersistencePaths,
  save,
} from "../persistence.js";

const roots: string[] = [];

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(): Promise<{ root: string; paths: Awaited<ReturnType<typeof resolvePersistencePaths>> }> {
  const root = await mkdtemp(join(tmpdir(), "b-pr-manager-"));
  roots.push(root);
  const gitdir = `${root}-gitdir`;
  roots.push(gitdir);
  await mkdir(gitdir);
  await writeFile(join(root, ".git"), `gitdir: ${gitdir}\n`);
  return { root, paths: await resolvePersistencePaths(root) };
}

function run(overrides: Partial<ReturnType<typeof defaultRunState>> = {}) {
  return { ...defaultRunState(), owner: "acme", repo: "widget", prNumber: 42, worktreeId: "worktree", localHeadOid: "local", remoteHeadOid: "remote", baseHeadOid: "base", diffDigest: "digest", ...overrides };
}

describe("b-pr-manager persistence", () => {
  it("atomically preserves the last saved state when a temporary file remains", async () => {
    const { paths } = await fixture();
    await save(paths, run({ currentState: "fetching_feedback" }));
    await writeFile(`${paths.state(42)}.crashed.tmp`, "not json");
    await expect(load(paths, 42)).resolves.toMatchObject({ currentState: "fetching_feedback" });
  });

  it("stores checkpoints under the gitdir, never the worktree", async () => {
    const { root, paths } = await fixture();
    await save(paths, run());
    await expect(readFile(paths.state(42), "utf8")).resolves.toContain('"prNumber":42');
    await expect(readFile(join(root, "b-pr-manager", "pr-42.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("blocks a second live lock holder and permits a dead lock to be stolen", async () => {
    const { paths } = await fixture();
    const lock = await acquireLock(paths, 42, { pid: process.pid, sessionId: "one" });
    await expect(acquireLock(paths, 42, { pid: process.pid, sessionId: "two" })).rejects.toThrow("held");
    await releaseLock(lock);
    await mkdir(paths.directory, { recursive: true });
    await writeFile(paths.lock(42), JSON.stringify({ pid: 999_999_999, sessionId: "dead" }));
    const stolen = await acquireLock(paths, 42, { pid: process.pid, sessionId: "two" });
    await releaseLock(stolen);
  });

  it("migrates version zero and blocks unknown versions", () => {
    expect(migrate({ ...run(), schemaVersion: 0 }).schemaVersion).toBe(1);
    expect(() => migrate({ ...run(), schemaVersion: 99 })).toThrow("Unsupported");
  });

  it("reconciles a matching remote without a push instruction", () => {
    const result = reconcile(run({ currentState: "pushing" }), {
      owner: "acme", repo: "widget", prNumber: 42, worktreeId: "worktree", localHeadOid: "local", remoteHeadOid: "remote", baseHeadOid: "base", diffDigest: "digest", activeRebase: false, dirtyPaths: [], githubState: "OPEN",
    });
    expect(result).toMatchObject({ event: "RESUME_AND_RECONCILE", outcome: "reconcile" });
    expect(result).not.toHaveProperty("instruction");
  });

  it("settles a pending auto-merge checkpoint when GitHub reports merged", () => {
    const result = reconcile(run({ currentState: "enabling_auto_merge", autoMergeRequested: true }), {
      owner: "acme", repo: "widget", prNumber: 42, worktreeId: "worktree", localHeadOid: "local", remoteHeadOid: "remote", baseHeadOid: "base", diffDigest: "digest", activeRebase: false, dirtyPaths: [], githubState: "MERGED",
    });
    expect(result).toMatchObject({ outcome: "merged", state: { currentState: "merged" } });
  });

  it("blocks unknown dirt but permits recorded manager-owned paths", () => {
    const saved = run({ ownedDirtyPaths: ["managed.txt"] });
    const observed = { owner: "acme", repo: "widget", prNumber: 42, worktreeId: "worktree", localHeadOid: "local", remoteHeadOid: "remote", baseHeadOid: "base", diffDigest: "digest", activeRebase: false, githubState: "OPEN" as const };
    expect(reconcile(saved, { ...observed, dirtyPaths: ["other.txt"] }).outcome).toBe("blocked");
    expect(reconcile(saved, { ...observed, dirtyPaths: ["managed.txt"] }).outcome).toBe("reconcile");
  });

  it("persists a paused snapshot with its exact resume command", async () => {
    const { paths } = await fixture();
    await markPaused(paths, run());
    await expect(load(paths, 42)).resolves.toMatchObject({ currentState: "paused", lastEvent: "CANCEL", blockReason: { resumeCommand: "/b-pr-manager 42 --resume" } });
  });
});
