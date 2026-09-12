import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EmptyModelResponseError,
  lastAssistantText,
  mappingFromOmpRoles,
  normalizeActivityEvent,
  parseModelRoles,
  readOmpModelRoles,
  resolveOmpRole,
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
