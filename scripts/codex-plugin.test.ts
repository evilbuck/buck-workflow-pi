import { existsSync, readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(repoRoot, "plugins", "buck-workflow");
/**
 * Curated bundle specification. `plugins/buck-workflow/skills/` is a
 * deliberately physical, self-contained Codex release bundle — never a
 * symlink to the canonical tree.
 *
 * - `canonicalCopies` are physical copies of the same-named canonical skill
 *   directories. Synchronize release copies when changing their source.
 *   Validate packaged runtime behavior rather than asserting copied source text.
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
    "codebase-design",
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

  it("retains exact artifact bytes across bundled CLI processes and refuses a stale revision", () => {
    const root = mkdtempSync(join(tmpdir(), "bundled-workflow-"));
    const config = join(root, "storage.yaml");
    writeFileSync(config, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "records.sqlite")}\n`);
    const env = { ...process.env, BUCK_WORKFLOW_CONFIG: config, XDG_CONFIG_HOME: join(root, "identity") };
    const command = (operation: string, request: Record<string, unknown>) => spawnSync("bun", [
      join(pluginRoot, "skills", "_shared", "scripts", "workflow-state-cli.ts"),
      operation, "--subject", "bundle-proof", JSON.stringify(request),
    ], { cwd: root, env, encoding: "utf8" });
    const ref = { kind: "plan", logicalName: "plan-proof.md" };
    try {
      const first = command("write", { ref, body: "# Original\n", expectedRevision: null });
      expect(first.status, first.stderr).toBe(0);
      const original = JSON.parse(first.stdout) as { revision: string };
      const updated = command("write", { ref, body: "# Updated\n", expectedRevision: original.revision });
      expect(updated.status, updated.stderr).toBe(0);
      const stale = command("write", { ref, body: "# Stale\n", expectedRevision: original.revision });
      expect(stale.status).toBe(1);
      expect(stale.stderr).toMatch(/stale revision/);
      const read = command("read", { ref });
      expect(read.status, read.stderr).toBe(0);
      expect(JSON.parse(read.stdout)).toMatchObject({ text: "# Updated\n", revision: JSON.parse(updated.stdout).revision });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
