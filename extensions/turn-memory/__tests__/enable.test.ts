import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isTurnMemoryEnabled } from "../enable.js";

const originalEnv = process.env.BUCK_TURN_MEMORY;
const roots: string[] = [];

afterEach(() => {
  if (originalEnv === undefined) delete process.env.BUCK_TURN_MEMORY;
  else process.env.BUCK_TURN_MEMORY = originalEnv;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(): string {
  const path = mkdtempSync(join(tmpdir(), "turn-memory-"));
  roots.push(path);
  return path;
}

function settings(cwd: string, scope: ".pi" | ".omp", key: unknown): void {
  const directory = join(cwd, scope);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "settings.json"), JSON.stringify({ buckTurnMemory: key }));
}

describe("isTurnMemoryEnabled", () => {
  it("requires a SQL URL and defaults on when one exists", () => {
    const home = root();
    expect(isTurnMemoryEnabled(root(), {}, { home })).toBe(false);
    expect(isTurnMemoryEnabled(root(), { SQL_MEMORY_URL: "postgres://db" }, { home })).toBe(true);
    expect(isTurnMemoryEnabled(root(), { SQL_MEMORY_URL: "", BUCK_TURN_MEMORY: "1" }, { home })).toBe(false);
  });

  it.each([["0", false], ["false", false], ["1", true], ["true", true]])(
    "lets BUCK_TURN_MEMORY=%s override settings",
    (value, expected) => {
      const cwd = root();
      settings(cwd, ".pi", { enabled: !expected });
      expect(isTurnMemoryEnabled(cwd, { SQL_MEMORY_URL: "postgres://db", BUCK_TURN_MEMORY: value })).toBe(expected);
    },
  );

  it("uses the first settings file that defines the key and skips invalid JSON", () => {
    const cwd = root();
    settings(cwd, ".pi", { enabled: false });
    settings(cwd, ".omp", { enabled: true });
    expect(isTurnMemoryEnabled(cwd, { SQL_MEMORY_URL: "db" }, { home: root() })).toBe(false);

    const invalid = root();
    mkdirSync(join(invalid, ".pi"));
    writeFileSync(join(invalid, ".pi", "settings.json"), "{");
    settings(invalid, ".omp", { enabled: false });
    expect(isTurnMemoryEnabled(invalid, { SQL_MEMORY_URL: "db" }, { home: root() })).toBe(false);
    expect(isTurnMemoryEnabled(root(), { SQL_MEMORY_URL: "db" }, { home: root() })).toBe(true);
  });

  it("lets the first global settings file opt out when the project defines no key", () => {
    const cwd = root();
    const home = root();
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    writeFileSync(join(home, ".pi", "agent", "settings.json"), JSON.stringify({ buckTurnMemory: { enabled: false } }));
    mkdirSync(join(home, ".omp", "agent"), { recursive: true });
    writeFileSync(join(home, ".omp", "agent", "settings.json"), JSON.stringify({ buckTurnMemory: { enabled: true } }));
    expect(isTurnMemoryEnabled(cwd, { SQL_MEMORY_URL: "db" }, { home })).toBe(false);
  });
});
