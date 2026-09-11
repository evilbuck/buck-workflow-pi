import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPatch, recoverApply, upsertIndexLine, validatePatch } from "../apply.js";
import { ContainmentError, type PatchPlan } from "../evaluate.js";
import { hashContent } from "../snapshot.js";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "b-save-apply-"));
  mkdirSync(join(root, ".context"), { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const plan: PatchPlan = {
  ops: [
    { path: ".context/memory/note.md", content: "# one\n" },
    { path: ".context/memory/index.md", content: "- note.md\n" },
  ],
  moves: [],
};

describe("applyPatch", () => {
  it("validates containment, writes atomically, and upserts index lines once", () => {
    const f = repo();
    try {
      expect(() => validatePatch(f.root, { ops: [{ path: "../etc/passwd", content: "x" }], moves: [] })).toThrow(
        ContainmentError,
      );
      const result = applyPatch(f.root, plan, { runId: "r1" });
      expect(result.status).toBe("applied");
      expect(readFileSync(join(f.root, ".context/memory/note.md"), "utf8")).toBe("# one\n");
      const once = upsertIndexLine("- note.md\n", "- note.md");
      expect(once).toBe("- note.md\n");
      const twice = upsertIndexLine(once, "- note.md");
      expect(twice).toBe("- note.md\n");
    } finally {
      f.cleanup();
    }
  });

  it("recovers a mid-apply failure by rollback or resume", () => {
    const f = repo();
    try {
      try {
        applyPatch(f.root, plan, { runId: "r2", failAfter: 1 });
        expect.fail("expected injected failure");
      } catch (error) {
        expect((error as Error).message).toBe("injected apply failure");
      }
      expect(existsSync(join(f.root, ".context/memory/note.md"))).toBe(true);
      expect(existsSync(join(f.root, ".context/memory/index.md"))).toBe(false);
      const rolled = recoverApply(f.root, "r2", "rollback");
      expect(rolled.status).toBe("rolled-back");
      expect(existsSync(join(f.root, ".context/memory/note.md"))).toBe(false);

      applyPatch(f.root, { ops: [plan.ops[0]], moves: [] }, { runId: "r3", failAfter: 1 });
    } catch {
      const resumed = recoverApply(f.root, "r3", "resume");
      expect(["resumed", "rolled-back"]).toContain(resumed.status);
    } finally {
      f.cleanup();
    }
  });

  it("aborts when a before-image drifts before apply", () => {
    const f = repo();
    try {
      const path = ".context/memory/note.md";
      mkdirSync(join(f.root, ".context/memory"), { recursive: true });
      writeFileSync(join(f.root, path), "old\n");
      expect(() =>
        applyPatch(f.root, { ops: [{ path, content: "new\n" }], moves: [] }, {
          runId: "r4",
          expectedHashes: { [path]: hashContent("other\n") },
        }),
      ).toThrow(/hash drift/);
    } finally {
      f.cleanup();
    }
  });
});
