import { describe, expect, it } from "vitest";
import { isOutputDelta, liveTpsDisplay } from "./tps-tracker.js";

describe("isOutputDelta", () => {
  it("accepts the three streamed-output delta kinds", () => {
    expect(isOutputDelta({ type: "text_delta", delta: "x" })).toBe(true);
    expect(isOutputDelta({ type: "thinking_delta", delta: "x" })).toBe(true);
    expect(isOutputDelta({ type: "toolcall_delta", delta: "x" })).toBe(true);
  });

  it("rejects other event kinds", () => {
    expect(isOutputDelta({ type: "tool_execution_start" })).toBe(false);
    expect(isOutputDelta({ type: "usage" })).toBe(false);
    expect(isOutputDelta({ type: "" })).toBe(false);
    expect(isOutputDelta({ type: "text_delta" })).toBe(false);
  });
});

describe("liveTpsDisplay", () => {
  it("prefers official tokens when the provider has reported them", () => {
    const d = liveTpsDisplay(1200, 400, 3);
    expect(d).not.toBeNull();
    expect(d!.tps).toBe(400);
    expect(d!.tokenLabel).toBe("1200 tok");
    expect(d!.elapsed).toBe(3);
  });

  it("falls back to the length/4 estimate while no official count exists", () => {
    const d = liveTpsDisplay(0, 810, 3);
    expect(d!.tps).toBe(270);
    expect(d!.tokenLabel).toBe("~810 tok");
  });

  it("returns null before anything is measurable", () => {
    expect(liveTpsDisplay(0, 0, 3)).toBeNull();
    expect(liveTpsDisplay(1200, 0, 0)).toBeNull();
    expect(liveTpsDisplay(1200, 0, -1)).toBeNull();
  });
});
