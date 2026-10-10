import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadStorageConfig, parseStorageConfig, resolveStorageConfig } from "../storage/config.js";
import { createBranchIdentity, createPrivateWorkspaceIdentity, createRunId, createWorktreeId, requireBranchIdentity, requireWorkspaceIdentity, resolveProjectIdentity, validateArtifactKey } from "../storage/identity.js";

const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;
afterEach(() => {
  if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
  else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
});

describe("storage configuration", () => {
  it("uses repo-files by default and applies exact project overrides", () => {
    const config = parseStorageConfig(`version: 1\nstorage:\n  adapter: repo-files\nprojects:\n  work:\n    origins: [git@github.com:example/work.git]\n    integration_ref: refs/remotes/origin/main\n    storage:\n      adapter: postgres\n      connection_env: DB_URL\n`);
    expect(resolveStorageConfig(config, "git@github.com:example/work.git").storage.adapter).toBe("postgres");
    expect(resolveStorageConfig(config, "https://example.com/other.git").storage.adapter).toBe("repo-files");
  });

  it("rejects unknown keys and credentials embedded in config", () => {
    expect(() => parseStorageConfig("version: 1\nstorage:\n  adapter: sqlite\n  password: secret\n")).toThrow(/unknown/i);
    expect(() => parseStorageConfig("version: 1\nstorage:\n  adapter: postgres\n  connection_string: postgres://user:pass@host/db\n")).toThrow(/unknown|secret|credential/i);
  });

  it("rejects secret-bearing aliases without disclosing them and rejects canonical ambiguity", () => {
    for (const origin of ["https://user:secret@example.test/repo.git", "https://example.test/repo.git?token=secret"]) {
      let failure: unknown;
      try {
        parseStorageConfig(`version: 1\nprojects:\n  work:\n    origins: ["${origin}"]\n`);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).toMatch(/credential|secret/i);
      expect(String(failure)).not.toContain(origin);
    }
    expect(() => parseStorageConfig(`version: 1\nprojects:\n  a:\n    origins: ["https://EXAMPLE.test/repo.git/"]\n  b:\n    origins: ["https://example.test/repo.git"]\n`)).toThrow(/ambiguous/i);
  });

  it("matches incoming credential-bearing origins using the identity canonical form", () => {
    const config = parseStorageConfig(`version: 1\nprojects:\n  work:\n    origins: ["https://example.test/repo.git/"]\n    storage:\n      adapter: postgres\n      connection_env: DB_URL\n`);
    const incoming = "https://user:secret@EXAMPLE.test/repo.git?token=secret";
    expect(resolveStorageConfig(config, incoming)).toMatchObject({ projectKey: "work", storage: { adapter: "postgres" } });
    expect(resolveProjectIdentity({ origin: incoming }).projectId).toBe(resolveProjectIdentity({ origin: config.projects.work!.origins[0] }).projectId);
  });

  it("honors BUCK_WORKFLOW_CONFIG as a path override and resolves project configuration", async () => {
    const dir = mkdtempSync(join(tmpdir(), "storage-config-"));
    try {
      const path = join(dir, "alternate.yaml");
      writeFileSync(path, "version: 1\nprojects:\n  work:\n    origins: [ssh://example.test/work.git]\n    storage:\n      adapter: external-files\n");
      process.env.BUCK_WORKFLOW_CONFIG = path;
      const resolved = await loadStorageConfig({ origin: "ssh://example.test/work.git" });
      expect(resolved.configPath).toBe(path);
      expect(resolved.projectKey).toBe("work");
      expect(resolved.storage.adapter).toBe("external-files");
      expect(resolved.storage.root).toContain("{project}");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("project identity", () => {
  it("redacts credentials and derives a filesystem-safe project key", () => {
    const identity = resolveProjectIdentity({ origin: "https://user:secret@example.com/team/repo.git" });
    expect(identity.projectId).not.toContain("secret");
    expect(identity.projectId).toMatch(/^[a-z0-9_-]+$/);
  });


  it("refuses unresolved relative remotes in independent real checkouts and shares absolute origins across worktrees", () => {
    const root = mkdtempSync(join(tmpdir(), "storage-git-"));
    const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    try {
      const identities: string[] = [];
      for (const name of ["a", "b"]) {
        const parent = join(root, name);
        git(root, "init", "--bare", join(parent, "upstream.git"));
        const checkout = join(parent, "checkout");
        git(root, "clone", join(parent, "upstream.git"), checkout);
        git(checkout, "remote", "set-url", "origin", "../upstream.git");
        const origin = git(checkout, "remote", "get-url", "origin");
        const gitCommonDir = git(checkout, "rev-parse", "--path-format=absolute", "--git-common-dir");
        expect(() => resolveProjectIdentity({ origin, gitCommonDir })).toThrow(/local|relative|ambiguous/i);
        git(checkout, "remote", "set-url", "origin", join(parent, "upstream.git"));
        identities.push(resolveProjectIdentity({ origin: git(checkout, "remote", "get-url", "origin") }).projectId);
        git(checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--allow-empty", "-m", "fixture");
        const worktree = join(parent, "worktree");
        git(checkout, "worktree", "add", "-b", "topic", worktree);
        expect(resolveProjectIdentity({ origin: git(worktree, "remote", "get-url", "origin") }).projectId).toBe(identities.at(-1));
      }
      expect(identities[0]).not.toBe(identities[1]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("refuses missing or ambiguous identity and traversal-capable artifact names", () => {
    expect(() => resolveProjectIdentity({})).toThrow(/identity/i);
    expect(() => requireBranchIdentity(undefined)).toThrow(/missing or ambiguous/i);
    expect(() => validateArtifactKey({ projectId: "p", subjectId: "s", kind: "plan", logicalName: "../secret" })).toThrow(/relative|path/i);
    expect(() => validateArtifactKey({ projectId: "../project", subjectId: "s", kind: "plan", logicalName: "safe.md" })).toThrow(/opaque|safe/i);
  });
  it("creates unique persisted branch, worktree, and run identities from verified input", () => {
    const first = createBranchIdentity("refs/heads/topic", "a".repeat(40));
    const second = createBranchIdentity("refs/heads/topic", "a".repeat(40));
    expect(first.branchId).not.toBe(second.branchId);
    expect(requireBranchIdentity(first)).toEqual(first);
    expect(createWorktreeId()).not.toBe(createWorktreeId());
    expect(createRunId()).not.toBe(createRunId());
    expect(() => createBranchIdentity("refs/heads/topic/", "a".repeat(40))).toThrow(/canonical local branch ref/i);
  });

  it("gives detached or no-Git workspaces private branch and run scopes", () => {
    const worktreeId = createWorktreeId();
    const runId = createRunId();
    const privateScope = createPrivateWorkspaceIdentity({ projectId: "project", workspaceNonce: "nonce", worktreeId, runId });
    expect(requireWorkspaceIdentity(privateScope)).toEqual(privateScope);
    expect(privateScope).toMatchObject({ projectId: "project", worktreeId, runId, private: true });
    expect(privateScope.branchId).toMatch(/^private-/);
    expect(() => createPrivateWorkspaceIdentity({ projectId: "project", workspaceNonce: "nonce", worktreeId: "../outside", runId })).toThrow(/unsafe|workspace/i);
  });
});
