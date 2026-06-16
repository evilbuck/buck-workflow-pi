#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

interface ConflictHunk {
  startLine: number;
  endLine: number;
  oursLabel: string;
  theirsLabel: string;
  oursContent: string;
  theirsContent: string;
  baseContent?: string;
  contextBefore: string;
  contextAfter: string;
}

interface CommitInfo {
  hash: string;
  subject: string;
  body: string;
  author: string;
  date: string;
}

interface ContextArtifact {
  type: "plan" | "phase" | "spec" | "brainstorm" | "research" | "memory";
  path: string;
  subject?: string;
  title?: string;
  goal?: string;
  status?: string;
  topics: string[];
}

interface ConflictedFile {
  path: string;
  hunks: ConflictHunk[];
  oursCommits: CommitInfo[];
  theirsCommits: CommitInfo[];
}

interface AnalyzeOutput {
  operation: "rebase" | "merge";
  repoRoot: string;
  sideSemantics: {
    ours: string;
    theirs: string;
  };
  conflictedFiles: ConflictedFile[];
  contextArtifacts: ContextArtifact[];
}

function die(message: string, code = 1): never {
  console.error(`rebase-conflict-analyze: error: ${message}`);
  process.exit(code);
}

function execGit(args: readonly string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error: unknown) {
    const err = error as Error & { stderr?: Buffer };
    const stderr = err.stderr?.toString().trim() || err.message;
    die(`git ${args.join(" ")} failed: ${stderr}`);
  }
}

