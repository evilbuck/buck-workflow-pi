import { describe, expect, it } from "vitest";
import { validateBuckReviewControl, validateRecoveryAction } from "../contracts.js";
import { invalidReviewControls, validReviewControls } from "./fixtures.js";

describe("buck.review/v1 control validation", () => {
  it.each(validReviewControls)("accepts $name", ({ value }) => {
    expect(validateBuckReviewControl(value)).toEqual({
      ok: true,
      value,
      diagnostics: [],
    });
  });

  it.each(invalidReviewControls)("rejects $name", ({ value, code }) => {
    const result = validateBuckReviewControl(value);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }));
  });
});

describe("fix-or-continue recovery contract", () => {
  it("rejects block as a recoverable action", () => {
    const result = validateRecoveryAction("block");

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_enum", path: "action" }),
    ]);
  });
});
