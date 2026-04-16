import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

// --- Types ---

interface SessionState {
  started_at: string;
  mode: "freeform" | "guided";
  commands_run: Array<{ command: string; at: string }>;
  implementation_happened: boolean;
  save_completed: boolean;
  memory_file: string | null;
  files_modified: string[];
  guided_workflow: string | null;
  guided_stage: string | null;
}

const STATE_DIR = ".context/workflow";
const STATE_FILE = "current-session.json";
const MEMORY_DIR = ".context/memory";

const IMPLEMENTATION_COMMANDS = ["b-build", "b-build-hard", "b-iterate"];
const BUCK_PREFIX = "b-";

function defaultState(): SessionState {
  return {
    started_at: new Date().toISOString(),
    mode: "freeform",
    commands_run: [],
    implementation_happened: false,
    save_completed: false,
    memory_file: null,
    files_modified: [],
    guided_workflow: null,
    guided_stage: null,
  };
}

export default function (pi: ExtensionAPI) {
  let cwd = "";
  let qmdReindexTimer: ReturnType<typeof setTimeout> | null = null;
  let qmdReindexRunning = false;
  let qmdReindexPending = false;

  // --- State helpers ---

  function stateDir(): string {
    return join(cwd, STATE_DIR);
  }
  function statePath(): string {
    return join(stateDir(), STATE_FILE);
  }
  function memoryDir(): string {
    return join(cwd, MEMORY_DIR);
  }

  function readState(): SessionState | null {
    try {
      const p = statePath();
      if (!existsSync(p)) return null;
      const raw = readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw) as Partial<SessionState>;
      return { ...defaultState(), ...parsed };
    } catch {
      return null;
    }
  }

  function writeState(state: SessionState): void {
    try {
      const dir = stateDir();
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n", "utf-8");
    } catch (e) {
      console.error("[buck-workflow] Failed to write session state:", e);
    }
  }

  function ensureState(): SessionState {
    let state = readState();
    if (!state) {
      state = defaultState();
      writeState(state);
    }
    return state;
  }

  function toRelativePath(absPath: string): string {
    const prefix = cwd + "/";
    return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
  }

  function trackFile(state: SessionState, filePath: string): void {
    const rel = toRelativePath(filePath);
    if (rel && !state.files_modified.includes(rel)) {
      state.files_modified.push(rel);
    }
  }

  function isMemoryFile(filePath: string): boolean {
    const rel = toRelativePath(filePath);
    return rel === ".context/memory/index.md" || rel.startsWith(".context/memory/");
  }

  // --- QMD reindex ---

  function runQmdReindex(): void {
    if (qmdReindexRunning) {
      qmdReindexPending = true;
      return;
    }
    if (!existsSync(memoryDir())) return;

    qmdReindexRunning = true;
    const child = spawn(
      "sh",
      [
        "-lc",
        "command -v qmd >/dev/null 2>&1 && qmd index .context/memory --collection memory >/dev/null 2>&1 || true",
      ],
      { cwd, stdio: "ignore" },
    );

    child.on("error", () => {
      qmdReindexRunning = false;
    });
    child.on("close", () => {
      qmdReindexRunning = false;
      if (qmdReindexPending) {
        qmdReindexPending = false;
        scheduleQmdReindex(250);
      }
    });
  }

  function scheduleQmdReindex(delayMs = 1500): void {
    if (qmdReindexTimer) clearTimeout(qmdReindexTimer);
    qmdReindexTimer = setTimeout(() => {
      qmdReindexTimer = null;
      runQmdReindex();
    }, delayMs);
  }

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    const contextDir = join(cwd, ".context");
    if (!existsSync(contextDir)) return;
    // Bootstrap state if missing
    if (!existsSync(statePath())) {
      writeState(defaultState());
    }
  });

  // --- Track b-* prompt template usage ---

  pi.on("input", async (event, _ctx) => {
    const text = event.text?.trim() ?? "";
    // Match /b-* prompt template invocations
    const match = text.match(/^\/(b-\w[\w-]*)(\s|$)/);
    if (!match) return { action: "continue" as const };

    const command = match[1];
    if (!command.startsWith(BUCK_PREFIX)) return { action: "continue" as const };

    const contextDir = join(cwd, ".context");
    if (!existsSync(contextDir)) return { action: "continue" as const };

    const state = ensureState();
    state.commands_run.push({ command, at: new Date().toISOString() });

    if (IMPLEMENTATION_COMMANDS.includes(command)) {
      state.implementation_happened = true;
    }
    if (command === "b-save") {
      state.save_completed = true;
      scheduleQmdReindex(0);
    }

    writeState(state);
    return { action: "continue" as const };
  });

  // --- Track file modifications via tool results ---

  pi.on("tool_result", async (event, _ctx) => {
    if (!cwd) return;
    const state = readState();
    if (!state) return;

    let changed = false;

    // Track write and edit tool file paths
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = (event.input as any)?.path;
      if (filePath) {
        trackFile(state, filePath);
        changed = true;
        if (isMemoryFile(filePath)) scheduleQmdReindex();
      }
    }

    if (changed) writeState(state);
  });

  // --- Warn on agent completion if save pending ---

  pi.on("agent_end", async (_event, ctx) => {
    const state = readState();
    if (state?.implementation_happened && !state.save_completed) {
      ctx.ui.notify(
        "⚠️ Implementation work unsaved. Run /b-save to record this session.",
        "warn",
      );
    }
  });

  // --- Inject session state into compaction context ---

  pi.on("session_before_compact", async (event, _ctx) => {
    const state = readState();
    if (!state) return;

    const cmds = state.commands_run.map((c) => c.command).join(", ") || "none";
    const files = state.files_modified.join(", ") || "none";

    const context =
      `## Buck Workflow Session State\n` +
      `- Commands run: ${cmds}\n` +
      `- Implementation happened: ${state.implementation_happened}\n` +
      `- Save completed: ${state.save_completed}\n` +
      `- Files modified: ${files}\n` +
      `- Memory file: ${state.memory_file || "not yet created"}\n` +
      `- Mode: ${state.mode}`;

    return {
      compaction: {
        summary: context,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });

  // --- Register /b-save command (no prompt template needed, uses extension logic) ---

  pi.registerCommand("b-save", {
    description: "Record session history — checkpoint memory, backlog, and cross-references",
    handler: async (_args, ctx) => {
      const state = readState();
      if (!state) {
        ctx.ui.notify("No .context/workflow state found. Nothing to save.", "warn");
        return;
      }

      // Send the b-save instructions as a user message to the LLM
      const savePrompt = `You are the b-save agent in the Buck workflow.

## Your 8 Responsibilities

1. **Read Session State** — Read \`.context/workflow/current-session.json\` for context
2. **Subject Folder** — Create if missing; consolidate loose artifacts
3. **Memory Creation** — Create/update session memory file with proper frontmatter:
   \`\`\`yaml
   ---
   date: YYYY-MM-DD
   domains: [tooling, refactor]
   topics: [keyword, list]
   subject: YYYY-MM-DD.subject-name
   artifacts: [plan-file.md]
   related: []
   priority: high
   status: active
   ---
   \`\`\`
4. **Cross-Reference Stitching** — Back-fill \`memory:\` arrays in plan/spec files
5. **Backlog Update** — Mark completed tasks, add deferred items in \`.context/backlog.md\`
6. **Spec Status Updates** — Set \`status: completed\` on finished specs (no file moves)
7. **Index Update** — Update \`.context/memory/index.md\` with single-line entry at top
8. **QMD Re-index** — Run \`qmd index .context/memory --collection memory\` if qmd is available

## Session State
\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`

## Key Principle
Plans live in subject folders (intent). History lives in \`.context/memory/\` (record). /b-save turns intent into record.

Execute all 8 steps now. Write only to \`.context/\`.`;

      pi.sendUserMessage(savePrompt, { deliverAs: "followUp" });

      state.save_completed = true;
      writeState(state);
      scheduleQmdReindex(0);
    },
  });
}
