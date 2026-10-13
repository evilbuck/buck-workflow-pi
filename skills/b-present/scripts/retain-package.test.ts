import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("retain-package accepts the documented positional path without --cwd", () => {
  const root = mkdtempSync(join(tmpdir(), "retain-package-"));
  roots.push(root);
  const repo = join(root, "repo");
  mkdirSync(repo);
  execFileSync("git", ["init", "-q", repo]);
  execFileSync("git", ["-C", repo, "config", "user.email", "test@example.invalid"]);
  execFileSync("git", ["-C", repo, "config", "user.name", "Test"]);
  execFileSync("git", ["-C", repo, "remote", "add", "origin", "https://example.invalid/project.git"]);
  writeFileSync(join(repo, "README.md"), "fixture\n");
  execFileSync("git", ["-C", repo, "add", "README.md"]);
  execFileSync("git", ["-C", repo, "commit", "-qm", "fixture"]);
  const packageDir = join(repo, "presentations", "demo");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, "index.html"), "<main>retained</main>");
  const config = join(root, "config.yaml");
  writeFileSync(config, "version: 1\nstorage:\n  adapter: repo-files\nprojects: {}\n");
  const script = resolve("skills/b-present/scripts/retain-package.ts");
  const stdout = execFileSync("bun", [script, packageDir], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, BUCK_WORKFLOW_CONFIG: config, XDG_CONFIG_HOME: join(root, "xdg") },
  });
  expect(JSON.parse(stdout)).toMatchObject({ ok: true, files: 1 });
  expect(readFileSync(join(packageDir, "index.html"), "utf8")).toBe("<main>retained</main>");
});
