import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { completeSimple } from "@mariozechner/pi-ai";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { wire as wireTmuxStatus } from "./tmux-window-status.js";

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
  plan_mode_active: boolean;
}

// --- Plan Mode Configuration ---

const PLAN_MODE_ALLOWED_PATHS = [".context/", "docs/"];
const PLAN_MODE_ALLOWED_EXTENSIONS = [".md", ".txt"];

const SAFE_BASH_PATTERNS: RegExp[] = [
  /^\s*cat\b/, /^\s*ls\b/, /^\s*grep\b/, /^\s*find\b/,
  /^\s*head\b/, /^\s*tail\b/, /^\s*wc\b/, /^\s*pwd\b/,
  /^\s*echo\b/, /^\s*printf\b/, /^\s*git\s+(status|log|diff|show|branch)\b/,
  /^\s*file\b/, /^\s*stat\b/, /^\s*du\b/, /^\s*df\b/,
  /^\s*which\b/, /^\s*type\b/, /^\s*env\b/, /^\s*printenv\b/,
  /^\s*uname\b/, /^\s*whoami\b/, /^\s*date\b/,
];

const MUTATING_GIT_PATTERNS: RegExp[] = [
  /^\s*git\s+commit/, /^\s*git\s+push/, /^\s*git\s+pull/,
  /^\s*git\s+merge/, /^\s*git\s+rebase/, /^\s*git\s+reset/,
  /^\s*git\s+cherry-pick/, /^\s*git\s+branch\s+-D/, /^\s*git\s+branch\s+-d/,
  /^\s*git\s+tag\s+-d/,
];

