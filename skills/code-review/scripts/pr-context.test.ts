import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "pr-context.ts");
const OWNER = "octo";
const REPO = "hello";

/** Stub `gh` so capture resolves a pinned PR without network access. */
const GH_STUB = `#!/usr/bin/env bun
const args = process.argv.slice(2);
const pr = JSON.parse(process.env.STUB_PR_JSON ?? "{}");
if (args[0] === "auth") process.exit(0);
if (args[0] === "repo") {
  console.log(JSON.stringify({ nameWithOwner: process.env.STUB_OWNER + "/" + process.env.STUB_REPO }));
  process.exit(0);
}
if (args[0] === "pr" && args[1] === "view") {
  const fields = args[args.indexOf("--json") + 1] ?? "";
  console.log(JSON.stringify(fields === "files" ? (pr.files ?? []) : pr));
  process.exit(0);
}
process.exit(1);
`;

type Fixture = {
  root: string;
  origin: string;
  work: string;
  bin: string;
  config: string;
  xdg: string;
};

type PrView = {
  number: number;
  title: string;
  state: string;
  url: string;
  isDraft: boolean;
  isCrossRepository: boolean;
  headRefName: string;
  headRefOid: string;
  headRepositoryOwner: { login: string };
  headRepository: { name: string };
  baseRefName: string;
  baseRefOid: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  files: { path: string; additions: number; deletions: number }[];
};

type CaptureSummary = {
  pr_number: number;
  head_sha: string;
  base_sha: string;
  worktree: string;
  context_path: string;
  diff_path: string;
  retained: {
    kind: string;
    subject_id: string;
    context_logical_name: string;
    diff_logical_name: string;
    base_sha: string;
    head_sha: string;
    context_revision: string;
    diff_revision: string;
    context_sha256: string;
    diff_sha256: string;
    receipt_run?: string;
    reused_existing: boolean;
    diff_matches_pinned: boolean;
  };
};

type RestoreSummary = {
  base_sha: string;
  head_sha: string;
  context_sha256: string;
  diff_sha256: string;
  restored_from: string;
  context_path: string;
  diff_path: string;
};

type ListSummary = {
  listed_from: string;
  pins: { base_sha: string; head_sha: string; context_revision: string; diff_revision: string }[];
};

type CliResult = { status: number; stdout: string; stderr: string };

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function fixture(adapter: "sqlite" | "repo-files" | "external-files"): Fixture {
  const root = mkdtempSync(join(tmpdir(), "pr-context-"));
  roots.push(root);
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  const bin = join(root, "bin");
  const xdg = join(root, "xdg");
  mkdirSync(bin, { recursive: true });
  mkdirSync(xdg, { recursive: true });

  git(root, "init", "--bare", "-q", origin);
  git(root, "clone", "-q", origin, work);
  git(work, "config", "user.email", "test@example.com");
  git(work, "config", "user.name", "test");
  writeFileSync(join(work, "a.txt"), "base\n");
  git(work, "add", "-A");
  git(work, "commit", "-qm", "base");
  git(work, "branch", "-M", "main");
  git(work, "push", "-q", "origin", "main");
  git(work, "checkout", "-qb", "feature");
  // A text patch can contain non-UTF-8 bytes; decoding it would lose evidence.
  writeFileSync(join(work, "b.txt"), Buffer.from("feature \xff\n", "latin1"));
  git(work, "add", "-A");
  git(work, "commit", "-qm", "feature");
  git(work, "push", "-q", "origin", "feature");

  const ghStub = join(bin, "gh");
  writeFileSync(ghStub, GH_STUB);
  chmodSync(ghStub, 0o755);

  const config = join(root, "config.yaml");
  const storage = adapter === "sqlite"
    ? `  adapter: sqlite\n  database: ${join(root, "state.sqlite")}\n`
    : adapter === "external-files" ? `  adapter: external-files\n  root: ${join(root, "external")}\n`
    : "  adapter: repo-files\n";
  writeFileSync(config, `version: 1\nstorage:\n${storage}`);
  return { root, origin, work, bin, config, xdg };
}

function prView(head: string, base: string): PrView {
  return {
    number: 42, title: "pinned review", state: "OPEN", url: "https://github.com/octo/hello/pull/42",
    isDraft: false, isCrossRepository: false, headRefName: "feature", headRefOid: head,
    headRepositoryOwner: { login: OWNER }, headRepository: { name: REPO },
    baseRefName: "main", baseRefOid: base,
    additions: 1, deletions: 0, changedFiles: 1, files: [{ path: "b.txt", additions: 1, deletions: 0 }],
  };
}

