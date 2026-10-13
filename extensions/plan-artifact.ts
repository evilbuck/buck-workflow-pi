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
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { executeWorkflowState, resolveTrustedContext } from "../skills/_shared/scripts/workflow-state.js";

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

/** True when `candidate` is empty, `..`, outside `root`, or an absolute relative. */
function pathEscapesRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return !rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/** Resolve a `local://<name>` URL without allowing it to escape local/. */
function resolvePlanDiskPath(
  url: string,
  ctx: { sessionManager: { getArtifactsDir?: () => string | null; getSessionFile?: () => string | undefined } },
): string | null {
  if (!url.startsWith("local://")) return null;
  const name = url.slice("local://".length);
  if (!name || isAbsolute(name)) return null;

  const artifactsDir = ctx.sessionManager.getArtifactsDir?.();
  let localRoot: string | null = null;
  if (artifactsDir) {
    localRoot = join(artifactsDir, "local");
  } else {
    const sessionFile = ctx.sessionManager.getSessionFile?.();
    if (sessionFile) localRoot = join(dirname(sessionFile), basename(sessionFile, ".jsonl"), "local");
  }
  if (!localRoot) return null;

  const planPath = resolve(localRoot, name);
  if (pathEscapesRoot(localRoot, planPath)) return null;
  if (!existsSync(planPath)) return null;

  let canonicalRoot: string;
  let canonicalPlan: string;
  try {
    canonicalRoot = realpathSync(localRoot);
    canonicalPlan = realpathSync(planPath);
  } catch {
    return null;
  }
  if (pathEscapesRoot(canonicalRoot, canonicalPlan)) return null;
  return canonicalPlan;
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

interface PlanArtifactContext {
  cwd: string;
  hasUI: boolean;
  sessionManager: {
    getEntries: () => unknown[];
    getArtifactsDir?: () => string | null;
    getSessionFile?: () => string | undefined;
  };
  ui: { notify: (message: string, level: "info") => void };
}

function exitWasPersisted(entries: unknown[], exitId: string): boolean {
  return entries.some((entry) => {
    const custom = entry as CustomEntryShape | undefined;
    return custom?.type === "custom"
      && custom?.customType === MARKER_TYPE
      && custom?.data?.exitId === exitId;
  });
}

function readNonemptyPlan(path: string): string | null {
  try {
    const content = readFileSync(path, "utf8");
    return content.trim() ? content : null;
  } catch {
    return null;
  }
}
async function openSubject(cwd: string, date: string, slug: string): Promise<string> {
  const context = await resolveTrustedContext(cwd);
  const base = `${date}.${slug}`;
  for (let suffix = 1; suffix < 100; suffix += 1) {
    const subjectId = suffix === 1 ? base : `${base}-${suffix}`;
    const lifecycle = await executeWorkflowState({ cwd, context, role: "read", request: { operation: "inspect-lifecycle", subjectId } }) as { provenance?: string; effectiveState?: string; state?: string; revision?: string } | null;
    if (lifecycle?.provenance === "malformed") continue;
    if (lifecycle && lifecycle.effectiveState === "completed") continue;
    if (!lifecycle) {
      const written = await executeWorkflowState({
        cwd, context, role: "write",
        request: { operation: "write", ref: { subjectId, kind: "subject-index", logicalName: `${subjectId}/index.md` }, body: indexBody(date, subjectId, slug) },
      }) as { revision: string };
      await executeWorkflowState({ cwd, context, role: "save", request: { operation: "transition", subjectId, fromRevision: written.revision, expectedState: "missing", intent: { kind: "initialize" }, evidence: [] } });
      const draft = await executeWorkflowState({ cwd, context, role: "read", request: { operation: "inspect-lifecycle", subjectId } }) as { revision: string };
      await executeWorkflowState({ cwd, context, role: "save", request: { operation: "transition", subjectId, fromRevision: draft.revision, expectedState: "draft", intent: { kind: "activate" }, evidence: [] } });
    }
    return subjectId;
  }
  throw new Error("could not allocate a subject id");
}
function indexBody(date: string, subject: string, slug: string): string {
  return ["---", `date: ${date}`, `subject: ${subject}`, "title: Plan from OMP plan mode", "---", "", `# ${slug}`, "", "Persisted from OMP plan mode.", "", `- [plan-${slug}.md](plan-${slug}.md) — \`active\``, ""].join("\n");
}
async function persistPlanExit(pi: ExtensionAPI, ctx: PlanArtifactContext, exit: PlanExit): Promise<void> {
  const planAbs = resolvePlanDiskPath(exit.planFilePath, ctx);
  if (!planAbs) return;
  const content = readNonemptyPlan(planAbs);
  if (content === null) return;
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugFromPlanUrl(exit.planFilePath);
  const subject = await openSubject(ctx.cwd, date, slug);
  const context = await resolveTrustedContext(ctx.cwd);
  const written = await executeWorkflowState({
    cwd: ctx.cwd, context, role: "write",
    request: { operation: "write", ref: { subjectId: subject, kind: "plan", logicalName: `${subject}/plan-${slug}.md` }, body: withFrontmatter(content, { date, subject, planUrl: exit.planFilePath }) },
  }) as { token: string };
  pi.appendEntry(MARKER_TYPE, { exitId: exit.exitId, target: written.token, subject });
  if (ctx.hasUI) ctx.ui.notify(`plan-artifact: ${subject}/plan-${slug}.md`, "info");
}

export function wire(pi: ExtensionAPI): void {
  pi.on("turn_end", async (_event, ctx) => {
    try {
      const entries: unknown[] = ctx.sessionManager.getEntries();
      const exit = findPlanExit(entries);
      if (!exit) return;
      if (exitWasPersisted(entries, exit.exitId)) return;
      if (!isPlanArtifactEnabled(ctx.cwd)) return;
      await persistPlanExit(pi, ctx, exit);
    } catch {
      // never break the session on persistence failures
    }
  });
}

export default wire;
