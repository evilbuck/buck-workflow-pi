import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashContent, redactUntrusted, takeSnapshot } from "../snapshot.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "b-save-snap-"));
  execFileSync("git", ["init", "-q", "-b", "feature/x"], { cwd: root });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function subject(root: string, name: string, status: string) {
  const path = join(root, ".context", name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "index.md"), "---\nstatus: " + status + "\n---\n");
  return path;
}

describe("takeSnapshot", () => {
  it("selects unique active subject, lists completed, and ignores session hint", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.active", "active");
      subject(f.root, "2026-08-26.completed", "completed");
      mkdirSync(join(f.root, ".context/workflow"), { recursive: true });
      writeFileSync(
        join(f.root, ".context/workflow/current-session.json"),
        JSON.stringify({ subject: "stale", memory_file: "old.md" }),
      );
      const result = takeSnapshot(f.root, { branch: "feature/x", today: "2026-09-10" });
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") return;
      expect(result.snapshot.subject.name).toBe("2026-08-20.active");
      expect(result.snapshot.session_evidence.present).toBe(true);
      expect(result.snapshot.session_evidence.used).toBe(false);
      expect(result.snapshot.input_hashes[".context/2026-08-20.active/index.md"]).toBe(
        hashContent("---\nstatus: active\n---\n"),
      );
    } finally {
      f.cleanup();
    }
  });

  it("reports ambiguity and lets explicit subject win, without escaping .context", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.alpha", "active");
      subject(f.root, "2026-08-21.beta", "active");
      const ambiguous = takeSnapshot(f.root, { branch: "feature/x", today: "2026-09-10" });
      expect(ambiguous.kind).toBe("ambiguous");
      if (ambiguous.kind !== "ambiguous") return;
      expect(ambiguous.candidates.map((candidate) => candidate.name)).toEqual(["2026-08-21.beta", "2026-08-20.alpha"]);

      const selected = takeSnapshot(f.root, {
        branch: "feature/x",
        today: "2026-09-10",
        subject: "2026-08-21.beta",
      });
      expect(selected.kind).toBe("ok");
      if (selected.kind !== "ok") return;
      expect(selected.snapshot.subject).toMatchObject({
        name: "2026-08-21.beta",
        status: "active",
        created: false,
      });

      expect(() => takeSnapshot(f.root, { subject: "../escape" })).toThrow(/contain/i);
    } finally {
      f.cleanup();
    }
  });

  it("stages unprovenanced loose artifacts, redacts secrets, and maps proposal dependencies", () => {
    const f = fixture();
    try {
      const dir = subject(f.root, "2026-08-20.work", "active");
      writeFileSync(
        join(dir, "plan-work.md"),
        "---\nstatus: active\nmemory: [../memory/a.md]\nspec: spec-work.md\n---\n# Plan\n\n## User Goal\n\nsecret sk-abc123456789\n",
      );
      writeFileSync(join(f.root, ".context/plan-orphan.md"), "# plan\n");
      writeFileSync(join(f.root, ".context/draft-commit.md"), "# draft\n");
      const result = takeSnapshot(f.root, { branch: "feature/x", today: "2026-09-10" });
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") return;
      expect(result.snapshot.loose_artifacts).toEqual([
        { path: ".context/draft-commit.md", move: false },
        { path: ".context/plan-orphan.md", move: false },
      ]);
      expect(result.snapshot.plans[0]).toMatchObject({
        path: "plan-work.md",
        spec: "spec-work.md",
      });
      expect(result.snapshot.redacted_text["plan-work.md"]).not.toContain("sk-abc123456789");
      expect(result.snapshot.proposal_dependencies.memory_draft).toContain("subject_index");
      expect(result.snapshot.proposal_dependencies.crossref).toContain("plans");
    } finally {
      f.cleanup();
    }
  });
});

describe("redactUntrusted", () => {
  it("bounds length and redacts token-like secrets", () => {
    const redacted = redactUntrusted("token=sk-abc123456789 extra", 20);
    expect(redacted.length).toBeLessThanOrEqual(20);
    expect(redacted).not.toContain("sk-abc123456789");
  });
});
