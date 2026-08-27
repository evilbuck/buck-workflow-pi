/**
 * b-pr-improved Extension
 *
 * Deterministic, code-driven PR creation — the extension counterpart to the
 * b-pr skill. The whole flow is orchestrated in code (not agent-interpreted
 * prose): it reuses skills/b-pr/scripts/pr-preflight.ts for the git/gh plumbing
 * (base cache, fetch, rebase, conflict detection, gather) and invokes the model
 * inline via createAgentSession for the two steps that need intelligence —
 * conflict resolution and PR-description synthesis — then pushes and creates the PR.
 *
 * Unlike the deprecated b-flow (xstate orchestration), this is a single
 * self-contained command, closer in spirit to b-grill-auto. The deterministic
 * core (cache / fetch / rebase / conflict-detect / push / gh) always works;
 * the AI steps degrade gracefully if no model is available.
 *
 * Cross-platform: under Pi/OMP with the extension loaded this runs the code
 * path. Without it, commands/b-pr-improved.md falls back to the b-pr skill,
 * which shares the same preflight procedure but leaves pushing to the caller.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createProgress, execFileCaptured } from "../command-progress.js";
import { runOmpModelSession } from "../omp-models.js";


const HERE = dirname(fileURLToPath(import.meta.url));
// The deterministic plumbing lives in one place — the b-pr skill's script.
const PREFLIGHT = join(HERE, "..", "..", "skills", "b-pr", "scripts", "pr-preflight.ts");

const MAX_CONFLICT_ATTEMPTS = 20;

// ---------- git / gh helpers ----------

function execGit(args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer };
    throw new Error(`git ${args.join(" ")} failed: ${err.stderr?.toString().trim() || err.message}`);
  }
}

async function execGitPush(args: string[], cwd: string): Promise<void> {
  const result = await execFileCaptured("git", args, cwd);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim() || "unknown"}`);
  }
}

export async function pushBranchIfAhead(branch: string, cwd: string, allowForceWithLease = false): Promise<boolean> {
  const remoteRef = `refs/remotes/origin/${branch}`;
  try {
    execGit(["rev-parse", "--verify", remoteRef], cwd);
  } catch {
    await execGitPush(["push", "-u", "origin", branch], cwd);
    return true;
  }

  const [behind, ahead] = execGit(["rev-list", "--left-right", "--count", `${remoteRef}...${branch}`], cwd)
    .trim()
    .split(/\s+/)
    .map(Number);
  if (ahead === 0) return false;
  if (behind > 0 && !allowForceWithLease) {
    throw new Error(`${remoteRef} has ${behind} commit(s) missing locally; refusing to overwrite it`);
  }

  const args = ["push"];
  if (behind > 0) args.push("--force-with-lease");
  await execGitPush([...args, "-u", "origin", branch], cwd);
  return true;
}

function conflictedFiles(cwd: string): string[] {
  const raw = execGit(["diff", "--diff-filter=U", "--name-only"], cwd).trim();
  return raw ? raw.split("\n").filter(Boolean) : [];
}

// ---------- preflight (reuse the skill's script — single source of truth) ----------

interface Preflight {
  code: number;
  json: Record<string, unknown> | null;
}

async function runPreflight(args: string[], cwd: string): Promise<Preflight> {
  const { code, stdout } = await execFileCaptured("bun", [PREFLIGHT, ...args], cwd);
  let json: Record<string, unknown> | null = null;
  try {
    json = stdout.trim() ? (JSON.parse(stdout) as Record<string, unknown>) : null;
  } catch {
    json = null; // non-JSON error output
  }
  return { code, json };
}

// ---------- inline model invocation ----------

async function runModelSession(
  cwd: string,
  tools: string[],
  prompt: string,
  modelOverride?: string,
  timeoutMs = 120_000,
): Promise<string> {
  return runOmpModelSession({ cwd, tools, prompt, modelOverride, timeoutMs });
}


// ---------- model step 1: resolve rebase conflicts ----------

// Returns true if the rebase completed cleanly. The model only reads + edits the
// conflicted files; this function does the deterministic git dance (add + continue)
// and loops until the rebase is done or attempts are exhausted.
async function resolveRebaseConflicts(
  cwd: string,
  baseRef: string,
  modelOverride: string | undefined,
  notify: (msg: string, level: "info" | "warning") => void,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_CONFLICT_ATTEMPTS; attempt++) {
    const files = conflictedFiles(cwd);
    if (files.length === 0) return true; // rebase complete

    const prompt =
      `You are resolving a git rebase conflict onto ${baseRef}. These files have unresolved conflict markers (<<<<<<< ======= >>>>>>>):\n\n` +
      files.map((f) => `- ${f}`).join("\n") +
      `\n\nFor EACH file: read it, reconcile both sides, remove ALL conflict markers, and write the correct merged content with the edit tool. ` +
      `Do NOT run git — only read and edit files. Prefer keeping both sides' changes when they don't truly conflict. ` +
      `Do not add commentary; just resolve the files.`;

    try {
      await runModelSession(cwd, ["read", "edit"], prompt, modelOverride);
    } catch (e: unknown) {
      notify(`⚠️ conflict-resolution model call failed: ${(e as Error).message}. Resolve manually, then re-run /b-pr-improved.`, "warning");
      return false;
    }

    for (const f of files) {
      try {
        execGit(["add", "--", f], cwd);
      } catch {
        // file may have been removed in the resolution — skip
      }
    }
    try {
      execGit(["rebase", "--continue"], cwd, { GIT_EDITOR: "true" });
    } catch (e: unknown) {
      // --continue exits non-zero on the next conflict (expected — loop) or on a real error.
      if (conflictedFiles(cwd).length === 0) {
        notify(`⚠️ git rebase --continue failed: ${(e as Error).message}`, "warning");
        return false;
      }
    }
  }
  notify(`⚠️ gave up after ${MAX_CONFLICT_ATTEMPTS} conflict-resolution attempts. Resolve manually, then re-run /b-pr-improved.`, "warning");
  return false;
}

// ---------- model step 2: PR description ----------

function fallbackDescription(gather: Record<string, unknown>): string {
  const commits = (gather.commits as Array<{ subject: string }>) ?? [];
  const impl = (gather.implementation_files as Array<{ path: string }>) ?? [];
  return [
    "## What & Why\n",
    commits[0]?.subject ?? "Pull request",
    "\n## Files Changed\n",
    impl.length ? impl.map((f) => `- \`${f.path}\``).join("\n") : "(none)",
    "\n## Commits\n",
    commits.length ? commits.map((c) => `- ${c.subject}`).join("\n") : "(none)",
  ].join("\n");
}

async function synthesizeDescription(
  cwd: string,
  gather: Record<string, unknown>,
  modelOverride: string | undefined,
): Promise<string> {
  const commits = ((gather.commits as Array<{ subject: string; author: string }>) ?? [])
    .map((c) => `- ${c.subject} (${c.author})`)
    .join("\n");
  const impl = ((gather.implementation_files as Array<{ path: string; additions: number; deletions: number }>) ?? [])
    .map((f) => `- ${f.path} (+${f.additions}/-${f.deletions})`)
    .join("\n");
  const artifacts = ((gather.context_artifacts as Array<{ type: string; path: string; title?: string; goal?: string }>) ?? [])
    .map((a) => `- [${a.type}] ${a.path}: ${a.title ?? ""} — ${a.goal ?? ""}`)
    .join("\n");
  const prompt =
    `Write a concise GitHub PR description in markdown with two sections:\n` +
    `<!-- For Humans --> with "## What & Why", "## Impact", "## High-Level Changes" (3-5 bullets grouped by concern), and\n` +
    `<!-- For Agents --> with "### Verification Steps", "### Files Changed", "### Technical Details".\n` +
    `Implementation files changed:\n${impl || "(none)"}\n\nCommits:\n${commits || "(none)"}\n\n` +
    `Planning context that informed the work (reference as background only — NOT deliverables):\n${artifacts || "(none)"}\n\n` +
    `Return ONLY the markdown description, no preamble.`;
  try {
    const desc = await runModelSession(cwd, ["read"], prompt, modelOverride);
    if (desc) return desc;
  } catch {
    // fall through to template
  }
  return fallbackDescription(gather);
}

function deriveTitle(gather: Record<string, unknown>): string {
  const first = ((gather.commits as Array<{ subject: string }>) ?? [])[0]?.subject ?? "Update";
  return first.slice(0, 72);
}

// ---------- args ----------

interface Options {
  base?: string;
  draft: boolean;
  dryRun: boolean;
  noCache: boolean;
  model?: string;
}

function parseArgs(args: string): Options {
  const tokens = args.split(/\s+/).filter(Boolean);
  const get = (flag: string): string | undefined => {
    const i = tokens.indexOf(flag);
    if (i === -1 || i + 1 >= tokens.length) return undefined;
    const next = tokens[i + 1];
    // Never consume another option as this one's value; fall through to detection.
    if (next.startsWith("-")) return undefined;
    return next;
  };
  return {
    base: get("--base"),
    draft: tokens.includes("--draft"),
    dryRun: tokens.includes("--dry-run"),
    noCache: tokens.includes("--no-cache"),
    model: get("--model"),
  };
}

// ---------- command handler ----------

type Notify = (msg: string, level?: "info" | "warning" | "error") => void;

interface CommandUI {
  notify: Notify;
  setStatus?: (key: string, text?: string) => void;
  setWorkingMessage?: (message?: string) => void;
}

async function runBprImproved(args: string, ctx: { cwd: string; ui: CommandUI }): Promise<void> {
  const cwd = ctx.cwd;
  const notify = ctx.ui.notify;
  const opts = parseArgs(args);
  const progress = createProgress(ctx, "b-pr-improved");

  try {
    // 1. Resolve + rebase + gather via the preflight script.
    const pfArgs: string[] = [];
    if (opts.base) pfArgs.push("--base", opts.base);
    if (opts.noCache) pfArgs.push("--no-cache");
    if (opts.dryRun) pfArgs.push("--dry-run");

    progress.step("preflight…");
    let pf = await runPreflight(pfArgs, cwd);
    let rebased = pf.json?.rebased === true;

    // Cache miss → the script surfaced candidates but no chosen base. Ask once.
    if (pf.code === 0 && pf.json && !pf.json.chosen_base && pf.json.base_candidates) {
      const names = (pf.json.base_candidates as Array<{ name: string }>).map((c) => c.name).join(", ");
      notify(`No cached base. Re-run: /b-pr-improved --base <branch> (candidates: ${names})`, "info");
      return;
    }

    // Conflict → resolve in-line, then re-run the preflight to gather.
    if (pf.code === 3 && pf.json?.conflicted_files) {
      const base = (pf.json.chosen_base as string) ?? "base";
      progress.step(`Rebase conflict in ${(pf.json.conflicted_files as unknown[]).length} file(s). Resolving…`);
      const ok = await resolveRebaseConflicts(cwd, base, opts.model, notify);
      if (!ok) return;
      rebased = true;
      const rerunArgs = opts.base ? ["--base", opts.base] : [];
      progress.step("preflight…");
      pf = await runPreflight(rerunArgs, cwd);
      if (pf.code !== 0) {
        notify(`Preflight after rebase failed (exit ${pf.code}): ${(pf.json?.error as string) ?? "unknown"}`, "warning");
        return;
      }
    }

    if (pf.code !== 0 || !pf.json) {
      notify(`Preflight failed (exit ${pf.code}): ${(pf.json?.error as string) ?? "no output"}`, "warning");
      return;
    }

    const gather = pf.json;
    const base = gather.chosen_base as string;
    const head = gather.current_branch as string;

    if (opts.dryRun) {
      notify(`[dry-run] Would create PR: ${head} → ${base} (${(gather.commits as unknown[])?.length ?? 0} commits)`, "info");
      return;
    }

    try {
      progress.step(`Pushing ${head}…`);
      if (await pushBranchIfAhead(head, cwd, rebased)) notify(`Pushed ${head} to origin.`, "info");
    } catch (e: unknown) {
      notify(`Branch push failed: ${(e as Error).message}`, "warning");
      return;
    }

    // 2. Synthesize description + title (model; degrades to a template).
    progress.step("Synthesizing PR description…");
    const description = await synthesizeDescription(cwd, gather, opts.model);
    const title = deriveTitle(gather);

    // 3. Create the PR via gh.
    progress.step("Creating PR with gh…");
    const ghArgs = ["pr", "create", "--base", base, "--title", title, "--body", description];
    if (opts.draft) ghArgs.push("--draft");
    const gh = await execFileCaptured("gh", ghArgs, cwd);
    if (gh.code !== 0) {
      notify(`gh pr create failed: ${gh.stderr.trim() || gh.stdout.trim() || "unknown"}`, "warning");
      return;
    }
    progress.done(`✅ PR created: ${gh.stdout.trim()}`);
  } finally {
    progress.clear();
  }
}

// ---------- wiring ----------

export function wire(pi: ExtensionAPI): void {
  pi.registerCommand("b-pr-improved", {
    description: "Deterministic PR: cached base, auto-rebase, push, inline conflict resolution + description, then gh pr create",
    getArgumentCompletions(prefix: string) {
      return ["--base", "--draft", "--dry-run", "--no-cache", "--model"]
        .filter((o) => o.startsWith(prefix))
        .map((o) => ({ value: o, label: o }));
    },
    handler: async (args: string, ctx: { cwd: string; ui: CommandUI }) => {
      await runBprImproved(args, ctx);
    },
  });
}
