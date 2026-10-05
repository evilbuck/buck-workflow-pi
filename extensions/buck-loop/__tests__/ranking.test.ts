import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aboveWaterline, parseIterateArtifacts, rankIssues, type RankAttempt } from "../ranking.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function rankingFixture() {
  const cwd = mkdtempSync(join(tmpdir(), "buck-ranking-"));
  dirs.push(cwd);
  mkdirSync(join(cwd, "src"));
  writeFileSync(join(cwd, "src/a.ts"), "export const current = true;\n");
  const text = `---
status: active
---
# Iteration: demo
## Critical Issues
### 1. Critical defect
- **File**: src/a.ts
- **Problem**: Invalid transition admits unsafe progress.
- **Proposed fix**: Reject the transition.
## Warnings
### 1. Warning title
- **File**: src/a.ts
- **Problem**: Parsing may miss a finding.
- **Suggested approach**: Add parser coverage.
`;
  const parsed = parseIterateArtifacts([{ path: ".context/demo/iterate-review.md", text }]);
  if (parsed.kind !== "issues") throw new Error("fixture did not parse");
  return { cwd, text, artifactText: text, issues: parsed.issues, artifactPath: ".context/demo/iterate-review.md" };
}

function ratingAnswer(scope = "in_scope", impact = 4): RankAttempt {
  return {
    raw: "bounded answer",
    details: { answers: {
      scope: { type: "choice", choice: scope },
      real: { type: "noul", noul: 0.9 },
      impact: { type: "score", score: impact },
      likelihood: { type: "score", score: 4 },
      regression: { type: "choice", choice: "pre_existing" },
    } },
  };
}

const fixture = `---
status: active
---
# Iteration: demo
## Critical Issues
### 1. Critical defect
- **File**: extensions/buck-loop/machine.ts
- **Problem**: Invalid transition admits unsafe progress.
- **Proposed fix**: Reject the transition.
## Warnings
### 1. Warning title
- **File**: extensions/buck-loop/scan.ts
- **Problem**: Parsing may miss a finding.
- **Suggested approach**: Add parser coverage.
`;

describe("parseIterateArtifacts", () => {
  it("parses both b-review issue sections into stable section ordinals", () => {
    expect(parseIterateArtifacts([{ path: "iterate-demo.md", text: fixture }])).toEqual({
      kind: "issues",
      issues: [
        {
          id: "critical:1",
          severity: "critical",
          title: "Critical defect",
          file: "extensions/buck-loop/machine.ts",
          problem: "Invalid transition admits unsafe progress.",
          fix: "Reject the transition.",
        },
        {
          id: "warning:1",
          severity: "warning",
          title: "Warning title",
          file: "extensions/buck-loop/scan.ts",
          problem: "Parsing may miss a finding.",
          fix: "Add parser coverage.",
        },
      ],
    });
  });

  it("retains mixed findings with missing secondary fields and preserves heading ordinals", () => {
    const text = `## Critical Issues
### 1. Complete
- **File**: \`src/a.ts\`
- **Problem**: First defect.
- **Proposed fix**: Repair it.
### 2. No fix
- **File**: src/b.ts
- **Problem**: Second defect.
### 3. No file
- **Problem**: Third defect.
- **Proposed fix**: Repair the third.
### 4. No problem
- **File**: src/c.ts
### 5.
- **Problem**: No title.
### 6. Minimum finding
- **Problem**: Sixth defect.
`;
    expect(parseIterateArtifacts([{ path: "iterate-demo.md", text }])).toEqual({
      kind: "issues",
      issues: [
        { id: "critical:1", severity: "critical", title: "Complete", file: "src/a.ts", problem: "First defect.", fix: "Repair it." },
        { id: "critical:2", severity: "critical", title: "No fix", file: "src/b.ts", problem: "Second defect.", fix: "" },
        { id: "critical:3", severity: "critical", title: "No file", file: "", problem: "Third defect.", fix: "Repair the third." },
        { id: "critical:6", severity: "critical", title: "Minimum finding", file: "", problem: "Sixth defect.", fix: "" },
      ],
    });
  });

  it.each(["Critical Issues", "Warnings"])("admits a title and Problem alone in %s", (section) => {
    const severity = section === "Critical Issues" ? "critical" : "warning";
    expect(parseIterateArtifacts([{ path: "iterate-demo.md", text: `## ${section}\n### 1. Defect\n- **Problem**: Broken behavior.\n` }])).toEqual({
      kind: "issues",
      issues: [{ id: `${severity}:1`, severity, title: "Defect", file: "", problem: "Broken behavior.", fix: "" }],
    });
  });

  it.each(["### 1.\n- **Problem**: Defect.", "### 1. Title\n", "### 1. Title\n- **Problem**:   "])(
    "rejects a finding missing a title or non-empty Problem: %s",
    (body) => {
      expect(parseIterateArtifacts([{ path: "iterate-demo.md", text: `## Critical Issues\n${body}\n` }]).kind).toBe("scan-defect");
    },
  );

  it.each(["## Recommended Workflow", "# Next steps"])("ends issue sections at %s", (heading) => {
    const text = `${fixture}${heading}
### 1. Not a finding
- **File**: src/workflow.ts
- **Problem**: Workflow prose.
- **Suggested approach**: Not a fix.
- **Proposed fix**: Not a fix.
`;
    expect(parseIterateArtifacts([{ path: "iterate-demo.md", text }])).toEqual(
      parseIterateArtifacts([{ path: "iterate-demo.md", text: fixture }]),
    );
  });

  it("distinguishes zero issues from multiple unfinished files", () => {
    expect(parseIterateArtifacts([{ path: "iterate-empty.md", text: "## Critical Issues\n" }]).kind).toBe("scan-defect");
    expect(parseIterateArtifacts([
      { path: "iterate-a.md", text: fixture },
      { path: "iterate-b.md", text: fixture },
    ])).toEqual({ kind: "blocked", reason: "multiple unfinished iterate artifacts" });
  });
});

