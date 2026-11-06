import { describe, expect, it } from "vitest";
import { savePhase } from "../index.js";

describe("improved save phase", () => {
  const subject = ".context/2026-09-29.example";
  const phases = [{ path: "phase-1-done.md", status: "completed" }, { path: "phase-4-proof.md", status: "pending" }];
  it("keeps a projected phase instead of advancing provenance to later work", () => {
    expect(savePhase(subject, `${subject}/phase-3.md`, true, phases)).toBe(`${subject}/phase-3.md`);
    expect(savePhase(subject, null, true, phases)).toBeNull();
  });
  it("uses adapter preflight phase state without a local subject directory", () => {
    expect(savePhase(subject, null, false, phases)).toBe(`${subject}/phase-4-proof.md`);
    expect(savePhase(subject, null, false, [])).toBeNull();
  });
  it("orders phase 2 before phase 10", () => {
    expect(savePhase(subject, null, false, [{ path: "phase-10-work.md", status: "pending" }, { path: "phase-2-work.md", status: "pending" }])).toBe(`${subject}/phase-2-work.md`);
  });
});
