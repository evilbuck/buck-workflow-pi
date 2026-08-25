import { describe, it, expect } from "vitest";
import { createLineRing, createProgress, execFileCaptured, KAMAL_TAIL_LINES } from "./command-progress.js";

describe("execFileCaptured", () => {
  it("resolves stdout and code 0 for a successful child", async () => {
    const result = await execFileCaptured(process.execPath, ["-e", "process.stdout.write('ok-out')"], process.cwd());
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("ok-out");
  });

  it("returns captured stdout on a nonzero exit instead of throwing", async () => {
    const result = await execFileCaptured(
      process.execPath,
      ["-e", "process.stdout.write(JSON.stringify({ error: 'conflict' })); process.exit(3)"],
      process.cwd(),
    );
    expect(result.code).toBe(3);
    expect(JSON.parse(result.stdout)).toEqual({ error: "conflict" });
  });
});

describe("createProgress", () => {
  it("step notifies immediately so a later child still sees the preflight line", async () => {
    const notifies: Array<[string, string?]> = [];
    const progress = createProgress({ ui: { notify: (m: string, l?: string) => notifies.push([m, l]) } }, "b-pr-improved");
    let childResolved = false;
    let resolveChild!: () => void;
    const child = new Promise<void>((resolve) => {
      resolveChild = () => {
        childResolved = true;
        resolve();
      };
    });
    progress.step("preflight…");
    expect(childResolved).toBe(false);
    expect(notifies[0]?.[0]).toMatch(/preflight/i);
    expect(notifies[0]?.[1]).toBe("info");
    resolveChild();
    await child;
    expect(childResolved).toBe(true);
    expect(notifies[0]?.[0]).toMatch(/preflight/i);
  });

  it("does not throw when optional UI methods are missing", () => {
    const progress = createProgress({}, "b-commit-improved");
    expect(() => {
      progress.step("preflight…");
      progress.fail("nope");
      progress.done("ok");
      progress.clear();
    }).not.toThrow();
  });

  it("does not throw when optional UI methods throw", () => {
    const progress = createProgress(
      {
        ui: {
          notify: () => {
            throw new Error("notify boom");
          },
          setStatus: () => {
            throw new Error("status boom");
          },
          setWorkingMessage: () => {
            throw new Error("working boom");
          },
        },
      },
      "b-kamal-release",
    );
    expect(() => {
      progress.step("Deploying v1…");
      progress.clear();
    }).not.toThrow();
  });

  it("clear removes the footer status", () => {
    const statuses: Array<[string, string?]> = [];
    const progress = createProgress(
      {
        ui: {
          notify: () => {},
          setStatus: (key: string, text?: string) => statuses.push([key, text]),
        },
      },
      "b-pr-improved",
    );
    progress.step("preflight…");
    progress.clear();
    expect(statuses[0]).toEqual(["b-pr-improved", "preflight…"]);
    expect(statuses[1]).toEqual(["b-pr-improved", undefined]);
  });
});

describe("createLineRing", () => {
  it("retains at most N non-empty lines after extra input", () => {
    const ring = createLineRing(KAMAL_TAIL_LINES);
    const lines = Array.from({ length: KAMAL_TAIL_LINES + 7 }, (_, i) => `line-${i + 1}`);
    ring.push(lines.join("\n") + "\n");
    const kept = ring.finish();
    expect(kept.length).toBeLessThanOrEqual(KAMAL_TAIL_LINES);
    expect(kept).toHaveLength(KAMAL_TAIL_LINES);
    expect(kept[0]).toBe("line-8");
    expect(kept[kept.length - 1]).toBe("line-27");
  });

  it("drops empty lines the same way the old slice(-20) filter did", () => {
    const ring = createLineRing(3);
    ring.push("a\n\n\nb\n\nc\nd\n");
    expect(ring.finish()).toEqual(["b", "c", "d"]);
  });
});
