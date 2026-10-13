import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as PiCodingAgent from "@mariozechner/pi-coding-agent";
import { executeWorkflowState, resolveTrustedContext } from "../../skills/_shared/scripts/workflow-state.js";
import { workflowStateTool } from "./index.js";

const { createAgentSessionMock } = vi.hoisted(() => ({ createAgentSessionMock: vi.fn() }));
vi.mock("@mariozechner/pi-coding-agent", async () => {
  const actual = await vi.importActual<typeof PiCodingAgent>("@mariozechner/pi-coding-agent");
  return { ...actual, createAgentSession: createAgentSessionMock };
});
import { runStep } from "../buck-loop/run-step.js";

const PRIVATE = "PRIVATE OTHER BRANCH BODY";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  createAgentSessionMock.mockReset();
});

function temp(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}
function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}
function findBody(dir: string, body: string): string | undefined {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      const found = findBody(path, body);
      if (found) return found;
    } else if (readFileSync(path, "utf8").includes(body)) return path;
  }
  return undefined;
}
type Tool = { name: string; execute: (id: string, params: Record<string, unknown>, signal?: AbortSignal) => Promise<{ content?: Array<{ text?: string }> }> };
async function outcome(tool: Tool, params: Record<string, unknown>): Promise<string> {
  try {
    const result = await tool.execute("call", params);
    return result.content?.map((item) => item.text ?? "").join("\n") ?? "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("delivered restricted file tools", () => {
  it("refuses absolute and symlink access to another branch store and still edits checkout source", async () => {
    const root = temp("confined-");
    const cwd = join(root, "checkout");
    const machine = join(root, "machine");
    mkdirSync(cwd);
    mkdirSync(machine);
    git(cwd, ["init", "-q", "-b", "topic"]);
    git(cwd, ["config", "user.email", "fixture@example.test"]);
    git(cwd, ["config", "user.name", "fixture"]);
    writeFileSync(join(cwd, "src.ts"), "checkout source\n");
    writeFileSync(join(cwd, "skills-demo.md"), "skill source\n");
    git(cwd, ["add", "src.ts", "skills-demo.md"]);
    git(cwd, ["commit", "-qm", "init"]);
    git(cwd, ["checkout", "-qb", "other"]);
    const configPath = join(machine, "config.yaml");
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: external-files\n  root: ${join(machine, "store")}\n`);
    const context = await resolveTrustedContext(cwd, { configPath, identityPath: join(machine, "identity.json") });
    await executeWorkflowState({ cwd, context, role: "write", configPath, identityPath: join(machine, "identity.json"), request: { operation: "write", ref: { subjectId: "private", kind: "memory", logicalName: "fact.md" }, body: PRIVATE } });
    const storeFile = findBody(join(machine, "store"), PRIVATE);
    expect(storeFile).toBeTruthy();
    git(cwd, ["checkout", "-q", "topic"]);
    symlinkSync(storeFile!, join(cwd, "leak"));
    symlinkSync(machine, join(cwd, "escape"));
    createAgentSessionMock.mockResolvedValue({ session: { prompt: vi.fn().mockResolvedValue(undefined), messages: [{ role: "assistant", content: "done" }], getContextUsage: () => undefined, subscribe: () => () => {}, abort: vi.fn(), dispose: vi.fn() } });
    await runStep({ select: vi.fn(async () => ({ ok: true as const, id: "provider/picked", thinking: "off" as const })), cwd, skill: "b-review", planOrPhasePath: "plan.md" });
    const tools = createAgentSessionMock.mock.calls[0]![0].customTools as Tool[];
    const tool = (name: string) => tools.find((item) => item.name === name)!;
    for (const params of [
      { path: storeFile },
      { path: "leak" },
      { path: "~/.config/buck-workflow/branch-identity.json" },
    ]) {
      const text = await outcome(tool("read"), params);
      expect(text).toMatch(/outside the checkout/);
      expect(text).not.toContain(PRIVATE);
    }
    for (const name of ["grep", "find", "ls"] as const) {
      const params = name === "ls" ? { path: "leak" } : { pattern: "PRIVATE", path: storeFile };
      const text = await outcome(tool(name), params);
      expect(text).toMatch(/outside the checkout/);
      expect(text).not.toContain(PRIVATE);
    }
    expect(await outcome(tool("write"), { path: join(machine, "pwned.txt"), content: "no" })).toMatch(/outside the checkout/);
    expect(existsSync(join(machine, "pwned.txt"))).toBe(false);
    expect(await outcome(tool("write"), { path: "escape/pwned.txt", content: "no" })).toMatch(/outside the checkout/);
    expect(existsSync(join(machine, "pwned.txt"))).toBe(false);
    expect(await outcome(tool("edit"), { path: storeFile, edits: [{ oldText: PRIVATE, newText: "tampered" }] })).toMatch(/outside the checkout/);
    expect(readFileSync(storeFile!, "utf8")).toContain(PRIVATE);
    expect(await outcome(tool("read"), { path: "src.ts" })).toContain("checkout source");
    expect(await outcome(tool("read"), { path: "skills-demo.md" })).toContain("skill source");
    expect(await outcome(tool("edit"), { path: "src.ts", edits: [{ oldText: "checkout source", newText: "edited source" }] })).not.toMatch(/outside the checkout/);
    expect(readFileSync(join(cwd, "src.ts"), "utf8")).toContain("edited source");
    const state = tool("workflow_state");
    expect(await outcome(state, { operation: "inspect", branchRef: "refs/heads/other" })).toMatch(/write role/);
    if (existsSync("/usr/bin/bwrap")) {
      expect(await outcome(tool("workflow_exec"), { command: `cat ${JSON.stringify(storeFile)}` })).toMatch(/No such file|outside|exited/);
    }
  });
});

describe("native receipt run binding", () => {
  it("gives each save attempt its own run and does not resume another branch", async () => {
    const cwd = temp("native-run-");
    const home = temp("native-home-");
    git(cwd, ["init", "-q", "-b", "topic"]);
    git(cwd, ["config", "user.email", "fixture@example.test"]);
    git(cwd, ["config", "user.name", "fixture"]);
    writeFileSync(join(cwd, "README.md"), "topic\n");
    git(cwd, ["add", "README.md"]);
    git(cwd, ["commit", "-qm", "init"]);
    const configPath = join(home, "config.yaml");
    writeFileSync(configPath, "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
    const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;
    const previousHome = process.env.XDG_CONFIG_HOME;
    process.env.BUCK_WORKFLOW_CONFIG = configPath;
    process.env.XDG_CONFIG_HOME = home;
    try {
      createAgentSessionMock.mockResolvedValue({ session: { prompt: vi.fn().mockResolvedValue(undefined), messages: [{ role: "assistant", content: "done" }], getContextUsage: () => undefined, subscribe: () => () => {}, abort: vi.fn(), dispose: vi.fn() } });
      await runStep({ select: vi.fn(async () => ({ ok: true as const, id: "provider/picked", thinking: "off" as const })), cwd, skill: "b-save", planOrPhasePath: "plan.md" });
      const tool = (createAgentSessionMock.mock.calls.at(-1)![0].customTools as Tool[]).find((item) => item.name === "workflow_state")!;
      const call = async (params: Record<string, unknown>) => JSON.parse(await outcome(tool, params)) as { runId: string; branchId: string; attemptId: string; status: string };
      const receipt = { artifactRevisions: [], receiptKind: "no-fact", metadataDuties: ["probe"] };
      const first = await call({ operation: "write-receipt", attemptId: "attempt-1", status: "attempted", ...receipt });
      const firstComplete = await call({ operation: "write-receipt", attemptId: "attempt-1", status: "complete", ...receipt });
      expect(firstComplete.runId).toBe(first.runId);
      const second = await call({ operation: "write-receipt", attemptId: "attempt-2", status: "attempted", ...receipt });
      const secondComplete = await call({ operation: "write-receipt", attemptId: "attempt-2", status: "complete", ...receipt });
      expect(second.runId).not.toBe(first.runId);
      expect(secondComplete.runId).toBe(second.runId);
      expect(await call({ operation: "read-receipt" })).toMatchObject({ attemptId: "attempt-2", runId: second.runId, branchId: first.branchId });
      git(cwd, ["checkout", "-qb", "other"]);
      const foreign = await outcome(tool, { operation: "read-receipt" });
      expect(foreign).not.toContain(first.branchId);
      expect(foreign).not.toContain(first.runId);
      const resumedForeign = await call({ operation: "write-receipt", attemptId: "attempt-1", status: "attempted", ...receipt });
      expect(resumedForeign.runId).not.toBe(first.runId);
      git(cwd, ["checkout", "-q", "topic"]);
      expect(await call({ operation: "read-receipt" })).toMatchObject({ attemptId: "attempt-2", runId: second.runId });
      const open = await call({ operation: "write-receipt", attemptId: "attempt-3", status: "attempted", ...receipt });
      const resumed = await call({ operation: "write-receipt", attemptId: "attempt-3", status: "complete", ...receipt });
      expect(resumed.runId).toBe(open.runId);
      const direct = workflowStateTool({ cwd, role: "save" });
      const directResult = await direct.execute("direct", { operation: "read-receipt" }, undefined, undefined, undefined as never);
      const directItem = directResult.content[0];
      const directText = directItem && "text" in directItem ? directItem.text : "";
      expect(directText).toContain(open.runId);
      expect(directText).not.toContain(resumedForeign.runId);
    } finally {
      if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
      else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
      if (previousHome === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousHome;
    }
  });
});
