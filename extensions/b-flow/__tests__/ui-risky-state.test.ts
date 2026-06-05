import { describe, it, expect } from "vitest";
import { isRiskyState } from "../ui.js";

describe("isRiskyState", () => {
  it("returns true for executingChunks state", () => {
    expect(isRiskyState("executingChunks")).toBe(true);
  });

  it("returns true for reviewing state", () => {
    expect(isRiskyState("reviewing")).toBe(true);
  });

  it("returns true for saving state", () => {
    expect(isRiskyState("saving")).toBe(true);
  });

  it("returns false for idle state", () => {
    expect(isRiskyState("idle")).toBe(false);
  });

  it("returns false for planning state", () => {
    expect(isRiskyState("planning")).toBe(false);
  });

  it("returns false for decomposing state", () => {
    expect(isRiskyState("decomposing")).toBe(false);
  });

  it("returns false for blocked state", () => {
    expect(isRiskyState("blocked")).toBe(false);
  });

  it("returns false for paused state", () => {
    expect(isRiskyState("paused")).toBe(false);
  });

  it("returns false for done state", () => {
    expect(isRiskyState("done")).toBe(false);
  });

  it("returns false for aborted state", () => {
    expect(isRiskyState("aborted")).toBe(false);
  });
});
