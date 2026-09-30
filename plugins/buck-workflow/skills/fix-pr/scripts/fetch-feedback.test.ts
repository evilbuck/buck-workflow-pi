import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = join(import.meta.dirname, "fetch-feedback.ts");
const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const FAKE_GH = `#!/usr/bin/env node
const { readFileSync, appendFileSync } = require("node:fs");
const fixture = JSON.parse(readFileSync(process.env.FIXPR_FIXTURE, "utf8"));
const args = process.argv.slice(2);
if (process.env.FIXPR_LOG) appendFileSync(process.env.FIXPR_LOG, JSON.stringify(args) + "\\n");

function emit(code, body) {
  if (body !== undefined && body !== "") {
    process.stdout.write(typeof body === "string" ? body : JSON.stringify(body));
  }
  process.exit(code);
}

function flagValue(prefix) {
  const flag = args.find((arg, index) => args[index - 1] === "-f" && arg.startsWith(prefix));
  return flag ? flag.slice(prefix.length) : "";
}

if (args[0] === "pr" && args[1] === "view") {
  emit(fixture.viewExit ?? 0, fixture.viewExit ? "" : fixture.view);
}
if (args[0] === "pr" && args[1] === "checks") {
  process.stdout.write(JSON.stringify(fixture.checks ?? []));
  process.exit(fixture.checksExit ?? 0);
}
if (args[0] === "api" && args[1] === "--paginate") {
  const endpoint = args[2] || "";
  let pages = [];
  if (endpoint.endsWith("/reviews")) pages = fixture.reviews;
  else if (endpoint.includes("/pulls/") && endpoint.endsWith("/comments")) pages = fixture.comments;
  else if (endpoint.includes("/issues/")) pages = fixture.issueComments;
  else {
    process.stderr.write("unhandled paginate " + endpoint + "\\n");
    process.exit(99);
  }
  process.stdout.write(pages.map((page) => JSON.stringify(page)).join("\\n"));
  process.exit(0);
}
if (args[0] === "api" && args[1] === "graphql") {
  const query = flagValue("query=");
  const after = flagValue("after=");
  const pages = query.includes("node(id:") ? fixture.commentPages[flagValue("id=")] : fixture.threads;
  const page = (pages || []).find((entry) => (entry.after || "") === after);
  if (!page) {
    process.stderr.write("no graphql fixture for after=" + after + "\\n");
    process.exit(99);
  }
  emit(page.exit ?? 0, page.body);
}
if (args[0] === "api" && args.some((arg) => arg.includes("/check-runs/"))) {
  const endpoint = args.find((arg) => arg.includes("/check-runs/"));
  const jobId = endpoint.split("/check-runs/")[1].split("/")[0];
  const ann = (fixture.annotations || {})[jobId] || { exit: 0, body: [] };
  if (ann.exit) process.exit(ann.exit);
  process.stdout.write(JSON.stringify(ann.body));
  process.exit(0);
}
if (args[0] === "run" && args[1] === "view") {
  const jobId = args[args.indexOf("--job") + 1];
  const log = (fixture.logs || {})[jobId] || { exit: 0, body: "" };
  if (log.body) process.stdout.write(log.body);
  process.exit(log.exit ?? 0);
}
process.stderr.write("unhandled gh args " + args.join(" ") + "\\n");
process.exit(99);
`;

function view(number = 7) {
  return {
    number,
    title: "Fix widget",
    state: "OPEN",
    url: `https://github.com/acme/widgets/pull/${number}`,
    headRefName: "feat/widget",
    headRefOid: "a".repeat(40),
    headRepository: { nameWithOwner: "acme/widgets" },
    headRepositoryOwner: { login: "acme" },
    isCrossRepository: false,
    baseRefName: "master",
    baseRefOid: "b".repeat(40),
  };
}

function emptyLists() {
  return {
    reviews: [[]],
    comments: [[]],
    issueComments: [[]],
    checks: [],
    checksExit: 0,
    threads: [{ after: "", body: threadPage(false, null, []) }],
    commentPages: {},
  };
}

function threadPage(hasNextPage: boolean, endCursor: string | null, nodes: unknown[]) {
  return {
    data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage, endCursor },
            nodes,
          },
        },
      },
    },
  };
}

function threadNode(id: string, isResolved: boolean, path: string, line: number, comments: unknown) {
  return { id, isResolved, path, line, comments };
}

function commentPage(hasNextPage: boolean, endCursor: string | null, nodes: unknown[]) {
  return { pageInfo: { hasNextPage, endCursor }, nodes };
}

