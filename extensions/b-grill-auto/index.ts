/**
 * b-grill-auto Extension
 *
 * Registers /b-grill-auto command that:
 * 1. Reads a plan/design to grill
 * 2. Spawns a Pi RPC subprocess with a different model as the answerer
 * 3. Uses the current session model as the orchestrator (question generator)
 * 4. Loops: generate question → send to answerer → record → next question
 * 5. At threshold: assess boundaries, write session file, cleanup
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { GrillRpcClient } from "./rpc-client.js";
import { buildSystemPrompt, buildUserPrompt, parseResponse } from "./harness.js";
import {
  initSession,
  addQuestion,
  recordAnswer,
  getPriorQASummary,
  writeSessionFile,
  writeSessionState,
  readSessionState,
  clearSessionState,
  assessBoundaries,
} from "./grill-state.js";
import type { GrillConfig, GrillSessionState } from "./types.js";

// ============================================================
// Constants
// ============================================================

const DEFAULT_MODEL = "openai-codex/gpt-5.4";
const DEFAULT_THRESHOLD = 20;
const CONTEXT_DIR = ".context";
const WORKFLOW_DIR = ".context/workflow";

// ============================================================
// Session state (in-memory)
// ============================================================

let activeSession: GrillSessionState | null = null;
let rpcClient: GrillRpcClient | null = null;
let isGrilling = false;
let orchestratorPhase: "generating" | "answering" = "generating";
let cwd = "";
let shutdownHandler: (() => void) | null = null;

// ============================================================
// Wiring
// ============================================================

export function wire(pi: ExtensionAPI): void {
  // Track working directory
  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
  });

  // Register the command
  pi.registerCommand("b-grill-auto", {
    description: "Auto-grill a plan using a different AI model as answerer",
    getArgumentCompletions(prefix: string) {
      if (prefix.startsWith("--model")) return [{ value: "--model openai-codex/gpt-5.4", label: "--model openai-codex/gpt-5.4" }];
      if (prefix.startsWith("--threshold")) return [{ value: "--threshold 20", label: "--threshold 20" }];
      return [
        { value: "--model", label: "--model" },
        { value: "--threshold", label: "--threshold" },
      ];
    },
    handler: async (args: string, ctx: any) => {
      await handleGrillAuto(pi, args, ctx);
    },
  });

  // Intercept agent_end to process orchestrator responses
  pi.on("agent_end", async (event, ctx) => {
    if (!isGrilling || !activeSession) return;
    if (orchestratorPhase !== "generating") return;

    try {
      await processOrchestratorResponse(pi, event, ctx);
    } catch (err) {
      await handleGrillError(pi, ctx, err);
    }
  });

  // Cleanup on shutdown
  pi.on("session_shutdown", async () => {
    cleanupRpc();
  });
}

// ============================================================
// Command handler
// ============================================================

async function handleGrillAuto(
  pi: ExtensionAPI,
  args: string,
  ctx: any,
): Promise<void> {
  cwd = ctx.cwd;

  // Check for active session
  if (isGrilling && activeSession) {
    ctx.ui.notify("A grill session is already active. Wait for it to finish or restart Pi.", "warning");
    return;
  }

  // Parse arguments
  const config = parseArgs(args);

  // Read plan content
  const planContent = await readPlanContent(ctx, config.planPath);
  if (!planContent) {
    ctx.ui.notify("No plan content found. Provide a plan path with @file or place a plan in .context/", "warning");
    return;
  }

  // Determine subject folder
  const subjectFolder = resolveSubjectFolder(ctx);

  // Parse answerer model
  const [provider, model] = parseModelId(config.model);

  // Initialize session state
  activeSession = initSession(config, planContent, subjectFolder);
  isGrilling = true;
  orchestratorPhase = "generating";

  // Write initial state
  writeSessionState(activeSession, cwd);

  // Status UI
  ctx.ui.setStatus("grill", `🔥 Q0/${config.threshold} — starting`);

  ctx.ui.notify(
    `🔥 Starting grill session: model=${config.model}, threshold=${config.threshold}`,
    "info",
  );

  // Spawn RPC answerer
  rpcClient = new GrillRpcClient(provider, model);
  const started = await rpcClient.start();
  if (!started) {
    ctx.ui.notify(`Failed to start RPC subprocess with ${config.model}`, "error");
    await handleGrillError(pi, ctx, new Error("RPC subprocess failed to start"));
    return;
  }

  // Kick off the orchestrator — first question
  await sendOrchestratorPrompt(pi, ctx);
}

// ============================================================
// Orchestrator loop
// ============================================================

/**
 * Send a prompt to the main session model instructing it to generate
 * the next grilling question based on the plan and current state.
 */
