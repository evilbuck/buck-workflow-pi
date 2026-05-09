import { existsSync, readFileSync } from "node:fs";
import type { ChunkQueueItem } from "./types.js";

export interface VerificationResult {
  type: "CHUNK_VERIFIED" | "CHUNK_WARNINGS" | "CHUNK_BLOCKED" | "CHUNK_FAILED";
  chunkId: string;
  status: ChunkQueueItem["status"];
  reason?: string;
  warnings?: string[];
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

  if (status === "blocked") {
    return {
      type: "CHUNK_BLOCKED",
      chunkId,
      status: "blocked",
      reason: fm.block_reason ?? "Worker reported blocked status",
    };
  }

  if (status === "failed") {
    return {
      type: "CHUNK_FAILED",
      chunkId,
      status: "failed",
      reason: `Worker reported failed status. Missed criteria: ${missed.join(", ")}`,
    };
  }

  if (warnings.length > 0 || missed.length > 0) {
    return {
      type: "CHUNK_WARNINGS",
      chunkId,
      status: "completed_with_warnings",
      warnings: [...warnings, ...missed.map((m: string) => `Missed: ${m}`)],
    };
  }

  return {
    type: "CHUNK_VERIFIED",
    chunkId,
    status: "completed",
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
