#!/usr/bin/env bun
// skills/b-pr/scripts/pr-preflight.ts
//
// PR preflight: detect base branches, verify rebase status, gather diff stats,
// and surface the .context/** research artifacts that informed the work.
// Deterministic plumbing for b-pr.
//
// Usage (run from the repo root):
//   bun skills/b-pr/scripts/pr-preflight.ts              # detect base candidates
//   bun skills/b-pr/scripts/pr-preflight.ts --base main  # full gather against chosen base
//
// Exit codes:
//   0 = success
//   1 = error (not a git repo, gh not auth, etc.)
//   2 = feature branch is behind the base branch (needs rebase)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------- types ----------

interface CandidateBase {
  name: string;
  exists: boolean;
  remote: string;
}

interface CommitInfo {
  sha: string;
  subject: string;
  author: string;
  date: string;
}

interface FileStat {
  path: string;
  additions: number;
  deletions: number;
}

interface ContextArtifact {
  type: "plan" | "spec" | "brainstorm" | "research" | "phase";
  path: string;
  subject: string;
  title?: string;
  goal?: string;
  status?: string;
}

interface PreflightOutput {
  current_branch: string;
  repo_root: string;
  base_candidates: CandidateBase[];
  chosen_base?: string;
  chosen_base_remote?: string;
  behind_count?: number;
  ahead_count?: number;
  commits?: CommitInfo[];
  implementation_files_count?: number;
  implementation_files?: FileStat[];
  context_files_count?: number;
  context_files?: FileStat[];
  diff_stat?: string;
  context_artifacts?: ContextArtifact[];
  needs_rebase?: boolean;
  error?: string;
}

// ---------- utilities ----------

function die(msg: string, code = 1): never {
  console.error(`pr-preflight: error: ${msg}`);
  process.exit(code);
}

function execGit(args: readonly string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer };
    const stderr = err.stderr?.toString().trim() || err.message;
    die(`git ${args.join(" ")} failed: ${stderr}`);
  }
}

function execGh(args: readonly string[]): string {
  try {
    return execFileSync("gh", args, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer };
    const stderr = err.stderr?.toString().trim() || err.message;
    die(`gh ${args.join(" ")} failed: ${stderr}`);
  }
}

// Classify a repo-relative .context/** path into an artifact type, or null.
// rel looks like ".context/2026-06-11.b-pr-skill/plan-foo.md".
function artifactType(rel: string): ContextArtifact["type"] | null {
  const parts = rel.split("/");
  if (parts.length < 3 || parts[0] !== ".context") return null;
  const subject = parts[1];
  if (!/^\d{4}-\d{2}-\d{2}\..+/.test(subject)) return null;
  const file = parts.slice(2).join("/");
  if (file.startsWith("plan-") && file.endsWith(".md")) {
    return file.includes("-phases") ? "phase" : "plan";
  }
  if (file.startsWith("spec-") && file.endsWith(".md")) return "spec";
  if (file.startsWith("brainstorm-") && file.endsWith(".md")) return "brainstorm";
  if (file.startsWith("research-") && file.endsWith(".md")) return "research";
  return null;
}

// ---------- main ----------

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const chosenBaseArg = baseIdx !== -1 ? args[baseIdx + 1] : undefined;

// 1. Preflight: git repo
execGit(["rev-parse", "--is-inside-work-tree"]);
const repoRoot = execGit(["rev-parse", "--show-toplevel"]).trim();

// 2. Preflight: gh auth
execGh(["auth", "status"]);

// 3. Current branch
const currentBranch = execGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
if (currentBranch === "HEAD") {
  die("detached HEAD state — switch to a feature branch first");
}

// 4. Fetch latest remote refs (best-effort, don't fail on network issues)
try {
  execFileSync("git", ["fetch", "--prune"], { stdio: "pipe" });
} catch {
  // Network issue — continue with local refs
}

// 5. Detect candidate base branches
const candidateNames = ["main", "master", "dev", "develop"];
const baseCandidates: CandidateBase[] = candidateNames.map((name) => {
  // Check remote refs first, then local
  let exists = false;
  let remote = "origin";
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/remotes/origin/${name}`], { stdio: "pipe" });
    exists = true;
    remote = "origin";
  } catch {
    try {
      execFileSync("git", ["rev-parse", "--verify", `refs/heads/${name}`], { stdio: "pipe" });
      exists = true;
      remote = ""; // local only
    } catch {
      exists = false;
    }
  }
  return { name, exists, remote };
}).filter((c) => c.exists);

if (baseCandidates.length === 0) {
  die("no candidate base branches found (checked: main, master, dev, develop)");
}

// 6. If no --base arg, output candidates and exit
if (!chosenBaseArg) {
  const output: PreflightOutput = {
    current_branch: currentBranch,
    repo_root: repoRoot,
    base_candidates: baseCandidates,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// 7. Validate chosen base — check candidate list first, then arbitrary refs
let chosenCandidate = baseCandidates.find((c) => c.name === chosenBaseArg);
if (!chosenCandidate) {
  // Allow arbitrary branch names that exist as local or remote refs
  let exists = false;
  let remote = "";
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/remotes/origin/${chosenBaseArg}`], { stdio: "pipe" });
    exists = true;
    remote = "origin";
  } catch {
    try {
      execFileSync("git", ["rev-parse", "--verify", `refs/heads/${chosenBaseArg}`], { stdio: "pipe" });
      exists = true;
      remote = "";
    } catch {
      exists = false;
    }
  }
  if (!exists) {
    die(`base branch '${chosenBaseArg}' not found among candidates or git refs: ${baseCandidates.map((c) => c.name).join(", ")}`);
  }
  chosenCandidate = { name: chosenBaseArg, exists: true, remote };
}

