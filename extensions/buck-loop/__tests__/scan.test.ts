/**
 * Disk-scan tests. Each case is a temp git checkout with planted plan/phase
 * files. Expected values are literals (kinds, flags, filenames), not a
 * second parser. The live repo is never scanned.
 */
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cleanupRepos, git, planMd, phaseMd, repo, writeTree } from "./fixtures.js";
import { scan } from "../scan.js";
import type { ReviewFacts } from "../types.js";

const SUBJECT = "2026-09-18.demo";
const OTHER = "2026-09-18.other";

function phased(
  root: string,
  phases: Array<{ n: number; status: string; dependsOn?: number[] }>,
  extra: Record<string, string> = {},
): void {
  const files: Record<string, string> = {
    [`.context/${SUBJECT}/plan-demo.md`]: planMd(),
    [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
    ...extra,
  };
  for (const p of phases) {
    files[`.context/${SUBJECT}/phase-${p.n}-p${p.n}.md`] = phaseMd(p.n, p.status, p.dependsOn ?? []);
  }
  writeTree(root, files);
}

function reportMd(docs: string, howto: string): string {
  return `## Plan Path Review: demo

### Documentation Impact
- ${docs}

### How-to Impact
- ${howto}
`;
}

function asReport(facts: ReviewFacts): Extract<ReviewFacts, { kind: "report" }> {
  expect(facts.kind).toBe("report");
  if (facts.kind !== "report") throw new Error("expected report facts");
  return facts;
}

afterEach(cleanupRepos);

describe("scan: path resolution", () => {
  it("resolves an explicit plan path to that plan and the first incomplete phase", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "pending" },
      { n: 2, status: "pending" },
    ]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-demo.md` });
    expect(result.subject).toBe(SUBJECT);
    expect(result.planPath).toBe(`.context/${SUBJECT}/plan-demo.md`);
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
    expect(result.planFacts).toEqual({ kind: "phased-incomplete" });
  });

  it("resolves an explicit later phase path to the first incomplete phase of the same plan", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "pending" },
      { n: 2, status: "pending" },
    ]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/phase-2-p2.md` });
    expect(result.planPath).toBe(`.context/${SUBJECT}/plan-demo.md`);
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
  });

  it("resolves a subject directory without guessing another subject", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    writeTree(root, {
      [`.context/${OTHER}/plan-other.md`]: planMd(),
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
    expect(result.subject).toBe(SUBJECT);
    expect(result.planPath).toBe(`.context/${SUBJECT}/plan-demo.md`);
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
  });

  it("resolves a subject folder name against .context/", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    const result = scan({ projectRoot: root, path: SUBJECT });
    expect(result.subject).toBe(SUBJECT);
    expect(result.planFacts).toEqual({ kind: "phased-incomplete" });
  });

  it("does not create a plan when the path is missing", () => {
    const root = repo();
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-demo.md` });
    expect(result.planFacts.kind).toBe("missing");
    if (result.planFacts.kind === "missing") {
      expect(result.planFacts.reason).toMatch(/does not exist/i);
    }
    expect(existsSync(join(root, ".context", SUBJECT))).toBe(false);
  });

  it("refuses to guess when the path is .context with multiple subjects", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    writeTree(root, { [`.context/${OTHER}/plan-other.md`]: planMd() });
    const result = scan({ projectRoot: root, path: ".context" });
    expect(result.planFacts.kind).toBe("missing");
    if (result.planFacts.kind === "missing") {
      expect(result.planFacts.reason).toMatch(/guess|multiple/i);
    }
    expect(result.subject).toBeNull();
  });

  it("refuses to guess among multiple plans in one subject", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-alpha.md`]: planMd(),
      [`.context/${SUBJECT}/plan-beta.md`]: planMd(),
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
    expect(result.planFacts.kind).toBe("missing");
    if (result.planFacts.kind === "missing") {
      expect(result.planFacts.reason).toMatch(/multiple plans/i);
    }
  });

  it("uses the named plan when a subject has more than one", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-alpha.md`]: planMd(),
      [`.context/${SUBJECT}/plan-beta.md`]: planMd(),
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-beta.md` });
    expect(result.planPath).toBe(`.context/${SUBJECT}/plan-beta.md`);
    expect(result.planFacts).toEqual({ kind: "unphased" });
    expect(result.phasePath).toBeNull();
  });

  it("reports unphased when a plan has no phase files", () => {
    const root = repo();
    writeTree(root, { [`.context/${SUBJECT}/plan-demo.md`]: planMd() });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-demo.md` });
    expect(result.planFacts).toEqual({ kind: "unphased" });
    expect(result.phasePath).toBeNull();
  });

  it("reports phased-complete when every phase is completed", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "completed" },
      { n: 2, status: "completed" },
    ]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
    expect(result.planFacts).toEqual({ kind: "phased-complete" });
    expect(result.phasePath).toBeNull();
  });

  it("scopes phases to the explicitly selected plan", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-epic.md`]: planMd(),
      [`.context/${SUBJECT}/plan-picker.md`]: planMd(),
      [`.context/${SUBJECT}/phase-1-epic.md`]: phaseMd(1, "completed", [], "plan-epic.md"),
    });

    const picker = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-picker.md` });
    expect(picker.planFacts).toEqual({ kind: "unphased" });
    expect(picker.phasePath).toBeNull();

    const epic = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-epic.md` });
    expect(epic.planFacts).toEqual({ kind: "phased-complete" });
    expect(epic.phasePath).toBeNull();
  });

  it("keeps untagged phase compatibility only for a sole plan", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-demo.md` });
    expect(result.planFacts).toEqual({ kind: "phased-incomplete" });
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
  });

  it("resolves an explicitly selected owned phase in a multi-plan subject", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-epic.md`]: planMd(),
      [`.context/${SUBJECT}/plan-picker.md`]: planMd(),
      [`.context/${SUBJECT}/phase-1-picker.md`]: phaseMd(1, "pending", [], "plan-picker.md"),
    });

    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/phase-1-picker.md` });
    expect(result.planPath).toBe(`.context/${SUBJECT}/plan-picker.md`);
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-1-picker.md`);
  });

  it("does not treat an explicit empty plan owner as an untagged sole-plan phase", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-demo.md`]: planMd(),
      [`.context/${SUBJECT}/phase-1-demo.md`]:
        "---\nstatus: completed\nplan:\nphase: 1\norder: 1\ndepends_on: []\ndependency_type: HARD\n---\n# Phase 1\n",
    });

    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-demo.md` });

    expect(result.planFacts).toEqual({ kind: "unphased" });
    expect(result.phasePath).toBeNull();
  });

  it("selects the first incomplete phase whose HARD dependencies are completed", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "completed" },
      { n: 2, status: "pending", dependsOn: [1] },
      { n: 3, status: "pending", dependsOn: [2] },
    ]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-demo.md` });
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-2-p2.md`);
    expect(result.planFacts).toEqual({ kind: "phased-incomplete" });
  });

  it("does not skip an incomplete dependency to reach a later phase", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "pending" },
      { n: 2, status: "pending", dependsOn: [1] },
    ]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/phase-2-p2.md` });
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
  });

  it("selects no phase when the remaining phases form a dependency cycle", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "completed" },
      { n: 2, status: "pending", dependsOn: [3] },
      { n: 3, status: "pending", dependsOn: [2] },
    ]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-demo.md` });
    expect(result.subject).toBe(SUBJECT);
    expect(result.planPath).toBe(`.context/${SUBJECT}/plan-demo.md`);
    expect(result.phasePath).toBeNull();
    expect(result.planFacts.kind).toBe("missing");
    if (result.planFacts.kind === "missing") {
      expect(result.planFacts.reason).toMatch(/satisfied dependencies/i);
      expect(result.planFacts.reason).toMatch(/phase-2-p2\.md/);
    }
  });

  it("selects no phase when a depends_on names a phase that does not exist", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "completed" },
      { n: 2, status: "pending", dependsOn: [9] },
    ]);
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
    expect(result.phasePath).toBeNull();
    expect(result.planFacts.kind).toBe("missing");
    if (result.planFacts.kind === "missing") {
      expect(result.planFacts.reason).toMatch(/satisfied dependencies/i);
    }
  });

  it("selects no phase when an incomplete phase has malformed depends_on metadata", () => {
    const root = repo();
    phased(root, [
      { n: 1, status: "completed" },
      { n: 2, status: "pending", dependsOn: [1] },
    ]);
    writeTree(root, {
      [`.context/${SUBJECT}/phase-3-p3.md`]: `---
status: pending
phase: 3
order: 3
depends_on: [two]
dependency_type: HARD
---
# Phase 3
`,
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
    expect(result.phasePath).toBeNull();
    expect(result.planFacts.kind).toBe("missing");
    if (result.planFacts.kind === "missing") {
      expect(result.planFacts.reason).toMatch(/malformed/i);
      expect(result.planFacts.reason).toMatch(/phase-3-p3\.md/);
    }
  });
  it.each(["[1", "1]", "[1,]"])(
    "selects no phase when depends_on is malformed: %s",
    (dependsOn) => {
      const root = repo();
      phased(root, [
        { n: 1, status: "completed" },
        { n: 2, status: "pending", dependsOn: [1] },
      ]);
      writeTree(root, {
        [`.context/${SUBJECT}/phase-3-p3.md`]: `---
status: pending
phase: 3
order: 3
depends_on: ${dependsOn}
dependency_type: HARD
---
# Phase 3
`,
      });

      const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
      expect(result.phasePath).toBeNull();
      expect(result.planFacts.kind).toBe("missing");
      if (result.planFacts.kind === "missing") {
        expect(result.planFacts.reason).toMatch(/malformed/i);
        expect(result.planFacts.reason).toMatch(/phase-3-p3\.md/);
      }
    },
  );
});

