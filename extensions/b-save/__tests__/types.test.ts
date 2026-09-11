import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  UnknownSchemaVersionError,
  parseRunManifest,
  readRunManifest,
  runDir,
  writeRunManifest,
} from "../types.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "b-save-types-"));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const validManifest = {
  schema_version: 1,
  run_id: "run-abc",
  state: "snapshotting",
  flags: {
    dry_run: false,
    no_retain: false,
    archive_inferred: false,
    subject: null,
    model: null,
  },
  subject: null,
  session_evidence: {
    present: false,
    valid: false,
    stale_reasons: [],
    fields: {},
  },
  input_hashes: {},
  proposals: [],
  user_decisions: [],
  patch_set: null,
  journal: { status: "idle", files: [] },
  effects: [],
  terminal_error: null,
};

describe("run manifest schema", () => {
  it("round-trips a v1 manifest and rejects unknown schema versions", () => {
    const parsed = parseRunManifest(validManifest);
    expect(parsed.schema_version).toBe(1);
    expect(parsed.run_id).toBe("run-abc");

    expect(() => parseRunManifest({ ...validManifest, schema_version: 99 })).toThrow(
      UnknownSchemaVersionError,
    );
    expect(() => parseRunManifest({ ...validManifest, schema_version: "1" })).toThrow();
  });

  it("persists under .context/workflow/b-save/<run-id>/ and refuses escaping ids", () => {
    const { root, cleanup } = fixture();
    try {
      expect(runDir(root, "run-abc")).toBe(join(root, ".context/workflow/b-save/run-abc"));
      expect(() => runDir(root, "../escape")).toThrow(/run-id/i);

      writeRunManifest(root, validManifest);
      const onDisk = JSON.parse(
        readFileSync(join(root, ".context/workflow/b-save/run-abc/manifest.json"), "utf8"),
      );
      expect(onDisk.schema_version).toBe(1);
      expect(readRunManifest(root, "run-abc").run_id).toBe("run-abc");

      mkdirSync(join(root, ".context/workflow/b-save/bad"), { recursive: true });
      writeFileSync(
        join(root, ".context/workflow/b-save/bad/manifest.json"),
        JSON.stringify({ ...validManifest, run_id: "bad", schema_version: 2 }),
      );
      expect(() => readRunManifest(root, "bad")).toThrow(UnknownSchemaVersionError);
    } finally {
      cleanup();
    }
  });
});
