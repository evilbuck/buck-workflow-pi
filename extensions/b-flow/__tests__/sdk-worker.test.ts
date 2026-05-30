import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChunkQueueItem } from "../types.js";
import type { WorkerOptions, WorkerResult } from "../worker.js";
import { verifyResult } from "../verify-result.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrompt = vi.fn();
const mockSubscribe = vi.fn();
const mockAbort = vi.fn();
const mockDispose = vi.fn();
const mockMessages: any[] = [];

let subscribeListener: ((event: any) => void) | null = null;

function createFakeSession() {
  subscribeListener = null;
  mockPrompt.mockResolvedValue(undefined);
  mockSubscribe.mockImplementation((listener: any) => {
    subscribeListener = listener;
    return () => { subscribeListener = null; };
  });
  mockAbort.mockResolvedValue(undefined);
  mockDispose.mockReturnValue(undefined);
  mockMessages.length = 0;

  return {
    prompt: mockPrompt,
    subscribe: mockSubscribe,
    abort: mockAbort,
    dispose: mockDispose,
    get messages() { return mockMessages; },
  };
}

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: vi.fn(),
  SessionManager: {
    inMemory: vi.fn((cwd?: string) => ({ getCwd: () => cwd ?? process.cwd() })),
  },
  SettingsManager: {
    inMemory: vi.fn((opts?: any) => opts ?? {}),
  },
}));

vi.mock("@mariozechner/pi-ai", () => ({
  getModel: vi.fn((_provider: string, id: string) => ({ id, provider: _provider })),
}));

// Import after mocks
import { createAgentSession } from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";

const TEST_ROOT = join("/tmp", "bflow-sdk-test-" + Date.now());

function makeChunk(overrides?: Partial<ChunkQueueItem>): ChunkQueueItem {
  return {
    id: "test-chunk-1",
    type: "phase",
    path: join(TEST_ROOT, "chunks", "test-phase.md"),
    status: "pending",
    workerAttempts: 0,
    ...overrides,
  };
}

