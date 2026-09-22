/**
 * jev-tool tests — generic TypeSafe systemOne tool with fail-closed behavior.
 * All tests use a fake client; the real SDK is never contacted.
 */
import { describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { wire, type JevClient, type JevRequest } from "../index.js";

interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  details: unknown;
}

type ExecuteFn = (
  toolCallId: string,
  params: JevRequest,
) => Promise<ToolResult>;

interface WiredTool {
  name: string;
  execute: ExecuteFn;
}

/** Repo convention: partial ExtensionAPI double, narrowed at the wire boundary. */
function makeApi() {
  const tools = new Map<string, WiredTool>();
  const api = {
    registerCommand: vi.fn(),
    registerTool: vi.fn((def: unknown) => {
      const tool = def as WiredTool;
      tools.set(tool.name, tool);
    }),
  };
  return { api: api as unknown as ExtensionAPI, tools };
}

const NoulAnswer = { type: "noul", noul: 0.82 } as const;
const ScoreAnswer = {
  type: "score", score: 2, confidence: 0.8,
  legend: { 0: "low", 1: "mid", 2: "high" },
  probabilities: { 0: 0.05, 1: 0.15, 2: 0.8 },
} as const;

/** Type guard over the questions map: extracts the declared question type. */
function questionType(q: unknown): string {
  if (typeof q === "object" && q !== null && "type" in q) {
    const t = q.type;
    if (typeof t === "string") return t;
  }
  return "";
}

function fakeAnswer(type: string): unknown {
  if (type === "noul") return NoulAnswer;
  if (type === "choice") {
    return { type: "choice", choice: "a", confidence: 0.9, probabilities: { a: 0.9, b: 0.1 } };
  }
  return ScoreAnswer;
}

function fakeClient(overrides: Partial<JevClient> = {}): JevClient {
  const impl = async (request: JevRequest) => {
    const answers: Record<string, unknown> = {};
    for (const [name, q] of Object.entries(request.questions)) {
      answers[name] = fakeAnswer(questionType(q));
    }
    return { model: "jev-latest", answers, usage: { input_tokens: 10, output_tokens: 5 } };
  };
  return {
    systemOne: Object.assign(vi.fn(impl), {}),
    ...overrides,
  };
}

function textOf(result: ToolResult): string {
  return result.content.map((c) => c.text ?? "").join("");
}

describe("jev tool", () => {
  it("registers from wire", () => {
    const { api, tools } = makeApi();
    wire(api, { createClient: () => fakeClient() });
    expect(api.registerTool).toHaveBeenCalledOnce();
    expect(tools.get("jev")?.name).toBe("jev");
  });

  it("passes through a noul answer with model and usage", async () => {
    const { api, tools } = makeApi();
    const client = fakeClient();
    wire(api, { createClient: () => client });
    const result = await tools.get("jev")!.execute("t1", {
      state: "phase designs parts",
      questions: { phase_1_hard: { type: "noul", instructions: "Is this phase hard?" } },
    });
    const parsed = JSON.parse(textOf(result)) as Record<string, unknown>;
    expect(parsed.answers).toEqual({ phase_1_hard: NoulAnswer });
    expect(parsed.model).toBe("jev-latest");
    expect(parsed.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    expect(result.details).toEqual(parsed);
  });

  it("passes through mixed noul, choice, and score questions", async () => {
    const { api, tools } = makeApi();
    wire(api, { createClient: () => fakeClient() });
    const result = await tools.get("jev")!.execute("t1", {
      state: "s",
      questions: {
        hard: { type: "noul", instructions: "hard?" },
        pick: { type: "choice", instructions: "pick one", criteria: { a: "first", b: "second" } },
        rate: { type: "score", instructions: "rate", criteria: ["low", "mid", "high"] },
      },
    });
    const parsed = JSON.parse(textOf(result)) as { answers: Record<string, { type: string }> };
    expect(parsed.answers.hard.type).toBe("noul");
    expect(parsed.answers.pick.type).toBe("choice");
    expect(parsed.answers.rate.type).toBe("score");
  });

  it("forwards an explicit model override", async () => {
    const { api, tools } = makeApi();
    const client = fakeClient();
    wire(api, { createClient: () => client });
    await tools.get("jev")!.execute("t1", {
      state: "s",
      questions: { q: { type: "noul" } },
      model: "jev-2",
    });
    expect(client.systemOne).toHaveBeenCalledWith(
      expect.objectContaining({ model: "jev-2" }),
    );
  });

  it("returns one actionable failure for empty questions", async () => {
    const { api, tools } = makeApi();
    const client = fakeClient();
    wire(api, { createClient: () => client });
    const result = await tools.get("jev")!.execute("t1", { state: "s", questions: {} });
    expect(client.systemOne).not.toHaveBeenCalled();
    const parsed = JSON.parse(textOf(result)) as { error: boolean; message: string };
    expect(parsed.error).toBe(true);
    expect(parsed.message).toMatch(/question/i);
  });

  it("returns one actionable failure for an unknown question type", async () => {
    const { api, tools } = makeApi();
    const client = fakeClient();
    wire(api, { createClient: () => client });
    const result = await tools.get("jev")!.execute("t1", {
      state: "s",
      questions: { q: { type: "essay", instructions: "write" } },
    });
    expect(client.systemOne).not.toHaveBeenCalled();
    const parsed = JSON.parse(textOf(result)) as { error: boolean; message: string };
    expect(parsed.error).toBe(true);
    expect(parsed.message).toMatch(/essay/);
  });

  it("fails closed on missing API key (client construction throws)", async () => {
    const { api, tools } = makeApi();
    wire(api, {
      createClient: () => {
        throw new Error("The API key is missing");
      },
    });
    const result = await tools.get("jev")!.execute("t1", {
      state: "s",
      questions: { q: { type: "noul" } },
    });
    const parsed = JSON.parse(textOf(result)) as { error: boolean; message: string };
    expect(parsed.error).toBe(true);
    expect(parsed.message).toMatch(/api key/i);
  });

  it("fails closed on SDK failure without any fallback", async () => {
    const { api, tools } = makeApi();
    const client = fakeClient({
      systemOne: vi.fn(async () => {
        throw new Error("503 upstream");
      }),
    });
    wire(api, { createClient: () => client });
    const result = await tools.get("jev")!.execute("t1", {
      state: "s",
      questions: { q: { type: "noul" } },
    });
    const parsed = JSON.parse(textOf(result)) as { error: boolean; message: string };
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain("503");
  });
});