async function sendOrchestratorPrompt(
  pi: ExtensionAPI,
  ctx: any,
): Promise<void> {
  if (!activeSession) return;

  const session = activeSession;
  const questionNum = session.questions.length + 1;
  const priorQA = getPriorQASummary(session, 5);

  const prompt = buildOrchestratorPrompt(
    session.planContent,
    questionNum,
    session.threshold,
    priorQA,
    session.domains,
  );

  orchestratorPhase = "generating";
  pi.sendUserMessage(prompt, { deliverAs: "followUp" });
}

/**
 * Process the orchestrator's response: extract the question,
 * send it to the RPC answerer, record the response.
 */
async function processOrchestratorResponse(
  pi: ExtensionAPI,
  event: any,
  ctx: any,
): Promise<void> {
  if (!activeSession) return;

  // Extract assistant text from the agent_end event
  const assistantText = extractAgentText(event);
  if (!assistantText) return;

  // Parse the generated question
  const parsed = parseGeneratedQuestion(assistantText);
  if (!parsed) {
    // Model didn't follow format — try to extract any question-like text
    ctx.ui.setStatus("grill", `⚠️ Q${activeSession.questions.length + 1} — format error, retrying`);
    // Send a retry prompt
    await sendOrchestratorPrompt(pi, ctx);
    return;
  }

  const { question, type, domain } = parsed;
  const session = activeSession;

  // Add question to session
  addQuestion(
    session,
    question,
    (type as "scope" | "constraint" | "edge-case" | "dependency" | "rollback" | "verification") || "scope",
    domain,
  );
  writeSessionState(session, cwd);

  // Update status
  ctx.ui.setStatus(
    "grill",
    `🔥 Q${session.questions.length}/${session.threshold} — ${session.divergences.length} divergence(s)`,
  );

  // Send to RPC answerer
  orchestratorPhase = "answering";
  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      session.planContent,
      question,
      session.questions.length,
      getPriorQASummary(session, 3),
    );

    // RPC protocol: send the system prompt as part of the message context
    const fullPrompt = `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${userPrompt}`;
    const response = await rpcClient!.sendPrompt(fullPrompt);

    if (!response.text) {
      throw new Error("Empty response from answerer model");
    }

    // Parse the answerer's response
    const answererResponse = parseResponse(response.text);

    // Record the answer
    recordAnswer(session, session.questions.length - 1, answererResponse);
    writeSessionState(session, cwd);

    // Check if we've hit threshold
    if (session.questions.length >= session.threshold) {
      await completeGrillSession(pi, ctx);
      return;
    }

    // Check if answerer halted
    if (answererResponse.halted) {
      ctx.ui.notify(
        `⚠️ Answerer model flagged a fundamental issue at Q${session.questions.length}. Stopping.`,
        "warning",
      );
      await completeGrillSession(pi, ctx);
      return;
    }

    // Continue to next question
    orchestratorPhase = "generating";
    await sendOrchestratorPrompt(pi, ctx);
  } catch (err) {
    await handleGrillError(pi, ctx, err);
  }
}

// ============================================================
// Completion
// ============================================================

