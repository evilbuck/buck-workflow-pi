/**
 * rubric — deterministic criticality computation for review findings.
 *
 * Two independent axes (brainstorm-locked):
 * - Criticality answers "how bad is the defect?" via 2I + L + B.
 * - Fix hardness (easy|medium|hard) answers "what capability is needed
 *   to verify and repair it?" and is used only for model routing.
 *
 * Rating bands: 0–2 advisory, 3–5 low, 6–8 medium, 9–10 high, 11–13 critical.
 * Medium and above block; advisory/low stay report-only.
 */

export type Hardness = "easy" | "medium" | "hard";
export type Rating = "advisory" | "low" | "medium" | "high" | "critical";

export const HARDNESSES: readonly Hardness[] = ["easy", "medium", "hard"];

export interface CriticalityInputs {
  impact: number;
  likelihood: number;
  breadth: number;
}

export interface FloorFlags {
  /** Concretely exploitable security-boundary defect. */
  securityBoundaryExploitable?: boolean;
  /** Likely irreversible data loss. */
  irreversibleDataLoss?: boolean;
  /** Primary-path / build / runtime blocker. */
  primaryPathBlocker?: boolean;
  /** Pure style or preference with no observable failure. */
  styleOnly?: boolean;
}

export interface Criticality {
  score: number;
  rating: Rating;
}

export function isHardness(value: unknown): value is Hardness {
  return typeof value === "string" && (HARDNESSES as readonly string[]).includes(value);
}

/** Ordered eligibility: a higher tier may handle a lower-tier issue. */
export function tierAtLeast(capability: Hardness, required: Hardness): boolean {
  return HARDNESSES.indexOf(capability) >= HARDNESSES.indexOf(required);
}

export function validateCriticalityInputs(inputs: CriticalityInputs): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(inputs.impact) || inputs.impact < 0 || inputs.impact > 4) {
    errors.push("impact must be an integer 0–4");
  }
  if (!Number.isInteger(inputs.likelihood) || inputs.likelihood < 0 || inputs.likelihood > 3) {
    errors.push("likelihood must be an integer 0–3");
  }
  if (!Number.isInteger(inputs.breadth) || inputs.breadth < 0 || inputs.breadth > 2) {
    errors.push("breadth must be an integer 0–2");
  }
  return errors;
}

/** Score = 2·Impact + Likelihood + Breadth, range 0–13. */
export function scoreCriticality(inputs: CriticalityInputs): number {
  return 2 * inputs.impact + inputs.likelihood + inputs.breadth;
}

export function ratingFromScore(score: number): Rating {
  if (score >= 11) return "critical";
  if (score >= 9) return "high";
  if (score >= 6) return "medium";
  if (score >= 3) return "low";
  return "advisory";
}

const RATING_ORDER: readonly Rating[] = ["advisory", "low", "medium", "high", "critical"];

/**
 * Deterministic rating: band from score, then floors.
 * - Exploitable security boundary or likely irreversible data loss → critical.
 * - Primary-path/build/runtime blocker → at least high.
 * - Style-only without observable failure → at most low.
 */
export function computeCriticality(inputs: CriticalityInputs, floors: FloorFlags = {}): Criticality {
  const score = scoreCriticality(inputs);
  let rating = ratingFromScore(score);
  if (floors.securityBoundaryExploitable || floors.irreversibleDataLoss) {
    rating = "critical";
  } else {
    if (floors.primaryPathBlocker && RATING_ORDER.indexOf(rating) < RATING_ORDER.indexOf("high")) {
      rating = "high";
    }
    if (floors.styleOnly && RATING_ORDER.indexOf(rating) > RATING_ORDER.indexOf("low")) {
      rating = "low";
    }
  }
  return { score, rating };
}

/** Medium, high, and critical findings block the loop; advisory/low are report-only. */
export function isBlocking(rating: Rating): boolean {
  return rating === "medium" || rating === "high" || rating === "critical";
}
