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
//   0 = success (base resolved, gathered)
//   1 = error (not a git repo, rebase in-progress, etc.)
//   2 = behind + --dry-run (would rebase; reported and stopped)
//   3 = rebase conflict (resolve, then re-run)

import { execFileSync } from "node:child_process";
import { accessSync, closeSync, constants, existsSync, openSync, readFileSync, readSync, statSync, unlinkSync, writeFileSync } from "node:fs";
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
  base_source?: "candidates" | "cache" | "flag";
  needs_rebase?: boolean;
  rebased?: boolean;
  rebase_conflict?: boolean;
  conflicted_files?: string[];
  error?: string;
}

// ---------- utilities ----------

function die(msg: string, code = 1): never {
  // stderr for humans; stdout JSON so orchestrators (b-pr-improved) can surface the message.
  console.error(`pr-preflight: error: ${msg}`);
  console.log(JSON.stringify({ error: msg }));
  process.exit(code);
}

/** Read a small head of a PATH candidate (for detecting shell wrappers). */
function readFileHead(path: string, maxBytes = 512): string {
  try {
    const fd = openSync(path, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      const n = readSync(fd, buf, 0, maxBytes, 0);
      return buf.subarray(0, n).toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return "";
  }
}

/**
 * True when PATH entry is a shell script that re-execs the same command name.
 * Example hang (Bun PATH puts ~/.local/bin ahead of mise installs):
 *   #!/bin/bash
 *   mise use -g "gh"
 *   exec "gh" "$@"
 * That wrapper re-finds itself on PATH → infinite mise spam / hang under non-TTY spawn.
 */
function isSelfReexecWrapper(path: string, name: string): boolean {
  const head = readFileHead(path);
  if (!head.startsWith("#!")) return false;
  // exec gh / exec "gh" / exec 'gh'
  const reexec = new RegExp(String.raw`\bexec\s+["']?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`);
  if (reexec.test(head)) return true;
  if (/\bmise\s+use\b/.test(head) && head.includes(name)) return true;
  return false;
}

/**
 * Resolve a real binary from PATH, skipping self-reexec shell wrappers.
 * Falls back to bare `name` (execvp PATH search) when nothing better is found.
 */
function resolveCmd(name: string): string {
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    const candidate = join(dir, name);
    try {
      if (!existsSync(candidate)) continue;
      const st = statSync(candidate);
      // Accept regular files and symlinks-to-files (mise shims → /usr/bin/mise are fine).
      if (!st.isFile() && !st.isSymbolicLink()) continue;
      accessSync(candidate, constants.X_OK);
    } catch {
      continue;
    }
    if (isSelfReexecWrapper(candidate, name)) continue;
    return candidate;
  }
  return name;
}

const GIT_BIN = resolveCmd("git");

const EXEC_OPTS = {
  encoding: "utf-8" as const,
  // ignore stdin: some CLIs behave differently when stdin is a pipe.
  stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
  // Hard ceiling so a bad wrapper never wedges the agent session again.
  timeout: 60_000,
};

function execGit(args: readonly string[]): string {
  try {
    return execFileSync(GIT_BIN, args as string[], EXEC_OPTS);
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer | string };
    const stderr = (typeof err.stderr === "string" ? err.stderr : err.stderr?.toString())?.trim() || err.message;
    die(`git ${args.join(" ")} failed: ${stderr}`);
  }
}


// Run git without dying — returns status for ops (like rebase) that may legitimately fail.
function tryGit(args: readonly string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(GIT_BIN, args as string[], EXEC_OPTS);
    return { ok: true, stdout, stderr: "" };
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer | string; stdout?: Buffer | string };
    const stdout = typeof err.stdout === "string" ? err.stdout : err.stdout?.toString() ?? "";
    const stderr = (typeof err.stderr === "string" ? err.stderr : err.stderr?.toString())?.trim() || err.message;
    return { ok: false, stdout, stderr };
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
let chosenBaseArg = baseIdx !== -1 ? args[baseIdx + 1] : undefined;
const dryRun = args.includes("--dry-run");
const noCache = args.includes("--no-cache");
let baseSource: "candidates" | "cache" | "flag" = chosenBaseArg ? "flag" : "candidates";

// 1. Preflight: git repo
execGit(["rev-parse", "--is-inside-work-tree"]);
const repoRoot = execGit(["rev-parse", "--show-toplevel"]).trim();
const gitDir = execGit(["rev-parse", "--git-dir"]).trim();
const baseCacheFile = join(gitDir, "b-pr-base"); // base-branch cache (local, per-clone, never committed)

// Bail if a rebase is already mid-flight (unresolved conflicts from a prior run).
// Checked before the detached-HEAD check: a conflicted rebase leaves HEAD detached,
// which would otherwise produce a misleading "switch to a feature branch" error.
if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) {
  die(`a rebase is already in progress. Resolve conflicts, run \`git rebase --continue\` until "Successfully rebased", then re-run /b-pr.`);
}


// 2. Current branch
const currentBranch = execGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
if (currentBranch === "HEAD") {
  die("detached HEAD state — switch to a feature branch first");
}

// 3. Fetch latest remote refs (best-effort, don't fail on network issues)
try {
  execFileSync(GIT_BIN, ["fetch", "--prune"], EXEC_OPTS);
} catch {
  // Network issue — continue with local refs
}

// 4. Detect candidate base branches
const candidateNames = ["main", "master", "dev", "develop"];
const baseCandidates: CandidateBase[] = candidateNames.map((name) => {
  // Check remote refs first, then local
  if (tryGit(["rev-parse", "--verify", `refs/remotes/origin/${name}`]).ok) {
    return { name, exists: true, remote: "origin" };
  }
  if (tryGit(["rev-parse", "--verify", `refs/heads/${name}`]).ok) {
    return { name, exists: true, remote: "" }; // local only
  }
  return { name, exists: false, remote: "origin" };
}).filter((c) => c.exists);

