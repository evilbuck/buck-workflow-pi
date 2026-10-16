import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withConfiguredStore } from "../../_shared/scripts/workflow-state.js";

const script = join(import.meta.dirname, "auto-fix.ts");
let root: string;
let cwd: string;
let config: string;
let previous: Record<string, string | undefined>;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "auto-fix-retained-"));
  cwd = join(root, "checkout");
  mkdirSync(cwd);
  config = join(root, "storage.yaml");
  previous = { BUCK_WORKFLOW_CONFIG: process.env.BUCK_WORKFLOW_CONFIG, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AUTO_FIX_GH_BIN: process.env.AUTO_FIX_GH_BIN };
  process.env.BUCK_WORKFLOW_CONFIG = config;
  process.env.XDG_CONFIG_HOME = join(root, "identity");
  const gh = join(root, "gh");
  writeFileSync(gh, `#!/bin/sh
if [ "$1 $2" = "issue list" ]; then
  printf '%s\\n' '[{"number":7,"title":"Retain evidence","body":"private issue bytes","state":"open","labels":[],"assignees":[]}]'
else
  printf '%s\\n' '[]'
fi
`, { mode: 0o755 });
  process.env.AUTO_FIX_GH_BIN = gh;
  execFileSync("git", ["init", "-b", "main", cwd], { stdio: "pipe" });
  execFileSync("git", ["-C", cwd, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--allow-empty", "-m", "initial"], { stdio: "pipe" });
  writeFileSync(join(cwd, "change.txt"), "consumer change\n");
  execFileSync("git", ["-C", cwd, "add", "change.txt"]);
});
afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
});

function configure(adapter: string): void {
  const options = adapter === "sqlite" ? `  database: ${join(root, "retained.sqlite")}\n`
    : adapter === "external-files" ? `  root: ${join(root, "external")}\n` : "";
  writeFileSync(config, `version: 1\nstorage:\n  adapter: ${adapter}\n${options}`);
}
function cli(args: string[], from = cwd) {
  return spawnSync("bun", [script, ...args], { cwd: from, env: process.env, encoding: "utf8" });
}
function checked(args: string[], from = cwd): string {
  const result = cli(args, from);
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}
function setupRun(): string {
  const out = checked(["--repo", "fixture/repo", "--dry-run", "--yes"]);
  const match = /Run state: .*\/([^/]+)\/run\.json/u.exec(out);
  if (!match?.[1]) throw new Error(`Missing run ID: ${out}`);
  return match[1];
}
function completion(runId: string): string {
  const input = {
    runDir: join(cwd, ".context", "auto-fix", runId), issueN: 7, repo: "fixture/repo",
    branch: "auto-fix/issue-7", baseBranch: "HEAD", worktreeDir: root, branchPrefix: "auto-fix/issue-", dryRun: true,
  };
  return `import {successPath, hardFailPath, softFailPath} from ${JSON.stringify(script)};
const input = ${JSON.stringify(input)};
await successPath(input); await hardFailPath(input, "review_blocked"); await softFailPath(input, "exact failure bytes Ω");`;
}