function run(fixture: unknown, args: string[] = ["acme/widgets", "7"], pathPrefix?: string, outputTmpDir?: string) {
  const dir = mkdtempSync(join(tmpdir(), "fix-pr-fetch-"));
  temps.push(dir);
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const gh = join(bin, "gh");
  writeFileSync(gh, FAKE_GH);
  chmodSync(gh, 0o755);
  const fixturePath = join(dir, "fixture.json");
  writeFileSync(fixturePath, JSON.stringify(fixture));
  const logPath = join(dir, "gh.log");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    TMPDIR: outputTmpDir ?? dir,
    FIXPR_FIXTURE: fixturePath,
    FIXPR_LOG: logPath,
  };
  if (pathPrefix === "no-gh") {
    env.PATH = (process.env.PATH ?? "")
      .split(":")
      .filter((dirName) => dirName.length > 0 && !existsSync(join(dirName, "gh")))
      .join(":");
  }
  const result = spawnSync("bun", [SCRIPT, ...args], { encoding: "utf8", env });
  return { dir, result, logPath };
}

function summaryOf(result: ReturnType<typeof spawnSync>) {
  expect(result.status).toBe(0);
  const stdout = String(result.stdout ?? "");
  const lines = stdout.split("\n").filter((line) => line.length > 0);
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]!) as {
    ok: boolean;
    inventoryPath: string;
    number: number;
    counts: Record<string, number>;
    candidates: Array<{ id: string; source: string; claim: string; seen: boolean }>;
  };
}

