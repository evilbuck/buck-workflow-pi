import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runJev } from "../../jev-tool/index.js";
import { askRepairLift, diagnoseAmbiguity } from "../ambiguity.js";

vi.mock("../../jev-tool/index.js", () => ({ runJev: vi.fn() }));

const judge = vi.mocked(runJev);

beforeEach(() => judge.mockReset());

function liftAnswer(choice: string) {
  return { raw: "", details: { answers: { lift: { type: "choice", choice, confidence: 0.9 } } } };
}

describe("ambiguous repair lift", () => {
  it("diagnoses from the child report instead of treating unchecked boxes as the cause", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "phase.md");
    writeFileSync(abs, "---\nstatus: in-progress\nacceptance_criteria:\n  - \"[ ] bounded SQL retrieval\"\n---\n");
    const diagnosis = diagnoseAmbiguity({
      abs,
      why: "postcondition scan ambiguous",
      sessionText: "Runtime SQL retrieval is not implemented. Continue that work.",
    });
    expect(diagnosis).toContain("Runtime SQL retrieval is not implemented.");
    expect(diagnosis.indexOf("Child report:")).toBeLessThan(diagnosis.indexOf("Unchecked:"));
  });

  it("continues light and medium lifts and hands an illegal answer to the operator", async () => {
    judge.mockResolvedValueOnce(liftAnswer("light"));
    judge.mockResolvedValueOnce(liftAnswer("medium"));
    judge.mockResolvedValueOnce(liftAnswer("invented"));

    expect(await askRepairLift("small gap")).toMatchObject({ lift: "light" });
    expect(await askRepairLift("same phase")).toMatchObject({ lift: "medium" });
    expect(await askRepairLift("unknown")).toEqual({
      lift: "heavy",
      reason: "Jev did not return a legal lift",
      diagnosis: "unknown",
    });
    expect(judge.mock.calls[0]?.[1]).toMatchObject({ state: "small gap", questions: { lift: { type: "choice" } } });
  });

  it("hands a failed lift call to the operator with the diagnosis", async () => {
    judge.mockRejectedValueOnce(new Error("provider unavailable"));
    expect(await askRepairLift("child stopped early")).toEqual({
      lift: "heavy",
      reason: "provider unavailable",
      diagnosis: "child stopped early",
    });
  });
});