const UNSAFE_SHELL_CHARS = /[;&`\n]/;
const REDIRECT_PATTERN = />{1,2}/;

function isWhitelistedBash(command: string): boolean {
  const trimmed = command.trim().replace(/\\\n\s*/g, "").replace(/\n\s*/g, " ");
  if (UNSAFE_SHELL_CHARS.test(trimmed)) return false;
  if (REDIRECT_PATTERN.test(trimmed)) return false;
  return SAFE_BASH_PATTERNS.some((p) => p.test(trimmed));
}

function isAllowedPlanWritePath(path: string): boolean {
  const normalizedPath = path.replace(/^\.\//, "").replace(/\/$/, "");
  for (const allowedPath of PLAN_MODE_ALLOWED_PATHS) {
    const normalizedAllowed = allowedPath.replace(/\/$/, "");
    if (normalizedPath.startsWith(normalizedAllowed) || normalizedPath === normalizedAllowed) {
      return true;
    }
  }
  for (const ext of PLAN_MODE_ALLOWED_EXTENSIONS) {
    if (normalizedPath.endsWith(ext)) return true;
  }
  return false;
}

function getBashOverride(entries: any[], command: string): boolean {
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === "plan-mode-bash-override") {
      if (entry.data?.command === command) return true;
    }
  }
  return false;
}

const STATE_DIR = ".context/workflow";
const STATE_FILE = "current-session.json";
const MEMORY_DIR = ".context/memory";

const PLAN_MODE_COMMANDS = ["b-plan", "b-brainstorm", "b-research"];
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
    plan_mode_active: false,
  };
}

export default function (pi: ExtensionAPI) {
  let cwd = "";
  let qmdReindexTimer: ReturnType<typeof setTimeout> | null = null;
  let qmdReindexRunning = false;
  let qmdReindexPending = false;

  // --- tmux window status ---
  wireTmuxStatus(pi);

  // --- Plan Mode ---

  function updatePlanModeStatus(ctx: any, active: boolean): void {
    if (active) {
      ctx.ui.setStatus("plan", ctx.ui.theme.fg("warning", "📝 planning"));
    } else {
      ctx.ui.setStatus("plan", undefined);
    }
  }

  function enablePlanMode(ctx: any): void {
    const state = ensureState();
    if (!state.plan_mode_active) {
      state.plan_mode_active = true;
      writeState(state);
      ctx.ui.notify(
        "✅ Plan mode enabled - writes allowed to .context/, docs/, .md, .txt",
        "info",
      );
      updatePlanModeStatus(ctx, true);
    }
  }

  pi.on("before_agent_start", async (event, ctx) => {
    const state = readState();
    if (!state?.plan_mode_active) return;

    const instructions = `[PLAN MODE ACTIVE]

You are in plan mode. This is a PLANNING PHASE only.

Allowed writes:
- .context/ directory (Buck workflow: plans, specs, research, memory)
- docs/ directory (documentation)
- .md and .txt files

Blocked:
- Source code files (.ts, .js, .py, etc.)
- Config files (.json, .yaml, .toml, etc.)
- Other non-documentation files

Available tools:
- read: Read files to understand the codebase
- write/edit: Write to allowed paths only
- bash: Run commands for exploration (safe commands allowed, others reviewed)

Help the user plan what needs to be done:
- Explore the codebase
- Discuss the approach  
- Create/update plans in .context/
- Update documentation in docs/
- When ready, run /plan to exit plan mode`;

    return {
      systemPrompt: event.systemPrompt + "\n\n" + instructions,
    };
  });

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

  // Note: qmd update (re-index all collections) is not used here because it crashes on
  // an unrelated vault collection. The fix-qmd-index-crash backlog item tracks that issue.
  // qmd collection add creates or updates the buck-workflow-memory collection and indexes
  // its files, which is sufficient for making new memory entries searchable.
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
        "command -v qmd >/dev/null 2>&1 && qmd collection add .context/memory --name buck-workflow-memory --mask '*.md' >/dev/null 2>&1 || true",
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

    // Restore plan mode state from session
    const state = readState();
    if (state?.plan_mode_active) {
      updatePlanModeStatus(ctx, true);
      ctx.ui.notify("ℹ️ Plan mode restored", "info");
    }
  });

  // --- Track b-* prompt template usage ---

  pi.on("input", async (event, ctx) => {
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
    if (PLAN_MODE_COMMANDS.includes(command)) {
      enablePlanMode(ctx);
    }
    if (IMPLEMENTATION_COMMANDS.includes(command)) {
      // Auto-disable plan mode when moving to implementation
      const s = ensureState();
      if (s.plan_mode_active) {
        s.plan_mode_active = false;
        writeState(s);
        ctx.ui.notify("📝 Plan mode disabled - entering implementation", "info");
        updatePlanModeStatus(ctx, false);
      }
    }
    if (command === "b-save") {
      state.save_completed = true;
      scheduleQmdReindex(0);
    }

    writeState(state);
    return { action: "continue" as const };
  });

  // --- Plan Mode tool blocking ---

  pi.on("tool_call", async (event, ctx) => {
    const state = readState();
    if (!state?.plan_mode_active) return;

    // Handle write tool
    if (event.toolName === "write") {
      const path = (event.input as any)?.path || "";
      if (!isAllowedPlanWritePath(path)) {
        const ext = path.split(".").pop()?.toLowerCase();
        const reason = ext && !["md", "txt"].includes(ext)
          ? `Plan mode: .${ext} files are not allowed. Allowed: .context/, docs/, .md, .txt`
          : `Plan mode: ${path} is not in allowed paths. Allowed: .context/, docs/`;
        return { block: true, reason };
      }
      return;
    }

    // Handle edit tool
    if (event.toolName === "edit") {
      const path = (event.input as any)?.path || "";
      if (!isAllowedPlanWritePath(path)) {
        const ext = path.split(".").pop()?.toLowerCase();
        const reason = ext && !["md", "txt"].includes(ext)
          ? `Plan mode: .${ext} files are not allowed. Allowed: .context/, docs/, .md, .txt`
          : `Plan mode: ${path} is not in allowed paths. Allowed: .context/, docs/`;
        return { block: true, reason };
      }
      return;
    }

    // Handle bash tool
    if (event.toolName === "bash") {
      const command = (event.input as any)?.command || "";
      const entries = ctx.sessionManager.getEntries();

      if (getBashOverride(entries, command)) return;

      if (MUTATING_GIT_PATTERNS.some((p) => p.test(command))) {
        return { block: true, reason: "Plan mode: mutating git commands are not allowed." };
      }

      if (REDIRECT_PATTERN.test(command)) {
        return { block: true, reason: "Plan mode: file redirects are not allowed." };
      }

      if (isWhitelistedBash(command)) return;

      // AI review for non-whitelisted commands
      try {
        const currentModel = ctx.model;
        if (!currentModel) {
          return { block: true, reason: "Plan mode: cannot review command (no model available)." };
        }

        const authResult = await ctx.modelRegistry.getApiKeyAndHeaders(currentModel);
        if (!authResult.ok) {
          return { block: true, reason: "Plan mode: cannot review command (auth failed)." };
        }

        const response = await completeSimple(
          currentModel,
          {
            messages: [{
              role: "user",
              content: [{
                type: "text",
                text: `Is this bash command EXPLORATORY (read-only, safe in plan mode) or MUTATING (writes, deletes, or changes state)?\n\n$ ${command}\n\nRespond with a single word: EXPLORATORY or MUTATING`,
              }],
              timestamp: Date.now(),
            }],
          },
          { apiKey: authResult.apiKey, headers: authResult.headers, maxTokens: 256 },
        );

        const text = response.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join(" ")
          .toLowerCase();

        if (text.includes("mutating")) {
          const allowed = await ctx.ui.confirm(
            "Plan mode: command blocked",
            `This command would mutate state:\n\n  $ ${command}\n\nAllow anyway?`,
          );

          if (allowed) {
            pi.appendEntry("plan-mode-bash-override", { command, timestamp: Date.now() });
            return;
          }
          return { block: true, reason: "Plan mode: command would mutate state." };
        }
        return;
      } catch (error: any) {
        console.error("[plan-mode] AI review failed:", error);
        const allowed = await ctx.ui.confirm(
          "Plan mode: AI review failed",
          `Could not review command:\n\n  ${error.message}\n\n  $ ${command}\n\nAllow anyway?`,
        );
        if (allowed) {
          pi.appendEntry("plan-mode-bash-override", { command, timestamp: Date.now() });
          return;
        }
        return { block: true, reason: "Plan mode: AI review failed. Command blocked." };
      }
    }
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
        "warning",
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
        ctx.ui.notify("No .context/workflow state found. Nothing to save.", "warning");
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
5. **Backlog Update** — Read \`.context/backlog/todo.md\` (legacy fallback: \`.context/backlog.md\`). For completed items: remove from \`todo.md\`, update item file \`status: completed\` + \`completed: YYYY-MM-DD\`, move item file to \`archive/YYYY-MM/<slug>.md\`, add summary to \`archive/completed.md\`. For new/deferred items: create backing item file in \`items/<slug>.md\` + linked checkbox in \`todo.md\`. Only auto-archive explicitly completed items — if completion is inferred, surface it for user decision.
6. **Spec Status Updates** — Set \`status: completed\` on finished specs (no file moves)
7. **Index Update** — Update \`.context/memory/index.md\` with single-line entry at top
8. **QMD Re-index** — Ensure the memory collection is indexed: \`qmd collection add .context/memory --name buck-workflow-memory --mask '*.md'\` (safe to run on existing collections; ignores qmd update failures on unrelated collections)

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