describe("fetch-feedback.ts", () => {
  it("merges reviews, comments, and a two-page thread walk without truncating bodies", () => {
    const longBody = `${"X".repeat(250)}\nmore detail`;
    const fixture = {
      view: view(),
      reviews: [
        [{ id: 10, html_url: "https://example.test/review/10", user: { login: "alice" }, body: "Commit: abcdef1\nplease fix", submitted_at: "2026-01-02T00:00:00Z", commit_id: null }],
        [{ id: 11, html_url: "https://example.test/review/11", user: { login: "bob" }, body: "later review", submitted_at: "2026-01-05T00:00:00Z", commit_id: "bbbbbbbb" }],
      ],
      comments: [[{
        id: 20,
        html_url: "https://example.test/inline/20",
        commit_id: "cccccccc",
        path: "src/a.ts",
        line: 12,
        user: { login: "carol" },
        body: longBody,
        created_at: "2026-01-03T00:00:00Z",
      }]],
      issueComments: [[{
        id: 30,
        html_url: "https://example.test/issue/30",
        user: { login: "dave" },
        body: "please also check docs",
        created_at: "2026-01-01T00:00:00Z",
      }]],
      checks: [],
      checksExit: 0,
      threads: [
        {
          after: "",
          body: threadPage(true, "t1", [
            threadNode("THR_A", false, "src/a.ts", 12, commentPage(true, "c1", [{
              databaseId: 20,
              url: "https://example.test/inline/20",
              body: "first",
              author: { login: "carol" },
              createdAt: "2026-01-03T00:00:00Z",
              commit: { oid: "cccccccc" },
            }])),
          ]),
        },
        {
          after: "t1",
          body: threadPage(false, null, [
            threadNode("THR_B", false, "src/b.ts", 4, commentPage(false, null, [{
              databaseId: 99,
              url: "https://example.test/thread/b",
              body: "unjoined thread body",
              author: { login: "erin" },
              createdAt: "2026-01-04T00:00:00Z",
              commit: { oid: "dddddddd" },
            }])),
          ]),
        },
      ],
      commentPages: {
        THR_A: [{
          after: "c1",
          body: {
            data: {
              node: {
                comments: commentPage(false, null, [{
                  databaseId: 21,
                  url: "https://example.test/inline/21",
                  body: "second page comment",
                  author: { login: "carol" },
                  createdAt: "2026-01-03T01:00:00Z",
                  commit: { oid: "cccccccc" },
                }]),
              },
            },
          },
        }],
      },
    };
    const { result, logPath } = run(fixture);
    const summary = summaryOf(result);
    expect(summary.number).toBe(7);
    expect(summary.ok).toBe(true);
    expect(result.stderr).toContain("fix-pr");
    expect(result.stderr).toContain("fetching reviews");
    expect(result.stderr).toContain("done —");
    const inventory = JSON.parse(readFileSync(summary.inventoryPath, "utf8"));
    expect(statSync(summary.inventoryPath).mode & 0o777).toBe(0o600);
    expect(inventory.items.map((item: { id: string }) => item.id)).toEqual(["30", "10", "20", "THR_B", "11"]);
    const inline = inventory.items.find((item: { id: string }) => item.id === "20");
    expect(inline.claim.length).toBeGreaterThan(200);
    expect(inline.claim).toBe(`${"X".repeat(250)} more detail`);
    expect(inline.url).toBe("https://example.test/inline/20");
    expect(inline.threadId).toBe("THR_A");
    expect(inventory.items.find((item: { id: string }) => item.id === "10").commit).toBe("abcdef1");
    expect(inventory.items.every((item: { id: string; url: string }) => item.id && item.url)).toBe(true);
    const log = readFileSync(logPath, "utf8");
    expect(log).toContain("after=c1");
    expect(log).toContain("after=t1");
  });

  it("marks a path-and-line joined resolved thread and omits it from candidates", () => {
    const fixture = {
      ...emptyLists(),
      view: view(),
      comments: [[{
        id: 41,
        html_url: "https://example.test/inline/41",
        commit_id: "eeeeeeee",
        path: "src/c.ts",
        line: 3,
        user: { login: "carol" },
        body: "this thread is resolved",
        created_at: "2026-01-02T00:00:00Z",
      }]],
      threads: [{
        after: "",
        body: threadPage(false, null, [
          threadNode("THR_R", true, "src/c.ts", 3, commentPage(false, null, [{
            url: "https://example.test/inline/41",
            body: "this thread is resolved",
            author: { login: "carol" },
            createdAt: "2026-01-02T00:00:00Z",
            commit: { oid: "eeeeeeee" },
          }])),
        ]),
      }],
    };
    const { result } = run(fixture);
    const summary = summaryOf(result);
    const inventory = JSON.parse(readFileSync(summary.inventoryPath, "utf8"));
    const item = inventory.items.find((row: { id: string }) => row.id === "41");
    expect(item.mechanical).toBe("resolved_thread");
    expect(item.threadResolved).toBe(true);
    expect(summary.candidates.map((candidate) => candidate.id)).not.toContain("41");
  });

  it("marks the later row with the same id as duplicate_id", () => {
    const fixture = {
      ...emptyLists(),
      view: view(),
      issueComments: [[
        { id: 42, html_url: "https://example.test/c/1", user: { login: "a" }, body: "first", created_at: "2026-01-01T00:00:00Z" },
        { id: 42, html_url: "https://example.test/c/2", user: { login: "b" }, body: "second", created_at: "2026-01-02T00:00:00Z" },
      ]],
    };
    const { result } = run(fixture);
    const summary = summaryOf(result);
    const inventory = JSON.parse(readFileSync(summary.inventoryPath, "utf8"));
    expect(inventory.items[1].mechanical).toBe("duplicate_id");
    expect(inventory.items[1].duplicateOf).toBe("42");
    expect(inventory.items[0].duplicateOf).toBeUndefined();
    expect(summary.counts.duplicate_id).toBe(1);
  });

  it("exits 5 with empty stdout when hasNextPage is null", () => {
    const fixture = {
      ...emptyLists(),
      view: view(),
      threads: [{
        after: "",
        body: threadPage(null as unknown as boolean, null, []),
      }],
    };
    const { result } = run(fixture);
    expect(result.status).toBe(5);
    expect(result.stdout).toBe("");
  });

  it("exits 4 with empty stdout when pr view fails", () => {
    const { result } = run({ ...emptyLists(), view: view(), viewExit: 1 });
    expect(result.status).toBe(4);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: pr metadata incomplete");
  });

  it("exits 3 when gh is missing from PATH", () => {
    const { result } = run({ ...emptyLists(), view: view() }, ["acme/widgets", "7"], "no-gh");
    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: gh not found");
  });

  it("omits a seen id from candidates", () => {
    const dir = mkdtempSync(join(tmpdir(), "fix-pr-seen-"));
    temps.push(dir);
    const seenPath = join(dir, "seen");
    writeFileSync(seenPath, "30\n\n");
    const fixture = {
      ...emptyLists(),
      view: view(),
      issueComments: [[
        { id: 30, html_url: "https://example.test/c/30", user: { login: "a" }, body: "seen claim", created_at: "2026-01-01T00:00:00Z" },
        { id: 31, html_url: "https://example.test/c/31", user: { login: "b" }, body: "new claim", created_at: "2026-01-02T00:00:00Z" },
      ]],
    };
    const { result } = run(fixture, ["acme/widgets", "7", "--seen-ids-file", seenPath]);
    const summary = summaryOf(result);
    const inventory = JSON.parse(readFileSync(summary.inventoryPath, "utf8"));
    expect(inventory.items.find((item: { id: string }) => item.id === "30").seen).toBe(true);
    expect(summary.candidates.map((candidate) => candidate.id)).toEqual(["31"]);
  });

  it("turns a failing Actions log into a ci candidate and drops the process-completed line", () => {
    const failLine = "unit\tRun tests\t2026-01-01T00:00:00.123Z \u001b[31mFAIL \u001b[0m src/a.test.ts";
    const pointer = "unit\tRun tests\t2026-01-01T00:00:01Z ❯ src/a.test.ts:12";
    const dropped = "unit\tRun tests\t2026-01-01T00:00:02Z ##[error]Process completed with exit code 1.";
    const fixture = {
      ...emptyLists(),
      view: view(),
      checksExit: 1,
      checks: [{
        name: "unit",
        state: "fail",
        bucket: "fail",
        link: "https://github.com/acme/widgets/actions/runs/99/job/55",
        workflow: "ci",
        completedAt: "2026-01-06T00:00:00Z",
        description: "tests failed",
      }],
      annotations: { "55": { exit: 0, body: [] } },
      logs: { "55": { exit: 0, body: `${failLine}\n${pointer}\n${dropped}\n` } },
    };
    const { result } = run(fixture);
    const summary = summaryOf(result);
    const inventory = JSON.parse(readFileSync(summary.inventoryPath, "utf8"));
    const item = inventory.items.find((row: { source: string }) => row.source === "ci");
    expect(item.id).toBe("job:55");
    expect(item.logStatus).toBe("parsed");
    expect(item.signals).toContain("FAIL  src/a.test.ts");
    expect(item.signals).toContain("❯ src/a.test.ts:12");
    expect(item.signals).not.toContain("##[error]Process completed with exit code 1.");
    expect(summary.candidates.map((candidate) => candidate.id)).toContain("job:55");
  });

  it("keeps pending checks out of items and accepts checks exit 1 and 8", () => {
    const pending = {
      ...emptyLists(),
      view: view(),
      checksExit: 8,
      checks: [{ name: "lint", state: "pending", bucket: "pending", link: "https://example.test/lint", workflow: "ci", completedAt: null, description: null }],
    };
    const pendingRun = run(pending);
    expect(pendingRun.result.status).toBe(0);
    const pendingSummary = summaryOf(pendingRun.result);
    const pendingInventory = JSON.parse(readFileSync(pendingSummary.inventoryPath, "utf8"));
    expect(pendingInventory.checks.pending).toEqual([{ name: "lint", state: "pending", link: "https://example.test/lint" }]);
    expect(pendingInventory.items.filter((item: { source: string }) => item.source === "ci")).toEqual([]);
    expect(pendingSummary.counts.pending_checks).toBe(1);

    const failed = {
      ...emptyLists(),
      view: view(),
      checksExit: 1,
      checks: [{
        name: "CodeRabbit",
        state: "fail",
        bucket: "fail",
        link: "https://coderabbit.ai/check",
        workflow: "",
        completedAt: "2026-01-06T00:00:00Z",
        description: null,
      }],
    };
    const failedRun = run(failed);
    expect(failedRun.result.status).toBe(0);
    const failedInventory = JSON.parse(readFileSync(summaryOf(failedRun.result).inventoryPath, "utf8"));
    expect(failedInventory.items[0].source).toBe("ci");
    expect(failedInventory.items[0].logStatus).toBe("no_job_id");
    expect(failedInventory.items[0].claim).toBe("CodeRabbit: fail: ");
  });

  it("emits a ci item when the failed log command exits non-zero", () => {
    const fixture = {
      ...emptyLists(),
      view: view(),
      checksExit: 1,
      checks: [{
        name: "unit",
        state: "fail",
        bucket: "fail",
        link: "https://github.com/acme/widgets/actions/runs/99/job/77",
        workflow: "ci",
        completedAt: "2026-01-06T00:00:00Z",
        description: "boom",
      }],
      annotations: { "77": { exit: 0, body: [] } },
      logs: { "77": { exit: 1, body: "" } },
    };
    const { result } = run(fixture);
    const summary = summaryOf(result);
    const inventory = JSON.parse(readFileSync(summary.inventoryPath, "utf8"));
    const item = inventory.items.find((row: { source: string }) => row.source === "ci");
    expect(item.logStatus).toBe("log_unavailable");
    expect(result.status).toBe(0);
  });
  it("creates a distinct private inventory for each invocation", () => {
    const sharedTmpDir = mkdtempSync(join(tmpdir(), "fix-pr-fetch-shared-"));
    temps.push(sharedTmpDir);
    const fixture = { ...emptyLists(), view: view() };

    const first = summaryOf(run(fixture, undefined, undefined, sharedTmpDir).result);
    const second = summaryOf(run(fixture, undefined, undefined, sharedTmpDir).result);

    expect(first.inventoryPath).not.toBe(second.inventoryPath);
    expect(statSync(first.inventoryPath).mode & 0o777).toBe(0o600);
    expect(statSync(second.inventoryPath).mode & 0o777).toBe(0o600);
  });
});
