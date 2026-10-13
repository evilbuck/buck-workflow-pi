import { execFileSync, spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const Params = Type.Object({ command: Type.String() }, { additionalProperties: false });

/** Execution cannot see host identities, machine stores, credentials or network.
 * Native workflow_state remains the only access to the supervisor's store.
 * There is deliberately no fallback to an unrestricted shell if isolation fails.
 */
export function workflowExecutionTool(cwd: string, gitCheckpoint = false): ToolDefinition<typeof Params> {
  const workspace = realpathSync(cwd);
  return {
    name: "workflow_exec", label: "Isolated execution",
    description: "Run commands in an isolated checkout, without host HOME/config/storage/credentials/network. workflow_state is the only access to the host store. Use this instead of bash. Git metadata is read-only except in the commit checkpoint stage. Isolation failure is an error, never a host-shell fallback.",
    parameters: Params,
    async execute(_id, params, signal) {
      const args = ["--die-with-parent", "--unshare-all", "--clearenv"];
      for (const path of ["/usr", "/bin", "/lib", "/lib64", "/etc/ssl", "/etc/passwd", "/etc/group"]) {
        if (existsSync(path)) args.push("--ro-bind", path, path);
      }
      args.push("--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--bind", workspace, workspace);
      bindGitMetadata(args, workspace, gitCheckpoint);
      const modules = resolve(workspace, "node_modules");
      if (existsSync(modules)) {
        const dependencyRoot = realpathSync(modules);
        args.push("--ro-bind", dependencyRoot, dependencyRoot);
      }
      args.push("--setenv", "PATH", "/usr/bin:/bin", "--setenv", "HOME", "/tmp/home", "--setenv", "XDG_CONFIG_HOME", "/tmp/config", "--chdir", workspace, "/bin/bash", "--noprofile", "--norc", "-c", params.command);
      const { promise, resolve: done, reject } = Promise.withResolvers<string>();
      const child = spawn("/usr/bin/bwrap", args, { env: {}, signal, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout.on("data", chunk => { output += chunk; });
      child.stderr.on("data", chunk => { output += chunk; });
      child.on("error", reject);
      child.on("close", code => {
        if (code === 0) done(output);
        else reject(new Error(`isolated execution exited ${code}: ${output}`));
      });
      const text = await promise;
      return { content: [{ type: "text", text }], details: { isolated: true } };
    },
  };
}

function bindGitMetadata(args: string[], workspace: string, checkpoint: boolean): void {
  let common: string;
  try { common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: workspace, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return; }
  args.push(checkpoint ? "--bind" : "--ro-bind", common, common);
  if (!checkpoint) return;
  for (const [config, names] of [["user.name", ["GIT_AUTHOR_NAME", "GIT_COMMITTER_NAME"]], ["user.email", ["GIT_AUTHOR_EMAIL", "GIT_COMMITTER_EMAIL"]]] as const) {
    const value = execFileSync("git", ["config", "--get", config], { cwd: workspace, encoding: "utf8" }).trim();
    for (const name of names) args.push("--setenv", name, value);
  }
}
