/**
 * Programmatic checkpoint commit for b-flow.
 *
 * Fires on `reviewing → saving` state transitions (review passed, about to save).
 * Reads the draft commit message from the active subject folder, runs `git commit`,
 * then cleans up the draft file by staging + amending it.
 *
 * No AI involved — purely mechanical state transition.
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface CheckpointOptions {
  projectRoot: string;
  subject?: string | null;
  phaseLabel?: string;
}

export function createCheckpointCommit(opts: CheckpointOptions): {
  success: boolean;
  commitHash?: string;
  message?: string;
  skipped?: boolean;
  error?: string;
} {
  const { projectRoot, phaseLabel, subject } = opts;

  // 1. Find the active subject folder — prefer explicit subject, fallback to latest by mtime
  let subjectDir: string | undefined;
  if (subject) {
    const candidate = join(".context", subject);
    if (existsSync(join(projectRoot, candidate))) {
      subjectDir = candidate;
    }
  }
  if (!subjectDir) {
    try {
      const lsOutput = execSync("ls -td .context/????-??-??.*/ 2>/dev/null | head -1", {
        cwd: projectRoot,
        encoding: "utf-8",
      }).trim();
      if (!lsOutput) {
        return { success: false, skipped: true, error: "No subject folder found" };
      }
      subjectDir = lsOutput;
    } catch {
      return { success: false, skipped: true, error: "No subject folder found" };
    }
  }

  // 2. Check protected branch
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
    }).trim();
    if (branch === "main" || branch === "master" || branch === "develop") {
      return {
        success: false,
        skipped: true,
        error: `Cannot checkpoint on protected branch '${branch}'`,
      };
    }
  } catch {
    return { success: false, skipped: true, error: "Not a git repository" };
  }

  // 3. Read draft message
  const draftPath = join(projectRoot, subjectDir, "draft-commit.md");
  const draftPathRoot = join(projectRoot, ".context", "draft-commit.md");
  const draft = (existsSync(draftPath) ? readFileSync(draftPath, "utf-8") : null)
    ?? (existsSync(draftPathRoot) ? readFileSync(draftPathRoot, "utf-8") : null);

  if (!draft || !draft.trim()) {
    return { success: false, skipped: true, error: "No draft-commit.md found" };
  }

  // 4. Parse title and body from draft
  const titleMatch = draft.match(/^##\s+Title\s*\n([^\n]+)/m);
  const bodyMatch = draft.match(/^##\s+Body\s*\n([\s\S]+?)(?=\n##|\n---|$)/m);

  const title = titleMatch?.[1]?.trim() ?? "checkpoint: unspecified";
  const body = bodyMatch?.[1]?.trim() ?? "";
  const checkpointMarker = phaseLabel ? `[checkpoint] ${phaseLabel}` : "[checkpoint] b-flow reviewing → saving";

  // 5. Stage tracked changes only (modified/deleted, not untracked)
  //    -u avoids staging unrelated untracked files the user may have
  try {
    execSync("git add -u", { cwd: projectRoot });
  } catch {
    return { success: false, error: "Failed to stage changes" };
  }

  // 6. Check if anything is staged
  const stagedOutput = execSync("git diff --cached --name-only", {
    cwd: projectRoot,
    encoding: "utf-8",
  }).trim();
  if (!stagedOutput) {
    return { success: false, skipped: true, error: "No staged changes — nothing to commit" };
  }

  // 7. Commit with checkpoint marker (using temp file to avoid shell injection)
  let commitHash: string;
  try {
    const fullBody = body ? `${body}\n\n${checkpointMarker}` : checkpointMarker;
    const msgFilePath = join(tmpdir(), `b-checkpoint-msg-${Date.now()}.txt`);
    writeFileSync(msgFilePath, `${title}\n\n${fullBody}`);
    execFileSync("git", ["commit", "-F", msgFilePath], { cwd: projectRoot });
    try { unlinkSync(msgFilePath); } catch { /* best-effort cleanup */ }
    commitHash = execSync("git rev-parse HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
    }).trim();
  } catch (err: any) {
    return { success: false, error: `git commit failed: ${err?.message ?? err}` };
  }

  // 8. Delete draft files
  const draftFiles = [draftPath, draftPathRoot].filter(existsSync);
  for (const f of draftFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }

  // 9. Amend commit to include draft deletion (staging deleted files records the removal)
  if (draftFiles.length > 0) {
    try {
      execSync(`git add ${draftFiles.map((f) => `"${f}"`).join(" ")}`, { cwd: projectRoot });
      execSync("git commit --amend --no-edit", { cwd: projectRoot });
    } catch { /* best-effort */ }
  }

  return {
    success: true,
    commitHash,
    message: `${title}\n\n${checkpointMarker}`,
  };
}