describe("scan: artifact facts", () => {
  it("sets iterateArtifact when iterate-*.md exists in the subject", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/iterate-demo.md`]: "---\nstatus: active\n---\n# iterate\n",
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
    const report = asReport(result.reviewFacts);
    expect(report.iterateArtifact).toBe(true);
  });
  
  it("ignores completed iterate artifacts and confirms the iterating postcondition", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/iterate-demo.md`]: "---\nstatus: completed\n---\n# iterate\n",
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd("No documentation impact", "No how-to impact"),
    });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "iterating",
      sessionOutcome: "ok",
    });
    const report = asReport(result.reviewFacts);
    expect(report.iterateArtifact).toBe(false);
    expect(result.workFacts.postcondition).toBe("confirmed");
  });

  it("parses a clean review report as parseable with both impact flags false", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd("No documentation impact", "No how-to impact"),
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}` });
    expect(result.reviewFacts).toEqual({
      kind: "report",
      parseable: true,
      iterateArtifact: false,
      docsImpact: false,
      howtoImpact: false,
    });
  });

  it("treats No additional documentation impact as no impact", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "No additional documentation impact",
        "No additional how-to impact",
      ),
    });
    expect(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts).toEqual({
      kind: "report",
      parseable: true,
      iterateArtifact: false,
      docsImpact: false,
      howtoImpact: false,
    });
  });

  it("treats explicit current-phase no-impact and named later-phase deferral as clean", () => {
    const root = repo();
    phased(root, [{ n: 2, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-2.md`]: reportMd(
        "No Phase 2 living-document impact; the implementation follows existing conventions.",
        "How-to coverage is deferred to Phase 5.",
      ),
    });
    expect(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts).toEqual({
      kind: "report",
      parseable: true,
      iterateArtifact: false,
      docsImpact: false,
      howtoImpact: false,
    });
  });

  it("keeps cross-domain named deferrals flagged", () => {
    const root = repo();
    phased(root, [{ n: 2, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-2.md`]: reportMd(
        "How-to coverage is deferred to Phase 5.",
        "Documentation work is deferred to Phase 5.",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.docsImpact).toBe(true);
    expect(report.howtoImpact).toBe(true);
  });

  it("compares review wording with the frozen cycle phase instead of the next pending phase", () => {
    const root = repo();
    phased(root, [
      { n: 2, status: "completed" },
      { n: 3, status: "pending" },
    ], {
      [`.context/${SUBJECT}/review-phase-2.md`]: reportMd(
        "No Phase 2 documentation impact",
        "How-to coverage is deferred to Phase 5.",
      ),
    });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}/phase-2-p2.md`,
      state: "reviewing",
    });
    const report = asReport(result.reviewFacts);
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-3-p3.md`);
    expect(report.docsImpact).toBe(false);
    expect(report.howtoImpact).toBe(false);
  });

  it("keeps a mismatched phase-qualified no-impact statement flagged", () => {
    const root = repo();
    phased(root, [{ n: 2, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-2.md`]: reportMd(
        "No Phase 5 documentation impact",
        "No how-to impact",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.docsImpact).toBe(true);
  });

  it.each([2, 1])(
    "keeps a deferral to Phase %i flagged while Phase 2 is active",
    (deferredPhase) => {
      const root = repo();
      phased(root, [{ n: 2, status: "pending" }], {
        [`.context/${SUBJECT}/review-phase-2.md`]: reportMd(
          "No documentation impact",
          `How-to coverage is deferred to Phase ${deferredPhase}.`,
        ),
      });
      const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
      expect(report.howtoImpact).toBe(true);
    },
  );

  it("fails closed on phase-qualified impact wording for an unphased plan", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-demo.md`]: planMd(),
      [`.context/${SUBJECT}/review-plan.md`]: reportMd(
        "No Phase 2 documentation impact",
        "How-to coverage is deferred to Phase 5.",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.docsImpact).toBe(true);
    expect(report.howtoImpact).toBe(true);
  });

  it("keeps affirmative and vague deferred impact wording flagged", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "Phase 1 changes the living-document contract.",
        "How-to coverage is deferred until later.",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.docsImpact).toBe(true);
    expect(report.howtoImpact).toBe(true);
  });

  it("keeps current required work flagged when the same line also names a deferred phase", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "CONTEXT.md must be updated now; supporting details are deferred to Phase 5.",
        "No how-to impact",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.docsImpact).toBe(true);
  });


  it("does not treat contradictory no-impact wording as clean", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "No documentation impact, but CONTEXT.md must be updated.",
        "How-to coverage is deferred to Phase 5, but it is required now.",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.docsImpact).toBe(true);
    expect(report.howtoImpact).toBe(true);
  });

  it("rejects an unrecognized clause after no-impact wording", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "No documentation impact. CONTEXT.md must be updated now.",
        "No how-to impact. A guide must be added now.",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.docsImpact).toBe(true);
    expect(report.howtoImpact).toBe(true);
  });

  it("parses H2 impact headings the same as H3", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: `# Review

## Documentation Impact
- No documentation impact

## How-to Impact
- No how-to impact
`,
    });
    expect(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts).toEqual({
      kind: "report",
      parseable: true,
      iterateArtifact: false,
      docsImpact: false,
      howtoImpact: false,
    });
  });

  it("parses H4 impact headings the same as H3", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: `# Review

#### Documentation Impact
- No documentation impact

#### How-to Impact
- No how-to impact
`,
    });
    expect(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts).toEqual({
      kind: "report",
      parseable: true,
      iterateArtifact: false,
      docsImpact: false,
      howtoImpact: false,
    });
  });


  it("does not pick another plan's unowned phases when multiple plans exist", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-alpha.md`]: planMd(),
      [`.context/${SUBJECT}/plan-beta.md`]: planMd(),
      [`.context/${SUBJECT}/phase-1-alpha.md`]: phaseMd(1, "pending"),
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-beta.md` });
    expect(result.planPath).toBe(`.context/${SUBJECT}/plan-beta.md`);
    expect(result.phasePath).toBeNull();
    expect(result.planFacts).toEqual({ kind: "unphased" });
  });

  it("picks phases owned by the named plan in a multi-plan subject", () => {
    const root = repo();
    writeTree(root, {
      [`.context/${SUBJECT}/plan-alpha.md`]: planMd(),
      [`.context/${SUBJECT}/plan-beta.md`]: planMd(),
      [`.context/${SUBJECT}/phase-1-beta.md`]: `---
