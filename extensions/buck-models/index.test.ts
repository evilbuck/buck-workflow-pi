import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BUCK_STAGE_KEYS, parseBuckModels } from "../omp-models.js";
import { wireBuckModels } from "./index.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "buck-models-command-"));
  dirs.push(dir);
  return dir;
}

function commandHarness(opts: {
  selects: string[];
  inputs?: string[];
  confirms?: boolean[];
  available?: string[];
  picks?: Array<string[] | null>;
}) {
  const commands = new Map<string, { description: string; handler: (args: string, ctx: unknown) => Promise<void> }>();
  const select = vi.fn(async (_prompt: string, _items: string[]) => opts.selects.shift());
  const input = vi.fn(async (_prompt: string, _placeholder?: string) => opts.inputs?.shift());
  const confirm = vi.fn(async (_title: string, _message: string) => opts.confirms?.shift() ?? false);
  const notify = vi.fn();
  const pickStageModels = vi.fn(async () => opts.picks?.shift() ?? null);
  const api = {
    registerCommand: vi.fn((name: string, spec: { description: string; handler: (args: string, ctx: unknown) => Promise<void> }) => {
      commands.set(name, spec);
    }),
  } as unknown as ExtensionAPI;
  wireBuckModels(api, { pickStageModels });
  const ctx = {
    cwd: "",
    hasUI: true,
    ui: { select, input, confirm, notify },
    modelRegistry: {
      getAvailable: () => (opts.available ?? []).map((id) => {
        const slash = id.indexOf("/");
        return { provider: id.slice(0, slash), id: id.slice(slash + 1) };
      }),
    },
  };
  return { command: commands.get("buck-models")!, ctx, select, input, confirm, notify, pickStageModels };
}

function stageIds(scope: "project" | "global"): string[][] {
  return BUCK_STAGE_KEYS.map((stage) => [`${scope}/${stage}`]);
}


