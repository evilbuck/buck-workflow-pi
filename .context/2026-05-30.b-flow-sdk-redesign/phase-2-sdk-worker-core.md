---
status: completed
phase: 2
order: 2
plan: plan-b-flow-sdk-redesign.md
phases_overview: plan-b-flow-sdk-redesign-phases.md
difficulty: hard
model_hint: strongest reasoning model available — SDK API unknowns, resource lifecycle management, result synthesis
buck_hint: /b-build-hard
ralph_complexity: multi
goal: "Implement the full SDK-driven worker replacing the stub, with session lifecycle, model selection, tool scoping, and result synthesis compatible with verifyResult."
files:
  - extensions/b-flow/sdk-worker.ts
from_plan_steps: [3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] runSDKWorker creates an isolated AgentSession via createAgentSession()"
  - "[x] Model selection: difficulty → fallback array using getModel(), first available wins"
  - "[x] Tool scoping: iterate/review → read-only set; build → full coding set"
  - "[x] Session lifecycle: subscribe → prompt → extract result → dispose (always in finally)"
  - "[x] Error/timeout paths: abort() then dispose() called before returning WORKER_FAILED"
  - "[x] Result synthesis: resultFile written with YAML frontmatter parseable by verifyResult"
  - "[x] Audit JSON written with same shape and location as subprocess worker"
  - "[x] changedFiles extracted from toolCalls (edit/write tool names)"
  - "[x] tsc --noEmit passes"
completed_at: '2026-05-30'
completed_by: b-build-standard
---

# Phase 2: SDK Worker Core

## Context

This is the core implementation phase. We replace the Phase 1 stub with the full SDK-driven worker that uses `createAgentSession()` from `@mariozechner/pi-coding-agent`. The worker must be functionally compatible with the subprocess worker — it returns the same `WorkerResult` shape, writes result files in the same format that `verifyResult` expects, and produces audit JSON files in the same locations.

**Why this is Phase 2**: Depends on Phase 1 types and dispatch. This is the highest-risk phase (SDK API behavior, session resource management, result synthesis correctness).

## Implementation Details

Replace the entire stub `sdk-worker.ts` with the full implementation (~120-180 LOC).

### Imports

```typescript
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createAgentSession, SessionManager, SettingsManager } from "@mariozechner/pi-coding-agent";
import type { ChunkQueueItem } from "./types.js";
import type { WorkerOptions, WorkerResult } from "./worker.js";
```

**Note on `getModel`**: The architecture review references `getModel` from `@mariozechner/pi-ai`. Check whether this import is available in the current workspace. If not, pass model IDs as strings and let `createAgentSession` resolve them. Check existing extensions for import patterns:

```bash
grep -r "getModel\|from.*pi-ai" extensions/ --include="*.ts"
grep -r "createAgentSession" extensions/ --include="*.ts"
```

### Model Selection

```typescript
const BUCK_MODEL_MAPPING: Record<string, string[]> = {
  easy:   ["anthropic/claude-haiku-4-20250414", "openai/gpt-4o-mini"],
  medium: ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o"],
  hard:   ["anthropic/claude-opus-4-20250514", "anthropic/claude-sonnet-4-20250514"],
};
```

Use a `selectModel(difficulty, override?)` function. If `getModel` from `@mariozechner/pi-ai` is available, use it with fallback chain. Otherwise, pass the model ID string directly to `createAgentSession({ model })` and let the SDK resolve availability.

**Important**: Verify the actual model IDs currently used in the project. Check `docs/buck-workflow.md` or existing config for current IDs. The ones listed above are from the plan — confirm they're current.

### Tool Scoping

```typescript
const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"];
const FULL_TOOLS = ["read", "bash", "edit", "write"];

function selectTools(chunk: ChunkQueueItem): string[] {
  // iterate/review chunks: read-only (no mutations)
  if (chunk.type === "iterate") {
    return READ_ONLY_TOOLS;
  }
  // phase/task/backlog chunks: full coding toolset
  return FULL_TOOLS;
}
```

**Important**: Verify the actual tool names by checking the Pi SDK's tool registry or examples. The names `read`, `grep`, `find`, `ls`, `bash`, `edit`, `write` are from the plan — confirm they match SDK expectations.

### Prompt Construction

Build a simpler prompt than the subprocess version. No `resultFile` mention in the prompt (the SDK worker writes the result file itself after extracting from session state):

```typescript
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
```

### Result Synthesis

This is the trickiest part. The result file must have YAML frontmatter that `verifyResult` can parse. Study `verify-result.ts` to understand the expected format:

**Expected frontmatter fields** (from verify-result.ts):
- `chunk_id`: string
- `chunk_type`: string
- `status`: "completed" | "completed_with_warnings" | "failed" | "blocked"
- `started_at`: ISO timestamp
- `completed_at`: ISO timestamp
- `changed_files`: array
- `acceptance_criteria_met`: array
- `acceptance_criteria_missed`: array
- `warnings`: array

