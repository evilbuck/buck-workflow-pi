import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runJev } from "../../jev-tool/index.js";
import {
  acceptanceCriteria,
  askRepairLift,
  closeSingleUnfinishedIterate,
  diagnoseAmbiguity,
  explainAmbiguity,
  repairCheckedPhase,
  unfinishedIterateReport,
} from "../ambiguity.js";
import { unfinishedIterates } from "../scan.js";
vi.mock("../../jev-tool/index.js", () => ({ runJev: vi.fn() }));

const judge = vi.mocked(runJev);

beforeEach(() => judge.mockReset());

function liftAnswer(choice: string) {
  return { raw: "", details: { answers: { lift: { type: "choice", choice, confidence: 0.9 } } } };
}

function subjectDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

const ITERATE_BODY = "---\n\n# Iteration: demo\n\n- Critical: fix the thing\n";

describe("unfinished iterate artifacts", () => {
  it("counts active, missing-status, and unterminated files as unfinished", () => {
    const dir = subjectDir({
      "iterate-a.md": `---\nstatus: active\ncompleted: null\n${ITERATE_BODY}`,
      "iterate-b.md": "# no frontmatter\n",
      "iterate-c.md": "---\nstatus: active\nnever closed\n",
      "iterate-done.md": "---\nstatus: completed\ncompleted: 2026-10-03\n---\n",
      "review-x.md": "---\nstatus: active\n",
    });
    expect(unfinishedIterates(dir).map((abs) => abs.slice(dir.length + 1))).toEqual([
      "iterate-a.md",
      "iterate-b.md",
      "iterate-c.md",
    ]);
  });

  it("does not count below-waterline artifacts as unfinished", () => {
    const dir = subjectDir({ "iterate-low.md": "---\nstatus: below-waterline\n---\n# iterate\n" });
    expect(unfinishedIterates(dir)).toEqual([]);
  });
});

describe("closeSingleUnfinishedIterate", () => {
  it("closes one active artifact, stamping both date fields and preserving the body", () => {
    const dir = subjectDir({
      "iterate-a.md": `---\nstatus: active\ncompleted: null\nupdated: 2026-10-01\nfrom_review: b-review\n${ITERATE_BODY}`,
    });
    const abs = join(dir, "iterate-a.md");
    expect(closeSingleUnfinishedIterate(dir, "2026-10-03T00:00:00.000Z")).toBe(true);
    const text = readFileSync(abs, "utf8");
    expect(text).toContain("status: completed");
    expect(text).toContain("completed: 2026-10-03");
    expect(text).toContain("updated: 2026-10-03");
    expect(text).toContain("from_review: b-review");
    expect(text.endsWith("\n# Iteration: demo\n\n- Critical: fix the thing\n")).toBe(true);
    expect(text).not.toContain("completed: null");
  });

  it("adds a missing date field instead of leaving it absent", () => {
    const dir = subjectDir({ "iterate-a.md": `---\nstatus: active\n${ITERATE_BODY}` });
    const abs = join(dir, "iterate-a.md");
    expect(closeSingleUnfinishedIterate(dir, "2026-10-03T00:00:00.000Z")).toBe(true);
    expect(readFileSync(abs, "utf8")).toMatch(/^completed: 2026-10-03$/m);
    expect(readFileSync(abs, "utf8")).toMatch(/^updated: 2026-10-03$/m);
  });

  it("closes nothing when two artifacts are unfinished", () => {
    const a = "---\nstatus: active\n---\n# iterate\n";
    const dir = subjectDir({ "iterate-a.md": a, "iterate-b.md": a });
    expect(closeSingleUnfinishedIterate(dir, "2026-10-03T00:00:00.000Z")).toBe(false);
    expect(readFileSync(join(dir, "iterate-a.md"), "utf8")).toBe(a);
    expect(readFileSync(join(dir, "iterate-b.md"), "utf8")).toBe(a);
  });

  it("closes nothing when the only artifact is below-waterline or already completed", () => {
    const low = "---\nstatus: below-waterline\n---\n# iterate\n";
    const dir = subjectDir({ "iterate-low.md": low });
    expect(closeSingleUnfinishedIterate(dir, "2026-10-03T00:00:00.000Z")).toBe(false);
    expect(readFileSync(join(dir, "iterate-low.md"), "utf8")).toBe(low);
  });

  it("refuses a target without well-formed active frontmatter", () => {
    const noFront = "# no frontmatter\n";
    const unterminated = "---\nstatus: active\nstill open\n";
    const dir = subjectDir({ "iterate-a.md": noFront });
    const other = subjectDir({ "iterate-a.md": unterminated });
    expect(closeSingleUnfinishedIterate(dir, "2026-10-03T00:00:00.000Z")).toBe(false);
    expect(closeSingleUnfinishedIterate(other, "2026-10-03T00:00:00.000Z")).toBe(false);
    expect(readFileSync(join(dir, "iterate-a.md"), "utf8")).toBe(noFront);
    expect(readFileSync(join(other, "iterate-a.md"), "utf8")).toBe(unterminated);
  });

  it("refuses a single artifact whose status is not active", () => {
    // One candidate, so the count check passes and the status guard decides.
    // The supervisor may only close what the child declared it was working on.
    for (const status of ["in-progress", "pending", "draft"]) {
      const body = `---\nstatus: ${status}\ncompleted: null\n${ITERATE_BODY}`;
      const dir = subjectDir({ "iterate-a.md": body });
      expect(closeSingleUnfinishedIterate(dir, "2026-10-03T00:00:00.000Z")).toBe(false);
      expect(readFileSync(join(dir, "iterate-a.md"), "utf8")).toBe(body);
    }
  });

  it("fails closed when the write cannot land", () => {
    const original = `---\nstatus: active\n${ITERATE_BODY}`;
    const dir = subjectDir({ "iterate-a.md": original });
    const abs = join(dir, "iterate-a.md");
    chmodSync(abs, 0o444);
    try {
      expect(closeSingleUnfinishedIterate(dir, "2026-10-03T00:00:00.000Z")).toBe(false);
      expect(readFileSync(abs, "utf8")).toBe(original);
    } finally {
      chmodSync(abs, 0o644);
    }
  });
});

