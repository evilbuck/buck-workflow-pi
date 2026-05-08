/**
 * Grill-Me Dialog Extension
 *
 * Registers a custom tool (`grill-me_dialog`) that enables document-mode
 * grilling. The LLM writes questions to a shared markdown file; the user
 * edits answers in their external editor; an inline TUI Done/Cancel selector
 * signals when the user is ready for the agent to read answers back.
 *
 * Actions:
 * - "create": Initialize a QA markdown file and sidecar state
 * - "wait":   Render Done/Cancel selector, block until user signals, return answers
 * - "read":   Read file content without showing selector, return current answers
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { Type } from "@sinclair/typebox";

// ============================================================
// Types
// ============================================================

interface GrillDocState {
  file_path: string;
  subject: string;
  slug: string;
  question_count: number;
  last_ai_hash: string;
  last_reviewed_at: string | null;
}

interface QABlock {
  question_number: number;
  question_text: string;
  answer_text: string;
}

interface DialogResult {
  action: "create" | "wait" | "read";
  success: boolean;
  error?: string;
  file_path?: string;
  question_count?: number;
  hash?: string;
  cancelled?: boolean;
  no_changes?: boolean;
  blocks?: QABlock[];
}

// ============================================================
// Constants
// ============================================================

const STATE_DIR = ".context/workflow";
const STATE_FILE = "grill-doc-state.json";

// ============================================================
// Schema
// ============================================================

const ActionSchema = Type.Union([
  Type.Literal("create"),
  Type.Literal("wait"),
  Type.Literal("read"),
]);

const DialogParams = Type.Object({
  file_path: Type.String({ description: "Path to the QA markdown file (relative to project root)" }),
  action: ActionSchema,
});

// ============================================================
// Helpers
// ============================================================

let cwd = "";

function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function statePath(): string {
  return join(cwd, STATE_DIR, STATE_FILE);
}

function readDocState(): GrillDocState | null {
  try {
    const p = statePath();
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeDocState(state: GrillDocState): void {
  const dir = dirname(statePath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n", "utf-8");
}

/**
 * Validate that a path is under `.context/` in the project.
 * Normalizes relative paths and rejects path traversal.
 */
function validateContextPath(filePath: string): { ok: true; absPath: string } | { ok: false; error: string } {
  const absPath = resolve(cwd, filePath);
  const contextDir = resolve(cwd, ".context");

  if (!absPath.startsWith(contextDir + "/") && absPath !== contextDir) {
    return { ok: false, error: `Path must be under .context/ — got: ${filePath}` };
  }

  return { ok: true, absPath };
}

/**
 * Create the initial QA markdown file with a header comment.
 */
