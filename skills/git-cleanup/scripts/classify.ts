#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const networkOptions = { timeout: 15_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" } };
const git = async (args: string[], cwd = process.cwd(), allowFailure = false, network = false) => {
  try {
    const result = await exec("git", args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, ...(network ? networkOptions : {}) });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: number };
    if (allowFailure) return { ok: false, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "", code: failure.code };
    throw new Error(`git ${args[0]} failed: ${(failure.stderr ?? failure.message).trim()}`);
  }
};

type Worktree = Record<string, string>;
type Item = {
  kind: "worktree" | "branch"; name: string; path: string | null; tip: string | null;
  disposition: "skip" | "auto-delete" | "ask"; state: "planning" | "building" | "finished";
  description: string; description_source: "pr_title" | "plan_h1" | "commit_subject" | "branch_name";
  unique_context: boolean; unique_context_paths: string[]; dirty: boolean; dirty_paths: string[];
  contained: boolean; conflict_paths: string[]; cherry: { plus: number; minus: number };
  remote: "live" | "gone" | "unknown" | null; pr: { state: string; title: string } | null;
  prunable: boolean; skip_reason: "current" | "integration" | "main-worktree" | null;
};

type BranchEvidence = {
  dirtyPaths: string[]; dirty: boolean; missing: boolean;
  proof: { contained: boolean; conflict_paths: string[] };
  uniquePaths: string[]; pr: Item["pr"];
  description: { description: string; description_source: Item["description_source"] };
  state: Item["state"]; cherry: { plus: number; minus: number }; remote: Item["remote"];
};
function parseWorktrees(raw: string): Worktree[] {
  return raw.split("\0\0").filter(Boolean).map((block) => Object.fromEntries(block.split("\0").filter(Boolean).map((field) => {
    const index = field.indexOf(" ");
    return index < 0 ? [field, "true"] : [field.slice(0, index), field.slice(index + 1)];
  })));
}

async function resolveBase(cwd: string) {
  for (const ref of ["refs/remotes/origin/HEAD", "refs/heads/master", "refs/heads/main"]) {
    const result = await git(["show-ref", "--verify", "--hash", ref], cwd, true);
    if (result.ok) return { ref, sha: result.stdout.trim() };
  }
  throw new Error("No base found (expected refs/remotes/origin/HEAD, local master, or local main)");
}

// Stable short types only; unfamiliar Git versions/types deliberately fail closed.
const mergeMessageTypes: Record<string, true> = {
  "Auto-merging": true, "CONFLICT (contents)": true, "CONFLICT (add/add)": true,
  "CONFLICT (modify/delete)": true, "CONFLICT (rename/delete)": true, "CONFLICT (rename/rename)": true,
  "CONFLICT (file/directory)": true, "CONFLICT (directory rename suggested)": true,
  "CONFLICT (binary)": true, "CONFLICT (submodule)": true,
};

function messagePaths(records: string[]): string[] | null {
  const paths: string[] = [];
  for (let index = 0; index < records.length;) {
    const count = records[index++];
    if (!/^[1-9]\d*$/.test(count)) return null;
    const size = Number(count);
    if (size > records.length - index - 2) return null;
    const affected = records.slice(index, index + size);
    index += size;
    const type = records[index++];
    const message = records[index++];
    if (!Object.hasOwn(mergeMessageTypes, type) || !message || affected.some((path) => !path)) return null;
    if (type !== "Auto-merging") paths.push(...affected);
  }
  return paths;
}

function mergeRecords(raw: string) {
  const records = raw.split("\0");
  const tree = records.shift() ?? "";
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(tree) || records.pop() !== "") return null;
  const paths: string[] = [];
  while (records.length && records[0] !== "") {
    const match = records.shift()!.match(/^\d{6} (?:[0-9a-f]{40}|[0-9a-f]{64}) [1-3]\t([\s\S]+)$/);
    if (!match) return null;
    paths.push(match[1]);
  }
  if (records.length) records.shift(); // unmerged-entry / information separator
  const messages = messagePaths(records);
  return messages === null ? null : { tree, paths: [...new Set([...paths, ...messages])] };
}

