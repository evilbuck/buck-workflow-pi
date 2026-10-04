/**
 * Unit-level coverage for the phase-completion primitives. The supervisor
 * path is covered in `phase-completion.test.ts`; this file pins the parsing
 * and overview-row contracts that the supervisor relies on but does not
 * exercise on its own.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupRepos, phaseMd, repo, writeTree } from "./fixtures.js";
import {
  acceptanceCriteria,
  markPhaseCompleted,
  phaseFileDone,
  phaseIsDone,
  syncCheckedPhasesAt,
} from "../phase-completion.js";

const SUBJECT = ".context/2026-09-18.demo";
const PLAN = `${SUBJECT}/plan-demo.md`;
afterEach(cleanupRepos);

describe("acceptanceCriteria", () => {
  it("returns null when there is no frontmatter or no key", () => {
    expect(acceptanceCriteria("# no frontmatter\n")).toBeNull();
    expect(acceptanceCriteria("---\nstatus: active\n---\n")).toBeNull();
  });

  it("reads a block list and unquotes its items", () => {
    const text = "---\nacceptance_criteria:\n  - \"[x] first\"\n  - '[ ] second'\n  - third\n---\n";
    expect(acceptanceCriteria(text)).toEqual(["[x] first", "[ ] second", "third"]);
  });

  it("returns an empty list for an explicit empty inline value", () => {
    expect(acceptanceCriteria("---\nacceptance_criteria: []\n---\n")).toEqual([]);
    expect(acceptanceCriteria("---\nacceptance_criteria: [one, \"two\"]\n---\n")).toEqual(["one", "two"]);
  });

  it("stops at the first non-item, non-blank line", () => {
    const text = "---\nacceptance_criteria:\n  - one\nother: value\n  - two\n---\n";
    expect(acceptanceCriteria(text)).toEqual(["one"]);
  });
});

describe("phaseIsDone", () => {
  it("lets a non-empty box list decide over status", () => {
    expect(phaseIsDone("completed", ["[ ] open"])).toBe(false);
    expect(phaseIsDone("pending", ["[x] done"])).toBe(true);
  });

  it("falls back to status when the list is absent or empty", () => {
    expect(phaseIsDone("completed", null)).toBe(true);
    expect(phaseIsDone("pending", [])).toBe(false);
  });
});

describe("phaseFileDone", () => {
  it("reports false for a file that cannot be read", () => {
    expect(phaseFileDone(join(repo(), "missing.md"))).toBe(false);
  });
});

describe("markPhaseCompleted", () => {
  it("returns the text unchanged when boxes are not all checked", () => {
    const text = "---\nstatus: active\nacceptance_criteria:\n  - \"[ ] open\"\n---\n";
    expect(markPhaseCompleted(text, "2026-09-18")).toBe(text);
  });

  it("returns the text unchanged for a completed phase with no list", () => {
    const text = "---\nstatus: completed\n---\n";
    expect(markPhaseCompleted(text, "2026-09-18")).toBe(text);
  });

  it("stamps completed_at and refreshes an existing one", () => {
    const first = markPhaseCompleted("---\nstatus: active\nacceptance_criteria:\n  - \"[x] done\"\n---\n", "2026-09-18");
    expect(first).toContain("status: completed");
    expect(first).toContain("completed_at: 2026-09-18");
    const again = markPhaseCompleted(first, "2026-09-19");
    expect(again).toBe(first);
  });
});

describe("phases overview row synchronization", () => {
  // `b-phase` emits a singular `File` header; the row lookup is anchored on it.
  const OVERVIEW = "| Phase | Status | File |\n| --- | --- | --- |\n| 1 | pending | phase-1-demo.md |\n";

  it("marks the matching row completed", () => {
    const cwd = repo();
    writeTree(cwd, {
      [PLAN]: "---\nstatus: active\n---\n# Plan\n",
      [`${SUBJECT}/plan-demo-phases.md`]: `---\nstatus: active\n---\n${OVERVIEW}`,
      [`${SUBJECT}/phase-1-demo.md`]: "---\nstatus: pending\nacceptance_criteria:\n  - \"[x] landed\"\n---\n# Phase 1\n",
    });
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-18");
    const overview = readFileSync(join(cwd, SUBJECT, "plan-demo-phases.md"), "utf8");
    expect(overview).toContain("| 1 | completed | phase-1-demo.md |");
    expect(readFileSync(join(cwd, SUBJECT, "phase-1-demo.md"), "utf8")).toMatch(/^status: completed$/m);
  });

  it("pins the singular File header contract b-phase emits", () => {
    // A plural or renamed header silently skips the row, leaving a permanently
    // stale status in a human-facing table. This test is the tripwire for a
    // b-phase header change, not an endorsement of a looser match.
    const cwd = repo();
    const plural = "| Phase | Status | Files |\n| --- | --- | --- |\n| 1 | pending | phase-1-demo.md |\n";
    writeTree(cwd, {
      [PLAN]: "---\nstatus: active\n---\n# Plan\n",
      [`${SUBJECT}/plan-demo-phases.md`]: `---\nstatus: active\n---\n${plural}`,
      [`${SUBJECT}/phase-1-demo.md`]: "---\nstatus: pending\nacceptance_criteria:\n  - \"[x] landed\"\n---\n# Phase 1\n",
    });
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-18");
    // The phase file still completes; only the table row is left alone.
    expect(readFileSync(join(cwd, SUBJECT, "phase-1-demo.md"), "utf8")).toMatch(/^status: completed$/m);
    expect(readFileSync(join(cwd, SUBJECT, "plan-demo-phases.md"), "utf8")).toContain("| 1 | pending |");
  });

  it("leaves a table without the expected header alone", () => {
    const cwd = repo();
    const text = "---\nstatus: active\n---\n| Phase | Owner |\n| --- | --- |\n| 1 | someone |\n";
    writeTree(cwd, {
      [PLAN]: "---\nstatus: active\n---\n# Plan\n",
      [`${SUBJECT}/plan-demo-phases.md`]: text,
      [`${SUBJECT}/phase-1-demo.md`]: "---\nstatus: pending\nacceptance_criteria:\n  - \"[x] landed\"\n---\n# Phase 1\n",
    });
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-18");
    expect(readFileSync(join(cwd, SUBJECT, "plan-demo-phases.md"), "utf8")).toBe(text);
  });

  it("ignores a non-phase file in the subject folder", () => {
    const cwd = repo();
    const notes = join(cwd, SUBJECT, "notes.md");
    writeTree(cwd, { [PLAN]: "---\nstatus: active\n---\n# Plan\n" });
    writeTree(cwd, { [`${SUBJECT}/phase-1-demo.md`]: phaseMd(1, "pending", [], "plan-demo.md") });
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-18");
    expect(readFileSync(join(cwd, SUBJECT, "phase-1-demo.md"), "utf8")).toBe(phaseMd(1, "pending", [], "plan-demo.md"));
    expect(() => readFileSync(notes, "utf8")).toThrow();
  });

  it("is idempotent across repeated runs", () => {
    const cwd = repo();
    writeTree(cwd, {
      [PLAN]: "---\nstatus: active\n---\n# Plan\n",
      [`${SUBJECT}/phase-1-demo.md`]: "---\nstatus: pending\nacceptance_criteria:\n  - \"[x] landed\"\n---\n# Phase 1\n",
    });
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-18");
    const first = readFileSync(join(cwd, SUBJECT, "phase-1-demo.md"), "utf8");
    writeFileSync(join(cwd, SUBJECT, "phase-1-demo.md"), first);
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-19");
    expect(readFileSync(join(cwd, SUBJECT, "phase-1-demo.md"), "utf8")).toBe(first);
  });
});
