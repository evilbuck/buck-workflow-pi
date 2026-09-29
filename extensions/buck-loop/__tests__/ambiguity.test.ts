import { beforeEach, describe, expect, it, vi } from "vitest";
import { runJev } from "../../jev-tool/index.js";
import { askCanFixWithoutOperator } from "../ambiguity.js";

vi.mock("../../jev-tool/index.js", () => ({ runJev: vi.fn() }));

const judge = vi.mocked(runJev);

beforeEach(() => judge.mockReset());

describe("ambiguous postcondition fixability", () => {
  it("only permits a retry at or above the 0.8 noul boundary", async () => {
    judge.mockResolvedValueOnce({ raw: "", details: { answers: { can_fix: { type: "noul", noul: 0.79 } } } });
    judge.mockResolvedValueOnce({ raw: "", details: { answers: { can_fix: { type: "noul", noul: 0.8 } } } });

    expect((await askCanFixWithoutOperator("phase needs a repair")).yes).toBe(false);
    expect((await askCanFixWithoutOperator("phase can be repaired")).yes).toBe(true);
  });

  it("blocks when the evaluator has no fixability probability or fails", async () => {
    judge.mockResolvedValueOnce({ raw: "", details: { answers: { can_fix: { type: "noul" } } } });
    judge.mockRejectedValueOnce(new Error("provider unavailable"));

    expect(await askCanFixWithoutOperator("unknown")).toMatchObject({ yes: false, reason: expect.stringContaining("did not return") });
    expect(await askCanFixWithoutOperator("unknown")).toEqual({ yes: false, reason: "provider unavailable" });
  });
});
