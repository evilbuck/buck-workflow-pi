import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { runJev } from "../jev-tool/index.js";
import { createTypeSafeEvaluator } from "../typed-output/evaluator.js";

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
  const duplicate = duplicateIssueId(issues);
  if (duplicate) return { kind: "blocked", reason: `duplicate issue id ${duplicate}` };
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
  let syntheticCounter = 0;
  
  for (const [heading, sectionEnd, severity] of sectionRanges(text)) {
    const section = text.slice(heading, sectionEnd);
    const headings = [...section.matchAll(/^###[ \t]+(\d+)\.[ \t]*(.*?)[ \t]*$/gm)];
    
    // If section has no parseable headings, emit a synthetic issue
    if (headings.length === 0 && section.trim().length > 0) {
      syntheticCounter++;
      issues.push({
        id: `${severity}:synthetic-${syntheticCounter}`,
        severity,
        title: "Unparseable finding",
        file: "",
        problem: section.trim().slice(0, 500),
        fix: "",
      });
      continue;
    }
    
    for (let i = 0; i < headings.length; i++) {
      const bodyStart = headings[i].index! + headings[i][0].length;
      const bodyEnd = headings[i + 1]?.index ?? section.length;
      const body = section.slice(bodyStart, bodyEnd);
      const title = headings[i][2].trim();
      if (!title) continue;
      
      const fileRaw = bullet(body, "File") ?? bullet(body, "Files");
      const file = extractFirstPath(fileRaw);
      const problemBullet = bullet(body, "Problem");
      
      // Use Problem bullet if present, otherwise check if body has meaningful text
      // (not just metadata bullets like File/Fix)
      const bodyWithoutMetadata = body
        .split("\n")
        .filter(line => !line.match(/^- \*\*(File|Files|Fix|Proposed fix|Suggested approach)[\*:]/i))
        .join("\n")
        .trim();
      
      // If there's a Problem bullet, use it
      // Else if body has non-metadata content, use that
      // Else if body is completely empty, use the title
      // Else (body has only metadata), skip
      const problem = problemBullet 
        ?? (bodyWithoutMetadata || null) 
        ?? (body.trim() === "" ? title : null);
      if (!problem) continue;
      
      const fix = bullet(body, severity === "critical" ? "Proposed fix" : "Suggested approach");
      
      issues.push({
        id: `${severity}:${Number(headings[i][1])}`,
        severity,
        title,
        file,
        problem,
        fix: fix ?? "",
      });
    }
  }
  return issues;
}

/** Extracts the first path-like token from a Files field, preferring backtick-wrapped paths. */
function extractFirstPath(filesField: string | null): string {
  if (!filesField) return "";
  // Find first backtick-wrapped token that looks like a path (contains / or .)
  const backtickMatch = filesField.match(/`([^`]+)`/);
  if (backtickMatch) {
    const path = backtickMatch[1].replace(/:\d+(-\d+)?$/, "");
    if (path.includes("/") || path.includes(".")) return path;
  }
  // Fallback: first token that looks like a path
  const cleaned = filesField.replace(/`/g, "");
  const firstToken = cleaned.split(/[,\s;]/)[0].trim();
  const path = firstToken.replace(/:\d+(-\d+)?$/, "");
  return (path.includes("/") || path.includes(".")) ? path : "";
}

function duplicateIssueId(issues: readonly ReviewIssue[]): ReviewIssue["id"] | undefined {
  const seen = new Set<ReviewIssue["id"]>();
  for (const issue of issues) {
    if (seen.has(issue.id)) return issue.id;
    seen.add(issue.id);
  }
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
  // Accept both **Label**: (colon outside bold) and **Label:** (colon inside bold)
  const match = body.match(new RegExp(`^- \\*\\*${label}(:\\*\\*|\\*\\*:) (.+)$`, "m"));
  return match?.[2]?.trim() || null;
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
  const cell = riskCell(rating);
  return cell !== null && cell >= 3;
}

