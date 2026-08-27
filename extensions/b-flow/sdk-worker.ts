/**
 * SDK-based worker using createAgentSession() against OMP's catalog.
 *
 * Replaces the subprocess worker with an in-process SDK session that:
 * - Creates an isolated AgentSession per chunk
 * - Selects model from OMP modelRoles by chunk difficulty
 * - Scopes tools (read-only for iterate, full coding for build)
 * - Captures tool calls and extracts changed files
 * - Writes result/audit files compatible with verifyResult
 * - Guarantees session.dispose() via finally block
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import {
  createAgentSession,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";
import type { ChunkQueueItem } from "./types.js";
import type { WorkerOptions, WorkerResult } from "./worker.js";
import { mappingFromOmpRoles, ompAgentDir } from "../omp-models.js";

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

function selectModelPattern(
  projectRoot: string,
  difficulty: string | undefined,
  override?: string,
): { pattern?: string; label: string } {
  if (override) return { pattern: override, label: override };
  const mapping = mappingFromOmpRoles(projectRoot);
  const tier = difficulty === "easy" || difficulty === "hard" ? difficulty : "medium";
  const pattern = mapping?.[tier];
  return { pattern, label: pattern ?? `omp:${tier}` };
}


// ---------------------------------------------------------------------------
// Tool scoping
// ---------------------------------------------------------------------------

const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"];
const FULL_CODING_TOOLS = ["read", "bash", "edit", "write"];

/**
 * Select tools based on chunk type.
 * Iterate/review chunks get read-only tools to prevent mutations.
 * Build chunks (phase/task/backlog) get the full coding toolset.
 */
function selectTools(chunk: ChunkQueueItem): string[] {
  if (chunk.type === "iterate") {
    return READ_ONLY_TOOLS;
  }
  return FULL_CODING_TOOLS;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildChunkPrompt(chunk: ChunkQueueItem, goal: string): string {
  return `# Buck Worker: Execute Chunk

## Goal
${goal}

## Chunk
- ID: ${chunk.id}
- Type: ${chunk.type}
- File: ${chunk.path}

## Instructions
1. Read the chunk file to understand what needs to be done.
2. Execute the work using available tools.
3. When done, report a summary of what you did and what files changed.`;
}

// ---------------------------------------------------------------------------
// Result synthesis
// ---------------------------------------------------------------------------

/**
 * Extract changed files from tool call trace.
 * Only edit and write tools produce file mutations.
 */
function extractChangedFiles(
  toolCalls: Array<{ name: string; input: unknown }>,
): string[] {
  return toolCalls
    .filter((t) => t.name === "edit" || t.name === "write")
    .map((t) => ((t.input as Record<string, unknown>)?.path as string) ?? "")
    .filter(Boolean);
}

/**
 * Get the last assistant text message from the session.
 */
function extractLastAssistantMessage(messages: Array<{ role?: string; content?: string | Array<{ type: string }> }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && typeof m.content === "string" && m.content.trim()) {
      return m.content.trim().slice(0, 2000);
    }
  }
  return "";
}

/**
 * Synthesize result markdown with YAML frontmatter compatible with verifyResult.
 *
 * Keep frontmatter simple: no nested objects, arrays on single lines using [item1, item2] syntax.
 */
function synthesizeResultMarkdown(
  chunk: ChunkQueueItem,
  toolCalls: Array<{ name: string; input: unknown }>,
  lastAssistantMessage: string,
  startedAt: string,
  completedAt: string,
): string {
  const changedFiles = extractChangedFiles(toolCalls);

  return `---
chunk_id: ${chunk.id}
chunk_type: ${chunk.type}
status: completed
started_at: ${startedAt}
completed_at: ${completedAt}
worker_attempt: 1
model_used: sdk-worker
changed_files: [${changedFiles.map((f) => `"${f}"`).join(", ")}]
acceptance_criteria_met: []
acceptance_criteria_missed: []
warnings: []
---

# Worker Result: ${basename(chunk.path, ".md")}

## Summary
${lastAssistantMessage || "Worker completed successfully."}

## What was done
Executed chunk using SDK worker session.

## Verification
Tool calls: ${toolCalls.length}. Changed files: ${changedFiles.length}.
`;
}

