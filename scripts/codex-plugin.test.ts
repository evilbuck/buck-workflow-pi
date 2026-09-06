import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(repoRoot, "plugins", "buck-workflow");
const bundledSkills = [
  "_shared",
  "b-brainstorm",
  "b-build",
  "b-build-hard",
  "b-commit",
  "b-docs",
  "b-explore",
  "b-fix-rebase-conflict",
  "b-grill",
  "b-grill-me",
  "b-grill-with-docs",
  "b-guardrails-check",
  "b-init-guardrails",
  "b-iterate",
  "b-phase",
  "b-plan",
  "b-pr",
  "b-pr-review-2-issues",
  "b-present",
  "b-research",
  "b-review",
  "b-save",
  "code-review-universal",
  "crawl4ai",
  "design-brief",
  "fix-pr",
  "git-commit",
  "run-in-idle-pane",
];

describe("Buck Workflow Codex plugin", () => {
  it("has a marketplace entry that resolves to the plugin bundle", () => {
    const marketplace = JSON.parse(
      readFileSync(join(repoRoot, ".agents", "plugins", "marketplace.json"), "utf8"),
    );

    expect(marketplace.plugins).toContainEqual(
      expect.objectContaining({
        name: "buck-workflow",
        source: { source: "local", path: "./plugins/buck-workflow" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      }),
    );
  });

  it("declares a self-contained skills-only plugin", () => {
    const manifest = JSON.parse(
      readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
    );

    expect(manifest).toMatchObject({
      name: "buck-workflow",
      version: "0.1.0",
      skills: "./skills/",
      interface: {
        displayName: "Buck Workflow",
        capabilities: ["Read", "Write"],
      },
    });
    expect(manifest).not.toHaveProperty("hooks");
    expect(manifest).not.toHaveProperty("mcpServers");
    expect(existsSync(join(pluginRoot, "assets", "buck-workflow.svg"))).toBe(true);
  });

  it("includes every curated workflow and no runtime extension bundle", () => {
    for (const skill of bundledSkills) {
      expect(existsSync(join(pluginRoot, "skills", skill, "SKILL.md"))).toBe(true);
    }

    expect(existsSync(join(pluginRoot, "extensions"))).toBe(false);
  });
});
