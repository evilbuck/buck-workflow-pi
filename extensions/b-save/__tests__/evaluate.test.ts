import { describe, expect, it } from "vitest";
import {
  ContainmentError,
  NeedsJudgmentError,
  SchemaError,
  StaleInputError,
  UserGateError,
  dependentKeys,
  evaluateSnapshot,
  type EvalInput,
} from "../evaluate.js";
import type { SaveSnapshot, SnapshotAmbiguous, SnapshotOk } from "../snapshot.js";

function snap(over: Partial<SaveSnapshot> = {}): SnapshotOk {
  const snapshot: SaveSnapshot = {
    subject: { name: "2026-09-10.demo", path: ".context/2026-09-10.demo", status: "active", created: false },
    subject_candidates: [{ name: "2026-09-10.demo", status: "active" }],
    session_evidence: { present: false, valid: false, used: false, stale_reasons: [], fields: {} },
    loose_artifacts: [],
    plans: [{ path: ".context/2026-09-10.demo/plan-demo.md", spec: null }],
    specs: [],
    iterates: [],
    phases: [],
    input_hashes: {},
    redacted_text: {},
    proposal_dependencies: {},
    ...over,
  };
  return { kind: "ok", snapshot };
}

const closed: Omit<EvalInput, "snapshot"> = {
  scribe: { title: "Save", body: "did the work", domains: ["workflow"], topics: ["b-save"], priority: "high" },
  auditor: { complete: true, citations: ["e1"] },
  goal: { classification: "exact" },
};

describe("evaluateSnapshot", () => {
  it("closes all twelve rules when inputs are resolved", () => {
    const evaluation = evaluateSnapshot({ snapshot: snap(), ...closed });
    expect(evaluation.rules.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(evaluation.rules.find((r) => r.id === 8)?.result).toEqual({ status: "unsupported" });
    expect(evaluation.rules.find((r) => r.id === 9)?.result).toEqual({ status: "skipped" });
    expect(evaluation.patch.ops.map((op) => op.path)).toEqual([
      ".context/2026-09-10.demo/memory-2026-09-10.md",
      ".context/memory/index.md",
    ]);
  });

  it("routes missing scribe and auditor to typed judgment, never containment failures", () => {
    try {
      evaluateSnapshot({ snapshot: snap() });
      expect.fail("expected NeedsJudgmentError");
    } catch (error) {
      expect(error).toBeInstanceOf(NeedsJudgmentError);
      expect((error as NeedsJudgmentError).role).toBe("scribe");
    }
    try {
      evaluateSnapshot({ snapshot: snap(), scribe: closed.scribe });
      expect.fail("expected NeedsJudgmentError");
    } catch (error) {
      expect(error).toBeInstanceOf(NeedsJudgmentError);
      expect((error as NeedsJudgmentError).role).toBe("evidence-auditor");
    }
  });

  it("keeps subject and inferred-backlog choices as user gates", () => {
    const ambiguous: SnapshotAmbiguous = {
      kind: "ambiguous",
      candidates: [
        { name: "2026-09-10.a", status: "active" },
        { name: "2026-09-10.b", status: "active" },
      ],
      suggested_subject: "2026-09-10.a",
    };
    try {
      evaluateSnapshot({ snapshot: ambiguous, ...closed });
      expect.fail("expected UserGateError");
    } catch (error) {
      expect(error).toBeInstanceOf(UserGateError);
      expect((error as UserGateError).gate).toBe("subject");
    }
    try {
      evaluateSnapshot({ snapshot: snap(), ...closed, inferredBacklog: ["foo"] });
      expect.fail("expected UserGateError");
    } catch (error) {
      expect(error).toBeInstanceOf(UserGateError);
      expect((error as UserGateError).gate).toBe("backlog_inferred");
    }
  });

  it("rejects escaping paths, stale hashes, and model mutation fields as hard failures", () => {
    expect(() =>
      evaluateSnapshot({
        snapshot: snap({ plans: [{ path: "../secret.md", spec: null }] }),
        ...closed,
      }),
    ).toThrow(ContainmentError);
    expect(() =>
      evaluateSnapshot({
        snapshot: snap(),
        ...closed,
        expectedHashes: { a: "1" },
        currentHashes: { a: "2" },
      }),
    ).toThrow(StaleInputError);
    expect(() =>
      evaluateSnapshot({
        snapshot: snap(),
        ...closed,
        scribe: { ...closed.scribe!, writable_paths: ["/tmp"] } as EvalInput["scribe"],
      }),
    ).toThrow(SchemaError);
  });

  it("routes semantic user-goal near-matches to the goal classifier", () => {
    try {
      evaluateSnapshot({ snapshot: snap(), ...closed, goal: { classification: "near" } });
      expect.fail("expected NeedsJudgmentError");
    } catch (error) {
      expect(error).toBeInstanceOf(NeedsJudgmentError);
      expect((error as NeedsJudgmentError).role).toBe("goal-classifier");
    }
  });

  it("invalidates only dependent proposals when memory hashes change", () => {
    expect(dependentKeys(".context/memory/foo.md")).toEqual(["memory", "index"]);
    expect(dependentKeys(".context/x/phase-1.md")).toEqual(["phases"]);
  });
});
