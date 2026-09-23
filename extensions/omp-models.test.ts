import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as PiCodingAgent from "@mariozechner/pi-coding-agent";
const { createAgentSessionMock } = vi.hoisted(() => ({ createAgentSessionMock: vi.fn() }));

vi.mock("@mariozechner/pi-coding-agent", async () => {
  const actual = await vi.importActual<typeof PiCodingAgent>("@mariozechner/pi-coding-agent");
  return { ...actual, createAgentSession: createAgentSessionMock };
});

import {
  DIFFICULTY_TO_ROLE,
  EmptyModelResponseError,
  lastAssistantText,
  mappingFromOmpRoles,
  normalizeActivityEvent,
  parseModelRoles,
  parsePhaseDifficulty,
  phaseDifficultyToTier,
  readOmpModelRoles,
  resolveOmpRole,
  runOmpModelSession,
} from "./omp-models.js";

const dirs: string[] = [];

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "omp-models-"));
  dirs.push(dir);
  return dir;
}

function writeRoles(dir: string, body: string): void {
  mkdirSync(join(dir, ".omp"), { recursive: true });
  writeFileSync(join(dir, ".omp", "config.yml"), body);
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  createAgentSessionMock.mockReset();
});

describe("parseModelRoles", () => {
  it("reads indented role keys and stops at the next top-level key", () => {
    const roles = parseModelRoles([
      "theme: dark",
      "modelRoles:",
      "  default: xai-oauth/grok-4.6:xhigh",
      "  slow: zai-glm/glm-5.3:max",
      "  smol: minimax-code/MiniMax-M3:minimal",
      "other: 1",
    ].join("\n"));
    expect(roles).toEqual({
      default: "xai-oauth/grok-4.6:xhigh",
      slow: "zai-glm/glm-5.3:max",
      smol: "minimax-code/MiniMax-M3:minimal",
    });
  });
});

describe("readOmpModelRoles / resolveOmpRole", () => {
  it("prefers project .omp/config.yml over a Pi buckModelMapping file", () => {
    const dir = tmp();
    writeRoles(dir, [
      "modelRoles:",
      "  default: xai-oauth/grok-4.6:xhigh",
      "  slow: zai-glm/glm-5.3:max",
      "  smol: minimax-code/MiniMax-M3:minimal",
      "",
    ].join("\n"));
    mkdirSync(join(dir, ".pi", "agent"), { recursive: true });
    writeFileSync(
      join(dir, ".pi", "agent", "settings.json"),
      JSON.stringify({ buckModelMapping: { easy: "pi/easy", medium: "pi/medium", hard: "pi/hard" } }),
    );
    expect(resolveOmpRole(dir, "slow")).toBe("zai-glm/glm-5.3:max");
    expect(resolveOmpRole(dir, "smol")).toBe("minimax-code/MiniMax-M3:minimal");
    expect(resolveOmpRole(dir, "missing")).toBe("xai-oauth/grok-4.6:xhigh");
  });

  it("returns empty roles when no OMP config exists in the project", () => {
    const dir = tmp();
    const prev = process.env.OMP_AGENT_DIR;
    process.env.OMP_AGENT_DIR = join(dir, "no-such-agent");
    try {
      expect(readOmpModelRoles(dir)).toEqual({});
      expect(resolveOmpRole(dir, "slow")).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.OMP_AGENT_DIR;
      else process.env.OMP_AGENT_DIR = prev;
    }
  });
});

describe("mappingFromOmpRoles", () => {
  it("maps easy→smol, medium→slow, hard→default", () => {
    const dir = tmp();
    writeRoles(dir, [
      "modelRoles:",
      "  default: xai-oauth/grok-4.6:xhigh",
      "  slow: zai-glm/glm-5.3:max",
      "  smol: minimax-code/MiniMax-M3:minimal",
      "",
    ].join("\n"));
    expect(mappingFromOmpRoles(dir)).toEqual({
      easy: "minimax-code/MiniMax-M3:minimal",
      medium: "zai-glm/glm-5.3:max",
      hard: "xai-oauth/grok-4.6:xhigh",
    });
  });

  it("fills missing tiers from default", () => {
    const dir = tmp();
    writeRoles(dir, "modelRoles:\n  default: only/default\n");
    expect(mappingFromOmpRoles(dir)).toEqual({
      easy: "only/default",
      medium: "only/default",
      hard: "only/default",
    });
  });
});

describe("parsePhaseDifficulty", () => {
  it("recognizes binary values", () => {
    expect(parsePhaseDifficulty("hard")).toBe("hard");
    expect(parsePhaseDifficulty("not-hard")).toBe("not-hard");
    expect(parsePhaseDifficulty(" HARD ")).toBe("hard");
  });

  it("maps legacy easy and medium to not-hard", () => {
    expect(parsePhaseDifficulty("easy")).toBe("not-hard");
    expect(parsePhaseDifficulty("medium")).toBe("not-hard");
  });

  it("defaults absent and unknown values to not-hard", () => {
    expect(parsePhaseDifficulty(undefined)).toBe("not-hard");
    expect(parsePhaseDifficulty("")).toBe("not-hard");
    expect(parsePhaseDifficulty("unknown")).toBe("not-hard");
  });
});

