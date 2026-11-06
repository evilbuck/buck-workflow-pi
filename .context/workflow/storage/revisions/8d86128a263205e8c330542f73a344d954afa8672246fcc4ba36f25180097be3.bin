---
status: active
date: 2026-05-17
subject: 2026-05-17.subject-phase-detection
topics: [extensions, subjects, phases, detection, session-management, b-flow]
informs: []
---

# Research: Detecting In-Progress Subjects and Phase Progress via Pi Extensions

## Summary

There are **three complementary approaches** to programmatically detect in-progress buck-workflow subjects and phase progress, each with different tradeoffs in scope, reliability, and implementation effort.

---

## Approach 1: Filesystem Scanning (b-flow pattern)

**What exists today**: `b-flow/scan-context.ts` and `b-flow/queue-builder.ts` already implement this.

**How it works**: Scan `.context/` directories for artifact patterns:

### Subject Detection

| Signal | Location | Confidence |
|--------|----------|------------|
| Subject folders | `.context/YYYY-MM-DD.<slug>/` | High |
| Active plan | `.context/<subject>/plan-*.md` | High |
| Phase files | `.context/<subject>/phase-N-*.md` | High |
| Tasks file | `.context/<subject>/tasks.md` | Medium |
| Iterate files | `.context/<subject>/iterate-*.md` | Medium |
| Worker results | `.context/<subject>/worker-results/*.md` | Medium |

### Phase Progress Detection

| Signal | Detection Method |
|--------|-----------------|
| Phase status | `status:` frontmatter in `phase-N-*.md` |
| Phase difficulty | `difficulty: easy|medium|hard` frontmatter |
| Acceptance criteria | `- [x]` vs `- [ ]` checklist items |
| Active phase | First `phase-N-*.md` where `status != completed` |
| Overview table | `plan-*-phases.md` summary table |

### Implementation

```typescript
// Reuse scan-context.ts directly
import { scanContext } from "./b-flow/scan-context.js";

const result = await scanContext(projectRoot, "idle", "my-goal", null);
// Returns TransitionContext with:
// - artifacts.latestPlan
// - artifacts.activePhase
// - artifacts.phasesOverview
// - artifacts.backlogItems
// - artifacts.workerResults
```

**Pros**: Works without active sessions. Disk-only. Fast. Already built.
**Cons**: Only works within one project. Stale if agent crashed without saving. No temporal ordering across projects.

---

## Approach 2: Session File Inspection

**What exists today**: `SessionManager.list(cwd)` and `SessionManager.listAll()` — static methods.

**How it works**: Pi stores sessions as JSONL files under `~/.pi/agent/sessions/`. Each session has a `cwd` header. Extensions can enumerate all sessions, parse their headers and custom entries.

### Subject Detection via Sessions

Sessions carry buck-workflow signals in:
1. **Session name** — set via `pi.setSessionName()` (e.g., "Refactor auth module")
2. **Compaction summaries** — injected by `session_before_compact` hooks with b-flow state
3. **Custom entries** — `pi.appendEntry()` stores `orchestration.json` data
4. **File paths** — session's `cwd` tells you which project

### Cross-Project Discovery

```typescript
import { SessionManager } from "@earendil-works/pi-coding-agent";

// All sessions across all projects
const allSessions = await SessionManager.listAll();

// Filter to active/recent buck-workflow sessions
for (const session of allSessions) {
  const sm = await SessionManager.open(session.file);
  const header = sm.getHeader();
  const entries = sm.getEntries();

  // Look for b-flow custom entries
  const bFlowEntries = entries.filter(
    e => e.type === "custom" && e.customType === "b-flow-projection"
  );

  // Look for compaction summaries with workflow state
  const compactions = entries.filter(
    e => e.type === "compaction" && e.summary?.includes("b-flow State")
  );

  // Session name
  const name = sm.getSessionName();

  // Working directory (project)
  const cwd = sm.getCwd();
}
```

### Orchestrating with b-flow Projection

The b-flow extension persists state to `.context/workflow/orchestration.json`:

```json
{
  "version": 1,
  "goal": "Refactor auth",
  "currentState": "executingChunks",
  "subject": "2026-05-15.refactor-auth",
  "startedAt": "2026-05-15T10:00:00Z",
  "updatedAt": "2026-05-15T14:30:00Z",
  "history": [
    { "from": "idle", "to": "recovering", "at": "...", "reason": "Starting flow" },
    { "from": "recovering", "to": "planning", "at": "...", "reason": "..." },
    { "from": "planning", "to": "executingChunks", "at": "...", "reason": "..." }
  ],
  "queue": [
    { "id": "phase-1-setup", "type": "phase", "path": "...", "status": "completed" },
    { "id": "phase-2-migrate", "type": "phase", "path": "...", "status": "in-progress" },
    { "id": "phase-3-cleanup", "type": "phase", "path": "...", "status": "pending" }
  ]
}
```

**Pros**: Cross-project visibility. Temporal ordering. Includes active session state.
**Cons**: Requires parsing JSONL. Sessions persist after work is done (needs recency filtering). Session files are per-cwd — `listAll()` discovers all but `open()` is needed per file.

---

## Approach 3: Hybrid Extension with Multi-Project Dashboard

**Recommended approach**: Combine filesystem scanning + session inspection into a single extension.

### Architecture

```
extensions/b-workflow-tracker/
├── index.ts           # Main extension: commands + lifecycle hooks
├── scanner.ts         # Multi-project filesystem scanner
├── session-inspector.ts # Session file parser for cross-project discovery
├── state-aggregator.ts  # Merges filesystem + session data
├── types.ts           # Shared types
└── ui.ts              # TUI dashboard component
```

