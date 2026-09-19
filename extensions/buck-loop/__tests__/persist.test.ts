/**
 * Seams under test:
 * - `writeProjection` / `readProjection` — versioned `.context/workflow/buck-loop.json`.
 * - `resume` — rescan then reconcile; artifacts win; unsafe disagreement blocks.
 * - Adapter: isolated temp git checkouts. Projection JSON is planted as literals.
 * - No XState snapshot file is created or read.
 */
import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupRepos, planMd, phaseMd, repo, writeTree } from "./fixtures.js";
import {
  PROJECTION_RELPATH,
  PROJECTION_TMP_RELPATH,
  readProjection,
  resume,
  writeProjection,
  type Projection,
} from "../persist.js";
import type { LoopState } from "../types.js";

const SUBJECT = "2026-09-18.demo";

function phased(root: string, statuses: string[]): void {
  const files: Record<string, string> = {
    [`.context/${SUBJECT}/plan-demo.md`]: planMd(),
    [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
  };
  statuses.forEach((status, i) => {
    const n = i + 1;
    files[`.context/${SUBJECT}/phase-${n}-p${n}.md`] = phaseMd(n, status);
  });
  writeTree(root, files);
}

function projection(overrides: Partial<Projection> = {}): Projection {
  return {
    version: 1,
    state: "building",
    subject: SUBJECT,
    planPath: `.context/${SUBJECT}/plan-demo.md`,
    phasePath: `.context/${SUBJECT}/phase-1-p1.md`,
    loopCount: 3,
    iterateCyclesOnPhase: 1,
    maxLoops: 12,
    lastChoice: { choice: { kind: "advance" }, reason: "prior" },
    history: [{ from: "resolving", to: "building", at: "2026-09-18T00:00:00Z", why: "start" }],
    ...overrides,
  };
}

afterEach(cleanupRepos);

describe("projection round-trip", () => {
  it("writes and reads versioned buck-loop.json fields", () => {
    const root = repo();
    const original = projection();
    writeProjection(root, original);
    const abs = join(root, PROJECTION_RELPATH);
    expect(existsSync(abs)).toBe(true);
    const disk = JSON.parse(readFileSync(abs, "utf8")) as { version: number; state: LoopState };
    expect(disk.version).toBe(1);
    expect(disk.state).toBe("building");
    expect(readProjection(root)).toEqual(original);
  });

  it("does not create or read an XState snapshot file", () => {
    const root = repo();
    writeProjection(root, projection());
    expect(existsSync(join(root, ".context/workflow/orchestration.snapshot.json"))).toBe(false);
    writeTree(root, {
      ".context/workflow/orchestration.snapshot.json": JSON.stringify({
        value: "done",
        context: { subject: SUBJECT },
      }),
    });
    expect(readProjection(root)?.state).toBe("building");
  });

  it("returns null when the projection file is missing", () => {
    expect(readProjection(repo())).toBeNull();
  });
});

describe("resume reconciliation", () => {
  it("rescans before returning; stale building plus all phases completed becomes done", () => {
    const root = repo();
    phased(root, ["completed", "completed"]);
    writeProjection(root, projection({ state: "building" }));
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("done");
    expect(snap.planFacts).toEqual({ kind: "phased-complete" });
    expect(snap.phasePath).toBeNull();
    expect(snap.loopCount).toBe(3);
    expect(snap.history).toEqual([
      { from: "resolving", to: "building", at: "2026-09-18T00:00:00Z", why: "start" },
    ]);
  });
  it("blocks when the projection claims done but an incomplete phase exists", () => {
    const root = repo();
    phased(root, ["pending"]);
    writeProjection(root, projection({ state: "done" }));
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/done/i);
      expect(snap.planFacts.reason).toMatch(/incomplete/i);
    }
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
    expect(snap.workFacts.sessionOutcome).toBe("pending");
  });

  it("blocks when the projection subject folder has vanished", () => {
    const root = repo();
    writeProjection(root, projection({ state: "building" }));
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/vanished/);
    }
    expect(snap.subject).toBe(SUBJECT);
  });

  it("replaces stale projection planFacts with the rescan", () => {
    const root = repo();
    phased(root, ["pending"]);
    writeProjection(
      root,
      projection({
        state: "building",
        phasePath: null,
      }),
    );
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("building");
    expect(snap.planFacts).toEqual({ kind: "phased-incomplete" });
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
  });

  it("returns idle missing when there is no projection and no path", () => {
    const snap = resume({ projectRoot: repo() });
    expect(snap.state).toBe("idle");
    expect(snap.planFacts.kind).toBe("missing");
  });

  it("blocks on an unreadable projection file", () => {
    const root = repo();
    writeTree(root, { [PROJECTION_RELPATH]: "{not-json" });
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/unreadable/);
    }
  });

  it("blocks when a loop counter is negative", () => {
    const root = repo();
    phased(root, ["pending"]);
    writeTree(root, { [PROJECTION_RELPATH]: JSON.stringify({ ...projection(), loopCount: -1 }) });
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/unreadable/);
    }
    expect(readProjection(root)).toBeNull();
  });

  it("blocks when a loop counter is fractional", () => {
    const root = repo();
    phased(root, ["pending"]);
    writeTree(root, {
      [PROJECTION_RELPATH]: JSON.stringify({ ...projection(), iterateCyclesOnPhase: 0.5 }),
    });
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("blocked");
    expect(readProjection(root)).toBeNull();
  });

  it("blocks when maxLoops is not a positive integer", () => {
    for (const maxLoops of [0, 12.5]) {
      const root = repo();
      phased(root, ["pending"]);
      writeTree(root, { [PROJECTION_RELPATH]: JSON.stringify({ ...projection(), maxLoops }) });
      const snap = resume({ projectRoot: root });
      expect(snap.state).toBe("blocked");
      expect(readProjection(root)).toBeNull();
    }
  });

  it("rejects inherited enum keys in projection state and choices", () => {
    const corruptions = [
      { ...projection(), state: "toString" },
      {
        ...projection(),
        lastChoice: { choice: { kind: "toString" }, reason: "corrupt" },
      },
    ];
  
    for (const corrupted of corruptions) {
      const root = repo();
      phased(root, ["pending"]);
      writeTree(root, { [PROJECTION_RELPATH]: JSON.stringify(corrupted) });
      expect(readProjection(root)).toBeNull();
      expect(resume({ projectRoot: root }).state).toBe("blocked");
    }
  });
  
  it("ignores a planted XState snapshot when reconciling", () => {
    const root = repo();
    phased(root, ["pending"]);
    writeProjection(root, projection({ state: "building" }));
    writeTree(root, {
      ".context/workflow/orchestration.snapshot.json": JSON.stringify({ value: "done" }),
    });
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("building");
    expect(snap.planFacts).toEqual({ kind: "phased-incomplete" });
  });
});