function createQAFile(absPath: string): string {
  const dir = dirname(absPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const header = [
    "<!--",
    "  Grill QA Document",
    "  Edit answers under each ### Answer section in your external editor.",
    "  When done, press Done in the Pi chat to signal the agent.",
    "-->",
    "",
  ].join("\n");

  writeFileSync(absPath, header, "utf-8");
  return header;
}

/**
 * Parse QA blocks from markdown content.
 *
 * Looks for `## Question N` headers followed by `### Answer` sections.
 * Lenient: missing answers return empty string.
 */
function parseQABlocks(content: string): QABlock[] {
  const blocks: QABlock[] = [];

  // Split on ## Question N headers
  const parts = content.split(/^## Question (\d+)/m);

  // parts[0] = preamble, parts[1] = number, parts[2] = body, ...
  for (let i = 1; i < parts.length; i += 2) {
    const num = parseInt(parts[i], 10);
    const body = parts[i + 1] || "";

    // Extract question text (everything before ### Answer)
    const answerMatch = body.match(/^### Answer\s*$/m);
    let questionText: string;
    let answerText: string;

    if (answerMatch) {
      questionText = body.slice(0, answerMatch.index!).trim();
      answerText = body.slice(answerMatch.index! + answerMatch[0].length).trim();
    } else {
      // No answer header — treat everything as question text
      questionText = body.trim();
      answerText = "";
    }

    blocks.push({
      question_number: num,
      question_text: questionText,
      answer_text: answerText,
    });
  }

  return blocks;
}

/**
 * Count ## Question N headers in content.
 */
function countQuestions(content: string): number {
  const matches = content.match(/^## Question \d+/gm);
  return matches ? matches.length : 0;
}

function textResult(msg: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text" as const, text: msg }];
}

function makeResult(msg: string, details: DialogResult) {
  return {
    content: textResult(msg),
    details,
  };
}

// ============================================================
// Action Handlers
// ============================================================

function handleCreate(params: { file_path: string }) {
  const validation = validateContextPath(params.file_path);
  if (!validation.ok) {
    return makeResult(`Error: ${validation.error}`, {
      action: "create",
      success: false,
      error: validation.error,
    });
  }

  const { absPath } = validation;
  let content: string;

  if (existsSync(absPath)) {
    content = readFileSync(absPath, "utf-8");
  } else {
    content = createQAFile(absPath);
  }

  const hash = computeHash(content);
  const slug = basename(absPath, ".md");

  const state: GrillDocState = {
    file_path: absPath,
    subject: dirname(absPath).split("/").pop() || "",
    slug,
    question_count: countQuestions(content),
    last_ai_hash: hash,
    last_reviewed_at: null,
  };

  writeDocState(state);

  return makeResult(`Created grill QA document: ${params.file_path}`, {
    action: "create",
    success: true,
    file_path: params.file_path,
    question_count: state.question_count,
    hash,
  });
}

async function handleWait(
  params: { file_path: string },
  ctx: any,
) {
  const validation = validateContextPath(params.file_path);
  if (!validation.ok) {
    return makeResult(`Error: ${validation.error}`, {
      action: "wait",
      success: false,
      error: validation.error,
    });
  }

  const { absPath } = validation;

  if (!existsSync(absPath)) {
    return makeResult(`Error: File not found: ${params.file_path}`, {
      action: "wait",
      success: false,
      error: "File not found",
    });
  }

  if (!ctx.hasUI) {
    // Non-interactive: just read the file
    const content = readFileSync(absPath, "utf-8");
    const blocks = parseQABlocks(content);
    return makeResult(`Read ${blocks.length} Q&A blocks (non-interactive mode)`, {
      action: "wait",
      success: true,
      cancelled: false,
      blocks,
    });
  }

  // Read current state
  const state = readDocState();
  const currentHash = state?.last_ai_hash || "";
  const fileName = basename(absPath);

  // Show Done/Cancel selector
  const result = await ctx.ui.custom<{ choice: "done" | "cancel" } | null>(
    (tui: any, theme: any, _kb: any, done: (result: { choice: "done" | "cancel" } | null) => void) => {
      const container = new Container();

      // Top border
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      // Header
      container.addChild(new Text(theme.fg("accent", "📝 Grill Doc: Edit answers in your editor"), 1, 0));
      container.addChild(new Text(theme.fg("text", "   then press Done when ready"), 0, 0));

      // Spacing
      container.addChild(new Text("", 0, 0));

      // Build select items
      const items: SelectItem[] = [
        { value: "done", label: "✅ Done" },
        { value: "cancel", label: "❌ Cancel" },
      ];

      const selectList = new SelectList(items, 2, {
        selectedPrefix: (text: string) => theme.fg("accent", text),
        selectedText: (text: string) => theme.fg("accent", text),
        description: (text: string) => theme.fg("muted", text),
        scrollInfo: (text: string) => theme.fg("dim", text),
        noMatch: (text: string) => theme.fg("warning", text),
      });

      selectList.onSelect = (item: SelectItem) => {
        done({ choice: item.value as "done" | "cancel" });
      };
      selectList.onCancel = () => {
        done(null);
      };

      container.addChild(selectList);

      // Footer
      container.addChild(new Text("", 0, 0));
      container.addChild(new Text(theme.fg("dim", "↑↓ navigate • Enter select • Esc cancel"), 0, 0));
      container.addChild(new Text(theme.fg("dim", `File: ${fileName}`), 0, 0));

      // Bottom border
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      return {
        render(width: number) {
          return container.render(width);
        },
        invalidate() {
          container.invalidate();
        },
        handleInput(data: string) {
          selectList.handleInput(data);
          tui.requestRender();
        },
      };
    },
  );

  // Handle result
  if (!result || result.choice === "cancel") {
    return makeResult("User cancelled the dialog", {
      action: "wait",
      success: true,
      cancelled: true,
    });
  }

  // User clicked Done — re-read file and check for changes
  const newContent = readFileSync(absPath, "utf-8");
  const newHash = computeHash(newContent);
  const noChangesWarning = currentHash !== "" && newHash === currentHash;

  // Update sidecar state
  const blocks = parseQABlocks(newContent);
  const newState: GrillDocState = {
    file_path: absPath,
    subject: state?.subject || dirname(absPath).split("/").pop() || "",
    slug: state?.slug || basename(absPath, ".md"),
    question_count: blocks.length,
    last_ai_hash: state?.last_ai_hash || newHash,
    last_reviewed_at: new Date().toISOString(),
  };
  writeDocState(newState);

  const warningNote = noChangesWarning
    ? " No edits detected since last agent write."
    : "";

  return makeResult(`User completed editing. ${blocks.length} Q&A blocks found.${warningNote}`, {
    action: "wait",
    success: true,
    cancelled: false,
    no_changes: noChangesWarning,
    blocks,
    question_count: blocks.length,
  });
}

function handleRead(params: { file_path: string }) {
  const validation = validateContextPath(params.file_path);
  if (!validation.ok) {
    return makeResult(`Error: ${validation.error}`, {
      action: "read",
      success: false,
      error: validation.error,
    });
  }

  const { absPath } = validation;

  if (!existsSync(absPath)) {
    return makeResult(`Error: File not found: ${params.file_path}`, {
      action: "read",
      success: false,
      error: "File not found",
    });
  }

  const content = readFileSync(absPath, "utf-8");
  const blocks = parseQABlocks(content);

  return makeResult(`Read ${blocks.length} Q&A blocks from ${params.file_path}`, {
    action: "read",
    success: true,
    blocks,
    question_count: blocks.length,
  });
}

// ============================================================
// Wiring
// ============================================================

export function wire(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
  });

  pi.registerTool({
    name: "grill-me_dialog",
    label: "Grill Doc Dialog",
    description:
      "Document-mode grilling dialog. Call with action 'create' to initialize a QA markdown file, " +
      "'wait' to show a Done/Cancel selector while the user edits answers in their external editor, " +
      "or 'read' to read current answers without showing a selector.",
    parameters: DialogParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      cwd = ctx.cwd;

      switch (params.action) {
        case "create":
          return handleCreate(params);
        case "wait":
          return await handleWait(params, ctx);
        case "read":
          return handleRead(params);
        default:
          return makeResult(`Error: Unknown action '${params.action}'`, {
            action: params.action as any,
            success: false,
            error: "Unknown action",
          });
      }
    },

    renderCall(args, theme, _context) {
      const actionLabel = args.action === "create" ? "📝 Creating"
        : args.action === "wait" ? "⏳ Waiting"
        : "📖 Reading";
      const text = theme.fg("toolTitle", theme.bold("grill-me_dialog "))
        + theme.fg("muted", `${actionLabel} ${args.file_path}`);
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as DialogResult | undefined;

      if (!details?.success) {
        const msg = result.content[0]?.type === "text" ? result.content[0].text : "Error";
        return new Text(theme.fg("error", `✗ ${msg}`), 0, 0);
      }

      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled — file preserved on disk"), 0, 0);
      }

      if (details.action === "create") {
        return new Text(
          theme.fg("success", "✓ ") + theme.fg("text", `Created ${details.file_path} (${details.question_count} questions)`),
          0,
          0,
        );
      }

      if (details.action === "wait") {
        const count = details.blocks?.length ?? 0;
        const noChanges = details.no_changes
          ? theme.fg("warning", " (no edits detected)")
          : "";
        return new Text(
          theme.fg("success", "✓ ") + theme.fg("text", `${count} Q&A blocks read`) + noChanges,
          0,
          0,
        );
      }

      if (details.action === "read") {
        const count = details.blocks?.length ?? 0;
        return new Text(theme.fg("success", "✓ ") + theme.fg("text", `${count} Q&A blocks`), 0, 0);
      }

      const fallback = result.content[0]?.type === "text" ? result.content[0].text : "";
      return new Text(theme.fg("text", fallback), 0, 0);
    },
  });
}
