import { describe, expect, it, vi } from "vitest";
import { createTypeSafeEvaluator, type TypeSafeRequest } from "../evaluator.js";

describe("shared TypeSafe evaluator", () => {
  it("rejects an empty question set before constructing a client", async () => {
    const createClient = vi.fn();
    const evaluate = createTypeSafeEvaluator({ createClient });

    const result = await evaluate({ state: "review", questions: {} });

    expect(result).toEqual({
      ok: false,
      failure: expect.objectContaining({ code: "invalid_request" }),
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a request with no state before contacting the provider", async () => {
    const systemOne = vi.fn();
    const createClient = vi.fn(() => ({ systemOne }));
    const evaluate = createTypeSafeEvaluator({ createClient });

    const result = await evaluate({
      questions: { decision: { type: "noul" } },
    } as unknown as TypeSafeRequest);

    expect(result).toEqual({
      ok: false,
      failure: expect.objectContaining({ code: "invalid_request" }),
    });
    expect(systemOne).not.toHaveBeenCalled();
  });

  it("forwards a valid request and returns the complete provider result", async () => {
    const providerResult = {
      model: "jev-fixture",
      answers: { route: { type: "choice", choice: "fix", confidence: 0.9 } },
      usage: { input_tokens: 3, output_tokens: 2 },
    };
    const systemOne = vi.fn(async () => providerResult);
    const evaluate = createTypeSafeEvaluator({ createClient: () => ({ systemOne }) });
    const request: TypeSafeRequest = {
      state: { report: "needs repair" },
      questions: {
        route: { type: "choice", criteria: { fix: "repair", continue: "replace" } },
      },
      model: "jev-2",
    };

    await expect(evaluate(request)).resolves.toEqual({ ok: true, result: providerResult });
    expect(systemOne).toHaveBeenCalledWith(request);
  });

  it("normalizes provider failures without retaining their raw message", async () => {
    const evaluate = createTypeSafeEvaluator({
      createClient: () => ({
        systemOne: vi.fn(async () => {
          throw new Error("503 upstream credential=secret-value");
        }),
      }),
    });

    const result = await evaluate({
      state: "review",
      questions: { decision: { type: "noul" } },
    });

    expect(result).toEqual({
      ok: false,
      failure: {
        code: "provider_unavailable",
        message: "TypeSafe evaluation is unavailable (HTTP 503).",
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });
});
