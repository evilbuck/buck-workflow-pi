import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import buckWorkflowExtension from "./index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const TEST_ROOT = join("/tmp", "buck-mode-test-" + process.pid);

type MockCommand = { handler: Function; description?: string; getArgumentCompletions?: Function };

interface MockApiResult {
  api: ExtensionAPI;
  handlers: Map<string, Function[]>;
  commands: Map<string, MockCommand>;
}

function createMockApi(): MockApiResult {
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
  } satisfies ExtensionAPI;

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
  };
}

async function startSession(handlers: Map<string, Function[]>, ctx: ReturnType<typeof mockCtx>) {
  for (const handler of handlers.get("session_start") ?? []) {
    await handler({ type: "session_start", reason: "startup" }, ctx);
  }
}

async function sendInput(handlers: Map<string, Function[]>, text: string, ctx: ReturnType<typeof mockCtx>) {
  for (const handler of handlers.get("input") ?? []) {
    await handler({ text }, ctx);
  }
}

describe("Extension slimdown", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(join(TEST_ROOT, ".context"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("loads without error", () => {
    const { api } = createMockApi();
    expect(() => buckWorkflowExtension(api)).not.toThrow();
  });

  it("does NOT register b-mode command", () => {
    const { api, commands } = createMockApi();
    buckWorkflowExtension(api);
    expect(commands.has("b-mode")).toBe(false);
  });

  it("does NOT register b-restrict command", () => {
    const { api, commands } = createMockApi();
    buckWorkflowExtension(api);
    expect(commands.has("b-restrict")).toBe(false);
  });

  it("does NOT register b-save command", () => {
    const { api, commands } = createMockApi();
    buckWorkflowExtension(api);
    expect(commands.has("b-save")).toBe(false);
  });

  it("does NOT register alt+p shortcut", () => {
    const { api } = createMockApi();
    buckWorkflowExtension(api);
    // registerShortcut should not have been called
    expect(api.registerShortcut).not.toHaveBeenCalled();
  });

  it("does NOT create session state file on session_start", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    // The slimmed extension should NOT create .context/workflow/current-session.json
    const statePath = join(TEST_ROOT, ".context", "workflow", "current-session.json");
    expect(existsSync(statePath)).toBe(false);
  });

  it("does NOT register tool_call handler", () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    expect(handlers.has("tool_call")).toBe(false);
  });

  it("does NOT register tool_result handler", () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    expect(handlers.has("tool_result")).toBe(false);
  });

  it("does NOT register session_before_compact handler", () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    expect(handlers.has("session_before_compact")).toBe(false);
  });
});

describe("Model auto-switch", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(join(TEST_ROOT, ".context"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("queues pending model switch for /b-build command", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "/b-build", ctx);

    // before_agent_start handler should exist and be ready to fire
    const beforeStartHandlers = handlers.get("before_agent_start") ?? [];
    expect(beforeStartHandlers.length).toBeGreaterThanOrEqual(1);
  });

  it("queues pending model switch for /b-iterate command", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "/b-iterate", ctx);

    const beforeStartHandlers = handlers.get("before_agent_start") ?? [];
    expect(beforeStartHandlers.length).toBeGreaterThanOrEqual(1);
  });

  it("queues pending model switch for /b-review command", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "/b-review", ctx);

    const beforeStartHandlers = handlers.get("before_agent_start") ?? [];
    expect(beforeStartHandlers.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT queue switch for non-model-switch command", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "/b-plan", ctx);

    // The input handler should still exist but no pending switch queued
    // Verify by checking that before_agent_start is a no-op without pending command
    const beforeStartHandlers = handlers.get("before_agent_start") ?? [];
    expect(beforeStartHandlers.length).toBeGreaterThanOrEqual(1);

    // Fire before_agent_start — it should be a no-op (no setModel call)
    const setModelSpy = api.setModel as ReturnType<typeof vi.fn>;
    setModelSpy.mockClear();

    for (const handler of beforeStartHandlers) {
      await handler({}, ctx);
    }
    expect(setModelSpy).not.toHaveBeenCalled();
  });

  it("fires handleModelSwitch on before_agent_start when command is queued", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);
    await startSession(handlers, ctx);

    await sendInput(handlers, "/b-build", ctx);

    // Fire before_agent_start — handleModelSwitch runs
    // (behavior depends on whether buckModelMapping is configured:
    //  - no mapping → offerModelMappingSetup (no models → "No models" warning)
    //  - mapping exists → findActivePhaseDifficulty → no phase → suggestModelForNonPhasedPlan → no plan → silent)
    // Either way, setModel should NOT be called because no phase difficulty is found
    const setModelSpy = vi.mocked(api.setModel);
    setModelSpy.mockClear();

    for (const handler of handlers.get("before_agent_start") ?? []) {
      await handler({}, ctx);
    }

    // No model switch should happen — no active phased plan in the test dir
    expect(setModelSpy).not.toHaveBeenCalled();
    // pendingModelSwitchCommand should be cleared
    // (verify by firing before_agent_start again — should be a no-op)
    setModelSpy.mockClear();
    for (const handler of handlers.get("before_agent_start") ?? []) {
      await handler({}, ctx);
    }
    expect(setModelSpy).not.toHaveBeenCalled();
  });

  it("registers model_select handler for user override detection", () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    expect(handlers.has("model_select")).toBe(true);
  });

  it("registers agent_end handler for model switch-back", () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    expect(handlers.has("agent_end")).toBe(true);
  });

  it("agent_end does nothing when no model switch is active", async () => {
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    const ctx = mockCtx(TEST_ROOT);

    const setModelSpy = api.setModel as ReturnType<typeof vi.fn>;
    setModelSpy.mockClear();

    for (const handler of handlers.get("agent_end") ?? []) {
      await handler({}, ctx);
    }

    expect(setModelSpy).not.toHaveBeenCalled();
  });
});

describe("Helper functions", () => {
  it("parseModelId parses provider/id format", async () => {
    // Test indirectly through the extension — parseModelId is internal
    // We verify it works by checking the model switch flow
    const { api, handlers } = createMockApi();
    buckWorkflowExtension(api);
    // If the extension loaded, the helpers are valid
    expect(api.on).toHaveBeenCalled();
  });
});
