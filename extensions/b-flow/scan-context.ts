import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type {
  BuckState,
  TransitionContext,
  ArtifactRef,
  BuckMachineEvent,
  ActiveIterateMeta,
  ActiveIterateConflict,
} from "./types.js";

interface ScanResult {
  type: "SCAN_COMPLETE" | "SCAN_FAILED";
  context?: TransitionContext;
  error?: string;
}

export async function scanContext(
  projectRoot: string,
  currentState: BuckState,
  goal: string,
  subject: string | null,
): Promise<ScanResult> {
  try {
    const contextDir = join(projectRoot, ".context");
    const ctx: TransitionContext = {
      goal,
      current: currentState,
      subject,
      artifacts: {
        backlogItems: [],
        workerResults: [],
      },
      git: {
        hasDiff: false,
        changedFiles: [],
        sourceFilesChanged: false,
        contextOnlyChanged: false,
      },
      review: {},
      worker: { active: false },
      safety: {
        loopCount: 0,
        maxLoops: 50,
        workerTasksThisRun: 0,
        maxWorkerTasksPerRun: 20,
      },
    };

      // --- Scan .context/ for artifacts ---
    if (existsSync(contextDir)) {
      // Latest plan
      ctx.artifacts.latestPlan = findLatestPlan(contextDir);
      // Phases overview
      ctx.artifacts.phasesOverview = findPhasesOverview(contextDir);
      // Active phase (first non-completed)
      ctx.artifacts.activePhase = findActivePhase(contextDir);
      // tasks.md in active subject
      if (subject) {
        ctx.artifacts.tasksMd = findTasksMd(contextDir, subject);
      }
      // Latest memory file
      ctx.artifacts.memoryFile = findLatestMemory(contextDir);
      // Backlog items
      ctx.artifacts.backlogItems = findBacklogItems(contextDir);
      // Worker results
      if (subject) {
        ctx.artifacts.workerResults = findWorkerResults(contextDir, subject);
      }
      // Active iterate scanning
      if (subject) {
        const iterateScan = scanActiveIterates(contextDir, subject);
        if (iterateScan) {
          ctx.artifacts.activeIterate = iterateScan.active;
          ctx.artifacts.activeIterateConflict = iterateScan.conflict;
        }
      }
    }

    // --- Git context ---
    ctx.git = await readGitContext(projectRoot);

    // --- Worker context ---
    ctx.worker = readWorkerContext(contextDir, subject);

    return { type: "SCAN_COMPLETE", context: ctx };
  } catch (err) {
    return {
      type: "SCAN_FAILED",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// --- Artifact scanners ---

function findLatestPlan(contextDir: string): ArtifactRef | undefined {
  const candidates: string[] = [];
  try {
    const entries = readdirSync(contextDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.match(/^\d{4}-\d{2}-\d{2}\./)) {
        const subDir = join(contextDir, entry.name);
        for (const f of readdirSync(subDir)) {
          if (f.startsWith("plan-") && !f.includes("-phases")) {
            candidates.push(join(subDir, f));
          }
        }
      }
    }
    const legacyDir = join(contextDir, "plans");
    if (existsSync(legacyDir)) {
      for (const f of readdirSync(legacyDir)) {
        if (f.startsWith("plan-")) candidates.push(join(legacyDir, f));
      }
    }
  } catch { /* ignore */ }

  if (candidates.length === 0) return undefined;
  candidates.sort().reverse();
  const path = candidates[0];
  return makeRef(path);
}

function findPhasesOverview(contextDir: string): ArtifactRef | undefined {
  const candidates: string[] = [];
  try {
    const entries = readdirSync(contextDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.match(/^\d{4}-\d{2}-\d{2}\./)) {
        const subDir = join(contextDir, entry.name);
        for (const f of readdirSync(subDir)) {
          if (f.startsWith("plan-") && f.includes("-phases")) {
            candidates.push(join(subDir, f));
          }
        }
      }
    }
  } catch { /* ignore */ }

  if (candidates.length === 0) return undefined;
  candidates.sort().reverse();
  return makeRef(candidates[0]);
}

function findActivePhase(contextDir: string): ArtifactRef | undefined {
  try {
    const overview = findPhasesOverview(contextDir);
    if (!overview) return undefined;

    const overviewDir = overview.path.substring(0, overview.path.lastIndexOf("/"));
    const files = readdirSync(overviewDir)
      .filter((f) => f.match(/^phase-\d+-.*\.md$/))
      .sort()
      .map((f) => join(overviewDir, f));

    for (const phasePath of files) {
      const content = readFileSync(phasePath, "utf-8");
      const statusMatch = content.match(/^status:\s*(\S+)/m);
      if (statusMatch && statusMatch[1] === "completed") continue;
      return makeRef(phasePath, statusMatch?.[1]);
    }
  } catch { /* ignore */ }
  return undefined;
}

function findTasksMd(
  contextDir: string,
  subject: string,
): ArtifactRef | undefined {
  const tasksPath = join(contextDir, subject, "tasks.md");
  if (!existsSync(tasksPath)) return undefined;
  return makeRef(tasksPath);
}

function findLatestMemory(contextDir: string): ArtifactRef | undefined {
  const memDir = join(contextDir, "memory");
  if (!existsSync(memDir)) return undefined;
  try {
    const files = readdirSync(memDir)
      .filter((f) => f.endsWith(".md") && f !== "index.md")
      .map((f) => join(memDir, f))
      .filter((p) => existsSync(p));
    if (files.length === 0) return undefined;
    files.sort((a, b) => {
      const sa = statSync(a);
      const sb = statSync(b);
      return sb.mtimeMs - sa.mtimeMs;
    });
    return makeRef(files[0]);
  } catch { /* ignore */ }
  return undefined;
}

function findBacklogItems(contextDir: string): ArtifactRef[] {
  const todoPath = join(contextDir, "backlog", "todo.md");
  if (!existsSync(todoPath)) return [];
  try {
    const content = readFileSync(todoPath, "utf-8");
    const items: ArtifactRef[] = [];
    const matches = content.matchAll(/\[([^\]]+)\]\(items\/([^)]+)\)/g);
    for (const match of matches) {
      const itemPath = join(contextDir, "backlog", "items", match[2]);
      items.push(makeRef(itemPath));
    }
    return items;
  } catch { /* ignore */ }
  return [];
}

