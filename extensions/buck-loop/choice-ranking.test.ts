import { describe, expect, it, vi } from "vitest";
import { rankChoices } from "./choice-ranking.js";

describe("native display scores", () => {
  it("orders scores without mutating legal actions or returning a selection", async () => {
    const legal = Object.freeze([Object.freeze({ kind: "retry" as const }), Object.freeze({ kind: "advance" as const })]);
    const ask = vi.fn(async () => ({ raw: "", details: { answers: { retry: { type: "score", score: 1 }, advance: { type: "score", score: 4 } } } }));
    const result = await rankChoices(legal, "ambiguous postcondition", ask);
    expect(result.choices).toEqual([{ kind: "advance", score: 4 }, { kind: "retry", score: 1 }]);
    expect(legal).toEqual([{ kind: "retry" }, { kind: "advance" }]);
    expect(result).not.toHaveProperty("accepted");
    expect(result).not.toHaveProperty("selection");
  });
  it("leaves the full legal set unranked on native failure, never guesses", async () => {
    const result = await rankChoices([{ kind: "retry" }, { kind: "advance" }], "", async () => ({ raw: "error", details: { error: "no key" } }));
    expect(result.choices).toEqual([{ kind: "retry" }, { kind: "advance" }]);
    expect(result.error).toContain("no valid display score");
  });
  it("avoids native calls for deterministic single choices", async () => {
    const ask = vi.fn();
    expect((await rankChoices([{ kind: "save" }], "", ask)).choices).toEqual([{ kind: "save" }]);
    expect(ask).not.toHaveBeenCalled();
  });
  it("accepts fractional expected scores from the native score contract", async () => {
    const result = await rankChoices([{ kind: "retry" }, { kind: "advance" }], "", async () => ({
      raw: "", details: { answers: { retry: { type: "score", score: 1.25 }, advance: { type: "score", score: 3.75 } } },
    }));
    expect(result.choices).toEqual([{ kind: "advance", score: 3.75 }, { kind: "retry", score: 1.25 }]);
    expect(result.error).toBeUndefined();
  });
});
