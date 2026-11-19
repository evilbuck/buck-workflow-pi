import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "submit-review.ts");

/** Run the real script as a subprocess — the operator's invocation surface. */
function run(args: string[]): { status: number | null; stderr: string } {
  const r = spawnSync("bun", [SCRIPT, ...args], { encoding: "utf8" });
  return { status: r.status, stderr: r.stderr };
}

describe("submit-review argument surface", () => {
  it("--help exits 0 with usage", () => {
    const r = run(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("usage: submit-review --worktree");
  });

  it("-h is the same as --help", () => {
    const r = run(["-h"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("usage: submit-review --worktree");
  });

  it("exits 1 when --worktree is missing", () => {
    const r = run([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--worktree <path> is required");
  });

  it("exits 1 when --worktree has no value", () => {
    const r = run(["--worktree"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--worktree requires a path argument");
  });

  it("exits 1 on an invalid --event value", () => {
    const r = run(["--event", "BOGUS"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--event must be one of");
  });

  it("exits 1 on an unknown argument", () => {
    const r = run(["--worktree", ".", "--bogus"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("unknown argument: --bogus");
  });

  it("a valid --worktree resolves and the first missing artifact names pr-context.json", () => {
    const empty = mkdtempSync(join(tmpdir(), "submit-review-"));
    const r = run(["--worktree", empty]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("pr-context.json");
  });
});