async function completeGrillSession(
  pi: ExtensionAPI,
  ctx: any,
): Promise<void> {
  if (!activeSession) return;

  const session = activeSession;
  session.status = "completed";
  session.completedAt = new Date().toISOString();

  const assessment = assessBoundaries(session);

  // Write session file to subject folder
  const topic = extractSubjectName(session.subjectFolder);
  const outputFile = join(
    cwd,
    CONTEXT_DIR,
    session.subjectFolder,
    `grill-auto-session-${topic}.md`,
  );

  try {
    writeSessionFile(session, outputFile);
  } catch (err) {
    console.error("[grill-auto] Failed to write session file:", err);
  }

  // Write final state
  writeSessionState(session, cwd);

  // Cleanup RPC
  cleanupRpc();

  // Clear workflow state
  clearSessionState(cwd);

  // Update UI
  ctx.ui.setStatus("grill", undefined);

  // Notify user
  const msg = [
    `✅ Grill session complete: ${session.questions.length} questions asked.`,
    `Assessment: ${assessment.assessment}`,
    `Domains: ${session.domains.map((d) => d.name).join(", ") || "none"}`,
    `Divergences: ${session.divergences.length}`,
    `Session file: ${outputFile}`,
    assessment.assessment === "boundaries_found"
      ? "Run /skill:b-phase to formalize recommended phases."
      : "Plan appears cohesive — no clear phase boundaries found.",
  ].join("\n");

  ctx.ui.notify(msg, assessment.assessment === "boundaries_found" ? "info" : "success");

  // Reset state
  activeSession = null;
  isGrilling = false;
}

// ============================================================
// Error handling
// ============================================================

async function handleGrillError(
  pi: ExtensionAPI,
  ctx: any,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[grill-auto] Error:", message);

  // Write partial session if we have one
  if (activeSession) {
    activeSession.status = "aborted";
    activeSession.completedAt = new Date().toISOString();
    try {
      writeSessionState(activeSession, cwd);
    } catch {
      // Ignore
    }
  }

  cleanupRpc();
  clearSessionState(cwd);

  ctx.ui.setStatus("grill", undefined);
  ctx.ui.notify(`🛑 Grill session aborted: ${message}`, "error");

  activeSession = null;
  isGrilling = false;
}

// ============================================================
// Cleanup
// ============================================================

function cleanupRpc(): void {
  if (rpcClient) {
    rpcClient.close();
    rpcClient = null;
  }
  activeSession = null;
  isGrilling = false;
}

// ============================================================
// Argument parsing
// ============================================================

function parseArgs(args: string): GrillConfig {
  const config: GrillConfig = {
    model: DEFAULT_MODEL,
    threshold: DEFAULT_THRESHOLD,
    planPath: null,
  };

  const parts = args.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < parts.length) {
    if (parts[i] === "--model" && i + 1 < parts.length) {
      config.model = parts[i + 1];
      i += 2;
    } else if (parts[i] === "--threshold" && i + 1 < parts.length) {
      config.threshold = parseInt(parts[i + 1], 10) || DEFAULT_THRESHOLD;
      i += 2;
    } else if (parts[i].startsWith("@")) {
      // @file reference
      config.planPath = parts[i].slice(1);
      i += 1;
    } else if (!parts[i].startsWith("-")) {
      // Bare path argument
      config.planPath = parts[i];
      i += 1;
    } else {
      i += 1;
    }
  }

  return config;
}

// ============================================================
// Plan content reading
// ============================================================

