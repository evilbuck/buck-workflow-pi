#!/usr/bin/env bun
// skills/code-review/scripts/submit-review.ts
//
// Bulk PR review submission. Reads findings.json + summary.md from
// the worktree, POSTs one review with all inline comments via gh api.
// Zero deps. Requires bun, gh.
//
// Usage:
//   bun skills/code-review/scripts/submit-review.ts --worktree <path> [--event COMMENT|APPROVE|REQUEST_CHANGES|PENDING] [--dry-run]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------- domain types ----------

type ReviewSide = "LEFT" | "RIGHT";
type ReviewEvent = "COMMENT" | "APPROVE" | "REQUEST_CHANGES" | "PENDING";
type FindingSeverity = "critical" | "warning";

type Finding = {
  path: string;
  line: number;
  side?: ReviewSide;
  severity: FindingSeverity;
  body: string;
};

// What submit-review actually reads from pr-context.json. Narrower than
// what pr-context writes — the writer may add fields; the consumer stays stable.
type WorktreeContext = {
  pr: { number: number; url?: string; title?: string };
  owner: string;
  repo: string;
  head_sha: string;
  changed_files_detail: ReadonlyArray<{ path: string }>;
};

type CliArgs = { worktree: string; event: ReviewEvent; dryRun: boolean };

type ReviewResponse = {
  id: number;
  html_url: string;
  state: string;
  event: string;
  body: string | null;
};

type ValidationIssue = { index: number; message: string };

type ExecError = Error & {
  status?: number | null;
  stdout?: Buffer | string;
  stderr?: Buffer | string;
};

const REVIEW_EVENTS: readonly ReviewEvent[] = ["COMMENT", "APPROVE", "REQUEST_CHANGES", "PENDING"];

// ---------- small utilities ----------

function die(msg: string, code = 1): never {
  console.error(`submit-review: ${msg}`);
  process.exit(code);
}

function formatExecError(e: unknown): string {
  if (e instanceof Error) {
    const ee = e as ExecError;
    if (ee.stderr) {
      const s = typeof ee.stderr === "string" ? ee.stderr : ee.stderr.toString();
      const trimmed = s.trim();
      if (trimmed) return trimmed;
    }
    return e.message;
  }
  return String(e);
}

// ---------- type guards ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function hasStringProp(o: object, key: string): o is Record<string, string> {
  return typeof (o as Record<string, unknown>)[key] === "string";
}

function hasNumberProp(o: object, key: string): o is Record<string, number> {
  return typeof (o as Record<string, unknown>)[key] === "number";
}

function isReviewSide(v: unknown): v is ReviewSide {
  return v === "LEFT" || v === "RIGHT";
}

function isReviewEvent(v: unknown): v is ReviewEvent {
  return typeof v === "string" && (REVIEW_EVENTS as readonly string[]).includes(v);
}

function isFindingSeverity(v: unknown): v is FindingSeverity {
  return v === "critical" || v === "warning";
}

function isFinding(v: unknown): v is Finding {
  if (!isObject(v)) return false;
  if (!hasStringProp(v, "path")) return false;
  if (!hasNumberProp(v, "line")) return false;
  if (!hasStringProp(v, "body")) return false;
  if (!isFindingSeverity(v["severity"])) return false;
  if (v["side"] !== undefined && !isReviewSide(v["side"])) return false;
  return true;
}

function isFindingArray(v: unknown): v is Finding[] {
  return Array.isArray(v) && v.every(isFinding);
}

function isChangedFilePathEntry(v: unknown): v is { path: string } {
  return isObject(v) && hasStringProp(v, "path");
}

function isChangedFilePathArray(v: unknown): v is ReadonlyArray<{ path: string }> {
  return Array.isArray(v) && v.every(isChangedFilePathEntry);
}

function isPrNumberEntry(v: unknown): v is { number: number } {
  return isObject(v) && hasNumberProp(v, "number");
}

function isWorktreeContext(v: unknown): v is WorktreeContext {
  if (!isObject(v)) return false;
  if (!isPrNumberEntry(v["pr"])) return false;
  if (!hasStringProp(v, "owner")) return false;
  if (!hasStringProp(v, "repo")) return false;
  if (!hasStringProp(v, "head_sha")) return false;
  if (!isChangedFilePathArray(v["changed_files_detail"])) return false;
  return true;
}

function isReviewResponse(v: unknown): v is ReviewResponse {
  if (!isObject(v)) return false;
  if (!hasNumberProp(v, "id")) return false;
  if (!hasStringProp(v, "html_url")) return false;
  if (!hasStringProp(v, "state")) return false;
  const event = v["event"];
  // GitHub returns event:null for COMMENT reviews; accept null or string
  if (event !== null && typeof event !== "string") return false;
  const body = v["body"];
  if (body !== null && typeof body !== "string") return false;
  return true;
}

