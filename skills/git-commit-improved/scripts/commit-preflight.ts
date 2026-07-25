#!/usr/bin/env bun
// skills/git-commit-improved/scripts/commit-preflight.ts
//
// Commit preflight: detect active subject folder, read draft-commit.md if present,
// run the protected-branch guard, and gather the staged diff. Deterministic plumbing
// for b-commit-improved — no model calls, no LLM step.
//
// Usage (run from the repo root):
//   bun skills/git-commit-improved/scripts/commit-preflight.ts            # default
//   bun skills/git-commit-improved/scripts/commit-preflight.ts --force   # bypass protected-branch check
//   bun skills/git-commit-improved/scripts/commit-preflight.ts --no-draft
//   bun skills/git-commit-improved/scripts/commit-preflight.ts --dry-run
//
// Exit codes:
//   0 = ready to commit; payload includes staged files, diff, current branch, draft (if any)
//   2 = protected branch and --force not set
//   3 = no staged changes
//   1 = git itself is broken (not a repo, detached HEAD, etc.)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---------- types ----------

interface DraftBlock {
  title: string;
  body: string;
}

interface PreflightOutput {
  code: 0;
  current_branch: string;
  subject_folder: string | null;
  draft_path: string | null;
  draft: DraftBlock | null;
  staged_files: string[];
  diff: string;
  force: boolean;
  no_draft: boolean;
  dry_run: boolean;
}

// ---------- utilities ----------

function die(msg: string, code = 1): never {
  // Always emit JSON on the way out so the extension can parse the error.
  const payload: Record<string, unknown> = { error: msg };
  if (code === 2) payload.current_branch = "unknown";
  console.log(JSON.stringify(payload));
  process.exit(code);
}

function execGit(args: readonly string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer };
    die(`git ${args.join(" ")} failed: ${err.stderr?.toString().trim() || err.message}`, 1);
  }
}

// ---------- draft parsing ----------

// Parse a draft-commit.md file into { title, body }.
// Format: `## Title` heading followed by the title text (until blank line or next `## ` heading),
// then `## Body` heading followed by the body (until next `## ` heading or EOF).
function extractDraft(content: string): DraftBlock {
  const lines = content.split("\n");
  const titleIdx = lines.findIndex((l) => l.trim() === "## Title");
  const bodyIdx = lines.findIndex((l) => l.trim() === "## Body");

  let title = "";
  if (titleIdx !== -1) {
    for (let i = titleIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("## ")) break;
      if (line.trim() === "") continue; // skip blank lines between heading and title
      title = line.trim();
      break; // title is the first non-blank line after the heading
    }
  }
  let body = "";
  if (bodyIdx !== -1) {
    const collected: string[] = [];
    for (let i = bodyIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("## ")) break;
      collected.push(line);
    }
    body = collected.join("\n").trim();
  }

  return { title, body };
}

// ---------- main ----------

const args = process.argv.slice(2);
const force = args.includes("--force");
const noDraft = args.includes("--no-draft");
const dryRun = args.includes("--dry-run");

// 1. Preflight: git repo
execGit(["rev-parse", "--is-inside-work-tree"]);

// 2. Staged check first — cheap, no HEAD required. A fresh repo with no commits
//    has no HEAD ref; running --abbrev-ref HEAD would fail spuriously instead of
//    the more useful "nothing staged" exit.
const stagedRaw = execGit(["diff", "--cached", "--name-only"]).trim();
const stagedFiles = stagedRaw ? stagedRaw.split("\n").filter(Boolean) : [];
if (stagedFiles.length === 0) {
  console.log(JSON.stringify({ error: "nothing staged" }));
  process.exit(3);
}

// 3. Current branch (only now we need it — we have work to commit).
//    Use symbolic-ref so a fresh repo with no commits still reveals the initial branch
//    (--abbrev-ref HEAD fails until the first commit exists).
let currentBranch: string;
try {
  currentBranch = execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
} catch {
  die("detached HEAD state — switch to a feature branch first", 1);
}

// 4. Detect active subject folder. Filter to YYYY-MM-DD.* entries and take the
//    most recent by name (date prefix sorts the same as creation order in
//    practice). Pure Node — no shell glob, so untrusted .context/ names
//    cannot steer the result.
let subjectFolder: string | null = null;
try {
  const dirs = readdirSync(".context/")
    .filter((n) => /^\d{4}-\d{2}-\d{2}\./.test(n))
    .sort();
  if (dirs.length > 0) subjectFolder = `.context/${dirs[dirs.length - 1]}`;
} catch {
  // no .context/ folder — leave null
}

// 5. Detect draft — subject folder first, then root fallback.
let draftPath: string | null = null;
let draft: DraftBlock | null = null;
if (!noDraft) {
  const candidates = subjectFolder
    ? [join(subjectFolder, "draft-commit.md"), ".context/draft-commit.md"]
    : [".context/draft-commit.md"];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const parsed = extractDraft(readFileSync(p, "utf-8"));
        if (parsed.title) {
          draftPath = p;
          draft = parsed;
        }
      } catch {
        // unreadable — skip
      }
      break;
    }
  }
}

// 5. Branch guard
const protectedBranches: Record<string, true> = {
  main: true,
  master: true,
  dev: true,
  develop: true,
};
if (protectedBranches[currentBranch] && !force) {
  const payload: Record<string, unknown> = {
    error: `protected branch '${currentBranch}' — re-run with --force to commit here directly`,
    current_branch: currentBranch,
  };
  console.log(JSON.stringify(payload));
  process.exit(2);
}
// 6. Gather diff
const diff = execGit(["diff", "--cached"]);

// 7. Output
const output: PreflightOutput = {
  code: 0,
  current_branch: currentBranch,
  subject_folder: subjectFolder,
  draft_path: draftPath,
  draft,
  staged_files: stagedFiles,
  diff,
  force,
  no_draft: noDraft,
  dry_run: dryRun,
};

console.log(JSON.stringify(output));
