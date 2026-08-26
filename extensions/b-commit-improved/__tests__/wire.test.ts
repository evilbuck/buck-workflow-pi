import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fallbackDraft, hasCommitPlaceholders, wire } from "../index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Minimal mock: only the ExtensionAPI surface b-commit-improved touches (registerCommand).
function createMockApi(): { api: ExtensionAPI; commands: Map<string, Record<string, unknown>> } {
  const commands = new Map<string, Record<string, unknown>>();
  const api = {
    on: vi.fn(),
    registerCommand: vi.fn((name: string, opts: Record<string, unknown>) => {
      commands.set(name, opts);
    }),
    registerTool: vi.fn(),
  } as unknown as ExtensionAPI;
  return { api, commands };
}

describe("b-commit-improved wire", () => {
  it("registers the b-commit-improved command with a handler and description", () => {
    const { api, commands } = createMockApi();
    wire(api);
    expect(commands.has("b-commit-improved")).toBe(true);
    const cmd = commands.get("b-commit-improved") as { handler: Function; description?: string };
    expect(typeof cmd.handler).toBe("function");
    expect(cmd.description).toBeTruthy();
  });

  it("completes the known flags", () => {
    const { api, commands } = createMockApi();
    wire(api);
    const cmd = commands.get("b-commit-improved") as {
      getArgumentCompletions?: (prefix: string) => Array<{ value: string }>;
    };
    expect(cmd.getArgumentCompletions).toBeTypeOf("function");
    const completions = cmd.getArgumentCompletions!("--")
      .map((c) => c.value)
      .sort();
    expect(completions).toEqual(["--dry-run", "--force", "--model", "--no-draft"]);
  });

  it("parseArgs-style behaviour: handler is async and accepts an args string", async () => {
    const { api, commands } = createMockApi();
    wire(api);
    const cmd = commands.get("b-commit-improved") as { handler: Function };
    // Returned handler is async — the return is a Promise even when preflight
    // short-circuits on a missing repo.
    const result = cmd.handler("--dry-run", { cwd: "/nonexistent", ui: { notify: () => {} } });
    expect(result).toBeInstanceOf(Promise);
    await result;
  });
});

