/**
 * Plan Artifact Extension — opt-in durable persistence for OMP plan mode.
 *
 * Why this exists: OMP has NO native hook for plan-mode exit (verified against
 * the 18.0.4 hook surface: no `mode_change` event, no `plan_approved`; goal
 * mode got `goal_updated`, plan mode got nothing). This extension *infers*
 * the exit instead of reacting to a contract:
 *
 *   1. On each `turn_end`, scan `ctx.sessionManager.getEntries()` for the last
 *      `mode_change` entry with mode "none".
 *   2. Walk backwards over "none"/"plan_paused" entries; the preceding active
 *      mode must be "plan" carrying `data.planFilePath` (`local://<slug>-plan.md`).
 *   3. Skip when a `plan-artifact` marker entry already recorded this exit id
 *      (stateless dedupe — reload-safe, no in-memory state).
 *   4. Copy the plan file into the buck-workflow subject convention:
 *        .context/<YYYY-MM-DD>.<slug>/plan-<slug>.md
 *      with b-plan-style frontmatter, so /b-build subject resolution finds it.
 *
 * Timing: fires at the FIRST turn_end after the exit — i.e. once execution is
 * underway. Abort exits with no follow-up turn are naturally skipped.
 *
 * Opt-in (default OFF):
 *   project  <cwd>/.pi/settings.json or <cwd>/.omp/settings.json
 *   global   ~/.pi/agent/settings.json or ~/.omp/agent/settings.json
 *   key      { "buckPlanArtifact": { "enabled": true } }
 *   env      BUCK_PLAN_ARTIFACT=1|0 overrides all settings files.
 *
 * Failure mode: silent no-op. Never breaks the session.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { homedir } from "node:os";

const MARKER_TYPE = "plan-artifact";

/** Semi-internal entry shapes we scan (not exported by the hook API types). */
interface ModeChangeShape {
  type: "mode_change";
  id: string;
  mode: string;
  data?: { planFilePath?: string };
}

interface CustomEntryShape {
  type: "custom";
  customType?: string;
  data?: { exitId?: string; target?: string; subject?: string };
}

export interface PlanExit {
  /** Entry id of the `mode_change → "none"` exit — the dedupe key. */
  exitId: string;
  /** `local://…` path the plan-mode agent wrote the plan to. */
  planFilePath: string;
}

/**
 * Find the most recent plan→none mode transition, if any.
 * Returns null when the session never entered plan mode, when the last exit
 * was entered from a different mode (e.g. goal→none), or when the plan entry
 * carries no `data.planFilePath`.
 */
export function findPlanExit(entries: unknown[]): PlanExit | null {
  let exitIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i] as ModeChangeShape | undefined;
    if (e?.type === "mode_change" && e.mode === "none") {
      exitIdx = i;
      break;
    }
  }
  if (exitIdx < 0) return null;

  for (let i = exitIdx - 1; i >= 0; i--) {
    const e = entries[i] as ModeChangeShape | undefined;
    if (e?.type !== "mode_change") continue;
    if (e.mode === "none" || e.mode === "plan_paused") continue;
    if (e.mode !== "plan") return null; // a different mode preceded this exit
    const planFilePath = e.data?.planFilePath;
    return planFilePath ? { exitId: (entries[exitIdx] as ModeChangeShape).id, planFilePath } : null;
  }
  return null;
}

/**
 * Derive a kebab-case subject slug from the plan's `local://` URL.
 * `local://production-feedback-form-plan.md` → `production-feedback-form`;
 * `local://PLAN.md` → `plan`.
 */
