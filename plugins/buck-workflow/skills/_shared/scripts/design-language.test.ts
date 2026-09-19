import { afterEach, describe, expect, it, vi } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  CONSUMER_FILES,
  extractGeneratedBlock,
  loadDesignBrief,
  main,
  parseTokenBlock,
  renderMermaidInit,
  renderTokenBlock,
  spliceGeneratedBlock,
} from "./render-design-tokens.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const BRIEF = "skills/_shared/design-brief.jsonc";

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const temps: string[] = [];

function seedTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "design-lang-"));
  temps.push(root);
  for (const rel of [BRIEF, ...CONSUMER_FILES]) {
    const dest = join(root, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(ROOT, rel), dest);
  }
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (temps.length > 0) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("design language: brief is the single source of truth", () => {
  it("renders a token block that round-trips to exactly the brief's tokens", () => {
    const brief = loadDesignBrief(ROOT);
    // Both directions in one assertion: a token only in the CSS, or only in the
    // brief, breaks the deep-equal. Byte-identity across consumers cannot catch
    // that on its own.
    expect(parseTokenBlock(renderTokenBlock(brief))).toEqual(brief.tokens);
  });

  it.each(CONSUMER_FILES)("%s carries the generated token block verbatim", (rel) => {
    const expected = renderTokenBlock(loadDesignBrief(ROOT));
    expect(extractGeneratedBlock(read(rel), "design-tokens")).toBe(expected);
  });

  it.each(CONSUMER_FILES)("%s carries the generated mermaid init verbatim", (rel) => {
    const expected = renderMermaidInit(loadDesignBrief(ROOT));
    expect(extractGeneratedBlock(read(rel), "mermaid-init")).toBe(expected);
  });
});

describe("design language: skills point at the shared brief", () => {
  it.each(["skills/b-blueprint/SKILL.md", "skills/b-present/SKILL.md"])(
    "%s names skills/_shared/design-brief.jsonc",
    (rel) => {
      expect(read(rel)).toContain("skills/_shared/design-brief.jsonc");
    },
  );
});

describe("extractGeneratedBlock", () => {
  it("returns null when the block is absent, so a deleted marker fails loudly", () => {
    expect(extractGeneratedBlock("body{}", "design-tokens")).toBeNull();
  });
});

describe("design language: mermaid hex is a token", () => {
  it("every mermaid themeVariables hex exists in brief.tokens", () => {
    const brief = loadDesignBrief(ROOT);
    const tokens = Object.values(brief.tokens);
    const theme = brief.mermaid.config.themeVariables as Record<string, unknown>;
    const missing = Object.values(theme).filter(
      (v): v is string => typeof v === "string" && v.startsWith("#") && !tokens.includes(v),
    );
    expect(missing).toEqual([]);
  });
});

describe("design language: one consumer list", () => {
  it("brief.source.consumers matches CONSUMER_FILES", () => {
    const brief = loadDesignBrief(ROOT) as { source: { consumers: string[] } };
    expect(brief.source.consumers).toEqual([...CONSUMER_FILES]);
  });
});

describe("spliceGeneratedBlock", () => {
  it("replaces the marked token block and leaves the rest of the file intact", () => {
    const file = read(CONSUMER_FILES[0]);
    const original = extractGeneratedBlock(file, "design-tokens");
    const fake = renderTokenBlock(loadDesignBrief(ROOT)).replace("#f7f6f3", "#000000");
    const out = spliceGeneratedBlock(file, "design-tokens", fake);
    expect(extractGeneratedBlock(out, "design-tokens")).toBe(fake);
    expect(out.replace(fake, original!)).toBe(file);
  });

  it("throws when the marker is missing", () => {
    expect(() => spliceGeneratedBlock("body{}", "design-tokens", "x")).toThrow(
      "no generated:design-tokens block to replace",
    );
  });
});

describe("render-design-tokens CLI", () => {
  it("prints the token block for --css and the mermaid init for --mermaid", () => {
    const brief = loadDesignBrief(ROOT);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    main(["--css"], ROOT);
    main(["--mermaid"], ROOT);
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      renderTokenBlock(brief),
      renderMermaidInit(brief),
    ]);
  });

  it("prints both blocks when given no flags", () => {
    const brief = loadDesignBrief(ROOT);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    main([], ROOT);
    expect(log).toHaveBeenCalledWith(`${renderTokenBlock(brief)}\n\n${renderMermaidInit(brief)}`);
  });

  it("--write on a matching tree reports already up to date and does not touch files", () => {
    const root = seedTempRoot();
    const target = join(root, CONSUMER_FILES[0]);
    const before = readFileSync(target, "utf8");
    const mtime = statSync(target).mtimeMs;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    main(["--write"], root);
    expect(log).toHaveBeenCalledWith("already up to date");
    expect(readFileSync(target, "utf8")).toBe(before);
    expect(statSync(target).mtimeMs).toBe(mtime);
  });

  it("--write rewrites a stale consumer and leaves a matching sibling untouched", () => {
    const root = seedTempRoot();
    const staleRel = CONSUMER_FILES[0];
    const freshRel = CONSUMER_FILES[1];
    const stalePath = join(root, staleRel);
    const freshPath = join(root, freshRel);
    const freshBefore = readFileSync(freshPath, "utf8");
    writeFileSync(stalePath, readFileSync(stalePath, "utf8").replace("--bg:#f7f6f3", "--bg:#000000"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    main(["--write"], root);
    expect(log).toHaveBeenCalledWith(`updated:\n  ${staleRel}`);
    expect(extractGeneratedBlock(readFileSync(stalePath, "utf8"), "design-tokens")).toBe(
      renderTokenBlock(loadDesignBrief(root)),
    );
    expect(readFileSync(freshPath, "utf8")).toBe(freshBefore);
  });
});
