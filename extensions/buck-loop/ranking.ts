import { readFileSync } from "node:fs";

export type ReviewIssue = {
  id: `critical:${number}` | `warning:${number}`;
  severity: "critical" | "warning";
  title: string;
  file: string;
  problem: string;
  fix: string;
};

export type RankInput =
  | { kind: "issues"; issues: ReviewIssue[] }
  | { kind: "scan-defect"; path: string; reason: string }
  | { kind: "blocked"; reason: string };

/** Parses precisely the issue-heading and bullet structure emitted by b-review. */
export function parseIterateArtifacts(artifacts: readonly { path: string; text: string }[]): RankInput {
  if (artifacts.length > 1) {
    return { kind: "blocked", reason: "multiple unfinished iterate artifacts" };
  }
  if (artifacts.length === 0) return { kind: "issues", issues: [] };

  const artifact = artifacts[0];
  const issues = parseIssues(artifact.text);
  if (issues.length === 0) {
    return { kind: "scan-defect", path: artifact.path, reason: "unfinished iterate artifact contains no parseable issues" };
  }
  return { kind: "issues", issues };
}

/** Reads the named source file, rejecting absent, unreadable, or oversized inputs. */
export function readIssueFile(root: string, relativePath: string, maxBytes = 64 * 1024): string | null {
  try {
    const text = readFileSync(`${root}/${relativePath}`, "utf8");
    return Buffer.byteLength(text) <= maxBytes ? text : null;
  } catch {
    return null;
  }
}

function parseIssues(text: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  for (const [heading, sectionEnd, severity] of sectionRanges(text)) {
    const section = text.slice(heading, sectionEnd);
    const headings = [...section.matchAll(/^###[ \t]+\d+\.[ \t]*(.*?)[ \t]*$/gm)];
    for (let i = 0; i < headings.length; i++) {
      const bodyStart = headings[i].index! + headings[i][0].length;
      const bodyEnd = headings[i + 1]?.index ?? section.length;
      const body = section.slice(bodyStart, bodyEnd);
      const title = headings[i][1].trim();
      const file = bullet(body, "File");
      const problem = bullet(body, "Problem");
      const fix = bullet(body, severity === "critical" ? "Proposed fix" : "Suggested approach");
      if (!title || !problem) continue;
      issues.push({
        id: `${severity}:${i + 1}`,
        severity,
        title,
        file: file?.replace(/^`|`$/g, "") ?? "",
        problem,
        fix: fix ?? "",
      });
    }
  }
  return issues;
}
function sectionRanges(text: string): Array<[number, number, "critical" | "warning"]> {
  const sections = [...text.matchAll(/^#{1,2}[ \t]+(.+?)[ \t]*$/gm)];
  const ranges: Array<[number, number, "critical" | "warning"]> = [];
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    if (section[1] !== "Critical Issues" && section[1] !== "Warnings") continue;
    ranges.push([
      section.index! + section[0].length,
      sections[index + 1]?.index ?? text.length,
      section[1] === "Critical Issues" ? "critical" : "warning",
    ]);
  }
  return ranges;
}

function bullet(body: string, label: string): string | null {
  const match = body.match(new RegExp(`^- \\*\\*${label}\\*\\*: (.+)$`, "m"));
  return match?.[1]?.trim() || null;
}

export type WaterlineRating = {
  scope: "in_scope" | "out_of_scope";
  realProbability: number;
  impact: number;
  likelihood: number;
  regression?: "regression" | "pre_existing" | "unknown";
};

const IMPACT_LIKELIHOOD: readonly (readonly number[])[] = [
  [0, 0, 1, 1, 1],
  [0, 1, 1, 2, 2],
  [1, 1, 2, 2, 3],
  [2, 2, 2, 3, 3],
  [2, 2, 3, 3, 4],
];

/** Applies the stored severity matrix and deterministic waterline without model calls. */
export function aboveWaterline(rating: Partial<WaterlineRating> | null | undefined): boolean {
  if (!rating || rating.scope !== "in_scope" || !Number.isFinite(rating.realProbability) || rating.realProbability! < 0.6) return false;
  const { impact, likelihood } = rating;
  if (!Number.isInteger(impact) || !Number.isInteger(likelihood) || impact! < 0 || impact! > 4 || likelihood! < 0 || likelihood! > 4) return false;
  let cell = IMPACT_LIKELIHOOD[impact!][likelihood!];
  if (likelihood! <= 1) cell = Math.min(cell, 2);
  if (rating.regression === "regression" && impact! >= 2 && cell >= 2) cell = Math.min(4, cell + 1);
  return cell >= 3;
}
