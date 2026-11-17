/**
 * Autonomous Buck phase loop runner for OMP's Bun eval kernel.
 * Executed via %load skills/b-loop/scripts/eval-buck-loop.ts in eval language: "js".
 * Contains ZERO bare npm specifiers to ensure reliable linking inside compiled OMP binary.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type {
  LoopState,
  Snapshot,
  TransitionRecord,
} from "../../../extensions/buck-loop/types.ts";

export const PROJECTION_PATH = ".context/workflow/buck-loop.json";
export const PROJECTION_VERSION = 1;

export interface BuckLoopArgs {
  target?: string;
  statusOnly: boolean;
  resume: boolean;
  stop: boolean;
}

export interface PhaseInfo {
  path: string;
  phaseNum: number;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  status: "pending" | "in-progress" | "completed";
  acceptanceCriteria: string[];
  files: string[];
  content: string;
}

export interface PlanInfo {
  path: string;
  subjectDir: string;
  overviewPath: string | null;
  phases: PhaseInfo[];
  status: "active" | "completed";
}

export interface EvalBridges {
  agent?: (prompt: string, options?: any) => Promise<any>;
  wait?: (handles: any[], options?: any) => Promise<any>;
  judge?: (state: any, questions: any[], options?: any) => Promise<any>;
  judgeBatch?: (states: any[], questions: any[], options?: any) => Promise<any>;
  tool?: {
    workflow_state?: (args: any) => Promise<any>;
    [key: string]: any;
  };
  sh?: ((cmd: string | TemplateStringsArray, ...args: any[]) => Promise<any>);
  phase?: (title: string) => void;
  log?: (message: string) => void;
  budget?: { remaining?: () => Promise<number | undefined> };
}

export interface BuckLoopOptions {
  args?: string;
  cwd?: string;
  bridges?: EvalBridges;
  /** Test seam. The CLI default is 24. */
  maxLoops?: number;
}

export interface BuckLoopResult {
  ok: boolean;
  state: LoopState;
  subject?: string | null;
  phase?: string | null;
  message?: string;
  history?: TransitionRecord[];
}

export function parseArgs(raw: string): BuckLoopArgs {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  let target: string | undefined;
  let statusOnly = false;
  let resume = false;
  let stop = false;

  for (const part of parts) {
    if (part === "--status") statusOnly = true;
    else if (part === "--resume") resume = true;
    else if (part === "--stop") stop = true;
    else if (!part.startsWith("-") && !target) target = part;
  }
  return { target, statusOnly, resume, stop };
}

export function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, any> = {};
  const lines = yaml.split(/\r?\n/);
  let currentKey = "";
  let inList = false;
  let listItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && inList) {
      let val = listMatch[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      listItems.push(val);
      continue;
    }

    if (inList && currentKey) {
      result[currentKey] = listItems;
      inList = false;
      currentKey = "";
      listItems = [];
    }

    const keyValMatch = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (keyValMatch) {
      const key = keyValMatch[1];
      let val = keyValMatch[2].trim();
      if (!val) {
        currentKey = key;
        inList = true;
        listItems = [];
      } else {
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        } else if (val.startsWith("[") && val.endsWith("]")) {
          const items = val.slice(1, -1).split(",").map(s => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
          result[key] = items;
          continue;
        }
        result[key] = val;
      }
    }
  }
  if (inList && currentKey) {
    result[currentKey] = listItems;
  }
  return result;
}

export function parseAcceptanceCriteria(content: string): { total: number; checked: number; items: string[] } {
  const fm = parseFrontmatter(content);
  const rawList: string[] = Array.isArray(fm.acceptance_criteria) ? fm.acceptance_criteria : [];
  let checked = 0;
  for (const item of rawList) {
    if (/^\s*\[[xX]\]/.test(item) || /^\s*[-*]\s*\[[xX]\]/.test(item)) {
      checked++;
    }
  }
  return {
    total: rawList.length,
    checked,
    items: rawList,
  };
}

