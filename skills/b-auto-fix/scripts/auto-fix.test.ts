import { describe, expect, test, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Helpers ────────────────────────────────────────────
function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "auto-fix-test-"));
}

function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj), "utf-8");
}
// ── shouldSkipByLabel ──────────────────────────────────
describe("shouldSkipByLabel", () => {
  const skipList = ["in-progress", "do-not-auto-fix", "human-only"];

  test("returns true when issue has a skip label", async () => {
    const { shouldSkipByLabel } = await import("./auto-fix.ts");
    expect(shouldSkipByLabel(["bug", "in-progress"], skipList)).toBe(true);
  });

  test("returns false when issue has no skip labels", async () => {
    const { shouldSkipByLabel } = await import("./auto-fix.ts");
    expect(shouldSkipByLabel(["bug", "enhancement"], skipList)).toBe(false);
  });

  test("returns false for empty labels", async () => {
    const { shouldSkipByLabel } = await import("./auto-fix.ts");
    expect(shouldSkipByLabel([], skipList)).toBe(false);
  });

  test("case-sensitive match", async () => {
    const { shouldSkipByLabel } = await import("./auto-fix.ts");
    expect(shouldSkipByLabel(["In-Progress"], skipList)).toBe(false);
  });
});

// ── isHardFail ─────────────────────────────────────────
describe("isHardFail", () => {
  const hardFails = [
    "gh_unreachable",
    "git_push_failed",
    "tests_failed_after_build",
    "review_blocked",
  ];

  test("returns true for hard-fail class", async () => {
    const { isHardFail } = await import("./auto-fix.ts");
    expect(isHardFail("git_push_failed", hardFails)).toBe(true);
  });

  test("returns false for non-hard-fail", async () => {
    const { isHardFail } = await import("./auto-fix.ts");
    expect(isHardFail("lint_warning", hardFails)).toBe(false);
  });

  test("returns false for empty string", async () => {
    const { isHardFail } = await import("./auto-fix.ts");
    expect(isHardFail("", hardFails)).toBe(false);
  });
});