describe("phaseDifficultyToTier", () => {
  it("maps hard to the hard model tier and not-hard to medium", () => {
    expect(phaseDifficultyToTier("hard")).toBe("hard");
    expect(phaseDifficultyToTier("not-hard")).toBe("medium");
  });

  it("leaves review Hardness as a three-tier DifficultyTier domain", () => {
    expect(DIFFICULTY_TO_ROLE).toEqual({
      easy: ["smol", "tiny", "task"],
      medium: ["slow", "task", "default"],
      hard: ["default", "plan", "slow"],
    });
    expect(Object.keys(DIFFICULTY_TO_ROLE)).toEqual(["easy", "medium", "hard"]);
  });
});

describe("lastAssistantText", () => {
  it("reads string content and OMP array text blocks", () => {
    expect(lastAssistantText([{ role: "assistant", content: "plain" }])).toBe("plain");
    expect(lastAssistantText([{
      role: "assistant",
      content: [
        { type: "thinking", thinking: "ignore" },
        { type: "text", text: "kept" },
      ],
    }])).toBe("kept");
  });
});

describe("EmptyModelResponseError", () => {
  it("reports an absent assistant message and provider diagnostics", () => {
    expect(new EmptyModelResponseError([]).message).toBe("Model completed without an assistant message.");
    expect(new EmptyModelResponseError([{
      role: "assistant",
      content: [{ type: "thinking" }],
      stopReason: "error",
      errorMessage: "model missing",
    }]).message).toBe(
      "Model returned no text (stop reason: error; error: model missing; content blocks: thinking).",
    );
  });
});

describe("runOmpModelSession", () => {
  it("injects the requested temperature into the model stream", async () => {
    const observed: Array<Record<string, unknown>> = [];
    const streamFn = vi.fn((_model: unknown, _context: unknown, options: Record<string, unknown>) => {
      observed.push(options);
      return Promise.resolve();
    });
    const session = {
      agent: { streamFn },
      prompt: async () => {
        await session.agent.streamFn("model", [], {});
      },
      messages: [{ role: "assistant", content: "review complete" }],
      subscribe: () => () => undefined,
      abort: async () => undefined,
      dispose: async () => undefined,
    };
    createAgentSessionMock.mockResolvedValue({ session });

    await runOmpModelSession({
      cwd: tmp(),
      prompt: "review",
      tools: ["read"],
      temperature: 0.4,
      timeoutMs: 1_000,
    });

    expect(observed).toEqual([{ temperature: 0.4 }]);
  });
});


describe("normalizeActivityEvent", () => {
  it("text_delta passes through with delta", () => {
    expect(normalizeActivityEvent({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "hello" } }))
      .toEqual({ kind: "text", delta: "hello" });
  });

  it("non-text_delta message_update returns null", () => {
    expect(normalizeActivityEvent({ type: "message_update", assistantMessageEvent: { type: "thinking" } })).toBeNull();
    expect(normalizeActivityEvent({ type: "message_update" })).toBeNull();
  });

  it("tool_execution_start extracts allowlisted target metadata only", () => {
    expect(normalizeActivityEvent({ type: "tool_execution_start", toolName: "read", args: { path: "/etc/passwd", env: "x" } }))
      .toEqual({ kind: "toolStart", tool: "read", target: "/etc/passwd" });
    expect(normalizeActivityEvent({ type: "tool_execution_start", toolName: "edit", args: { raw_prompt: "secret" } }))
      .toEqual({ kind: "toolStart", tool: "edit" });
  });

  it("tool_execution_end flags failure and surfaces the message", () => {
    expect(normalizeActivityEvent({ type: "tool_execution_end", toolName: "bash", isError: true, result: { message: "boom" } }))
      .toEqual({ kind: "toolEnd", tool: "bash", ok: false, message: "boom" });
    expect(normalizeActivityEvent({ type: "tool_execution_end", toolName: "read" }))
      .toEqual({ kind: "toolEnd", tool: "read", ok: true });
  });

  it("tool_execution_end failure with an error.message object surfaces the message", () => {
    expect(normalizeActivityEvent({
      type: "tool_execution_end",
      toolName: "edit",
      isError: true,
      result: { error: { message: "permission denied" } },
    })).toEqual({ kind: "toolEnd", tool: "edit", ok: false, message: "permission denied" });
  });

  it("tool_execution_end failure with a string error surfaces the string", () => {
    expect(normalizeActivityEvent({
      type: "tool_execution_end",
      toolName: "edit",
      isError: true,
      result: { error: "string error" },
    })).toEqual({ kind: "toolEnd", tool: "edit", ok: false, message: "string error" });
  });

  it("tool_execution_end failure with a string result surfaces the result string", () => {
    expect(normalizeActivityEvent({
      type: "tool_execution_end",
      toolName: "bash",
      isError: true,
      result: "command not found",
    })).toEqual({ kind: "toolEnd", tool: "bash", ok: false, message: "command not found" });
  });

  it("auto_retry_start reads errorMessage", () => {
    expect(normalizeActivityEvent({ type: "auto_retry_start", errorMessage: "429 too many requests" }))
      .toEqual({ kind: "retry", message: "429 too many requests" });
    expect(normalizeActivityEvent({ type: "auto_retry_start" }))
      .toEqual({ kind: "retry", message: "model retry" });
  });

  it("agent_end always reports completion", () => {
    expect(normalizeActivityEvent({ type: "agent_end", messages: [] }))
      .toEqual({ kind: "complete", ok: true, message: "agent finished" });
  });

  it("ignores unknown event types", () => {
    expect(normalizeActivityEvent({ type: "session_status", sessionId: "abc" })).toBeNull();
  });
});