function makeOptions(overrides?: Partial<WorkerOptions>): WorkerOptions {
  return {
    projectRoot: TEST_ROOT,
    subject: null,
    goal: "Test goal",
    timeoutMs: 30_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runSDKWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  // --- Tool selection ---

  it("uses read-only tools for iterate chunks", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk({ type: "iterate" }), makeOptions());

    const callOpts = vi.mocked(createAgentSession).mock.calls[0][0];
    expect(callOpts?.tools).toEqual(["read", "grep", "find", "ls"]);
  });

  it("uses full coding tools for phase chunks", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk({ type: "phase" }), makeOptions());

    const callOpts = vi.mocked(createAgentSession).mock.calls[0][0];
    expect(callOpts?.tools).toEqual(["read", "bash", "edit", "write"]);
  });

  it("uses full coding tools for task chunks", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk({ type: "task" }), makeOptions());

    const callOpts = vi.mocked(createAgentSession).mock.calls[0][0];
    expect(callOpts?.tools).toEqual(["read", "bash", "edit", "write"]);
  });

  // --- Model selection ---

  it("selects model based on chunk difficulty", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk({ difficulty: "hard" }), makeOptions());

    const callOpts = vi.mocked(createAgentSession).mock.calls[0][0];
    expect(callOpts?.model).toBeDefined();
    expect((callOpts?.model as any)?.id).toBe("claude-opus-4-20250514");
  });

  it("falls back to the next configured model when the first candidate is unavailable", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    vi.mocked(getModel).mockImplementation((provider: string, id: string) => {
      if (provider === "anthropic" && id === "claude-haiku-4-20250414") return undefined as any;
      return { provider, id } as any;
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk({ difficulty: "easy" }), makeOptions());

    const callOpts = vi.mocked(createAgentSession).mock.calls[0][0];
    expect((callOpts?.model as any)?.provider).toBe("openai");
    expect((callOpts?.model as any)?.id).toBe("gpt-4o-mini");
  });

  it("prefers explicit model override over difficulty mapping", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk({ difficulty: "easy" }), makeOptions({ model: "anthropic/claude-opus-4-20250514" }));

    const callOpts = vi.mocked(createAgentSession).mock.calls[0][0];
    expect(callOpts?.model).toBeDefined();
    expect((callOpts?.model as any)?.id).toBe("claude-opus-4-20250514");
  });

  // --- Session lifecycle ---

  it("writes result file with YAML frontmatter parseable by verifyResult", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "I completed the task." });

    const { runSDKWorker } = await import("../sdk-worker.js");
    const result = await runSDKWorker(
      makeChunk({ id: "chunk-42", type: "phase" }),
      makeOptions(),
    );

    expect(result.type).toBe("WORKER_COMPLETED");
    expect(result.resultFile).toBeDefined();

    // Verify resultFile is parseable by verifyResult
    const verification = verifyResult(result.resultFile!);
    expect(verification.type).toBe("CHUNK_VERIFIED");
    expect(verification.chunkId).toBe("chunk-42");
    expect(verification.status).toBe("completed");
  });

  it("writes audit JSON with expected fields", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    const result = await runSDKWorker(
      makeChunk({ id: "audit-test" }),
      makeOptions(),
    );

    expect(result.type).toBe("WORKER_COMPLETED");

    // Find the audit file
    const auditDir = join(TEST_ROOT, ".context", "workflow", "worker-audits");
    expect(existsSync(auditDir)).toBe(true);

    const { readdirSync } = await import("node:fs");
    const files = readdirSync(auditDir);
    const auditFile = files.find((f) => f.includes("audit-test"));
    expect(auditFile).toBeDefined();

    const audit = JSON.parse(readFileSync(join(auditDir, auditFile!), "utf-8"));
    expect(audit.chunkId).toBe("audit-test");
    expect(audit.workerType).toBe("sdk");
    expect(audit.model).toBe("anthropic/claude-sonnet-4-20250514");
    expect(audit.completedAt).toBeDefined();
    expect(audit.exitCode).toBe(0);
  });

  // --- Error/timeout paths ---

  it("returns WORKER_FAILED on timeout", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    // Make prompt hang forever
    mockPrompt.mockReturnValue(new Promise(() => {}));

    const { runSDKWorker } = await import("../sdk-worker.js");
    const result = await runSDKWorker(
      makeChunk(),
      makeOptions({ timeoutMs: 50 }),
    );

    expect(result.type).toBe("WORKER_FAILED");
    expect(result.error).toContain("timed out");
  });

  it("calls abort and dispose on error", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockPrompt.mockRejectedValue(new Error("API error"));

    const { runSDKWorker } = await import("../sdk-worker.js");
    const result = await runSDKWorker(makeChunk({ id: "error-audit" }), makeOptions());

    expect(result.type).toBe("WORKER_FAILED");
    expect(result.error).toContain("API error");
    expect(mockAbort).toHaveBeenCalled();

    const auditDir = join(TEST_ROOT, ".context", "workflow", "worker-audits");
    const { readdirSync } = await import("node:fs");
    const auditFile = readdirSync(auditDir).find((f) => f.includes("error-audit"));
    const audit = JSON.parse(readFileSync(join(auditDir, auditFile!), "utf-8"));
    expect(audit.completedAt).toBeDefined();
    expect(audit.exitCode).toBe(1);
    expect(audit.error).toBe("API error");
  });

  it("always disposes session in finally block", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockPrompt.mockRejectedValue(new Error("fail"));

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk(), makeOptions());

    expect(mockDispose).toHaveBeenCalled();
  });

  // --- Tool call tracking ---

  it("captures tool calls and extracts changed files", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    // Make prompt deferred so we can emit events between subscribe and prompt resolve
    let resolvePrompt: () => void;
    mockPrompt.mockReturnValue(new Promise<void>((resolve) => {
      resolvePrompt = resolve;
    }));

    const { runSDKWorker } = await import("../sdk-worker.js");

    const promptPromise = runSDKWorker(
      makeChunk({ id: "tool-test" }),
      makeOptions(),
    );

    // Wait for subscribe to be called, then emit tool events, then resolve prompt
    await new Promise((r) => setTimeout(r, 20));
    if (subscribeListener) {
      subscribeListener({
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "edit",
        args: { path: "/some/file.ts" },
      });
      subscribeListener({
        type: "tool_execution_start",
        toolCallId: "tc2",
        toolName: "read",
        args: { path: "/some/other.ts" },
      });
      subscribeListener({
        type: "tool_execution_start",
        toolCallId: "tc3",
        toolName: "write",
        args: { path: "/new/file.ts" },
      });
    }
    resolvePrompt!();

    const result = await promptPromise;
    expect(result.type).toBe("WORKER_COMPLETED");

    // changedFiles should only include edit and write, not read
    expect(result.changedFiles).toBeDefined();
    expect(result.changedFiles!).toContain("/some/file.ts");
    expect(result.changedFiles!).toContain("/new/file.ts");
    expect(result.changedFiles!).not.toContain("/some/other.ts");
  });

  // --- Subject-aware paths ---

  it("writes results to subject folder when subject is provided", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    const result = await runSDKWorker(
      makeChunk({ id: "subj-test" }),
      makeOptions({ subject: "2026-05-30.test-subject" }),
    );

    expect(result.type).toBe("WORKER_COMPLETED");
    expect(result.resultFile).toContain("2026-05-30.test-subject");
    expect(result.resultFile).toContain("worker-results");
  });

  // --- Prompt construction ---

  it("builds prompt without resultFile mention", async () => {
    const fakeSession = createFakeSession();
    vi.mocked(createAgentSession).mockResolvedValue({
      session: fakeSession as any,
      extensionsResult: { extensions: [], errors: [], runtime: {} as any },
    });

    mockMessages.push({ role: "assistant", content: "Done" });

    const { runSDKWorker } = await import("../sdk-worker.js");
    await runSDKWorker(makeChunk({ id: "prompt-test" }), makeOptions({ goal: "Build the thing" }));

    const promptText = mockPrompt.mock.calls[0][0] as string;
    expect(promptText).toContain("Build the thing");
    expect(promptText).not.toContain("resultFile");
    expect(promptText).toContain("prompt-test");
  });
});