function riskCell(rating: Partial<WaterlineRating>): number | null {
  const { impact, likelihood } = rating;
  if (!Number.isInteger(impact) || !Number.isInteger(likelihood) || impact! < 0 || impact! > 4 || likelihood! < 0 || likelihood! > 4) return null;
  let cell = IMPACT_LIKELIHOOD[impact!][likelihood!];
  if (likelihood! <= 1) cell = Math.min(cell, 2);
  if (rating.regression === "regression" && impact! >= 2 && cell >= 2) cell = Math.min(4, cell + 1);
  return cell;
}

export type RatingAnswers = {
  scope?: unknown;
  real?: unknown;
  impact?: unknown;
  likelihood?: unknown;
  regression?: unknown;
};

export type RankAttempt = { raw: string; details: unknown };
export type RankDependencies = {
  ask?: (state: unknown, questions: Record<string, { type: string; instructions: string; criteria?: Record<string, string> | string[] }>) => Promise<RankAttempt>;
  readFile?: (path: string) => string | null;
  writeFile?: (path: string, contents: string) => void;
  now?: () => Date;
};

export type RankedIssue = {
  id: ReviewIssue["id"];
  raw: string;
  answers: RatingAnswers;
  cell: string;
  above: boolean;
  jevFailure?: string;
};

export type RankResult =
  | { status: "ranked"; issues: RankedIssue[]; auditPath: string; artifactPath: string }
  | { status: "blocked"; reason: string };

const IMPACT_LABELS = ["negligible", "minor", "moderate", "major", "catastrophic"] as const;
const LIKELIHOOD_LABELS = ["rare", "unlikely", "possible", "likely", "almost_certain"] as const;
const CELL_LABELS = ["Note", "Low", "Medium", "High", "Critical"] as const;

