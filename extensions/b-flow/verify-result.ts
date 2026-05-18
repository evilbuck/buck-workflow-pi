import { existsSync, readFileSync } from "node:fs";
import type { ChunkQueueItem, ReviewResult, ReviewOutcome, WorkerMode } from "./types.js";

export interface VerificationResult {
  type: "CHUNK_VERIFIED" | "CHUNK_WARNINGS" | "CHUNK_BLOCKED" | "CHUNK_FAILED";
  chunkId: string;
  status: ChunkQueueItem["status"];
  mode?: WorkerMode;
  reason?: string;
  warnings?: string[];
  review?: ReviewResult;
  changedFiles?: string[];
  iterateArtifact?: string;
  iterateStatus?: string;
}

export function verifyResult(resultFile: string): VerificationResult {
  if (!existsSync(resultFile)) {
    return {
      type: "CHUNK_FAILED",
      chunkId: "unknown",
      status: "failed",
      reason: `Result file not found: ${resultFile}`,
    };
  }

  let content: string;
  try {
    content = readFileSync(resultFile, "utf-8");
  } catch (err) {
    return {
      type: "CHUNK_FAILED",
      chunkId: "unknown",
      status: "failed",
      reason: `Failed to read result file: ${err}`,
    };
  }

  // Parse frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return {
      type: "CHUNK_FAILED",
      chunkId: "unknown",
      status: "failed",
      reason: "Result file missing YAML frontmatter",
    };
  }

  const fm = parseFrontmatter(fmMatch[1]);
  const chunkId = fm.chunk_id ?? "unknown";
  const status = fm.status ?? "failed";
  const warnings = fm.warnings ?? [];
  const missed = fm.acceptance_criteria_missed ?? [];
  const changedFiles = Array.isArray(fm.changed_files) ? fm.changed_files : [];
  const iterateArtifact = typeof fm.iterate_artifact === "string" ? fm.iterate_artifact : undefined;
  const iterateStatus = typeof fm.iterate_status === "string" ? fm.iterate_status : undefined;

  // --- Review-specific parsing ---
  const review = parseReviewFromFrontmatter(fm);

  if (status === "blocked") {
    return {
      type: "CHUNK_BLOCKED",
      chunkId,
      status: "blocked",
      mode: fm.mode,
      reason: fm.block_reason ?? review?.parseError ?? "Worker reported blocked status",
      review,
      changedFiles,
      iterateArtifact,
      iterateStatus,
    };
  }

  if (status === "failed") {
    return {
      type: "CHUNK_FAILED",
      chunkId,
      status: "failed",
      mode: fm.mode,
      reason: review?.parseError ?? `Worker reported failed status. Missed criteria: ${missed.join(", ")}`,
      review,
      changedFiles,
      iterateArtifact,
      iterateStatus,
    };
  }

  if (warnings.length > 0 || missed.length > 0) {
    return {
      type: "CHUNK_WARNINGS",
      chunkId,
      status: "completed_with_warnings",
      mode: fm.mode,
      warnings: [...warnings, ...missed.map((m: string) => `Missed: ${m}`)],
      review,
      changedFiles,
      iterateArtifact,
      iterateStatus,
    };
  }

  return {
    type: "CHUNK_VERIFIED",
    chunkId,
    status: "completed",
    mode: fm.mode,
    review,
    changedFiles,
    iterateArtifact,
    iterateStatus,
  };
}

/**
 * Parse review-specific fields from worker result frontmatter.
 * Returns undefined if no review fields are present (non-review worker result).
 * Returns a ReviewResult with outcome="blocking" if review fields are inconsistent or incomplete.
 */
export function parseReviewFromFrontmatter(
  fm: Record<string, any>,
): ReviewResult | undefined {
  const hasReviewFields =
    "mode" in fm ||
    "review_passed" in fm ||
    "issues_found" in fm ||
    "requires_replan" in fm;

  if (!hasReviewFields) return undefined;

  const mode = fm.mode as WorkerMode | undefined;

  // If mode is present but not a valid worker mode, treat as blocking
  if (
    mode !== undefined &&
    !["build", "review", "iterate", "save"].includes(mode)
  ) {
    return {
      outcome: "blocking",
      mode: "build", // safe default
      reviewPassed: false,
      issuesFound: false,
      requiresReplan: false,
      parseError: `Invalid worker mode in result frontmatter: ${String(mode)}`,
    };
  }

  // Missing critical review fields when mode is review → blocking
  if (
    mode === "review" &&
    (fm.review_passed === undefined || fm.issues_found === undefined)
  ) {
    const missing = [
      fm.review_passed === undefined ? "review_passed" : null,
      fm.issues_found === undefined ? "issues_found" : null,
    ].filter(Boolean).join(", ");
    return {
      outcome: "blocking",
      mode: "review",
      reviewPassed: false,
      issuesFound: false,
      requiresReplan: fm.requires_replan === "true" || fm.requires_replan === true,
      parseError: `Review result missing required fields: ${missing}`,
    };
  }

  const reviewPassed =
    fm.review_passed === "true" || fm.review_passed === true;
  const issuesFound =
    fm.issues_found === "true" || fm.issues_found === true;
  const requiresReplan =
    fm.requires_replan === "true" || fm.requires_replan === true;
  const iterateFile = fm.iterate_file ?? undefined;
  const issueFingerprint = fm.issue_fingerprint ?? undefined;

  let outcome: ReviewOutcome;
  if (reviewPassed) {
    outcome = "pass";
  } else if (requiresReplan) {
    outcome = "requires-replan";
  } else if (issuesFound && iterateFile) {
    outcome = "issues-with-iterate";
  } else if (issuesFound) {
    outcome = "blocking";
  } else {
    outcome = "blocking";
  }

  const parseError = outcome === "blocking"
    ? issuesFound && !iterateFile
      ? "Review reported issues but did not provide iterate_file"
      : "Review result fields did not describe a valid routing outcome"
    : undefined;

  return {
    outcome,
    mode: mode ?? "build",
    reviewPassed,
    issuesFound,
    requiresReplan,
    iterateFile,
    issueFingerprint,
    parseError,
  };
}

function parseFrontmatter(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = raw.split("\n");
  let currentKey: string | null = null;

  for (const line of lines) {
    // Array syntax: key: [item1, item2]
    const arrayMatch = line.match(/^(\w+):\s*\[(.*)\]\s*$/);
    if (arrayMatch) {
      const key = arrayMatch[1];
      const items = arrayMatch[2]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      result[key] = items;
      currentKey = null;
      continue;
    }

    // Start of multi-line array
    const arrayStartMatch = line.match(/^(\w+):\s*\[/);
    if (arrayStartMatch && !line.includes("]")) {
      currentKey = arrayStartMatch[1];
      result[currentKey] = [];
      continue;
    }

    // Array item
    if (currentKey && line.trim().startsWith("- ")) {
      result[currentKey].push(line.trim().slice(2).trim());
      continue;
    }

    // End of multi-line array
    if (currentKey && line.trim() === "]") {
      currentKey = null;
      continue;
    }

    // Simple key: value
    const simpleMatch = line.match(/^(\w+):\s*(.+)$/);
    if (simpleMatch) {
      result[simpleMatch[1]] = simpleMatch[2].trim();
      currentKey = null;
    }
  }

  return result;
}