describe("persist contract", () => {
  it("does not import b-flow, xstate, or orchestration.snapshot.json", () => {
    const src = readFileSync(new URL("../persist.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from ["'][^"']*b-flow/);
    expect(src).not.toMatch(/from ["']xstate["']/);
    expect(src).not.toMatch(/orchestration\.snapshot\.json/);
  });
});


describe("resume-back to a completed projected phase (issue #36)", () => {
  it("stays on the projected completed phase instead of advancing while phases remain", () => {
    const root = repo();
    phased(root, ["completed", "pending"]);
    writeProjection(
      root,
      projection({ state: "building", phasePath: `.context/${SUBJECT}/phase-1-p1.md` }),
    );
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("building");
    expect(snap.planFacts).toEqual({ kind: "phased-incomplete" });
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
    expect(snap.workFacts).toEqual({ sessionOutcome: "ok", retriesUsed: 0, postcondition: "confirmed" });
    expect(snap.iterateCyclesOnPhase).toBe(1);
  });

  it("keeps the stale-building done shortcut when every phase is completed", () => {
    const root = repo();
    phased(root, ["completed", "completed"]);
    writeProjection(
      root,
      projection({ state: "building", iterateCyclesOnPhase: 0 }),
    );
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("done");
    expect(snap.phasePath).toBeNull();
  });

  it("falls through to the scanned phase when the projected phase file has vanished", () => {
    const root = repo();
    phased(root, ["completed", "pending"]);
    rmSync(join(root, ".context", SUBJECT, "phase-1-p1.md"));
    writeProjection(root, projection({ state: "building" }));
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("building");
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-2-p2.md`);
    expect(snap.workFacts.sessionOutcome).toBe("pending");
  });

  it("falls through to the scanned phase when the projected phase file is not completed", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-demo.md`]: planMd(),
      [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
      [`.context/${SUBJECT}/phase-1-p1.md`]: phaseMd(1, "in-progress", [2]),
      [`.context/${SUBJECT}/phase-2-p2.md`]: phaseMd(2, "pending"),
    });
    writeProjection(
      root,
      projection({ state: "building", phasePath: `.context/${SUBJECT}/phase-1-p1.md` }),
    );
    const snap = resume({ projectRoot: root });
    expect(snap.state).toBe("building");
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-2-p2.md`);
    expect(snap.workFacts.sessionOutcome).toBe("pending");
  });
});

describe("atomic projection write (issue #36)", () => {
  it("leaves no temp file behind after a successful write", () => {
    const root = repo();
    writeProjection(root, projection());
    expect(existsSync(join(root, PROJECTION_TMP_RELPATH))).toBe(false);
    expect(readProjection(root)).toEqual(projection());
  });

  it("preserves the previous projection when writing fails", () => {
    const root = repo();
    writeProjection(root, projection());
    const good = readProjection(root);
    expect(good).not.toBeNull();
    chmodSync(join(root, ".context/workflow"), 0o555);
    try {
      expect(() => writeProjection(root, projection({ loopCount: 9 }))).toThrow();
      expect(readProjection(root)).toEqual(good);
    } finally {
      chmodSync(join(root, ".context/workflow"), 0o755);
    }
  });
});
