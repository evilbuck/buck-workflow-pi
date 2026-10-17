import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { listOpenIssues, findExistingDraftPr, GhIssue } from "./auto-fix/lib/gh.ts";
import { commitConsumerBatch, readConsumer, type ConsumerScope } from "../../_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore, type TrustedWorkflowContext } from "../../_shared/scripts/workflow-state.js";

interface AutoFixStore {
  cwd: string;
  context: TrustedWorkflowContext;
  scope: ConsumerScope;
}

async function bindAutoFixStore(cwd: string): Promise<AutoFixStore> {
  cwd = resolve(cwd);
  const context = await resolveConsumerContext(cwd);
  if (!context.worktreeId || !context.runId) throw new Error("Auto-fix requires a trusted worktree/run");
  return { cwd, context, scope: { ...context, worktreeId: context.worktreeId, runId: context.runId } };
}

function artifactName(runId: string, name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(runId)) throw new Error("Invalid auto-fix run ID");
  if (name !== "run.json" && !/^issue-[1-9][0-9]*\/(?:stages\.json|completion-plan\.json|research\.md|plan\.md|build\.md|review\.md|pr-body\.md|summary\.md|soft-fail\.log)$/u.test(name)) {
    throw new Error(`Invalid auto-fix artifact: ${name}`);
  }
  return `${runId}/${name}`;
}

async function writeRunArtifact(bound: AutoFixStore, runId: string, name: string, bytes: Uint8Array | string, expectedRevision?: string | null): Promise<string> {
  const logicalName = artifactName(runId, name);
  const result = await withBoundStore(bound.cwd, bound.context, async (store) => {
    const receiptRun = `run-${randomBytes(16).toString("hex")}`;
    return commitConsumerBatch(store, bound.scope, [{
      kind: name === "run.json" ? "run-state" : "audit", subjectId: "auto-fix", logicalName,
      bytes: typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes, source: "b-auto-fix", expectedRevision,
    }], { attemptId: receiptRun, runId: receiptRun, status: "attempted" });
  });
  const path = join(bound.cwd, ".context", "auto-fix", logicalName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return result.revisions[0]!;
}

async function readRunArtifact(bound: AutoFixStore, runId: string, name: string) {
  return withBoundStore(bound.cwd, bound.context, (store) =>
    readConsumer(store, bound.scope, name === "run.json" ? "run-state" : "audit", "auto-fix", artifactName(runId, name)));
}

async function listRunArtifacts(bound: AutoFixStore, runId?: string) {
  if (runId) artifactName(runId, "run.json");
  return withBoundStore(bound.cwd, bound.context, (store) => store.list({
    ...bound.scope, publishedRevisionIds: [], subjectId: "auto-fix",
    ...(runId ? { logicalNamePrefix: `${runId}/` } : { kind: "run-state" as const }),
  }));
}

function runLocation(runDir: string): { cwd: string; runId: string } {
  const path = resolve(runDir);
  if (basename(dirname(path)) !== "auto-fix" || basename(dirname(dirname(path))) !== ".context") {
    throw new Error("Auto-fix run directory must be <checkout>/.context/auto-fix/<run-id>");
  }
  return { cwd: dirname(dirname(dirname(path))), runId: basename(path) };
}

function artifactCwd(args: string[]): string {
  const index = args.indexOf("--cwd");
  if (index === -1) return process.cwd();
  const cwd = args[index + 1];
  if (!cwd) throw new Error("--cwd requires the owning checkout");
  return cwd;
}

async function writeStageArtifact(bound: AutoFixStore, runId: string, name?: string, input?: string): Promise<void> {
  if (!name || name === "run.json" || !input || input === "--cwd") throw new Error("artifact write requires an issue artifact and input file");
  await writeRunArtifact(bound, runId, name, readFileSync(input));
}

async function restoreRunExports(bound: AutoFixStore, runId: string): Promise<void> {
  const artifacts = await listRunArtifacts(bound, runId);
  for (const artifact of artifacts) {
    const relativeName = artifact.key.logicalName.slice(runId.length + 1);
    const path = join(bound.cwd, ".context", "auto-fix", artifactName(runId, relativeName));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, artifact.bytes);
  }
  console.log(join(bound.cwd, ".context", "auto-fix", runId));
}

/** Explicit stage handoff and restart export. No local file is a retained-read fallback. */
async function artifactCommand(args: string[]): Promise<void> {
  const [, operation, runId, name, input] = args;
  if (!runId) throw new Error("artifact requires a run ID");
  const bound = await bindAutoFixStore(artifactCwd(args));
  const run = await readRunArtifact(bound, runId, "run.json");
  if (!run) throw new Error(`Retained auto-fix run not found: ${runId}`);
  if (operation === "read") {
    const found = await readRunArtifact(bound, runId, name ?? "");
    if (!found) throw new Error(`Retained auto-fix artifact not found: ${name}`);
    process.stdout.write(found.bytes);
  } else if (operation === "write") {
    await writeStageArtifact(bound, runId, name, input);
  } else if (operation === "restore") {
    await restoreRunExports(bound, runId);
  } else {
    throw new Error("Usage: artifact read|write|restore <run-id> [issue-N/name] [input-file] [--cwd <owning-checkout>]");
  }
}

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
  artifact write <run-id> <issue-N/name> <file> [--cwd <checkout>]
                            Retain stage output before exporting it locally
  artifact read <run-id> <name> [--cwd <checkout>]
                            Read retained bytes (run.json or issue-N/name)
  artifact restore <run-id> [--cwd <checkout>]
                            Rebuild exports from the configured private run

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

