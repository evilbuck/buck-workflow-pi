import { describe, it, expect } from "vitest";
import { extractJson, maxBlockingHardness, validateFindingsPayload, type ValidatedFinding } from "../findings.js";

function finding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "F1",
    title: "Token accepted after expiry",
    location: "src/auth.ts:120",
    observed: "expired refresh tokens validate as sessions",
    expected: "expired tokens are rejected",
    evidence: "readToken() compares issuance only",
    impact: 3,
    likelihood: 3,
    breadth: 1,
    confidence: 1,
    fix_hardness: "medium",
    reproduction: { status: "not_run", note: "needs a live IdP" },
    ...overrides,
  };
}

describe("extractJson", () => {
  it("parses bare JSON", () => {
    expect(extractJson('{"findings":[]}')).toEqual({ findings: [] });
  });
  it("parses a fenced json block with surrounding prose", () => {
    const text = 'Here you go:\n```json\n{"findings":[]}\n```\nDone.';
    expect(extractJson(text)).toEqual({ findings: [] });
  });
  it("parses an embedded object when fenced parsing fails", () => {
    const text = 'Preamble {"a":1} trailing';
    expect(extractJson(text)).toEqual({ a: 1 });
  });
  it("throws when nothing parses", () => {
    expect(() => extractJson("no json here")).toThrow(/no JSON payload/);
  });
});

describe("validateFindingsPayload", () => {
  it("validates a well-formed finding and computes its rating deterministically", () => {
    const result = validateFindingsPayload({ findings: [finding()] });
    expect(result.errors).toEqual([]);
    expect(result.findings).toHaveLength(1);
    const f = result.findings[0];
    expect(f.score).toBe(10); // 2·3 + 3 + 1
    expect(f.rating).toBe("high");
    expect(f.blocking).toBe(true);
    expect(f.fixHardness).toBe("medium");
  });

  it("rejects a payload without a findings array", () => {
    expect(validateFindingsPayload({ stuff: [] }).errors[0]).toMatch(/findings array/);
    expect(validateFindingsPayload("nope").errors[0]).toMatch(/findings array/);
  });

  it("collects per-finding errors with finding-id context", () => {
    const result = validateFindingsPayload({
      findings: [finding({ id: "F1", impact: 9 }), finding({ id: "F1" }), finding({ id: "F3", fix_hardness: "trivial" })],
    });
    expect(result.findings).toEqual([]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toMatch(/F1: impact/);
    expect(result.errors[1]).toMatch(/F1: duplicate id/);
    expect(result.errors[2]).toMatch(/fix_hardness/);
  });

  it("rejects missing required strings and out-of-range confidence", () => {
    expect(validateFindingsPayload({ findings: [finding({ evidence: "  " })] }).errors[0]).toMatch(/evidence/);
    expect(validateFindingsPayload({ findings: [finding({ confidence: 2 })] }).errors[0]).toMatch(/confidence/);
  });

  it("requires reproduced findings to cite known command ids", () => {
    const result = validateFindingsPayload({
      findings: [finding({ reproduction: { status: "reproduced", command_ids: ["c1"] } })],
    }, new Set(["c1"]));
    expect(result.errors).toEqual([]);
    expect(result.findings[0].reproduction.commandIds).toEqual(["c1"]);

    const missing = validateFindingsPayload({
      findings: [finding({ reproduction: { status: "reproduced" } })],
    });
    expect(missing.errors[0]).toMatch(/requires at least one command_id/);
    expect(missing.findings).toEqual([]);

    const unknown = validateFindingsPayload({
      findings: [finding({ reproduction: { status: "reproduced", command_ids: ["cX"] } })],
    }, new Set(["c1"]));
    expect(unknown.errors[0]).toMatch(/unknown command_id cX/);
    expect(unknown.findings).toEqual([]);
  });

  it("validates reproduction shape and status enum", () => {
    expect(validateFindingsPayload({ findings: [finding({ reproduction: null })] }).errors[0]).toMatch(/reproduction must be an object/);
    expect(
      validateFindingsPayload({ findings: [finding({ reproduction: { status: "maybe" } })] }).errors[0],
    ).toMatch(/reproduction.status/);
    expect(
      validateFindingsPayload({ findings: [finding({ reproduction: {} })] }).errors[0],
    ).toMatch(/reproduction.status is required/);
  });

  it("maps floor flags into the computed rating", () => {
    const style = validateFindingsPayload({
      findings: [finding({ impact: 4, likelihood: 3, breadth: 2, style_only: true })],
    });
    expect(style.findings[0].rating).toBe("low");
    expect(style.findings[0].blocking).toBe(false);
    const security = validateFindingsPayload({
      findings: [finding({ impact: 1, likelihood: 0, breadth: 0, security_boundary_exploitable: true })],
    });
    expect(security.findings[0].rating).toBe("critical");
  });
});

describe("maxBlockingHardness", () => {
  const validated = (id: string, hardness: string): ValidatedFinding => {
    const result = validateFindingsPayload({ findings: [finding({ id, fix_hardness: hardness })] });
    expect(result.errors).toEqual([]);
    return result.findings[0];
  };

  it("returns the maximum hardness among blocking findings only", () => {
    expect(maxBlockingHardness([])).toBe(null);
    expect(maxBlockingHardness([
      { ...validated("A", "easy"), blocking: true },
      { ...validated("B", "medium"), blocking: false },
    ])).toBe("easy");
    expect(maxBlockingHardness([
      { ...validated("A", "easy"), blocking: true },
      { ...validated("B", "hard"), blocking: true },
    ])).toBe("hard");
    expect(maxBlockingHardness([{ ...validated("A", "medium"), blocking: false }])).toBe(null);
  });
});