function findWorkerResults(
  contextDir: string,
  subject: string,
): ArtifactRef[] {
  const resultsDir = join(contextDir, subject, "worker-results");
  if (!existsSync(resultsDir)) return [];
  try {
    return readdirSync(resultsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => makeRef(join(resultsDir, f)));
  } catch { /* ignore */ }
  return [];
}

// --- Active iterate scanning ---

function parseIterateFrontmatter(
  raw: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return result;

  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^(\w[\w_]*):\s*(.+)$/);
    if (m) result[m[1]] = m[2].trim();
  }
  return result;
}

export interface IterateScanResult {
  active?: ArtifactRef & Partial<ActiveIterateMeta>;
  conflict?: ActiveIterateConflict;
}

/**
 * Scan subject folder for iterate-*.md files. Find the active phase
 * and return at most one active iterate matching it.
 * Records conflict metadata if multiple active iterates match the active phase.
 */
function scanActiveIterates(
  contextDir: string,
  subject: string,
): IterateScanResult | null {
  const subjectDir = join(contextDir, subject);
  if (!existsSync(subjectDir)) return null;

  // Find the active phase name for matching
  const activePhasePath = findActivePhase(contextDir)?.path;
  const activePhaseName = activePhasePath
    ? basename(activePhasePath, ".md")
    : undefined;

  // Find all iterate files
  let iterateFiles: string[];
  try {
    iterateFiles = readdirSync(subjectDir)
      .filter((f) => f.match(/^iterate-.*\.md$/))
      .map((f) => join(subjectDir, f));
  } catch {
    return null;
  }

  if (iterateFiles.length === 0) return null;

  // Parse frontmatter of each iterate file
  interface ParsedIterate {
    path: string;
    status: string;
    phase: string;
    iteration: number;
    sourceReviewResult?: string;
    issueFingerprint?: string;
  }

  const parsed: ParsedIterate[] = [];

  for (const path of iterateFiles) {
    try {
      const content = readFileSync(path, "utf-8");
      const fm = parseIterateFrontmatter(content);
      const status = fm.status ?? "unknown";
      // Skip completed iterates
      if (status === "completed") continue;

      const iteration = fm.iteration ? parseInt(fm.iteration, 10) : 0;
      parsed.push({
        path,
        status,
        phase: fm.phase ?? "",
        iteration: isNaN(iteration) ? 0 : iteration,
        sourceReviewResult: fm.source_review_result ?? undefined,
        issueFingerprint: fm.issue_fingerprint ?? undefined,
      });
    } catch {
      // skip unreadable files
    }
  }

  if (parsed.length === 0) return null;

  // Filter to active status
  const activeIterates = parsed.filter((p) => p.status === "active");
  if (activeIterates.length === 0) return null;

  // Filter to those matching the active phase (if phase info is available)
  const phaseMatches = activePhaseName
    ? activeIterates.filter(
        (p) => p.phase === activePhaseName || p.phase === "",
      )
    : activeIterates;

  // Conflict: multiple active iterates match the active phase
  if (phaseMatches.length > 1) {
    return {
      active: undefined,
      conflict: {
        files: phaseMatches.map((p) => p.path),
        phase: activePhaseName ?? "unknown",
      },
    };
  }

  // Exactly one match
  if (phaseMatches.length === 1) {
    const it = phaseMatches[0];
    const ref = makeRef(it.path, it.status);
    return {
      active: {
        ...ref,
        status: it.status,
        phase: it.phase,
        iteration: it.iteration,
        sourceReviewResult: it.sourceReviewResult,
        issueFingerprint: it.issueFingerprint,
      },
    };
  }

  // No phase matches but there are active iterates → still return them as unscoped
  // to let the lifecycle actor decide
  if (activeIterates.length > 1) {
    return {
      active: undefined,
      conflict: {
        files: activeIterates.map((p) => p.path),
        phase: activePhaseName ?? "unknown",
      },
    };
  }

  if (activeIterates.length === 1) {
    const it = activeIterates[0];
    const ref = makeRef(it.path, it.status);
    return {
      active: {
        ...ref,
        status: it.status,
        phase: it.phase,
        iteration: it.iteration,
        sourceReviewResult: it.sourceReviewResult,
        issueFingerprint: it.issueFingerprint,
      },
    };
  }

  return null;
}