describe("ambiguity diagnosis for an iterating miss", () => {
  it("names each unfinished artifact with its status, before any lift call", () => {
    const dir = subjectDir({
      "iterate-a.md": "---\nstatus: active\n---\n# iterate\n",
      "iterate-b.md": "---\nstatus: in-progress\n---\n# iterate\n",
      "iterate-done.md": "---\nstatus: completed\n---\n# iterate\n",
    });
    const phase = join(dir, "phase.md");
    writeFileSync(phase, "---\nstatus: completed\n---\n");
    const diagnosis = diagnoseAmbiguity({
      abs: phase,
      why: "postcondition scan ambiguous",
      sessionText: "did the fix",
      iterateReport: unfinishedIterateReport(dir),
    });
    expect(diagnosis).toContain("iterate-a.md (status active)");
    expect(diagnosis).toContain("iterate-b.md (status in-progress)");
    expect(diagnosis).not.toContain("iterate-done.md");
    // The completed phase must not be described as incomplete.
    expect(diagnosis).not.toContain("not completed");
  });

  it("omits the artifact line when the miss is not an iterating one", () => {
    const dir = subjectDir({ "phase.md": "---\nstatus: pending\n---\n" });
    const diagnosis = diagnoseAmbiguity({
      abs: join(dir, "phase.md"),
      why: "postcondition scan ambiguous",
      sessionText: "held",
    });
    expect(diagnosis).not.toContain("Iterate artifacts:");
  });

  it("reports nothing to iterate on when every artifact is finished", () => {
    const dir = subjectDir({
      "iterate-a.md": "---\nstatus: completed\n---\n# iterate\n",
      "iterate-b.md": "---\nstatus: below-waterline\n---\n# iterate\n",
    });
    expect(unfinishedIterateReport(dir)).toBe("no unfinished iterate artifact");
  });
});

describe("repairCheckedPhase", () => {
  it("marks a fully checked phase completed and stamps completed_at once", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "phase.md");
    writeFileSync(abs, "---\nstatus: in-progress\nacceptance_criteria:\n  - \"[x] a\"\n  - \"[x] b\"\n---\n");
    expect(repairCheckedPhase(abs, "2026-10-03")).toBe(true);
    const text = readFileSync(abs, "utf8");
    expect(text).toMatch(/^status: completed$/m);
    expect(text).toMatch(/^completed_at: 2026-10-03$/m);
    // Already completed: nothing left to repair.
    expect(repairCheckedPhase(abs, "2026-10-04")).toBe(false);
  });

  it("never touches a status line in the body, even when frontmatter has no status key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "phase.md");
    const body = '\n\n# Phase\n\n```\nstatus: pending\n```\n';
    writeFileSync(abs, `---\nacceptance_criteria:\n  - "[x] a"\n---${body}`);
    expect(repairCheckedPhase(abs, "2026-10-03T00:00:00.000Z")).toBe(true);
    const text = readFileSync(abs, "utf8");
    expect(text.endsWith(body)).toBe(true);
    expect(text).toMatch(/^status: pending$/m);
    expect(text).toMatch(/^status: completed$/m);
    expect(text).toMatch(/^completed_at: 2026-10-03$/m);
  });

  it("stamps completed_at as a bare date with no time component", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "phase.md");
    writeFileSync(abs, '---\nstatus: in-progress\nacceptance_criteria:\n  - "[x] a"\n---\n');
    expect(repairCheckedPhase(abs, "2026-10-03T00:00:00.000Z")).toBe(true);
    const text = readFileSync(abs, "utf8");
    expect(text).toMatch(/^completed_at: 2026-10-03$/m);
    expect(text).not.toMatch(/^completed_at: \d{4}-\d{2}-\d{2}T/m);
  });

  it("refuses when a box is unchecked, the list is empty, or the key is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const open = join(dir, "open.md");
    const empty = join(dir, "empty.md");
    const none = join(dir, "none.md");
    const noFront = join(dir, "no-front.md");
    writeFileSync(open, "---\nstatus: active\nacceptance_criteria:\n  - \"[x] a\"\n  - \"[ ] b\"\n---\n");
    writeFileSync(empty, "---\nstatus: active\nacceptance_criteria: []\n---\n");
    writeFileSync(none, "---\nstatus: active\n---\n");
    writeFileSync(noFront, "# no frontmatter\n");
    for (const abs of [open, empty, none, noFront]) {
      expect(repairCheckedPhase(abs, "2026-10-03")).toBe(false);
    }
  });
});