function execMaybeGit(args: readonly string[]): string | null {
  try {
    return execFileSync("git", args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function parseMultilineField(content: string, heading: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${heading}\\s*$`, "i");

  for (let index = 0; index < lines.length; index += 1) {
    if (!headingPattern.test(lines[index])) continue;

    const collected: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (line.startsWith("## ")) break;
      if (!line.trim() && collected.length === 0) continue;
      if (!line.trim() && collected.length > 0) break;
      collected.push(line.trim());
    }

    const value = collected.join(" ").trim();
    if (value) return value;
  }

  return undefined;
}

function parseFrontmatterList(content: string, field: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];

  const fm = fmMatch[1];
  const inlineMatch = fm.match(new RegExp(`^${field}:\\s*\\[(.*)\\]$`, "m"));
  if (inlineMatch) {
    return inlineMatch[1]
      .split(",")
      .map((value) => value.trim().replace(/^['\"]|['\"]$/g, ""))
      .filter(Boolean);
  }

  const blockMatch = fm.match(new RegExp(`^${field}:\\s*$([\\s\\S]*?)(?:^\\w[\\w-]*:|\\Z)`, "m"));
  if (!blockMatch) return [];

  return blockMatch[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*(.+)$/)?.[1]?.trim().replace(/^['\"]|['\"]$/g, ""))
    .filter((value): value is string => Boolean(value));
}

function collectArtifactMetadata(type: ContextArtifact["type"], filePath: string, content: string, subject?: string): ContextArtifact {
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = frontmatter?.[1] ?? "";

  const frontmatterTitle = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  const frontmatterGoal = fm.match(/^goal:\s*(.+)$/m)?.[1]?.trim();
  const frontmatterStatus = fm.match(/^status:\s*(.+)$/m)?.[1]?.trim();

  return {
    type,
    path: filePath,
    subject,
    title: frontmatterTitle || title,
    goal: frontmatterGoal || parseMultilineField(content, "User Goal") || parseMultilineField(content, "Goal"),
    status: frontmatterStatus,
    topics: parseFrontmatterList(content, "topics"),
  };
}

function scanContextArtifacts(repoRoot: string): ContextArtifact[] {
  const contextDir = join(repoRoot, ".context");
  if (!existsSync(contextDir)) return [];

  const artifacts: ContextArtifact[] = [];
  const entries = readdirSync(contextDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (!/^\d{4}-\d{2}-\d{2}\..+/.test(dirName)) continue;

    const subjectPath = join(contextDir, dirName);
    const files = readdirSync(subjectPath, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile()) continue;

      let type: ContextArtifact["type"] | null = null;
      if (file.name.startsWith("plan-") && file.name.endsWith(".md")) {
        type = file.name.includes("-phases") ? "phase" : "plan";
      } else if (file.name.startsWith("spec-") && file.name.endsWith(".md")) {
        type = "spec";
      } else if (file.name.startsWith("brainstorm-") && file.name.endsWith(".md")) {
        type = "brainstorm";
      } else if (file.name.startsWith("research-") && file.name.endsWith(".md")) {
        type = "research";
      }

      if (!type) continue;

      const filePath = join(subjectPath, file.name);
      const content = readFileSync(filePath, "utf-8");
      artifacts.push(collectArtifactMetadata(type, filePath, content, dirName));
    }
  }

  const memoryDir = join(contextDir, "memory");
  if (existsSync(memoryDir)) {
    const memoryFiles = readdirSync(memoryDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md")
      .sort((left, right) => {
        const leftPath = join(memoryDir, left.name);
        const rightPath = join(memoryDir, right.name);
        return statSync(rightPath).mtimeMs - statSync(leftPath).mtimeMs;
      })
      .slice(0, 10);

    for (const file of memoryFiles) {
      const filePath = join(memoryDir, file.name);
      const content = readFileSync(filePath, "utf-8");
      artifacts.push(collectArtifactMetadata("memory", filePath, content));
    }
  }

  return artifacts;
}

function parseCommitLog(range: string, filePath: string): CommitInfo[] {
  const format = "%H%x1f%s%x1f%b%x1f%an%x1f%ai%x1e";
  const raw = execMaybeGit(["log", `--format=${format}`, range, "--", filePath]);
  if (!raw) return [];

  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash = "", subject = "", body = "", author = "", date = ""] = entry.split("\x1f");
      return {
        hash,
        subject,
        body: body.trim(),
        author,
        date,
      };
    });
}

function parseConflictHunks(filePath: string): ConflictHunk[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);
  const hunks: ConflictHunk[] = [];

  let index = 0;
  while (index < lines.length) {
    const currentLine = lines[index];
    if (!currentLine.startsWith("<<<<<<< ")) {
      index += 1;
      continue;
    }

    const startIndex = index;
    const oursLabel = currentLine.slice("<<<<<<< ".length).trim();
    index += 1;

    const oursLines: string[] = [];
    while (index < lines.length && !lines[index].startsWith("||||||| ") && !lines[index].startsWith("=======")) {
      oursLines.push(lines[index]);
      index += 1;
    }

    let baseLines: string[] | undefined;
    if (index < lines.length && lines[index].startsWith("||||||| ")) {
      index += 1;
      baseLines = [];
      while (index < lines.length && !lines[index].startsWith("=======")) {
        baseLines.push(lines[index]);
        index += 1;
      }
    }

    if (index >= lines.length || !lines[index].startsWith("=======")) {
      die(`unterminated conflict hunk in ${filePath}`);
    }
    index += 1;

    const theirsLines: string[] = [];
    while (index < lines.length && !lines[index].startsWith(">>>>>>> ")) {
      theirsLines.push(lines[index]);
      index += 1;
    }

    if (index >= lines.length || !lines[index].startsWith(">>>>>>> ")) {
      die(`unterminated conflict hunk in ${filePath}`);
    }

    const theirsLabel = lines[index].slice(">>>>>>> ".length).trim();
    const endIndex = index;
    const contextBefore = lines.slice(Math.max(0, startIndex - 5), startIndex).join("\n");
    const contextAfter = lines.slice(endIndex + 1, Math.min(lines.length, endIndex + 6)).join("\n");

    hunks.push({
      startLine: startIndex + 1,
      endLine: endIndex + 1,
      oursLabel,
      theirsLabel,
      oursContent: oursLines.join("\n"),
      theirsContent: theirsLines.join("\n"),
      ...(baseLines ? { baseContent: baseLines.join("\n") } : {}),
      contextBefore,
      contextAfter,
    });

    index += 1;
  }

  return hunks;
}

function resolveGitDir(repoRoot: string): string {
  const gitDir = execGit(["rev-parse", "--git-dir"]).trim();
  return gitDir.startsWith("/") ? gitDir : resolve(repoRoot, gitDir);
}

function detectOperation(gitDir: string): AnalyzeOutput["operation"] | null {
  if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) {
    return "rebase";
  }
  if (existsSync(join(gitDir, "MERGE_HEAD"))) {
    return "merge";
  }
  return null;
}

function main(): void {
  execGit(["rev-parse", "--is-inside-work-tree"]);
  const repoRoot = execGit(["rev-parse", "--show-toplevel"]).trim();
  const gitDir = resolveGitDir(repoRoot);
  const operation = detectOperation(gitDir);

  if (!operation) {
    console.error("rebase-conflict-analyze: no active rebase or merge conflict");
    process.exit(2);
  }

  const conflictedPaths = execGit(["diff", "--name-only", "--diff-filter=U"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (conflictedPaths.length === 0) {
    console.error("rebase-conflict-analyze: no unmerged files detected");
    process.exit(2);
  }

  const otherRef = operation === "merge"
    ? execMaybeGit(["rev-parse", "MERGE_HEAD"])
    : execMaybeGit(["rev-parse", "REBASE_HEAD"]);

  const mergeBase = otherRef ? execMaybeGit(["merge-base", "HEAD", otherRef]) : null;
  const oursRange = mergeBase ? `${mergeBase}..HEAD` : "HEAD";
  const theirsRange = mergeBase && otherRef ? `${mergeBase}..${otherRef}` : (otherRef ?? "");

  const conflictedFiles: ConflictedFile[] = conflictedPaths.map((relativePath) => {
    const absolutePath = join(repoRoot, relativePath);
    return {
      path: relativePath,
      hunks: parseConflictHunks(absolutePath),
      oursCommits: mergeBase ? parseCommitLog(oursRange, relativePath) : [],
      theirsCommits: mergeBase && otherRef ? parseCommitLog(theirsRange, relativePath) : [],
    };
  });

  const output: AnalyzeOutput = {
    operation,
    repoRoot,
    sideSemantics: operation === "rebase"
      ? {
          ours: "upstream/base branch you are rebasing onto",
          theirs: "your branch commit being replayed",
        }
      : {
          ours: "current branch where the merge is running",
          theirs: "incoming branch being merged",
        },
    conflictedFiles,
    contextArtifacts: scanContextArtifacts(repoRoot),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
