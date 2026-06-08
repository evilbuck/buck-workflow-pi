# b-flow: Autonomous Workflow Orchestration

> **Status: deprecated / unwired.** `extensions/b-flow/` is retained as
> historical implementation and test code, but the package manifest does not
> load it and the current Buck workflow does not expose `/b-flow` or `/b-next`
> by default. Use `b-plan` + `b-phase` for normal decomposition, and OMP's
> prompt-level primitives (`/goal set`, `orchestrate`, `workflow`) only when a
> plan/phase explicitly recommends `omp_execution`. This page is archival
> reference for the old state machine.

## Historical Design


b-flow is a Pi extension that acts as a **durable workflow supervisor** for Buck. Given a goal, it runs through the Buck workflow states automatically — planning, phasing, building, reviewing, saving — persisting state across context resets and managing workers that execute individual chunks of work.

The old user-facing shape was:

```
/b-flow start "Build the SDK worker feature"
/b-flow run
```

Those commands are not part of the wired package surface today.

## Historical Commands

| Command | Description |
|---------|-------------|
| `/b-flow start <goal>` | Create orchestration state with a goal. Scans `.context/` for existing artifacts and transitions to the appropriate initial state. |
| `/b-flow run` | Start autonomous execution. Continues through the queue, running `--autonomous` mode by default. |
| `/b-flow continue` | Advance one step (sends `RESUME` + `CONTINUE`). Use for guided mode. |
| `/b-flow status` | Show current state, goal, queue progress (completed/total). |
| `/b-flow pause` | Pause execution. State is persisted; resume with `/b-flow resume`. |
| `/b-flow resume` | Resume from paused state. Re-enters the machine at the `recovering` state. |
| `/b-flow stop` | Abort the flow. Clears the actor. Artifacts are preserved on disk. |
| `/b-flow mode guided` | Guided mode — transitions require confirmation (default). |
| `/b-flow mode autonomous` | Autonomous mode — skip safe transitions automatically. |
| `/b-next` | Show the next work item from the queue without starting execution. |

### Status Indicators

- `b-flow: <state> | Goal: <goal> | Queue: <done>/<total>` — shown via `/b-flow status`

### Workflow Injection

b-flow injects a **next-work summary** into the agent's context before each turn (`before_agent_start` hook). This means the agent always knows what the current chunk is, what the queue looks like, and where to find the task file — even after a context compaction or fresh session.

## State Machine

b-flow is powered by an XState v5 state machine. The primary states:

```
idle → recovering → planning → decomposing → executingChunks → reviewing → done
                                                                    ↕
                                                            blocked / aborted
```

### State Descriptions

| State | What happens |
|-------|-------------|
| `idle` | Starting state. No goal set. |
| `recovering` | Re-scans `.context/` for existing artifacts. Resumes from persisted state. |
| `planning` | Scans for plans, phases, tasks. Routes to the next appropriate state. |
| `decomposing` | Creates a chunk queue from phase files, tasks.md, or backlog items. |
| `executingChunks` | Runs the chunk queue — one worker per chunk, sequentially. |
| `reviewing` | All chunks completed. Ready for review or next steps. |
| `done` | Flow complete. |
| `aborted` | User stopped the flow. |
| `paused` | User paused. State persisted. |

### Chunk Queue Execution

When b-flow reaches `executingChunks`, it uses a nested `chunk-queue` machine that:

1. **Builds the queue** from phase files, `tasks.md`, or backlog items
2. **Selects the next pending chunk** and marks it `in-progress`
3. **Spawns a worker** for that chunk (subprocess or SDK — see below)
4. **Verifies the result** via `verifyResult`
5. **Repeats** until queue is exhausted or a chunk fails

Each chunk gets up to **2 retry attempts** on failure before the queue blocks.

### Task Sources

The queue pulls work from these sources (in priority order):

| Source | File Pattern | Unit of Work |
|--------|-------------|--------------|
| Active phase files | `phase-N-*.md` (status: `active` or `pending`) | One phase |
| Subject `tasks.md` | `tasks.md` with `- [ ]` items | One unchecked task |
| Backlog items | `.context/backlog/todo.md` + `items/*.md` | One backlog item |

## Worker Paths

b-flow supports two worker backends for executing chunks. The worker is selected by the `BFLOW_USE_SDK_WORKER` environment variable.

### Subprocess Worker (default)

The original worker. Spawns `pi -p --no-session` as a child process.

**Behavior**:
- Writes a prompt file to `.context/<subject>/worker-results/.prompt-<id>.md`
- Spawns `pi` with the prompt file
- Waits for the child process to write a result file
- Cleans up the prompt file after completion

**Pros**: Battle-tested, full isolation, inherits all Pi capabilities.

**Cons**: High startup overhead (~2-5s per chunk), no real-time event streaming, child process management complexity.

