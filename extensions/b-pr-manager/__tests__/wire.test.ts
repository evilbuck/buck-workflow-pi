import { describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync } from "node:fs";
import {
  disposeActiveManagers,
  parseManagerArgs,
  resolveMergeMethod,
  runPrManager,
  wire,
} from "../index.js";

function createMockApi() {
  const commands = new Map<string, Record<string, unknown>>();
  const api = {
    on: vi.fn(),
    registerCommand: vi.fn((name: string, opts: Record<string, unknown>) => {
      commands.set(name, opts);
    }),
    registerTool: vi.fn(),
  } as unknown as ExtensionAPI;
  return { api, commands };
}

describe("b-pr-manager wire", () => {
  it("registers b-pr-manager with a handler and completions", () => {
    const { api, commands } = createMockApi();
    wire(api);
    expect(commands.has("b-pr-manager")).toBe(true);
    const cmd = commands.get("b-pr-manager") as {
      handler: Function;
      description?: string;
      getArgumentCompletions: (prefix: string) => Array<{ value: string }>;
    };
    expect(cmd.handler).toBeTypeOf("function");
    expect(cmd.description).toMatch(/MERGED/);
    expect(cmd.getArgumentCompletions("--re").map((item) => item.value)).toContain("--resume");
  });

  it("parses the command contract flags", () => {
    const options = parseManagerArgs("42 --resume --base main --merge-method squash --model slow");
    expect(options).toMatchObject({
      pr: "42",
      resume: true,
      base: "main",
      mergeMethod: "squash",
      model: "slow",
    });
  });

  it("blocks a dirty fresh start and allows owned resume dirt", async () => {
    const notify = vi.fn();
    const blocked = await runPrManager("42", {
      cwd: "/tmp",
      ui: { notify },
      dirtyPaths: ["README.md"],
    });
    expect(blocked.status).toBe("blocked");
    expect(blocked.reason).toBe("dirty_worktree");

    const resumed = await runPrManager("42 --resume", {
      cwd: "/tmp",
      ui: { notify },
      ownedDirtyPaths: ["src/a.ts"],
      dirtyPaths: ["src/a.ts"],
    });
    expect(resumed.status).not.toBe("blocked");
  });

  it("prints the exact resume command on cancel and disposes actors", async () => {
    const notify = vi.fn();
    const signal = AbortSignal.abort();
    const result = await runPrManager("42", { cwd: "/tmp", ui: { notify }, signal, dirtyPaths: [] });
    expect(result.status).toBe("paused");
    expect(result.resumeCommand).toBe("/b-pr-manager 42 --resume");
    disposeActiveManagers();
  });

  it("asks when several merge methods are enabled and never emits --force", () => {
    expect(
      resolveMergeMethod({
        enabled: { squash: true, rebase: true, merge: true },
      }),
    ).toBe("ask");
    expect(
      resolveMergeMethod({
        flag: "squash",
        enabled: { squash: true, rebase: true, merge: true },
      }),
    ).toBe("squash");
    expect(
      resolveMergeMethod({
        enabled: { squash: true, rebase: false, merge: false },
      }),
    ).toBe("squash");
    const src = [
      readFileSync(new URL("../index.ts", import.meta.url), "utf8"),
      readFileSync(new URL("../git.ts", import.meta.url), "utf8"),
    ].join("\n");
    expect(src).not.toMatch(/"--force"(?!-with-lease)/);
  });
});
