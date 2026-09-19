/**
 * scan — resolve an explicit plan/phase/subject path and read disk facts
 * into the frozen Phase 1 snapshot contract.
 *
 * Never creates plans or subjects. Never imports extensions/b-flow.
 * `.context/workflow/buck-loop.json` is not consulted here; persist.ts
 * owns resume reconciliation.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import type { LoopState, PlanFacts, ReviewFacts, WorkFacts } from "./types.js";

const SUBJECT_DIR_RE = /^\d{4}-\d{2}-\d{2}\./;
const PHASE_FILE_RE = /^phase-(\d+)-.+\.md$/;

export type ScanOptions = {
  projectRoot: string;
  /** Explicit plan, phase, or subject path. Required; never guessed. */
  path: string;
  /** Current loop state; used only for postcondition assessment. */
  state?: LoopState;
  sessionOutcome?: WorkFacts["sessionOutcome"];
  retriesUsed?: number;
};

export type ScanResult = {
  subject: string | null;
  planPath: string | null;
  phasePath: string | null;
  planFacts: PlanFacts;
  reviewFacts: ReviewFacts;
  workFacts: WorkFacts;
};

type Resolved = {
  subject: string;
  subjectDir: string;
  planAbs: string;
  phaseAbs: string | null;
  /** `missing` here means dependency-blocked or malformed metadata, not a vanished path. */
  planFacts: PlanFacts;
};

type PhaseMeta = {
  n: number;
  abs: string;
  status: string;
  dependsOn: DependsOn;
};

type PostCtx = {
  changed: string[] | null;
  phaseStatus: string | null;
  iterate: boolean;
  complete: boolean;
};

const PENDING_WORK: WorkFacts = {
  sessionOutcome: "pending",
  retriesUsed: 0,
  postcondition: "pending",
};

export function scan(opts: ScanOptions): ScanResult {
  const root = resolve(opts.projectRoot);
  const input = opts.path?.trim() ?? "";
  if (!input) return missing("path is required");
  const located = locate(root, input);
  if ("reason" in located) return missing(located.reason);
  const classified = classify(located.abs);
  if (classified.kind === "missing") return missing(classified.reason);
  const resolved = loadResolved(root, classified);
  if ("reason" in resolved) return missing(resolved.reason);
  return {
    subject: resolved.subject,
    planPath: toRel(root, resolved.planAbs),
    phasePath: resolved.phaseAbs ? toRel(root, resolved.phaseAbs) : null,
    planFacts: resolved.planFacts,
    reviewFacts: scanReviewFacts(resolved.subjectDir),
    workFacts: scanWorkFacts(root, resolved, opts),
  };
}

function missing(reason: string): ScanResult {
  return {
    subject: null,
    planPath: null,
    phasePath: null,
    planFacts: { kind: "missing", reason },
    reviewFacts: { kind: "pending" },
    workFacts: { ...PENDING_WORK },
  };
}

function locate(root: string, input: string): { abs: string } | { reason: string } {
  const direct = resolve(root, input);
  if (existsSync(direct)) return { abs: direct };
  const nested = resolve(root, ".context", input);
  if (existsSync(nested)) return { abs: nested };
  return { reason: `path does not exist: ${input}` };
}

type Classified =
  | { kind: "missing"; reason: string }
  | { kind: "subject"; abs: string }
  | { kind: "plan"; abs: string; subjectDir: string }
  | { kind: "phase"; abs: string; subjectDir: string };

function classify(abs: string): Classified {
  const st = statSync(abs);
  if (st.isDirectory()) return classifyDir(abs);
  return classifyFile(abs);
}

function classifyDir(abs: string): Classified {
  const name = basename(abs);
  if (name === ".context") {
    return { kind: "missing", reason: "refusing to guess among multiple subjects" };
  }
  if (SUBJECT_DIR_RE.test(name)) return { kind: "subject", abs };
  return { kind: "missing", reason: "path is not a plan, phase, or subject" };
}

function classifyFile(abs: string): Classified {
  const name = basename(abs);
  const subjectDir = dirname(abs);
  if (PHASE_FILE_RE.test(name)) return { kind: "phase", abs, subjectDir };
  if (isPhasesOverview(name)) {
    const plans = listPlans(subjectDir);
    if (plans.length === 1) return { kind: "plan", abs: plans[0], subjectDir };
    if (plans.length === 0) {
      return { kind: "missing", reason: "phased overview without a plan file" };
    }
    return { kind: "missing", reason: "multiple plans in subject; pass an explicit plan path" };
  }
  if (isPlanFile(name)) return { kind: "plan", abs, subjectDir };
  return { kind: "missing", reason: "path is not a plan, phase, or subject" };
}

