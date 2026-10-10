import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function settingsEnablement(cwd: string, home: string): boolean {
  const candidates = [
    join(cwd, ".pi", "settings.json"),
    join(cwd, ".omp", "settings.json"),
    join(home, ".pi", "agent", "settings.json"),
    join(home, ".omp", "agent", "settings.json"),
  ];
  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      const settings: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (!settings || typeof settings !== "object" || !("buckTurnMemory" in settings)) continue;
      const value = settings.buckTurnMemory;
      if (value && typeof value === "object" && "enabled" in value) return value.enabled !== false;
      return true;
    } catch {
      // Invalid/unreadable settings do not prevent checking the next scope.
    }
  }
  return true;
}

/** Resolve turn-memory opt-out. SQL availability is a hard enablement prerequisite. */
export function isTurnMemoryEnabled(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  options: { home?: string } = {},
): boolean {
  if (!env.SQL_MEMORY_URL) return false;
  if (env.BUCK_TURN_MEMORY === "0" || env.BUCK_TURN_MEMORY === "false") return false;
  if (env.BUCK_TURN_MEMORY === "1" || env.BUCK_TURN_MEMORY === "true") return true;

  return settingsEnablement(cwd, options.home ?? homedir());
}
