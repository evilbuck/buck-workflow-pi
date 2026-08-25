/**
 * b-commit-improved Extension
 *
 * Deterministic, code-driven Conventional Commits flow — the extension counterpart
 * to the git-commit skill. The whole flow is orchestrated in code (not
 * agent-interpreted prose): it reuses skills/git-commit-improved/scripts/commit-preflight.ts
 * for the git plumbing (subject-folder detect, draft read, branch guard, staged
 * check, diff) and invokes the model inline via createAgentSession for the ONE
 * step that needs intelligence — drafting the commit message — then commits,
 * cleans up the draft, and verifies.
 *
 * Unlike the deprecated b-flow (xstate orchestration), this is a single
 * self-contained command, closer in spirit to b-pr-improved. The deterministic
 * core (preflight / commit / amend / verify) always works; the AI step degrades
 * gracefully to a draft file if no model is available.
 *
 * Commit-in-line rule: once we have {title, body} (from a draft or a model call),
 * we commit. The only fallback is writing a `draft-commit.md` when no model is
 * available AND no draft exists — and only so `/b-commit` or a re-run of
 * `/b-commit-improved` can pick it up.
 *
 * Cross-platform: under Pi/OMP with the extension loaded this runs the code
 * path. Without it, commands/b-commit-improved.md / prompts/b-commit-improved.md
 * fall back to the git-commit-improved skill.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAgentSession, SessionManager, SettingsManager } from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { Model } from "@mariozechner/pi-ai";
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createProgress, execFileCaptured } from "../command-progress.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// Single source of truth for git plumbing — same pattern as b-pr-improved.
const PREFLIGHT = join(HERE, "..", "..", "skills", "git-commit-improved", "scripts", "commit-preflight.ts");

// ---------- git helpers ----------

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

// tryGit runs a git command without throwing — returns ok flag plus stdout.
// Used for read-only checks (status, log, diff --cached --name-only after a hook).
function tryGit(args: string[], cwd: string): { ok: boolean; stdout: string } {
  try {
    return {
      ok: true,
      stdout: execFileSync("git", args, {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }),
    };
  } catch {
    return { ok: false, stdout: "" };
  }
}

// ---------- preflight ----------

interface DraftBlock {
  title: string;
  body: string;
}

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
    json = null;
  }
  return { code, json };
}

// ---------- inline model invocation ----------

function lastAssistantText(messages: Array<{ role?: string; content?: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && typeof m.content === "string" && m.content.trim()) {
      return m.content.trim();
    }
  }
  return "";
}

function resolveModel(override?: string): Model<any> | undefined {
  if (override) {
    const slash = override.indexOf("/");
    if (slash > 0 && slash < override.length - 1) {
      const m = getModel(override.slice(0, slash) as never, override.slice(slash + 1) as never);
      if (m) return m as Model<any>;
    }
  }
  return undefined;
}

async function runModelSession(
  cwd: string,
  tools: string[],
  prompt: string,
  modelOverride?: string,
  timeoutMs = 60_000,
): Promise<string> {
  const created = await createAgentSession({
    cwd,
    model: resolveModel(modelOverride),
    thinkingLevel: "off",
    tools,
    sessionManager: SessionManager.inMemory(cwd),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 2 },
    }),
  });
  const session = created.session;
  const timer = setTimeout(() => {
    void session.abort();
  }, timeoutMs);
  try {
    await session.prompt(prompt);
    return lastAssistantText(session.messages as Array<{ role?: string; content?: string }>);
  } finally {
    clearTimeout(timer);
    session.dispose();
  }
}

// ---------- draft I/O ----------

function draftPathFor(subjectFolder: string | null): string {
  return subjectFolder ? join(subjectFolder, "draft-commit.md") : ".context/draft-commit.md";
}

// Write a fallback draft-commit.md so the user can re-run /b-commit-improved
// (or /b-commit) once a model is available.
export function fallbackDraft(
  cwd: string,
  subjectFolder: string | null,
  diff: string,
  stagedFiles: string[],
  extraContext: string,
  reason: string,
): string {
  const relPath = draftPathFor(subjectFolder);
  const path = join(cwd, relPath);
  const ctx = extraContext.trim() || "(none)";
  const files = stagedFiles.length ? stagedFiles.join("\n") : "(none)";
  const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) + "\n... (truncated)" : diff;
  const body = [
    "<!--",
    `Auto-generated by b-commit-improved on ${new Date().toISOString()}.`,
    `Reason: ${reason}`,
    "",
    "Re-run this skill to commit:",
    "  /b-commit-improved",
    "  (or /b-commit)",
    "-->",
    "",
    "## Title",
    "",
    "feat: <short summary>",
    "",
    "## Body",
    "",
    "### User context",
    ctx,
    "",
    "### Staged files",
    "```",
    files,
    "```",
    "",
    "### Staged diff (truncated)",
    "```diff",
    truncatedDiff,
    "```",
    "",
  ].join("\n");
  writeFileSync(path, body, "utf-8");
  return relPath;
}

// Persist a successful model-drafted message as a draft-commit.md (used by
// --dry-run so the user has an artifact they can re-run against).
function writeDraft(cwd: string, subjectFolder: string | null, title: string, body: string): string {
  const relPath = draftPathFor(subjectFolder);
  writeFileSync(join(cwd, relPath), `## Title\n\n${title}\n\n## Body\n\n${body}\n`, "utf-8");
  return relPath;
}

// Best-effort draft deletion. Tolerate ENOENT (race with another process).
function deleteDraft(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // already gone
  }
}

// ---------- args ----------

interface Options {
  force: boolean;
  noDraft: boolean;
  dryRun: boolean;
  model?: string;
  extraContext: string;
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
  const consumed = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "--force" || tokens[i] === "--no-draft" || tokens[i] === "--dry-run") {
      consumed.add(i);
    } else if (tokens[i] === "--model") {
      consumed.add(i);
      if (i + 1 < tokens.length) consumed.add(i + 1);
    }
  }
  const extraContext = tokens.filter((_, i) => !consumed.has(i)).join(" ").trim();
  return {
    force: tokens.includes("--force"),
    noDraft: tokens.includes("--no-draft"),
    dryRun: tokens.includes("--dry-run"),
    model: get("--model"),
    extraContext,
  };
}

// ---------- model: draft commit message ----------

function buildPrompt(
  cwd: string,
  diff: string,
  stagedFiles: string[],
  currentBranch: string,
  extraContext: string,
): string {
  const repoName = cwd.split("/").pop() || "repo";
  const files = stagedFiles.length ? stagedFiles.join("\n") : "(none)";
  const userCtx = extraContext.trim() || "(none)";
  const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) + "\n... (truncated)" : diff;
  return (
    `You are drafting a Conventional Commits commit message for the staged changes below.\n\n` +
    `Repository: ${repoName}\n` +
    `Current branch: ${currentBranch}\n` +
    `Extra context from the user: ${userCtx}\n\n` +
    `Staged files:\n${files}\n\n` +
    `Staged diff (truncated to 8000 chars):\n${truncatedDiff}\n\n` +
    `Return a JSON object with EXACTLY two string fields, no markdown fencing:\n` +
    `{"title":"<type>(<scope>): <short summary <=72 chars>","body":"<1-3 line body about WHY, not what>"}\n\n` +
    `Rules:\n` +
    `- Title format: <type>(<optional-scope>): <summary>\n` +
    `- Type ∈ {feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert}\n` +
    `- If breaking, include \`BREAKING CHANGE: <note>\` in body\n` +
    `- Do NOT include the literal strings \`$TITLE\` or \`$BODY\`\n` +
    `- Body is optional — empty string is fine for trivial changes\n`
  );
}

function parseModelResponse(raw: string): DraftBlock | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Strip ```json fences if the model wrapped its output anyway.
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  // Find the first {...} object on the page (model may have led/trailed with prose).
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;
  const candidate = stripped.slice(firstBrace, lastBrace + 1);
  try {
    const obj = JSON.parse(candidate) as { title?: unknown; body?: unknown };
    if (typeof obj.title !== "string" || typeof obj.body !== "string") return null;
    const title = obj.title.trim();
    if (!title) return null;
    return { title, body: obj.body.trim() };
  } catch {
    return null;
  }
}

async function draftFromModel(
  cwd: string,
  diff: string,
  stagedFiles: string[],
  currentBranch: string,
  extraContext: string,
  modelOverride: string | undefined,
  dryRun: boolean,
  subjectFolder: string | null,
): Promise<DraftBlock | null> {
  const prompt = buildPrompt(cwd, diff, stagedFiles, currentBranch, extraContext);
  let raw = "";
  try {
    raw = await runModelSession(cwd, ["read"], prompt, modelOverride);
  } catch (e: unknown) {
    if (!dryRun) {
      fallbackDraft(cwd, subjectFolder, diff, stagedFiles, extraContext, `model call failed: ${(e as Error).message}`);
    }
    return null;
  }
  const parsed = parseModelResponse(raw);
  if (!parsed) {
    if (!dryRun) {
      const snippet = raw.slice(0, 200).replace(/\n/g, " ");
      fallbackDraft(cwd, subjectFolder, diff, stagedFiles, extraContext, `model returned an unparseable response (first 200 chars: ${snippet})`);
    }
    return null;
  }
  if (dryRun) {
    // --dry-run + model source → write the draft so the user can re-run.
    writeDraft(cwd, subjectFolder, parsed.title, parsed.body);
  }
  return parsed;
}

// ---------- command handler ----------

type Notify = (msg: string, level?: "info" | "warning" | "error") => void;

interface CommandUI {
  notify: Notify;
  setStatus?: (key: string, text?: string) => void;
  setWorkingMessage?: (message?: string) => void;
}

async function runBCommitImproved(
  args: string,
  ctx: { cwd: string; ui: CommandUI },
): Promise<void> {
  const cwd = ctx.cwd;
  const notify = ctx.ui.notify;
  const opts = parseArgs(args);
  const progress = createProgress(ctx, "b-commit-improved");

  try {
  // 1. Preflight
  const pfArgs: string[] = [];
  if (opts.force) pfArgs.push("--force");
  if (opts.noDraft) pfArgs.push("--no-draft");
  if (opts.dryRun) pfArgs.push("--dry-run");

  progress.step("preflight…");
  const pf = await runPreflight(pfArgs, cwd);
  if (pf.code === 2) {
    const branch = (pf.json?.current_branch as string) ?? "unknown";
    notify(`Protected branch '${branch}' — re-run with --force to commit here directly.`, "warning");
    return;
  }
  if (pf.code === 3) {
    notify("Nothing staged. Stage changes first, then re-run.", "warning");
    return;
  }
  if (pf.code !== 0 || !pf.json) {
    notify(`Preflight failed (exit ${pf.code}): ${(pf.json?.error as string) ?? "no output"}`, "warning");
    return;
  }

  const {
    current_branch: currentBranch,
    subject_folder: subjectFolder,
    draft_path: draftPath,
    draft: draftFromDisk,
    staged_files: stagedFiles,
    diff,
  } = pf.json as {
    current_branch: string;
    subject_folder: string | null;
    draft_path: string | null;
    draft: DraftBlock | null;
    staged_files: string[];
    diff: string;
  };

  // 2. Resolve {title, body}. Commit in line once we have it.
  let title = "";
  let body = "";
  let source: "draft" | "model" = "draft";

  if (draftFromDisk && draftFromDisk.title.trim() !== "" && !opts.noDraft) {
    title = draftFromDisk.title;
    body = draftFromDisk.body;
    source = "draft";
  } else {
    progress.step("Drafting commit message…");
    const drafted = await draftFromModel(
      cwd,
      diff,
      stagedFiles,
      currentBranch,
      opts.extraContext,
      opts.model,
      opts.dryRun,
      subjectFolder,
    );
    if (!drafted) {
      // In a normal run, fallbackDraft inside draftFromModel already wrote
      // a stub draft-commit.md. In --dry-run, no file is written (per
      // draftFromModel's contract), so the previous "Drafted to ${path}.
      // Re-run ... to commit" message was misleading — it claimed a draft
      // existed when it didn't. Tell the user the real story per mode.
      if (opts.dryRun) {
        notify(
          `[dry-run] No model available and no draft on disk. Re-run /b-commit-improved (or /b-commit) once a model is available to draft.`,
          "info",
        );
      } else {
        const path = draftPathFor(subjectFolder);
        notify(`Drafted to ${path}. Re-run /b-commit-improved (or /b-commit) to commit.`, "info");
      }
      return;
    }
    title = drafted.title;
    body = drafted.body;
    source = "model";
  }

  // 3. Pre-commit safety: refuse literal $TITLE / $BODY placeholders.
  if (title.includes("$TITLE") || body.includes("$TITLE") || title.includes("$BODY") || body.includes("$BODY")) {
    notify("Refusing to commit: title or body contains the literal $TITLE or $BODY placeholder. Fix the draft and re-run.", "warning");
    return;
  }

  // 4. --dry-run: preview, optionally write the draft.
  if (opts.dryRun) {
    const firstBodyLine = body.split("\n", 1)[0] ?? "";
    notify(`[dry-run] ${title} — ${firstBodyLine}`, "info");
    if (source === "model") {
      const path = writeDraft(cwd, subjectFolder, title, body);
      notify(`[dry-run] Wrote draft to ${path} (re-run without --dry-run to commit).`, "info");
    }
    return;
  }

  // 5. Commit. Hooks may have auto-staged files — retry once on failure if so.
  progress.step("Committing…");
  const commitArgs = body ? ["commit", "-m", title, "-m", body] : ["commit", "-m", title];
  try {
    execGit(commitArgs, cwd);
  } catch (e: unknown) {
    const msg = (e as Error).message;
    const stagedNow = tryGit(["diff", "--cached", "--name-only"], cwd);
    if (stagedNow.ok && stagedNow.stdout.trim() !== "") {
      try {
        execGit(commitArgs, cwd);
      } catch (e2: unknown) {
        notify(`git commit failed (after hook auto-stage retry): ${(e2 as Error).message}`, "warning");
        return;
      }
    } else {
      notify(`git commit failed: ${msg}`, "warning");
      return;
    }
  }

  // 6. Success cleanup: delete the draft and amend the deletion into the commit.
  if (draftPath && existsSync(draftPath)) {
    deleteDraft(draftPath);
    try {
      execGit(["add", "--", draftPath], cwd);
    } catch {
      // Race: another process deleted it first. Commit is fine without the amend.
    }
    try {
      execGit(["commit", "--amend", "--no-edit"], cwd, { GIT_EDITOR: "true" });
    } catch {
      // Same race — commit stands as-is.
    }
  }

  // 7. Verify
  const verifyRaw = tryGit(["log", "-1", "--format=%B"], cwd);
  const message = verifyRaw.ok ? verifyRaw.stdout.trim() : "";
  if (/\$TITLE|\$BODY/.test(message)) {
    // Paranoid: should never trigger given step 3, but mirror the existing skill.
    try {
      execGit(["commit", "--amend", "-m", title, "-m", body], cwd, { GIT_EDITOR: "true" });
      notify("⚠️ commit message contained a $TITLE/$BODY placeholder; amended with explicit values.", "warning");
    } catch (e: unknown) {
      notify(`verify-pass amend failed: ${(e as Error).message}`, "warning");
    }
  }

  // 8. Final output
  notify(`✅ ${title}${body ? "\n" + body : ""}`, "info");
  const status = tryGit(["status", "-sb"], cwd);
  if (status.ok) notify(status.stdout.trimEnd(), "info");
  const log = tryGit(["log", "-1", "--oneline"], cwd);
  if (log.ok) notify(log.stdout.trimEnd(), "info");
  } finally {
    progress.clear();
  }
}

// ---------- wiring ----------

export function wire(pi: ExtensionAPI): void {
  pi.registerCommand("b-commit-improved", {
    description: "Deterministic Conventional Commit: read draft or draft via model, commit, clean up draft, verify",
    getArgumentCompletions(prefix: string) {
      return ["--force", "--no-draft", "--dry-run", "--model"]
        .filter((o) => o.startsWith(prefix))
        .map((o) => ({ value: o, label: o }));
    },
    handler: async (args: string, ctx: { cwd: string; ui: CommandUI }) => {
      await runBCommitImproved(args, ctx);
    },
  });
}
