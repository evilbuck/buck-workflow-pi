import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(repoRoot, "skills");

/** Direct (non-nested) skill directories under skills/. */
function directSkillDirs(): string[] {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}


function extractName(body: string[]): string | null {
  for (const line of body) {
    const match = line.match(/^name:\s*(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

function extractDescription(body: string[]): string | null {
  for (let i = 0; i < body.length; i++) {
    const match = body[i].match(/^description:\s*(.*)$/);
    if (!match) continue;
    const inline = match[1].trim();
    if (inline && !/^[|>][+-]?$/.test(inline)) return inline;
    if (!/^[|>][+-]?$/.test(inline)) continue;
    return blockScalar(body, i);
  }
  return null;
}

function blockScalar(body: string[], start: number): string {
  const collected: string[] = [];
  for (let j = start + 1; j < body.length; j++) {
    if (body[j] === "" || /^\s+\S/.test(body[j])) collected.push(body[j]);
    else break;
  }
  return collected.join("\n").trim();
}

/**
 * Minimal frontmatter extraction: opening `---`, closing `---`, a single-line
 * `name:`, and a `description:` that is either inline or a YAML block scalar
 * (`>`, `|-`, `>-`, `|`). Good enough for the catalog invariant; not a YAML
 * parser.
 */
function parseFrontmatter(text: string): {
  name: string | null;
  description: string | null;
} {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return { name: null, description: null };

  const end = lines.findIndex((line, i) => i > 0 && line === "---");
  if (end === -1) return { name: null, description: null };

  const body = lines.slice(1, end);
  return { name: extractName(body), description: extractDescription(body) };
}
describe("direct root-skill catalog", () => {
  it("every direct skills/*/ directory has a SKILL.md", () => {
    const missing = directSkillDirs().filter(
      (dir) => !existsSync(join(skillsRoot, dir, "SKILL.md")),
    );
    expect(missing).toEqual([]);
  });

  it("every direct skills/*/SKILL.md opens with closed frontmatter", () => {
    const offenders: string[] = [];
    for (const dir of directSkillDirs()) {
      const text = readFileSync(join(skillsRoot, dir, "SKILL.md"), "utf8");
      const lines = text.split(/\r?\n/);
      const hasOpen = lines[0] === "---";
      const hasClose = lines.findIndex((l, i) => i > 0 && l === "---") !== -1;
      if (!hasOpen || !hasClose) offenders.push(dir);
    }
    expect(offenders).toEqual([]);
  });

  it("every direct skill declares a nonempty name and description", () => {
    const offenders: string[] = [];
    for (const dir of directSkillDirs()) {
      const text = readFileSync(join(skillsRoot, dir, "SKILL.md"), "utf8");
      const { name, description } = parseFrontmatter(text);
      if (!name || !description) offenders.push(`${dir} (name=${name ?? "∅"})`);
    }
    expect(offenders).toEqual([]);
  });

  it("skill names are unique across the direct catalog", () => {
    const names = directSkillDirs().map((dir) =>
      parseFrontmatter(readFileSync(join(skillsRoot, dir, "SKILL.md"), "utf8")).name,
    );
    const seen: Record<string, true> = {};
    const duplicates: string[] = [];
    for (const name of names) {
      if (name === null) continue;
      if (seen[name]) duplicates.push(name);
      seen[name] = true;
    }
    expect(duplicates).toEqual([]);
  });

  it("parses block-scalar descriptions (spot check b-guardrails-check)", () => {
    const text = readFileSync(join(skillsRoot, "b-guardrails-check", "SKILL.md"), "utf8");
    const { name, description } = parseFrontmatter(text);
    expect(name).toBe("b-guardrails-check");
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(20);
  });
});
