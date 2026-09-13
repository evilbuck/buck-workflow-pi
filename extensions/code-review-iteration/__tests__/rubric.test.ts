import { describe, it, expect } from "vitest";
import {
  computeCriticality,
  isBlocking,
  isHardness,
  ratingFromScore,
  scoreCriticality,
  tierAtLeast,
  validateCriticalityInputs,
} from "../rubric.js";

describe("scoreCriticality", () => {
  it("computes 2I + L + B", () => {
    expect(scoreCriticality({ impact: 3, likelihood: 2, breadth: 1 })).toBe(9);
    expect(scoreCriticality({ impact: 0, likelihood: 0, breadth: 0 })).toBe(0);
    expect(scoreCriticality({ impact: 4, likelihood: 3, breadth: 2 })).toBe(13);
  });

  it("rejects out-of-range inputs with per-field errors", () => {
    expect(validateCriticalityInputs({ impact: 5, likelihood: 0, breadth: 0 })).toEqual([
      "impact must be an integer 0–4",
    ]);
    expect(validateCriticalityInputs({ impact: 1.5, likelihood: -1, breadth: 3 })).toHaveLength(3);
    expect(validateCriticalityInputs({ impact: 2, likelihood: 1, breadth: 1 })).toEqual([]);
  });
});

describe("ratingFromScore bands", () => {
  it("maps every band boundary exactly", () => {
    expect(ratingFromScore(0)).toBe("advisory");
    expect(ratingFromScore(2)).toBe("advisory");
    expect(ratingFromScore(3)).toBe("low");
    expect(ratingFromScore(5)).toBe("low");
    expect(ratingFromScore(6)).toBe("medium");
    expect(ratingFromScore(8)).toBe("medium");
    expect(ratingFromScore(9)).toBe("high");
    expect(ratingFromScore(10)).toBe("high");
    expect(ratingFromScore(11)).toBe("critical");
    expect(ratingFromScore(13)).toBe("critical");
  });
});

describe("computeCriticality floors", () => {
  it("raises an exploitable security boundary to critical regardless of score", () => {
    const result = computeCriticality(
      { impact: 1, likelihood: 0, breadth: 0 },
      { securityBoundaryExploitable: true },
    );
    expect(result).toEqual({ score: 2, rating: "critical" });
  });

  it("raises likely irreversible data loss to critical", () => {
    expect(
      computeCriticality({ impact: 2, likelihood: 1, breadth: 0 }, { irreversibleDataLoss: true }).rating,
    ).toBe("critical");
  });

  it("raises a primary-path blocker to at least high", () => {
    expect(
      computeCriticality({ impact: 0, likelihood: 1, breadth: 0 }, { primaryPathBlocker: true }).rating,
    ).toBe("high");
    expect(
      computeCriticality({ impact: 4, likelihood: 3, breadth: 2 }, { primaryPathBlocker: true }).rating,
    ).toBe("critical");
  });

  it("caps style-only findings at low", () => {
    expect(computeCriticality({ impact: 3, likelihood: 2, breadth: 2 }, { styleOnly: true })).toEqual({
      score: 10,
      rating: "low",
    });
  });

  it("critical floor wins over style-only cap", () => {
    expect(
      computeCriticality(
        { impact: 2, likelihood: 2, breadth: 1 },
        { securityBoundaryExploitable: true, styleOnly: true },
      ).rating,
    ).toBe("critical");
  });
});

describe("isBlocking", () => {
  it("blocks medium, high, and critical; advisory and low stay report-only", () => {
    expect(isBlocking("advisory")).toBe(false);
    expect(isBlocking("low")).toBe(false);
    expect(isBlocking("medium")).toBe(true);
    expect(isBlocking("high")).toBe(true);
    expect(isBlocking("critical")).toBe(true);
  });
});

describe("hardness axis", () => {
  it("isHardness accepts exactly the three tiers", () => {
    expect(isHardness("easy")).toBe(true);
    expect(isHardness("medium")).toBe(true);
    expect(isHardness("hard")).toBe(true);
    expect(isHardness("trivial")).toBe(false);
    expect(isHardness(3)).toBe(false);
  });

  it("tierAtLeast expresses ordered eligibility", () => {
    expect(tierAtLeast("easy", "easy")).toBe(true);
    expect(tierAtLeast("medium", "easy")).toBe(true);
    expect(tierAtLeast("hard", "medium")).toBe(true);
    expect(tierAtLeast("easy", "hard")).toBe(false);
    expect(tierAtLeast("medium", "hard")).toBe(false);
  });
});
