import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

// runOmpModelSession internally calls session.subscribe. Our runOmpModelSession
// mock fires a message_update event through the bridge right at subscribe
// time and returns a literal description.
vi.mock("../../omp-models.js", async () => {
  const actual = await vi.importActual<typeof import("../../omp-models.js")>("../../omp-models.js");
  return {
    ...actual,
    runOmpModelSession: async (opts: { onActivity?: (e: unknown) => void } = {}) => {
      const bridge = opts.onActivity;
      if (bridge) {
        bridge({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "delta" } });
      }
      return "## What & Why\ntest description\n\n## Impact\nx\n\n## High-Level Changes\n- y";
    },
  };
});

vi.mock("../../subprocess.js", () => ({
  execFileCaptured: async () => ({
    code: 0,
    stdout: JSON.stringify({
      chosen_base: "main",
      current_branch: "feature/x",
      commits: [{ subject: "feat: add feature", author: "t" }],
      staged_files: ["feature.txt"],
      diff: "diff content",
    }),
    stderr: "",
  }),
}));

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "bpr-draft-"));
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
  writeFileSync(join(dir, "feature.txt"), "hello\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "feat: add feature"]);
  return dir;
}

describe("b-pr-improved drafting", () => {
  beforeEach(() => {
    captured.calls = [];
    captured.handle = null;
  });

  it("exercises preflight + Synthesizing + Creating phases; fires ingest events", async () => {
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
      const handler = commands.get("b-pr-improved")?.handler;
      if (!handler) throw new Error("not registered");
      await handler("", {
        cwd: dir,
        ui: { notify: () => {}, setStatus: () => {}, setWidget: () => {} },
      });
      const phases = captured.calls.filter((c) => c[0] === "phase").map((c) => c[1]);
      expect(phases).toContain("preflight…");
      expect(phases).toContain("Synthesizing PR description…");
      expect(phases).toContain("Creating PR with gh…");
      // The mocked runOmpModelSession fired a text_delta event through
      // onActivity, which the runner normalized and forwarded to activity.ingest.
      expect(captured.calls.filter((c) => c[0] === "ingest").length).toBeGreaterThan(0);
      expect(captured.calls.filter((c) => c[0] === "dispose")).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
