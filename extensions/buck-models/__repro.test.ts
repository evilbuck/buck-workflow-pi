import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { wireBuckModels } from "/home/buckleyrobinson/projects/development_tools/buck-workflow-pi/extensions/buck-models/index.js";

describe("repro", () => {
  it("single read", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "repro-"));
    const projectPath = join(cwd, ".omp", "config.yml");
    const projectText = "buckModels:\n  profiles:\n    work:\n      build:\n        models: [{ id: provider/gone }]\n";
    mkdirSync(join(cwd, ".omp"));
    writeFileSync(projectPath, projectText);
    const notify = vi.fn();
    const api = { registerCommand: vi.fn() } as any;
    let calls: string[] = [];
    wireBuckModels(api, {
      readText: (path: string) => {
        calls.push(path);
        if (!existsSync(path)) return "";
        const text = readFileSync(path, "utf8");
        rmSync(path);
        return text;
      },
    });
    const ctx = { cwd, hasUI: true, ui: { select: vi.fn(), input: vi.fn(), confirm: vi.fn(), notify }, modelRegistry: { getAvailable: () => [{ provider: "provider", id: "here" }] } };
    await api.registerCommand.mock.calls[0][1].handler("--doctor", ctx);
    console.log("CALLS:", calls);
    console.log("MSG:", JSON.stringify(notify.mock.calls[0]));
  });
});
