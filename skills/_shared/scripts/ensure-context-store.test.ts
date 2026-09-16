import { afterAll, afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  ensureContextStore,
  isGitignored,
  normalizeOriginUrl,
  resolveOriginSlug,
} from "./ensure-context-store.js";

const temps: string[] = [];
const originalXdg = process.env.XDG_DATA_HOME;
const originalGitGlobal = process.env.GIT_CONFIG_GLOBAL;
const originalGitSystem = process.env.GIT_CONFIG_SYSTEM;
const originalGitNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

function tmpRoot(prefix = "ensure-context-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
}

function git(cwd: string, args: string[]): void {
  execFileSync("git", ["-c", "init.defaultBranch=main", ...args], {
    cwd,
    env: gitEnv(),
    stdio: "pipe",
  });
}

function initRepo(
  cwd: string,
  opts: { origin?: string; ignoreContext?: boolean } = {},
): void {
  git(cwd, ["init"]);
  if (opts.ignoreContext) {
    writeFileSync(join(cwd, ".gitignore"), ".context\n");
  }
  if (opts.origin) {
    git(cwd, ["remote", "add", "origin", opts.origin]);
  }
}

afterEach(() => {
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdg;
  while (temps.length > 0) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

afterAll(() => {
  if (originalGitGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = originalGitGlobal;
  if (originalGitSystem === undefined) delete process.env.GIT_CONFIG_SYSTEM;
  else process.env.GIT_CONFIG_SYSTEM = originalGitSystem;
  if (originalGitNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = originalGitNoSystem;
});

describe("normalizeOriginUrl", () => {
  it("normalizes HTTPS, SSH, SCP, and trailing .git into host/org/repo", () => {
    expect(normalizeOriginUrl("https://github.com/evilbuck/buck-workflow-pi.git")).toBe(
      "github.com/evilbuck/buck-workflow-pi",
    );
    expect(normalizeOriginUrl("git@github.com:evilbuck/buck-workflow-pi.git")).toBe(
      "github.com/evilbuck/buck-workflow-pi",
    );
    expect(normalizeOriginUrl("ssh://git@github.com/evilbuck/buck-workflow-pi.git")).toBe(
      "github.com/evilbuck/buck-workflow-pi",
    );
    expect(normalizeOriginUrl("https://github.com/evilbuck/buck-workflow-pi/")).toBe(
      "github.com/evilbuck/buck-workflow-pi",
    );
  });
});

describe("resolveOriginSlug", () => {
  it("returns the nested host/org/repo slug from origin, or null with no remote", () => {
    const withOrigin = tmpRoot();
    initRepo(withOrigin, {
      origin: "https://github.com/acme/widgets.git",
    });
    expect(resolveOriginSlug(withOrigin)).toBe("github.com/acme/widgets");

    const noOrigin = tmpRoot();
    initRepo(noOrigin);
    expect(resolveOriginSlug(noOrigin)).toBeNull();
  });
});

  it("rejects absolute and traversal origin remotes before creating .context", () => {
    for (const origin of [
      "/tmp/local-remote.git",
      "https://github.com/../../../../escaped.git",
    ]) {
      const cwd = tmpRoot();
      const xdg = tmpRoot("xdg-");
      process.env.XDG_DATA_HOME = xdg;
      initRepo(cwd, { origin, ignoreContext: true });

      expect(() => ensureContextStore(cwd)).toThrow(
        "origin must normalize to host/org/repo",
      );
      expect(existsSync(join(cwd, ".context"))).toBe(false);
    }
  });

describe("isGitignored", () => {
  it("is true only when git check-ignore reports .context ignored", () => {
    const ignored = tmpRoot();
    initRepo(ignored, { ignoreContext: true });
    expect(isGitignored(ignored, ".context")).toBe(true);

    const tracked = tmpRoot();
    initRepo(tracked);
    expect(isGitignored(tracked, ".context")).toBe(false);
  });
});

describe("ensureContextStore", () => {
  it("leaves a real .context directory untouched even when gitignored with origin", () => {
    const cwd = tmpRoot();
    const xdg = tmpRoot("xdg-");
    process.env.XDG_DATA_HOME = xdg;
    initRepo(cwd, {
      origin: "https://github.com/acme/widgets.git",
      ignoreContext: true,
    });
    const contextDir = join(cwd, ".context");
    mkdirSync(join(contextDir, "memory"), { recursive: true });
    writeFileSync(join(contextDir, "memory", "keep.md"), "stay\n");

    const result = ensureContextStore(cwd);

    expect(result.mode).toBe("in-repo");
    expect(result.action).toBe("untouched");
    const st = lstatSync(contextDir);
    expect(st.isSymbolicLink()).toBe(false);
    expect(st.isDirectory()).toBe(true);
  });

  it("creates an XDG store and symlink when .context is missing, gitignored, and origin exists", () => {
    const cwd = tmpRoot();
    const xdg = tmpRoot("xdg-");
    process.env.XDG_DATA_HOME = xdg;
    initRepo(cwd, {
      origin: "https://github.com/acme/widgets.git",
      ignoreContext: true,
    });

    const result = ensureContextStore(cwd);

    const store = join(xdg, "buck/projects/github.com/acme/widgets");
    expect(result.mode).toBe("external");
    expect(result.action).toBe("created-store");
    expect(result.storePath).toBe(store);
    expect(lstatSync(join(cwd, ".context")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(cwd, ".context"))).toBe(store);
    expect(lstatSync(join(store, "memory")).isDirectory()).toBe(true);
    expect(lstatSync(join(store, "backlog")).isDirectory()).toBe(true);
  });

  it("is a no-op on a second run once the store and symlink exist", () => {
    const cwd = tmpRoot();
    const xdg = tmpRoot("xdg-");
    process.env.XDG_DATA_HOME = xdg;
    initRepo(cwd, {
      origin: "https://github.com/acme/widgets.git",
      ignoreContext: true,
    });

    ensureContextStore(cwd);
    const second = ensureContextStore(cwd);

    expect(second.mode).toBe("external");
    expect(second.action).toBe("noop");
    expect(second.warning).toBeUndefined();
  });


  it("does not create a symlink when gitignore only has directory-only .context/", () => {
    const cwd = tmpRoot();
    const xdg = tmpRoot("xdg-");
    process.env.XDG_DATA_HOME = xdg;
    initRepo(cwd, { origin: "https://github.com/acme/widgets.git" });
    writeFileSync(join(cwd, ".gitignore"), ".context/\n");

    const result = ensureContextStore(cwd);

    expect(result.mode).toBe("in-repo");
    expect(result.action).toBe("mkdir");
    expect(lstatSync(join(cwd, ".context")).isSymbolicLink()).toBe(false);
  });

  it("mkdirs in-repo .context/memory when missing and not gitignored", () => {
    const cwd = tmpRoot();
    initRepo(cwd, { origin: "https://github.com/acme/widgets.git" });

    const result = ensureContextStore(cwd);

    expect(result.mode).toBe("in-repo");
    expect(result.action).toBe("mkdir");
    const st = lstatSync(join(cwd, ".context"));
    expect(st.isSymbolicLink()).toBe(false);
    expect(lstatSync(join(cwd, ".context", "memory")).isDirectory()).toBe(true);
  });

  it("mkdirs in-repo with a note when gitignored but origin is missing", () => {
    const cwd = tmpRoot();
    initRepo(cwd, { ignoreContext: true });

    const result = ensureContextStore(cwd);

    expect(result.mode).toBe("in-repo");
    expect(result.action).toBe("mkdir");
    expect(result.note).toBe(
      ".context is gitignored but this repo has no origin remote; created in-repo .context/memory (will not sync across machines)",
    );
    expect(lstatSync(join(cwd, ".context")).isSymbolicLink()).toBe(false);
  });

  it("warns when a symlink exists but .context is no longer gitignored", () => {
    const cwd = tmpRoot();
    const xdg = tmpRoot("xdg-");
    process.env.XDG_DATA_HOME = xdg;
    initRepo(cwd, {
      origin: "https://github.com/acme/widgets.git",
      ignoreContext: true,
    });
    ensureContextStore(cwd);
    writeFileSync(join(cwd, ".gitignore"), "# no longer ignoring context\n");

    const result = ensureContextStore(cwd);

    expect(result.mode).toBe("external");
    expect(result.warning).toBe(
      ".context is a symlink but is not gitignored; committing it would leak the store path",
    );
  });

  it("repairs a dangling symlink by recreating the store layout and keeping the link", () => {
    const cwd = tmpRoot();
    const xdg = tmpRoot("xdg-");
    process.env.XDG_DATA_HOME = xdg;
    initRepo(cwd, {
      origin: "https://github.com/acme/widgets.git",
      ignoreContext: true,
    });
    const store = join(xdg, "buck/projects/github.com/acme/widgets");
    symlinkSync(relative(cwd, store), join(cwd, ".context"));

    const result = ensureContextStore(cwd);

    expect(result.mode).toBe("external");
    expect(result.action).toBe("repaired-dangling");
    expect(lstatSync(join(cwd, ".context")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(cwd, ".context"))).toBe(relative(cwd, store));
    expect(result.storePath).toBe(store);
    expect(lstatSync(join(store, "memory")).isDirectory()).toBe(true);
    expect(lstatSync(join(store, "backlog")).isDirectory()).toBe(true);
  });

  it("rejects a symlink outside the current repository store without writing to it", () => {
    const cwd = tmpRoot();
    const xdg = tmpRoot("xdg-");
    const foreign = join(tmpRoot("foreign-"), "store");
    process.env.XDG_DATA_HOME = xdg;
    initRepo(cwd, {
      origin: "https://github.com/acme/widgets.git",
      ignoreContext: true,
    });
    symlinkSync(foreign, join(cwd, ".context"));

    expect(() => ensureContextStore(cwd)).toThrow(
      "points outside this repository's external store",
    );
    expect(existsSync(join(foreign, "memory"))).toBe(false);
    expect(existsSync(join(foreign, "backlog"))).toBe(false);
  });

  it("points two worktrees with the same origin at one XDG store", () => {
    const xdg = tmpRoot("xdg-");
    process.env.XDG_DATA_HOME = xdg;
    const a = tmpRoot();
    const b = tmpRoot();
    initRepo(a, {
      origin: "https://github.com/acme/widgets.git",
      ignoreContext: true,
    });
    initRepo(b, {
      origin: "git@github.com:acme/widgets.git",
      ignoreContext: true,
    });

    ensureContextStore(a);
    ensureContextStore(b);

    const store = join(xdg, "buck/projects/github.com/acme/widgets");
    expect(readlinkSync(join(a, ".context"))).toBe(store);
    expect(readlinkSync(join(b, ".context"))).toBe(store);
  });
});