function envFor(fx: Fixture, view: PrView, overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${fx.bin}:${process.env.PATH ?? ""}`,
    XDG_CONFIG_HOME: fx.xdg,
    BUCK_WORKFLOW_CONFIG: fx.config,
    STUB_OWNER: OWNER,
    STUB_REPO: REPO,
    STUB_PR_JSON: JSON.stringify(view),
    ...overrides,
  };
}

function runCli(fx: Fixture, args: string[], view: PrView, overrides: NodeJS.ProcessEnv = {}): CliResult {
  const result = spawnSync("bun", [SCRIPT, ...args], { cwd: fx.work, env: envFor(fx, view, overrides), encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function capture(fx: Fixture, view: PrView, overrides: NodeJS.ProcessEnv = {}): CliResult {
  return runCli(fx, [`${OWNER}/${REPO}#42`], view, overrides);
}

function captureSummary(fx: Fixture, view: PrView): CaptureSummary {
  const result = capture(fx, view);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as CaptureSummary;
}

function restoreSummary(fx: Fixture, args: string[], view: PrView): RestoreSummary {
  const result = runCli(fx, ["--restore", ...args], view);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as RestoreSummary;
}

function headSha(fx: Fixture): string {
  return git(fx.work, "rev-parse", "feature").trim();
}

function baseSha(fx: Fixture): string {
  return git(fx.work, "rev-parse", "main").trim();
}

function removeExports(fx: Fixture): void {
  rmSync(join(fx.work, ".worktrees"), { recursive: true, force: true });
  git(fx.work, "worktree", "prune");
}

function pinName(view: PrView, file: string): string {
  return `pull/octo/hello/pr-42/${view.baseRefOid}..${view.headRefOid}/${file}`;
}

const adapters = ["sqlite", "repo-files", "external-files"] as const;

