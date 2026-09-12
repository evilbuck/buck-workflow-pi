import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured: { calls: Array<[string, unknown?]>; handle: object | null } = {
  calls: [],
  handle: null,
};

vi.mock("../../extension-activity.js", async () => {
  const actual = await vi.importActual<typeof import("../../extension-activity.js")>(
    "../../extension-activity.js",
  );
  return {
    ...actual,
    createActivity: (opts: unknown) => {
      const handle = {
        phase: (label: string) => captured.calls.push(["phase", label]),
        ingest: (e: unknown) => captured.calls.push(["ingest", e]),
        succeed: (label: string) => captured.calls.push(["succeed", label]),
        fail: (label: string) => captured.calls.push(["fail", label]),
        dispose: () => captured.calls.push(["dispose"]),
      };
      captured.handle = handle;
      captured.calls.push(["create", opts]);
      return handle;
    },
  };
});

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "bci-act-"));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@t",
  };
  const g = (a: string[]) =>
    execFileSync("git", a, { cwd: dir, encoding: "utf-8", env, stdio: ["pipe", "pipe", "pipe"] });
  g(["init", "-q", "-b", "main"]);
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "# test\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "init"]);
  g(["checkout", "-q", "-b", "feature/x"]);
  // b-commit-improved's fallbackDraft writes to .context/draft-commit.md.
  mkdirSync(join(dir, ".context"), { recursive: true });
  writeFileSync(join(dir, "feature.txt"), "hello\n");
  g(["add", "-A"]);
  return dir;
}

describe("b-commit-improved activity lifecycle", () => {
  beforeEach(() => {
    captured.calls = [];
    captured.handle = null;
  });

  it("creates one activity handle and exercises phases + dispose", async () => {
    const dir = makeRepo();
    try {
      const { wire } = await import("../index.js");
      const commands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();
      const api = {
        on: vi.fn(),
        registerCommand: (n: string, opts: { handler: (a: string, c: unknown) => Promise<void> }) =>
          commands.set(n, opts),
        registerTool: vi.fn(),
      } as unknown as Parameters<typeof wire>[0];
      wire(api);
      const handler = commands.get("b-commit-improved")?.handler;
      if (!handler) throw new Error("not registered");
      await handler("", {
        cwd: dir,
        ui: { notify: () => {}, setStatus: () => {}, setWidget: () => {} },
      });
      const creates = captured.calls.filter((c) => c[0] === "create");
      expect(creates).toHaveLength(1);
      const opts = creates[0]?.[1] as { command?: string };
      expect(opts?.command).toBe("b-commit-improved");
      const phases = captured.calls.filter((c) => c[0] === "phase").map((c) => c[1]);
      expect(phases.some((p) => typeof p === "string" && /preflight/i.test(p))).toBe(true);
      expect(captured.calls.filter((c) => c[0] === "dispose")).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