for (const adapter of ["repo-files", "external-files", "sqlite"]) {
  describe(`auto-fix retained evidence (${adapter})`, () => {
    it("recovers run, stages and completion/failure bytes after restart without trusting exports", async () => {
      configure(adapter);
      const runId = setupRun();
      const originalRun = checked(["artifact", "read", runId, "run.json"]);
      expect(JSON.parse(originalRun)).toMatchObject({ repo: "fixture/repo", issues: [{ number: 7 }], results: [{ issue: 7, status: "completed" }] });
      const stage = checked(["artifact", "read", runId, "issue-7/stages.json"]);
      expect(JSON.parse(stage)).toMatchObject({ issue: 7, stages: ["research", "plan", "build", "review"] });
      const routing = checked(["artifact", "read", runId, "issue-7/completion-plan.json"]);
      expect(JSON.parse(routing).branch).toBe("auto-fix/issue-7");
      const build = "# Build\ncompiled exact Ω\n";
      const review = "# Review\napproved exact evidence\n";
      const source = join(root, "stage.md");
      for (const [name, body] of [["build.md", build], ["review.md", review]]) {
        writeFileSync(source, body);
        checked(["artifact", "write", runId, `issue-7/${name}`, source, "--cwd", cwd], root);
      }
      const issueDir = join(cwd, ".context", "auto-fix", runId, "issue-7");
      writeFileSync(join(issueDir, "review.md"), "FORGED local review");
      rmSync(join(cwd, ".context", "auto-fix"), { recursive: true });
      const result = spawnSync("bun", ["--eval", completion(runId)], { cwd: root, env: process.env, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      const prBody = checked(["artifact", "read", runId, "issue-7/pr-body.md"]);
      expect(prBody).toContain(build);
      expect(prBody).toContain(review);
      expect(prBody).not.toContain("FORGED");
      const failure = checked(["artifact", "read", runId, "issue-7/soft-fail.log"]);
      expect(failure).toMatch(/^Soft-fail at [^\n]+: exact failure bytes Ω\n$/u);
      const hard = checked(["artifact", "read", runId, "issue-7/summary.md"]);
      expect(hard).toContain("## Hard-fail: review_blocked");
      rmSync(join(cwd, ".context", "auto-fix"), { recursive: true });
      checked(["artifact", "restore", runId]);
      const runDir = join(cwd, ".context", "auto-fix", runId);
      for (const [name, body] of [["run.json", originalRun], ["issue-7/stages.json", stage], ["issue-7/completion-plan.json", routing], ["issue-7/pr-body.md", prBody], ["issue-7/soft-fail.log", failure], ["issue-7/summary.md", hard]]) {
        expect(readFileSync(join(runDir, name), "utf8")).toBe(body);
      }
      await withConfiguredStore(cwd, async (store, context) => {
        const records = await store.list({ ...context, publishedRevisionIds: [], subjectId: "auto-fix" });
        expect(records.map((record) => record.key.logicalName).sort()).toEqual([
          "run.json", "issue-7/stages.json", "issue-7/completion-plan.json", "issue-7/build.md", "issue-7/review.md", "issue-7/pr-body.md", "issue-7/summary.md", "issue-7/soft-fail.log",
        ].map((name) => `${runId}/${name}`).sort());
        for (const record of records) {
          expect(record.key.worktreeId).toBe(context.worktreeId);
          expect(record.key.runId).toBe(context.runId);
        }
        expect(await store.list({ ...context, publishedRevisionIds: [], subjectId: "auto-fix", worktreeId: "other-worktree", runId: "other-run" })).toEqual([]);
      });
    }, 20000);

    it("refuses missing canonical inputs and adapter outages despite plausible local copies", () => {
      configure(adapter);
      const runId = setupRun();
      const issueDir = join(cwd, ".context", "auto-fix", runId, "issue-7");
      writeFileSync(join(issueDir, "build.md"), "unretained build");
      writeFileSync(join(issueDir, "review.md"), "unretained approval");
      const missing = spawnSync("bun", ["--eval", completion(runId)], { cwd, env: process.env, encoding: "utf8" });
      expect(missing.status).not.toBe(0);
      expect(missing.stderr).toContain("Retained build.md and review.md are required");
      expect(existsSync(join(issueDir, "pr-body.md"))).toBe(false);
      writeFileSync(config, "not: [valid");
      const outage = cli(["artifact", "read", runId, "run.json"]);
      expect(outage.status).not.toBe(0);
      expect(outage.stdout).toBe("");
      const restore = cli(["artifact", "restore", runId]);
      expect(restore.status).not.toBe(0);
      expect(readFileSync(join(issueDir, "review.md"), "utf8")).toBe("unretained approval");
    });

    it("uses retained prior runs for the first-run safety decision after exports are removed", () => {
      configure(adapter);
      setupRun();
      rmSync(join(cwd, ".context", "auto-fix"), { recursive: true });
      const out = checked(["--repo", "fixture/repo"]);
      expect(out).not.toContain("First run on this repo");
      const runId = /Run state: .*\/([^/]+)\/run\.json/u.exec(out)?.[1];
      if (!runId) throw new Error(`Missing restart run: ${out}`);
      const state = JSON.parse(checked(["artifact", "read", runId, "run.json"]));
      expect(state.config.dry_run).toBe(false);
    });
  });
}

it("cannot use a real sibling worktree to read the owning checkout's run", () => {
  configure("sqlite");
  const runId = setupRun();
  const sibling = join(root, "sibling");
  execFileSync("git", ["-C", cwd, "worktree", "add", "-b", "other", sibling], { stdio: "pipe" });
  const denied = cli(["artifact", "read", runId, "run.json"], sibling);
  expect(denied.status).not.toBe(0);
  expect(denied.stderr).toContain("Retained auto-fix run not found");
  expect(checked(["artifact", "read", runId, "run.json", "--cwd", cwd], sibling)).toContain('"repo": "fixture/repo"');
});