describe("pr-context pinned evidence retention", () => {
  for (const adapter of adapters) {
    describe(adapter, () => {
      let fx: Fixture;
      let view: PrView;

      beforeEach(() => {
        fx = fixture(adapter);
        view = prView(headSha(fx), baseSha(fx));
      });

      it("retains the pinned metadata and exact diff bytes on the configured service", () => {
        const summary = captureSummary(fx, view);
        expect(summary.pr_number).toBe(42);
        expect(summary.head_sha).toBe(view.headRefOid);
        expect(summary.base_sha).toBe(view.baseRefOid);
        expect(summary.retained.kind).toBe("audit");
        expect(summary.retained.subject_id).toBe("code-review-pr");
        expect(summary.retained.reused_existing).toBe(false);
        expect(summary.retained.receipt_run).toMatch(/^run-/);
        expect(summary.retained.context_logical_name).toBe(pinName(view, "pr-context.json"));
        expect(summary.retained.diff_logical_name).toBe(pinName(view, "pr.diff"));

        // Existing CLI output contract is preserved for current consumers.
        expect(summary.context_path).toBe(join(fx.work, ".worktrees", "pr-42", "pr-context.json"));
        expect(summary.diff_path).toBe(join(fx.work, ".worktrees", "pr-42", "pr.diff"));
        const exported = JSON.parse(readFileSync(summary.context_path, "utf8")) as { head_sha: string; base_sha: string; pr: { number: number } };
        expect(exported.head_sha).toBe(view.headRefOid);
        expect(exported.base_sha).toBe(view.baseRefOid);
        expect(exported.pr.number).toBe(42);
        expect(summary.worktree).toBe(join(fx.work, ".worktrees", "pr-42"));

        // The exported diff equals the pinned `git diff base..head` bytes.
        const pinnedDiff = execFileSync("git", ["diff", `${view.baseRefOid}..${view.headRefOid}`], {
          cwd: join(fx.work, ".worktrees", "pr-42"), encoding: "buffer",
        });
        expect(readFileSync(summary.diff_path).toString("hex")).toBe(pinnedDiff.toString("hex"));
      });

      it("restores the exact pinned bytes after the local exports are removed", () => {
        const captured = captureSummary(fx, view);
        const exportedContext = readFileSync(join(fx.work, ".worktrees", "pr-42", "pr-context.json"));
        const exportedDiff = readFileSync(join(fx.work, ".worktrees", "pr-42", "pr.diff"));

        removeExports(fx);
        expect(existsSync(join(fx.work, ".worktrees", "pr-42", "pr-context.json"))).toBe(false);

        const out = join(fx.root, "restored");
        const restored = restoreSummary(fx, [`${OWNER}/${REPO}#42`, "--out", out], view);
        expect(restored.head_sha).toBe(view.headRefOid);
        expect(restored.base_sha).toBe(view.baseRefOid);
        expect(restored.restored_from).toBe("configured-adapter");
        expect(restored.context_sha256).toBe(captured.retained.context_sha256);
        expect(restored.diff_sha256).toBe(captured.retained.diff_sha256);
        expect(restored.context_path).toBe(join(out, "pr-context.json"));
        expect(restored.diff_path).toBe(join(out, "pr.diff"));
        expect(readFileSync(join(out, "pr.diff"))).toEqual(exportedDiff);
        expect(readFileSync(join(out, "pr-context.json"))).toEqual(exportedContext);
      });

      it("restores the pinned SHA pair, not what the checkout resolved to this run", () => {
        const captured = captureSummary(fx, view);
        // The checkout moves on; the pinned identity must not.
        writeFileSync(join(fx.work, "d.txt"), "unrelated\n");
        git(fx.work, "add", "-A");
        git(fx.work, "commit", "-qm", "unrelated");
        expect(headSha(fx)).not.toBe(view.headRefOid);

        removeExports(fx);
        const restored = restoreSummary(fx, [`${OWNER}/${REPO}#42`, "--out", join(fx.root, "pinned")], view);
        expect(restored.head_sha).toBe(view.headRefOid);
        expect(restored.base_sha).toBe(view.baseRefOid);
        expect(restored.context_revision).toBe(captured.retained.context_revision);
        const context = JSON.parse(readFileSync(restored.context_path, "utf8")) as { head_sha: string; base_sha: string };
        expect(context.head_sha).toBe(view.headRefOid);
        expect(context.base_sha).toBe(view.baseRefOid);
        expect(restored.diff_sha256).toBe(captured.retained.diff_sha256);
      });

      it("keeps the original pinned snapshot when the PR is revised", () => {
        const first = prView(headSha(fx), baseSha(fx));
        captureSummary(fx, first);
        const firstDiff = readFileSync(join(fx.work, ".worktrees", "pr-42", "pr.diff"));

        writeFileSync(join(fx.work, "c.txt"), "revised\n");
        git(fx.work, "add", "-A");
        git(fx.work, "commit", "-qm", "revised");
        git(fx.work, "push", "-q", "origin", "feature");
        const second = prView(headSha(fx), baseSha(fx));
        expect(second.headRefOid).not.toBe(first.headRefOid);
        captureSummary(fx, second);
        const secondDiff = readFileSync(join(fx.work, ".worktrees", "pr-42", "pr.diff"));
        expect(secondDiff.toString("hex")).not.toBe(firstDiff.toString("hex"));

        removeExports(fx);
        const listed = runCli(fx, ["--list", `${OWNER}/${REPO}#42`], second);
        expect(listed.status, listed.stderr).toBe(0);
        const inventory = JSON.parse(listed.stdout) as ListSummary;
        expect(inventory.listed_from).toBe("configured-adapter");
        expect(inventory.pins.map((pin) => pin.head_sha).sort()).toEqual([first.headRefOid, second.headRefOid].sort());
        expect(inventory.pins.every((pin) => pin.context_revision && pin.diff_revision)).toBe(true);

        const restoredFirst = restoreSummary(
          fx, [`${OWNER}/${REPO}#42`, "--head-sha", first.headRefOid, "--out", join(fx.root, "old-pin")], second,
        );
        expect(restoredFirst.head_sha).toBe(first.headRefOid);
        expect(readFileSync(join(fx.root, "old-pin", "pr.diff"))).toEqual(firstDiff);
      });

      it("does not select a base SHA as though it were the requested head", () => {
        captureSummary(fx, view);
        const out = join(fx.root, "wrong-head");
        const result = runCli(fx, ["--restore", `${OWNER}/${REPO}#42`, "--head-sha", view.baseRefOid, "--out", out], view);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("no retained pinned evidence");
        expect(existsSync(join(out, "pr-context.json"))).toBe(false);
      });

      it("refuses an ambiguous restore instead of silently picking a revision", () => {
        captureSummary(fx, prView(headSha(fx), baseSha(fx)));
        writeFileSync(join(fx.work, "c.txt"), "revised\n");
        git(fx.work, "add", "-A");
        git(fx.work, "commit", "-qm", "revised");
        git(fx.work, "push", "-q", "origin", "feature");
        const revised = prView(headSha(fx), baseSha(fx));
        captureSummary(fx, revised);

        const out = join(fx.root, "ambiguous");
        const ambiguous = runCli(fx, ["--restore", `${OWNER}/${REPO}#42`, "--out", out], revised);
        expect(ambiguous.status).toBe(1);
        expect(ambiguous.stderr).toContain("--head-sha");
        expect(existsSync(join(out, "pr-context.json"))).toBe(false);
      });

      it("keeps retained evidence private to its own worktree run", () => {
        captureSummary(fx, view);
        // A second checkout of the same remote gets its own worktree/run identity.
        const other = fixture(adapter);
        git(other.work, "remote", "set-url", "origin", fx.origin);
        git(other.work, "fetch", "-q", "origin");
        const denied = runCli(
          { ...other, config: fx.config, xdg: fx.xdg },
          ["--restore", `${OWNER}/${REPO}#42`, "--out", join(other.root, "stolen")],
          view,
        );
        expect(denied.status).toBe(1);
        expect(denied.stderr).toContain("no retained pinned evidence");
        expect(existsSync(join(other.root, "stolen", "pr.diff"))).toBe(false);
      });

      it("does not fall back to local files when the configured service is unavailable", () => {
        captureSummary(fx, view);
        removeExports(fx);
        const broken = join(fx.root, "broken-config.yaml");
        writeFileSync(broken, "storage:\n  adapter: sqlite\n  database: [\n");

        const out = join(fx.root, "outage");
        const restoreOutage = runCli(fx, ["--restore", `${OWNER}/${REPO}#42`, "--out", out], view, { BUCK_WORKFLOW_CONFIG: broken });
        expect(restoreOutage.status).toBe(1);
        expect(restoreOutage.stderr).toContain("configured service failed");
        expect(existsSync(join(out, "pr-context.json"))).toBe(false);
        expect(existsSync(join(out, "pr.diff"))).toBe(false);

        const listOutage = runCli(fx, ["--list", `${OWNER}/${REPO}#42`], view, { BUCK_WORKFLOW_CONFIG: broken });
        expect(listOutage.status).toBe(1);
        expect(listOutage.stdout).not.toContain("pull/octo/hello/pr-42");

        const captureOutage = capture(fx, view, { BUCK_WORKFLOW_CONFIG: broken });
        expect(captureOutage.status).toBe(1);
        expect(captureOutage.stderr).toContain("retaining pinned evidence on the configured service failed");
        expect(existsSync(join(fx.work, ".worktrees", "pr-42", "pr-context.json"))).toBe(false);
      });

      it("re-capturing the same pinned SHAs keeps the first retained snapshot", () => {
        const first = captureSummary(fx, view);
        expect(first.retained.reused_existing).toBe(false);
        const firstContext = readFileSync(first.context_path);
        const firstDiff = readFileSync(first.diff_path);

        const again = captureSummary(fx, { ...view, title: "Mutable title changed after pinning" });
        expect(again.retained.reused_existing).toBe(true);
        expect(again.retained.diff_matches_pinned).toBe(true);
        expect(again.retained.context_revision).toBe(first.retained.context_revision);
        expect(again.retained.diff_revision).toBe(first.retained.diff_revision);
        expect(readFileSync(again.context_path)).toEqual(firstContext);
        expect(readFileSync(again.diff_path)).toEqual(firstDiff);
      });

      it("restores without invoking gh, proving no mutable input is refetched", () => {
        captureSummary(fx, view);
        removeExports(fx);
        // Any `gh` call now fails loudly and leaves a sentinel behind.
        const ghSentinel = join(fx.root, "gh-was-called");
        const brokenBin = join(fx.root, "broken-bin");
        mkdirSync(brokenBin, { recursive: true });
        const ghPath = join(brokenBin, "gh");
        writeFileSync(ghPath, `#!/usr/bin/env bash\ntouch "${ghSentinel}"\nexit 97\n`);
        chmodSync(ghPath, 0o755);

        const systemPath = (process.env.PATH ?? "").split(":").filter((entry) => entry !== fx.bin).join(":");
        const withoutGh = runCli(fx, ["--restore", `${OWNER}/${REPO}#42`], view, { PATH: `${brokenBin}:${systemPath}` });
        expect(withoutGh.status, withoutGh.stderr).toBe(0);
        expect(existsSync(ghSentinel)).toBe(false);
        const summary = JSON.parse(withoutGh.stdout) as RestoreSummary;
        expect(summary.restored_from).toBe("configured-adapter");
        expect(summary.head_sha).toBe(view.headRefOid);
        expect(existsSync(join(fx.work, ".worktrees", "pr-42", "pr.diff"))).toBe(true);
        expect(existsSync(join(fx.work, ".worktrees", "pr-42", "pr-context.json"))).toBe(true);
      });
    });
  }
});