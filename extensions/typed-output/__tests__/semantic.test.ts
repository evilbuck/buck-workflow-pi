import { describe, expect, it } from "vitest";
import { assessSemanticVerification } from "../semantic.js";
import { semanticEvaluationFixtures } from "./fixtures.js";

describe("semantic verification policy", () => {
  it("reports a high-confidence closed-set disagreement", () => {
    const result = assessSemanticVerification(
      [{ question: "decision", type: "choice", declared: "fix" }],
      semanticEvaluationFixtures.disagreement,
    );

    expect(result.status).toBe("disagreed");
    expect(result.comparisons).toEqual([
      {
        question: "decision",
        declared: "fix",
        observed: "continue",
        support: 0.9,
        matches: false,
      },
    ]);
  });

  it("uses the calibrated support boundary", () => {
    const expectation = [{ question: "decision", type: "noul", declared: true }] as const;

    expect(
      assessSemanticVerification(expectation, semanticEvaluationFixtures.verifiedBoundary).status,
    ).toBe("verified");
    expect(
      assessSemanticVerification(expectation, semanticEvaluationFixtures.lowConfidence).status,
    ).toBe("low_confidence");
  });

  it("records provider failure as unavailable", () => {
    const result = assessSemanticVerification(
      [{ question: "decision", type: "noul", declared: true }],
      semanticEvaluationFixtures.unavailableProvider,
    );

    expect(result).toEqual({
      status: "unavailable",
      comparisons: [],
      message: "TypeSafe evaluation is unavailable.",
    });
  });
});