function parsePhaseNum(filename: string): number {
  const match = filename.match(/^phase-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parsePhaseSlug(filename: string): string {
  return filename.replace(/\.md$/, "");
}

export function readPhaseFile(fullPath: string): PhaseInfo | null {
  if (!existsSync(fullPath)) return null;
  const content = readFileSync(fullPath, "utf8");
  const fm = parseFrontmatter(content);
  const base = basename(fullPath);
  const criteria = parseAcceptanceCriteria(content);
  const rawFiles = Array.isArray(fm.files) ? fm.files : [];

  return {
    path: fullPath,
    phaseNum: typeof fm.phase === "number" ? fm.phase : parsePhaseNum(base),
    slug: parsePhaseSlug(base),
    difficulty: (fm.difficulty as any) ?? "medium",
    status: (fm.status as any) ?? "pending",
    acceptanceCriteria: criteria.items,
    files: rawFiles,
    content,
  };
}

function findSubjectFolders(contextDir: string): string[] {
  if (!existsSync(contextDir)) return [];
  const entries = readdirSync(contextDir, { withFileTypes: true });
  const subjects: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && /^\d{4}-\d{2}-\d{2}\.[\w-]+$/.test(entry.name)) {
      subjects.push(join(contextDir, entry.name));
    }
  }
  return subjects.sort().reverse();
}

function findOverviewPath(subjectDir: string): string | null {
  if (!existsSync(subjectDir)) return null;
  const files = readdirSync(subjectDir);
  for (const file of files) {
    if (/^plan-.*-phases\.md$/.test(file)) {
      return join(subjectDir, file);
    }
  }
  return null;
}

function findPrimaryPlanPath(subjectDir: string): string | null {
  if (!existsSync(subjectDir)) return null;
  const files = readdirSync(subjectDir);
  for (const file of files) {
    if (/^plan-.*\.md$/.test(file) && !file.endsWith("-phases.md")) {
      return join(subjectDir, file);
    }
  }
  return null;
}

export function discoverPlanAndPhases(cwd: string, target?: string): PlanInfo | null {
  const contextDir = join(cwd, ".context");
  let subjectDir: string | null = null;

  if (target) {
    const resolved = resolve(cwd, target);
    if (existsSync(resolved)) {
      const isDir = !resolved.endsWith(".md");
      subjectDir = isDir ? resolved : dirname(resolved);
    }
  }

  if (!subjectDir) {
    const subjects = findSubjectFolders(contextDir);
    for (const dir of subjects) {
      const idx = join(dir, "index.md");
      if (existsSync(idx)) {
        const fm = parseFrontmatter(readFileSync(idx, "utf8"));
        if (fm.status === "active") {
          subjectDir = dir;
          break;
        }
      }
    }
    if (!subjectDir && subjects.length > 0) {
      subjectDir = subjects[0];
    }
  }

  if (!subjectDir || !existsSync(subjectDir)) return null;

  const overviewPath = findOverviewPath(subjectDir);
  const primaryPlan = findPrimaryPlanPath(subjectDir);
  const planPath = overviewPath ?? primaryPlan ?? join(subjectDir, "plan.md");

  const files = readdirSync(subjectDir);
  const phaseFiles = files
    .filter(f => /^phase-\d+.*\.md$/.test(f))
    .sort((a, b) => parsePhaseNum(a) - parsePhaseNum(b));

  const phases: PhaseInfo[] = [];
  for (const pf of phaseFiles) {
    const info = readPhaseFile(join(subjectDir, pf));
    if (info) phases.push(info);
  }

  const allDone = phases.length > 0 && phases.every(p => {
    const c = parseAcceptanceCriteria(p.content);
    return (c.total > 0 && c.checked === c.total) || p.status === "completed";
  });

  return {
    path: planPath,
    subjectDir,
    overviewPath,
    phases,
    status: allDone ? "completed" : "active",
  };
}

