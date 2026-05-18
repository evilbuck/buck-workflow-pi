import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import type { ChunkQueueItem, BuckMachineEvent, WorkerMode } from "./types.js";

export interface WorkerOptions {
  projectRoot: string;
  subject: string | null;
  goal: string;
  /** Worker mode determines which skill prompt to use. Defaults to "build". */
  mode?: WorkerMode;
  /** Mode-specific input path (e.g. plan file for review, iterate file for iterate). */
  inputPath?: string;
  /** Optional phase difficulty — used to select b-build-hard for hard phases in build mode. */
  difficulty?: "easy" | "medium" | "hard";
  timeoutMs?: number;
  model?: string;
  onSpawn?: (meta: {
    pid?: number;
    auditFile: string;
    resultFile: string;
    mode: WorkerMode;
  }) => void;
  /** Inject a custom spawn function for testing. */
  spawnFn?: (args: string[], opts: { cwd: string }) => {
    stdout: { on: (evt: string, fn: (d: Buffer) => void) => void };
    stderr: { on: (evt: string, fn: (d: Buffer) => void) => void };
    on: (evt: string, fn: (arg: any) => void) => void;
    kill: (sig: string) => void;
    pid?: number;
  };
}

export interface WorkerResult {
  type: "WORKER_COMPLETED" | "WORKER_FAILED";
  resultFile?: string;
  status?: string;
  error?: string;
  exitCode?: number;
  /** The mode used for this worker invocation. */
  mode?: WorkerMode;
}

/**
 * Run a worker subprocess for a given chunk and mode.
 *
 * Modes:
 * - `build`: Loads b-build skill instructions.
 * - `review`: Loads b-review skill instructions with the plan/phase acceptance contract.
 * - `iterate`: Loads b-iterate skill instructions with the active iterate artifact.
 * - `save`: Loads a minimal save-equivalent contract (no dedicated b-save skill yet).
 */
export async function runWorker(
  chunk: ChunkQueueItem,
  options: WorkerOptions,
): Promise<WorkerResult> {
  const {
    projectRoot,
    subject,
    goal,
    mode = "build",
    inputPath,
    difficulty,
    timeoutMs = 600_000,
    model,
    onSpawn,
    spawnFn,
  } = options;

  const resultDir = subject
    ? join(projectRoot, ".context", subject, "worker-results")
    : join(projectRoot, ".context", "workflow", "worker-results");

  if (!existsSync(resultDir)) {
    mkdirSync(resultDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = basename(chunk.path, ".md").replace(/[^a-z0-9_-]/gi, "-");
  const resultFile = join(resultDir, `${timestamp}-${mode}-${chunk.type}-${slug}.md`);

  // Write worker audit
  const auditDir = subject
    ? join(projectRoot, ".context", subject, "worker-audits")
    : join(projectRoot, ".context", "workflow", "worker-audits");
  if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
  const auditFile = join(auditDir, `${timestamp}-${chunk.id}-audit.json`);

  const startedAt = new Date().toISOString();
  let childPid: number | undefined;

  let audit: Record<string, unknown> = {
    chunkId: chunk.id,
    chunkType: chunk.type,
    chunkPath: chunk.path,
    mode,
    inputPath: inputPath ?? null,
    difficulty: difficulty ?? null,
    startedAt,
    model: model ?? "default",
    resultFile,
  };
  writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n", "utf-8");

  // Build mode-specific prompt
  const prompt = buildWorkerPrompt(chunk, goal, resultFile, mode, inputPath, difficulty);
  const promptFile = join(resultDir, `.prompt-${chunk.id}.md`);
  writeFileSync(promptFile, prompt, "utf-8");

  // Spawn worker subprocess
  const args = ["-p", "--no-session", `@${promptFile}`];
  if (model) args.push("--model", model);

  const spawnChild = spawnFn
    ? () => spawnFn(args, { cwd: projectRoot })
    : () => spawn("pi", args, { cwd: projectRoot });

  return new Promise<WorkerResult>((resolve) => {
    const child = spawnChild();
    childPid = child.pid;

    // Update audit with pid
    try {
      audit = { ...audit, pid: childPid };
      writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n", "utf-8");
      onSpawn?.({ pid: childPid, auditFile, resultFile, mode });
    } catch { /* ignore */ }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => { stdout += d; });
    child.stderr.on("data", (d: Buffer) => { stderr += d; });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        type: "WORKER_FAILED",
        error: `Worker timed out after ${timeoutMs}ms`,
        mode,
      });
    }, timeoutMs);

    child.on("close", (code: number | null) => {
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
          mode,
        });
        return;
      }

      // Result file missing → failure
      resolve({
        type: "WORKER_FAILED",
        error: stderr || stdout || `Worker exited with code ${code}`,
        exitCode: code ?? undefined,
        mode,
      });
    });

    child.on("error", (err: Error) => {
      clearTimeout(timeout);
      resolve({
        type: "WORKER_FAILED",
        error: err.message,
        mode,
      });
    });
  });
}

