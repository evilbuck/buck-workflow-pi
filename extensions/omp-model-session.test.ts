import { describe, expect, it, vi } from "vitest";

const createAgentSession = vi.fn();

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: (...args: unknown[]) => createAgentSession(...args),
  SessionManager: { inMemory: () => ({ kind: "memory" }) },
}));

import { EmptyModelResponseError } from "./omp-models.js";
import { runOmpModelSession } from "./omp-model-session.js";

describe("runOmpModelSession isolation", () => {
  it("passes caller-owned prompt, schema, empty ambient lists, and role id", async () => {
    const dispose = vi.fn();
    const prompt = vi.fn();
    createAgentSession.mockResolvedValue({
      session: {
        prompt,
        dispose,
        abort: vi.fn(),
        messages: [{ role: "assistant", content: "draft" }],
      },
    });
    const text = await runOmpModelSession({
      cwd: "/tmp",
      tools: [],
      prompt: "write memory",
      systemPrompt: "scribe",
      outputSchema: { type: "object" },
      roleId: "scribe",
      skills: [],
      rules: [],
      contextFiles: [],
      promptTemplates: [],
      slashCommands: [],
      enableIrc: false,
    });
    expect(text).toBe("draft");
    const opts = createAgentSession.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.systemPrompt).toBe("scribe");
    expect(opts.outputSchema).toEqual({ type: "object" });
    expect(opts.outputSchemaMode).toBe("strict");
    expect(opts.skills).toEqual([]);
    expect(opts.enableIrc).toBe(false);
    expect(String(opts.agentId)).toContain("b-save-scribe-");
    expect(dispose).toHaveBeenCalled();
  });
  it("preserves an explicit IRC isolation setting", async () => {
    createAgentSession.mockResolvedValue({
      session: { prompt: vi.fn(), dispose: vi.fn(), abort: vi.fn(), messages: [{ role: "assistant", content: "draft" }] },
    });
    await runOmpModelSession({ cwd: "/tmp", tools: [], prompt: "write memory", enableIrc: true });
    expect((createAgentSession.mock.calls.at(-1)![0] as Record<string, unknown>).enableIrc).toBe(true);
  });

  it("throws EmptyModelResponseError when the model returns no text", async () => {
    createAgentSession.mockResolvedValue({
      session: {
        prompt: vi.fn(),
        dispose: vi.fn(),
        abort: vi.fn(),
        messages: [{ role: "assistant", content: "" }],
      },
    });
    await expect(
      runOmpModelSession({ cwd: "/tmp", tools: [], prompt: "x" }),
    ).rejects.toBeInstanceOf(EmptyModelResponseError);
  });
});