/** Ranks parsed in-plan findings, records the judgment first, then narrows the iterate artifact. */
export async function rankIssues(options: {
  cwd: string;
  planPath: string;
  artifactPath: string;
  artifactText: string;
  issues: readonly ReviewIssue[];
}, deps: RankDependencies = {}): Promise<RankResult> {
  const parsed = parseIterateArtifacts([{ path: options.artifactPath, text: options.artifactText }]);
  if (parsed.kind !== "issues") return { status: "blocked", reason: parsed.reason };
  const duplicate = duplicateIssueId(options.issues);
  if (duplicate) return { status: "blocked", reason: `duplicate issue id ${duplicate}` };
  const read = deps.readFile ?? ((path: string) => {
    try {
      const root = resolve(options.cwd);
      const fullPath = resolve(root, path);
      const relativePath = relative(root, fullPath);
      if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) return null;
      const text = readFileSync(fullPath, "utf8");
      return Buffer.byteLength(text) <= 64 * 1024 ? text : null;
    } catch { return null; }
  });
  const ask = deps.ask ?? ((state, questions) => runJev(createTypeSafeEvaluator(), { state, questions }) as Promise<RankAttempt>);
  const write = deps.writeFile ?? ((path, contents) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, "utf8");
  });
  const ranked: RankedIssue[] = [];

  for (const issue of options.issues) {
    const fileText = issue.file ? read(issue.file) : null;
    let raw = "";
    let answers: RatingAnswers = {};
    let failure = fileText === null ? `Jev failed: missing, unreadable, or oversized file ${issue.file || "(File metadata absent)"}` : "";
    let firstFailure = "";
    if (fileText !== null) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await ask({
            title: issue.title, problem: issue.problem, file: issue.file, fix: issue.fix,
            planPath: options.planPath, currentFileText: fileText,
          }, ratingQuestions());
          raw = result.raw;
          answers = extractRatingAnswers(result.details);
          const missing = missingRequired(answers);
          if (!missing) { failure = ""; break; }
          failure = `Jev failed: missing or invalid ${missing} answer`;
        } catch (error) {
          failure = `Jev failed: ${error instanceof Error ? error.message : String(error)}`;
        }
        if (attempt === 0) firstFailure = failure;
        else failure = `First attempt: ${firstFailure}; retry: ${failure}`;
      }
    }
    const rating = toWaterlineRating(answers);
    const above = failure ? true : aboveWaterline(rating);
    ranked.push({
      id: issue.id,
      raw,
      answers,
      cell: rating ? CELL_LABELS[riskCell(rating)!] : (failure ? "Jev failure" : "Below waterline"),
      above,
      ...((failure || firstFailure) ? { jevFailure: failure || `First attempt: ${firstFailure}; retry succeeded` } : {}),
    });
  }

  const aboveIds = new Set(ranked.filter((item) => item.above).map((item) => item.id));
  const auditPath = resolve(options.cwd, dirname(options.artifactPath), `ranking-${(deps.now?.() ?? new Date()).toISOString().replace(/[:.]/g, "-")}.md`);
  const artifactPath = resolve(options.cwd, options.artifactPath);
  const audit = formatRankingAudit(ranked);
  const rewritten = rewriteIterate(options.artifactText, ranked.filter((issue) => aboveIds.has(issue.id)), aboveIds.size === 0);
  try {
    write(auditPath, audit);
  } catch (error) {
    return { status: "blocked", reason: `ranking audit write failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  try {
    write(artifactPath, rewritten);
  } catch (error) {
    return { status: "blocked", reason: `iterate artifact rewrite failed after audit ${auditPath}: ${error instanceof Error ? error.message : String(error)}` };
  }
  return { status: "ranked", issues: ranked, auditPath, artifactPath };
}

function ratingQuestions() {
  return {
    scope: { type: "choice", instructions: "Is this issue in scope for the accepted plan? Do not infer scope from severity.", criteria: { in_scope: "In scope for the accepted plan.", out_of_scope: "Outside the accepted plan." } },
    real: { type: "noul", instructions: "What is the probability this finding is a real in-code defect? Return calibrated probability." },
    impact: { type: "score", instructions: "Rate impact if the defect is real, from negligible to catastrophic.", criteria: [...IMPACT_LABELS] },
    likelihood: { type: "score", instructions: "Rate likelihood the defect triggers, from rare to almost certain.", criteria: [...LIKELIHOOD_LABELS] },
    regression: { type: "choice", instructions: "Is this a regression?", criteria: { regression: "Introduced by this change.", pre_existing: "Already existed.", unknown: "Cannot determine; treat as pre-existing." } },
  };
}

function extractRatingAnswers(details: unknown): RatingAnswers {
  if (!details || typeof details !== "object" || Array.isArray(details) || !("answers" in details)) return {};
  const answers = details.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  const answerSet = answers as Record<string, unknown>;
  return {
    scope: answerSet.scope,
    real: answerSet.real,
    impact: answerSet.impact,
    likelihood: answerSet.likelihood,
    regression: answerSet.regression,
  };
}

function missingRequired(answers: RatingAnswers): string | null {
  const scope = answers.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope) ||
      !("type" in scope) || scope.type !== "choice" || !("choice" in scope) ||
      (scope.choice !== "in_scope" && scope.choice !== "out_of_scope")) return "scope";
  const real = answers.real;
  if (!real || typeof real !== "object" || Array.isArray(real) ||
      !("type" in real) || real.type !== "noul" || !("noul" in real) ||
      typeof real.noul !== "number" || !Number.isFinite(real.noul)) return "real";
  if (scoreIndex(answers.impact, IMPACT_LABELS) === null) return "impact";
  if (scoreIndex(answers.likelihood, LIKELIHOOD_LABELS) === null) return "likelihood";
  return null;
}

function toWaterlineRating(answers: RatingAnswers): WaterlineRating | null {
  if (missingRequired(answers)) return null;
  const scopeAnswer = answers.scope as { choice: WaterlineRating["scope"] };
  const realAnswer = answers.real as { noul: number };
  const impact = scoreIndex(answers.impact, IMPACT_LABELS);
  const likelihood = scoreIndex(answers.likelihood, LIKELIHOOD_LABELS);
  const regression = answers.regression;
  const regressionAnswer = regression && typeof regression === "object" && !Array.isArray(regression) && "choice" in regression
    ? regression.choice
    : undefined;
  return {
    scope: scopeAnswer.choice,
    realProbability: realAnswer.noul,
    impact: impact!,
    likelihood: likelihood!,
    ...(regressionAnswer === "regression" || regressionAnswer === "pre_existing" || regressionAnswer === "unknown" ? { regression: regressionAnswer } : {}),
  };
}

function scoreIndex(answer: unknown, labels: readonly string[]): number | null {
  if (!answer || typeof answer !== "object" || Array.isArray(answer) ||
      !("type" in answer) || answer.type !== "score" || !("score" in answer)) return null;
  const score = answer.score;
  // Native score answers are weighted fractional ordinals. The operator
  // selected flooring valid scores before the discrete matrix lookup.
  if (typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= labels.length - 1) return Math.floor(score);
  if (typeof score === "string") {
    const index = labels.indexOf(score);
    return index < 0 ? null : index;
  }
  return null;
}



function formatRankingAudit(issues: readonly RankedIssue[]): string {
  return `# Review ranking audit\n\n${issues.map((issue) => [
    `## ${issue.id}`,
    `- Raw answer: ${JSON.stringify(issue.raw)}`,
    `- Answers: ${JSON.stringify(issue.answers)}`,
    `- Cell: ${issue.cell}`,
    `- Result: ${issue.above ? "above" : "below"} waterline`,
    ...(issue.jevFailure ? [`- Jev failure: ${issue.jevFailure}`] : []),
  ].join("\n")).join("\n\n")}\n`;
}

function rewriteIterate(text: string, issues: readonly RankedIssue[], below: boolean): string {
  let rewritten = text;
  const headings = [...text.matchAll(/^#{1,2}[ \t]+(.+?)[ \t]*$/gm)];
  for (let index = headings.length - 1; index >= 0; index--) {
    const heading = headings[index];
    if (heading[1] !== "Critical Issues" && heading[1] !== "Warnings") continue;
    const next = headings[index + 1];
    const end = next ? next.index! : text.length;
    const severity = heading[1] === "Critical Issues" ? "critical" : "warning";
    const keep = new Map(issues.map((issue) => [issue.id, issue]));
    rewritten = rewriteIssueSection(rewritten, text, heading, end, severity, keep);
  }
  return below ? rewritten.replace(/^status:\s*.+$/m, "status: below-waterline") : rewritten;
}

function rewriteIssueSection(
  rewritten: string,
  source: string,
  heading: RegExpMatchArray,
  end: number,
  severity: ReviewIssue["severity"],
  keep: ReadonlyMap<ReviewIssue["id"], RankedIssue>,
): string {
  const contentStart = heading.index! + heading[0].length + (source[heading.index! + heading[0].length] === "\r" ? 2 : 1);
  const body = source.slice(contentStart, end);
  const findings = [...body.matchAll(/^###[ \t]+(\d+)\.[ \t]*.*$/gm)];
  let filtered = body;
  for (let index = findings.length - 1; index >= 0; index--) {
    const finding = findings[index];
    const retained = keep.get(`${severity}:${Number(finding[1])}`);
    const start = finding.index!;
    const finish = findings[index + 1]?.index ?? body.length;
    if (retained) {
      if (retained.jevFailure) {
        const note = `\n- **Jev failure**: ${retained.jevFailure}. Re-review this finding with Jev.\n\n`;
        filtered = filtered.slice(0, finish) + note + filtered.slice(finish);
      }
    } else {
      filtered = filtered.slice(0, start) + filtered.slice(finish);
    }
  }
  return rewritten.slice(0, contentStart) + filtered + rewritten.slice(end);
}

