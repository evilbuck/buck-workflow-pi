import type { TSchema } from "@sinclair/typebox";
import type * as TypeboxValue from "@sinclair/typebox/value";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunManifestSchema, SCHEMA_VERSION } from "./b-save/types.js";
import { checkSchema } from "./typebox-check.js";

const { checkSpy } = vi.hoisted(() => ({ checkSpy: vi.fn() }));
vi.mock("@sinclair/typebox/value", async () => {
  const actual = await vi.importActual<typeof TypeboxValue>("@sinclair/typebox/value");
  checkSpy.mockImplementation((schema: unknown, value: unknown) => actual.Value.Check(schema as TSchema, value));
  return { ...actual, Value: { ...actual.Value, Check: checkSpy } };
});

const family = Type.Object(
  {
    kind: Type.Union([Type.Literal("a"), Type.Literal("b")]),
    note: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    n: Type.Number(),
    label: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const manifest = {
  schema_version: SCHEMA_VERSION,
  run_id: "run-1",
  state: "completed",
  flags: { dry_run: false, no_retain: false, archive_inferred: false, subject: null, model: null },
  subject: null,
  session_evidence: { present: false, valid: false, stale_reasons: [], fields: {} },
  input_hashes: {},
  proposals: [],
  user_decisions: [],
  patch_set: null,
  journal: { status: "idle", files: [] },
  effects: [],
  terminal_error: null,
};

describe("checkSchema", () => {
  beforeEach(() => {
    checkSpy.mockClear();
  });

  it("matches Value.Check for a real typebox schema", () => {
    expect("safeParse" in family).toBe(false);
    const valid = { kind: "a", note: null, n: 1 };
    const invalid = { kind: "a", note: "", n: 1, extra: true };
    expect(checkSchema(family, valid)).toBe(Value.Check(family, valid));
    expect(checkSchema(family, invalid)).toBe(Value.Check(family, invalid));
    expect(checkSchema(family, valid)).toBe(true);
    expect(checkSchema(family, invalid)).toBe(false);
  });

  it("uses safeParse and does not call Value.Check", () => {
    const before = checkSpy.mock.calls.length;
    const schema = { safeParse: (value: unknown) => ({ success: value === "ok" }) };
    expect(checkSchema(schema, "ok")).toBe(true);
    expect(checkSchema(schema, "no")).toBe(false);
    expect(checkSchema({ safeParse: () => ({}) }, "ok")).toBe(false);
    expect(checkSchema({ safeParse: () => ({ success: "yes" }) }, "ok")).toBe(false);
    expect(checkSpy.mock.calls.length).toBe(before);
  });

  it("names a foreign typebox family instead of throwing Unknown type", () => {
    expect(() => checkSchema({ type: "object" }, {})).toThrow(
      /^schema validation used a foreign typebox implementation \(.*Unknown type.*\)$/,
    );
  });

  it("agrees with Value.Check on the exported run manifest schema", () => {
    expect(checkSchema(RunManifestSchema, manifest)).toBe(true);
    expect(Value.Check(RunManifestSchema, manifest)).toBe(true);
    const invalid = { ...manifest, run_id: "" };
    expect(checkSchema(RunManifestSchema, invalid)).toBe(false);
    expect(Value.Check(RunManifestSchema, invalid)).toBe(false);
  });
});