describe("acceptanceCriteria parsing", () => {
  it("returns nothing for a file with no frontmatter or no key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const plain = join(dir, "plain.md");
    const noKey = join(dir, "nokey.md");
    writeFileSync(plain, "# plain\n");
    writeFileSync(noKey, "---\nstatus: active\n---\n");
    expect(acceptanceCriteria(plain)).toEqual([]);
    expect(acceptanceCriteria(noKey)).toEqual([]);
  });

  it("stops at the first unindented line and unquotes items", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "p.md");
    // `status` sits at column 0 after the list, so the walk must stop there
    // rather than treating it as another criterion.
    writeFileSync(abs, "---\nacceptance_criteria:\n  - \"[x] one\"\n  - '[x] two'\nstatus: active\n---\n");
    expect(acceptanceCriteria(abs)).toEqual(["[x] one", "[x] two"]);
  });
});

describe("explainAmbiguity", () => {
  it("does not claim a completed status is not completed", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "phase.md");
    writeFileSync(abs, "---\nstatus: completed\ncompleted_at: 2026-10-03\n---\n");
    const text = explainAmbiguity(abs);
    expect(text).not.toContain("not completed");
    expect(text).toContain("phase status is completed");
  });

  it("still names unchecked boxes and the phase status for a pending phase", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "phase.md");
    writeFileSync(abs, "---\nstatus: pending\nacceptance_criteria:\n  - \"[ ] live query\"\n---\n");
    const text = explainAmbiguity(abs);
    expect(text).toContain("phase status is pending, not completed");
    expect(text).toContain("Unchecked: [ ] live query");
  });
});

describe("ambiguous repair lift", () => {
  it("diagnoses from the child report instead of treating unchecked boxes as the cause", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambiguity-"));
    const abs = join(dir, "phase.md");
    writeFileSync(abs, "---\nstatus: in-progress\nacceptance_criteria:\n  - \"[ ] bounded SQL retrieval\"\n---\n");
    const diagnosis = diagnoseAmbiguity({
      abs,
      why: "postcondition scan ambiguous",
      sessionText: "Runtime SQL retrieval is not implemented. Continue that work.",
    });
    expect(diagnosis).toContain("Runtime SQL retrieval is not implemented.");
    expect(diagnosis.indexOf("Child report:")).toBeLessThan(diagnosis.indexOf("Unchecked:"));
  });

  it("continues light and medium lifts and hands an illegal answer to the operator", async () => {
    judge.mockResolvedValueOnce(liftAnswer("light"));
    judge.mockResolvedValueOnce(liftAnswer("medium"));
    judge.mockResolvedValueOnce(liftAnswer("invented"));

    expect(await askRepairLift("small gap")).toMatchObject({ lift: "light" });
    expect(await askRepairLift("same phase")).toMatchObject({ lift: "medium" });
    expect(await askRepairLift("unknown")).toEqual({
      lift: "heavy",
      reason: "Jev did not return a legal lift",
      diagnosis: "unknown",
    });
    expect(judge.mock.calls[0]?.[1]).toMatchObject({ state: "small gap", questions: { lift: { type: "choice" } } });
  });

  it("hands a failed lift call to the operator with the diagnosis", async () => {
    judge.mockRejectedValueOnce(new Error("provider unavailable"));
    expect(await askRepairLift("child stopped early")).toEqual({
      lift: "heavy",
      reason: "provider unavailable",
      diagnosis: "child stopped early",
    });
  });
});