function parseJson<T>(raw: string, guard: (v: unknown) => v is T, label: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e: unknown) {
    die(`failed to parse ${label} JSON: ${formatExecError(e)}`);
  }
  if (!guard(parsed)) {
    die(`${label} JSON did not match expected shape`);
  }
  return parsed;
}

function readJsonFile<T>(path: string, guard: (v: unknown) => v is T, label: string): T {
  if (!existsSync(path)) die(`missing ${path} — write it before invoking submit-review`);
  return parseJson(readFileSync(path, "utf8"), guard, label);
}

// ---------- arg parsing ----------

function parseArgs(argv: readonly string[]): CliArgs {
  let worktree = "";
  let event: ReviewEvent = "COMMENT";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--worktree" || a === "-w") {
      const next = argv[++i];
      if (!next) die("--worktree requires a path argument");
      worktree = next;
    } else if (a === "--event" || a === "-e") {
      const next = argv[++i];
      if (!next || !isReviewEvent(next)) {
        die(`--event must be one of: ${REVIEW_EVENTS.join(", ")}`);
      }
      event = next;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      console.error(
        "usage: submit-review --worktree <path> [--event COMMENT|APPROVE|REQUEST_CHANGES|PENDING] [--dry-run]",
      );
      process.exit(0);
    } else {
      die(`unknown argument: ${a}`);
    }
  }

  if (!worktree) die("--worktree <path> is required");
  return { worktree: resolve(worktree), event, dryRun };
}

// ---------- validation ----------

function validateFindings(
  findings: readonly Finding[],
  context: WorktreeContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Runtime-membership lookup — built from the PR's changed files at validation time.
  const knownPaths = new Set(context.changed_files_detail.map((f) => f.path));

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    if (!f) continue;
    if (f.line < 1) issues.push({ index: i, message: `line must be >= 1 (got ${f.line})` });
    if (f.body.trim().length === 0) issues.push({ index: i, message: "body is empty" });
    if (!knownPaths.has(f.path)) {
      issues.push({ index: i, message: `path '${f.path}' is not in the PR's changed files` });
    }
  }
  return issues;
}

// ---------- main ----------

const args = parseArgs(process.argv.slice(2));

// 1. Load artifacts
const contextPath = join(args.worktree, "pr-context.json");
const findingsPath = join(args.worktree, "findings.json");
const summaryPath = join(args.worktree, "summary.md");

const context = readJsonFile(contextPath, isWorktreeContext, "pr-context.json");
const findings = readJsonFile(findingsPath, isFindingArray, "findings.json");
const summary = existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") : "";

// 2. Validate
const issues = validateFindings(findings, context);
if (issues.length > 0) {
  console.error("submit-review: validation issues:");
  for (const issue of issues) {
    const f = findings[issue.index];
    const where = f ? `${f.path}:${f.line}` : `finding[${issue.index}]`;
    console.error(`  - [${where}] ${issue.message}`);
  }
  if (!args.dryRun) {
    console.error("\nfix findings.json and retry, or pass --dry-run to skip the POST.");
    die("aborting due to validation issues", 1);
  }
  console.error("\n--dry-run set; continuing without validation block.");
}

// 3. Build the review body
const endpoint = `repos/${context.owner}/${context.repo}/pulls/${context.pr.number}/reviews`;
const body = {
  commit_id: context.head_sha,
  body: summary,
  event: args.event,
  comments: findings.map((f) => ({
    path: f.path,
    line: f.line,
    side: f.side ?? "RIGHT",
    body: f.body,
  })),
};
const bodyPath = join(args.worktree, ".review-body.json");
writeFileSync(bodyPath, JSON.stringify(body, null, 2));

// 4. Dry run: stop here
if (args.dryRun) {
  const out = {
    dry_run: true,
    endpoint,
    event: args.event,
    comments_planned: body.comments.length,
    summary_chars: summary.length,
    body_written_to: bodyPath,
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// 5. POST
let responseRaw: string;
try {
  responseRaw = execFileSync(
    "gh",
    ["api", endpoint, "--method", "POST", "--input", bodyPath],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
} catch (e: unknown) {
  die(`gh api POST ${endpoint} failed: ${formatExecError(e)} — request body preserved at ${bodyPath}`);
}
unlinkSync(bodyPath);

const review = parseJson(responseRaw, isReviewResponse, "gh api response");

const out = {
  review_id: review.id,
  review_url: review.html_url,
  state: review.state,
  event: review.event,
  comments_posted: body.comments.length,
  summary_chars: summary.length,
  pr_url:
    context.pr.url ?? `https://github.com/${context.owner}/${context.repo}/pull/${context.pr.number}`,
};
console.log(JSON.stringify(out, null, 2));