async function readPlanContent(
  ctx: any,
  planPath: string | null,
): Promise<string | null> {
  // If explicit path provided
  if (planPath) {
    const resolvedPath = planPath.startsWith("/")
      ? planPath
      : join(cwd, planPath);
    try {
      if (existsSync(resolvedPath)) {
        return readFileSync(resolvedPath, "utf-8");
      }
    } catch {
      // Fall through
    }
  }

  // Auto-detect: look for plan files in .context/ subject folders
  const contextDir = join(cwd, CONTEXT_DIR);
  if (!existsSync(contextDir)) return null;

  try {
    const entries = readdirSync(contextDir, { withFileTypes: true });
    const candidates: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.match(/^\d{4}-\d{2}-\d{2}\./)) {
        const subDir = join(contextDir, entry.name);
        try {
          const files = readdirSync(subDir);
          for (const f of files) {
            if (f.startsWith("plan-") && !f.includes("-phases")) {
              candidates.push(join(subDir, f));
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // Use the most recent plan (sorted by name = date prefix)
    if (candidates.length > 0) {
      candidates.sort().reverse();
      return readFileSync(candidates[0], "utf-8");
    }
  } catch {
    // ignore
  }

  return null;
}

// ============================================================
// Subject folder resolution
// ============================================================

function resolveSubjectFolder(ctx: any): string {
  const contextDir = join(cwd, CONTEXT_DIR);

  // Find existing subject folders
  if (existsSync(contextDir)) {
    try {
      const entries = readdirSync(contextDir, { withFileTypes: true });
      const subjects = entries
        .filter((e) => e.isDirectory() && e.name.match(/^\d{4}-\d{2}-\d{2}\./))
        .map((e) => e.name)
        .sort()
        .reverse();

      // If there's a subject folder for today, use it
      const today = new Date().toISOString().slice(0, 10);
      const todaySubjects = subjects.filter((s) => s.startsWith(today));
      if (todaySubjects.length > 0) {
        return todaySubjects[0];
      }
    } catch {
      // ignore
    }
  }

  // Create a new subject folder
  const today = new Date().toISOString().slice(0, 10);
  const subjectName = `${today}.b-grill-auto`;
  const subjectDir = join(contextDir, subjectName);
  if (!existsSync(subjectDir)) {
    mkdirSync(subjectDir, { recursive: true });
  }
  return subjectName;
}

// ============================================================
// Orchestrator prompt builder
// ============================================================

function buildOrchestratorPrompt(
  planContent: string,
  questionNum: number,
  threshold: number,
  priorQA: string,
  domains: Array<{ name: string }>,
): string {
  const domainList = domains.map((d) => d.name).join(", ") || "none yet";
  const truncated = planContent.length > 10000
    ? planContent.slice(0, 10000) + "\n\n... [truncated]"
    : planContent;

  return [
    `You are conducting an automated technical review ("grilling") of the plan below.`,
    ``,
    `## Rules`,
    `1. Generate exactly ONE grilling question at a time.`,
    `2. Each question should probe a specific aspect of the plan.`,
    `3. Questions should cover: scope, constraints, edge cases, dependencies, rollback, verification.`,
    `4. Avoid asking the same question twice.`,
    `5. Build on prior Q&A — explore unanswered areas.`,
    ``,
    `## Output Format`,
    `You MUST output exactly this format, nothing else:`,
    ``,
    `GRILL_QUESTION: <the question> | type: <scope|constraint|edge-case|dependency|rollback|verification> | domain: <domain name>`,
    ``,
    `## Current State`,
    `- Question number: ${questionNum}`,
    `- Threshold: ${threshold}`,
    `- Domains explored so far: ${domainList}`,
    ``,
    priorQA ? `## Recent Q&A\n${priorQA}\n` : "",
    `## Plan to Grill`,
    truncated,
    ``,
    `Generate question #${questionNum} now. Output ONLY the GRILL_QUESTION line.`,
  ].join("\n");
}

// ============================================================
// Question parsing
// ============================================================

function parseGeneratedQuestion(
  text: string,
): { question: string; type: GrillConfig extends { type: infer T } ? T : string; domain: string } | null {
  // Try to match the expected format
  const match = text.match(
    /GRILL_QUESTION:\s*(.+?)\s*\|\s*type:\s*(\S+)\s*\|\s*domain:\s*(.+)/i,
  );
  if (match) {
    return {
      question: match[1].trim(),
      type: match[2].trim() as any,
      domain: match[3].trim(),
    };
  }

  // Fallback: try to find any question mark
  const questionMatch = text.match(/([^.!?]{20,}?\?)/);
  if (questionMatch) {
    return {
      question: questionMatch[1].trim(),
      type: "scope",
      domain: "general",
    };
  }

  return null;
}

// ============================================================
// Utilities
// ============================================================

function parseModelId(modelId: string): [string, string] {
  const slashIdx = modelId.indexOf("/");
  if (slashIdx < 1) return ["unknown", modelId];
  return [modelId.slice(0, slashIdx), modelId.slice(slashIdx + 1)];
}

function extractAgentText(event: any): string {
  // Try different event shapes
  const msg = event?.message ?? event?.data?.message;
  if (msg?.content) {
    const texts: string[] = [];
    for (const block of msg.content) {
      if (block.type === "text" && block.text) {
        texts.push(block.text);
      }
    }
    if (texts.length > 0) return texts.join("\n");
  }

  // Fallback: try raw text field
  if (typeof msg?.text === "string") return msg.text;

  return "";
}

function extractSubjectName(subjectFolder: string): string {
  // Extract the topic part from "YYYY-MM-DD.topic-name"
  const parts = subjectFolder.split(".");
  return parts.length > 1 ? parts.slice(1).join("-") : subjectFolder;
}