### SDK Worker (`BFLOW_USE_SDK_WORKER=1`)

The new in-process worker. Calls `createAgentSession()` from the Pi SDK directly, no subprocess.

**Behavior**:
- Creates an isolated `AgentSession` per chunk
- Selects a model based on chunk difficulty tier (with fallback chain)
- Scopes tools: read-only for `iterate` chunks, full coding set for `build` chunks
- Captures tool calls and extracts changed files
- Writes result and audit files compatible with `verifyResult`
- Guarantees `session.dispose()` via `finally` block

**Pros**: Near-zero startup overhead (~50ms vs 2-5s), real-time event streaming, `session.abort()` + `dispose()` lifecycle, per-chunk model selection, tool scoping.

**Cons**: Preview status, requires auth credentials to be available in the parent Pi process.

### Enabling the SDK Worker

Set the environment variable before launching Pi:

```bash
export BFLOW_USE_SDK_WORKER=1
pi
```

Or inline:

```bash
BFLOW_USE_SDK_WORKER=1 pi
```

Then use b-flow as normal. The dispatch is transparent to the state machine and queue — `runWorker()` checks the flag and routes accordingly.

### Verifying Which Worker Ran

Check the audit JSON files:

```bash
cat .context/<subject>/worker-audits/*.json | grep workerType
```

- `"workerType": "sdk"` → SDK path
- No `workerType` field → subprocess path (default)

### Model Selection (SDK Worker Only)

The SDK worker selects models based on the chunk's difficulty tier:

| Difficulty | Primary | Fallback |
|-----------|---------|----------|
| easy | `anthropic/claude-haiku-4-20250414` | `openai/gpt-4o-mini` |
| medium | `anthropic/claude-sonnet-4-20250514` | `openai/gpt-4o` |
| hard | `anthropic/claude-opus-4-20250514` | `anthropic/claude-sonnet-4-20250514` |

An explicit model override via `options.model` takes priority over difficulty mapping. The fallback chain uses `getModel()` from `@mariozechner/pi-ai` — the first model that resolves wins.

### Tool Scoping (SDK Worker Only)

| Chunk Type | Tools |
|-----------|-------|
| `iterate` | `read`, `grep`, `find`, `ls` (read-only) |
| `phase`, `task`, `backlog` | `read`, `bash`, `edit`, `write` (full coding) |

This prevents iterate/review workers from making unintended mutations.

## Result Files

Both worker paths write the same result file format, consumed by `verifyResult`:

**Location**: `.context/<subject>/worker-results/<timestamp>-<type>-<slug>.md`

**Format**:
```markdown
---
chunk_id: <id>
chunk_type: <type>
status: completed | completed_with_warnings | failed | blocked
started_at: <ISO timestamp>
completed_at: <ISO timestamp>
worker_attempt: <N>
model_used: <model id>
changed_files: [list]
acceptance_criteria_met: [list]
acceptance_criteria_missed: [list]
warnings: [list]
---

# Worker Result: <chunk name>

## Summary
<one paragraph>

## What was done
<details>

## Verification
<details>
```

The result file is parsed by `verifyResult` and drives the chunk queue machine's transitions: `CHUNK_VERIFIED`, `CHUNK_WARNINGS`, `CHUNK_BLOCKED`, or `CHUNK_FAILED`.

## Audit Files

Each chunk execution writes an audit JSON:

**Location**: `.context/<subject>/worker-audits/<timestamp>-<id>-audit.json`

**Fields** (subprocess worker):
```json
{
  "chunkId": "phase-1-types",
  "chunkType": "phase",
  "chunkPath": ".context/2026-05-30.foo/phase-1-types.md",
  "startedAt": "2026-05-30T10:00:00.000Z",
  "completedAt": "2026-05-30T10:05:00.000Z",
  "model": "default",
  "resultFile": ".context/2026-05-30.foo/worker-results/2026-05-30T10-00-00-000Z-phase-types.md",
  "exitCode": 0
}
```

**Additional fields** (SDK worker):
```json
{
  "workerType": "sdk",
  "toolCallCount": 12,
  "changedFiles": ["src/worker.ts", "src/types.ts"]
}
```

## Persistence

b-flow persists two types of state:

| File | Purpose |
|------|---------|
| `.context/workflow/projection.json` | Human-readable state snapshot (goal, current state, queue, subject, history) |
| `.context/workflow/snapshot.json` | XState machine snapshot for full actor restoration |

On Pi startup, b-flow checks for a persisted snapshot. If found, it restores the actor and continues from where it left off. If not, it creates a fresh actor in `idle`.

### Compaction Support

b-flow hooks into `session_before_compact` to inject a compact state summary:

```
## b-flow State Summary
- Goal: <goal>
- State: <state>
- Subject: <subject>
- Queue: <done>/<total> completed
- Last transition: <state>
- Projection: .context/workflow/orchestration.json
```