// ── Config loading & merging (integration with filesystem) ──
describe("config loading", () => {
  let dir: string;
  let origCwd: string;

  beforeEach(() => {
    dir = tempDir();
    origCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  test("default config when no config file exists", async () => {
    const { main } = await import("./auto-fix.ts");
    const state = await main(["--", "--repo", "test/example", "--dry-run"]);
    expect(state.config.assignee).toBe("@me");
    expect(state.config.max_issues).toBe(10);
    expect(state.config.dry_run).toBe(true);
    expect(state.config.labels_skip).toEqual([
      "in-progress",
      "do-not-auto-fix",
      "human-only",
    ]);
  });

  test("config file overrides defaults", async () => {
    writeJson("auto-fix.config.json", { max_issues: 5, base: "develop" });
    const { main } = await import("./auto-fix.ts");
    const state = await main(["--", "--repo", "test/example"]);
    expect(state.config.max_issues).toBe(5);
    expect(state.config.base).toBe("develop");
    expect(state.config.assignee).toBe("@me");
  });

  test("CLI flags override config file", async () => {
    writeJson("auto-fix.config.json", {
      max_issues: 5,
      assignee: "someone",
    });
    const { main } = await import("./auto-fix.ts");
    const state = await main([
      "--", "--repo", "test/example", "--max-issues", "3", "--assignee", "me",
    ]);
    expect(state.config.max_issues).toBe(3);
    expect(state.config.assignee).toBe("me");
  });

  test("local config overrides base config but flags win", async () => {
    writeJson("auto-fix.config.json", { max_issues: 5 });
    writeJson("auto-fix.config.local.json", { max_issues: 7 });
    const { main } = await import("./auto-fix.ts");
    const state = await main([
      "--", "--repo", "test/example", "--max-issues", "2",
    ]);
    expect(state.config.max_issues).toBe(2);
  });

  test("dry-run flag via CLI", async () => {
    const { main } = await import("./auto-fix.ts");
    const state = await main(["--", "--repo", "test/example", "--dry-run"]);
    expect(state.config.dry_run).toBe(true);
  });

  test("malformed JSON throws on load", async () => {
    writeFileSync("auto-fix.config.json", "{bad json", "utf-8");
    const { main } = await import("./auto-fix.ts");
    await expect(
      main(["--", "--repo", "test/example"]),
    ).rejects.toThrow("Invalid JSON");
  });
});

// ── Run state ──────────────────────────────────────────
describe("run state", () => {
  let dir: string;
  let origCwd: string;

  beforeEach(() => {
    dir = tempDir();
    origCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  test("creates run state directory with run.json", async () => {
    const { main } = await import("./auto-fix.ts");
    const state = await main(["--", "--repo", "test/example"]);
    const runJson = join(".context", "auto-fix", state.run_id, "run.json");
    expect(existsSync(runJson)).toBe(true);
    const parsed = JSON.parse(readFileSync(runJson, "utf-8"));
    expect(parsed.run_id).toBe(state.run_id);
    expect(parsed.repo).toBe("test/example");
    expect(parsed.config.max_issues).toBe(10);
  });

  test("run IDs are unique", async () => {
    const { main } = await import("./auto-fix.ts");
    const state1 = await main(["--", "--repo", "r1"]);
    const state2 = await main(["--", "--repo", "r2"]);
    expect(state1.run_id).not.toBe(state2.run_id);
  });

  test("run ID is filesystem-safe", async () => {
    const { main } = await import("./auto-fix.ts");
    const state = await main(["--", "--repo", "test/example"]);
    expect(state.run_id).not.toContain(":");
    expect(state.run_id).not.toContain("/");
    expect(state.run_id).not.toContain("\\");
  });
});

// ── CLI help ───────────────────────────────────────────
describe("CLI help", () => {
  test("prints help and exits", async () => {
    const scriptPath = join(import.meta.dirname, "auto-fix.ts");
    const proc = Bun.spawn({
      cmd: ["bun", "run", scriptPath, "--help"],
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    expect(out).toContain("b-auto-fix");
    expect(out).toContain("--repo");
  });
});

// ════════════════════════════════════════════════════════
// gh boundary tests
// ════════════════════════════════════════════════════════

const FAKE_GH = `#!/usr/bin/env bash
set -e
case "$1" in
  issue)
    case "$2" in
      list)
        cat <<'ISSUES'
[
  {"number":1,"title":"Fix login bug","body":"Login fails with 500","state":"open","labels":[{"name":"bug"},{"name":"priority-high"}],"assignees":[{"login":"testuser"}]},
  {"number":2,"title":"Add dark mode","body":"Add dark mode support","state":"open","labels":[{"name":"feature"},{"name":"in-progress"}],"assignees":[{"login":"testuser"}]},
  {"number":3,"title":"Update docs","body":"Update API docs","state":"open","labels":[{"name":"docs"},{"name":"do-not-auto-fix"}],"assignees":[{"login":"testuser"}]},
  {"number":4,"title":"Refactor utils","body":"Clean up shared utils","state":"open","labels":[{"name":"refactor"}],"assignees":[{"login":"testuser"}]}
]
ISSUES
        ;;
      view)
        echo '{"number":1,"title":"Fix login bug","body":"Login fails with 500","state":"open","labels":[{"name":"bug"}],"assignees":[{"login":"testuser"}]}'
        ;;
      edit)
        echo "$@" >> /tmp/gh-calls.log
        ;;
      comment)
        echo "$@" >> /tmp/gh-calls.log
        ;;
      *)
        exit 1
        ;;
    esac
    ;;
  pr)
    case "$2" in
      list)
        if echo "$*" | grep -q "existing-branch"; then
          echo '[{"number":99,"title":"Existing PR","state":"OPEN","headRefName":"auto-fix/issue-1","url":"https://github.com/test/repo/pull/99","isDraft":true}]'
        else
          echo '[]'
        fi
        ;;
      create)
        echo "https://github.com/test/repo/pull/100"
        ;;
      *)
        exit 1
        ;;
    esac
    ;;
  *)
    exit 1
    ;;
esac
`;

function setupFakeGh(): { dir: string; origCwd: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-gh-"));
  const binDir = join(dir, "bin");
  mkdirSync(binDir);
  const ghPath = join(binDir, "gh");
  writeFileSync(ghPath, FAKE_GH, { mode: 0o755 });
  const origCwd = process.cwd();
  process.chdir(dir);
  process.env.AUTO_FIX_GH_BIN = ghPath;
  try {
    rmSync("/tmp/gh-calls.log");
  } catch {
    /* ok */
  }
  return { dir, origCwd };
}

function teardownFakeGh(state: { dir: string; origCwd: string }): void {
  process.chdir(state.origCwd);
  delete process.env.AUTO_FIX_GH_BIN;
  rmSync(state.dir, { recursive: true, force: true });
}

describe("gh wrapper", () => {
  let ghState: ReturnType<typeof setupFakeGh>;

  beforeEach(() => {
    ghState = setupFakeGh();
  });

  afterEach(() => {
    teardownFakeGh(ghState);
  });

  test("listOpenIssues returns typed issues", async () => {
    const { listOpenIssues } = await import("./auto-fix/lib/gh.ts");
    const issues = await listOpenIssues({
      assignee: "testuser",
      repo: "test/repo",
    });
    expect(issues.length).toBe(4);
    expect(issues[0]!.number).toBe(1);
    expect(issues[0]!.title).toBe("Fix login bug");
    expect(issues[0]!.labels[0]!.name).toBe("bug");
  });

  test("getIssue returns a single issue", async () => {
    const { getIssue } = await import("./auto-fix/lib/gh.ts");
    const issue = await getIssue(1, "test/repo");
    expect(issue.number).toBe(1);
    expect(issue.title).toBe("Fix login bug");
  });

  test("findExistingDraftPr returns null when no match", async () => {
    const { findExistingDraftPr } = await import("./auto-fix/lib/gh.ts");
    const pr = await findExistingDraftPr("auto-fix/issue-2", "test/repo");
    expect(pr).toBeNull();
  });

  test("findExistingDraftPr returns PR when branch matches", async () => {
    const { findExistingDraftPr } = await import("./auto-fix/lib/gh.ts");
    const pr = await findExistingDraftPr("existing-branch", "test/repo");
    expect(pr).not.toBeNull();
    expect(pr!.number).toBe(99);
  });

  test("addLabel and removeLabel are no-ops", async () => {
    const { addLabel, removeLabel } = await import("./auto-fix/lib/gh.ts");
    await addLabel(1, "test-label", "test/repo");
    await removeLabel(1, "test-label", "test/repo");
    // should not throw
  });
});

// ── Issue filter logic ─────────────────────────────────
describe("issue filter", () => {
  let ghState: ReturnType<typeof setupFakeGh>;

  beforeEach(() => {
    ghState = setupFakeGh();
  });

  afterEach(() => {
    teardownFakeGh(ghState);
  });

  test("filter excludes issues with skip labels", async () => {
    const { listOpenIssues } = await import("./auto-fix/lib/gh.ts");
    const { shouldSkipByLabel } = await import("./auto-fix.ts");
    const issues = await listOpenIssues({
      assignee: "testuser",
      repo: "test/repo",
    });
    const skipLabels = ["in-progress", "do-not-auto-fix", "human-only"];
    const filtered = issues.filter(
      (i) => !shouldSkipByLabel(i.labels.map((l) => l.name), skipLabels),
    );
    // Issue 2 has "in-progress", issue 3 has "do-not-auto-fix"
    expect(filtered.length).toBe(2);
    expect(filtered[0]!.number).toBe(1);
    expect(filtered[1]!.number).toBe(4);
  });

  test("filter excludes issues with existing draft PRs", async () => {
    const { listOpenIssues, findExistingDraftPr } = await import(
      "./auto-fix/lib/gh.ts"
    );
    const issues = await listOpenIssues({
      assignee: "testuser",
      repo: "test/repo",
    });
    const filtered = [];
    for (const issue of issues) {
      const branch = `auto-fix/issue-${issue.number}`;
      const existing = await findExistingDraftPr(branch, "test/repo");
      if (!existing) filtered.push(issue);
    }
    // No issues have a matching draft PR in the fake gh
    expect(filtered.length).toBe(4);
  });

  test("empty issue list produces empty manifest", async () => {
    // Override with a new fake gh that returns empty
    const dir = mkdtempSync(join(tmpdir(), "empty-gh-"));
    const binDir = join(dir, "bin");
    mkdirSync(binDir);
    writeFileSync(
      join(binDir, "gh"),
      `#!/usr/bin/env bash\n[ "$1" = "issue" ] && echo '[]' || exit 1\n`,
      { mode: 0o755 },
    );
    process.env.AUTO_FIX_GH_BIN = join(binDir, "gh");
    const { listOpenIssues } = await import("./auto-fix/lib/gh.ts");
    const issues = await listOpenIssues({
      assignee: "testuser",
      repo: "empty/repo",
    });
    expect(issues).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

// ════════════════════════════════════════════════════════
// Worktree tests
// ════════════════════════════════════════════════════════
describe("worktree management", () => {
  let dir: string;
  let worktreeDir: string;
  let origCwd: string;
  let baseBranch: string;

  async function gitInit(): Promise<void> {
    const init = Bun.spawn({ cmd: ["git", "init"], cwd: dir, stdout: "pipe", stderr: "pipe" });
    await init.exited;
    writeFileSync(join(dir, "README.md"), "# test", "utf-8");
    const add = Bun.spawn({ cmd: ["git", "add", "."], cwd: dir, stdout: "pipe", stderr: "pipe" });
    await add.exited;
    const commit = Bun.spawn({ cmd: ["git", "commit", "-m", "init"], cwd: dir, stdout: "pipe", stderr: "pipe" });
    await commit.exited;
    // Detect actual branch name
    const branch = Bun.spawn({ cmd: ["git", "branch", "--show-current"], cwd: dir, stdout: "pipe", stderr: "pipe" });
    baseBranch = (await new Response(branch.stdout).text()).trim();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "worktree-test-"));
    worktreeDir = mkdtempSync(join(tmpdir(), "worktrees-"));
    origCwd = process.cwd();
    process.chdir(dir);
    await gitInit();
  });

  afterEach(() => {
    process.chdir(origCwd);
    // Clean up worktrees
    try {
      const proc = Bun.spawn({ cmd: ["git", "worktree", "list", "--porcelain"], cwd: dir, stdout: "pipe", stderr: "pipe" });
      // just try to prune
    } catch { /* ok */ }
    rmSync(dir, { recursive: true, force: true });
    rmSync(worktreeDir, { recursive: true, force: true });
  });

  test("path returns deterministic worktree path", async () => {
    const { path } = await import("./auto-fix/lib/worktree.ts");
    const p = path(5, { repoDir: dir, worktreeDir, branchPrefix: "auto-fix/issue-" });
    expect(p).toBe(`${worktreeDir}/issue-5`);
  });

  test("create produces a valid worktree with correct branch", async () => {
    const { create } = await import("./auto-fix/lib/worktree.ts");
    const p = await create(42, baseBranch, {
      repoDir: dir,
      worktreeDir,
      branchPrefix: "auto-fix/issue-",
    });
    expect(p).toBe(`${worktreeDir}/issue-42`);
    // Verify worktree exists
    expect(existsSync(join(p, "README.md"))).toBe(true);

    // Verify branch exists
    const proc = Bun.spawn({ cmd: ["git", "branch"], cwd: dir, stdout: "pipe", stderr: "pipe" });
    const branches = await new Response(proc.stdout).text();
    expect(branches).toContain("auto-fix/issue-42");
  });

  test("remove deletes worktree and branch", async () => {
    const { create, remove } = await import("./auto-fix/lib/worktree.ts");
    const p = await create(7, baseBranch, {
      repoDir: dir,
      worktreeDir,
      branchPrefix: "auto-fix/issue-",
    });
    expect(existsSync(p)).toBe(true);

    await remove(7, { repoDir: dir, worktreeDir, branchPrefix: "auto-fix/issue-" });

    // Worktree should be gone
    expect(existsSync(p)).toBe(false);

    // Branch should be gone
    const proc = Bun.spawn({ cmd: ["git", "branch"], cwd: dir, stdout: "pipe", stderr: "pipe" });
    const branches = await new Response(proc.stdout).text();
    expect(branches).not.toContain("auto-fix/issue-7");
  });

  test("remove is idempotent — no-op on non-existent worktree", async () => {
    const { remove } = await import("./auto-fix/lib/worktree.ts");
    // Should not throw
    await remove(99, { repoDir: dir, worktreeDir, branchPrefix: "auto-fix/issue-" });
  });

  test("create throws when branch already exists", async () => {
    const { create } = await import("./auto-fix/lib/worktree.ts");
    await create(1, baseBranch, {
      repoDir: dir,
      worktreeDir,
      branchPrefix: "auto-fix/issue-",
    });
    await expect(
      create(1, baseBranch, {
        repoDir: dir,
        worktreeDir,
        branchPrefix: "auto-fix/issue-",
      }),
    ).rejects.toThrow("already exists");
  });

  test("create throws when working tree is dirty", async () => {
    // Make a dirty change
    writeFileSync(join(dir, "README.md"), "# modified", "utf-8");

    const { create } = await import("./auto-fix/lib/worktree.ts");
    await expect(
      create(8, baseBranch, {
        repoDir: dir,
        worktreeDir,
        branchPrefix: "auto-fix/issue-",
      }),
    ).rejects.toThrow("dirty");
  });
});

// ════════════════════════════════════════════════════════
// Pipeline smoke test (Phase 5)
// ════════════════════════════════════════════════════════
describe("pipeline setup", () => {
  test("stages per-issue directories with fake gh", async () => {
    // Setup fake gh in unique dir
    const suffix = Math.random().toString(36).slice(2, 8);
    const binDir = join(tmpdir(), `pipeline-gh-${suffix}`);
    mkdirSync(binDir, { recursive: true });
    const ghPath = join(binDir, "gh");
    writeFileSync(ghPath, FAKE_GH, { mode: 0o755 });
    const origGhBin = process.env.AUTO_FIX_GH_BIN;
    process.env.AUTO_FIX_GH_BIN = ghPath;

    const dir = tempDir();
    const origCwd = process.cwd();
    process.chdir(dir);

    try {
      const { main } = await import("./auto-fix.ts");
      const state = await main([
        "--",
        "--repo",
        "test/repo",
        "--assignee",
        "testuser",
        "--dry-run",
        "--max-issues",
        "10",
      ]);

      // Should have 4 issues fetched from fake gh
      expect(state.issues.length).toBeGreaterThan(0);

      // Check stage directory exists for first issue
      const issueDir = join(".context", "auto-fix", state.run_id, "issue-1");
      expect(existsSync(join(issueDir, "stages.json"))).toBe(true);

      // stages.json should have the right structure
      const stages = JSON.parse(
        readFileSync(join(issueDir, "stages.json"), "utf-8"),
      );
      expect(stages.stages).toEqual(["research", "plan", "build", "review"]);
      expect(stages.issue).toBe(1);

      // Skip-labelled issues should be excluded
      const issueNumbers = state.issues.map(
        (i: { number: number }) => i.number,
      );
      expect(issueNumbers).not.toContain(2); // has "in-progress"
      expect(issueNumbers).not.toContain(3); // has "do-not-auto-fix"
    } finally {
      process.chdir(origCwd);
      process.env.AUTO_FIX_GH_BIN = origGhBin;
      rmSync(dir, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});

// ════════════════════════════════════════════════════════
// PR body golden-file test (Phase 6)
// ════════════════════════════════════════════════════════
describe("pr-body", () => {
  test("generates deterministic PR body matching golden file", async () => {
    const { generatePrBody } = await import("./auto-fix/lib/pr-body.ts");
    const input = {
      issueNumber: 42,
      issueTitle: "Add dark mode toggle to settings",
      branch: "auto-fix/issue-42",
      diffSummary:
        "src/components/Settings.tsx  | 12 ++++++++\nsrc/styles/dark.css           |  8 +++++\n2 files changed, 20 insertions(+)",
      buildArtifact: "Build completed. All tests pass.",
      reviewArtifact:
        "Review: APPROVED — changes match plan, no regressions detected.",
    };
    const body = generatePrBody(input);

    const golden = readFileSync(
      join(import.meta.dir, "auto-fix", "__fixtures__", "pr-body.golden.md"),
      "utf-8",
    );
    expect(body).toBe(golden);
  });

  test("empty diff generates empty PR notice", async () => {
    const { generatePrBody } = await import("./auto-fix/lib/pr-body.ts");
    const body = generatePrBody({
      issueNumber: 1,
      issueTitle: "Nothing",
      branch: "auto-fix/issue-1",
      diffSummary: "",
      buildArtifact: "",
      reviewArtifact: "",
    });
    expect(body).toContain("No changes detected");
  });

  test("missing artifacts produce placeholder text", async () => {
    const { generatePrBody } = await import("./auto-fix/lib/pr-body.ts");
    const body = generatePrBody({
      issueNumber: 5,
      issueTitle: "Test",
      branch: "auto-fix/issue-5",
      diffSummary: "file.ts | 1 +",
      buildArtifact: "",
      reviewArtifact: "",
    });
    expect(body).toContain("_No build artifact provided._");
    expect(body).toContain("_No review artifact provided._");
  });
});

// ════════════════════════════════════════════════════════
// List mode (--list / --list-only)
// ════════════════════════════════════════════════════════
describe("formatIssueList", () => {
  test("human format shows to-process count, issue lines, and skipped count", async () => {
    const { formatIssueList } = await import("./auto-fix.ts");
    const out = formatIssueList(
      {
        to_process: [
          {
            number: 1,
            title: "Fix login bug",
            body: "Login fails with 500",
            state: "open",
            labels: [{ name: "bug" }, { name: "priority-high" }],
            assignees: [],
          },
        ],
        skipped: [
          {
            issue: {
              number: 2,
              title: "Add dark mode",
              body: "",
              state: "open",
              labels: [{ name: "in-progress" }],
              assignees: [],
            },
            reason: "label:in-progress",
          },
        ],
      },
      "human",
    );
    expect(out).toContain("1 issue(s) that would be auto-fixed");
    expect(out).toContain("#1  Fix login bug");
    expect(out).toContain("Labels: bug, priority-high");
    expect(out).toContain("Body: Login fails with 500");
    expect(out).toContain("Skipped 1 issue(s)");
    expect(out).toContain("#2  Add dark mode  (label:in-progress)");
  });

  test("human format with no to-process shows fallback message", async () => {
    const { formatIssueList } = await import("./auto-fix.ts");
    const out = formatIssueList(
      { to_process: [], skipped: [] },
      "human",
    );
    expect(out).toContain("No issues to process.");
  });

  test("json format emits structured object with arrays", async () => {
    const { formatIssueList } = await import("./auto-fix.ts");
    const out = formatIssueList(
      {
        to_process: [
          {
            number: 7,
            title: "Refactor X",
            body: "body line 1\nbody line 2",
            state: "open",
            labels: [{ name: "refactor" }],
            assignees: [],
          },
        ],
        skipped: [
          {
            issue: {
              number: 8,
              title: "Do not auto-fix",
              body: "",
              state: "open",
              labels: [{ name: "do-not-auto-fix" }],
              assignees: [],
            },
            reason: "label:do-not-auto-fix",
          },
        ],
      },
      "json",
    );
    const parsed = JSON.parse(out);
    expect(parsed.to_process).toHaveLength(1);
    expect(parsed.to_process[0].number).toBe(7);
    expect(parsed.to_process[0].labels).toEqual(["refactor"]);
    expect(parsed.skipped).toHaveLength(1);
    expect(parsed.skipped[0].reason).toBe("label:do-not-auto-fix");
  });

  test("issue with multi-line body shows only first line in human format", async () => {
    const { formatIssueList } = await import("./auto-fix.ts");
    const out = formatIssueList(
      {
        to_process: [
          {
            number: 9,
            title: "Multi-line",
            body: "first line\nsecond line\nthird line",
            state: "open",
            labels: [],
            assignees: [],
          },
        ],
        skipped: [],
      },
      "human",
    );
    expect(out).toContain("Body: first line");
    expect(out).not.toContain("second line");
  });
});

describe("filterIssuesForList", () => {
  let ghState: ReturnType<typeof setupFakeGh>;

  beforeEach(() => {
    ghState = setupFakeGh();
  });

  afterEach(() => {
    teardownFakeGh(ghState);
  });

  test("excludes issues with skip labels and reports reason", async () => {
    const { filterIssuesForList } = await import("./auto-fix.ts");
    const result = await filterIssuesForList({
      assignee: "testuser",
      repo: "test/repo",
      limit: 10,
      labels_skip: ["in-progress", "do-not-auto-fix", "human-only"],
      branch_prefix: "auto-fix/issue-",
    });
    const numbers = result.to_process.map((i) => i.number);
    expect(numbers).toEqual([1, 4]);
    const skippedNumbers = result.skipped.map((s) => s.issue.number);
    expect(skippedNumbers).toEqual([2, 3]);
    expect(result.skipped[0]!.reason).toBe("label:in-progress");
    expect(result.skipped[1]!.reason).toBe("label:do-not-auto-fix");
  });

  test("excludes issues with existing draft PRs and reports reason", async () => {
    const { filterIssuesForList } = await import("./auto-fix.ts");
    // Issue 1 has an existing draft PR (fake gh returns one when branch="existing-branch")
    // Override branch prefix to target the existing branch
    const result = await filterIssuesForList({
      assignee: "testuser",
      repo: "test/repo",
      limit: 10,
      labels_skip: [],
      branch_prefix: "existing-branch", // makes the pr list check return the existing PR
    });
    // All 4 issues are scanned; all will report existing-draft-pr reason
    expect(result.to_process).toEqual([]);
    for (const s of result.skipped) {
      expect(s.reason).toMatch(/^existing-draft-pr:#\d+$/);
    }
  });
});

describe("CLI --list", () => {
  test("prints human list and exits 0 without writing run state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "list-cli-"));
    const binDir = join(dir, "bin");
    mkdirSync(binDir);
    const ghPath = join(binDir, "gh");
    writeFileSync(ghPath, FAKE_GH, { mode: 0o755 });

    const cwd = mkdtempSync(join(tmpdir(), "list-cwd-"));
    const origCwd = process.cwd();
    process.chdir(cwd);
    process.env.AUTO_FIX_GH_BIN = ghPath;

    try {
      const scriptPath = join(import.meta.dirname, "auto-fix.ts");
      const proc = Bun.spawn({
        cmd: ["bun", "run", scriptPath, "--", "--repo", "test/repo", "--list", "--yes"],
        cwd,
        env: { ...process.env, AUTO_FIX_GH_BIN: ghPath },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, err, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(out).toContain("issue(s) that would be auto-fixed");
      expect(out).toContain("#1");
      expect(out).toContain("#4");
      // #2 should appear in Skipped section but NOT in to-process list
      // to-process list ends at the blank line before "Skipped"
      const toProcessBlock = out.split("\n\nSkipped")[0] ?? "";
      expect(toProcessBlock).not.toContain("#2");
      expect(toProcessBlock).not.toContain("#3");
      expect(out).toContain("#2  Add dark mode"); // in skipped section
      // No run state directory should be created in --list mode
      expect(existsSync(join(cwd, ".context"))).toBe(false);
    } finally {
      process.chdir(origCwd);
      delete process.env.AUTO_FIX_GH_BIN;
      rmSync(dir, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("--list-only is an alias for --list", async () => {
    const dir = mkdtempSync(join(tmpdir(), "list-only-"));
    const binDir = join(dir, "bin");
    mkdirSync(binDir);
    const ghPath = join(binDir, "gh");
    writeFileSync(ghPath, FAKE_GH, { mode: 0o755 });

    const cwd = mkdtempSync(join(tmpdir(), "list-only-cwd-"));
    const origCwd = process.cwd();
    process.chdir(cwd);
    process.env.AUTO_FIX_GH_BIN = ghPath;

    try {
      const scriptPath = join(import.meta.dirname, "auto-fix.ts");
      const proc = Bun.spawn({
        cmd: ["bun", "run", scriptPath, "--", "--repo", "test/repo", "--list-only", "--yes"],
        cwd,
        env: { ...process.env, AUTO_FIX_GH_BIN: ghPath },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(out).toContain("issue(s) that would be auto-fixed");
    } finally {
      process.chdir(origCwd);
      delete process.env.AUTO_FIX_GH_BIN;
      rmSync(dir, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("--list --format json outputs valid JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "list-json-"));
    const binDir = join(dir, "bin");
    mkdirSync(binDir);
    const ghPath = join(binDir, "gh");
    writeFileSync(ghPath, FAKE_GH, { mode: 0o755 });

    const cwd = mkdtempSync(join(tmpdir(), "list-json-cwd-"));
    const origCwd = process.cwd();
    process.chdir(cwd);
    process.env.AUTO_FIX_GH_BIN = ghPath;

    try {
      const scriptPath = join(import.meta.dirname, "auto-fix.ts");
      const proc = Bun.spawn({
        cmd: [
          "bun",
          "run",
          scriptPath,
          "--",
          "--repo",
          "test/repo",
          "--list",
          "--format",
          "json",
          "--yes",
        ],
        cwd,
        env: { ...process.env, AUTO_FIX_GH_BIN: ghPath },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(out);
      expect(parsed.to_process).toBeInstanceOf(Array);
      expect(parsed.skipped).toBeInstanceOf(Array);
    } finally {
      process.chdir(origCwd);
      delete process.env.AUTO_FIX_GH_BIN;
      rmSync(dir, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("--list does not trigger the first-run safety prompt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "list-no-prompt-"));
    const binDir = join(dir, "bin");
    mkdirSync(binDir);
    const ghPath = join(binDir, "gh");
    writeFileSync(ghPath, FAKE_GH, { mode: 0o755 });

    // Fresh cwd so no prior runs exist — this is when the safety prompt would fire
    const cwd = mkdtempSync(join(tmpdir(), "list-no-prompt-cwd-"));
    const origCwd = process.cwd();
    process.chdir(cwd);
    process.env.AUTO_FIX_GH_BIN = ghPath;

    try {
      const scriptPath = join(import.meta.dirname, "auto-fix.ts");
      const proc = Bun.spawn({
        cmd: ["bun", "run", scriptPath, "--", "--repo", "test/repo", "--list"],
        cwd,
        env: { ...process.env, AUTO_FIX_GH_BIN: ghPath },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(out).not.toContain("First run on this repo");
      expect(out).toContain("issue(s) that would be auto-fixed");
    } finally {
      process.chdir(origCwd);
      delete process.env.AUTO_FIX_GH_BIN;
      rmSync(dir, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("invalid --format value throws", async () => {
    const { parseFlags } = await import("./auto-fix.ts");
    // Re-importing won't work since parseFlags isn't exported; call main() with invalid format
    const cwd = mkdtempSync(join(tmpdir(), "list-bad-format-"));
    const origCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { main } = await import("./auto-fix.ts");
      await expect(
        main(["--", "--repo", "test/repo", "--list", "--format", "yaml"]),
      ).rejects.toThrow("Invalid --format value");
    } finally {
      process.chdir(origCwd);
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
