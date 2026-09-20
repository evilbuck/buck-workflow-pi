import { existsSync, lstatSync, readlinkSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const promptsDir = join(repoRoot, "prompts");
const commandsDir = join(repoRoot, "commands");

function mdNames(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort();
}

/**
 * The mirror contract: `prompts/` is the single source of truth for slash
 * command bodies. Every prompt is mirrored by a `commands/<name>.md` symlink
 * pointing at `../prompts/<name>.md`, and `commands/` contains nothing else.
 * No physical-file exceptions — derived from the tree, never from counts.
 */
describe("prompts ↔ commands symlink mirror", () => {
  it("every prompts/*.md has a commands/<name>.md symlink", () => {
    const missing = mdNames(promptsDir).filter(
      (name) => !existsSync(join(commandsDir, name)),
    );
    expect(missing).toEqual([]);
  });

  it("every commands/*.md is a symlink to ../prompts/<name>.md", () => {
    const offenders: string[] = [];
    for (const name of mdNames(commandsDir)) {
      const path = join(commandsDir, name);
      if (!lstatSync(path).isSymbolicLink()) {
        offenders.push(`${name} (physical file)`);
        continue;
      }
      const target = readlinkSync(path);
      if (target !== `../prompts/${name}`) {
        offenders.push(`${name} → ${target}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every commands/*.md symlink resolves to its prompt twin", () => {
    const broken = mdNames(commandsDir).filter((name) => {
      const path = join(commandsDir, name);
      if (!lstatSync(path).isSymbolicLink()) return true;
      const resolved = resolve(commandsDir, readlinkSync(path));
      return resolved !== join(promptsDir, name) || !existsSync(resolved);
    });
    expect(broken).toEqual([]);
  });

  it("commands/ contains no undeclared extras beyond the prompt set", () => {
    const prompts: Record<string, true> = {};
    for (const name of mdNames(promptsDir)) prompts[name] = true;
    const extras = readdirSync(commandsDir).filter((name) => !prompts[name]);
    expect(extras).toEqual([]);
  });
});
