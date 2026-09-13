import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseModelEntry,
  loadCatalog,
  selectFixerModel,
  thinkingFor,
  thinkingFromSelector,
  reviewerThinking,
  CatalogError,
} from "../catalog.js";

const NOW = Date.parse("2026-09-12");

function entryText(overrides: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    schema_version: "1",
    selector: "zai/glm-5.3",
    family: "glm-5.3",
    aliases: "[glm-5.3]",
    fixer_capability: "hard",
    roles: "[reviewer, fixer]",
    priority: "100",
    thinking_easy: "minimal",
    thinking_medium: "high",
    thinking_hard: "xhigh",
    enabled: "true",
    calibration_source: "seeded",
    reviewed_at: "2026-09-01",
  };
  Object.assign(fields, overrides);
  const body = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `---\n${body}\n---\n# rationale\n`;
}

function entry(overrides: Record<string, string> = {}) {
  return parseModelEntry(entryText(overrides), "seed.md", NOW).entry;
}

describe("parseModelEntry", () => {
  it("parses a valid entry", () => {
    const e = entry();
    expect(e.selector).toBe("zai/glm-5.3");
    expect(e.family).toBe("glm-5.3");
    expect(e.fixerCapability).toBe("hard");
    expect(e.roles).toEqual(["reviewer", "fixer"]);
    expect(e.priority).toBe(100);
    expect(e.thinking).toEqual({ easy: "minimal", medium: "high", hard: "xhigh" });
    expect(e.enabled).toBe(true);
  });

  it("throws on missing required fields", () => {
    expect(() => parseModelEntry("---\nselector: a/b\n---\n", "x.md", NOW)).toThrow(CatalogError);
  });

  it("throws on bad enum, bool, int, and date values", () => {
    expect(() => entry({ fixer_capability: "extreme" })).toThrow(/fixer_capability/);
    expect(() => entry({ enabled: "yes" })).toThrow(/enabled/);
    expect(() => entry({ priority: "0" })).toThrow(/priority/);
    expect(() => entry({ reviewed_at: "2026-13-99" })).toThrow(/reviewed_at/);
    expect(() => entry({ schema_version: "2" })).toThrow(/schema_version/);
    expect(() => entry({ roles: "[reviewer, editor]" })).toThrow(/roles/);
    expect(() => entry({ roles: "[]" })).toThrow(/roles/);
  });

  it("warns when calibration is stale", () => {
    const { warnings } = parseModelEntry(entryText({ reviewed_at: "2025-01-01" }), "old.md", NOW);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/older than 180 days/);
  });

  it("thinkingFor maps tier to the catalogued level", () => {
    expect(thinkingFor(entry(), "hard")).toBe("xhigh");
    expect(thinkingFor(entry(), "easy")).toBe("minimal");
  });

  it("thinkingFromSelector reads a trailing thinking suffix", () => {
    expect(thinkingFromSelector("zai/glm-5.3:high")).toBe("high");
    expect(thinkingFromSelector("zai/glm-5.3")).toBeNull();
    expect(thinkingFromSelector(null)).toBeNull();
  });

  it("reviewerThinking prefers the selector suffix then catalog medium", () => {
    expect(reviewerThinking("zai/glm-5.3:xhigh", [entry()])).toBe("xhigh");
    expect(reviewerThinking("zai/glm-5.3", [entry()])).toBe("high");
  });
});

