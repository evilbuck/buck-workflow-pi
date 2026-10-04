/**
 * `call-failure.ts` is the last line of defense when a nested call throws
 * something unserializable — a bigint, a circular object, a throwing
 * `toString`. These cases only fail inside a real incident, so they are
 * pinned here rather than discovered in a parent chat.
 */
import { describe, expect, it } from "vitest";
import { formatFailureForAgent, serializeCallError } from "../call-failure.js";

/** Throws from `toString`, so `String(value)` cannot succeed. */
const hostile = {
  toString() {
    throw new Error("nope");
  },
};

describe("serializeCallError", () => {
  it("keeps a plain Error's name, message, and stack", () => {
    const error = new Error("child died");
    expect(serializeCallError(error)).toMatchObject({ name: "Error", message: "child died" });
    expect(serializeCallError(error).stack).toContain("child died");
  });

  it("keeps a structured cause readable instead of flattening it to [object Object]", () => {
    class ProviderError extends Error {
      override name = "ProviderError";
    }
    const error = new ProviderError("provider refused");
    error.cause = { detail: "SQL pool unreachable", code: "ECONNREFUSED" };
    const serialized = serializeCallError(error);
    expect(serialized.name).toBe("ProviderError");
    expect(serialized.cause).toMatchObject({ detail: "SQL pool unreachable", code: "ECONNREFUSED" });
    expect(() => JSON.stringify(serialized)).not.toThrow();
    // The whole point: the operator can read the cause instead of seeing
    // the literal string "[object Object]".
    expect(JSON.stringify(serialized.cause)).toContain("SQL pool unreachable");
  });

  it("keeps a string cause as a string and recurses into a nested error cause", () => {
    expect(serializeCallError(Object.assign(new Error("outer"), { cause: "plain text" })).cause).toBe("plain text");
    const inner = new Error("inner detail");
    const error = Object.assign(new Error("outer"), { cause: inner });
    expect(serializeCallError(error).cause).toMatchObject({ name: "Error", message: "inner detail" });
  });

  it("survives a circular cause instead of throwing", () => {
    const cause: Record<string, unknown> = { detail: "loop" };
    cause.self = cause;
    const error = Object.assign(new Error("cyclic"), { cause });
    const serialized = serializeCallError(error);
    expect(() => JSON.stringify(serialized)).not.toThrow();
    expect(JSON.stringify(serialized)).toContain("circular");
  });

  it("carries extra own fields as details", () => {
    const error = Object.assign(new Error("structured"), { stage: "iterate", attempt: 2 });
    expect(serializeCallError(error).details).toMatchObject({ stage: "iterate", attempt: 2 });
  });

  it("flattens a non-Error object and drops the reserved keys", () => {
    const serialized = serializeCallError({ name: "Custom", message: "bad reply", stack: "s", extra: 1 });
    expect(serialized).toMatchObject({ name: "Custom", message: "bad reply", stack: "s" });
    expect(serialized.details).toEqual({ extra: 1 });
  });

  it("names a non-Error object without string fields as Error", () => {
    const serialized = serializeCallError({ raw: true });
    expect(serialized.name).toBe("Error");
    expect(serialized.stack).toBeUndefined();
  });

  it("stringifies a primitive that cannot be an Error or a record", () => {
    expect(serializeCallError("just a string")).toEqual({ name: "Error", message: "just a string" });
    expect(serializeCallError(42).message).toBe("42");
  });

  it("stringifies a bigint instead of throwing on JSON serialization", () => {
    const serialized = serializeCallError(Object.assign(new Error("big"), { budget: 10n }));
    expect(serialized.details).toMatchObject({ budget: "10" });
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it("recurses into arrays of mixed values", () => {
    const error = Object.assign(new Error("batch"), { items: [1, "two", null, 3n] });
    expect(serializeCallError(error).details).toMatchObject({ items: [1, "two", null, "3"] });
  });

  it("does not invoke toString on a value that only defines one", () => {
    // `hostile` throws from toString. Nothing forces a string coercion once the
    // value is walked structurally, so the throw must not be reachable.
    const error = Object.assign(new Error("hostile"), { culprit: hostile });
    const serialized = serializeCallError(error);
    expect(() => JSON.stringify(serialized)).not.toThrow();
    expect(serialized.details).toMatchObject({ culprit: {} });
  });

  it("substitutes a placeholder for a primitive whose toString throws", () => {
    // A non-object hostile value still has to be stringified, so the guard in
    // safeString is the thing that keeps this from throwing.
    const error = Object.assign(new Error("hostile primitive"), {
      code: Object.assign(Object.create(null), { toString: hostile.toString }),
    });
    expect(() => serializeCallError(error)).not.toThrow();
  });
});

describe("formatFailureForAgent", () => {
  it("marks the payload as diagnostic and keeps the machine authoritative", () => {
    const text = formatFailureForAgent({
      prompt: "do the thing",
      agent: { kind: "work-session", id: "s1", role: "b-iterate" },
      error: { name: "Error", message: "boom" },
      state: "iterating",
      operation: "run-skill",
      trying: "run b-iterate",
    });
    expect(text).toContain("state machine remains authoritative");
    expect(text).toContain("do the thing");
    expect(text).toContain("b-iterate");
    expect(() => JSON.parse(text.slice(text.indexOf("{")))).not.toThrow();
  });
});
