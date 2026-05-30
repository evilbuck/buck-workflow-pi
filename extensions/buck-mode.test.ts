import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import buckWorkflowExtension from "./index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const TEST_ROOT = join("/tmp", "buck-mode-test-" + process.pid);

type MockCommand = { handler: Function; description?: string; getArgumentCompletions?: Function };

function createMockApi(): {
  api: ExtensionAPI;
  handlers: Map<string, Function[]>;
  commands: Map<string, MockCommand>;
} {
  const handlers = new Map<string, Function[]>();
  const commands = new Map<string, MockCommand>();

  const api = {
    on: vi.fn((event: string, handler: Function) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    registerCommand: vi.fn((name: string, opts: MockCommand) => {
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
      theme: { fg: (_kind: string, text: string) => text },
      getAllThemes: vi.fn(() => []),
      getTheme: vi.fn(),
      setTheme: vi.fn(),
      getToolsExpanded: vi.fn(),
      setToolsExpanded: vi.fn(),
      onTerminalInput: vi.fn(() => () => {}),
    },
    hasUI: true,
    sessionManager: { getEntries: vi.fn(() => []) },
    modelRegistry: { getAvailable: vi.fn(() => []), find: vi.fn(), getApiKeyAndHeaders: vi.fn() },
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

async function startSession(handlers: Map<string, Function[]>, ctx: any) {
  for (const handler of handlers.get("session_start") ?? []) {
    await handler({ type: "session_start", reason: "startup" }, ctx);
  }
}

async function sendInput(handlers: Map<string, Function[]>, text: string, ctx: any) {
  for (const handler of handlers.get("input") ?? []) {
    await handler({ text }, ctx);
  }
}

function readState(root = TEST_ROOT): any {
  return JSON.parse(readFileSync(join(root, ".context", "workflow", "current-session.json"), "utf-8"));
}

describe("Buck workflow mode", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(join(TEST_ROOT, ".context"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("registers /b-mode and toggles mode state manually", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    expect(commands.has("b-mode")).toBe(true);

    await commands.get("b-mode")!.handler("on", ctx);
    let state = readState();
    expect(state.buck_workflow_mode_active).toBe(true);
    expect(state.plan_mode_active).toBe(true);
    expect(state.buck_workflow_mode_source).toBe("manual");
    expect(state.buck_workflow_mode_auto_disabled).toBe(false);

    await commands.get("b-mode")!.handler("off", ctx);
    state = readState();
    expect(state.buck_workflow_mode_active).toBe(false);
    expect(state.plan_mode_active).toBe(false);
    expect(state.buck_workflow_mode_auto_disabled).toBe(true);
  });

  it("does NOT auto-enable planning guard - opt-in only", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "Please create a plan for this change", ctx);

    const state = readState();
    expect(state.buck_workflow_mode_active).toBe(false);
    expect(state.plan_mode_active).toBe(false);
    expect(state.buck_workflow_mode_source).toBe(null);
  });

  it("does NOT auto-enable Buck mode for workflow-shaped input - opt-in only", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "Implement the remaining work and include handoff notes", ctx);

    const state = readState();
    expect(state.buck_workflow_mode_active).toBe(false);
    expect(state.plan_mode_active).toBe(false);
    expect(state.buck_workflow_mode_source).toBe(null);
  });

  it("no auto-enable means manual off has nothing to suppress", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await commands.get("b-mode")!.handler("off", ctx);
    await sendInput(handlers, "Please create a plan for this change", ctx);

    const state = readState();
    expect(state.buck_workflow_mode_active).toBe(false);
    expect(state.plan_mode_active).toBe(false);
    expect(state.buck_workflow_mode_auto_disabled).toBe(true);
    expect(state.workflow_intent_count).toBe(0);
  });

  it("/b-plan command enables Buck mode and leaves planning guard active", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "/b-plan", ctx);

    const state = readState();
    expect(state.commands_run.at(-1).command).toBe("b-plan");
    expect(state.buck_workflow_mode_active).toBe(true);
    expect(state.plan_mode_active).toBe(true);
    expect(state.buck_workflow_mode_source).toBe("command");
  });
});

