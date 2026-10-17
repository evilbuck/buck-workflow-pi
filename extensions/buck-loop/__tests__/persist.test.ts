/**
 * Saved-run file tests. Projection JSON is planted as literals in a temp
 * repo. Resume must rescan disk — artifacts win; unsafe disagreement blocks.
 * No XState snapshot file is created or read.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupRepos, planMd, phaseMd, repo, seedProjectionBytes, writeTree } from "./fixtures.js";
import {
  PROJECTION_RELPATH,
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
    saveAttemptId: null,
    commitCheckpoint: null,
    loopCount: 3,
    iterateCyclesOnPhase: 1,
    maxLoops: 12,
    lastChoice: { choice: { kind: "advance" }, reason: "prior" },
    history: [{ from: "resolving", to: "building", at: "2026-09-18T00:00:00Z", why: "start" }],
    ...overrides,
  };
}

async function seedProjection(root: string, files: Record<string, string>): Promise<void> {
  await seedProjectionBytes(root, files[PROJECTION_RELPATH]);
}

afterEach(cleanupRepos);

describe("projection round-trip", () => {
  it("writes and reads versioned buck-loop.json fields", async () => {
    const root = repo();
    const original = projection();
    (await writeProjection(root, original));
    const abs = join(root, PROJECTION_RELPATH);
    expect(existsSync(abs)).toBe(true);
    const disk = JSON.parse(readFileSync(abs, "utf8")) as { version: number; state: LoopState };
    expect(disk.version).toBe(1);
    expect(disk.state).toBe("building");
    expect((await readProjection(root))).toEqual(original);
  });
  it("loads a ranking projection and a projection written before ranking existed", async () => {
    const root = repo();
    (await writeProjection(root, projection({ state: "ranking" })));
    expect((await readProjection(root))?.state).toBe("ranking");
    await seedProjection(root, {
      [PROJECTION_RELPATH]: JSON.stringify({
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
      }),
    });
    expect((await readProjection(root))).toEqual(projection());
  });


  it("does not create or read an XState snapshot file", async () => {
    const root = repo();
    (await writeProjection(root, projection()));
    expect(existsSync(join(root, ".context/workflow/orchestration.snapshot.json"))).toBe(false);
    writeTree(root, {
      ".context/workflow/orchestration.snapshot.json": JSON.stringify({
        value: "done",
        context: { subject: SUBJECT },
      }),
    });
    expect((await readProjection(root))?.state).toBe("building");
  });

  it("returns null when the projection file is missing", async () => {
    expect((await readProjection(repo()))).toBeNull();
  });
});

describe("resume reconciliation", () => {
  it.each(["done", "blocked"] as const)("refreshes open acceptance blockers on %s resume", async (state) => {
    const root = repo();
    writeTree(root, { [`.context/${SUBJECT}/plan-demo.md`]: `${planMd()}\n## Acceptance criteria\n- [ ] Observed evidence\n` });
    (await writeProjection(root, projection({
      state, phasePath: null,
      history: [{ from: "committing", to: state, at: "2026-09-18T00:00:00Z", why: "unphased plan remains open" }],
    })));
    const snapshot = (await resume({ projectRoot: root }));
    expect(snapshot.state).toBe("blocked");
    expect(snapshot.history.at(-1)?.why).toContain("unphased plan remains open");
    expect(snapshot.history.at(-1)?.why).toContain("- [ ] Observed evidence");
  });

  it.each(["\n## Acceptance criteria\n- [ ] Implementation not yet verified\n", ""])(
    "preserves an ordinary unphased build interruption with acceptance section %j",
    async (acceptance) => {
      const root = repo();
      writeTree(root, { [`.context/${SUBJECT}/plan-demo.md`]: `${planMd()}${acceptance}` });
      const history: Projection["history"] = [
        { from: "building", to: "blocked", at: "2026-09-18T00:00:00Z", why: "nested build interrupted; environment repaired" },
      ];
      (await writeProjection(root, projection({ state: "blocked", phasePath: null, history })));
      const snapshot = (await resume({ projectRoot: root }));
      expect(snapshot.state).toBe("blocked");
      expect(snapshot.history).toEqual(history);
    },
  );

  it("rescans before returning; stale building plus all phases completed becomes done", async () => {
    const root = repo();
    phased(root, ["completed", "completed"]);
    (await writeProjection(root, projection({ state: "building" })));
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("done");
    expect(snap.planFacts).toEqual({ kind: "phased-complete" });
    expect(snap.phasePath).toBeNull();
    expect(snap.loopCount).toBe(3);
    expect(snap.history).toEqual([
      { from: "resolving", to: "building", at: "2026-09-18T00:00:00Z", why: "start" },
    ]);
  });
  it("blocks when the projection claims done but an incomplete phase exists", async () => {
    const root = repo();
    phased(root, ["pending"]);
    (await writeProjection(root, projection({ state: "done" })));
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/done/i);
      expect(snap.planFacts.reason).toMatch(/incomplete/i);
    }
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
    expect(snap.workFacts.sessionOutcome).toBe("pending");
  });

  it("blocks when the projection subject folder has vanished", async () => {
    const root = repo();
    (await writeProjection(root, projection({ state: "building" })));
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/vanished/);
    }
    expect(snap.subject).toBe(SUBJECT);
  });

  it("replaces stale projection planFacts with the rescan", async () => {
    const root = repo();
    phased(root, ["pending"]);
    (await writeProjection(root,
    projection({
      state: "building",
      phasePath: null,
    }),));
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("building");
    expect(snap.planFacts).toEqual({ kind: "phased-incomplete" });
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
  });

  it("keeps a completed projected phase instead of advancing on resume", async () => {
    const root = repo();
    phased(root, ["completed", "pending"]);
    (await writeProjection(root, projection({ state: "building" })));
    const snap = (await resume({ projectRoot: root }));
    expect(snap.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
    expect(snap.state).toBe("building");
    expect(snap.workFacts.postcondition).toBe("confirmed");
  });


  it("returns idle missing when there is no projection and no path", async () => {
    const snap = (await resume({ projectRoot: repo() }));
    expect(snap.state).toBe("idle");
    expect(snap.planFacts.kind).toBe("missing");
  });

  it("blocks on an unreadable projection file", async () => {
    const root = repo();
    await seedProjection(root, { [PROJECTION_RELPATH]: "{not-json" });
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/unreadable/);
    }
  });

  it("blocks when a loop counter is negative", async () => {
    const root = repo();
    phased(root, ["pending"]);
    await seedProjection(root, { [PROJECTION_RELPATH]: JSON.stringify({ ...projection(), loopCount: -1 }) });
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("blocked");
    expect(snap.planFacts.kind).toBe("missing");
    if (snap.planFacts.kind === "missing") {
      expect(snap.planFacts.reason).toMatch(/unreadable/);
    }
    expect((await readProjection(root))).toBeNull();
  });

  it("blocks when a loop counter is fractional", async () => {
    const root = repo();
    phased(root, ["pending"]);
    await seedProjection(root, {
      [PROJECTION_RELPATH]: JSON.stringify({ ...projection(), iterateCyclesOnPhase: 0.5 }),
    });
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("blocked");
    expect((await readProjection(root))).toBeNull();
  });

  it("blocks when maxLoops is not a positive integer", async () => {
    for (const maxLoops of [0, 12.5]) {
      const root = repo();
      phased(root, ["pending"]);
      await seedProjection(root, { [PROJECTION_RELPATH]: JSON.stringify({ ...projection(), maxLoops }) });
      const snap = (await resume({ projectRoot: root }));
      expect(snap.state).toBe("blocked");
      expect((await readProjection(root))).toBeNull();
    }
  });

  it("rejects inherited enum keys in projection state and choices", async () => {
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
      await seedProjection(root, { [PROJECTION_RELPATH]: JSON.stringify(corrupted) });
      expect((await readProjection(root))).toBeNull();
      expect((await resume({ projectRoot: root })).state).toBe("blocked");
    }
  });
  
  it("ignores a planted XState snapshot when reconciling", async () => {
    const root = repo();
    phased(root, ["pending"]);
    (await writeProjection(root, projection({ state: "building" })));
    writeTree(root, {
      ".context/workflow/orchestration.snapshot.json": JSON.stringify({ value: "done" }),
    });
    const snap = (await resume({ projectRoot: root }));
    expect(snap.state).toBe("building");
    expect(snap.planFacts).toEqual({ kind: "phased-incomplete" });
  });
});

describe("persist contract", () => {

  it("writes a stderr diagnostic when projection hygiene cannot run", async () => {
    const root = mkdtempSync(join(tmpdir(), "buck-loop-nongit-"));
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      (await writeProjection(root, projection()));
      expect(write.mock.calls.map((call) => String(call[0])).join("")).toMatch(/projection hygiene skipped/);
    } finally {
      write.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

});