```typescript
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
changed_files: [${changedFiles.map(f => `"${f}"`).join(", ")}]
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
```

**Key constraint**: The `verifyResult` function parses frontmatter with a custom parser (not a YAML library). Keep the frontmatter simple:
- No nested objects
- Arrays use `[item1, item2]` syntax (single line) — the parser handles this
- Strings don't need quoting unless they contain special chars

### Session Lifecycle (Critical)

```typescript
export async function runSDKWorker(
  chunk: ChunkQueueItem,
  options: WorkerOptions,
): Promise<WorkerResult> {
  const { projectRoot, subject, goal, timeoutMs = 600_000 } = options;
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

  // Write initial audit
  writeFileSync(auditFile, JSON.stringify({
    chunkId: chunk.id,
    chunkType: chunk.type,
    chunkPath: chunk.path,
    startedAt,
    workerType: "sdk",
    resultFile,
  }, null, 2) + "\n", "utf-8");

  // Create session
  const model = selectModel(chunk.difficulty, options.model);
  const tools = selectTools(chunk);

  const { session } = await createAgentSession({
    cwd: projectRoot,
    sessionManager: SessionManager.inMemory(projectRoot),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 2 },
    }),
    ...(model ? { model } : {}),
    thinkingLevel: "off",
    tools,
  });

  const toolCalls: Array<{ name: string; input: unknown }> = [];

  session.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      toolCalls.push({ name: event.toolName, input: event.input });
    }
  });

  const prompt = buildChunkPrompt(chunk, goal);

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Worker timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    await Promise.race([session.prompt(prompt), timeout]);

    const completedAt = new Date().toISOString();
    const lastAssistantMessage = extractLastAssistantMessage(session.messages);
    const resultMarkdown = synthesizeResultMarkdown(
      chunk, toolCalls, lastAssistantMessage, startedAt, completedAt,
    );

    // Write result file (same format as subprocess)
    writeFileSync(resultFile, resultMarkdown, "utf-8");

    // Update audit with completion
    writeFileSync(auditFile, JSON.stringify({
      chunkId: chunk.id,
      chunkType: chunk.type,
      chunkPath: chunk.path,
      startedAt,
      completedAt,
      workerType: "sdk",
      resultFile,
      toolCallCount: toolCalls.length,
      changedFiles: extractChangedFiles(toolCalls),
    }, null, 2) + "\n", "utf-8");

    return {
      type: "WORKER_COMPLETED",
      resultFile,
      status: "completed",
      toolCalls,
      messageCount: session.messages.length,
      changedFiles: extractChangedFiles(toolCalls),
    };
  } catch (err) {
    await session.abort();
    return {
      type: "WORKER_FAILED",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    session.dispose();
  }
}
```

### Helper Functions

```typescript
function extractChangedFiles(toolCalls: Array<{ name: string; input: unknown }>): string[] {
  return toolCalls
    .filter(t => t.name === "edit" || t.name === "write")
    .map(t => (t.input as Record<string, unknown>)?.path ?? "")
    .filter(Boolean);
}

function extractLastAssistantMessage(messages: any[]): string {
  // Walk messages in reverse to find last assistant text content
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && typeof m.content === "string" && m.content.trim()) {
      return m.content.trim().slice(0, 2000); // cap summary length
    }
  }
  return "";
}
```

## Risks

1. **SDK API surprises**: `createAgentSession` options, event types, or `session.messages` shape may differ from documented examples. **Mitigation**: Read SDK examples in `node_modules/@mariozechner/pi-coding-agent/examples/` before writing code.

2. **Resource leaks**: `session.dispose()` may not fully clean up. **Mitigation**: Strict `finally { dispose() }` pattern with `abort()` on error paths.

3. **verifyResult compatibility**: Synthesized markdown must pass the custom frontmatter parser. **Mitigation**: Write a simple test that calls `verifyResult` on the synthesized output.

4. **Model ID currency**: Hardcoded model IDs may be stale. **Mitigation**: Check current IDs before implementing; use fallback arrays.

5. **Event type names**: `tool_execution_start` may not be the actual event type name. **Mitigation**: Check SDK source or examples for actual event type strings.

## Verification

```bash
# Type check (after replacing stub)
pnpm tsc --noEmit

# Quick smoke: import resolves
node -e "require('./extensions/b-flow/sdk-worker.js')" 2>&1 || echo "Import check"

# Note: Full verification via tests happens in Phase 3
```

The key manual verification for this phase: the synthesized result markdown should be parseable by `verifyResult`. Write a quick ad-hoc test or manually check the format.

## Ralph Mini-Cycle Instructions

If executing this phase inside a Ralph loop:
1. Run `/b-build-hard` for this phase (hard difficulty — SDK API unknowns justify stronger reasoning).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` before calling `ralph_done`; if the phase is incomplete, leave `status: in-progress` so the next Ralph iteration resumes here.
