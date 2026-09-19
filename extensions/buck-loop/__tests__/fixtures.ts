/**
 * Temp git repos for buck-loop tests. Each `repo()` is an isolated checkout
 * so tests never touch this project's real `.context/`. `cleanupRepos()`
 * deletes them in `afterEach`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const dirs: string[] = [];
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

export function git(cwd: string, args: string[]): void {
  execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: GIT_ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export function repo(prefix = "buck-loop-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  git(dir, ["init", "-q", "-b", "loop-work"]);
  git(dir, ["config", "user.email", "t@t"]);
  git(dir, ["config", "user.name", "t"]);
  return dir;
}

export function cleanupRepos(): void {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

export function planMd(): string {
  return "---\nstatus: active\n---\n# Demo plan\n";
}

export function phaseMd(n: number, status: string, dependsOn: number[] = [], plan?: string): string {
  const dep = `[${dependsOn.join(", ")}]`;
  const dtype = dependsOn.length > 0 ? "HARD" : "NONE";
  const owner = plan ? `plan: ${plan}\n` : "";
  return `---
status: ${status}
phase: ${n}
order: ${n}
${owner}depends_on: ${dep}
dependency_type: ${dtype}
---
# Phase ${n}
`;
}
