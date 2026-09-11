import { execGit, rebaseInProgress } from "../pr-git.js";

export function listDirtyPaths(cwd: string): string[] {
  const raw = execGit(["status", "--porcelain"], cwd).trim();
  if (!raw) return [];
  return raw.split("\n").map(porcelainPath).filter(Boolean);
}

function porcelainPath(line: string): string {
  return line.slice(3).trim();
}

export function unknownDirtyPaths(cwd: string, owned: readonly string[]): string[] {
  const allowed = new Set(owned);
  return listDirtyPaths(cwd).filter((path) => !allowed.has(path));
}

export function freshStartBlocked(cwd: string): boolean {
  return listDirtyPaths(cwd).length > 0;
}

export function resumeDirtBlocked(cwd: string, owned: readonly string[]): boolean {
  return unknownDirtyPaths(cwd, owned).length > 0;
}

export function rebaseIsActive(cwd: string): boolean {
  return rebaseInProgress(cwd);
}

export function mustPromptForBase(
  status: "hit" | "miss" | "mismatch" | "stale",
  prBase: string,
  flag?: string,
): boolean {
  if (flag) return flag !== prBase;
  return status !== "hit";
}