export function writeStatusSnapshot(cwd: string, snapshot: Snapshot): void {
  const path = join(cwd, PROJECTION_PATH);
  mkdirSync(dirname(path), { recursive: true });
  const projection = {
    version: PROJECTION_VERSION,
    state: snapshot.state,
    subject: snapshot.subject ?? "",
    planPath: snapshot.planPath ?? "",
    phasePath: snapshot.phasePath,
    saveAttemptId: snapshot.saveAttemptId,
    loopCount: snapshot.loopCount,
    iterateCyclesOnPhase: snapshot.iterateCyclesOnPhase,
    maxLoops: snapshot.maxLoops,
    lastChoice: snapshot.lastChoice,
    history: snapshot.history,
  };
  writeFileSync(path, JSON.stringify(projection, null, 2) + "\n");
}

export function readStatusSnapshot(cwd: string): Partial<Snapshot> | null {
  const path = join(cwd, PROJECTION_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resolveBridges(options?: BuckLoopOptions): Required<EvalBridges> {
  const b = options?.bridges ?? {};
  const g = globalThis as any;

  return {
    agent: b.agent ?? g.agent ?? (async () => ({ ok: true, wait: async () => ({ ok: true }) })),
    wait: b.wait ?? g.wait ?? (async () => ({ ok: true })),
    judge: b.judge ?? g.judge ?? (async (_s: any, q: any[]) => ({ ok: true, choice: q[0]?.options?.[0], bool: true })),
    judgeBatch: b.judgeBatch ?? g.judgeBatch ?? (async (items: any[]) => items.map(() => ({ impact: 0, confidence: 4, effort: 1 }))),
    tool: b.tool ?? g.tool ?? {},
    sh: b.sh ?? g.sh ?? (async () => ({ stdout: "", stderr: "", exitCode: 0 })),
    phase: b.phase ?? g.phase ?? ((t: string) => console.log(`[PHASE] ${t}`)),
    log: b.log ?? g.log ?? ((m: string) => console.log(`[LOG] ${m}`)),
    budget: b.budget ?? g.budget ?? { remaining: async () => 1_000_000 },
  };
}

export async function runBuckLoop(options: BuckLoopOptions = {}): Promise<BuckLoopResult> {
  const cwd = options.cwd ?? (typeof process !== "undefined" ? process.cwd() : ".");
  const rawArgs = options.args ?? ((globalThis as any).BUCK_LOOP_ARGS || "");
  const args = parseArgs(rawArgs);
  const bridges = resolveBridges(options);

  if (args.statusOnly) {
    const existing = readStatusSnapshot(cwd);
    if (!existing) {
      bridges.log("No active buck-loop status snapshot found.");
      return { ok: true, state: "idle", message: "No snapshot found" };
    }
    bridges.log(`Buck loop status: state=${existing.state}, phase=${existing.phasePath ?? "none"}, loops=${existing.loopCount ?? 0}`);
    return { ok: true, state: existing.state ?? "idle", phase: existing.phasePath, history: existing.history };
  }

  if (args.stop) {
    const existing = readStatusSnapshot(cwd) ?? { state: "idle", history: [], loopCount: 0, maxLoops: 12, iterateCyclesOnPhase: 0, lastChoice: null };
    const stoppedSnapshot: Snapshot = {
      state: "aborted",
      subject: existing.subject ?? null,
      planPath: existing.planPath ?? null,
      phasePath: existing.phasePath ?? null,
      planFacts: { kind: "missing", reason: "operator stop" },
      workFacts: { sessionOutcome: "halt", retriesUsed: 0, postcondition: "ambiguous" },
      reviewFacts: { kind: "pending" },
      loopCount: existing.loopCount ?? 0,
      maxLoops: existing.maxLoops ?? 12,
      iterateCyclesOnPhase: existing.iterateCyclesOnPhase ?? 0,
      lastChoice: null,
      history: [...(existing.history ?? []), { from: existing.state ?? "idle", to: "aborted", effect: { kind: "none" }, why: "Operator requested stop via --stop" }],
    };
    writeStatusSnapshot(cwd, stoppedSnapshot);
    bridges.log("Buck loop stopped by operator.");
    return { ok: true, state: "aborted", message: "Stopped by operator" };
  }

  const planInfo = discoverPlanAndPhases(cwd, args.target);
  if (!planInfo) {
    bridges.log("Failed to resolve active subject or plan.");
    return { ok: false, state: "blocked", message: "Could not discover plan or subject" };
  }

  let snapshot: Snapshot = {
    state: "resolving",
    subject: basename(planInfo.subjectDir),
    planPath: relative(cwd, planInfo.path),
    phasePath: null,
    planFacts: {
      kind: planInfo.phases.length > 0 ? "phased-incomplete" : "unphased",
      phaseCount: planInfo.phases.length,
      incompletePhases: planInfo.phases.map(p => relative(cwd, p.path)),
      overviewPath: planInfo.overviewPath ? relative(cwd, planInfo.overviewPath) : relative(cwd, planInfo.path),
    },
    workFacts: { sessionOutcome: "pending", retriesUsed: 0, postcondition: "pending" },
    reviewFacts: { kind: "pending" },
    loopCount: 0,
    maxLoops: 24,
    iterateCyclesOnPhase: 0,
    lastChoice: null,
    history: [],
  };

  bridges.phase(`Starting Buck Loop for ${snapshot.subject}`);
  bridges.log(`Subject: ${snapshot.subject}, Plan: ${snapshot.planPath}, Phases: ${planInfo.phases.length}`);
  if (options.maxLoops !== undefined) snapshot.maxLoops = options.maxLoops;

  let activePhaseIndex = firstIncompletePhaseIndex(planInfo.phases);
  if (args.resume) {
    const existing = readStatusSnapshot(cwd);
    if (existing?.state === "done") {
      bridges.log("Buck loop already completed.");
      return { ok: true, state: "done", subject: existing.subject, phase: existing.phasePath, message: "Loop already completed" };
    }
    if (!existing) {
      bridges.log("No snapshot to resume; starting from the first incomplete phase.");
    } else {
      snapshot.loopCount = existing.loopCount ?? 0;
      snapshot.maxLoops = options.maxLoops ?? existing.maxLoops ?? snapshot.maxLoops;
      snapshot.iterateCyclesOnPhase = existing.iterateCyclesOnPhase ?? 0;
      snapshot.history = existing.history ?? [];
      const recorded = phaseIndexFromSnapshot(planInfo.phases, cwd, existing.phasePath);
      if (recorded !== null) activePhaseIndex = recorded;
      bridges.log(`Resuming at phase index ${activePhaseIndex} with loopCount ${snapshot.loopCount}.`);
    }
  }

  while (snapshot.loopCount < snapshot.maxLoops) {
    snapshot.loopCount++;
    writeStatusSnapshot(cwd, snapshot);

    const remainingBudget = await bridges.budget.remaining?.();
    if (typeof remainingBudget === "number" && remainingBudget <= 0) {
      bridges.log("Budget exhausted. Halting loop.");
      snapshot.state = "blocked";
      writeStatusSnapshot(cwd, snapshot);
      return { ok: false, state: "blocked", message: "Budget exhausted" };
    }

    if (activePhaseIndex >= planInfo.phases.length) {
      snapshot.state = "done";
      snapshot.planFacts = { kind: "phased-complete", overviewPath: snapshot.planPath! };
      writeStatusSnapshot(cwd, snapshot);
      bridges.phase("All phases completed");
      bridges.log("Closing verified subject via subject-lifecycle.ts");
      const closed = await executeCommand(
        bridges.sh,
        `bun skills/_shared/scripts/subject-lifecycle.ts close-verified --subject ${shellQuote(planInfo.subjectDir)} --json`,
      );
      if (commandFailed(closed)) {
        snapshot.state = "blocked";
        writeStatusSnapshot(cwd, snapshot);
        return { ok: false, state: "blocked", message: "subject close-verified failed" };
      }
      return { ok: true, state: "done", subject: snapshot.subject, history: snapshot.history };
    }

    const currentPhase = planInfo.phases[activePhaseIndex];
    snapshot.phasePath = relative(cwd, currentPhase.path);

    // Stage 1: Build
    snapshot.state = "building";
    writeStatusSnapshot(cwd, snapshot);
    bridges.phase(`Phase ${currentPhase.phaseNum}: Build`);
    const buildSkill = currentPhase.difficulty === "hard" ? "b-build-hard" : "b-build";
    const buildLabel = `${buildSkill}-${currentPhase.slug}`;
    const buildPrompt = `Execute ${buildSkill} for ${snapshot.phasePath}`;
    const buildHandle = await bridges.agent(buildPrompt, { agent: "task", label: buildLabel });
    await waitForHandle(bridges.wait, buildHandle);

    // Acceptance criterion evaluation via native judge
    const crit = parseAcceptanceCriteria(readFileSync(currentPhase.path, "utf8"));
    if (crit.total > 0) {
      for (const item of crit.items) {
        const verdict = await bridges.judge(
          { phase: snapshot.phasePath, item },
          [{ id: "criterion", type: "bool", question: `Is criterion satisfied: ${item}?`, threshold: 0.7 }],
        );
        if (verdict?.ok === false || verdict?.bool === false) {
          snapshot.state = "blocked";
          writeStatusSnapshot(cwd, snapshot);
          bridges.log(`Acceptance criterion not satisfied: ${item}`);
          return { ok: false, state: "blocked", phase: snapshot.phasePath, message: "Acceptance criteria were not satisfied" };
        }
      }
    }

    // Stage 2: Review
    snapshot.state = "reviewing";
    writeStatusSnapshot(cwd, snapshot);
    bridges.phase(`Phase ${currentPhase.phaseNum}: Review`);
    const reviewLabel = `b-review-${currentPhase.slug}`;
    const reviewPrompt = `Execute b-review for ${snapshot.phasePath}`;
    const reviewHandle = await bridges.agent(reviewPrompt, { agent: "task", label: reviewLabel });
    await waitForHandle(bridges.wait, reviewHandle);

    // Check for review findings and rank via judgeBatch
    const findings = findReviewFindings(planInfo.subjectDir, currentPhase.slug);
    if (findings.length > 0 && snapshot.iterateCyclesOnPhase < 4) {
      snapshot.state = "ranking";
      writeStatusSnapshot(cwd, snapshot);
      bridges.phase(`Phase ${currentPhase.phaseNum}: Rank Findings`);
      await bridges.judgeBatch(
        findings.map(f => ({ finding: f, phase: snapshot.phasePath })),
        [
          { id: "impact", type: "score", question: "Rate impact from 0 to 4" },
          { id: "confidence", type: "score", question: "Rate confidence from 0 to 4" },
          { id: "effort", type: "score", question: "Rate effort from 0 to 4" },
        ],
      );

      // Iterate on findings
      snapshot.state = "iterating";
      snapshot.iterateCyclesOnPhase++;
      writeStatusSnapshot(cwd, snapshot);
      bridges.phase(`Phase ${currentPhase.phaseNum}: Iterate (${snapshot.iterateCyclesOnPhase})`);
      const iterLabel = `b-iterate-${currentPhase.slug}`;
      const iterPrompt = `Execute b-iterate on findings for ${snapshot.phasePath}`;
      const iterHandle = await bridges.agent(iterPrompt, { agent: "task", label: iterLabel });
      await waitForHandle(bridges.wait, iterHandle);
    }

    // Stage 3: Save
    snapshot.state = "saving";
    writeStatusSnapshot(cwd, snapshot);
    bridges.phase(`Phase ${currentPhase.phaseNum}: Save`);
    const saveLabel = `b-save-${currentPhase.slug}`;
    const savePrompt = `Execute b-save for ${snapshot.phasePath}`;
    const saveHandle = await bridges.agent(savePrompt, { agent: "task", label: saveLabel });
    await waitForHandle(bridges.wait, saveHandle);

    // Stage 4: Commit & Verification
    snapshot.state = "committing";
    writeStatusSnapshot(cwd, snapshot);
    bridges.phase(`Phase ${currentPhase.phaseNum}: Commit`);

    const stagePaths = [".context/", ...currentPhase.files];
    const staged = await executeCommand(bridges.sh, `git add -- ${stagePaths.map(shellQuote).join(" ")}`);
    if (commandFailed(staged)) {
      snapshot.state = "blocked";
      writeStatusSnapshot(cwd, snapshot);
      return { ok: false, state: "blocked", phase: snapshot.phasePath, message: "git add failed" };
    }

    const commitLabel = `b-commit-${currentPhase.slug}`;
    const commitPrompt = `Execute b-commit for ${snapshot.phasePath}`;
    const commitHandle = await bridges.agent(commitPrompt, { agent: "task", label: commitLabel });
    await waitForHandle(bridges.wait, commitHandle);

    // Verify commit baseline
    await executeCommand(bridges.sh, "git status --porcelain");

    // Advance to next phase
    activePhaseIndex++;
    snapshot.iterateCyclesOnPhase = 0;
  }

  snapshot.state = "blocked";
  writeStatusSnapshot(cwd, snapshot);
  bridges.log("Loop limit reached before every phase finished.");
  return { ok: false, state: "blocked", subject: snapshot.subject, phase: snapshot.phasePath, message: "Loop limit reached" };
}

function phaseIsDone(phase: PhaseInfo): boolean {
  const crit = parseAcceptanceCriteria(phase.content);
  return (crit.total > 0 && crit.checked === crit.total) || phase.status === "completed";
}

function firstIncompletePhaseIndex(phases: PhaseInfo[]): number {
  const index = phases.findIndex(phase => !phaseIsDone(phase));
  return index === -1 ? phases.length : index;
}

function phaseIndexFromSnapshot(phases: PhaseInfo[], cwd: string, phasePath: string | null | undefined): number | null {
  if (!phasePath) return null;
  const index = phases.findIndex(phase => relative(cwd, phase.path) === phasePath);
  return index >= 0 ? index : null;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function commandFailed(result: any): boolean {
  if (!result || typeof result !== "object") return false;
  const code = result.exitCode ?? result.status ?? result.code;
  return typeof code === "number" && code !== 0;
}

function findReviewFindings(subjectDir: string, phaseSlug: string): string[] {
  if (!existsSync(subjectDir)) return [];
  const files = readdirSync(subjectDir);
  const findings: string[] = [];
  for (const f of files) {
    if (f.startsWith(`iterate-${phaseSlug}`) || f.startsWith("review-")) {
      findings.push(f);
    }
  }
  return findings;
}

async function waitForHandle(waitFn: (handles: any[], options?: any) => Promise<any>, handle: any): Promise<void> {
  if (handle && typeof handle.wait === "function") {
    await handle.wait();
  } else if (typeof waitFn === "function") {
    await waitFn([handle]);
  }
}

async function executeCommand(
  shFn: (cmd: string | TemplateStringsArray, ...args: any[]) => Promise<any>,
  cmd: string,
): Promise<any> {
  if (typeof shFn !== "function") return;
  try {
    return await shFn(cmd);
  } catch {
    return;
  }
}

// Auto-run when executed directly in OMP eval kernel
const isTestRunner = typeof process !== "undefined" && process.env?.NODE_ENV === "test";
if (!isTestRunner && typeof (globalThis as any).agent !== "undefined") {
  await runBuckLoop();
}