async function containment(base: string, tip: string, cwd: string) {
  const result = await git(["merge-tree", "--write-tree", "-z", base, tip], cwd, true);
  const parsed = mergeRecords(result.stdout);
  if (!parsed || (!result.ok && result.code !== 1)) return { contained: false, conflict_paths: [] as string[], tree: null };
  const { tree, paths } = parsed;
  if (!result.ok && paths.length === 0) return { contained: false, conflict_paths: paths, tree: null };
  const codeDiff = await git(["diff", "--quiet", base, tree, "--", ".", ":(exclude).context"], cwd, true);
  const conflictsAllowed = paths.every((path) => path.startsWith(".context/"));
  return { contained: codeDiff.ok && conflictsAllowed, conflict_paths: paths, tree };
}
async function contextPaths(base: string, tip: string, cwd: string) {
  const result = await git(["diff", "--name-only", "-z", base, tip, "--", ".context"], cwd, true);
  return result.ok ? result.stdout.split("\0").filter(Boolean) : ["(context diff failed)"];
}

async function pullRequest(branch: string, cwd: string): Promise<Item["pr"]> {
  try {
    const result = await exec("gh", ["pr", "view", branch, "--json", "state,title"], { cwd, encoding: "utf8", maxBuffer: 1024 * 1024, ...networkOptions });
    const value = JSON.parse(result.stdout) as { state?: string; title?: string };
    return value.state && value.title ? { state: value.state, title: value.title } : null;
  } catch { return null; }
}

