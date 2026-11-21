/// <reference types="node" />
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const source = join(dirname(fileURLToPath(import.meta.url)), "publish.ts");
const roots: string[] = [];

// Absolute path to the real bun binary: the fixture PATH holds only the fake
// shims, so the script's own `bun pm …`/`bun run test`/`bun publish` children must
// resolve through it while the fixture itself runs the true runtime.
const bunProbe = spawnSync("bun", ["--print", "process.execPath"], { encoding: "utf8" });
const BUN = bunProbe.status === 0 ? bunProbe.stdout.trim() : "bun";

// PATH contains only these fakes: even a non-dry-run can never invoke real git or npm.
function release(args: string[] = [], options: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "publish-test-"));
  roots.push(root);
  const bin = join(root, "bin");
  mkdirSync(bin);
  mkdirSync(join(root, "scripts"));
  copyFileSync(source, join(root, "scripts", "publish.ts"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "release-fixture", version: "1.2.3" }));
  const log = join(root, "commands");
  const fake = `#!/bin/sh
case "$0" in */bun) tool=bun ;; */git) tool=git ;; *) exit 99 ;; esac
command="$tool $*"
printf '%s\\n' "$command" >> "$RELEASE_LOG"
if [ "$command" = "$FAIL_COMMAND" ]; then exit 1; fi
case "$command" in
  'bun pm whoami') printf '%s\\n' "\${WHO:-release-user}" ;;
  'git status --porcelain') printf '%s' "$DIRTY" ;;
  'bun pm version '*) printf '%s' '{"name":"release-fixture","version":"1.2.4"}' > "$RELEASE_PACKAGE" ;;
  'bun pm view '*) printf '%s' "$PUBLISHED" ;;
  'git rev-parse --verify refs/tags/'*) printf '%s\n' "abc123" ;;
esac
`;
  for (const name of ["bun", "git"]) {
    const path = join(bin, name);
    writeFileSync(path, fake);
    chmodSync(path, 0o755);
  }
  const result = spawnSync(BUN, [join(root, "scripts", "publish.ts"), ...args], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: bin, RELEASE_LOG: log, RELEASE_PACKAGE: join(root, "package.json"), ...options },
  });
  return {
    ...result,
    commands: readFileSync(log, "utf8").trim().split("\n"),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("publish release CLI", () => {
  it("bumps before checking the updated version, then tests, previews, publishes and pushes", () => {
    const result = release();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Released release-fixture@1.2.4");
    expect(result.commands).toEqual([
      "bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version",
      "git add package.json", "git commit -m v1.2.4", "git tag -a v1.2.4 -m v1.2.4",
      "git rev-parse --verify refs/tags/v1.2.4",
      "bun pm view release-fixture@1.2.4", "bun run test", "bun pm pack --dry-run",
      "bun publish --access public", "git push --follow-tags",
    ]);
  });

  it("supports an explicit bump and rejects an already published version after bumping", () => {
    const result = release(["minor"], { PUBLISHED: "1.2.4" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("release-fixture@1.2.4 is already published");
    expect(result.commands).toEqual([
      "bun pm whoami", "git status --porcelain", "bun pm version minor --no-git-tag-version",
      "git add package.json", "git commit -m v1.2.4", "git tag -a v1.2.4 -m v1.2.4",
      "git rev-parse --verify refs/tags/v1.2.4", "bun pm view release-fixture@1.2.4",
    ]);
  });

  it("none publishes the existing version without a bump", () => {
    const result = release(["none"]);
    expect(result.status).toBe(0);
    expect(result.commands).toEqual([
      "bun pm whoami", "git status --porcelain", "bun pm view release-fixture@1.2.3",
      "bun run test", "bun pm pack --dry-run", "bun publish --access public", "git push --follow-tags",
    ]);
  });

  it("dry-run skips bump, publish and push even when the version exists", () => {
    const result = release(["major", "--dry-run"], { PUBLISHED: "1.2.3" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry-run — nothing published");
    expect(result.commands).toEqual([
      "bun pm whoami", "git status --porcelain", "bun pm view release-fixture@1.2.3", "bun run test", "bun pm pack --dry-run",
    ]);
  });

  it("stops immediately when npm authentication fails", () => {
    const result = release([], { FAIL_COMMAND: "bun pm whoami" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Not logged into npm");
    expect(result.commands).toEqual(["bun pm whoami"]);
  });

  it("stops before bumping a dirty tree", () => {
    const result = release([], { DIRTY: " M package.json" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Git tree not clean");
    expect(result.commands).toEqual(["bun pm whoami", "git status --porcelain"]);
  });

  const releaseGit = [
    "git add package.json", "git commit -m v1.2.4", "git tag -a v1.2.4 -m v1.2.4",
    "git rev-parse --verify refs/tags/v1.2.4",
  ];

  it("stops before publish when the release tag was not created", () => {
    const result = release([], { FAIL_COMMAND: "git rev-parse --verify refs/tags/v1.2.4" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Release tag v1.2.4 was not created");
    expect(result.commands).toEqual([
      "bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version",
      ...releaseGit,
    ]);
    expect(result.commands).not.toContain("bun publish --access public");
  });

  it.each([
    ["bun pm version patch --no-git-tag-version", ["bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version"]],
    ["git commit -m v1.2.4", ["bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version", "git add package.json", "git commit -m v1.2.4"]],
    ["git tag -a v1.2.4 -m v1.2.4", ["bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version", "git add package.json", "git commit -m v1.2.4", "git tag -a v1.2.4 -m v1.2.4"]],
    ["bun run test", ["bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version", ...releaseGit, "bun pm view release-fixture@1.2.4", "bun run test"]],
    ["bun pm pack --dry-run", ["bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version", ...releaseGit, "bun pm view release-fixture@1.2.4", "bun run test", "bun pm pack --dry-run"]],
    ["bun publish --access public", ["bun pm whoami", "git status --porcelain", "bun pm version patch --no-git-tag-version", ...releaseGit, "bun pm view release-fixture@1.2.4", "bun run test", "bun pm pack --dry-run", "bun publish --access public"]],
  ])("stops subsequent commands when %s fails", (failure, commands) => {
    const result = release([], { FAIL_COMMAND: failure });
    expect(result.status).not.toBe(0);
    expect(result.commands).toEqual(commands);
  });

  it("warns but reports success when pushing the already-published release fails", () => {
    const result = release([], { FAIL_COMMAND: "git push --follow-tags" });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("git push failed");
    expect(result.stdout).toContain("Released release-fixture@1.2.4");
    expect(result.commands.at(-1)).toBe("git push --follow-tags");
  });

  it.each(["git status --porcelain", "bun pm view release-fixture@1.2.4"])(
    "currently proceeds to publish when %s fails",
    (failure) => {
      const result = release([], { FAIL_COMMAND: failure });
      expect(result.status).toBe(0);
      expect(result.commands).toContain("bun publish --access public");
      expect(result.commands.at(-1)).toBe("git push --follow-tags");
    },
  );
});
