import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import type { ChunkQueueItem, BuckMachineEvent } from "./types.js";

export interface WorkerOptions {
  projectRoot: string;
  subject: string | null;
  goal: string;
  timeoutMs?: number;
  model?: string;
}

export interface WorkerResult {
  type: "WORKER_COMPLETED" | "WORKER_FAILED";
  resultFile?: string;
  status?: string;
  error?: string;
  exitCode?: number;
}

/**
 * Default worker implementation: spawns `pi -p` as a subprocess.
 * For testing, inject a custom runFn via options.
 */
export async function runWorker(
  chunk: ChunkQueueItem,
  options: WorkerOptions,
): Promise<WorkerResult> {
  const { projectRoot, subject, goal, timeoutMs = 600_000, model } = options;

  const resultDir = subject
    ? join(projectRoot, ".context", subject, "worker-results")
    : join(projectRoot, ".context", "workflow", "worker-results");

  if (!existsSync(resultDir)) {
    mkdirSync(resultDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = basename(chunk.path, ".md").replace(/[^a-z0-9_-]/gi, "-");
  const resultFile = join(resultDir, `${timestamp}-${chunk.type}-${slug}.md`);

  // Write worker audit
  const auditDir = subject
    ? join(projectRoot, ".context", subject, "worker-audits")
    : join(projectRoot, ".context", "workflow", "worker-audits");
  if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
  const auditFile = join(auditDir, `${timestamp}-${chunk.id}-audit.json`);

  let audit: Record<string, unknown> = {
    chunkId: chunk.id,
    chunkType: chunk.type,
    chunkPath: chunk.path,
    startedAt: new Date().toISOString(),
    model: model ?? "default",
    resultFile,
  };
  writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n", "utf-8");

  // Build prompt for worker
  const prompt = buildWorkerPrompt(chunk, goal, resultFile);
  const promptFile = join(resultDir, `.prompt-${chunk.id}.md`);
  writeFileSync(promptFile, prompt, "utf-8");

  // Spawn worker subprocess
  const args = ["-p", "--no-session", `@${promptFile}`];
  if (model) args.push("--model", model);

  return new Promise<WorkerResult>((resolve) => {
    const child = spawn("pi", args, { cwd: projectRoot });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => { stderr += d; });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        type: "WORKER_FAILED",
        error: `Worker timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeout);

      // Update audit with completion data
      try {
        audit = { ...audit, completedAt: new Date().toISOString(), exitCode: code };
        writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n", "utf-8");
      } catch { /* ignore */ }

      // Cleanup prompt file
      try { unlinkSync(promptFile); } catch { /* ignore */ }

      // Check if result file was written
      if (existsSync(resultFile)) {
        resolve({
          type: "WORKER_COMPLETED",
          resultFile,
          status: "completed",
        });
        return;
      }

      // Result file missing → failure
      resolve({
        type: "WORKER_FAILED",
        error: stderr || stdout || `Worker exited with code ${code}`,
        exitCode: code ?? undefined,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        type: "WORKER_FAILED",
        error: err.message,
      });
    });
  });
}

function buildWorkerPrompt(
  chunk: ChunkQueueItem,
  goal: string,
  resultFile: string,
): string {
  return `You are a Buck workflow worker. Execute exactly one chunk of work.

## Goal
${goal}

## Chunk
- ID: ${chunk.id}
- Type: ${chunk.type}
- File: ${chunk.path}

## Instructions
1. Read the chunk file to understand what needs to be done
2. Execute the work using available tools
3. Write a result file to: ${resultFile}

## Result File Format
\`\`\`markdown
---
chunk_id: ${chunk.id}
chunk_type: ${chunk.type}
status: completed | completed_with_warnings | failed | blocked
started_at: <ISO timestamp>
completed_at: <ISO timestamp>
worker_attempt: <N>
model_used: <model id>
changed_files: [list]
acceptance_criteria_met: [list]
acceptance_criteria_missed: [list]
warnings: [list]
block_reason: <reason if blocked>
---

# Worker Result: <chunk name>

## Summary
<one paragraph>

## What was done
<details>

## Verification
<details>
\`\`\`

Write the result file now.
`;
}