describe("CWD restriction mode", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(join(TEST_ROOT, ".context"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("registers /b-restrict command", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    expect(commands.has("b-restrict")).toBe(true);
  });

  it("default state has restrict_cwd_active: true", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    const state = readState();
    expect(state.restrict_cwd_active).toBe(true);
  });

  it("/b-restrict off disables restriction", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await commands.get("b-restrict")!.handler("off", ctx);

    const state = readState();
    expect(state.restrict_cwd_active).toBe(false);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "🔓 CWD restriction disabled — all write paths allowed",
      "info",
    );
  });

  it("/b-restrict on enables restriction", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // First disable it
    await commands.get("b-restrict")!.handler("off", ctx);
    let state = readState();
    expect(state.restrict_cwd_active).toBe(false);

    // Then re-enable
    await commands.get("b-restrict")!.handler("on", ctx);
    state = readState();
    expect(state.restrict_cwd_active).toBe(true);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "🔒 CWD restriction enabled — writes outside project directory are blocked",
      "info",
    );
  });

  it("/b-restrict status shows current state", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await commands.get("b-restrict")!.handler("status", ctx);

    // Default is active
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("active 🔒"),
      "info",
    );
  });

  it("/b-restrict status shows inactive when disabled", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await commands.get("b-restrict")!.handler("off", ctx);
    await commands.get("b-restrict")!.handler("status", ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("inactive 🔓"),
      "info",
    );
  });

  it("tool_call blocks write outside CWD when active", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // Get the tool_call handler
    const toolCallHandler = handlers.get("tool_call")![0];

    // Simulate write tool call outside CWD
    const result = await toolCallHandler(
      { toolName: "write", input: { path: "/tmp/test.txt", content: "test" } },
      ctx,
    );

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("outside project directory"),
    });
  });

  it("tool_call allows write inside CWD when active", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // Get the tool_call handler
    const toolCallHandler = handlers.get("tool_call")![0];

    // Simulate write tool call inside CWD (relative path)
    const result = await toolCallHandler(
      { toolName: "write", input: { path: "src/test.ts", content: "test" } },
      ctx,
    );

    expect(result).toBeUndefined();
  });

  it("tool_call allows write outside CWD when inactive", async () => {
    const { api, handlers, commands } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // Disable restriction
    await commands.get("b-restrict")!.handler("off", ctx);

    // Get the tool_call handler
    const toolCallHandler = handlers.get("tool_call")![0];

    // Simulate write tool call outside CWD
    const result = await toolCallHandler(
      { toolName: "write", input: { path: "/tmp/test.txt", content: "test" } },
      ctx,
    );

    expect(result).toBeUndefined();
  });

  it("tool_call blocks edit outside CWD when active", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // Get the tool_call handler
    const toolCallHandler = handlers.get("tool_call")![0];

    // Simulate edit tool call outside CWD
    const result = await toolCallHandler(
      { toolName: "edit", input: { path: "/etc/config.conf" } },
      ctx,
    );

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("outside project directory"),
    });
  });

  it("tool_call allows edit inside CWD when active", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // Get the tool_call handler
    const toolCallHandler = handlers.get("tool_call")![0];

    // Simulate edit tool call inside CWD
    const result = await toolCallHandler(
      { toolName: "edit", input: { path: "./src/index.ts" } },
      ctx,
    );

    expect(result).toBeUndefined();
  });

  it("allows absolute path within CWD", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // Get the tool_call handler
    const toolCallHandler = handlers.get("tool_call")![0];

    // Simulate write tool call with absolute path inside CWD
    const result = await toolCallHandler(
      { toolName: "write", input: { path: `${TEST_ROOT}/src/test.ts`, content: "test" } },
      ctx,
    );

    expect(result).toBeUndefined();
  });
});