status: pending
phase: 1
plan: plan-beta.md
depends_on: []
---
# Beta phase
`,
    });
    const result = scan({ projectRoot: root, path: `.context/${SUBJECT}/plan-beta.md` });
    expect(result.phasePath).toBe(`.context/${SUBJECT}/phase-1-beta.md`);
    expect(result.planFacts).toEqual({ kind: "phased-incomplete" });
  });


  it("sets docsImpact when Documentation Impact is flagged", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "convention: new loop vocabulary",
        "No how-to impact",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.parseable).toBe(true);
    expect(report.docsImpact).toBe(true);
    expect(report.howtoImpact).toBe(false);
  });

  it("sets howtoImpact when How-to Impact is flagged", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "No documentation impact",
        "new /buck-loop command needs a how-to",
      ),
    });
    const report = asReport(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts);
    expect(report.parseable).toBe(true);
    expect(report.docsImpact).toBe(false);
    expect(report.howtoImpact).toBe(true);
  });

  it("treats a report missing impact headings as unparseable with all flags false", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]:
        "## Plan Path Review: demo\n\nDocs should probably be updated.\n",
    });
    expect(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts).toEqual({
      kind: "report",
      parseable: false,
      iterateArtifact: false,
      docsImpact: false,
      howtoImpact: false,
    });
  });

  it("keeps iterateArtifact while forcing impact flags false on an unparseable report", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/iterate-demo.md`]: "# iterate\n",
      [`.context/${SUBJECT}/review-phase-1.md`]: "garbage\n",
    });
    expect(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts).toEqual({
      kind: "report",
      parseable: false,
      iterateArtifact: true,
      docsImpact: false,
      howtoImpact: false,
    });
  });

  it("leaves reviewFacts pending when there is no report and no iterate artifact", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    expect(scan({ projectRoot: root, path: `.context/${SUBJECT}` }).reviewFacts).toEqual({
      kind: "pending",
    });
  });

  it("marks building postcondition ambiguous when files changed and the phase is still pending", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    writeTree(root, { "src/app.ts": "export const x = 1;\n" });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "building",
      sessionOutcome: "ok",
    });
    expect(result.workFacts).toEqual({
      sessionOutcome: "ok",
      retriesUsed: 0,
      postcondition: "ambiguous",
    });
  });

  it("marks building postcondition confirmed when every phase is completed", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "completed" }]);
    writeTree(root, { "src/app.ts": "export const x = 1;\n" });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "building",
      sessionOutcome: "ok",
    });
    expect(result.planFacts).toEqual({ kind: "phased-complete" });
    expect(result.workFacts.postcondition).toBe("confirmed");
  });

  it("confirms a reviewing session postcondition regardless of git dirtiness", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd("No documentation impact", "No how-to impact"),
    });
    writeTree(root, { "src/app.ts": "export const x = 1;\n" });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "reviewing",
      sessionOutcome: "ok",
    });
    expect(result.workFacts.postcondition).toBe("confirmed");
    expect(result.workFacts.sessionOutcome).toBe("ok");
  });

  it("confirms documenting when corrected review facts expect no living-doc changes", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }], {
      [`.context/${SUBJECT}/review-phase-1.md`]: reportMd(
        "No Phase 1 living-document impact",
        "How-to coverage is deferred to Phase 5.",
      ),
    });
    writeTree(root, { "src/app.ts": "export const x = 1;\n" });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "documenting",
      sessionOutcome: "ok",
    });
    expect(result.workFacts.postcondition).toBe("confirmed");
  });

  it("leaves postcondition pending when the session has not finished", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "building",
      sessionOutcome: "pending",
    });
    expect(result.workFacts).toEqual({
      sessionOutcome: "pending",
      retriesUsed: 0,
      postcondition: "pending",
    });
  });

  it("confirms a committing session when the working tree is clean", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-qm", "fixture"]);
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "committing",
      sessionOutcome: "ok",
    });
    expect(result.workFacts.postcondition).toBe("confirmed");
  });
  
  it("does not confirm a commit when git status cannot be observed", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    rmSync(join(root, ".git"), { recursive: true, force: true });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "committing",
      sessionOutcome: "ok",
    });
    expect(result.workFacts.postcondition).toBe("ambiguous");
  });

  it("confirms iterating when the iterate artifact is gone", () => {
    const root = repo();
    phased(root, [{ n: 1, status: "pending" }]);
    writeTree(root, { "src/app.ts": "export const x = 1;\n" });
    const result = scan({
      projectRoot: root,
      path: `.context/${SUBJECT}`,
      state: "iterating",
      sessionOutcome: "ok",
    });
    expect(result.workFacts.postcondition).toBe("confirmed");
  });
});

describe("scan: contract", () => {
  it("does not import b-flow or xstate", () => {
    const src = readFileSync(new URL("../scan.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from ["'][^"']*b-flow/);
    expect(src).not.toMatch(/from ["']xstate["']/);
    expect(src).not.toMatch(/orchestration\.snapshot\.json/);
  });
});
