import { describe, expect, it, vi, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return {
    ...actual,
    execFileSync: ((file: string, args?: unknown, options?: unknown): string | Buffer => {
      if (file === "kamal") return "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actual.execFileSync as any)(file, args, options);
    }) as typeof actual.execFileSync,
  };
});

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
  const dir = mkdtempSync(join(tmpdir(), "kamal-act-"));
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
  mkdirSync(join(dir, "config"), { recursive: true });
  writeFileSync(join(dir, "config", "deploy.yml"), "service: test\nimage: test:latest\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "add kamal config"]);
  return dir;
}

describe("b-kamal-release activity lifecycle", () => {
  beforeEach(() => {
    captured.calls = [];
    captured.handle = null;
  });

  it("creates one activity handle and exercises phases + dispose", async () => {
    const dir = makeRepo();
    try {
      const { runKamalRelease } = await import("../index.js");
      await runKamalRelease("--tag 1.0.0", {
        cwd: dir,
        hasUI: false,
        ui: { notify: () => {}, setStatus: () => {}, setWidget: () => {} },
      });
      const creates = captured.calls.filter((c) => c[0] === "create");
      expect(creates).toHaveLength(1);
      const opts = creates[0]?.[1] as { command?: string };
      expect(opts?.command).toBe("b-kamal-release");
      const phases = captured.calls.filter((c) => c[0] === "phase").map((c) => c[1]);
      expect(phases.some((p) => typeof p === "string" && /Tagging/i.test(p))).toBe(true);
      expect(captured.calls.filter((c) => c[0] === "dispose")).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
