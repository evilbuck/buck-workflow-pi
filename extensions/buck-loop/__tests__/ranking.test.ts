import { describe, expect, it } from "vitest";
import { aboveWaterline, parseIterateArtifacts } from "../ranking.js";

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
