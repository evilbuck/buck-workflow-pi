import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "skills/git-cleanup/scripts/classify.ts");
const roots: string[] = [];
const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(repo: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "git-cleanup-classify-"));
  roots.push(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.test");
  writeFileSync(join(root, "README.md"), "base\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "base commit");
  git(root, "remote", "add", "origin", "https://example.invalid/repo.git");
  git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "refs/heads/main"));
  git(root, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  const bin = join(root, ".git", "test-bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "git"), `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "fetch") process.exit(1);
if (args[0] === "merge-tree" && process.env.MERGE_OUTPUT) {
  process.stdout.write(readFileSync(process.env.MERGE_OUTPUT));
  process.exit(Number(process.env.MERGE_STATUS || 0));
}
const result = spawnSync(${JSON.stringify(realGit)}, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
`);
  writeFileSync(join(bin, "gh"), "#!/usr/bin/env node\nprocess.exit(1);\n");
  chmodSync(join(bin, "git"), 0o755);
  chmodSync(join(bin, "gh"), 0o755);
  return root;
}

function run(root: string, args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  return spawnSync("bun", [script, ...args], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, PATH: `${join(root, ".git", "test-bin")}:${process.env.PATH}`, ...env },
  });
}

function report(root: string) {
  const result = run(root);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe("git-cleanup classifier", () => {
  it("prints one JSON inventory and skips the current and base branches without deleting", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/demo");
    writeFileSync(join(root, "feature.txt"), "work\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "feature work");
    const before = git(root, "for-each-ref", "--format=%(refname):%(objectname)", "refs/heads");

    const result = run(root);

    expect(result.status).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(result.stdout.trim().startsWith("{")).toBe(true);
    expect(result.stdout.trim().endsWith("}")).toBe(true);
    expect(value.base.ref).toBe("refs/remotes/origin/HEAD");
    expect(value.items.find((item: { name: string }) => item.name === "main").disposition).toBe("skip");
    expect(value.items.find((item: { name: string }) => item.name === "feature/demo").disposition).toBe("skip");
    expect(git(root, "for-each-ref", "--format=%(refname):%(objectname)", "refs/heads")).toBe(before);
  });
  it("keeps branch identity distinct from a colliding tag name", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature");
    git(root, "worktree", "add", join(root, "main-tree"), "main");
    git(root, "tag", "main");

    const value = report(root);
    const mainRows = value.items.filter((item: { name: string }) => item.name === "main");

    expect(mainRows).toHaveLength(1);
    expect(mainRows[0].kind).toBe("worktree");
    expect(mainRows[0].disposition).toBe("skip");
    expect(mainRows[0].skip_reason).toBe("integration");
    expect(value.items.some((item: { name: string }) => item.name === "heads/main")).toBe(false);
  });

  it("fails closed when no base exists", () => {
    const root = repo();
    git(root, "checkout", "--detach", "-q");
    git(root, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD");
    git(root, "update-ref", "-d", "refs/remotes/origin/main");
    git(root, "branch", "-D", "main");
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
  it("uses local master then main when origin/HEAD is unavailable", () => {
    const masterRoot = repo();
    git(masterRoot, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD");
    git(masterRoot, "checkout", "-qb", "feature/test");
    git(masterRoot, "branch", "-m", "main", "master");
    expect(report(masterRoot).base.ref).toBe("refs/heads/master");

    const mainRoot = repo();
    git(mainRoot, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD");
    git(mainRoot, "update-ref", "-d", "refs/remotes/origin/main");
    expect(report(mainRoot).base.ref).toBe("refs/heads/main");
  });

  it("marks upstream state unknown when fetch fails", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/upstream");
    git(root, "config", "branch.feature/upstream.remote", "origin");
    git(root, "config", "branch.feature/upstream.merge", "refs/heads/feature/upstream");
    git(root, "update-ref", "refs/remotes/origin/feature/upstream", git(root, "rev-parse", "HEAD"));
    git(root, "update-ref", "-d", "refs/remotes/origin/feature/upstream");

    const reportValue = report(root);
    expect(reportValue.fetch.ok).toBe(false);
    expect(reportValue.items.find((item: { name: string }) => item.name === "feature/upstream").remote).toBe("unknown");
  });


  it("auto-deletes proof includes two-commit squash despite git cherry plus", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/squash");
    writeFileSync(join(root, "one.txt"), "one\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "first feature commit");
    writeFileSync(join(root, "two.txt"), "two\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "second feature commit");
    const cherry = git(root, "cherry", "main", "feature/squash");
    git(root, "checkout", "-q", "main");
    git(root, "merge", "--squash", "feature/squash");
    git(root, "commit", "-qm", "squashed feature");
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    git(root, "checkout", "-qb", "feature/other", "main");

    const item = report(root).items.find((row: { name: string }) => row.name === "feature/squash");
    expect(cherry).toContain("+");
    expect(item.disposition).toBe("auto-delete");
    expect(item.cherry.plus).toBe(2);
  });

  it("keeps unique context out of auto-delete even when code is contained", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/context");
    writeFileSync(join(root, "code.txt"), "branch\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "context fixture");
    git(root, "checkout", "-q", "main");
    git(root, "merge", "--squash", "feature/context");
    git(root, "commit", "-qm", "land code fixture");
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    git(root, "checkout", "-q", "feature/context");
    mkdirSync(join(root, ".context"));
    writeFileSync(join(root, ".context", "notes.md"), "unique\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "unique context");
    git(root, "checkout", "-q", "main");

    const item = report(root).items.find((row: { name: string }) => row.name === "feature/context");
    expect(item.unique_context).toBe(true);
    expect(item.disposition).toBe("ask");
    expect(item.state).toBe("finished");
  });

  it("does not auto-delete when merge-tree conflicts in source", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/source-conflict");
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src/app.ts"), "feature\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "feature source");
    git(root, "checkout", "-q", "main");
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src/app.ts"), "main\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "main source");
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));

    const item = report(root).items.find((row: { name: string }) => row.name === "feature/source-conflict");
    expect(item.contained).toBe(false);
    expect(item.disposition).toBe("ask");
    expect(item.conflict_paths).toContain("src/app.ts");
  });

  it("accepts a context-only merge-tree conflict as contained code but still asks", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/context-conflict");
    mkdirSync(join(root, ".context"));
    writeFileSync(join(root, ".context", "plan.md"), "feature version\n");
    git(root, "add", ".context");
    git(root, "commit", "-qm", "feature context");
    git(root, "checkout", "-q", "main");
    mkdirSync(join(root, ".context"));
    writeFileSync(join(root, ".context", "plan.md"), "main version\n");
    git(root, "add", ".context");
    git(root, "commit", "-qm", "main context");
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));

    const item = report(root).items.find((row: { name: string }) => row.name === "feature/context-conflict");
    expect(item.contained).toBe(true);
    expect(item.conflict_paths).toContain(".context/plan.md");
    expect(item.disposition).toBe("ask");
  });

  it("blocks auto-delete for tracked and untracked changes in a registered worktree", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/dirty");
    writeFileSync(join(root, "landed.txt"), "landed\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "landable source");
    git(root, "checkout", "-q", "main");
    git(root, "merge", "--squash", "feature/dirty");
    git(root, "commit", "-qm", "land feature");
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    const external = join(tmpdir(), `git-cleanup-worktree-${Date.now()}`);
    roots.push(external);
    git(root, "worktree", "add", "-q", external, "feature/dirty");
    writeFileSync(join(external, "landed.txt"), "edited\n");
    writeFileSync(join(external, "untracked.txt"), "untracked\n");

    const item = report(root).items.find((row: { name: string }) => row.name === "feature/dirty");
    expect(item.path).toBe(external);
    expect(item.dirty).toBe(true);
    expect(item.dirty_paths).toHaveLength(2);
    expect(item.disposition).toBe("ask");
  });
  it.each(["ancestor", "single squash", "cherry pick"])("proves an eligible %s branch", (mode) => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/landed");
    writeFileSync(join(root, "landed.ts"), "export const landed = true;\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "feature code");
    const tip = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "-q", "main");
    if (mode === "ancestor") git(root, "merge", "--ff-only", "feature/landed");
    else {
      writeFileSync(join(root, "independent.txt"), "integration only\n");
      git(root, "add", ".");
      git(root, "commit", "-qm", "independent integration commit");
      if (mode === "single squash") {
        git(root, "merge", "--squash", "feature/landed");
        git(root, "commit", "-qm", "squash feature");
      } else git(root, "cherry-pick", tip);
    }
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    const item = report(root).items.find((row: { name: string }) => row.name === "feature/landed");
    expect(item).toMatchObject({ contained: true, unique_context: false, dirty: false, disposition: "auto-delete" });
    if (mode === "cherry pick") expect(item.cherry).toEqual({ plus: 0, minus: 1 });
  });

  it.each(["untracked", "ignored", "prunable", "newline"])("handles a registered %s worktree", (mode) => {
    const root = repo();
    writeFileSync(join(root, ".gitignore"), "ignored.txt\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "ignore disposable files");
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    const holder = mkdtempSync(join(tmpdir(), "git-cleanup-external-"));
    roots.push(holder);
    const path = join(holder, mode === "newline" ? "checkout\nline" : "checkout");
    git(root, "worktree", "add", "-qb", "feature/worktree", path, "main");
    if (mode === "untracked") writeFileSync(join(path, "untracked.txt"), "untracked\n");
    if (mode === "ignored") writeFileSync(join(path, "ignored.txt"), "ignored\n");
    if (mode === "prunable") rmSync(path, { recursive: true });
    const item = report(root).items.find((row: { name: string }) => row.name === "feature/worktree");
    expect(item.path).toBe(path);
    expect(item.disposition).toBe(mode === "prunable" || mode === "untracked" ? "ask" : "auto-delete");
    expect(item.dirty).toBe(mode === "untracked" || mode === "prunable");
    expect(item.prunable).toBe(mode === "prunable");
    if (mode === "untracked") expect(item.dirty_paths).toEqual(["?? untracked.txt"]);
    if (mode === "ignored") expect(item.dirty_paths).toEqual([]);
  });

  it("asks for a missing-gitdir registration even when Git can fall back to a clean parent", () => {
    const root = repo();
    writeFileSync(join(root, ".git", "info", "exclude"), "checkout/\n");
    const path = join(root, "checkout");
    git(root, "worktree", "add", "-qb", "feature/missing-gitdir", path, "main");
    rmSync(join(path, ".git"));
    const item = report(root).items.find((row: { name: string }) => row.name === "feature/missing-gitdir");
    expect(item).toMatchObject({ path, prunable: true, contained: false, disposition: "ask" });
    expect(git(root, "rev-parse", "refs/heads/feature/missing-gitdir")).toBe(item.tip);
  });

  it("ignores changed workflow metadata when selecting a feature plan description", () => {
    const root = repo();
    git(root, "checkout", "-qb", "feature/workflow-metadata");
    mkdirSync(join(root, ".context", "2026-10-26.feature"), { recursive: true });
    writeFileSync(join(root, ".context", "2026-10-26.feature", "plan-feature.md"), "---\nstatus: draft\n---\n# Feature plan title\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "add feature plan");
    writeFileSync(join(root, "unique.ts"), "export const feature = true;\n");
    mkdirSync(join(root, ".context", "workflow"), { recursive: true });
    writeFileSync(join(root, ".context", "workflow", "session.md"), "changed workflow metadata\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "implement feature");
    git(root, "checkout", "-q", "main");
    const item = report(root).items.find((row: { name: string }) => row.name === "feature/workflow-metadata");
    expect(item).toMatchObject({
      disposition: "ask", contained: false, state: "building",
      description_source: "plan_h1", description: "Feature plan title",
    });
  });

  it("uses the branch plan after a code commit and ignores inherited completed subjects", () => {
    const root = repo();
    mkdirSync(join(root, ".context", "2020-01-01.old"), { recursive: true });
    writeFileSync(join(root, ".context", "2020-01-01.old", "index.md"), "---\nstatus: completed\n---\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "historical completed subject");
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    git(root, "checkout", "-qb", "feature/unique");
    mkdirSync(join(root, ".context", "2026-10-26.feature"), { recursive: true });
    writeFileSync(join(root, ".context", "2026-10-26.feature", "index.md"), "---\nstatus: active\n---\n");
    writeFileSync(join(root, ".context", "2026-10-26.feature", "plan-feature.md"), "---\nstatus: draft\n---\n# Intended feature description\n\nHistorical body: status: completed\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "plan feature");
    writeFileSync(join(root, "unique.ts"), "export const unique = true;\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "implement feature code");
    git(root, "checkout", "-q", "main");
    const item = report(root).items.find((row: { name: string }) => row.name === "feature/unique");
    expect(item).toMatchObject({
      disposition: "ask", contained: false, state: "building", pr: null,
      description_source: "plan_h1", description: "Intended feature description",
    });
  });

  it.each([
    "unrecognized-record\0",
    "1\0.context/a\0UNKNOWN\0message\0",
    "2\0.context/a\0CONFLICT (contents)\0message\0",
    "1\0.context/a\0CONFLICT (contents)\0",
    "1\0.context/a\0CONFLICT (contents)\0message",
  ])("refuses malformed merge information %j", (suffix) => {
    const root = repo();
    git(root, "branch", "feature/proof");
    const output = join(root, ".git", "merge-output");
    writeFileSync(output, `${git(root, "rev-parse", "HEAD^{tree}")}\0\0${suffix}`);
    const result = run(root, [], { MERGE_OUTPUT: output });
    expect(result.status, result.stderr).toBe(0);
    const item = JSON.parse(result.stdout).items.find((row: { name: string }) => row.name === "feature/proof");
    expect(item).toMatchObject({ contained: false, disposition: "ask" });
  });

  it("checks paths in structured conflicts even without unmerged entries", () => {
    const root = repo();
    git(root, "branch", "feature/proof");
    const output = join(root, ".git", "merge-output");
    writeFileSync(output, `${git(root, "rev-parse", "HEAD^{tree}")}\0\0${"1"}\0src/app.ts\0CONFLICT (contents)\0opaque prose\0`);
    const result = run(root, [], { MERGE_OUTPUT: output, MERGE_STATUS: "1" });
    expect(result.status, result.stderr).toBe(0);
    const item = JSON.parse(result.stdout).items.find((row: { name: string }) => row.name === "feature/proof");
    expect(item).toMatchObject({ contained: false, disposition: "ask", conflict_paths: ["src/app.ts"] });
  });
});
