/**
 * b-kamal-release Extension
 *
 * Tag a release and deploy it with Kamal — a single deterministic command.
 *
 * The whole flow is orchestrated in code (not agent-interpreted prose):
 *   1. Pre-checks: git repo, kamal on PATH, config/deploy.yml present.
 *   2. Detect configured Kamal environments (destinations = config/deploy.<name>.yml).
 *   3. Warn on uncommitted changes and confirm via ctx.ui.confirm (deterministic
 *      --allow-dirty bypass for headless runs).
 *   4. Derive the next version: conventional-commits heuristic picks a default
 *      patch/minor/major bump, then ctx.ui.select lets the user confirm or override.
 *   5. git tag -a + push the tag.
 *   6. kamal deploy [-d <destination>] [--version=<tag>] (async, non-blocking).
 *
 * Interactive prompts gate on ctx.hasUI; without a UI the command requires explicit
 * flags (--tag/--bump/--destination/--allow-dirty) so it stays deterministic in RPC /
 * print mode. Pure helpers are exported for unit testing.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { once } from "node:events";

// ---------- exec helpers ----------

function execText(bin: string, args: string[], cwd: string): string {
  try {
    return execFileSync(bin, args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer };
    throw new Error(
      `${bin} ${args.join(" ")} failed: ${err.stderr?.toString().trim() || err.message}`,
    );
  }
}

function execGit(args: string[], cwd: string): string {
  return execText("git", args, cwd);
}

function hasBin(bin: string): boolean {
  try {
    execFileSync(bin, ["--version"], { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

// ---------- kamal environment detection ----------

/** Directory Kamal reads config from (cwd-relative). */
const KAMAL_CONFIG_DIR = "config";
const KAMAL_CONFIG_FILE = "deploy.yml";

export interface KamalEnv {
  /** true when config/deploy.yml exists. */
  configured: boolean;
  /** Detected destination names from config/deploy.<name>.yml files (sorted). */
  destinations: string[];
}

export function detectKamalEnv(cwd: string): KamalEnv {
  const configDir = join(cwd, KAMAL_CONFIG_DIR);
  const configured = existsSync(join(configDir, KAMAL_CONFIG_FILE)) ||
    existsSync(join(configDir, "deploy.yaml"));
  const destinations: string[] = [];
  if (existsSync(configDir)) {
    for (const entry of readdirSync(configDir)) {
      // deploy.<name>.yml or deploy.<name>.yaml → destination <name>
      const m = entry.match(/^deploy\.(.+)\.ya?ml$/);
      if (m && m[1]) destinations.push(m[1]);
    }
  }
  return { configured, destinations: destinations.sort() };
}

// ---------- git state ----------

export function isDirty(cwd: string): boolean {
  return execGit(["status", "--porcelain"], cwd).trim().length > 0;
}

export function dirtySummary(cwd: string, maxFiles = 8): { count: number; sample: string[] } {
  const lines = execGit(["status", "--porcelain"], cwd)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return { count: lines.length, sample: lines.slice(0, maxFiles) };
}

