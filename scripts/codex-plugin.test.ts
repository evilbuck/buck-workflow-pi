import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(repoRoot, "plugins", "buck-workflow");
/**
 * Curated bundle specification. `plugins/buck-workflow/skills/` is a
 * deliberately physical, self-contained Codex release bundle — never a
 * symlink to the canonical tree.
 *
 * - `canonicalCopies` must be byte-for-byte recursive copies of the
 *   same-named directory under the repo-root `skills/` tree. When a
 *   canonical skill changes, re-copy it into the bundle; this test enforces
 *   the parity contract.
 * - `codexOnly` skills exist only in the bundle (no canonical twin) and are
 *   the sole sanctioned divergence.
 */
const curatedBundle = {
  canonicalCopies: [
    "_shared",
    "b-brainstorm",
    "b-build",
    "b-docs",
    "b-explore",
    "b-fix-rebase-conflict",
    "b-grill",
    "b-grill-me",
    "b-grill-with-docs",
    "b-guardrails-check",
    "b-init-factory",
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
    "skill-explainer",
  ],
  codexOnly: ["b-build-hard", "b-commit"],
};

const bundledSkills = [
  ...curatedBundle.canonicalCopies,
  ...curatedBundle.codexOnly,
];

/** Recursive relative file listing of a directory tree. */
function listTree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(dir, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(root, "");
  return out.sort();
}

describe("curated bundle specification", () => {
  it("bundle directory set exactly equals the declared inventory", () => {
    const actual = readdirSync(join(pluginRoot, "skills"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(actual).toEqual([...bundledSkills].sort());
  });

  it("codex-only skills have no canonical twin under skills/", () => {
    for (const name of curatedBundle.codexOnly) {
      expect(existsSync(join(repoRoot, "skills", name))).toBe(false);
    }
  });

  it("canonical copies have recursive path parity with skills/<name>/", () => {
    const offenders: string[] = [];
    for (const name of curatedBundle.canonicalCopies) {
      const canonical = listTree(join(repoRoot, "skills", name));
      const bundled = listTree(join(pluginRoot, "skills", name));
      if (canonical.join("\n") !== bundled.join("\n")) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });

  it("canonical copies are byte-identical to skills/<name>/", () => {
    const offenders: string[] = [];
    for (const name of curatedBundle.canonicalCopies) {
      for (const rel of listTree(join(pluginRoot, "skills", name))) {
        const canonicalBytes = readFileSync(join(repoRoot, "skills", name, rel));
        const bundledBytes = readFileSync(join(pluginRoot, "skills", name, rel));
        if (!canonicalBytes.equals(bundledBytes)) {
          offenders.push(`${name}/${rel}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

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