describe("aboveWaterline", () => {
  const rating = { scope: "in_scope" as const, realProbability: 0.6 };

  // Explicit routing outcomes from the accepted plan, indexed by impact then likelihood.
  const ordinary = [
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, true],
    [false, false, false, true, true],
    [false, false, true, true, true],
  ];
  const regressed = [
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, true, true, true],
    [true, true, true, true, true],
    [true, true, true, true, true],
  ];

  for (const regression of ["regression", "pre_existing", "unknown", undefined] as const) {
    describe(`regression=${regression}`, () => {
      for (let impact = 0; impact < 5; impact++) {
        for (let likelihood = 0; likelihood < 5; likelihood++) {
          it(`routes impact=${impact}, likelihood=${likelihood} at the contracted waterline`, () => {
            const input = { ...rating, impact, likelihood, regression };
            expect(aboveWaterline(input)).toBe((regression === "regression" ? regressed : ordinary)[impact][likelihood]);
            expect(aboveWaterline({ ...input, scope: "out_of_scope" })).toBe(false);
            expect(aboveWaterline({ ...input, realProbability: 0.599 })).toBe(false);
          });
        }
      }
    });
  }

  it.each(["scope", "realProbability", "impact", "likelihood"] as const)("rejects missing %s even for a regression", (field) => {
    const input = { ...rating, impact: 4, likelihood: 4, regression: "regression" as const };
    expect(aboveWaterline({ ...input, [field]: undefined })).toBe(false);
  });

  it.each([null, undefined])("rejects an absent rating: %s", (input) => {
    expect(aboveWaterline(input)).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite confidence: %s", (realProbability) => {
    expect(aboveWaterline({ ...rating, impact: 4, likelihood: 4, realProbability })).toBe(false);
  });

  it.each(["impact", "likelihood"] as const)("rejects invalid %s answers", (field) => {
    for (const value of [NaN, Infinity, -Infinity, -1, 5, 2.5]) {
      expect(aboveWaterline({ ...rating, impact: 4, likelihood: 4, [field]: value })).toBe(false);
    }
  });
});

