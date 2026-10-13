import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeWorkflowState, resolveTrustedContext } from "../../skills/_shared/scripts/workflow-state.js";
import { workflowExecutionTool } from "./execution.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe.skipIf(process.platform !== "linux" || !existsSync("/usr/bin/bwrap"))("restricted execution", () => {
  it("cannot retrieve another branch through the operator CLI or caller-set machine config", async () => {
    const root = mkdtempSync(join(tmpdir(), "wf-isolation-"));
    roots.push(root);
    const cwd = join(root, "checkout");
    const machine = join(root, "machine");
    mkdirSync(cwd); mkdirSync(machine);
    cpSync(resolve("skills/_shared"), join(cwd, "skills/_shared"), { recursive: true });
    symlinkSync(resolve("node_modules"), join(cwd, "node_modules"));
    const git = (args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    git(["init", "-q", "-b", "topic"]);
    git(["config", "user.email", "fixture@example.test"]); git(["config", "user.name", "fixture"]);
    writeFileSync(join(cwd, "tracked"), "tracked"); git(["add", "tracked"]); git(["commit", "-qm", "init"]);
    git(["checkout", "-qb", "other"]);
    const configPath = join(machine, "config.yaml");
    writeFileSync(configPath, `version: 1\nstorage:\n  adapter: external-files\n  root: ${join(machine, "store")}\n`);
    const context = await resolveTrustedContext(cwd, { configPath, identityPath: join(machine, "buck-workflow", "branch-identity.json") });
    await executeWorkflowState({ cwd, context, role: "write", request: { operation: "write", ref: { subjectId: "private", kind: "memory", logicalName: "fact.md" }, body: "PRIVATE OTHER BRANCH BODY" } });
    git(["checkout", "-q", "topic"]);
    const tool = workflowExecutionTool(cwd);
    const args = ["skills/_shared/scripts/workflow-state-cli.ts", "inspect", "--branch", "refs/heads/other"];
    const operator = JSON.parse(execFileSync("bun", args, { cwd, env: { ...process.env, XDG_CONFIG_HOME: machine, BUCK_WORKFLOW_CONFIG: configPath }, encoding: "utf8" }));
    expect(operator.items).toEqual([expect.objectContaining({ text: "PRIVATE OTHER BRANCH BODY" })]);
    await expect(tool.execute("forced-config", { command: `BUCK_WORKFLOW_CONFIG=${JSON.stringify(configPath)} bun ${args.join(" ")}` })).rejects.toThrow(/ENOENT/);
    const result = await tool.execute("fresh-config", { command: `bun ${args.join(" ")}` });
    const text = result.content[0] as { text: string };
    expect(JSON.parse(text.text).items).toEqual([]);
    expect(text.text).not.toContain("PRIVATE OTHER BRANCH BODY");
    await expect(tool.execute("raw-file", { command: `cat ${JSON.stringify(configPath)}` })).rejects.toThrow(/No such file/);
  });
});