export function slugFromPlanUrl(url: string): string {
  let name = url.replace(/^local:\/\//, "").replace(/\.md$/i, "");
  name = name.replace(/-plan$/i, "");
  name = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return name || "plan";
}

/**
 * Prepend b-plan-style frontmatter unless the plan already starts with a
 * frontmatter block (plans authored b-plan-style carry their own).
 */
export function withFrontmatter(
  content: string,
  meta: { date: string; subject: string; planUrl: string },
): string {
  if (content.startsWith("---")) return content;
  return (
    [
      "---",
      "status: active",
      `date: ${meta.date}`,
      `subject: ${meta.subject}`,
      "source: omp-plan-mode",
      `source_plan: ${meta.planUrl}`,
      "---",
      "",
    ].join("\n") + "\n" + content
  );
}

/** Resolve a `local://<name>` URL to its on-disk path for this session. */
function resolvePlanDiskPath(
  url: string,
  ctx: { sessionManager: { getArtifactsDir?: () => string | null; getSessionFile?: () => string | undefined } },
): string | null {
  const name = url.replace(/^local:\/\//, "");
  const artifactsDir = ctx.sessionManager.getArtifactsDir?.();
  if (artifactsDir) return join(artifactsDir, "local", name);
  // Fallback: local/ lives in a directory named after the session file stem.
  const sessionFile = ctx.sessionManager.getSessionFile?.();
  if (sessionFile) {
    return join(dirname(sessionFile), basename(sessionFile, ".jsonl"), "local", name);
  }
  return null;
}

/**
 * Enabled check. First file that defines the key wins (project over global,
 * .pi over .omp at the same scope). Env BUCK_PLAN_ARTIFACT overrides all.
 */
export function isPlanArtifactEnabled(cwd: string): boolean {
  const env = process.env.BUCK_PLAN_ARTIFACT;
  if (env === "1" || env === "true") return true;
  if (env === "0" || env === "false") return false;

  const candidates = [
    join(cwd, ".pi", "settings.json"),
    join(cwd, ".omp", "settings.json"),
    join(homedir(), ".pi", "agent", "settings.json"),
    join(homedir(), ".omp", "agent", "settings.json"),
  ];
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const raw = JSON.parse(readFileSync(p, "utf8"));
      if (raw && typeof raw === "object" && "buckPlanArtifact" in raw) {
        return raw.buckPlanArtifact?.enabled === true;
      }
    } catch {
      // unreadable/invalid settings file — try the next candidate
    }
  }
  return false;
}

export function wire(pi: ExtensionAPI): void {
  pi.on("turn_end", async (_event, ctx) => {
    try {
      const entries: unknown[] = ctx.sessionManager.getEntries();
      const exit = findPlanExit(entries);
      if (!exit) return;
      const already = entries.some((e) => {
        const c = e as CustomEntryShape | undefined;
        return c?.type === "custom" && c?.customType === MARKER_TYPE && c?.data?.exitId === exit.exitId;
      });
      if (already) return; // dedupe: marker entry already recorded this exit
      if (!isPlanArtifactEnabled(ctx.cwd)) return;

      const planAbs = resolvePlanDiskPath(exit.planFilePath, ctx);
      if (!planAbs) return;

      let content: string;
      try {
        content = readFileSync(planAbs, "utf8");
      } catch {
        return; // plan file missing on disk — nothing to persist
      }
      if (!content.trim()) return;

      const date = new Date().toISOString().slice(0, 10);
      const slug = slugFromPlanUrl(exit.planFilePath);
      const subject = `${date}.${slug}`;
      const subjectDir = join(ctx.cwd, ".context", subject);
      mkdirSync(subjectDir, { recursive: true });
      const target = join(subjectDir, `plan-${slug}.md`);
      writeFileSync(target, withFrontmatter(content, { date, subject, planUrl: exit.planFilePath }));

      // Create index.md for buck-workflow subject resolution
      const indexPath = join(subjectDir, "index.md");
      if (!existsSync(indexPath)) {
        const indexContent = [
          "---",
          "status: active",
          `date: ${date}`,
          `subject: ${subject}`,
          `title: Plan from OMP plan mode`,
          "---",
          "",
          `# ${slug}`,
          "",
          "Persisted from OMP plan mode.",
          "",
          `- [plan-${slug}.md](plan-${slug}.md) — \`active\``,
          "",
        ].join("\n");
        writeFileSync(indexPath, indexContent);
      }

      pi.appendEntry(MARKER_TYPE, { exitId: exit.exitId, target, subject });
      if (ctx.hasUI) {
        ctx.ui.notify(`plan-artifact: ${relative(ctx.cwd, target)}`, "info");
      }
    } catch {
      // never break the session on persistence failures
    }
  });
}

export default wire;