async function relevantArtifacts(tip: string, base: string, cwd: string) {
  const changed = await git(["diff", "--name-only", "-z", base, tip, "--", ".context"], cwd, true);
  const files = await git(["ls-tree", "-r", "--name-only", "-z", tip, "--", ".context"], cwd, true);
  if (!changed.ok || !files.ok) return [];
  const subjects = [...new Set(changed.stdout.split("\0").map((path) => path.match(/^(\.context\/\d{4}-\d{2}-\d{2}\.[^/]+)\//)?.[1]).filter(Boolean))].sort().reverse();
  const paths = files.stdout.split("\0");
  // Select one branch-relevant subject, never unrelated historical completion.
  const subject = subjects.find((dir) => paths.some((path) => path.startsWith(`${dir}/`)));
  if (!subject) return [];
  const relevant = paths.filter((path) => path.startsWith(`${subject}/`));
  return Promise.all(relevant.map(async (path) => {
    const content = await git(["show", `${tip}:${path}`], cwd, true);
    return { path, text: content.ok ? content.stdout : "" };
  }));
}

type Artifact = { path: string; text: string };

function artifactStatus(text: string) {
  return text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1].match(/^status:\s*(\S+)\s*$/m)?.[1];
}

async function descriptionFor(tip: string, branch: string, cwd: string, pr: Item["pr"], artifacts: Artifact[]) {
  if (pr?.title) return { description: pr.title, description_source: "pr_title" as const };
  for (const plan of artifacts.filter((file) => /\/plan-[^/]+\.md$/.test(file.path))) {
    const heading = plan.text.split("\n").find((line) => /^#\s+\S/.test(line));
    if (heading) return { description: heading.replace(/^#\s+/, "").trim(), description_source: "plan_h1" as const };
  }
  const subject = await git(["log", "-1", "--format=%s", tip], cwd, true);
  if (subject.ok && subject.stdout.trim()) return { description: subject.stdout.trim(), description_source: "commit_subject" as const };
  return { description: branch, description_source: "branch_name" as const };
}

async function remoteState(branch: string, cwd: string, fetchOk: boolean) {
  const upstream = await git(["for-each-ref", "--format=%(upstream)", `refs/heads/${branch}`], cwd, true);
  if (!upstream.ok || !upstream.stdout.trim()) return null;
  if (!fetchOk) return "unknown" as const;
  const remote = await git(["show-ref", "--verify", upstream.stdout.trim()], cwd, true);
  return remote.ok ? "live" as const : "gone" as const;
}

async function branchState(tip: string, base: string, cwd: string, contained: boolean, dirty: boolean, artifacts: Artifact[]) {
  if (contained) return "finished" as const;
  const uniqueCode = await git(["diff", "--quiet", base, tip, "--", ".", ":(exclude).context"], cwd, true);
  if (!uniqueCode.ok) return "building" as const;
  const metadata = artifacts.filter((file) => /\/(?:index|plan-[^/]+)\.md$/.test(file.path));
  const subject = metadata.find((file) => file.path.endsWith("/index.md")) ?? metadata[0];
  const status = subject && artifactStatus(subject.text);
  if (status === "completed") return "finished" as const;
  const hasPlanningArtifact = artifacts.some((file) => /\/(?:plan-|research-|brainstorm-)/.test(file.path));
  return !dirty && (status === "draft" || hasPlanningArtifact) ? "planning" as const : "building" as const;
}

async function getDirtyPaths(path: string | null) {
  if (!path) return [];
  const status = await git(["status", "--porcelain", "--untracked-files=normal", "--ignored=matching"], path, true);
  const paths = status.stdout.split("\n").filter(Boolean);
  if (!status.ok) paths.push("(status failed)");
  return paths;
}

async function getCherryCounts(base: string, tip: string, cwd: string) {
  const result = await git(["cherry", base, tip], cwd, true);
  return result.stdout.split("\n").reduce((count, line) => {
    if (line.startsWith("+")) count.plus++;
    if (line.startsWith("-")) count.minus++;
    return count;
  }, { plus: 0, minus: 0 });
}

function getSkipReason(branch: string, path: string | null, options: { current: string; currentPath: string; mainPath: string; integration: string }): Item["skip_reason"] {
  if (branch === options.current || path === options.currentPath) return "current";
  if (branch === options.integration) return "integration";
  if (path === options.mainPath) return "main-worktree";
  return null;
}

async function containmentFor(missing: boolean, base: string, tip: string, cwd: string) {
  if (missing) return { contained: false, conflict_paths: [] as string[], tree: null };
  return containment(base, tip, cwd);
}

async function pullRequestFor(branch: string, cwd: string) {
  if (branch.startsWith("detached:")) return null;
  return pullRequest(branch, cwd);
}

async function remoteFor(branch: string, cwd: string, fetchOk: boolean) {
  if (branch.startsWith("detached:")) return null;
  return remoteState(branch, cwd, fetchOk);
}

async function evidenceFor(branch: string, path: string | null, tip: string, base: string, cwd: string, options: { fetchOk: boolean; worktree?: Worktree }): Promise<BranchEvidence> {
  const workingPath = path ?? cwd;
  const dirtyPaths = await getDirtyPaths(path);
  const dirty = dirtyPaths.length > 0;
  // Even an existing directory can lack its gitdir: Git may silently use a parent repo.
  const missing = Boolean(options.worktree?.prunable);
  const proof = await containmentFor(missing, base, tip, workingPath);
  const uniquePaths = await contextPaths(base, proof.tree ?? tip, workingPath);
  const pr = await pullRequestFor(branch, workingPath);
  const artifacts = await relevantArtifacts(tip, base, workingPath);
  const [description, state, cherry, remote] = await Promise.all([
    descriptionFor(tip, branch, workingPath, pr, artifacts),
    branchState(tip, base, workingPath, proof.contained, dirty, artifacts),
    getCherryCounts(base, tip, workingPath),
    remoteFor(branch, cwd, options.fetchOk),
  ]);
  return { dirtyPaths, dirty, missing, proof, uniquePaths, pr, description, state, cherry, remote };
}

function dispositionFor(branch: string, path: string | null, evidence: BranchEvidence, options: { current: string; currentPath: string; mainPath: string; integration: string }) {
  const skipReason = getSkipReason(branch, path, options);
  const deletable = !branch.startsWith("detached:") && !evidence.missing && evidence.state === "finished" &&
    evidence.proof.contained && evidence.uniquePaths.length === 0 && !evidence.dirty;
  return { skipReason, disposition: skipReason ? "skip" as const : deletable ? "auto-delete" as const : "ask" as const };
}

async function classifyBranch(branch: string, path: string | null, tip: string, base: string, cwd: string, options: { fetchOk: boolean; current: string; currentPath: string; mainPath: string; integration: string; worktree?: Worktree }): Promise<Item> {
  const evidence = await evidenceFor(branch, path, tip, base, cwd, options);
  const decision = dispositionFor(branch, path, evidence, options);
  return {
    kind: path ? "worktree" : "branch", name: branch, path, tip,
    disposition: decision.disposition, state: evidence.state, skip_reason: decision.skipReason,
    ...evidence.description, unique_context: evidence.uniquePaths.length > 0, unique_context_paths: evidence.uniquePaths,
    dirty: evidence.dirty, dirty_paths: evidence.dirtyPaths, contained: evidence.proof.contained,
    conflict_paths: evidence.proof.conflict_paths, cherry: evidence.cherry, remote: evidence.remote,
    pr: evidence.pr, prunable: Boolean(options.worktree?.prunable),
  };
}

function parseBranches(raw: string) {
  return raw.trim().split("\n").filter(Boolean).map((line) => {
    const [ref, tip] = line.split(" ");
    return { name: ref.replace(/^refs\/heads\//, ""), tip };
  });
}

async function inventoryItems(worktreeOutput: string, branchOutput: string, base: { ref: string; sha: string }, options: { fetchOk: boolean; current: string; currentPath: string; mainPath: string; integration: string }, cwd: string) {
  const worktrees = parseWorktrees(worktreeOutput);
  const branches = parseBranches(branchOutput);
  const assigned = new Set(worktrees.filter((row) => row.branch).map((row) => row.branch!.replace(/^refs\/heads\//, "")));
  const items: Item[] = [];
  for (const worktree of worktrees) {
    if (!worktree.HEAD) continue;
    const path = worktree.worktree ?? null;
    const branch = worktree.branch?.replace(/^refs\/heads\//, "") ?? `detached:${path ? basename(path) : "unknown"}`;
    if (worktree.branch) assigned.add(branch);
    items.push(await classifyBranch(branch, path, worktree.HEAD, base.sha, cwd, { ...options, worktree }));
  }
  for (const branch of branches) {
    if (assigned.has(branch.name)) continue;
    items.push(await classifyBranch(branch.name, null, branch.tip, base.sha, cwd, options));
  }
  return items;
}

async function verifyBase(cwd: string, base: { ref: string; sha: string }, fetchOk: boolean) {
  if (!fetchOk || base.ref !== "refs/remotes/origin/HEAD") return false;
  const remoteHead = await git(["ls-remote", "--symref", "origin", "HEAD"], cwd, true, true);
  const expectedRef = remoteHead.stdout.match(/^ref: refs\/heads\/([^\n\t]+)\s+HEAD$/m)?.[1];
  const expectedSha = remoteHead.stdout.match(/^([0-9a-f]{40}|[0-9a-f]{64})\s+HEAD$/m)?.[1];
  if (!remoteHead.ok || !expectedRef || !expectedSha) return false;
  const symbolic = await git(["symbolic-ref", "-q", base.ref], cwd, true);
  return symbolic.ok && symbolic.stdout.trim() === `refs/remotes/origin/${expectedRef}` && base.sha === expectedSha;
}

async function classify(cwd: string) {
  const fetch = await git(["fetch", "--no-auto-maintenance", "--prune", "origin"], cwd, true, true);
  const base = await resolveBase(cwd);
  const trusted = await verifyBase(cwd, base, fetch.ok);
  const commonDir = resolve(cwd, (await git(["rev-parse", "--git-common-dir"], cwd)).stdout.trim());
  const [worktreeResult, branchesResult, currentResult, currentPathResult, headRef] = await Promise.all([
    git(["worktree", "list", "--porcelain", "-z"], cwd),
    git(["for-each-ref", "--format=%(refname) %(objectname)", "refs/heads"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-parse", "--show-toplevel"], cwd),
    git(["symbolic-ref", "-q", "refs/remotes/origin/HEAD"], cwd, true),
  ]);
  const options = {
    fetchOk: fetch.ok,
    current: currentResult.stdout.trim(),
    currentPath: resolve(currentPathResult.stdout.trim()),
    mainPath: resolve(dirname(commonDir)),
    integration: headRef.ok ? headRef.stdout.trim().replace(/^refs\/heads\//, "").replace(/^refs\/remotes\/origin\//, "") : base.ref.replace(/^refs\/heads\//, ""),
  };
  const items = await inventoryItems(worktreeResult.stdout, branchesResult.stdout, base, options, cwd);
  if (!trusted) for (const item of items) if (item.disposition === "auto-delete") item.disposition = "ask";
  return { base, fetch: { ok: fetch.ok }, base_verified: trusted, items };
}

type ApplyResult = {
  applied: { name: string; action: string; ok: boolean }[];
  refused: { name: string; reason: string }[];
};

function refusalReason(item: Item | undefined): string | null {
  if (!item) return "name not present in fresh classification";
  if (item.disposition !== "auto-delete") return `fresh disposition is ${item.disposition}`;
  if (item.prunable) return "worktree registration is prunable";
  if (item.dirty || item.dirty_paths.length) return "worktree is dirty";
  return null;
}

async function prepareWorktree(item: Item, cwd: string): Promise<string | null> {
  if (item.kind !== "worktree" || !item.path) return null;
  if ((await getDirtyPaths(item.path)).length) return "worktree contains changes or ignored files";
  const removed = await git(["worktree", "remove", item.path], cwd, true);
  return removed.ok ? null : "git worktree remove failed";
}

async function branchAvailable(name: string, cwd: string) {
  const worktrees = await git(["worktree", "list", "--porcelain", "-z"], cwd, true);
  return worktrees.ok && !parseWorktrees(worktrees.stdout).some((row) => row.branch === `refs/heads/${name}`);
}

async function applyItem(name: string, item: Item | undefined, cwd: string, result: ApplyResult) {
  const reason = refusalReason(item);
  if (reason || !item) {
    result.refused.push({ name, reason: reason ?? "name not present in fresh classification" });
    return;
  }
  const currentTip = await git(["rev-parse", "--verify", `refs/heads/${name}`], cwd, true);
  if (!currentTip.ok || currentTip.stdout.trim() !== item.tip) {
    result.refused.push({ name, reason: "branch tip changed" });
    return;
  }
  const worktreeError = await prepareWorktree(item, cwd);
  if (worktreeError) {
    result.refused.push({ name, reason: worktreeError });
    return;
  }
  if (!await branchAvailable(name, cwd)) {
    result.refused.push({ name, reason: "branch is checked out or worktrees cannot be verified" });
    return;
  }
  const deleted = await git(["update-ref", "-d", `refs/heads/${name}`, item.tip!], cwd, true);
  if (!deleted.ok) {
    result.refused.push({ name, reason: "branch tip changed or branch deletion failed" });
    return;
  }
  result.applied.push({ name, action: "update-ref -d", ok: true });
}

async function apply(cwd: string, requested: string[]) {
  const fresh = await classify(cwd);
  const result: ApplyResult = { applied: [], refused: [] };
  const names = requested.length ? [...new Set(requested)] : fresh.items.filter((item) => item.disposition === "auto-delete").map((item) => item.name);
  const byName = new Map(fresh.items.map((item) => [item.name, item]));
  for (const name of names) await applyItem(name, byName.get(name), cwd, result);
  const prunable = fresh.items.filter((item) => item.prunable);
  if (prunable.length) await git(["worktree", "prune"], cwd, true);
  return { ...fresh, ...result };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--apply") {
    const result = await apply(process.cwd(), args.slice(1));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (args.length) throw new Error("Usage: classify.ts [--apply [branch ...]]");
  process.stdout.write(`${JSON.stringify(await classify(process.cwd()), null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`git-cleanup classify: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