describe("rankIssues", () => {
  it("asks five named questions per issue with only issue context, audits first, and rewrites to above-waterline ids", async () => {
    const fixture = rankingFixture();
    const writes: Array<{ path: string; contents: string }> = [];
    const ask = vi.fn(async (state: unknown, questions: Record<string, unknown>) => {
      expect(state).toMatchObject({
        title: expect.any(String),
        problem: expect.any(String),
        file: "src/a.ts",
        fix: expect.any(String),
        planPath: ".context/demo/plan.md",
        currentFileText: "export const current = true;\n",
      });
      expect(Object.keys(questions)).toEqual(["scope", "real", "impact", "likelihood", "regression"]);
      const title = state && typeof state === "object" && "title" in state ? state.title : "";
      return ratingAnswer("in_scope", title === "Critical defect" ? 4 : 0);
    });
    const result = await rankIssues({
      ...fixture, planPath: ".context/demo/plan.md",
    }, {
      ask,
      now: () => new Date("2026-10-03T12:00:00.000Z"),
      writeFile: (path, contents) => { writes.push({ path, contents }); },
    });
    expect(result.status).toBe("ranked");
    expect(ask).toHaveBeenCalledTimes(2);
    expect(writes[0].path).toContain("ranking-2026-10-03T12-00-00-000Z.md");
    expect(writes[0].contents).toContain("critical:1");
    expect(writes[0].contents).toContain("Result: above waterline");
    expect(writes[1].contents).toContain("Critical defect");
    expect(writes[1].contents).not.toContain("Warning title");
  });

  it("blocks a scan-defect artifact before judgment or rewriting", async () => {
    const fixture = rankingFixture();
    const ask = vi.fn();
    const writeFile = vi.fn();
    const result = await rankIssues({ ...fixture, planPath: "plan.md", artifactText: "---\nstatus: active\n---\n## Critical Issues\n", issues: [] }, { ask, writeFile });
    expect(result).toMatchObject({ status: "blocked", reason: expect.stringContaining("no parseable issues") });
    expect(ask).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("floors native fractional scores without retrying or escalating a below-waterline finding", async () => {
    const fixture = rankingFixture();
    const ask = vi.fn().mockResolvedValue({ raw: "native fractional answer", details: { answers: {
      scope: { type: "choice", choice: "in_scope" },
      real: { type: "noul", noul: 0.96 },
      impact: { type: "score", score: 1.92 },
      likelihood: { type: "score", score: 2.97 },
      regression: { type: "choice", choice: "pre_existing" },
    } } });
    const result = await rankIssues({ ...fixture, planPath: "plan.md", issues: fixture.issues.slice(0, 1) }, { ask });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ranked", issues: [{ above: false, cell: "Low" }] });
    if (result.status !== "ranked") throw new Error(result.reason);
    expect(result.issues[0].jevFailure).toBeUndefined();
    expect(readFileSync(result.artifactPath, "utf8")).toContain("status: below-waterline");
  });

  it("retries a missing required answer once, then fails open for routing with a Jev note", async () => {
    const fixture = rankingFixture();
    const missing = { raw: "partial", details: { answers: { scope: { type: "choice", choice: "in_scope" } } } };
    const ask = vi.fn().mockResolvedValueOnce(missing).mockRejectedValueOnce(new Error("retry exploded"));
    const writes: string[] = [];
    const result = await rankIssues({
      ...fixture, planPath: ".context/demo/plan.md",
      issues: fixture.issues.slice(0, 1),
    }, { ask, writeFile: (_path, text) => writes.push(text) });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "ranked", issues: [{ above: true, jevFailure: expect.stringContaining("First attempt: Jev failed: missing or invalid real") }] });
    expect(writes[0]).toContain("Jev failure");
    expect(writes[0]).toContain("Result: above waterline");
    expect(writes[1]).toContain("First attempt: Jev failed: missing or invalid real");
    expect(writes[1]).toContain("Re-review this finding with Jev");
  });

  it("does not retry when only regression is missing or bump a Medium cell", async () => {
    const fixture = rankingFixture();
    const answer = ratingAnswer("in_scope", 2);
    if (typeof answer.details === "object" && answer.details !== null && "answers" in answer.details) {
      const answers = answer.details.answers as Record<string, unknown>;
      answers.likelihood = { type: "score", score: 2 };
      delete answers.regression;
    }
    const ask = vi.fn().mockResolvedValue(answer);
    const writes: string[] = [];
    const result = await rankIssues({
      ...fixture, planPath: ".context/demo/plan.md", issues: fixture.issues.slice(0, 1),
    }, { ask, writeFile: (_path, text) => writes.push(text) });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ranked", issues: [{ above: false, cell: "Medium" }] });
    expect(writes[1]).toContain("status: below-waterline");
    expect(writes[1]).not.toContain("completed:");
  });

  it("blocks without rewriting the artifact when the audit write fails", async () => {
    const fixture = rankingFixture();
    const writeFile = vi.fn(() => { throw new Error("disk full"); });
    const result = await rankIssues({
      ...fixture, planPath: ".context/demo/plan.md", issues: fixture.issues.slice(0, 1),
    }, { ask: async () => ratingAnswer(), writeFile });
    expect(result).toMatchObject({ status: "blocked", reason: expect.stringContaining("disk full") });
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("retries a thrown judge error and never invokes a chat/model fallback", async () => {
    const fixture = rankingFixture();
    const ask = vi.fn().mockRejectedValueOnce(new Error("judge unavailable")).mockResolvedValueOnce(ratingAnswer());
    const writes: string[] = [];
    const result = await rankIssues({
      ...fixture, planPath: ".context/demo/plan.md", issues: fixture.issues.slice(0, 1),
    }, { ask, writeFile: (_path, text) => writes.push(text) });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "ranked", issues: [{ above: true }] });
    expect(result).toMatchObject({ issues: [{ jevFailure: expect.stringContaining("judge unavailable") }] });
    expect(writes[0]).toContain("retry succeeded");
    expect(writes[1]).toContain("Re-review this finding with Jev");
  });

  it("preserves section ordinals when filtering findings", async () => {
    const fixture = rankingFixture();
    const artifactText = fixture.text.replace("### 1. Critical defect", "### 2. Critical defect");
    const issue = { ...fixture.issues[0], id: "critical:2" as const };
    const writes: string[] = [];
    await rankIssues({
      ...fixture, artifactText, planPath: ".context/demo/plan.md", issues: [issue],
    }, { ask: async () => ratingAnswer(), writeFile: (_path, text) => writes.push(text) });
    expect(writes[1]).toContain("### 2. Critical defect");
    expect(parseIterateArtifacts([{ path: fixture.artifactPath, text: writes[1] }])).toMatchObject({
      kind: "issues", issues: [{ id: "critical:2" }],
    });
  });

  it("treats an unavailable named file as a Jev failure and keeps the issue above-waterline", async () => {
    const fixture = rankingFixture();
    const ask = vi.fn();
    const writes: string[] = [];
    const result = await rankIssues({
      ...fixture, planPath: ".context/demo/plan.md",
      issues: [{ ...fixture.issues[0], file: "src/missing.ts" }],
    }, { ask, writeFile: (_path, text) => writes.push(text) });
    expect(ask).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "ranked", issues: [{ above: true, jevFailure: expect.stringContaining("src/missing.ts") }] });
    expect(writes[0]).toContain("Jev failure");
  });

  it("rejects an oversized named file before passing context to Jev", async () => {
    const fixture = rankingFixture();
    writeFileSync(join(fixture.cwd, "src/large.ts"), "x".repeat(64 * 1024 + 1));
    const ask = vi.fn();
    const writes: string[] = [];
    const result = await rankIssues({
      ...fixture, planPath: ".context/demo/plan.md",
      issues: [{ ...fixture.issues[0], file: "src/large.ts" }],
    }, { ask, writeFile: (_path, text) => writes.push(text) });
    expect(ask).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "ranked", issues: [{ above: true, jevFailure: expect.stringContaining("oversized") }] });
    expect(writes[0]).toContain("Jev failure");
  });

  it("keeps a finding without File metadata active with failure evidence", async () => {
    const fixture = rankingFixture();
    const artifactText = fixture.text.replaceAll("- **File**: src/a.ts\n", "");
    const parsed = parseIterateArtifacts([{ path: fixture.artifactPath, text: artifactText }]);
    if (parsed.kind !== "issues") throw new Error("missing-file finding did not parse");
    const ask = vi.fn();
    const result = await rankIssues({
      ...fixture, artifactText, issues: parsed.issues, planPath: ".context/demo/plan.md",
    }, { ask });
    expect(ask).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "ranked",
      issues: [
        { id: "critical:1", above: true, jevFailure: expect.stringContaining("File metadata absent") },
        { id: "warning:1", above: true, jevFailure: expect.stringContaining("File metadata absent") },
      ],
    });
    if (result.status !== "ranked") throw new Error(result.reason);
    expect(readFileSync(result.auditPath, "utf8")).toContain("File metadata absent");
    const rewritten = readFileSync(result.artifactPath, "utf8");
    expect(rewritten).toContain("status: active");
    expect(rewritten).toContain("Re-review this finding with Jev");
    expect(parseIterateArtifacts([{ path: fixture.artifactPath, text: rewritten }])).toMatchObject({
      kind: "issues", issues: [{ id: "critical:1" }, { id: "warning:1" }],
    });
  });

  it("preserves a padded heading's canonical id while filtering below-waterline findings", async () => {
    const fixture = rankingFixture();
    const artifactText = fixture.text.replace("### 1. Critical", "### 01. Critical");
    const parsed = parseIterateArtifacts([{ path: fixture.artifactPath, text: artifactText }]);
    if (parsed.kind !== "issues") throw new Error("padded finding did not parse");
    const ask = vi.fn().mockResolvedValueOnce(ratingAnswer()).mockResolvedValueOnce(ratingAnswer("in_scope", 0));
    const result = await rankIssues({
      ...fixture, artifactText, issues: parsed.issues, planPath: ".context/demo/plan.md",
    }, { ask });
    if (result.status !== "ranked") throw new Error(result.reason);
    expect(parseIterateArtifacts([{ path: fixture.artifactPath, text: readFileSync(result.artifactPath, "utf8") }])).toEqual({
      kind: "issues", issues: [parsed.issues[0]],
    });
  });

  it.each(["1", "01"])("blocks ambiguous duplicate heading %s before judgment or writes", async (ordinal) => {
    const fixture = rankingFixture();
    const artifactText = fixture.text.replace("## Warnings\n### 1.", `### ${ordinal}.`);
    expect(parseIterateArtifacts([{ path: fixture.artifactPath, text: artifactText }])).toEqual({
      kind: "blocked", reason: "duplicate issue id critical:1",
    });
    const ask = vi.fn();
    const writeFile = vi.fn();
    expect(await rankIssues({
      ...fixture, artifactText, planPath: ".context/demo/plan.md",
    }, { ask, writeFile })).toEqual({ status: "blocked", reason: "duplicate issue id critical:1" });
    expect(ask).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("isolates a missing required answer and retains recovered failure history without bumping routing", async () => {
    const fixture = rankingFixture();
    const ask = vi.fn(async (_state: unknown): Promise<RankAttempt> => ratingAnswer())
      .mockResolvedValueOnce(ratingAnswer())
      .mockResolvedValueOnce({ raw: "partial", details: { answers: {} } })
      .mockResolvedValueOnce(ratingAnswer("in_scope", 0));
    const result = await rankIssues({ ...fixture, planPath: ".context/demo/plan.md" }, { ask });
    expect(ask.mock.calls.map(([state]) => (
      state && typeof state === "object" && "title" in state ? state.title : undefined
    ))).toEqual(["Critical defect", "Warning title", "Warning title"]);
    expect(result).toMatchObject({
      status: "ranked", issues: [
        { id: "critical:1", above: true },
        { id: "warning:1", above: false, raw: "bounded answer", jevFailure: expect.stringContaining("retry succeeded") },
      ],
    });
    if (result.status !== "ranked") throw new Error(result.reason);
    expect(readFileSync(result.auditPath, "utf8")).toContain("First attempt: Jev failed: missing or invalid scope");
    expect(parseIterateArtifacts([{ path: fixture.artifactPath, text: readFileSync(result.artifactPath, "utf8") }])).toEqual({
      kind: "issues", issues: [fixture.issues[0]],
    });
  });
});