if (baseCandidates.length === 0) {
  die("no candidate base branches found (checked: main, master, dev, develop)");
}

// 5. Resolve the base: --base flag wins; else the cache; else surface candidates.
if (!chosenBaseArg) {
  const cached = noCache ? undefined : (existsSync(baseCacheFile) ? readFileSync(baseCacheFile, "utf-8").trim() || undefined : undefined);
  if (cached) {
    // Trust the cache only if the ref still exists locally or on origin.
    const stillExists = tryGit(["rev-parse", "--verify", `refs/remotes/origin/${cached}`]).ok
      || tryGit(["rev-parse", "--verify", `refs/heads/${cached}`]).ok;
    if (stillExists) {
      chosenBaseArg = cached;
      baseSource = "cache";
    } else {
      try { unlinkSync(baseCacheFile); } catch { /* stale — forget it */ }
    }
  }
}

if (!chosenBaseArg) {
  // Cache miss → hand candidates to the caller (the skill asks the user once).
  const output: PreflightOutput = {
    current_branch: currentBranch,
    repo_root: repoRoot,
    base_candidates: baseCandidates,
    base_source: "candidates",
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// 6. Validate chosen base — check candidate list first, then arbitrary refs
let chosenCandidate = baseCandidates.find((c) => c.name === chosenBaseArg);
if (!chosenCandidate) {
  // Allow arbitrary branch names that exist as local or remote refs
  let exists = false;
  let remote = "";
  if (tryGit(["rev-parse", "--verify", `refs/remotes/origin/${chosenBaseArg}`]).ok) {
    exists = true;
    remote = "origin";
  } else if (tryGit(["rev-parse", "--verify", `refs/heads/${chosenBaseArg}`]).ok) {
    exists = true;
    remote = "";
  }
  if (!exists) {
    die(`base branch '${chosenBaseArg}' not found among candidates or git refs: ${baseCandidates.map((c) => c.name).join(", ")}`);
  }
  chosenCandidate = { name: chosenBaseArg, exists: true, remote };
}

// Cache the confirmed base so subsequent runs skip the prompt.
// (No-op in dry-run so a wrong preview never poisons the cache.)
if (!dryRun) writeFileSync(baseCacheFile, chosenBaseArg! + "\n");

const baseRef = chosenCandidate.remote ? `${chosenCandidate.remote}/${chosenCandidate.name}` : chosenCandidate.name;

// 7. Check rebase status: is HEAD behind the base?
let behindAhead = execGit(["rev-list", "--left-right", "--count", `${baseRef}...HEAD`]).trim();
let [behindStr, aheadStr] = behindAhead.split("\t");
let behindCount = parseInt(behindStr, 10);
let aheadCount = parseInt(aheadStr, 10);
let rebased = false;

if (behindCount > 0) {
  if (dryRun) {
    // Don't mutate during a dry-run — report and stop.
    const output: PreflightOutput = {
      current_branch: currentBranch,
      repo_root: repoRoot,
      base_candidates: baseCandidates,
      chosen_base: chosenBaseArg,
      chosen_base_remote: chosenCandidate.remote,
      behind_count: behindCount,
      ahead_count: aheadCount,
      base_source: baseSource,
      needs_rebase: true,
      error: `Feature branch is ${behindCount} commit(s) behind ${baseRef}. Rebase required (--dry-run won't rebase).`,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(2);
  }

  // Fetch already ran (step 4). Replay our commits onto the base.
  // --autostash: dirty tracked files are stashed before the rebase and popped after,
  // so local WIP never blocks an otherwise-clean rebase (the failure mode that used
  // to surface as exit 1 "no output" in b-pr-improved).
  const rebaseResult = tryGit(["rebase", "--autostash", baseRef]);
  if (!rebaseResult.ok) {
    const conflictRaw = tryGit(["diff", "--diff-filter=U", "--name-only"]).stdout.trim();
    const conflictedFiles = conflictRaw ? conflictRaw.split("\n").filter(Boolean) : [];
    if (conflictedFiles.length === 0) {
      // Not a merge conflict — hook refusal, autostash apply failure, or other.
      die(`git rebase --autostash ${baseRef} failed (no merge conflicts detected — hook or other refusal): ${rebaseResult.stderr}`);
    }
    const output: PreflightOutput = {
      current_branch: currentBranch,
      repo_root: repoRoot,
      base_candidates: baseCandidates,
      chosen_base: chosenBaseArg,
      chosen_base_remote: chosenCandidate.remote,
      behind_count: behindCount,
      ahead_count: aheadCount,
      base_source: baseSource,
      rebase_conflict: true,
      conflicted_files: conflictedFiles,
      error: `Rebase onto ${baseRef} conflicts in ${conflictedFiles.length} file(s): ${conflictedFiles.join(", ")}. Resolve, \`git add\`, \`git rebase --continue\` until done, then re-run /b-pr.`,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(3);
  }
  // Clean rebase — recompute counts against the new HEAD.
  rebased = true;
  behindAhead = execGit(["rev-list", "--left-right", "--count", `${baseRef}...HEAD`]).trim();
  [behindStr, aheadStr] = behindAhead.split("\t");
  behindCount = parseInt(behindStr, 10);
  aheadCount = parseInt(aheadStr, 10);
}

// 8. Gather commit log
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
  base_source: baseSource,
  rebased,
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
