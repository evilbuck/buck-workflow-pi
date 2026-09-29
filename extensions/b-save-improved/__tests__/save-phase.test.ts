import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { savePhase } from "../index.js";

describe("improved save phase", () => {
  let cwd = "";
  afterEach(() => { if (cwd) rmSync(cwd, { recursive: true, force: true }); });

  it("keeps a projected phase and otherwise picks the first incomplete phase", () => {
    cwd = mkdtempSync(join(tmpdir(), "save-phase-"));
    const subject = ".context/2026-09-29.example";
    mkdirSync(join(cwd, subject), { recursive: true });
    writeFileSync(join(cwd, subject, "phase-1-done.md"), "---\nstatus: completed\n---\n");
    writeFileSync(join(cwd, subject, "phase-4-proof.md"), "---\nstatus: pending\n---\n");
    expect(savePhase(cwd, subject, ".context/2026-09-29.example/phase-3.md", true)).toBe(".context/2026-09-29.example/phase-3.md");
    expect(savePhase(cwd, subject, null, false)).toBe(join(subject, "phase-4-proof.md"));
    expect(savePhase(cwd, subject, null, true)).toBeNull();
  });

  it("orders phase 2 before phase 10", () => {
    cwd = mkdtempSync(join(tmpdir(), "save-phase-"));
    const subject = ".context/2026-09-29.example";
    mkdirSync(join(cwd, subject), { recursive: true });
    writeFileSync(join(cwd, subject, "phase-10-work.md"), "---\nstatus: pending\n---\n");
    writeFileSync(join(cwd, subject, "phase-2-work.md"), "---\nstatus: pending\n---\n");
    expect(savePhase(cwd, subject, null, false)).toBe(join(subject, "phase-2-work.md"));
  });
});
