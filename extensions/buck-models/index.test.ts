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
}) {
  const commands = new Map<string, { description: string; handler: (args: string, ctx: unknown) => Promise<void> }>();
  const select = vi.fn(async (_prompt: string, _items: string[]) => opts.selects.shift());
  const input = vi.fn(async (_prompt: string, _placeholder?: string) => opts.inputs?.shift());
  const confirm = vi.fn(async (_title: string, _message: string) => opts.confirms?.shift() ?? false);
  const notify = vi.fn();
  const api = {
    registerCommand: vi.fn((name: string, spec: { description: string; handler: (args: string, ctx: unknown) => Promise<void> }) => {
      commands.set(name, spec);
    }),
  } as unknown as ExtensionAPI;
  wireBuckModels(api);
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
  return { command: commands.get("buck-models")!, ctx, select, input, confirm, notify };
}

function stageRows(scope: "project" | "global"): string[] {
  return BUCK_STAGE_KEYS.map((stage, index) => `${scope}/${stage} | note ${index}`);
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
      inputs: ["work", ...stageRows("project")],
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
      models: [{ id: "project/build", note: "note 2" }],
    });
    expect(saved).toContain("theme: dark");
    expect(saved).toContain("keep: yes");
    expect(harness.select.mock.calls.map(([prompt]) => prompt)).toEqual(expect.arrayContaining([
      expect.stringContaining("build — unset"),
      expect.stringContaining("choice — unset"),
    ]));
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
        inputs: ["portable", ...stageRows("global")],
        confirms: [true, true],
        available: stageRows("global").map((row) => row.split(" | ")[0]!),
      });
      harness.ctx.cwd = cwd;

      await harness.command.handler("", harness.ctx);

      const saved = readFileSync(join(agentDir, "config.yml"), "utf8");
      const parsed = parseBuckModels(saved);
      expect(parsed.active).toBe("portable");
      expect(parsed.profiles.portable?.stages["brainstorm-plan"]).toEqual({
        thinking: "off",
        models: [{ id: "global/brainstorm-plan", note: "note 0" }],
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
      inputs: ["provider/replacement | changed"],
      confirms: [false, true],
      available: ["provider/replacement"],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    const parsed = parseBuckModels(readFileSync(projectPath, "utf8"));
    expect(parsed.profiles.work?.stages.build).toEqual({
      thinking: "high",
      models: [{ id: "provider/replacement", note: "changed" }],
    });
    expect(parsed.profiles.work?.stages.review).toEqual({
      thinking: "low",
      models: [{ id: "provider/reviewer", note: "keep me" }],
    });
    expect(harness.notify).toHaveBeenCalledWith(
      "Unavailable model ids will still be saved: provider/reviewer",
      "warning",
    );
    expect(harness.input).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Replacement models for build — project-owned"),
      "provider/original | original note",
    );
    expect(harness.select).toHaveBeenCalledWith(
      expect.stringContaining("Current models: provider/original | original note; thinking: high"),
      ["Keep current stage", "Edit this stage"],
    );
  });

  it("round-trips comma-containing notes through the escaped row editor", async () => {
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
      inputs: ["provider/original | fast\\, cheap"],
      confirms: [false, true],
      available: ["provider/original"],
    });
    harness.ctx.cwd = cwd;

    await harness.command.handler("", harness.ctx);

    const parsed = parseBuckModels(readFileSync(projectPath, "utf8"));
    expect(parsed.profiles.work?.stages.build?.models).toEqual([
      { id: "provider/original", note: "fast, cheap" },
    ]);
    expect(harness.input).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("escape note commas as \\,"),
      "provider/original | fast\\, cheap",
    );
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
      inputs: ["provider/replacement"],
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
});