/** Map each worker mode to its Buck skill reference and prompt template. */
function buildWorkerPrompt(
  chunk: ChunkQueueItem,
  goal: string,
  resultFile: string,
  mode: WorkerMode = "build",
  inputPath?: string,
  difficulty?: "easy" | "medium" | "hard",
): string {
  const modeSection = buildModeSection(mode, chunk, inputPath, difficulty);
  const resultFrontmatter = buildExpectedResultFrontmatter(mode, chunk);

  return `You are a Buck workflow worker executing in **${mode}** mode.

## Goal
${goal}

## Chunk
- ID: ${chunk.id}
- Type: ${chunk.type}
- File: ${chunk.path}

${modeSection}
## Result File Format
Write the result file to: ${resultFile}

The result file MUST include this YAML frontmatter:

\`\`\`yaml
${resultFrontmatter}
\`\`\`

Followed by markdown body with:
- **Summary**: one paragraph
- **What was done**: details of execution
- **Verification**: how correctness was confirmed

Write the result file now.
`;
}

function buildModeSection(
  mode: WorkerMode,
  chunk: ChunkQueueItem,
  inputPath?: string,
  difficulty?: "easy" | "medium" | "hard",
): string {
  switch (mode) {
    case "build": {
      const skillRef = difficulty === "hard"
        ? "skills/b-build/SKILL.md (use /b-build-hard for complex phases)"
        : "skills/b-build/SKILL.md";
      return `## Mode: Build

Load and follow the Buck skill: \`${skillRef}\`

1. Read the chunk/phase file to understand implementation requirements.
2. Read related source files and tests before editing.
3. Implement the smallest safe change that satisfies acceptance criteria.
4. Run targeted verification.
5. Write the result file with changed_files, acceptance_criteria_met, and acceptance_criteria_missed.`;
    }
    case "review": {
      const planRef = inputPath
        ? `The plan/phase acceptance contract is at: \`${inputPath}\``
        : "No explicit plan/phase file provided — review against the goal.";
      return `## Mode: Review

Load and follow the Buck skill: \`skills/b-review/SKILL.md\`

${planRef}

1. Review implementation changes for correctness, edge cases, regressions, and workflow compliance.
2. If a plan or phase file is provided, verify against its acceptance criteria.
3. Report review_passed, issues_found, and whether requires_replan is needed.
4. If issues are found, create an iterate artifact with the fix list.`;
    }
    case "iterate": {
      const iterateRef = inputPath
        ? `The active iterate artifact is at: \`${inputPath}\``
        : "No explicit iterate artifact — address issues from the review result.";
      return `## Mode: Iterate

Load and follow the Buck skill: \`skills/b-iterate/SKILL.md\`

${iterateRef}

1. Read the iterate artifact to find the issue list.
2. Apply small, focused fixes in priority order.
3. Re-run lightweight verification.
4. If the iterate artifact has status: active, set it to completed when done.
5. Report what was fixed and verification results.`;
    }
    case "save": {
      return `## Mode: Save

Execute the Buck save workflow:

1. Update the session memory file with consolidated information.
2. Update the phase file frontmatter (status: completed, completed_at).
3. Update the phases overview status table if applicable.
4. Write or update the draft-commit.md artifact.
5. Report changed_files and updated artifacts.`;
    }
  }
}

function buildExpectedResultFrontmatter(
  mode: WorkerMode,
  chunk: ChunkQueueItem,
): string {
  const base = [
    `chunk_id: ${chunk.id}`,
    `chunk_type: ${chunk.type}`,
    `mode: ${mode}`,
    "status: completed | completed_with_warnings | failed | blocked",
    "started_at: <ISO timestamp>",
    "completed_at: <ISO timestamp>",
    "worker_attempt: <N>",
    "model_used: <model id>",
    "changed_files: [list]",
    "acceptance_criteria_met: [list]",
    "acceptance_criteria_missed: [list]",
    "warnings: [list]",
    "block_reason: <reason if blocked>",
  ];

  // Mode-specific frontmatter fields
  switch (mode) {
    case "review":
      base.push(
        "review_passed: <true | false>",
        "issues_found: <true | false>",
        "requires_replan: <true | false>",
        "iterate_file: <path if issues found>",
        "issue_fingerprint: <hash or label>",
      );
      break;
    case "iterate":
      base.push(
        "iterate_artifact: <path of iterate file addressed>",
        "iterate_status: <completed | partial | failed>",
      );
      break;
    case "save":
      base.push(
        "phase_completed: <phase file path>",
        "draft_commit: <path to draft-commit.md>",
      );
      break;
  }

  return base.join("\n");
}

/**
 * Exported for testing: returns the prompt string for a given mode without spawning a worker.
 */
export function getWorkerPrompt(
  chunk: ChunkQueueItem,
  goal: string,
  resultFile: string,
  mode: WorkerMode = "build",
  inputPath?: string,
  difficulty?: "easy" | "medium" | "hard",
): string {
  return buildWorkerPrompt(chunk, goal, resultFile, mode, inputPath, difficulty);
}

/**
 * Exported for testing: returns the audit fields for a given invocation.
 */
export function killWorkerPid(pid: number | null | undefined): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

export function getExpectedAuditFields(
  chunk: ChunkQueueItem,
  mode: WorkerMode,
  inputPath?: string,
  difficulty?: "easy" | "medium" | "hard",
): Record<string, unknown> {
  return {
    chunkId: chunk.id,
    chunkType: chunk.type,
    chunkPath: chunk.path,
    mode,
    inputPath: inputPath ?? null,
    difficulty: difficulty ?? null,
  };
}