function writeAudit(
  auditFile: string,
  data: Record<string, unknown>,
): void {
  writeFileSync(auditFile, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Worker implementation
// ---------------------------------------------------------------------------

export async function runSDKWorker(
  chunk: ChunkQueueItem,
  options: WorkerOptions,
): Promise<WorkerResult> {
  const { projectRoot, subject, goal, timeoutMs = 600_000, model: modelOverride } = options;
  const startedAt = new Date().toISOString();

  // Compute result/audit paths (same logic as subprocess worker)
  const resultDir = subject
    ? join(projectRoot, ".context", subject, "worker-results")
    : join(projectRoot, ".context", "workflow", "worker-results");
  if (!existsSync(resultDir)) mkdirSync(resultDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = basename(chunk.path, ".md").replace(/[^a-z0-9_-]/gi, "-");
  const resultFile = join(resultDir, `${timestamp}-${chunk.type}-${slug}.md`);

  const auditDir = subject
    ? join(projectRoot, ".context", subject, "worker-audits")
    : join(projectRoot, ".context", "workflow", "worker-audits");
  if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
  const auditFile = join(auditDir, `${timestamp}-${chunk.id}-audit.json`);

  const selectedModel = selectModelPattern(projectRoot, chunk.difficulty, modelOverride);
  const auditBase = {
    chunkId: chunk.id,
    chunkType: chunk.type,
    chunkPath: chunk.path,
    startedAt,
    model: selectedModel.label,
    resultFile,
  };

  writeAudit(auditFile, auditBase);

  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | null = null;
  const toolCalls: Array<{ name: string; input: unknown }> = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const tools = selectTools(chunk);

    const sessionOpts: Parameters<typeof createAgentSession>[0] & {
      agentDir?: string;
      modelPattern?: string;
    } = {
      cwd: projectRoot,
      agentDir: ompAgentDir(),
      thinkingLevel: "off",
      tools,
      sessionManager: SessionManager.inMemory(projectRoot),
      settingsManager: SettingsManager.inMemory({
        compaction: { enabled: false },
        retry: { enabled: true, maxRetries: 2 },
      }),
    };
    if (selectedModel.pattern) sessionOpts.modelPattern = selectedModel.pattern;
    const created = await createAgentSession(sessionOpts);

    session = created.session;

    session.subscribe((event) => {
      if (event.type === "tool_execution_start") {
        toolCalls.push({
          name: event.toolName,
          input: event.args,
        });
      }
    });

    const prompt = buildChunkPrompt(chunk, goal);

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Worker timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    await Promise.race([session.prompt(prompt), timeout]);
    if (timer) clearTimeout(timer);

    const completedAt = new Date().toISOString();
    const lastAssistantMessage = extractLastAssistantMessage(session.messages);
    const resultMarkdown = synthesizeResultMarkdown(
      chunk,
      toolCalls,
      lastAssistantMessage,
      startedAt,
      completedAt,
    );

    writeFileSync(resultFile, resultMarkdown, "utf-8");

    const changedFiles = extractChangedFiles(toolCalls);
    writeAudit(auditFile, {
      ...auditBase,
      completedAt,
      exitCode: 0,
      workerType: "sdk",
      toolCallCount: toolCalls.length,
      changedFiles,
    });

    return {
      type: "WORKER_COMPLETED",
      resultFile,
      status: "completed",
      toolCalls,
      messageCount: session.messages.length,
      changedFiles,
    };
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (session) {
      await session.abort();
    }

    const completedAt = new Date().toISOString();
    const errorMessage = err instanceof Error ? err.message : String(err);
    writeAudit(auditFile, {
      ...auditBase,
      completedAt,
      exitCode: 1,
      workerType: "sdk",
      toolCallCount: toolCalls.length,
      changedFiles: extractChangedFiles(toolCalls),
      error: errorMessage,
    });

    return {
      type: "WORKER_FAILED",
      error: errorMessage,
    };
  } finally {
    session?.dispose();
  }
}