function loadResolved(
  _root: string,
  classified: Exclude<Classified, { kind: "missing" }>,
): Resolved | { reason: string } {
  const subjectDir = classified.kind === "subject" ? classified.abs : classified.subjectDir;
  const subject = basename(subjectDir);
  const planAbs = classified.kind === "plan" ? classified.abs : pickSolePlan(subjectDir);
  if (typeof planAbs !== "string") return planAbs;
  const phases = listPhases(subjectDir);
  const picked = pickPhase(phases);
  if (picked.kind === "none") {
    return { subject, subjectDir, planAbs, phaseAbs: null, planFacts: { kind: "unphased" } };
  }
  if (picked.kind === "complete") {
    return { subject, subjectDir, planAbs, phaseAbs: null, planFacts: { kind: "phased-complete" } };
  }
  if (picked.kind === "blocked") {
    return {
      subject,
      subjectDir,
      planAbs,
      phaseAbs: null,
      planFacts: { kind: "missing", reason: picked.reason },
    };
  }
  return {
    subject,
    subjectDir,
    planAbs,
    phaseAbs: picked.abs,
    planFacts: { kind: "phased-incomplete" },
  };
}

function pickSolePlan(subjectDir: string): string | { reason: string } {
  const plans = listPlans(subjectDir);
  if (plans.length === 0) return { reason: "no plan in subject" };
  if (plans.length > 1) return { reason: "multiple plans in subject; pass an explicit plan path" };
  return plans[0];
}

function listPlans(dir: string): string[] {
  return listNames(dir)
    .filter(isPlanFile)
    .sort()
    .map((name) => join(dir, name));
}

function isPlanFile(name: string): boolean {
  return name.startsWith("plan-") && name.endsWith(".md") && !name.includes("-phases");
}

function isPhasesOverview(name: string): boolean {
  return name.startsWith("plan-") && name.endsWith(".md") && name.includes("-phases");
}

function listPhases(subjectDir: string): PhaseMeta[] {
  const out: PhaseMeta[] = [];
  for (const name of listNames(subjectDir)) {
    const match = name.match(PHASE_FILE_RE);
    if (!match) continue;
    const abs = join(subjectDir, name);
    const fm = readFrontmatter(abs);
    out.push({
      n: Number(match[1]),
      abs,
      status: fm.status ?? "pending",
      dependsOn: parseDependsOn(fm.depends_on ?? "[]"),
    });
  }
  out.sort((a, b) => a.n - b.n);
  return out;
}

function pickPhase(
  phases: PhaseMeta[],
):
  | { kind: "none" }
  | { kind: "complete" }
  | { kind: "blocked"; reason: string }
  | { kind: "ready"; abs: string } {
  if (phases.length === 0) return { kind: "none" };
  const byN = new Map(phases.map((p) => [p.n, p]));
  const incomplete = phases.filter((p) => p.status !== "completed");
  if (incomplete.length === 0) return { kind: "complete" };
  const malformed = incomplete.find(
    (p): p is PhaseMeta & { dependsOn: { kind: "malformed"; raw: string } } =>
      p.dependsOn.kind === "malformed",
  );
  if (malformed) {
    return {
      kind: "blocked",
      reason: `malformed depends_on in ${basename(malformed.abs)}: ${malformed.dependsOn.raw}`,
    };
  }
  for (const phase of incomplete) {
    if (depsSatisfied(phase, byN)) return { kind: "ready", abs: phase.abs };
  }
  const blocked = incomplete.map((p) => basename(p.abs)).join(", ");
  return {
    kind: "blocked",
    reason: `no incomplete phase has satisfied dependencies (cycle or missing dependency): ${blocked}`,
  };
}

function depsSatisfied(phase: PhaseMeta, byN: Map<number, PhaseMeta>): boolean {
  if (phase.dependsOn.kind === "malformed") return false;
  return phase.dependsOn.deps.every((n) => byN.get(n)?.status === "completed");
}

function scanReviewFacts(subjectDir: string): ReviewFacts {
  const iterateArtifact = hasIterate(subjectDir);
  const reportAbs = findReviewReport(subjectDir);
  if (!reportAbs && !iterateArtifact) return { kind: "pending" };
  if (!reportAbs) {
    return { kind: "report", parseable: false, iterateArtifact, docsImpact: false, howtoImpact: false };
  }
  const impact = parseReviewImpact(readFileSync(reportAbs, "utf8"));
  return {
    kind: "report",
    parseable: impact.parseable,
    iterateArtifact,
    docsImpact: impact.parseable && impact.docsImpact,
    howtoImpact: impact.parseable && impact.howtoImpact,
  };
}

function hasIterate(subjectDir: string): boolean {
  return listNames(subjectDir).some(
    (name) => /^iterate-.*\.md$/.test(name) && readStatus(join(subjectDir, name)) !== "completed",
  );
}

function findReviewReport(subjectDir: string): string | null {
  const names = listNames(subjectDir).filter((name) => /^review-.*\.md$/.test(name)).sort();
  if (names.length === 0) return null;
  return join(subjectDir, names[names.length - 1]);
}

