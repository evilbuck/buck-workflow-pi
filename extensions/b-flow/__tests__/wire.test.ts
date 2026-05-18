import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rmSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wire } from "../index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const TEST_ROOT = join("/tmp", "bflow-wire-test-" + Date.now());

function createMockApi(): {
  api: ExtensionAPI;
  handlers: Map<string, Function[]>;
  commands: Map<string, { handler: Function; description?: string }>;
} {
  const handlers = new Map<string, Function[]>();
  const commands = new Map<string, { handler: Function; description?: string }>();

  const api = {
    on: vi.fn((event: string, handler: Function) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    registerCommand: vi.fn((name: string, opts: { handler: Function; description?: string }) => {
      commands.set(name, opts);
    }),
    registerTool: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
    registerMessageRenderer: vi.fn(),
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
    appendEntry: vi.fn(),
    setSessionName: vi.fn(),
    getSessionName: vi.fn(),
    setLabel: vi.fn(),
    exec: vi.fn(),
    getActiveTools: vi.fn(() => []),
    getAllTools: vi.fn(() => []),
    setActiveTools: vi.fn(),
    getCommands: vi.fn(() => []),
    setModel: vi.fn(),
    getThinkingLevel: vi.fn(),
    setThinkingLevel: vi.fn(),
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  } as unknown as ExtensionAPI;

  return { api, handlers, commands };
}

function mockCtx(cwd: string) {
  return {
    cwd,
    ui: {
      notify: vi.fn(),
      select: vi.fn(),
      confirm: vi.fn(),
      input: vi.fn(),
      setStatus: vi.fn(),
      setWorkingMessage: vi.fn(),
      setWorkingVisible: vi.fn(),
      setWorkingIndicator: vi.fn(),
      setHiddenThinkingLabel: vi.fn(),
      setWidget: vi.fn(),
      setFooter: vi.fn(),
      setHeader: vi.fn(),
      setTitle: vi.fn(),
      custom: vi.fn(),
      pasteToEditor: vi.fn(),
      setEditorText: vi.fn(),
      getEditorText: vi.fn(),
      editor: vi.fn(),
      addAutocompleteProvider: vi.fn(),
      setEditorComponent: vi.fn(),
      getEditorComponent: vi.fn(),
      theme: {} as any,
      getAllThemes: vi.fn(() => []),
      getTheme: vi.fn(),
      setTheme: vi.fn(),
      getToolsExpanded: vi.fn(),
      setToolsExpanded: vi.fn(),
      onTerminalInput: vi.fn(() => () => {}),
    },
    hasUI: true,
    sessionManager: {} as any,
    modelRegistry: {} as any,
    model: undefined,
    isIdle: vi.fn(() => true),
    signal: undefined,
    abort: vi.fn(),
    hasPendingMessages: vi.fn(() => false),
    shutdown: vi.fn(),
    getContextUsage: vi.fn(),
    compact: vi.fn(),
    getSystemPrompt: vi.fn(),
  } as any;
}

describe("wire (index.ts)", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("registers the b-flow command", () => {
    const { api, commands } = createMockApi();
    wire(api);
    expect(commands.has("b-flow")).toBe(true);
    expect(commands.get("b-flow")!.description).toContain("Buck workflow");
  });

  it("registers a session_start handler", () => {
    const { api, handlers } = createMockApi();
    wire(api);
    expect(handlers.has("session_start")).toBe(true);
    expect(handlers.get("session_start")!.length).toBe(1);
  });

  it("session_start handler does NOT create an actor or start the machine", async () => {
    const { api, handlers, commands } = createMockApi();
    wire(api);

    const workflowDir = join(TEST_ROOT, ".context", "workflow");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "orchestration.json"),
      JSON.stringify({
        version: 1,
        goal: "active goal",
        currentState: "decomposing",
        subject: null,
        startedAt: "2026-05-09T00:00:00Z",
        updatedAt: "2026-05-09T00:00:00Z",
        history: [],
        queue: [],
        workerAttemptCount: 0,
      }),
    );

    const sessionStartHandler = handlers.get("session_start")![0];
    const ctx = mockCtx(TEST_ROOT);
    await sessionStartHandler({ type: "session_start", reason: "startup" }, ctx);

    const notifyCalls = ctx.ui.notify.mock.calls;
    expect(notifyCalls.length).toBe(0);
  });

  it("status command works without starting the actor", async () => {
    const { api, commands } = createMockApi();
    wire(api);

    const ctx = mockCtx(TEST_ROOT);

    const handler = commands.get("b-flow")!.handler;
    await handler("status", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("No active b-flow session"),
      "info",
    );
  });

  it("start command creates the actor and transitions from idle", async () => {
    const { api, commands } = createMockApi();
    wire(api);

    const ctx = mockCtx(TEST_ROOT);

    const handler = commands.get("b-flow")!.handler;
    await handler("start test goal", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("b-flow started"),
      "info",
    );
  });

  it("status shows goal and state after start", async () => {
    const { api, commands } = createMockApi();
    wire(api);

    const ctx = mockCtx(TEST_ROOT);
    const handler = commands.get("b-flow")!.handler;

    await handler("start my goal", ctx);
    ctx.ui.notify.mockClear();

    await handler("status", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("my goal"),
      "info",
    );
  });

  it("stop command transitions to aborted and clears the actor", async () => {
    const { api, commands } = createMockApi();
    wire(api);

    const ctx = mockCtx(TEST_ROOT);
    const handler = commands.get("b-flow")!.handler;

    await handler("start stop test", ctx);
    ctx.ui.notify.mockClear();

    await handler("stop", ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("stopped"),
      "info",
    );

    ctx.ui.notify.mockClear();
    await handler("status", ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("aborted"),
      "info",
    );
  });

  it("registers a session_before_compact handler", () => {
    const { api, handlers } = createMockApi();
    wire(api);
    expect(handlers.has("session_before_compact")).toBe(true);
  });

  it("compact hook returns summary when projection exists", async () => {
    const { api, handlers } = createMockApi();
    wire(api);

    const workflowDir = join(TEST_ROOT, ".context", "workflow");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "orchestration.json"),
      JSON.stringify({
        version: 1,
        goal: "compact test",
        currentState: "decomposing",
        subject: null,
        startedAt: "2026-05-09T00:00:00Z",
        updatedAt: "2026-05-09T00:00:00Z",
        history: [],
        queue: [],
        workerAttemptCount: 0,
      }),
    );

    const ctx = mockCtx(TEST_ROOT);
    const handler = (_commands: any) => {
      const cmdHandler = handlers.get("session_start")![0];
      return cmdHandler;
    };

    const startHandler = handlers.get("session_start")![0];
    await startHandler({ type: "session_start", reason: "startup" }, ctx);

    const compactHandler = handlers.get("session_before_compact")![0];
    const result = await compactHandler(
      {
        type: "session_before_compact",
        preparation: {
          firstKeptEntryId: "entry-1",
          tokensBefore: 50000,
        },
        branchEntries: [],
        signal: undefined,
      },
      ctx,
    );

    expect(result.compaction.summary).toContain("compact test");
    expect(result.compaction.summary).toContain("decomposing");
    expect(result.compaction.firstKeptEntryId).toBe("entry-1");
    expect(result.compaction.tokensBefore).toBe(50000);
  });
});
