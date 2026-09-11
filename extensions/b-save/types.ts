import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const SCHEMA_VERSION = 1 as const;

export class UnknownSchemaVersionError extends Error {
  readonly schemaVersion: unknown;
  constructor(schemaVersion: unknown) {
    super("Unknown b-save run schema version: " + String(schemaVersion));
    this.name = "UnknownSchemaVersionError";
    this.schemaVersion = schemaVersion;
  }
}

export class InvalidRunIdError extends Error {
  constructor(runId: string) {
    super("Invalid b-save run-id: " + runId);
    this.name = "InvalidRunIdError";
  }
}

const FlagsSchema = Type.Object({
  dry_run: Type.Boolean(),
  no_retain: Type.Boolean(),
  archive_inferred: Type.Boolean(),
  subject: Type.Union([Type.String(), Type.Null()]),
  model: Type.Union([Type.String(), Type.Null()]),
});

const SessionEvidenceSchema = Type.Object({
  present: Type.Boolean(),
  valid: Type.Boolean(),
  stale_reasons: Type.Array(Type.String()),
  fields: Type.Record(Type.String(), Type.Unknown()),
});

const JournalSchema = Type.Object({
  status: Type.Union([
    Type.Literal("idle"),
    Type.Literal("writing"),
    Type.Literal("recovering"),
  ]),
  files: Type.Array(Type.String()),
});

const EffectOutcomeSchema = Type.Object({
  name: Type.String(),
  outcome: Type.Union([
    Type.Literal("succeeded"),
    Type.Literal("failed_nonblocking"),
    Type.Literal("unsupported"),
    Type.Literal("skipped"),
  ]),
  detail: Type.Union([Type.String(), Type.Null()]),
});

export const RunManifestSchema = Type.Object({
  schema_version: Type.Literal(SCHEMA_VERSION),
  run_id: Type.String({ minLength: 1 }),
  state: Type.String(),
  flags: FlagsSchema,
  subject: Type.Union([
    Type.Object({
      name: Type.String(),
      path: Type.String(),
      status: Type.Union([Type.String(), Type.Null()]),
      created: Type.Boolean(),
    }),
    Type.Null(),
  ]),
  session_evidence: SessionEvidenceSchema,
  input_hashes: Type.Record(Type.String(), Type.String()),
  proposals: Type.Array(Type.Unknown()),
  user_decisions: Type.Array(Type.Unknown()),
  patch_set: Type.Union([Type.Unknown(), Type.Null()]),
  journal: JournalSchema,
  effects: Type.Array(EffectOutcomeSchema),
  terminal_error: Type.Union([Type.String(), Type.Null()]),
});

export type RunManifest = Static<typeof RunManifestSchema>;

export const TERMINAL_STATES = [
  "completed",
  "aborted",
  "failed_model",
  "failed_apply",
  "awaiting_subject_choice",
  "awaiting_policy",
] as const;

export function parseRunManifest(data: unknown) {
  if (!data || typeof data !== "object") {
    throw new Error("Run manifest must be an object");
  }
  const version = "schema_version" in data ? data.schema_version : undefined;
  if (version !== SCHEMA_VERSION) {
    throw new UnknownSchemaVersionError(version);
  }
  if (!Value.Check(RunManifestSchema, data)) {
    throw new Error("Run manifest failed schema validation");
  }
  return data;
}

export function runDir(root: string, runId: string) {
  if (!runId || runId.includes("..") || runId.includes(sep) || runId.includes("/") || runId.includes("\\")) {
    throw new InvalidRunIdError(runId);
  }
  const base = resolve(root, ".context", "workflow", "b-save");
  const dir = resolve(base, runId);
  if (dir !== join(base, runId) && !dir.startsWith(base + sep)) {
    throw new InvalidRunIdError(runId);
  }
  return dir;
}

function manifestPath(root: string, runId: string) {
  return join(runDir(root, runId), "manifest.json");
}

export function writeRunManifest(root: string, manifest: RunManifest) {
  const parsed = parseRunManifest(manifest);
  const path = manifestPath(root, parsed.run_id);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(parsed, null, 2) + "\n");
  return path;
}

export function readRunManifest(root: string, runId: string) {
  const raw = JSON.parse(readFileSync(manifestPath(root, runId), "utf8"));
  return parseRunManifest(raw);
}
