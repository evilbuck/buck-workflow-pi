import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { listOpenIssues, findExistingDraftPr, GhIssue } from "./auto-fix/lib/gh.ts";

// ── Types ──────────────────────────────────────────────
export interface AutoFixConfig {
  assignee: string;
  base: string;
  dry_run: boolean;
  max_issues: number;
  labels_skip: string[];
  hard_fails: string[];
  branch_prefix: string;
  worktree_dir: string;
}

export interface RunState {
  run_id: string;
  started_at: string;
  repo: string;
  config: AutoFixConfig;
  issues: unknown[];
  results: unknown[];
}

// ── Defaults ───────────────────────────────────────────
const DEFAULT_CONFIG: AutoFixConfig = {
  assignee: "@me",
  base: "",
  dry_run: false,
  max_issues: 10,
  labels_skip: ["in-progress", "do-not-auto-fix", "human-only"],
  hard_fails: [
    "gh_unreachable",
    "git_push_failed",
    "tests_failed_after_build",
    "review_blocked",
  ],
  branch_prefix: "auto-fix/issue-",
  worktree_dir: "..",
};

// ── Help text ──────────────────────────────────────────
const HELP = `b-auto-fix — auto-fix assigned GitHub issues

Usage: bun run <path-to-buck-workflow>/skills/b-auto-fix/scripts/auto-fix.ts -- [flags]

Flags:
  --repo <owner/repo>       GitHub repository (required)
  --assignee <user>         GitHub username or @me (default: @me)
  --base <branch>           Base branch (default: auto-detect main/master/dev)
  --dry-run                 Preview mode — skip push, PR, comment
  --list, --list-only       List issues that would be processed, then exit (no side effects)
  --format <human|json>     Output format for --list (default: human)
  --config <path>           Config file path (default: auto-fix.config.json)
  --max-issues <n>          Safety cap per run (default: 10)
  --yes                     Skip first-run safety prompt
  --help                    Show this help

Config:
  Merged from: auto-fix.config.json → auto-fix.config.local.json → CLI flags
  CLI flags take precedence.`;

// ── Parsing ────────────────────────────────────────────
function parseFlags(args: string[]): Partial<AutoFixConfig> & { repo?: string; config?: string; yes?: boolean; help?: boolean; list?: boolean; format?: "human" | "json" } {
  const overrides: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    switch (key) {
      case "help":
        overrides.help = true;
        break;
      case "yes":
        overrides.yes = true;
        break;
      case "list":
      case "list-only":
        overrides.list = true;
        break;
      case "format": {
        const val = args[i + 1];
        if (val && !val.startsWith("--")) {
          i++;
          if (val === "human" || val === "json") {
            overrides.format = val;
          } else {
            throw new Error(`Invalid --format value: ${val} (expected "human" or "json")`);
          }
        }
        break;
      }
      case "dry-run":
        overrides.dry_run = true;
        break;
      case "repo":
      case "assignee":
      case "base":
      case "config":
      case "max-issues": {
        const val = args[i + 1];
        if (val && !val.startsWith("--")) {
          i++;
          if (key === "max-issues") {
            const n = parseInt(val, 10);
            if (!isNaN(n) && n > 0) overrides.max_issues = n;
          } else if (key === "repo" || key === "config") {
            overrides[key === "config" ? "config" : "repo"] = val;
          } else {
            overrides[key] = val;
          }
        }
        break;
      }
    }
  }
  return overrides as Partial<AutoFixConfig> & { repo?: string; config?: string; yes?: boolean; help?: boolean; list?: boolean; format?: "human" | "json" };
 }
// ── Config loading ─────────────────────────────────────
function loadConfig(configPath?: string): AutoFixConfig {
  const path = configPath ?? "auto-fix.config.json";
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };

  const raw = readFileSync(path, "utf-8");
  let fileConfig: Partial<AutoFixConfig>;
  try {
    fileConfig = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${path}`);
  }

  return { ...DEFAULT_CONFIG, ...fileConfig };
}

function loadLocalConfig(base: AutoFixConfig): AutoFixConfig {
  const localPath = "auto-fix.config.local.json";
  if (!existsSync(localPath)) return base;

  const raw = readFileSync(localPath, "utf-8");
  let localConfig: Partial<AutoFixConfig>;
  try {
    localConfig = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in local config: ${localPath}`);
  }

  return { ...base, ...localConfig };
}

// ── Run state ──────────────────────────────────────────
function generateRunId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rand = randomBytes(4).toString("hex");
  return `${ts}-${rand}`;
}