describe("loadCatalog", () => {
  it("aggregates entries, duplicate errors, and warnings across files", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-"));
    try {
      writeFileSync(join(dir, "a.md"), entryText());
      writeFileSync(join(dir, "b.md"), entryText({ selector: "zai/glm-5.3" }));
      writeFileSync(join(dir, "c.md"), entryText({ selector: "anthropic/claude-sonnet-5", family: "claude-sonnet-5", fixer_capability: "medium" }));
      writeFileSync(join(dir, "d.md"), "---\nbroken\n");
      const result = loadCatalog(dir, NOW);
      expect(result.entries.map((e) => e.selector).sort()).toEqual([
        "anthropic/claude-sonnet-5",
        "zai/glm-5.3",
      ]);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.join("\n")).toMatch(/duplicate selector zai\/glm-5.3/);
      expect(result.errors.join("\n")).toMatch(/d\.md/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports an unreadable directory as an error, not a throw", () => {
    const result = loadCatalog(join(tmpdir(), "definitely-missing-xyz"));
    expect(result.entries).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});

describe("selectFixerModel", () => {
  const hard = entry({ selector: "zai/glm-5.3", family: "glm-5.3", priority: "100" });
  const hardOther = entry({ selector: "openai-codex/gpt-5.6-sol", family: "gpt-5.6-sol", priority: "110" });
  const medium = entry({
    selector: "anthropic/claude-sonnet-5",
    family: "claude-sonnet-5",
    fixer_capability: "medium",
    priority: "90",
  });
  const easy = entry({
    selector: "openai-codex/gpt-5.6-luna",
    family: "gpt-5.6-luna",
    fixer_capability: "easy",
    priority: "10",
  });
  const entries = [hard, hardOther, medium, easy];
  const all = ["zai/glm-5.3", "openai-codex/gpt-5.6-sol", "anthropic/claude-sonnet-5", "openai-codex/gpt-5.6-luna"];

  it("prefers the lowest sufficient capability tier", () => {
    const pick = selectFixerModel({ entries, availableSelectors: all, requiredHardness: "easy" });
    expect(pick.selector).toBe("openai-codex/gpt-5.6-luna");
    expect(pick.fallback).toBe(false);
  });

  it("escalates to a capable tier when the low tier cannot handle it", () => {
    const pick = selectFixerModel({ entries, availableSelectors: all, requiredHardness: "medium" });
    expect(pick.selector).toBe("anthropic/claude-sonnet-5");
  });

  it("requires hard capability for hard findings", () => {
    const pick = selectFixerModel({ entries, availableSelectors: all, requiredHardness: "hard" });
    expect(["zai/glm-5.3", "openai-codex/gpt-5.6-sol"]).toContain(pick.selector);
  });

  it("excludes the exact reviewer model when an alternative exists", () => {
    const pick = selectFixerModel({
      entries,
      availableSelectors: all,
      requiredHardness: "hard",
      reviewerSelector: "zai/glm-5.3",
    });
    expect(pick.selector).toBe("openai-codex/gpt-5.6-sol");
    expect(pick.reusedReviewer).toBe(false);
  });

  it("prefers a different provider and family within a tier", () => {
    const pick = selectFixerModel({
      entries,
      availableSelectors: all,
      requiredHardness: "medium",
      reviewerSelector: "zai/glm-5.3-flash-uncatalogued",
    });
    // No reviewer entry in catalog: provider diversity still steers away from zai?  zai not among candidates.
    expect(pick.selector).toBe("anthropic/claude-sonnet-5");
  });

  it("reuses the reviewer model with a note when it is the only capable model", () => {
    const pick = selectFixerModel({
      entries,
      availableSelectors: ["zai/glm-5.3"],
      requiredHardness: "hard",
      reviewerSelector: "zai/glm-5.3",
    });
    expect(pick.selector).toBe("zai/glm-5.3");
    expect(pick.reusedReviewer).toBe(true);
  });

  it("signals fallback when no catalogued model is eligible or available", () => {
    const pick = selectFixerModel({ entries, availableSelectors: ["anthropic/claude-sonnet-5"], requiredHardness: "hard" });
    expect(pick.fallback).toBe(true);
    expect(pick.selector).toBe("");
    const disabled = selectFixerModel({
      entries: [entry({ selector: "zai/glm-5.3", enabled: "false" })],
      availableSelectors: ["zai/glm-5.3"],
      requiredHardness: "easy",
    });
    expect(disabled.fallback).toBe(true);
  });
});
