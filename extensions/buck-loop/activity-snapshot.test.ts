import { describe, expect, it } from "vitest";
import { projectActivitySnapshot, reportedUsage } from "./activity-snapshot.js";
import type { Snapshot } from "./types.js";
export const snapshot: Snapshot = {
  state: "building", subject: "demo", planPath: "plan.md", phasePath: "phase.md", planFacts: { kind: "phased-incomplete" },
  workFacts: { sessionOutcome: "ok", retriesUsed: 0, postcondition: "confirmed" }, reviewFacts: { kind: "pending" },
  loopCount: 1, maxLoops: 12, iterateCyclesOnPhase: 2, lastChoice: null, history: [],
};
describe("real machine activity projection", () => {
  it("projects deterministic and ambiguous continuations without invented machine fields", () => {
    const deterministic = projectActivitySnapshot(snapshot);
    expect(deterministic.expectedState).toBe("reviewing");
    expect(deterministic.choices).toEqual([]);
    const ambiguous = projectActivitySnapshot({ ...snapshot, workFacts: { ...snapshot.workFacts, postcondition: "ambiguous" } });
    expect(ambiguous.choices).toEqual([{ kind: "retry" }, { kind: "advance" }]);
    expect(ambiguous.expectedState).toBeUndefined();
    expect(ambiguous.usage).toBeUndefined();
    expect(ambiguous.iteration).toBe(2);
  });
  it("only counts authoritative completed assistant usage", () => {
    expect(reportedUsage({ type: "message_update", message: { role: "assistant", usage: { input: 10, output: 20 } } })).toBeUndefined();
    expect(reportedUsage({ type: "message_end", message: { role: "assistant", usage: { input: 10, output: 20 } } })).toEqual({ input: 10, output: 20 });
    expect(reportedUsage({ type: "message_end", message: { role: "assistant", usage: { input: NaN, output: 20 } } })).toBeUndefined();
    expect(reportedUsage({ type: "message_end", message: { role: "assistant", usage: { input: 10, output: 20, cacheRead: 30, cacheWrite: 5 } } })).toEqual({ input: 45, output: 20 });
  });
});