This ensures the agent retains b-flow awareness even after context compaction.

## Typical Workflows

### Standard Autonomous Run

```
/b-flow start "Add OAuth login with Google and GitHub"
/b-flow run
```

b-flow will:
1. Scan `.context/` for existing artifacts
2. If no plan exists, route to `planning` (wait for user to create one)
3. If plan exists with phases, decompose into chunk queue
4. Execute chunks sequentially via the worker
5. Verify each result
6. Transition to `reviewing` when queue is exhausted

### Guided Execution

```
/b-flow start "Refactor the auth middleware"
/b-flow mode guided
/b-flow continue
```

Advance one step at a time. Check `/b-flow status` between steps.

### Resume After Interruption

```
# Pi restarts or session resets
/b-flow status    # Shows: b-flow: executingChunks | Goal: ... | Queue: 2/5
/b-flow continue  # Picks up from the persisted snapshot
```

b-flow restores the actor from the persisted XState snapshot and continues from the last known state.

### Check Next Item Without Executing

```
/b-next
```

Shows the next pending chunk without starting any execution.

## Architecture

### Extension Wiring

b-flow is a Pi extension registered in `extensions/b-flow/index.ts`:

- **Command**: `b-flow` with subcommands (`start`, `run`, `continue`, `status`, `pause`, `resume`, `stop`, `mode`)
- **Command**: `b-next` — lightweight status check
- **Hook**: `session_start` — sets project root
- **Hook**: `before_agent_start` — injects next-work summary into agent context
- **Hook**: `session_before_compact` — injects b-flow state summary for compaction survival

### Key Files

| File | Purpose |
|------|---------|
| `extensions/b-flow/index.ts` | Extension wiring — commands, hooks, actor lifecycle |
| `extensions/b-flow/machine.ts` | Top-level XState machine (`createBuckMachine`) |
| `extensions/b-flow/chunk-queue-machine.ts` | Nested chunk queue machine with worker + verify cycle |
| `extensions/b-flow/worker.ts` | Worker dispatch (`runWorker`) — routes to subprocess or SDK path |
| `extensions/b-flow/sdk-worker.ts` | SDK worker implementation (`runSDKWorker`) |
| `extensions/b-flow/verify-result.ts` | Result file parser → `CHUNK_VERIFIED` / `CHUNK_WARNINGS` / `CHUNK_BLOCKED` / `CHUNK_FAILED` |
| `extensions/b-flow/queue-builder.ts` | Builds chunk queue from phase files, tasks.md, or backlog |
| `extensions/b-flow/persistence.ts` | Projection + snapshot read/write |
| `extensions/b-flow/guards.ts` | XState guard functions |
| `extensions/b-flow/types.ts` | Shared TypeScript types |

### Worker Dispatch Flow

```
runWorker(chunk, options)
  ├── BFLOW_USE_SDK_WORKER=1?
  │   └── Yes → runSDKWorker(chunk, options)
  │             ├── createAgentSession({ cwd, model, tools })
  │             ├── session.subscribe(capture tool calls)
  │             ├── session.prompt(chunk prompt)
  │             ├── synthesize result markdown
  │             ├── write result + audit files
  │             └── session.dispose()
  └── No → runSubprocessWorker(chunk, options)
            ├── write prompt file
            ├── spawn("pi", ["-p", "--no-session", "@prompt"])
            ├── wait for result file
            └── cleanup prompt file
```

Both paths return `WorkerResult` with the same shape, so the chunk queue machine and parent machine are worker-agnostic.

## FAQ

### Can I switch worker paths mid-flow?

Yes. Set or unset `BFLOW_USE_SDK_WORKER` between Pi sessions. The queue machine doesn't care which worker backend produced the result — it only reads the result file via `verifyResult`.

### What happens if a chunk fails?

The chunk queue retries up to 2 times (configured via `maxRetriesReached` guard). After max retries, the queue transitions to `failed` with the error preserved as `blockReason`. The parent machine stops and reports the blocked chunk.

### Does the SDK worker work with real LLM calls?

Yes. The SDK worker calls `createAgentSession()` which creates a real session with real model calls. It requires valid API keys for whichever model the difficulty tier selects. The mocked unit tests (77/77 passing) verify the routing, lifecycle, and result synthesis without burning tokens.

### Where do I find worker output?

- **Result files**: `.context/<subject>/worker-results/`
- **Audit files**: `.context/<subject>/worker-audits/`
- **Machine state**: `.context/workflow/projection.json`
- **XState snapshot**: `.context/workflow/snapshot.json`

### How does b-flow survive context compaction?

The `session_before_compact` hook injects a compact state summary into the compaction context. The `before_agent_start` hook re-injects the next-work summary on each agent turn. The XState snapshot on disk provides full machine state restoration. Together, these three mechanisms ensure b-flow survives compaction, session resets, and even Pi restarts.