function createRunStateDir(): string {
  const dir = resolve(".context/auto-fix");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function initRunState(
  repo: string,
  config: AutoFixConfig,
  extra: Partial<RunState> = {}
): { runId: string; runDir: string } {
  const runId = generateRunId();
  const baseDir = createRunStateDir();
  const runDir = resolve(baseDir, runId);
  mkdirSync(runDir, { recursive: true });

  const state: RunState = {
    run_id: runId,
    started_at: new Date().toISOString(),
    repo,
    config,
    issues: [],
    results: [],
    ...extra,
  };

  writeFileSync(join(runDir, "run.json"), JSON.stringify(state, null, 2), "utf-8");
  return { runId, runDir };
}

// ── Predicates ─────────────────────────────────────────
export function shouldSkipByLabel(
  labels: string[],
  labelsSkip: string[]
): boolean {
  return labels.some((l) => labelsSkip.includes(l));
}

export function isHardFail(
  failureMode: string,
  hardFails: string[]
): boolean {
  return hardFails.includes(failureMode);
}

// ── List mode (filter + format) ────────────────────────
export interface SkippedIssue {
  issue: GhIssue;
  reason: string;
}

export interface IssueFilterResult {
  to_process: GhIssue[];
  skipped: SkippedIssue[];
}

export async function filterIssuesForList(opts: {
  assignee: string;
  repo: string;
  limit: number;
  labels_skip: string[];
  branch_prefix: string;
}): Promise<IssueFilterResult> {
  const raw = await listOpenIssues({
    assignee: opts.assignee,
    repo: opts.repo,
    limit: opts.limit,
  });
  const result: IssueFilterResult = { to_process: [], skipped: [] };
  for (const issue of raw) {
    const labelNames = issue.labels.map((l) => l.name);
    const skipLabel = labelNames.find((l) => opts.labels_skip.includes(l));
    if (skipLabel) {
      result.skipped.push({ issue, reason: `label:${skipLabel}` });
      continue;
    }
    const branch = `${opts.branch_prefix}${issue.number}`;
    const existing = await findExistingDraftPr(branch, opts.repo);
    if (existing) {
      result.skipped.push({
        issue,
        reason: `existing-draft-pr:#${existing.number}`,
      });
      continue;
    }
    result.to_process.push(issue);
  }
  return result;
}

export function formatIssueList(
  result: IssueFilterResult,
  format: "human" | "json" = "human",
): string {
  if (format === "json") {
    return JSON.stringify(
      {
        to_process: result.to_process.map((i) => ({
          number: i.number,
          title: i.title,
          labels: i.labels.map((l) => l.name),
          body: i.body,
        })),
        skipped: result.skipped.map((s) => ({
          number: s.issue.number,
          title: s.issue.title,
          labels: s.issue.labels.map((l) => l.name),
          reason: s.reason,
        })),
      },
      null,
      2,
    );
  }

  const lines: string[] = [];
  if (result.to_process.length === 0) {
    lines.push("No issues to process.");
  } else {
    lines.push(
      `${result.to_process.length} issue(s) that would be auto-fixed:`,
    );
    lines.push("");
    for (const issue of result.to_process) {
      const labels = issue.labels.map((l) => l.name).join(", ");
      lines.push(`  #${issue.number}  ${issue.title}`);
      if (labels) lines.push(`      Labels: ${labels}`);
      const bodyFirstLine = issue.body.split("\n")[0]?.trim();
      if (bodyFirstLine) lines.push(`      Body: ${bodyFirstLine}`);
      lines.push("");
    }
  }

  if (result.skipped.length > 0) {
    lines.push(`Skipped ${result.skipped.length} issue(s):`);
    for (const s of result.skipped) {
      lines.push(`  #${s.issue.number}  ${s.issue.title}  (${s.reason})`);
    }
  }
  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────
export async function main(args: string[] = Bun.argv): Promise<RunState> {
  const flags = parseFlags(args);

  if (flags.help) {
    console.log(HELP);
    // biome-ignore lint/suspicious/noProcess: CLI entry
    process.exit(0);
  }

  const repo = flags.repo;
  if (!repo) {
    console.error("Error: --repo <owner/repo> is required.");
    // biome-ignore lint/suspicious/noProcess: CLI entry
    process.exit(1);
  }

  const configPath = flags.config;
  const baseConfig = loadConfig(configPath);
  const mergedConfig = loadLocalConfig(baseConfig);
  const cliOverrides: Partial<AutoFixConfig> = {};
  if (flags.assignee) cliOverrides.assignee = flags.assignee;
  if (flags.base) cliOverrides.base = flags.base;
  if (flags.dry_run !== undefined) cliOverrides.dry_run = flags.dry_run;
  if (flags.max_issues !== undefined) cliOverrides.max_issues = flags.max_issues;
  const finalConfig = { ...mergedConfig, ...cliOverrides };

  // First-run safety prompt (Phase 8)
  if (!finalConfig.dry_run && !flags.yes && !flags.list) {
    const priorRuns = existsSync(resolve(".context/auto-fix"));
    if (!priorRuns) {
      console.log(
        "First run on this repo — use --dry-run to preview? [Y/n]",
      );
      console.log("Defaulting to dry-run for safety. Use --yes to skip this prompt.");
      cliOverrides.dry_run = true;
      // Re-merge
      Object.assign(finalConfig, cliOverrides);
    }
  }

  // ── List-only mode (observation only, no disk side effects) ─
  if (flags.list) {
    const filterResult = await filterIssuesForList({
      assignee: finalConfig.assignee,
      repo,
      limit: finalConfig.max_issues,
      labels_skip: finalConfig.labels_skip,
      branch_prefix: finalConfig.branch_prefix,
    });
    console.log(formatIssueList(filterResult, flags.format ?? "human"));
    return {
      run_id: "list-only",
      started_at: new Date().toISOString(),
      repo,
      config: finalConfig,
      issues: filterResult.to_process,
      results: [],
    };
  }

  const { runId, runDir } = initRunState(repo, finalConfig);
  console.log(`Run state: ${runDir}/run.json`);

  // ── Fetch and filter issues ──────────────────────────
  const issues: unknown[] = [];
  try {
    const rawIssues = await listOpenIssues({
      assignee: finalConfig.assignee,
      repo,
      limit: finalConfig.max_issues,
    });

    let filtered = rawIssues.filter(
      (i) => !shouldSkipByLabel(i.labels.map((l) => l.name), finalConfig.labels_skip),
    );

    // Exclude issues with existing draft PRs
    const prChecks: Promise<{ issue: typeof rawIssues[0]; excluded: boolean }>[] =
      filtered.map(async (issue) => {
        const branch = `${finalConfig.branch_prefix}${issue.number}`;
        const existing = await findExistingDraftPr(branch, repo);
        return { issue, excluded: existing !== null };
      });
    const prResults = await Promise.all(prChecks);
    filtered = prResults.filter((r) => !r.excluded).map((r) => r.issue);

    console.log(
      `Found ${rawIssues.length} issues, ${filtered.length} passed filter. Processing ${filtered.length} issues.`,
    );

    for (const issue of filtered) issues.push(issue);
  } catch (err) {
    const msg = `Warning: could not fetch issues: ${err}`;
    console.error(msg);
  }

  // ── Per-issue pipeline setup ─────────────────────────
  const results: Array<{
    issue: number;
    stage: string;
    status: "pending" | "running" | "completed" | "failed";
    artifact?: string;
  }> = [];

  for (const issue of issues) {
    const issueDir = join(runDir, `issue-${(issue as { number: number }).number}`);
    mkdirSync(issueDir, { recursive: true });

    // Write stage prompt files for the operator/agent
    const issueData = JSON.stringify(issue, null, 2);

    writeFileSync(
      join(issueDir, "stages.json"),
      JSON.stringify(
        {
          issue: (issue as { number: number }).number,
          stages: ["research", "plan", "build", "review"],
          prompt: `Read skill://b-auto-fix and process this issue in worktree: <worktree-path>. Issue data: ${issueData}`,
        },
        null,
        2,
      ),
      "utf-8",
    );

    // Write completion routing plan (Phase 7)
    writeFileSync(
      join(issueDir, "completion-plan.json"),
      JSON.stringify(
        {
          issue: (issue as { number: number }).number,
          successPath: [
            "1. Read review.md verdict",
            "2. If approved: push branch, create draft PR, post summary comment, remove worktree",
            "3. If review_blocked: post needs-human comment, leave worktree",
          ],
          hardFailPath: [
            "1. Post needs-human comment with failure mode",
            "2. Leave worktree + branch on disk",
            "3. Record hard-fail in run state",
          ],
          softFailPath: [
            "1. Write soft-fail.log to issue directory",
            "2. Continue to next issue",
          ],
          branch: `${finalConfig.branch_prefix}${(issue as { number: number }).number}`,
          worktreePath: `issue-${(issue as { number: number }).number}`,
        },
        null,
        2,
      ),
      "utf-8",
    );

    results.push({
      issue: (issue as { number: number }).number,
      stage: "setup",
      status: "completed",
      artifact: join(issueDir, "completion-plan.json"),
    });
  }

  console.log(`Pipeline ready: ${issues.length} issues staged in ${runDir}`);

  // Update run state manifest with filtered issues
  const state: RunState = {
    run_id: runId,
    started_at: new Date().toISOString(),
    repo,
    config: finalConfig,
    issues,
    results: [],
  };
  writeFileSync(join(runDir, "run.json"), JSON.stringify(state, null, 2), "utf-8");

  return state;
}

// ── Output path routing (Phase 7) ──────────────────────
export interface CompletionInput {
  runDir: string;
  issueN: number;
  repo: string;
  branch: string;
  baseBranch: string;
  worktreeDir: string;
  branchPrefix: string;
  dryRun: boolean;
}

export async function successPath(input: CompletionInput): Promise<void> {
  const { pushBranch } = await import("./auto-fix/lib/push.ts");
  const { createDraftPr } = await import("./auto-fix/lib/pr.ts");
  const { postIssueSummary } = await import("./auto-fix/lib/comment.ts");
  const { remove } = await import("./auto-fix/lib/worktree.ts");
  const { generatePrBody } = await import("./auto-fix/lib/pr-body.ts");

  const repoDir = process.cwd();

  // Read build/review artifacts
  let buildArtifact = "";
  let reviewArtifact = "";
  let diffSummary = "";
  try {
    buildArtifact = readFileSync(
      join(input.runDir, `issue-${input.issueN}`, "build.md"),
      "utf-8",
    );
    reviewArtifact = readFileSync(
      join(input.runDir, `issue-${input.issueN}`, "review.md"),
      "utf-8",
    );
    const diffProc = Bun.spawn({
      cmd: ["git", "diff", "--stat", input.baseBranch],
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    diffSummary = (await new Response(diffProc.stdout).text()).trim();
  } catch {
    // Artifacts may not exist — continue with empty
  }

  const body = generatePrBody({
    issueNumber: input.issueN,
    issueTitle: `Issue #${input.issueN}`,
    branch: input.branch,
    diffSummary,
    buildArtifact,
    reviewArtifact,
  });

  if (input.dryRun) {
    // Write proposed PR body to disk
    const dryRunDir = join(input.runDir, `issue-${input.issueN}`);
    writeFileSync(join(dryRunDir, "pr-body.md"), body, "utf-8");
    console.log(
      `[DRY RUN] Would push branch ${input.branch}, create PR, post comment`,
    );
    return;
  }

  await pushBranch(input.branch, { repoDir });
  const pr = await createDraftPr({
    head: input.branch,
    base: input.baseBranch,
    title: `fix: auto-fix for issue #${input.issueN}`,
    body,
    repo: input.repo,
  });
  await postIssueSummary({
    issueNumber: input.issueN,
    prUrl: pr.url,
    repo: input.repo,
  });

  console.log(`Issue #${input.issueN}: success — PR ${pr.url}`);
}

export async function hardFailPath(
  input: CompletionInput,
  failureMode: string,
): Promise<void> {
  if (input.dryRun) {
    const summary = [
      `## Hard-fail: ${failureMode}`,
      `**Worktree**: ${join(input.worktreeDir, `issue-${input.issueN}`)}`,
      `**Branch**: ${input.branch}`,
      "",
      "This issue needs human intervention.",
    ].join("\n");
    writeFileSync(
      join(input.runDir, `issue-${input.issueN}`, "summary.md"),
      summary,
      "utf-8",
    );
    console.log(
      `[DRY RUN] Would post needs-human comment for issue #${input.issueN}`,
    );
    return;
  }

  const { postNeedsHuman } = await import("./auto-fix/lib/comment.ts");
  await postNeedsHuman({
    issueNumber: input.issueN,
    worktreePath: join(input.worktreeDir, `issue-${input.issueN}`),
    branch: input.branch,
    failureMode,
    repo: input.repo,
  });

  console.log(
    `Issue #${input.issueN}: hard-fail (${failureMode}) — needs human`,
  );
}

export async function softFailPath(
  input: CompletionInput,
  reason: string,
): Promise<void> {
  const logPath = join(
    input.runDir,
    `issue-${input.issueN}`,
    "soft-fail.log",
  );
  writeFileSync(logPath, `Soft-fail at ${new Date().toISOString()}: ${reason}\n`, "utf-8");
  console.log(`Issue #${input.issueN}: soft-fail — ${reason}`);
}

// Direct execution
if (import.meta.main) {
  await main();
}
