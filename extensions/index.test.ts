import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BUCK_STAGE_KEYS } from "./omp-models.js";
import {
  CONVERSATION_TAIL_CHARS,
  CONVERSATION_TAIL_MESSAGES,
  INTERACTIVE_STAGE_BY_SKILL,
  conversationTail,
  wireInteractiveModelSwitch,
  type InteractiveSelectRequest,
  type InteractiveSelectResult,
} from "./interactive-model-switch.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "interactive-switch-"));
  dirs.push(dir);
  return dir;
}

function fakeApi() {
  const handlers = new Map<string, Function[]>();
  const api = {
    on: vi.fn((event: string, handler: Function) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    setModel: vi.fn(async (_model: unknown) => true),
    getThinkingLevel: vi.fn(() => "low"),
    setThinkingLevel: vi.fn(),
  };
  return { api: api as unknown as ExtensionAPI, handlers, setModel: api.setModel, setThinkingLevel: api.setThinkingLevel };
}

function host(cwd: string, messages: Array<{ role: string; content: string }> = []) {
  const models = {
    "provider/picked": { provider: "provider", id: "picked" },
    "provider/previous": { provider: "provider", id: "previous" },
  };
  return {
    cwd,
    model: models["provider/previous"],
    ui: { notify: vi.fn() },
    sessionManager: { getEntries: () => messages },
    modelRegistry: {
      getAvailable: () => Object.values(models),
      find: (provider: string, id: string) => models[`${provider}/${id}` as keyof typeof models],
    },
  };
}

async function emit(handlers: Map<string, Function[]>, event: string, payload: unknown, ctx: unknown) {
  let result: unknown;
  for (const handler of handlers.get(event) ?? []) result = await handler(payload, ctx);
  return result;
}

describe("interactive stage table", () => {
  it("covers every pinned stage except loop-only choice", () => {
    const stages = new Set(Object.values(INTERACTIVE_STAGE_BY_SKILL));
    expect([...stages].sort()).toEqual(BUCK_STAGE_KEYS.filter((key) => key !== "choice").sort());
    expect(INTERACTIVE_STAGE_BY_SKILL["b-build-hard"]).toBe("build");
    expect(INTERACTIVE_STAGE_BY_SKILL["b-grill-with-docs"]).toBe("grill");
    expect("choice" in INTERACTIVE_STAGE_BY_SKILL).toBe(false);
    expect(INTERACTIVE_STAGE_BY_SKILL["b-save-improved"]).toBeUndefined();
  });
});

describe("conversation tail", () => {
  it("keeps only the last eight user and assistant messages and drops system and tool traffic", () => {
    const messages = [
      { role: "system", content: "secret-system" },
      { role: "toolResult", content: "secret-tool" },
      ...Array.from({ length: 10 }, (_, index) => ({ role: index % 2 === 0 ? "user" : "assistant", content: `m${index}` })),
    ];
    const tail = conversationTail(messages);
    expect(tail).not.toContain("secret-system");
    expect(tail).not.toContain("secret-tool");
    expect(tail).not.toContain("m0");
    expect(tail).not.toContain("m1");
    expect(tail.split("\n")).toHaveLength(CONVERSATION_TAIL_MESSAGES);
    expect(tail.endsWith("m9")).toBe(true);
  });

  it("trims oldest content first when the tail exceeds 12000 characters", () => {
    const messages = [
      { role: "user", content: "OLD".repeat(8_000) },
      { role: "assistant", content: "NEW".repeat(8_000) },
    ];
    const tail = conversationTail(messages);
    expect(tail.length).toBe(CONVERSATION_TAIL_CHARS);
    expect(tail.startsWith("OLD")).toBe(false);
    expect(tail.endsWith("NEW")).toBe(true);
  });
});

describe("interactive host adapter", () => {
  it("switches one mapped command and restores model and thinking on agent_end", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".context", "2026-09-22.demo"), { recursive: true });
    writeFileSync(join(cwd, ".context", "2026-09-22.demo", "index.md"), "---\nstatus: active\n---\n");
    writeFileSync(join(cwd, ".context", "2026-09-22.demo", "plan-demo.md"), "# plan\n");
    mkdirSync(join(cwd, ".context", "workflow"), { recursive: true });
    const seen: InteractiveSelectRequest[] = [];
    const { api, handlers, setModel, setThinkingLevel } = fakeApi();
    wireInteractiveModelSwitch(api, {
      select: async (request) => {
        seen.push(request);
        return { ok: true, id: "provider/picked", thinking: "high" };
      },
    });
    const ctx = host(cwd, [
      { role: "system", content: "do-not-send" },
      { role: "user", content: "plan the cutover" },
    ]);
    await emit(handlers, "session_start", {}, ctx);
    const input = await emit(handlers, "input", { text: "/b-build phase-4" }, ctx);
    expect(input).toEqual({ action: "continue" });
    expect(seen[0]).toMatchObject({
      skill: "b-build",
      stage: "build",
      commandText: "/b-build phase-4",
      subjectArtifacts: [".context/2026-09-22.demo/index.md", ".context/2026-09-22.demo/plan-demo.md"],
      conversationTail: "plan the cutover",
    });
    expect(seen[0]?.conversationTail).not.toContain("do-not-send");
    expect(setModel).toHaveBeenCalledTimes(1);
    expect(setThinkingLevel).toHaveBeenCalledWith("high");

    await emit(handlers, "input", { text: "/tokens" }, ctx);
    expect(seen).toHaveLength(1);
    expect(setModel).toHaveBeenCalledTimes(1);

    await emit(handlers, "agent_end", {}, ctx);
    expect(setModel).toHaveBeenCalledTimes(2);
    expect(setModel).toHaveBeenLastCalledWith({ provider: "provider", id: "previous" });
    expect(setThinkingLevel).toHaveBeenLastCalledWith("low");
  });

  it("routes /skill:-prefixed commands to the same stage", async () => {
    const seen: InteractiveSelectRequest[] = [];
    const { api, handlers, setModel } = fakeApi();
    wireInteractiveModelSwitch(api, {
      select: async (request) => {
        seen.push(request);
        return { ok: true, id: "provider/picked", thinking: "high" };
      },
    });
    const ctx = host(tempDir());
    await emit(handlers, "session_start", {}, ctx);
    const input = await emit(handlers, "input", { text: "/skill:b-phase split the plan" }, ctx);
    expect(input).toEqual({ action: "continue" });
    expect(seen[0]).toMatchObject({ skill: "b-phase", stage: "phase" });
    expect(setModel).toHaveBeenCalledTimes(1);
  });

  it("keeps the first snapshot across two mapped commands before agent_end", async () => {
    const { api, handlers, setModel } = fakeApi();
    wireInteractiveModelSwitch(api, {
      select: async () => ({ ok: true, id: "provider/picked", thinking: "high" }),
    });
    const ctx = host(tempDir());
    setModel.mockImplementation(async (model) => {
      ctx.model = model as typeof ctx.model;
      return true;
    });
    await emit(handlers, "session_start", {}, ctx);
    await emit(handlers, "input", { text: "/b-build" }, ctx);
    await emit(handlers, "input", { text: "/b-review" }, ctx);
    await emit(handlers, "agent_end", {}, ctx);
    expect(setModel).toHaveBeenLastCalledWith({ provider: "provider", id: "previous" });
  });

  it("refuses a missing stage before the command continues and does not switch", async () => {
    const { api, handlers, setModel, setThinkingLevel } = fakeApi();
    wireInteractiveModelSwitch(api, {
      select: async (): Promise<InteractiveSelectResult> => ({
        ok: false,
        message: 'buckModels profile "work" is missing stage "build"',
      }),
    });
    const ctx = host(tempDir());
    await emit(handlers, "session_start", {}, ctx);
    const input = await emit(handlers, "input", { text: "/b-build" }, ctx);
    expect(input).toEqual({ action: "handled" });
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('stage "build"'), "error");
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("No host-default model"), "error");
    expect(setModel).not.toHaveBeenCalled();
    expect(setThinkingLevel).not.toHaveBeenCalled();
    await emit(handlers, "agent_end", {}, ctx);
    expect(setModel).not.toHaveBeenCalled();
  });

  it("restores and refuses when applying the picked model throws", async () => {
    const { api, handlers, setModel } = fakeApi();
    setModel.mockRejectedValueOnce(new Error("registry exploded"));
    wireInteractiveModelSwitch(api, {
      select: async () => ({ ok: true, id: "provider/picked", thinking: "medium" }),
    });
    const ctx = host(tempDir());
    await emit(handlers, "session_start", {}, ctx);
    const input = await emit(handlers, "input", { text: "/b-review" }, ctx);
    expect(input).toEqual({ action: "handled" });
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("registry exploded"), "error");
    await emit(handlers, "agent_end", {}, ctx);
    expect(setModel).toHaveBeenCalledTimes(2);
  });

  it("does not restore over an explicit user model change", async () => {
    const { api, handlers, setModel } = fakeApi();
    let clock = 1_000;
    wireInteractiveModelSwitch(api, {
      now: () => clock,
      select: async () => ({ ok: true, id: "provider/picked", thinking: "off" }),
    });
    const ctx = host(tempDir());
    await emit(handlers, "session_start", {}, ctx);
    await emit(handlers, "input", { text: "/b-plan" }, ctx);
    clock += 500;
    await emit(handlers, "model_select", {}, ctx);
    await emit(handlers, "agent_end", {}, ctx);
    expect(setModel).toHaveBeenCalledTimes(1);
  });
});