function parseReviewImpact(text: string): { parseable: boolean; docsImpact: boolean; howtoImpact: boolean } {
  const docs = sectionBody(text, "Documentation Impact") ?? summaryLine(text, "Documentation impact");
  const howto = sectionBody(text, "How-to Impact") ?? summaryLine(text, "How-to impact");
  if (!docs || !howto) {
    return { parseable: false, docsImpact: false, howtoImpact: false };
  }
  return {
    parseable: true,
    docsImpact: isFlagged(docs, /no documentation impact/i),
    howtoImpact: isFlagged(howto, /no how-to impact/i),
  };
}

function isFlagged(body: string, none: RegExp): boolean {
  const first = firstContentLine(body);
  if (/^none$/i.test(first)) return false;
  return !none.test(first);
}

function firstContentLine(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.replace(/^\s*[-*]\s*/, "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function sectionBody(text: string, heading: string): string | null {
  const marker = `### ${heading}`;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const after = text.slice(start + marker.length);
  const next = after.search(/\n#{1,3} /);
  const body = (next < 0 ? after : after.slice(0, next)).trim();
  return body.length > 0 ? body : null;
}

function summaryLine(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^${label}:\\s*(.*)$`, "im"));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

type PostFn = (ctx: PostCtx) => WorkFacts["postcondition"];

const POSTCONDITION: Partial<Record<LoopState, PostFn>> = {
  building: (ctx) => (ctx.complete || ctx.phaseStatus === "completed" ? "confirmed" : "ambiguous"),
  iterating: (ctx) => (ctx.iterate ? "ambiguous" : "confirmed"),
  documenting: (ctx) => (ctx.changed?.some(isDocPath) ? "confirmed" : "ambiguous"),
  saving: (ctx) => (ctx.changed?.some((f) => f.startsWith(".context/memory/")) ? "confirmed" : "ambiguous"),
  committing: (ctx) => (ctx.changed !== null && ctx.changed.length === 0 ? "confirmed" : "ambiguous"),
  reviewing: () => "confirmed",
};

function scanWorkFacts(root: string, resolved: Resolved, opts: ScanOptions): WorkFacts {
  const sessionOutcome = opts.sessionOutcome ?? "pending";
  const retriesUsed = opts.retriesUsed ?? 0;
  if (sessionOutcome !== "ok") {
    return { sessionOutcome, retriesUsed, postcondition: "pending" };
  }
  const state = opts.state ?? "resolving";
  const assess = POSTCONDITION[state];
  if (!assess) return { sessionOutcome, retriesUsed, postcondition: "pending" };
  const changed = gitChangedFiles(root);
  const phaseStatus = resolved.phaseAbs ? readStatus(resolved.phaseAbs) : readStatus(resolved.planAbs);
  const postcondition = assess({
    changed,
    phaseStatus,
    iterate: hasIterate(resolved.subjectDir),
    complete: resolved.planFacts.kind === "phased-complete",
  });
  return { sessionOutcome, retriesUsed, postcondition };
}

function isDocPath(file: string): boolean {
  return (
    file === "CONTEXT.md" ||
    file === "AGENTS.md" ||
    file === "CLAUDE.md" ||
    file.startsWith("docs/")
  );
}

function gitChangedFiles(root: string): string[] | null {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out.split("\n").map(porcelainPath).filter((p): p is string => p !== null);
  } catch {
    return null;
  }
}

function porcelainPath(line: string): string | null {
  if (line.length < 4) return null;
  const rest = line.slice(3).trim();
  if (!rest) return null;
  const renamed = rest.indexOf(" -> ");
  const path = renamed >= 0 ? rest.slice(renamed + 4) : rest;
  return path.replace(/^"|"$/g, "") || null;
}

function readStatus(abs: string): string | null {
  return readFrontmatter(abs).status ?? null;
}

function readFrontmatter(abs: string): Record<string, string> {
  let text = "";
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return {};
  }
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};
  const out: Record<string, string> = {};
  for (const line of text.slice(4, end).split("\n")) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    out[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return out;
}

type DependsOn = { kind: "deps"; deps: number[] } | { kind: "malformed"; raw: string };

function parseDependsOn(raw: string): DependsOn {
  const text = raw.trim();
  if (!text.startsWith("[") || !text.endsWith("]")) return { kind: "malformed", raw };
  const inner = text.slice(1, -1).trim();
  if (!inner) return { kind: "deps", deps: [] };
  const deps: number[] = [];
  for (const part of inner.split(",")) {
    const text = part.trim();
    const n = text ? Number(text) : NaN;
    if (!Number.isInteger(n) || n < 0) return { kind: "malformed", raw };
    deps.push(n);
  }
  return { kind: "deps", deps };
}

function listNames(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function toRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}