### Key Design Decisions

#### 1. Project Discovery

Two strategies:
- **Session-based**: Parse `~/.pi/agent/sessions/` headers to discover all cwd paths that have sessions
- **Manual config**: Maintain a list in `~/.pi/agent/settings.json` under `bWorkflowProjects`

Session-based discovery is automatic but may find stale projects. A hybrid approach: discover from sessions, then cache confirmed projects.

#### 2. Subject Status Inference

A subject is **in-progress** when ANY of these are true:

| Condition | Signal |
|-----------|--------|
| Active b-flow | `.context/workflow/orchestration.json` exists with `currentState != idle/done/aborted` |
| Unsaved work | Git diff exists + `.context/<subject>/` has recent plan files |
| Active session | Session's cwd matches project + compaction mentions b-flow state |
| Uncompleted phases | `phase-N-*.md` files exist where `status != completed` |
| Unchecked tasks | `tasks.md` has `- [ ]` items |
| Open backlog | `.context/backlog/todo.md` has unchecked items |

A subject is **idle** when:
- No b-flow orchestration file, OR `currentState` is `idle`/`done`
- No recent `.context/` activity
- No active session for that project

#### 3. Phase Progress Calculation

```typescript
function computePhaseProgress(phaseFiles: string[]): {
  total: number;
  completed: number;
  inProgress: string | null;
  next: string | null;
  percentComplete: number;
} {
  let completed = 0;
  let inProgress: string | null = null;
  let next: string | null = null;

  for (const file of phaseFiles.sort()) {
    const content = readFileSync(file, "utf-8");
    const status = content.match(/^status:\s*(\S+)/m)?.[1] ?? "pending";
    const name = basename(file, ".md");

    if (status === "completed") {
      completed++;
    } else if (!inProgress) {
      inProgress = name;
    } else if (!next) {
      next = name;
    }
  }

  return {
    total: phaseFiles.length,
    completed,
    inProgress,
    next,
    percentComplete: phaseFiles.length > 0
      ? Math.round((completed / phaseFiles.length) * 100)
      : 0,
  };
}
```

#### 4. Custom Tool: `b-workflow_status`

Register a tool the LLM can call:

```typescript
pi.registerTool({
  name: "b-workflow_status",
  label: "Buck Workflow Status",
  description: "List all in-progress buck-workflow subjects across projects with phase progress",
  parameters: Type.Object({
    project: Type.Optional(Type.String({ description: "Filter to specific project path" })),
    subject: Type.Optional(Type.String({ description: "Filter to specific subject slug" })),
    detailed: Type.Optional(Type.Boolean({ description: "Include full phase breakdown" })),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const projects = await discoverProjects();
    const results = [];
    for (const project of projects) {
      const subjects = await scanSubjects(project);
      for (const subject of subjects) {
        if (subject.status !== "in-progress" && subject.status !== "paused") continue;
        const phases = await computePhaseProgress(subject);
        results.push({ project, subject, phases });
      }
    }
    return {
      content: [{ type: "text", text: formatResults(results) }],
      details: { projects: results },
    };
  },
});
```

#### 5. Compaction Hook Integration

Inject workflow summary into every session's compaction:

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const projection = readProjection(ctx.cwd);
  if (!projection) return;

  const phases = projection.queue.filter(q => q.type === "phase");
  const completed = phases.filter(p => p.status === "completed").length;

  return {
    compaction: {
      summary: `b-flow: ${projection.currentState} | ${projection.subject} | ${completed}/${phases.length} phases`,
      firstKeptEntryId: event.preparation.firstKeptEntryId,
      tokensBefore: event.preparation.tokensBefore,
    },
  };
});
```

---

## Existing Code References

| File | Purpose |
|------|---------|
| `extensions/b-flow/scan-context.ts` | Filesystem scanner for artifacts (plans, phases, backlog) |
| `extensions/b-flow/queue-builder.ts` | Builds chunk queue from phase files, tasks, backlog, iterate files |
| `extensions/b-flow/persistence.ts` | Read/write `.context/workflow/orchestration.json` |
| `extensions/b-flow/machine.ts` | XState state machine (idle→recovering→planning→executing→reviewing→saving→done) |
| `extensions/b-flow/types.ts` | `BuckState`, `ChunkQueueItem`, `OrchestrationState`, `TransitionContext` |
| `extensions/index.ts` | Main extension — tracks session state, plan mode, model auto-switch |
| `extensions/grill-me-dialog.ts` | Pattern for custom TUI dialogs + state persistence |

## Risks / Unknowns

1. **`SessionManager.listAll()` performance**: Not tested with large session counts. May need pagination or filtering.
2. **Stale sessions**: Sessions persist indefinitely. Need recency heuristics (last N days, or filter by active b-flow state).
3. **Multi-process conflicts**: If two pi instances write to the same `orchestration.json`, corruption possible. Need file locking or atomic writes.
4. **Subject folder naming**: Currently `YYYY-MM-DD.<slug>`. Need to handle both new subject folders and legacy `plans/` directory.

## Recommended Next Step

**b-plan** — Design the `b-workflow-tracker` extension as a standalone addition that:
1. Discovers projects from session files
2. Scans each project's `.context/` for subject/phase artifacts
3. Merges with `orchestration.json` state
4. Exposes a `b-workflow_status` tool + `/b-workflow` command
5. Provides a compact TUI dashboard

This builds on existing b-flow infrastructure rather than replacing it.
