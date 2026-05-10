import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  BuckState,
  TransitionContext,
  ArtifactRef,
  BuckMachineEvent,
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

async function readGitContext(
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

function readWorkerContext(
  contextDir: string,
  _subject: string | null,
): TransitionContext["worker"] {
  // For MVP: worker activity is tracked in projection, not independently polled
  return { active: false };
}
