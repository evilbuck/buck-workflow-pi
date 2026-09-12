import { writeFileSync as _writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const capturedActivity: { calls: Array<[string, unknown?]>; handle: object | null } = {
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
        phase: (label: string) => capturedActivity.calls.push(["phase", label]),
        ingest: (e: unknown) => capturedActivity.calls.push(["ingest", e]),
        succeed: (label: string) => capturedActivity.calls.push(["succeed", label]),
        fail: (label: string) => capturedActivity.calls.push(["fail", label]),
        dispose: () => capturedActivity.calls.push(["dispose"]),
      };
      capturedActivity.handle = handle;
      capturedActivity.calls.push(["create", opts]);
      return handle;
    },
  };
});

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "bpr-act-"));
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
  _writeFileSync(join(dir, "README.md"), "# test\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "init"]);
  g(["checkout", "-q", "-b", "feature/x"]);
  return dir;
}

describe("b-pr-improved activity lifecycle", () => {
  beforeEach(() => {
    capturedActivity.calls = [];
    capturedActivity.handle = null;
  });

  it("creates one activity handle on the cache-miss path and disposes it", async () => {
    const dir = makeRepo();
    try {
      const { wire } = await import("../index.js");
      const commands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();
      const api = {
        on: vi.fn(),
        registerCommand: (n: string, opts: { handler: (a: string, c: unknown) => Promise<void> }) =>
          commands.set(n, opts),
        registerTool: vi.fn(),
      };
      wire(api);
      const handler = commands.get("b-pr-improved")?.handler;
      if (!handler) throw new Error("not registered");
      await handler("", {
        cwd: dir,
        ui: { notify: () => {}, setStatus: () => {}, setWidget: () => {} },
      });
      const creates = capturedActivity.calls.filter((c) => c[0] === "create");
      expect(creates).toHaveLength(1);
      const opts = creates[0]?.[1] as { command?: string };
      expect(opts?.command).toBe("b-pr-improved");
      const phases = capturedActivity.calls.filter((c) => c[0] === "phase").map((c) => c[1]);
      expect(phases.some((p) => typeof p === "string" && /preflight/i.test(p))).toBe(true);
      expect(capturedActivity.calls.filter((c) => c[0] === "dispose")).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