describe("b-commit-improved progress", () => {
  it("emits a preflight status line before the bun child result is used", async () => {
    const dir = makeRepo();
    try {
      const { api, commands } = createMockApi();
      wire(api);
      const cmd = commands.get("b-commit-improved") as { handler: (args: string, ctx: unknown) => Promise<void> };
      const calls: string[] = [];
      await cmd.handler("", { cwd: dir, ui: { notify: (m: string) => calls.push(m) } });
      expect(calls[0]).toMatch(/preflight/i);
      expect(calls.some((m) => /Nothing staged/i.test(m))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Build a throwaway git repo on a non-protected branch with a commit already on
// the branch, so the preflight script can resolve a HEAD ref.
function makeRepo(branchName = "feature/x"): string {
  const dir = mkdtempSync(join(tmpdir(), "bci-"));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@t",
  };
  const g = (a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", env, stdio: ["pipe", "pipe", "pipe"] });
  g(["init", "-q", "-b", branchName]);
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "# test\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "init"]);
  return dir;
}

function makeProtectedRepo(): string {
  // We need a repo on a protected branch but with an existing commit so HEAD
  // is resolvable. The preflight guard checks the branch name; we use "main".
  return makeRepo("main");
}

const SCRIPT = join(
  process.cwd(),
  "skills",
  "git-commit-improved",
  "scripts",
  "commit-preflight.ts",
);

function runScript(args: string[], cwd: string): { code: number; json: Record<string, unknown> | null } {
  try {
    const stdout = execFileSync("bun", [SCRIPT, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, json: JSON.parse(stdout) as Record<string, unknown> };
  } catch (e: unknown) {
    const err = e as Error & { stdout?: Buffer; status?: number };
    const stdout = err.stdout?.toString() ?? "";
    return {
      code: typeof err.status === "number" ? err.status : 1,
      json: stdout ? (JSON.parse(stdout) as Record<string, unknown>) : null,
    };
  }
}

describe("b-commit-improved deterministic plumbing", () => {
  it("exits 3 with `nothing staged` when the index is clean", () => {
    const dir = makeRepo();
    try {
      const r = runScript([], dir);
      expect(r.code).toBe(3);
      expect(r.json?.error).toBe("nothing staged");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits 2 on a protected branch when --force is not set", () => {
    const dir = makeProtectedRepo();
    try {
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const r = runScript([], dir);
      expect(r.code).toBe(2);
      expect(r.json?.current_branch).toBe("main");
      expect(typeof r.json?.error).toBe("string");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits 0 with staged files and populated JSON on --force", () => {
    const dir = makeProtectedRepo();
    try {
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const r = runScript(["--force"], dir);
      expect(r.code).toBe(0);
      expect(r.json?.current_branch).toBe("main");
      expect(r.json?.staged_files).toEqual(["a.txt"]);
      expect(typeof r.json?.diff).toBe("string");
      expect(r.json?.draft).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits 1 on detached HEAD", () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      // Detach HEAD
      execFileSync("git", ["checkout", "--detach", "HEAD"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const r = runScript(["--force"], dir);
      expect(r.code).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses a draft-commit.md into {title, body}", () => {
    const dir = makeProtectedRepo();
    try {
      // Subject folder + staged file
      const subject = ".context/2026-07-25.test-session";
      execFileSync("mkdir", ["-p", join(dir, subject)], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      writeFileSync(
        join(dir, subject, "draft-commit.md"),
        "## Title\n\nfeat: hello\n\n## Body\n\nfirst body line\n\nmore body\n",
      );
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const r = runScript(["--force"], dir);
      expect(r.code).toBe(0);
      expect(r.json?.subject_folder).toBe(subject);
      expect(r.json?.draft).toEqual({ title: "feat: hello", body: "first body line\n\nmore body" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("picks the lexicographically-latest subject folder (regression: bash glob replaced with readdirSync)", () => {
    const dir = makeProtectedRepo();
    try {
      // Three folders, latest by name wins. Also include a non-dated entry
      // that must be ignored.
      execFileSync("mkdir", ["-p", join(dir, ".context/2026-07-20.alpha")], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      execFileSync("mkdir", ["-p", join(dir, ".context/2026-07-25.beta")], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      execFileSync("mkdir", ["-p", join(dir, ".context/2026-07-22.gamma")], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      execFileSync("mkdir", ["-p", join(dir, ".context/random-not-a-date")], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const r = runScript(["--force"], dir);
      expect(r.code).toBe(0);
      expect(r.json?.subject_folder).toBe(".context/2026-07-25.beta");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("fallbackDraft", () => {
    it("writes a draft-commit.md with both headings, the diff body, and a re-run hint", () => {
      const dir = makeRepo();
      try {
        const subject = ".context/2026-07-25.fallback-test";
        const subjectAbs = join(dir, subject);
        execFileSync("mkdir", ["-p", subjectAbs], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
        const diff = "diff --git a/x.txt b/x.txt\nnew file mode 100644\n+hello\n";
        const written = fallbackDraft(
          dir,
          subject,
          diff,
          ["x.txt"],
          "context: testing the fallback",
          "no model available",
        );
        expect(written).toBe(join(subject, "draft-commit.md"));
        const writtenAbs = join(dir, written);
        expect(existsSync(writtenAbs)).toBe(true);
        const content = readFileSync(writtenAbs, "utf-8");
        expect(content).toContain("## Title");
        expect(content).toContain("## Body");
        expect(content).toContain(diff);
        expect(content).toContain("Replace $TITLE and $BODY");
        expect(content).toMatch(/^## Title\n\n\$TITLE$/m);
        expect(content).toContain("$BODY");
        expect(content).not.toContain("feat: <short summary>");
        expect(content).toContain("no model available");
      } finally {
        rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to the root .context/ path when no subject folder is set", () => {
    const dir = makeRepo();
    try {
      execFileSync("mkdir", ["-p", join(dir, ".context")], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const written = fallbackDraft(dir, null, "diff --git\n+x", ["x.txt"], "", "model error");
      expect(written).toBe(".context/draft-commit.md");
      expect(existsSync(join(dir, written))).toBe(true);
      const content = readFileSync(join(dir, written), "utf-8");
      expect(content).toContain("## Title");
      expect(content).toContain("## Body");
      expect(content).toContain("model error");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function headSubject(cwd: string): string {
  return execFileSync("git", ["log", "-1", "--format=%s"], {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function commitCount(cwd: string): number {
  return Number(
    execFileSync("git", ["rev-list", "--count", "HEAD"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim(),
  );
}

describe("hasCommitPlaceholders", () => {
  it("treats $TITLE/$BODY as sentinels and leftover <short summary> as unusable", () => {
    expect(hasCommitPlaceholders("$TITLE")).toBe(true);
    expect(hasCommitPlaceholders("$BODY")).toBe(true);
    expect(hasCommitPlaceholders("feat: <short summary>")).toBe(true);
    expect(hasCommitPlaceholders("feat: add retry")).toBe(false);
    expect(hasCommitPlaceholders("feat: parse List<T>")).toBe(false);
  });
});

describe("b-commit-improved refuses placeholder drafts", () => {
  it("does not commit a fallback draft whose title is still $TITLE", async () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const subject = ".context/2026-08-26.placeholder-leak";
      execFileSync("mkdir", ["-p", join(dir, subject)], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      fallbackDraft(dir, subject, "diff --git a/a.txt b/a.txt\n+x\n", ["a.txt"], "", "no model available");

      const { api, commands } = createMockApi();
      wire(api);
      const cmd = commands.get("b-commit-improved") as {
        handler: (args: string, ctx: unknown) => Promise<void>;
      };
      await cmd.handler("", { cwd: dir, ui: { notify: () => {} } });

      expect(headSubject(dir)).toBe("init");
      expect(commitCount(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not commit a legacy feat: <short summary> draft title", async () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const subject = ".context/2026-08-26.legacy-bracket";
      execFileSync("mkdir", ["-p", join(dir, subject)], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      writeFileSync(
        join(dir, subject, "draft-commit.md"),
        "## Title\n\nfeat: <short summary>\n\n## Body\n\nwhy\n",
      );

      const { api, commands } = createMockApi();
      wire(api);
      const cmd = commands.get("b-commit-improved") as {
        handler: (args: string, ctx: unknown) => Promise<void>;
      };
      await cmd.handler("", { cwd: dir, ui: { notify: () => {} } });

      expect(headSubject(dir)).toBe("init");
      expect(commitCount(dir)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("commits a filled draft title", async () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "a.txt"), "x\n");
      execFileSync("git", ["add", "a.txt"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      const subject = ".context/2026-08-26.filled-draft";
      execFileSync("mkdir", ["-p", join(dir, subject)], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      writeFileSync(
        join(dir, subject, "draft-commit.md"),
        "## Title\n\nfeat: hello\n\n## Body\n\nwhy this change\n",
      );

      const { api, commands } = createMockApi();
      wire(api);
      const cmd = commands.get("b-commit-improved") as {
        handler: (args: string, ctx: unknown) => Promise<void>;
      };
      await cmd.handler("", { cwd: dir, ui: { notify: () => {} } });

      expect(headSubject(dir)).toBe("feat: hello");
      expect(commitCount(dir)).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
