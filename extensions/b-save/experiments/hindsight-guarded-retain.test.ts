import { describe, expect, it } from "vitest";
import { inspectSdkSources } from "./hindsight-guarded-retain.js";

const RESTRICTED_CUSTOM_TOOLS = `
export interface CreateAgentSessionOptions {
  customTools?: unknown[];
  toolNames?: string[];
  restrictToolNames?: boolean;
  /**
   * Permit only caller-supplied SDK custom tools inside a restricted session.
   * They must still be named in toolNames.
   */
  allowRestrictedCustomTools?: boolean;
}

const sdkCustomTools =
  restrictToolNames && options.allowRestrictedCustomTools !== true
    ? []
    : (options.customTools ?? []);
`;

const SKIP_MEMORY_TOOLS = `
const memoryBackend = restrictToolNames ? undefined : await resolveMemoryBackend(settings);
createMemoryTools: restrictToolNames
  ? undefined
  : async () => {
      const tools = await Promise.all(MEMORY_BACKEND_TOOL_NAMES.map(name => BUILTIN_TOOLS[name](toolSession)));
      return tools.filter(Boolean);
    },
`;

const KEEP_MEMORY_TOOLS = `
const memoryBackend = await resolveMemoryBackend(settings);
createMemoryTools: async () => {
  const tools = await Promise.all(MEMORY_BACKEND_TOOL_NAMES.map(name => BUILTIN_TOOLS[name](toolSession)));
  return tools.filter(Boolean);
},
`;

const INVOKE_TOOL_SAME_NAME = `
/**
 * Delegation is same-tool only: it invokes the built-in of the SAME name as the registering tool,
 * never an arbitrary target.
 */
invokeTool?: (params: Record<string, unknown>) => Promise<unknown>;

createContext() {
  invokeTool:
    delegation !== undefined && this.hasNativeTool(delegation.toolName)
      ? (params, options) => this.invokeNativeTool(delegation.toolName, params, options)
      : undefined;
}
`;

const HINDSIGHT_WITHOUT_SAVE = `
export const hindsightBackend: MemoryBackend = {
  id: "hindsight",
  async start() {},
  async enqueue() {},
};
`;

const HINDSIGHT_WITH_SAVE = `
export const hindsightBackend: MemoryBackend = {
  id: "hindsight",
  async start() {},
  async save(_ctx, input) {
    return { backend: "hindsight", stored: 1 };
  },
};
`;

const RETAIN_TOOL = `
export class MemoryRetainTool {
  readonly name = "retain";
  async execute(_id, params) {
    for (const item of params.items) {
      state.enqueueRetain(item.content, item.context);
    }
  }
}
`;

describe("inspectSdkSources", () => {
  it("locks unsupported when a restricted session can inject a caller tool but never creates native retain", () => {
    const result = inspectSdkSources({
      version: "18.1.17",
      files: {
        sdk: RESTRICTED_CUSTOM_TOOLS + SKIP_MEMORY_TOOLS,
        extensionTypes: INVOKE_TOOL_SAME_NAME,
        hindsightBackend: HINDSIGHT_WITHOUT_SAVE,
        memoryRetain: RETAIN_TOOL,
      },
    });

    expect(result.decision).toBe("unsupported");
    expect(result.observations.allowRestrictedCustomTools).toBe(true);
    expect(result.observations.restrictedSessionsSkipCreateMemoryTools).toBe(true);
    expect(result.observations.invokeToolSameToolOnly).toBe(true);
    expect(result.observations.hindsightBackendImplementsSave).toBe(false);
    expect(result.reasons.some((reason) => /createMemoryTools/i.test(reason))).toBe(true);
    expect(result.apiSurface).toEqual(
      expect.arrayContaining([
        "CreateAgentSessionOptions.restrictToolNames",
        "CreateAgentSessionOptions.allowRestrictedCustomTools",
        "CreateAgentSessionOptions.customTools",
        "ExtensionContext.invokeTool",
        "MemoryRuntimeContext.save",
        "MemoryRetainTool.execute",
      ]),
    );
  });

  it("locks guarded_adapter only when a restricted caller-owned retain wrapper can invoke native retain before execution", () => {
    const result = inspectSdkSources({
      version: "99.0.0-hypothetical",
      files: {
        sdk: RESTRICTED_CUSTOM_TOOLS + KEEP_MEMORY_TOOLS,
        extensionTypes: INVOKE_TOOL_SAME_NAME,
        hindsightBackend: HINDSIGHT_WITHOUT_SAVE,
        memoryRetain: RETAIN_TOOL,
      },
    });

    expect(result.decision).toBe("guarded_adapter");
    expect(result.observations.restrictedSessionsSkipCreateMemoryTools).toBe(false);
    expect(result.mechanism).toMatch(/opaque token/i);
    expect(result.mechanism).toMatch(/invokeTool/i);
  });

  it("does not treat ctx.memory.save as the nested retain gate", () => {
    const result = inspectSdkSources({
      version: "99.0.0-save-only",
      files: {
        sdk: RESTRICTED_CUSTOM_TOOLS + SKIP_MEMORY_TOOLS,
        extensionTypes: INVOKE_TOOL_SAME_NAME,
        hindsightBackend: HINDSIGHT_WITH_SAVE,
        memoryRetain: RETAIN_TOOL,
      },
    });

    expect(result.observations.hindsightBackendImplementsSave).toBe(true);
    expect(result.decision).toBe("unsupported");
  });
});