describe("/buck-models", () => {
  it("creates and activates a project profile across all twelve stages while preserving unrelated YAML", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    writeFileSync(join(cwd, ".omp", "config.yml"), "theme: dark\ncustom:\n  keep: yes\n");
    const thinking = BUCK_STAGE_KEYS.map(() => "medium");
    const harness = commandHarness({
      selects: [
        "Project (.omp/config.yml)",
        "Create or edit a profile",
        "Create a new profile",
        ...thinking.flatMap((level) => ["Edit this stage", level]),
      ],
      inputs: ["work"],
      picks: stageIds("project"),
      confirms: [true, true],
      available: ["project/build"],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    const saved = readFileSync(join(cwd, ".omp", "config.yml"), "utf8");
    const parsed = parseBuckModels(saved);
    expect(parsed.active).toBe("work");
    expect(Object.keys(parsed.profiles.work?.stages ?? {})).toEqual(BUCK_STAGE_KEYS);
    expect(parsed.profiles.work?.stages.build).toEqual({
      thinking: "medium",
      models: [{ id: "project/build" }],
    });
    expect(saved).toContain("theme: dark");
    expect(saved).toContain("keep: yes");
    expect(harness.pickStageModels).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Models for build"),
      [{ id: "project/build", unavailable: false }],
      [],
    );
    expect(harness.notify).toHaveBeenCalledWith(expect.stringMatching(/unavailable/i), "warning");
    expect(harness.notify).toHaveBeenLastCalledWith(expect.stringContaining("Saved project profile"), "info");
  });

  it("writes the same editable profile contract to user-global scope with optional notes and thinking", async () => {
    const cwd = tempDir();
    const agentDir = join(tempDir(), "agent");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "config.yml"), "theme: light\n");
    const previous = process.env.OMP_AGENT_DIR;
    process.env.OMP_AGENT_DIR = agentDir;
    try {
      const harness = commandHarness({
        selects: [
          "User-global (~/.omp/agent/config.yml)",
          "Create or edit a profile",
          "Create a new profile",
          ...[
            "off (omit)",
            ...BUCK_STAGE_KEYS.slice(1).map(() => "high"),
          ].flatMap((level) => ["Edit this stage", level]),
        ],
        inputs: ["portable"],
        picks: stageIds("global"),
        confirms: [true, true],
        available: stageIds("global").flat(),
      });
      harness.ctx.cwd = cwd;

      await harness.command.handler("", harness.ctx);

      const saved = readFileSync(join(agentDir, "config.yml"), "utf8");
      const parsed = parseBuckModels(saved);
      expect(parsed.active).toBe("portable");
      expect(parsed.profiles.portable?.stages["brainstorm-plan"]).toEqual({
        thinking: "off",
        models: [{ id: "global/brainstorm-plan" }],
      });
      expect(parsed.profiles.portable?.stages.present?.thinking).toBe("high");
      expect(saved).toContain("theme: light");
      expect(harness.notify).not.toHaveBeenCalledWith(expect.anything(), "warning");
    } finally {
      if (previous === undefined) delete process.env.OMP_AGENT_DIR;
      else process.env.OMP_AGENT_DIR = previous;
    }
  });

  it("switches the active profile without rewriting its stage lists", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    writeFileSync(join(cwd, ".omp", "config.yml"), [
      "unrelated: keep",
      "buckModels:",
      "  active: old",
      "  profiles:",
      "    old:",
      "      build:",
      "        models: [{ id: provider/old }]",
      "    next:",
      "      review:",
      "        thinking: low",
      "        models: [{ id: provider/next }]",
      "",
    ].join("\n"));
    const harness = commandHarness({
      selects: ["Project (.omp/config.yml)", "Activate a profile", "next"],
      confirms: [true],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    const saved = readFileSync(join(cwd, ".omp", "config.yml"), "utf8");
    const parsed = parseBuckModels(saved);
    expect(parsed.active).toBe("next");
    expect(parsed.profiles.old?.stages.build?.models).toEqual([{ id: "provider/old" }]);
    expect(parsed.profiles.next?.stages.review).toEqual({
      thinking: "low",
      models: [{ id: "provider/next" }],
    });
    expect(harness.notify).toHaveBeenCalledWith(
      "Unavailable model ids will still be saved: provider/next",
      "warning",
    );
    expect(saved).toContain("unrelated: keep");
  });

  it("preserves existing rows and thinking unless the engineer explicitly replaces a stage", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    const projectPath = join(cwd, ".omp", "config.yml");
    writeFileSync(projectPath, [
      "buckModels:",
      "  active: work",
      "  profiles:",
      "    work:",
      "      build:",
      "        thinking: high",
      "        models: [{ id: provider/original, note: original note }]",
      "      review:",
      "        thinking: low",
      "        models: [{ id: provider/reviewer, note: keep me }]",
      "",
    ].join("\n"));
    const stageChoices = BUCK_STAGE_KEYS.flatMap((stage) => stage === "build"
      ? ["Edit this stage", "Keep current (high)"]
      : ["Keep current stage"]);
    const harness = commandHarness({
      selects: ["Project (.omp/config.yml)", "Create or edit a profile", "Edit profile: work", ...stageChoices],
      picks: [["provider/replacement"]],
      confirms: [false, true],
      available: ["provider/replacement"],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    const parsed = parseBuckModels(readFileSync(projectPath, "utf8"));
    expect(parsed.profiles.work?.stages.build).toEqual({
      thinking: "high",
      models: [{ id: "provider/replacement" }],
    });
    expect(parsed.profiles.work?.stages.review).toEqual({
      thinking: "low",
      models: [{ id: "provider/reviewer", note: "keep me" }],
    });
    expect(harness.notify).toHaveBeenCalledWith(
      "Unavailable model ids will still be saved: provider/reviewer",
      "warning",
    );
    expect(harness.pickStageModels).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.stringContaining("Models for build — project-owned"),
      [
        { id: "provider/original", unavailable: true },
        { id: "provider/replacement", unavailable: false },
      ],
      ["provider/original"],
    );
    expect(harness.select).toHaveBeenCalledWith(
      expect.stringContaining("Current models: provider/original | original note; thinking: high"),
      ["Keep current stage", "Edit this stage"],
    );
  });

  it("keeps an existing note when the checklist leaves that id checked", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    const projectPath = join(cwd, ".omp", "config.yml");
    writeFileSync(projectPath, [
      "buckModels:",
      "  profiles:",
      "    work:",
      "      build:",
      "        models: [{ id: provider/original, note: 'fast, cheap' }]",
      "",
    ].join("\n"));
    const stageChoices = BUCK_STAGE_KEYS.flatMap((stage) => stage === "build"
      ? ["Edit this stage", "Keep current (off)"]
      : ["Keep current stage"]);
    const harness = commandHarness({
      selects: ["Project (.omp/config.yml)", "Create or edit a profile", "Edit profile: work", ...stageChoices],
      picks: [["provider/original"]],
      confirms: [false, true],
      available: ["provider/original"],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    const parsed = parseBuckModels(readFileSync(projectPath, "utf8"));
    expect(parsed.profiles.work?.stages.build?.models).toEqual([
      { id: "provider/original", note: "fast, cheap" },
    ]);
    expect(harness.input).not.toHaveBeenCalled();
  });

  it("edits a profile whose name matches the create action label", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    const projectPath = join(cwd, ".omp", "config.yml");
    writeFileSync(projectPath, [
      "buckModels:",
      "  profiles:",
      "    Create a new profile:",
      "      build:",
      "        models: [{ id: provider/original }]",
      "",
    ].join("\n"));
    const stageChoices = BUCK_STAGE_KEYS.flatMap((stage) => stage === "build"
      ? ["Edit this stage", "Keep current (off)"]
      : ["Keep current stage"]);
    const harness = commandHarness({
      selects: [
        "Project (.omp/config.yml)",
        "Create or edit a profile",
        "Edit profile: Create a new profile",
        ...stageChoices,
      ],
      picks: [["provider/replacement"]],
      confirms: [false, true],
      available: ["provider/replacement"],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    const parsed = parseBuckModels(readFileSync(projectPath, "utf8"));
    expect(parsed.profiles["Create a new profile"]?.stages.build?.models).toEqual([
      { id: "provider/replacement" },
    ]);
    expect(parsed.profiles["Edit profile: Create a new profile"]).toBeUndefined();
  });

  it("refuses a new profile name that collides with picker labels", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    const projectPath = join(cwd, ".omp", "config.yml");
    writeFileSync(projectPath, "buckModels:\n  profiles: {}\n");
    const harness = commandHarness({
      selects: [
        "Project (.omp/config.yml)",
        "Create or edit a profile",
        "Create a new profile",
      ],
      inputs: ["Edit profile: foo"],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    expect(harness.notify).toHaveBeenCalledWith(expect.stringContaining("collides"), "error");
    expect(parseBuckModels(readFileSync(projectPath, "utf8")).profiles).toEqual({});
  });

  it("shows user-global fallthrough and performs no write when stage editing is cancelled", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    const projectPath = join(cwd, ".omp", "config.yml");
    const original = "buckModels:\n  active: work\n  profiles:\n    work: {}\n";
    writeFileSync(projectPath, original);
    const agentDir = join(tempDir(), "agent");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "config.yml"), [
      "buckModels:",
      "  active: work",
      "  profiles:",
      "    work:",
      "      brainstorm-plan:",
      "        models: [{ id: provider/global }]",
      "",
    ].join("\n"));
    const previous = process.env.OMP_AGENT_DIR;
    process.env.OMP_AGENT_DIR = agentDir;
    try {
      const harness = commandHarness({
        selects: ["Project (.omp/config.yml)", "Create or edit a profile", "Edit profile: work"],
        inputs: [],
      });
      harness.ctx.cwd = cwd;

      await harness.command.handler("", harness.ctx);

      expect(harness.select).toHaveBeenCalledWith(
        expect.stringContaining("brainstorm-plan — user-global fallthrough"),
        ["Keep current stage", "Edit this stage"],
      );
      expect(harness.select).toHaveBeenCalledWith(
        expect.stringContaining("Current models: provider/global; thinking: off"),
        ["Keep current stage", "Edit this stage"],
      );
      expect(harness.input).not.toHaveBeenCalled();
      expect(readFileSync(projectPath, "utf8")).toBe(original);
      expect(harness.confirm).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.OMP_AGENT_DIR;
      else process.env.OMP_AGENT_DIR = previous;
    }
  });

  describe("--doctor", () => {
    it("reads both project and user-global configs against the live registry, marks the active, and never prompts or writes", async () => {
      const previous = process.env.OMP_AGENT_DIR;
      try {
        const cwd = tempDir();
        mkdirSync(join(cwd, ".omp"), { recursive: true });
        const projectPath = join(cwd, ".omp", "config.yml");
        const projectText = [
          "buckModels:",
          "  active: work",
          "  profiles:",
          "    work:",
          "      build:",
          "        models: [{ id: provider/here }]",
          "",
        ].join("\n");
        writeFileSync(projectPath, projectText);
        const projectBefore = readFileSync(projectPath, "utf8");
        const agentDir = join(tempDir(), "agent");
        mkdirSync(agentDir, { recursive: true });
        const globalPath = join(agentDir, "config.yml");
        const globalText = [
          "buckModels:",
          "  profiles:",
          "    shared:",
          "      review:",
          "        models: [{ id: provider/here }, { id: provider/here }]",
          "",
        ].join("\n");
        writeFileSync(globalPath, globalText);
        const globalBefore = readFileSync(globalPath, "utf8");
        process.env.OMP_AGENT_DIR = agentDir;
        const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
        const notify = vi.fn();
        const select = vi.fn();
        const input = vi.fn();
        const confirm = vi.fn();
        wireBuckModels(api);
        const ctx = {
          cwd,
          hasUI: true,
          ui: { select, input, confirm, notify },
          modelRegistry: { getAvailable: () => [{ provider: "provider", id: "here" }] },
        };
        await api.registerCommand.mock.calls[0]![1].handler("--doctor", ctx);

        expect(notify).toHaveBeenCalledTimes(1);
        const [message, level] = notify.mock.calls[0]!;
        expect(level).toBe("info");
        expect(message).toMatch(/INFO: 3 configured occurrence\(s\), 1 unique id\(s\), 0 unavailable\./);
        expect(message).toContain("Active: work (project)");
        expect(message).toContain("[project] work *active*");
        expect(message).toContain("provider/here [ok]");
        expect(select).not.toHaveBeenCalled();
        expect(input).not.toHaveBeenCalled();
        expect(confirm).not.toHaveBeenCalled();
        expect(readFileSync(projectPath, "utf8")).toBe(projectBefore);
        expect(readFileSync(globalPath, "utf8")).toBe(globalBefore);
      } finally {
        if (previous === undefined) delete process.env.OMP_AGENT_DIR;
        else process.env.OMP_AGENT_DIR = previous;
      }
    });

    it("treats missing config files as an empty inventory with info severity", async () => {
      const previous = process.env.OMP_AGENT_DIR;
      try {
        const cwd = tempDir();
        const agentDir = join(tempDir(), "agent-empty");
        process.env.OMP_AGENT_DIR = agentDir;
        const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
        const notify = vi.fn();
        wireBuckModels(api);
        const ctx = {
          cwd,
          hasUI: true,
          ui: { select: vi.fn(), input: vi.fn(), confirm: vi.fn(), notify },
          modelRegistry: { getAvailable: () => [{ provider: "provider", id: "here" }] },
        };
        await api.registerCommand.mock.calls[0]![1].handler("--doctor", ctx);

        expect(notify).toHaveBeenCalledTimes(1);
        const [message, level] = notify.mock.calls[0]!;
        expect(level).toBe("info");
        expect(message).toContain("No configured Buck model profiles.");
      } finally {
        if (previous === undefined) delete process.env.OMP_AGENT_DIR;
        else process.env.OMP_AGENT_DIR = previous;
      }
    });

    it("reports an error severity when the registry is absent", async () => {
      const cwd = tempDir();
      mkdirSync(join(cwd, ".omp"), { recursive: true });
      writeFileSync(join(cwd, ".omp", "config.yml"), [
        "buckModels:",
        "  active: work",
        "  profiles:",
        "    work:",
        "      build:",
        "        models: [{ id: provider/here }]",
        "",
      ].join("\n"));
      const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
      const notify = vi.fn();
      wireBuckModels(api);
      const ctx = {
        cwd,
        hasUI: true,
        ui: { select: vi.fn(), input: vi.fn(), confirm: vi.fn(), notify },
        modelRegistry: undefined,
      };
      await api.registerCommand.mock.calls[0]![1].handler("--doctor", ctx);

      expect(notify).toHaveBeenCalledTimes(1);
      const [message, level] = notify.mock.calls[0]!;
      expect(level).toBe("error");
      expect(message).toContain("Model registry unavailable");
    });

    it("reports an error severity when a config file is invalid YAML", async () => {
      const previous = process.env.OMP_AGENT_DIR;
      try {
        const cwd = tempDir();
        mkdirSync(join(cwd, ".omp"), { recursive: true });
        writeFileSync(join(cwd, ".omp", "config.yml"), "buckModels:\n  profiles: { unterminated: [\n");
        const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
        const notify = vi.fn();
        wireBuckModels(api);
        const ctx = {
          cwd,
          hasUI: true,
          ui: { select: vi.fn(), input: vi.fn(), confirm: vi.fn(), notify },
          modelRegistry: { getAvailable: () => [{ provider: "provider", id: "here" }] },
        };
        await api.registerCommand.mock.calls[0]![1].handler("--doctor", ctx);

        expect(notify).toHaveBeenCalledTimes(1);
        const [message, level] = notify.mock.calls[0]!;
        expect(level).toBe("error");
        expect(message).toMatch(/not valid YAML/);
      } finally {
        if (previous === undefined) delete process.env.OMP_AGENT_DIR;
        else process.env.OMP_AGENT_DIR = previous;
      }
    });

    it("classifies from the single captured read even when the file vanishes afterwards", async () => {
      const previous = process.env.OMP_AGENT_DIR;
      try {
        const cwd = tempDir();
        const agentDir = join(tempDir(), "agent-vanish");
        process.env.OMP_AGENT_DIR = agentDir;
        const projectPath = join(cwd, ".omp", "config.yml");
        const projectText = [
          "buckModels:",
          "  profiles:",
          "    work:",
          "      build:",
          "        models: [{ id: provider/gone }]",
          "",
        ].join("\n");
        const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
        const notify = vi.fn();
        let reads = 0;
        wireBuckModels(api, {
          readText: (path: string) => {
            reads += 1;
            if (!existsSync(path)) return "";
            const text = readFileSync(path, "utf8");
            rmSync(path); // simulate the file disappearing between reads
            return text;
          },
        });
        mkdirSync(join(cwd, ".omp"), { recursive: true });
        writeFileSync(projectPath, projectText);
        const ctx = {
          cwd,
          hasUI: true,
          ui: { select: vi.fn(), input: vi.fn(), confirm: vi.fn(), notify },
          modelRegistry: { getAvailable: () => [{ provider: "provider", id: "here" }] },
        };
        await api.registerCommand.mock.calls[0]![1].handler("--doctor", ctx);

        expect(reads).toBe(2); // one read per scope, never a reopen
        expect(notify).toHaveBeenCalledTimes(1);
        const [message, level] = notify.mock.calls[0]!;
        console.log("DBG:", JSON.stringify(message));
        expect(message).toMatch(/1 configured occurrence\(s\)/);
        expect(message).toContain("provider/gone [missing]");
      } finally {
        if (previous === undefined) delete process.env.OMP_AGENT_DIR;
        else process.env.OMP_AGENT_DIR = previous;
      }
    });

    it("reports an error severity when a config file cannot be read", async () => {
      const previous = process.env.OMP_AGENT_DIR;
      try {
        const cwd = tempDir();
        // A directory at the config path makes readFileSync throw.
        mkdirSync(join(cwd, ".omp", "config.yml"), { recursive: true });
        const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
        const notify = vi.fn();
        wireBuckModels(api);
        const ctx = {
          cwd,
          hasUI: true,
          ui: { select: vi.fn(), input: vi.fn(), confirm: vi.fn(), notify },
          modelRegistry: { getAvailable: () => [{ provider: "provider", id: "here" }] },
        };
        await api.registerCommand.mock.calls[0]![1].handler("--doctor", ctx);

        expect(notify).toHaveBeenCalledTimes(1);
        const [message, level] = notify.mock.calls[0]!;
        expect(level).toBe("error");
        expect(message).toMatch(/not valid YAML/);
      } finally {
        if (previous === undefined) delete process.env.OMP_AGENT_DIR;
        else process.env.OMP_AGENT_DIR = previous;
      }
    });

    it("reports an error severity when the registry throws instead of a false healthy report", async () => {
      const cwd = tempDir();
      mkdirSync(join(cwd, ".omp"), { recursive: true });
      writeFileSync(join(cwd, ".omp", "config.yml"), [
        "buckModels:",
        "  active: work",
        "  profiles:",
        "    work:",
        "      build:",
        "        models: [{ id: provider/here }]",
        "",
      ].join("\n"));
      const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
      const notify = vi.fn();
      wireBuckModels(api);
      const ctx = {
        cwd,
        hasUI: true,
        ui: { select: vi.fn(), input: vi.fn(), confirm: vi.fn(), notify },
        modelRegistry: {
          getAvailable: () => {
            throw new Error("registry exploded");
          },
        },
      };
      await api.registerCommand.mock.calls[0]![1].handler("--doctor", ctx);

      expect(notify).toHaveBeenCalledTimes(1);
      const [message, level] = notify.mock.calls[0]!;
      expect(level).toBe("error");
      expect(message).toContain("Model registry unavailable");
    });

    it("rejects unsupported arguments with a usage error and no side effects", async () => {
      const previous = process.env.OMP_AGENT_DIR;
      try {
        const cwd = tempDir();
        mkdirSync(join(cwd, ".omp"), { recursive: true });
        const projectPath = join(cwd, ".omp", "config.yml");
        writeFileSync(projectPath, "buckModels:\n  active: work\n  profiles:\n    work: {}\n");
        const projectBefore = readFileSync(projectPath, "utf8");
        const api = { registerCommand: vi.fn() } as unknown as ExtensionAPI;
        const notify = vi.fn();
        const select = vi.fn();
        wireBuckModels(api);
        const ctx = {
          cwd,
          hasUI: true,
          ui: { select, input: vi.fn(), confirm: vi.fn(), notify },
          modelRegistry: { getAvailable: () => [{ provider: "provider", id: "here" }] },
        };
        await api.registerCommand.mock.calls[0]![1].handler("--audit", ctx);

        expect(notify).toHaveBeenCalledTimes(1);
        const [message, level] = notify.mock.calls[0]!;
        expect(level).toBe("error");
        expect(message).toContain("Usage:");
        expect(select).not.toHaveBeenCalled();
        expect(readFileSync(projectPath, "utf8")).toBe(projectBefore);
      } finally {
        if (previous === undefined) delete process.env.OMP_AGENT_DIR;
        else process.env.OMP_AGENT_DIR = previous;
      }
    });

    it("keeps the interactive editor untouched when no arguments are passed", async () => {
      const cwd = tempDir();
      mkdirSync(join(cwd, ".omp"), { recursive: true });
      writeFileSync(join(cwd, ".omp", "config.yml"), "buckModels:\n  profiles: {}\n");
      const harness = commandHarness({
        selects: ["Project (.omp/config.yml)", "Create or edit a profile"],
      });
      harness.ctx.cwd = cwd;
      await harness.command.handler("", harness.ctx);

      expect(harness.select).toHaveBeenCalledWith(
        "Write Buck model profile to",
        expect.arrayContaining(["Project (.omp/config.yml)", "User-global (~/.omp/agent/config.yml)"]),
      );
    });
  });
});