const baseRef = chosenCandidate.remote ? `${chosenCandidate.remote}/${chosenCandidate.name}` : chosenCandidate.name;

// 8. Check rebase status: is HEAD behind the base?
const behindAhead = execGit(["rev-list", "--left-right", "--count", `${baseRef}...HEAD`]).trim();
const [behindStr, aheadStr] = behindAhead.split("\t");
const behindCount = parseInt(behindStr, 10);
const aheadCount = parseInt(aheadStr, 10);

if (behindCount > 0) {
  const output: PreflightOutput = {
    current_branch: currentBranch,
    repo_root: repoRoot,
    base_candidates: baseCandidates,
    chosen_base: chosenBaseArg,
    chosen_base_remote: chosenCandidate.remote,
    behind_count: behindCount,
    ahead_count: aheadCount,
    needs_rebase: true,
    error: `Feature branch is ${behindCount} commit(s) behind ${baseRef}. Rebase before creating PR.`,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(2);
}

// 9. Gather commit log
const logFormat = "--format=%H%n%s%n%an%n%ai%n---";
const logRaw = execGit(["log", `${baseRef}..HEAD`, logFormat]).trim();
const commits: CommitInfo[] = [];
if (logRaw) {
  const entries = logRaw.split("\n---\n");
  for (const entry of entries) {
    const lines = entry.trim().split("\n");
    if (lines.length >= 4) {
      commits.push({
        sha: lines[0],
        subject: lines[1],
        author: lines[2],
        date: lines[3],
      });
    }
  }
}

// 10. Gather diff stats — implementation only.
//     .context/** is research/development context that GUIDED the work; it is NOT
//     implementation. Exclude it so diff_stat matches implementation_files. Paths are
//     repo-root-relative; the skill is always run from the repo root.
const diffStat = execGit(["diff", "--stat", `${baseRef}..HEAD`, "--", ".", ":(exclude).context"]).trim();

// 11. Gather per-file stats, split into implementation vs context (.context/**).
const numstatRaw = execGit(["diff", "--numstat", `${baseRef}..HEAD`]).trim();
const implementationFiles: FileStat[] = [];
const contextFiles: FileStat[] = [];
if (numstatRaw) {
  for (const line of numstatRaw.split("\n")) {
    const parts = line.split("\t");
    if (parts.length === 3) {
      const adds = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
      const dels = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
      const file = { path: parts[2], additions: adds, deletions: dels };
      if (parts[2].startsWith(".context/")) {
        contextFiles.push(file);
      } else {
        implementationFiles.push(file);
      }
    }
  }
}

// 12. Parse the .context/** artifacts that CHANGED in this diff.
//     These are research/development artifacts (plans, specs, brainstorms, research,
//     phases) that informed the implementation — they are NOT the implementation. Only
//     changed artifacts are surfaced (derived from context_files) so stale, unrelated
//     plans never leak into the PR description. Paths are repo-relative and stable.
const contextArtifacts: ContextArtifact[] = [];
for (const cf of contextFiles) {
  const type = artifactType(cf.path);
  if (!type) continue;

  const absPath = join(repoRoot, cf.path);
  if (!existsSync(absPath)) continue; // deleted in this diff — nothing to read
  const content = readFileSync(absPath, "utf-8");

  // Extract frontmatter fields
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let title: string | undefined;
  let goal: string | undefined;
  let status: string | undefined;
  if (fmMatch) {
    const fm = fmMatch[1];
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    const goalMatch = fm.match(/^goal:\s*(.+)$/m);
    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].trim();
    if (goalMatch) goal = goalMatch[1].trim();
    if (statusMatch) status = statusMatch[1].trim();
  }

  // Fall back to body headings
  if (!title) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) title = h1Match[1].trim();
  }
  if (!goal) {
    const userGoalMatch = content.match(/^##\s+User Goal\s*\n+(.+)$/m);
    if (userGoalMatch) goal = userGoalMatch[1].trim();
  }

  contextArtifacts.push({
    type,
    path: cf.path,
    subject: cf.path.split("/")[1],
    title,
    goal,
    status,
  });
}

// 13. Output
const output: PreflightOutput = {
  current_branch: currentBranch,
  repo_root: repoRoot,
  base_candidates: baseCandidates,
  chosen_base: chosenBaseArg,
  chosen_base_remote: chosenCandidate.remote,
  behind_count: behindCount,
  ahead_count: aheadCount,
  commits,
  implementation_files_count: implementationFiles.length,
  implementation_files: implementationFiles,
  context_files_count: contextFiles.length,
  context_files: contextFiles,
  diff_stat: diffStat,
  context_artifacts: contextArtifacts,
  needs_rebase: false,
};

console.log(JSON.stringify(output, null, 2));