async function initRunState(
  bound: AutoFixStore,
  repo: string,
  config: AutoFixConfig,
): Promise<{ runId: string; runDir: string; revision: string }> {
  const runId = generateRunId();
  const runDir = join(bound.cwd, ".context", "auto-fix", runId);
  const state: RunState = {
    run_id: runId,
    started_at: new Date().toISOString(),
    repo,
    config,
    issues: [],
    results: [],
  };

  const revision = await writeRunArtifact(bound, runId, "run.json", JSON.stringify(state, null, 2), null);
  return { runId, runDir, revision };
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

  // List mode must not bind or write storage identity.

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
  const bound = await bindAutoFixStore(process.cwd());
  if (!finalConfig.dry_run && !flags.yes && (await listRunArtifacts(bound)).length === 0) {
    console.log("First run on this repo — use --dry-run to preview? [Y/n]");
    console.log("Defaulting to dry-run for safety. Use --yes to skip this prompt.");
    finalConfig.dry_run = true;
  }

  const { runId, runDir, revision } = await initRunState(bound, repo, finalConfig);
  console.log(`Run state: ${runDir}/run.json`);

  // ── Fetch and filter issues ──────────────────────────
  const issues: GhIssue[] = [];
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
    const issueDir = join(runDir, `issue-${issue.number}`);

    // These prompts and routing plans are retained evidence; files are exports.
    const issueData = JSON.stringify(issue, null, 2);

    await writeRunArtifact(
      bound, runId, `issue-${issue.number}/stages.json`,
      JSON.stringify(
        {
          issue: issue.number,
          stages: ["research", "plan", "build", "review"],
          prompt: `Read skill://b-auto-fix and process this issue in worktree: <worktree-path>. Retain stage output with: bun ${JSON.stringify(import.meta.filename)} artifact write ${runId} issue-${issue.number}/<stage>.md <output-file> --cwd ${JSON.stringify(bound.cwd)}. Read prior output with artifact read; local files are exports only. Issue data: ${issueData}`,
        },
        null,
        2,
      ),
    );

    // Write completion routing plan (Phase 7)
    await writeRunArtifact(
      bound, runId, `issue-${issue.number}/completion-plan.json`,
      JSON.stringify(
        {
          issue: issue.number,
          successPath: [
            "1. Read retained review.md with artifact read",
            "2. If approved: push branch, create draft PR, post summary comment, remove worktree",
            "3. If review_blocked: post needs-human comment, leave worktree",
          ],
          hardFailPath: [
            "1. Post needs-human comment with failure mode",
            "2. Leave worktree + branch on disk",
            "3. Record hard-fail in run state",
          ],
          softFailPath: [
            "1. Retain soft-fail.log through softFailPath",
            "2. Continue to next issue",
          ],
          branch: `${finalConfig.branch_prefix}${issue.number}`,
          worktreePath: `issue-${issue.number}`,
        },
        null,
        2,
      ),
    );

    results.push({
      issue: issue.number,
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
    results,
  };
  await writeRunArtifact(bound, runId, "run.json", JSON.stringify(state, null, 2), revision);

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
  const { generatePrBody } = await import("./auto-fix/lib/pr-body.ts");

  const { cwd: repoDir, runId } = runLocation(input.runDir);
  const bound = await bindAutoFixStore(repoDir);
  if (!await readRunArtifact(bound, runId, "run.json")) throw new Error(`Retained auto-fix run not found: ${runId}`);
  const build = await readRunArtifact(bound, runId, `issue-${input.issueN}/build.md`);
  const review = await readRunArtifact(bound, runId, `issue-${input.issueN}/review.md`);
  if (!build || !review) throw new Error("Retained build.md and review.md are required before PR completion");
  const buildArtifact = new TextDecoder().decode(build.bytes);
  const reviewArtifact = new TextDecoder().decode(review.bytes);
  const diffProc = Bun.spawn({
    cmd: ["git", "diff", "--stat", input.baseBranch], cwd: repoDir, stdout: "pipe", stderr: "pipe",
  });
  const diffSummary = (await new Response(diffProc.stdout).text()).trim();
  if (await diffProc.exited !== 0) throw new Error("Cannot read auto-fix diff summary");

  const body = generatePrBody({
    issueNumber: input.issueN,
    issueTitle: `Issue #${input.issueN}`,
    branch: input.branch,
    diffSummary,
    buildArtifact,
    reviewArtifact,
  });
  await writeRunArtifact(bound, runId, `issue-${input.issueN}/pr-body.md`, body);

  if (input.dryRun) {
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
  const { cwd, runId } = runLocation(input.runDir);
  const bound = await bindAutoFixStore(cwd);
  if (!await readRunArtifact(bound, runId, "run.json")) throw new Error(`Retained auto-fix run not found: ${runId}`);
  const summary = [
    `## Hard-fail: ${failureMode}`,
    `**Worktree**: ${join(input.worktreeDir, `issue-${input.issueN}`)}`,
    `**Branch**: ${input.branch}`,
    "",
    "This issue needs human intervention.",
  ].join("\n");
  await writeRunArtifact(bound, runId, `issue-${input.issueN}/summary.md`, summary);
  if (input.dryRun) {
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
  const { cwd, runId } = runLocation(input.runDir);
  const bound = await bindAutoFixStore(cwd);
  if (!await readRunArtifact(bound, runId, "run.json")) throw new Error(`Retained auto-fix run not found: ${runId}`);
  await writeRunArtifact(bound, runId, `issue-${input.issueN}/soft-fail.log`, `Soft-fail at ${new Date().toISOString()}: ${reason}\n`);
  console.log(`Issue #${input.issueN}: soft-fail — ${reason}`);
}

// Direct execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  if (args[0] === "artifact") await artifactCommand(args);
  else await main();
}
