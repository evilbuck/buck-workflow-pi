/**
 * Host-agnostic schema check for plugin extensions.
 *
 * OMP rewrites `@sinclair/typebox` to a Zod-backed shim and leaves
 * `@sinclair/typebox/value` on real typebox. Checking the schema object
 * avoids that specifier mismatch. Real typebox schemas go through `Value.Check`.
 *
 * @example
 * checkSchema(Type.Object({ n: Type.Number() }), { n: 1 });
 */
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

type SafeParseSchema = {
  safeParse: (value: unknown) => { success?: unknown };
};
function hasSafeParse(schema: unknown): schema is SafeParseSchema {
  if (typeof schema !== "object" || schema === null || !("safeParse" in schema)) return false;
  return typeof schema.safeParse === "function";
}

function isUnknownType(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "ValueCheckUnknownTypeError" || error.message.includes("Unknown type");
}

/**
 * Returns whether `value` satisfies `schema`.
 *
 * @param schema - A typebox schema, or a shim schema with `safeParse`.
 * @param value - The candidate value.
 * @returns `true` when the selected validator accepts `value`.
 * @throws Error when `Value.Check` hits a foreign typebox family.
 */
export function checkSchema(schema: unknown, value: unknown): boolean {
  if (hasSafeParse(schema)) return schema.safeParse(value).success === true;
  try {
    // Value.Check requires TSchema; a foreign object is the Unknown type path.
    const typeSchema = schema as TSchema;
    return Value.Check(typeSchema, value);
  } catch (error) {
    if (!isUnknownType(error)) throw error;
    const message = error instanceof Error ? error.message : "Unknown type";
    throw new Error(`schema validation used a foreign typebox implementation (${message})`);
  }
}