function makeRef(path: string, status?: string): ArtifactRef {
  const exists = existsSync(path);
  let modifiedAt: string | undefined;
  if (exists) {
    try {
      modifiedAt = statSync(path).mtime.toISOString();
    } catch { /* ignore */ }
  }
  return { path, exists, status, modifiedAt };
}

// --- Git context ---

export async function readGitContext(
  projectRoot: string,
): Promise<TransitionContext["git"]> {
  const { spawn } = await import("node:child_process");

  function run(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, { cwd: projectRoot });
      let out = "";
      const timer = setTimeout(() => {
        child.kill();
        resolve("");
      }, 10_000);
      child.stdout?.on("data", (d) => { out += d; });
      child.stderr?.on("data", () => { /* ignore */ });
      child.on("close", () => { clearTimeout(timer); resolve(out.trim()); });
      child.on("error", () => { clearTimeout(timer); resolve(""); });
    });
  }

  const diffStat = await run("git", ["diff", "--stat"]);
  const statusOut = await run("git", ["status", "--porcelain"]);

  const changedFiles = statusOut
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter(Boolean);

  const sourceFilesChanged = changedFiles.some(
    (f) => !f.startsWith(".context/") && !f.startsWith("docs/"),
  );
  const contextOnlyChanged =
    changedFiles.length > 0 &&
    changedFiles.every(
      (f) => f.startsWith(".context/") || f.startsWith("docs/"),
    );

  return {
    hasDiff: diffStat.length > 0 || statusOut.length > 0,
    changedFiles,
    sourceFilesChanged,
    contextOnlyChanged,
  };
}

// --- Worker context ---

export function scanActiveIteratesForSubject(
  projectRoot: string,
  subject: string,
): IterateScanResult | null {
  return scanActiveIterates(join(projectRoot, ".context"), subject);
}

function readWorkerContext(
  contextDir: string,
  _subject: string | null,
): TransitionContext["worker"] {
  // For MVP: worker activity is tracked in projection, not independently polled
  return { active: false };
}