/** Latest reachable tag, or null when none exist. */
export function latestTag(cwd: string): string | null {
  try {
    const out = execGit(["describe", "--tags", "--abbrev=0"], cwd).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Commit subjects since `since` (exclusive), oldest first. */
export function commitsSince(since: string | null, cwd: string): string[] {
  const range = since ? `${since}..HEAD` : "HEAD";
  try {
    return execGit(["log", range, "--format=%s"], cwd)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function tagExists(tag: string, cwd: string): boolean {
  try {
    execGit(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], cwd);
    return true;
  } catch {
    return false;
  }
}

// ---------- semver ----------

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)/;

/** Parse the leading major.minor.patch from a tag like "v1.2.3-rc.1" or "1.2.4". */
export function parseSemver(tag: string): Semver | null {
  const m = tag.match(SEMVER_RE);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

export type Bump = "major" | "minor" | "patch";

export function bumpSemver(base: Semver, bump: Bump): Semver {
  switch (bump) {
    case "major":
      return { major: base.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: base.major, minor: base.minor + 1, patch: 0 };
    case "patch":
      return { major: base.major, minor: base.minor, patch: base.patch + 1 };
  }
}

export function formatSemver(v: Semver, prefix: string): string {
  return `${prefix}${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Conventional-commits bump heuristic over commit subjects since the last tag.
 *   BREAKING CHANGE / `<type>!:` → major
 *   feat:                            → minor
 *   everything else                  → patch
 * First release (no subjects) defaults to minor (0.1.0).
 */
export function detectDefaultBump(subjects: string[]): Bump {
  if (subjects.length === 0) return "minor";
  if (subjects.some((s) => /BREAKING[ -]CHANGE/i.test(s) || /\w+\([^)]*\)!:/.test(s) || /^[a-z]+!:/i.test(s))) {
    return "major";
  }
  if (subjects.some((s) => /^feat(\([^)]*\))?:/i.test(s))) {
    return "minor";
  }
  return "patch";
}

export interface VersionProposal {
  tag: string;
  bump: Bump;
  prefix: string;
  patch: string;
  minor: string;
  major: string;
  latest: string | null;
}

/**
 * Build the version proposal shown to the user. `latestTag` is the raw git tag (or
 * null for the first release). `bump` overrides the detected default when provided.
 */
export function proposeVersion(latestTag: string | null, subjects: string[], bump?: Bump): VersionProposal {
  const detected = detectDefaultBump(subjects);
  const chosen = bump ?? detected;
  const prefix = latestTag && latestTag.startsWith("v") ? "v" : "";
  const base = latestTag ? parseSemver(latestTag) : null;
  const semverBase = base ?? { major: 0, minor: 0, patch: 0 };
  const tag = formatSemver(bumpSemver(semverBase, chosen), prefix);
  return {
    tag,
    bump: chosen,
    prefix,
    patch: formatSemver(bumpSemver(semverBase, "patch"), prefix),
    minor: formatSemver(bumpSemver(semverBase, "minor"), prefix),
    major: formatSemver(bumpSemver(semverBase, "major"), prefix),
    latest: latestTag,
  };
}

// ---------- args ----------

export interface Options {
  tag?: string;
  bump?: Bump;
  destination?: string;
  allowDirty: boolean;
  skipTag: boolean;
  noPush: boolean;
  noVersion: boolean;
  force: boolean;
  dryRun: boolean;
}

export function parseArgs(args: string): Options {
  const tokens = args.split(/\s+/).filter(Boolean);
  const get = (flag: string): string | undefined => {
    const i = tokens.indexOf(flag);
    return i !== -1 ? tokens[i + 1] : undefined;
  };
  const bump = get("--bump") as Bump | undefined;
  return {
    tag: get("--tag"),
    bump: bump && ["major", "minor", "patch"].includes(bump) ? bump : undefined,
    destination: get("--destination") ?? get("-d"),
    allowDirty: tokens.includes("--allow-dirty"),
    skipTag: tokens.includes("--skip-tag"),
    noPush: tokens.includes("--no-push"),
    noVersion: tokens.includes("--no-version"),
    force: tokens.includes("--force"),
    dryRun: tokens.includes("--dry-run"),
  };
}

// ---------- context shape ----------

interface UI {
  notify: (message: string, level?: "info" | "warning" | "error") => void;
  setWorkingMessage?: (message?: string) => void;
  confirm?: (title: string, message: string) => Promise<boolean>;
  select?: (title: string, options: string[]) => Promise<string | undefined>;
  input?: (title: string, placeholder?: string) => Promise<string | undefined>;
}

interface CommandContext {
  cwd: string;
  hasUI: boolean;
  ui: UI;
}

type Notify = UI["notify"];

// ---------- interactive prompts (deterministic when headless) ----------

async function resolveVersion(opts: Options, proposal: VersionProposal, ctx: CommandContext): Promise<string | null> {
  // Explicit flag wins, no prompt.
  if (opts.tag) return proposal.prefix + opts.tag.replace(/^v/, "");
  if (opts.bump) return formatSemver(bumpSemver(parseSemver(proposal.latest ?? "0.0.0") ?? { major: 0, minor: 0, patch: 0 }, opts.bump), proposal.prefix);

  // Headless: fall back to the detected default so the command is still runnable.
  if (!ctx.hasUI || !ctx.ui.select) return proposal.tag;

  const order: Bump[] = ["patch", "minor", "major"];
  const labels: Record<Bump, string> = { patch: proposal.patch, minor: proposal.minor, major: proposal.major };
  const options = order.map((b) => `${labels[b]}  (${b}${b === proposal.bump ? " · recommended" : ""})`);
  options.push("Custom…");
  const choice = await ctx.ui.select("Release version", options);
  if (choice === undefined) return null; // cancelled
  if (choice === "Custom…") {
    if (!ctx.ui.input) return proposal.tag;
    const entered = await ctx.ui.input("Custom version", proposal.tag);
    if (!entered || !entered.trim()) return null;
    return proposal.prefix + entered.trim().replace(/^v/, "");
  }
  return choice.split("  (")[0].trim();
}

async function confirmDirty(summary: { count: number; sample: string[] }, ctx: CommandContext): Promise<boolean> {
  if (ctx.hasUI && ctx.ui.confirm) {
    const lines = summary.sample.map((l) => `  ${l}`).join("\n");
    const more = summary.count > summary.sample.length ? `\n  …and ${summary.count - summary.sample.length} more` : "";
    return ctx.ui.confirm(
      "Uncommitted changes",
      `${summary.count} uncommitted change(s) in the working tree:\n${lines}${more}\n\nTag and deploy anyway?`,
    );
  }
  // Headless: never auto-confirm a dirty tree.
  return false;
}

async function resolveDestination(destinations: string[], opts: Options, ctx: CommandContext): Promise<string | null> {
  if (opts.destination) return opts.destination;
  if (destinations.length === 0) return null; // single environment, no -d needed
  if (destinations.length === 1) return destinations[0];
  if (!ctx.hasUI || !ctx.ui.select) return null; // ambiguous headless → caller errors
  // Prefer a "production" default, else the first.
  const preferred = destinations.find((d) => /prod/i.test(d)) ?? destinations[0];
  const ordered = [preferred, ...destinations.filter((d) => d !== preferred)];
  const choice = await ctx.ui.select("Kamal destination", ordered);
  return choice ?? null;
}

// ---------- deploy ----------

async function runKamal(args: string[], cwd: string, notify: Notify): Promise<{ code: number; output: string }> {
  notify(`$ kamal ${args.join(" ")}`, "info");
  const child = spawn("kamal", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const append = (chunk: Buffer): void => {
    output += chunk.toString();
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("error", (err) => {
    output += `\nspawn error: ${err.message}`;
  });
  const [code] = await once(child, "close");
  return { code: (code as number) ?? 0, output };
}

// ---------- orchestrator ----------

export async function runKamalRelease(args: string, ctx: CommandContext): Promise<void> {
  const cwd = ctx.cwd;
  const notify = ctx.ui.notify;
  const opts = parseArgs(args);

  // 1. Pre-checks.
  try {
    execGit(["rev-parse", "--is-inside-work-tree"], cwd);
  } catch {
    notify("Not a git repository. Run from the project root.", "error");
    return;
  }
  if (!hasBin("kamal")) {
    notify("kamal is not installed or not on PATH. Install with `gem install kamal`.", "error");
    return;
  }
  const env = detectKamalEnv(cwd);
  if (!env.configured) {
    notify("No config/deploy.yml found — this isn't a Kamal project. Run `kamal init` first.", "error");
    return;
  }

  // 2. Destination.
  let destination = await resolveDestination(env.destinations, opts, ctx);
  if (destination === null && env.destinations.length > 1 && !opts.destination) {
    notify(
      `Multiple Kamal destinations configured (${env.destinations.join(", ")}). ` +
        "Pass --destination <name> (or run interactively to pick).",
      "error",
    );
    return;
  }
  if (destination && !env.destinations.includes(destination)) {
    notify(
      `Destination "${destination}" has no config/deploy.${destination}.yml. ` +
        `Available: ${env.destinations.join(", ") || "(none)"}.`,
      "warning",
    );
  }
  const destFlag = destination ? [`-d`, destination] : [];

  // 3. Dirty-tree gate.
  if (isDirty(cwd) && !opts.allowDirty) {
    const summary = dirtySummary(cwd);
    const ok = await confirmDirty(summary, ctx);
    if (!ok) {
      notify(`Aborted: ${summary.count} uncommitted change(s). Commit, stash, or pass --allow-dirty.`, "warning");
      return;
    }
  }

  // 4. Version.
  const latest = latestTag(cwd);
  const subjects = commitsSince(latest, cwd);
  const proposal = proposeVersion(latest, subjects, opts.bump);
  const tag = await resolveVersion(opts, proposal, ctx);
  if (!tag) {
    notify("Aborted: no release version selected.", "warning");
    return;
  }
  if (!opts.skipTag && tagExists(tag, cwd) && !opts.force) {
    notify(`Tag ${tag} already exists. Pass --force to overwrite or --tag <other>.`, "error");
    return;
  }
  const version = tag.replace(/^v/, "");

  // Build a human-readable plan for dry-run / confirmation feedback.
  const plan = [
    `tag: ${tag}${opts.skipTag ? " (skipped)" : ""}`,
    `push tag: ${opts.skipTag || opts.noPush ? "no" : "yes"}`,
    `deploy: kamal deploy${destination ? ` -d ${destination}` : ""}${opts.noVersion ? "" : ` --version=${version}`}`,
  ];
  notify(`Release plan:\n  ${plan.join("\n  ")}`, "info");

  if (opts.dryRun) {
    notify("[dry-run] No changes made.", "info");
    return;
  }

  // 5. Tag.
  if (!opts.skipTag) {
    try {
      if (opts.force) execGit(["tag", "-d", tag], cwd);
      execGit(["tag", "-a", tag, "-m", `Release ${tag}`], cwd);
      notify(`Tagged ${tag}.`, "info");
    } catch (e: unknown) {
      notify(`Failed to create tag ${tag}: ${(e as Error).message}`, "error");
      return;
    }
    if (!opts.noPush) {
      try {
        execGit(["push", "origin", `refs/tags/${tag}`], cwd);
        notify(`Pushed tag ${tag} to origin.`, "info");
      } catch (e: unknown) {
        notify(
          `Could not push tag ${tag} (${(e as Error).message}). Tagged locally; deploy will continue. Pass --no-push to silence.`,
          "warning",
        );
      }
    }
  }

  // 6. Deploy.
  ctx.ui.setWorkingMessage?.(`Deploying ${tag} via kamal…`);
  try {
    const deployArgs = ["deploy", ...destFlag];
    if (!opts.noVersion) deployArgs.push(`--version=${version}`);
    const result = await runKamal(deployArgs, cwd, notify);
    if (result.code === 0) {
      notify(`✅ Deployed ${tag}${destination ? ` → ${destination}` : ""} via kamal.`, "info");
    } else {
      const tailed = result.output.split("\n").filter((l) => l.length).slice(-20).join("\n");
      notify(`kamal deploy failed (exit ${result.code}):\n${tailed}`, "error");
    }
  } finally {
    ctx.ui.setWorkingMessage?.();
  }
}

// ---------- wiring ----------

const FLAGS = [
  "--tag",
  "--bump",
  "--destination",
  "-d",
  "--allow-dirty",
  "--skip-tag",
  "--no-push",
  "--no-version",
  "--force",
  "--dry-run",
];

export function wire(pi: ExtensionAPI): void {
  pi.registerCommand("b-kamal-release", {
    description:
      "Tag a release and deploy it with Kamal — detects destinations, warns on uncommitted changes, picks a semver bump, tags, pushes, then kamal deploy",
    getArgumentCompletions(prefix: string) {
      return FLAGS.filter((f) => f.startsWith(prefix)).map((f) => ({ value: f, label: f }));
    },
    handler: async (args: string, ctx: CommandContext) => {
      await runKamalRelease(args, ctx);
    },
  });
}
