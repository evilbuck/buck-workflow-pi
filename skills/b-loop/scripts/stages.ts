/**
 * Stage adapters (`build`, `review`, `save`, and Phase 3 `commit` stub) plus
 * deterministic worktree fingerprinting and private `run-state` persistence
 * for `/b-loop <subject>`.
 *
 * Zero bare npm dependencies so OMP's Bun eval worker links cleanly.
 */

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unwrapToolResult } from "./frontmatter.js";
import type {
  BuildStageProof,
  LoopStage,
  ReviewStageProof,
  RunStateBackend,
  StageAdapter,
  StageAdapters,
  StageContext,
  StageVerifyResult,
  ValidatedBridges,
} from "./types.js";
import {
  agentHandleId,
  extractJsonObject,
  isWorkflowScratchPath,
  parsePorcelainZ,
  runSh,
  shellQuote,
  xdgEnvPrefixFor,
} from "./validation.js";

export const STAGE_TOOLS: Readonly<Record<LoopStage, readonly string[]>> = {
  build: ["read", "edit", "write", "grep", "find", "ls", "bash", "workflow_state"],
  review: ["read", "grep", "find", "ls", "workflow_state"],
  save: ["read", "edit", "write", "grep", "find", "ls", "workflow_state"],
  commit: ["read", "grep", "find", "ls"],
};

const WORKFLOW_STATE_CLI_PATH = fileURLToPath(
  new URL("../../_shared/scripts/workflow-state-cli.ts", import.meta.url),
);

const SAVE_METADATA_DUTIES = ["save-metadata", "readback", "probe"];

interface BuildHandoffRecord {
  attemptId: string;
  phaseRevision: string;
  worktreeFingerprint: string;
  acceptanceEvidence: string[];
  rawOutput: string;
  completedAt: string;
}

interface ReviewHandoffRecord {
  attemptId: string;
  phaseRevision: string;
  worktreeFingerprint: string;
  verdict: "clean" | "actionable";
  reportLogicalName: string;
  reportRevision: string;
  summary: string;
  completedAt: string;
}

export interface SavedArtifactRef {
  subjectId: string;
  kind: string;
  logicalName: string;
  revision?: string;
  token?: string;
}

interface SaveJournalRecord {
  attemptId: string;
  subjectId: string;
  phaseLogicalName: string;
  status: "attempted" | "applied";
  savedRefs: SavedArtifactRef[];
  summary?: string;
  completedAt?: string;
}

export interface StageAdapterOptions {
  runStateBackend?: RunStateBackend;
  xdgConfigHome?: string;
  commitAdapter?: StageAdapter;
}

const inProcessRunState = new Map<string, unknown>();

function runStateLogicalName(stage: "build" | "review" | "save", attemptId: string): string {
  return `b-loop/${stage}-${attemptId}.json`;
}

async function persistHandoff<T>(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
  stage: "build" | "review" | "save",
  data: T,
): Promise<void> {
  const logicalName = runStateLogicalName(stage, ctx.attemptId);
  if (!backend) {
    const memKey = `${ctx.pinnedPlan.subjectId}:${ctx.pinnedPlan.branchRef}:${logicalName}`;
    inProcessRunState.set(memKey, structuredClone(data));
    return;
  }
  const prev = await backend.readRunState<T>({
    cwd: ctx.cwd,
    subjectId: ctx.pinnedPlan.subjectId,
    branchRef: ctx.pinnedPlan.branchRef,
    logicalName,
  });
  await backend.writeRunState<T>({
    cwd: ctx.cwd,
    subjectId: ctx.pinnedPlan.subjectId,
    branchRef: ctx.pinnedPlan.branchRef,
    logicalName,
    data,
    expectedRevision: prev?.revision ?? null,
  });
}

async function loadHandoff<T>(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
  stage: "build" | "review" | "save",
): Promise<T | null> {
  const logicalName = runStateLogicalName(stage, ctx.attemptId);
  if (backend) {
    const stored = await backend.readRunState<T>({
      cwd: ctx.cwd,
      subjectId: ctx.pinnedPlan.subjectId,
      branchRef: ctx.pinnedPlan.branchRef,
      logicalName,
    });
    return stored ? stored.data : null;
  }
  const memKey = `${ctx.pinnedPlan.subjectId}:${ctx.pinnedPlan.branchRef}:${logicalName}`;
  return (inProcessRunState.get(memKey) as T | undefined) ?? null;
}

function shouldIgnoreForFingerprint(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, "/");
  if (isWorkflowScratchPath(norm)) return true;
  if (!norm.startsWith(".context/")) return false;
  return /^\.context\/[^/]+\/(?:review|iterate)-[^/]+\.md$/.test(norm);
}

function hashWorkingTreeEntry(cwd: string, relPath: string): string {
  const abs = join(cwd, relPath);
  let st;
  try {
    st = lstatSync(abs);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "MISSING";
    throw error;
  }
  if (st.isSymbolicLink()) {
    return `SYMLINK:${createHash("sha256").update(readlinkSync(abs), "utf8").digest("hex")}`;
  }
  if (st.isFile()) {
    const modeBits = (st.mode & 0o777).toString(8);
    const bytesHash = createHash("sha256").update(readFileSync(abs)).digest("hex");
    return `FILE:${modeBits}:${bytesHash}`;
  }
  return `DIR:${st.mode}`;
}

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * Compute deterministic SHA-256 worktree + index + HEAD fingerprint while excluding
 * ephemeral `.context/workflow/` and review/iterate report artifacts.
 */
export async function computeWorktreeFingerprint(
  cwd: string,
  sh: ValidatedBridges["sh"],
): Promise<string> {
  const qCwd = shellQuote(cwd);
  const head = (await runSh(sh, `git -C ${qCwd} rev-parse HEAD`)).trim();
  const statusZ = await runSh(
    sh,
    `git -C ${qCwd} status --porcelain=v1 --untracked-files=all -z`,
  );
  const diffCached = await runSh(sh, `git -C ${qCwd} diff --cached --raw -z`);

  const entries = parsePorcelainZ(statusZ)
    .filter((entry) => !shouldIgnoreForFingerprint(entry.path))
    .sort((a, b) => compareCodePoints(a.path, b.path))
    .map((entry) => ({
      xy: entry.xy,
      path: entry.path,
      origPath: entry.origPath ?? null,
      digest: hashWorkingTreeEntry(cwd, entry.path),
    }));

  const payload = JSON.stringify({ head, diffCached, entries });
  return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}

async function verifyPhaseRevisionMatches(
  ctx: StageContext,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let raw: { revision?: string } | null;
  try {
    raw = unwrapToolResult(
      await ctx.bridges.tool.workflow_state({
        operation: "read",
        subjectId: ctx.pinnedPlan.subjectId,
        kind: "phase",
        logicalName: ctx.phase.logicalName,
      }),
    ) as { revision?: string } | null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `Failed to verify phase ${ctx.phase.logicalName} revision: ${msg}` };
  }
  if (!raw || typeof raw.revision !== "string") {
    return { ok: false, reason: `Phase artifact ${ctx.phase.logicalName} is missing or unreadable in workflow_state.` };
  }
  if (raw.revision !== ctx.phase.revision) {
    return { ok: false, reason: `Phase ${ctx.phase.logicalName} revision changed since plan pin.` };
  }
  return { ok: true };
}

async function waitForAgentOutput(bridges: ValidatedBridges, handle: unknown): Promise<string> {
  const waited = await bridges.wait([handle]);
  const item = Array.isArray(waited) ? waited[0] : waited;
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const rec = item as Record<string, unknown>;
    if (typeof rec.output === "string") return rec.output;
    if (typeof rec.text === "string") return rec.text;
    if (typeof rec.content === "string") return rec.content;
    return JSON.stringify(rec);
  }
  return String(item ?? "");
}

const EVIDENCE_HEADING_RE = new RegExp("^##\\s+Acceptance evidence\\b", "i");
const SECTION_HEADING_RE = new RegExp("^##\\s+");
const BULLET_PREFIX_RE = new RegExp("^(?:[-*]|\\d+\\.)\\s+");

function parseAcceptanceEvidence(rawText: string): string[] {
  const parsed = extractJsonObject(rawText);
  if (parsed && Array.isArray(parsed.acceptanceEvidence)) {
    return parsed.acceptanceEvidence.map((item) => String(item).trim()).filter(Boolean);
  }
  const lines = rawText.split(new RegExp("\\r?\\n"));
  const headingIdx = lines.findIndex((l) => EVIDENCE_HEADING_RE.test(l.trim()));
  if (headingIdx < 0) return [];
  const bullets: string[] = [];
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (SECTION_HEADING_RE.test(trimmed)) break;
    if (BULLET_PREFIX_RE.test(trimmed)) {
      bullets.push(trimmed.replace(BULLET_PREFIX_RE, ""));
    }
  }
  return bullets;
}

interface JudgeBoolQuestion {
  type: "bool";
  instructions: string;
  criteria: { true: string; false: string };
}

function buildStagePrompt(ctx: StageContext): string {
  const criteriaBlock = ctx.phase.acceptanceCriteria.length > 0
    ? ctx.phase.acceptanceCriteria.map((c) => "- " + c).join("\n")
    : "- Confirm implementation cleanly satisfies phase goals and passes tests.";
  return [
    "Execute " + ctx.phase.buckHint + " in /b-loop mode for exact plan/phase.",
    "Subject: " + ctx.pinnedPlan.subjectId,
    "Plan: " + ctx.pinnedPlan.planLogicalName,
    "Phase: " + ctx.phase.logicalName + " (order " + ctx.phase.order + ", difficulty " + ctx.phase.difficulty + ")",
    "Declared files: " + (ctx.phase.files.join(", ") || "(see phase spec)"),
    "Acceptance criteria:",
    criteriaBlock,
    "",
    "Loop mode rules:",
    "- Implement ONLY this phase.",
    "- Do NOT write status, completed_at, or lifecycle fields on plan/phase files, and do NOT tick [x] checkboxes.",
    "- Do NOT invoke jev/judge, /b-save, or /b-commit.",
    "- End your response with an '## Acceptance evidence' section containing one bullet per acceptance criterion quoting it verbatim plus the commands run and observed results.",
    "You have no authority to choose the next loop state.",
  ].join("\n");
}

function buildJudgeQuestions(criteria: readonly string[]): Record<string, JudgeBoolQuestion> {
  const list = criteria.length > 0 ? criteria : ["Phase implementation meets stated requirements and tests pass."];
  const questions: Record<string, JudgeBoolQuestion> = {};
  for (let i = 0; i < list.length; i++) {
    const line = list[i];
    questions[`criterion_${i + 1}`] = {
      type: "bool",
      instructions: `Is this acceptance criterion done: ${line}?`,
      criteria: {
        true: "The supplied evidence directly proves this criterion. Claims without command/code proof are insufficient.",
        false: "Evidence is missing, indirect, or contradicts the criterion.",
      },
    };
  }
  return questions;
}

function unwrapJudgeAnswers(
  response: unknown,
): Record<string, { type?: string; bool?: number }> | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const rec = response as Record<string, unknown>;
  if ("answers" in rec) {
    return rec.answers && typeof rec.answers === "object" && !Array.isArray(rec.answers)
      ? (rec.answers as Record<string, { type?: string; bool?: number }>)
      : null;
  }
  return rec as Record<string, { type?: string; bool?: number }>;
}

async function evaluateBuildWithJudge(
  ctx: StageContext,
  handoff: BuildHandoffRecord,
): Promise<{ passed: true } | { passed: false; reason: string }> {
  const questions = buildJudgeQuestions(ctx.phase.acceptanceCriteria);
  const state = {
    subject: ctx.pinnedPlan.subjectId,
    phase: ctx.phase.logicalName,
    worktreeFingerprint: handoff.worktreeFingerprint,
    criteria: ctx.phase.acceptanceCriteria,
    evidence: handoff.acceptanceEvidence,
    report: handoff.rawOutput,
  };
  let response: unknown;
  try {
    response = await ctx.bridges.judge(state, questions);
  } catch (error) {
    return {
      passed: false,
      reason: `judge() acceptance evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const answers = unwrapJudgeAnswers(response);
  if (!answers) {
    return { passed: false, reason: "judge() returned no answers object for build acceptance." };
  }
  const failed: string[] = [];
  for (const [id, q] of Object.entries(questions)) {
    const ans = answers[id];
    const score = ans && ans.type === "bool" && typeof ans.bool === "number" ? ans.bool : -1;
    if (!Number.isFinite(score) || score < 0.7) {
      failed.push(`${id} (score=${score}): ${q.instructions}`);
    }
  }
  if (failed.length > 0) {
    return { passed: false, reason: `Acceptance criteria rejected by judge(): ${failed.join("; ")}` };
  }
  return { passed: true };
}

async function verifyBuildResult(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
): Promise<StageVerifyResult> {
  const phaseCheck = await verifyPhaseRevisionMatches(ctx);
  if (!phaseCheck.ok) {
    return { status: "stale_or_missing", reason: phaseCheck.reason };
  }
  const handoff = await loadHandoff<BuildHandoffRecord>(ctx, backend, "build");
  if (!handoff || handoff.attemptId !== ctx.attemptId) {
    return { status: "stale_or_missing", reason: "Build output missing for attempt; re-run build." };
  }
  const currentFp = await computeWorktreeFingerprint(ctx.cwd, ctx.bridges.sh);
  if (handoff.phaseRevision !== ctx.phase.revision || handoff.worktreeFingerprint !== currentFp) {
    return { status: "stale_or_missing", reason: "Worktree or phase content changed since build finished." };
  }
  const judgment = await evaluateBuildWithJudge(ctx, handoff);
  if (!judgment.passed) {
    return {
      status: "blocked",
      reason: judgment.reason,
      nextSafeAction: `Complete failing acceptance criteria in worktree (partial edits preserved) and re-run /b-loop ${ctx.pinnedPlan.subjectId}.`,
    };
  }
  const proof: BuildStageProof = {
    phaseRevision: ctx.phase.revision,
    worktreeFingerprint: currentFp,
    acceptanceEvidence: handoff.acceptanceEvidence,
    verifiedAt: new Date().toISOString(),
  };
  return { status: "verified", proof };
}

function createBuildStageAdapter(backend: RunStateBackend | undefined): StageAdapter {
  return {
    async dispatchWorking(ctx) {
      const skill = ctx.phase.buckHint === "/b-build-hard" ? "b-build-hard" : "b-build";
      const handle = await ctx.bridges.agent(buildStagePrompt(ctx), {
        agent: "task",
        label: `${skill}:${ctx.phase.slug}`,
        tools: [...STAGE_TOOLS.build],
      });
      return { jobHandle: agentHandleId(handle), handle };
    },
    async awaitFinished(ctx, dispatched) {
      const rawOutput = await waitForAgentOutput(ctx.bridges, dispatched.handle);
      const worktreeFingerprint = await computeWorktreeFingerprint(ctx.cwd, ctx.bridges.sh);
      await persistHandoff<BuildHandoffRecord>(ctx, backend, "build", {
        attemptId: ctx.attemptId,
        phaseRevision: ctx.phase.revision,
        worktreeFingerprint,
        acceptanceEvidence: parseAcceptanceEvidence(rawOutput),
        rawOutput,
        completedAt: new Date().toISOString(),
      });
    },
    async recoverWorking(ctx) {
      const saved = await loadHandoff<BuildHandoffRecord>(ctx, backend, "build");
      if (saved && saved.attemptId === ctx.attemptId && saved.completedAt) {
        return { status: "finished" };
      }
      // Partial edits on disk remain untouched so retry builds cleanly from current worktree.
      return { status: "retry" };
    },
    verifyResult: (ctx) => verifyBuildResult(ctx, backend),
  };
}

interface ParsedReviewPayload {
  verdict: "clean" | "actionable";
  summary: string;
  reportMarkdown: string;
}

function reviewStagePrompt(ctx: StageContext, buildProof: BuildStageProof): string {
  const filesLabel = ctx.phase.files.join(", ") || "see phase";
  const evidenceLines = buildProof.acceptanceEvidence.map((e) => "- " + e).join("\n") || "- (none recorded)";
  return [
    "Execute /b-review two-axis review (Standards + Spec) in read-only /b-loop mode.",
    "Subject: " + ctx.pinnedPlan.subjectId,
    "Plan: " + ctx.pinnedPlan.planLogicalName,
    "Phase: " + ctx.phase.logicalName + " (files: " + filesLabel + ")",
    "Build proof fingerprint: " + buildProof.worktreeFingerprint,
    "Build acceptance evidence:\n" + evidenceLines,
    "",
    "Strict boundaries:",
    "- You only have read-only and workflow_state inspection tools. Never edit source files.",
    "- Do NOT call judgeBatch, do NOT rank findings, do NOT invoke /b-iterate, do NOT run /b-save or /b-commit.",
    '- Return a single JSON object: {"verdict":"clean"|"actionable","criticalCount":0,"warningCount":0,"summary":"...","findings":[...],"reportMarkdown":"..."}.',
  ].join("\n");
}

function hasActionableReviewFinding(parsed: Record<string, unknown>): boolean {
  const criticalCount = typeof parsed.criticalCount === "number" ? parsed.criticalCount : 0;
  const warningCount = typeof parsed.warningCount === "number" ? parsed.warningCount : 0;
  if (criticalCount > 0 || warningCount > 0) return true;
  if (!Array.isArray(parsed.findings)) return false;
  return parsed.findings.some((f) => {
    const sev = typeof (f as { severity?: unknown })?.severity === "string"
      ? (f as { severity: string }).severity.toLowerCase()
      : "";
    return sev !== "nit" && sev !== "info";
  });
}

function nonEmptyString(val: unknown): string | null {
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

function resolveReviewVerdict(parsed: Record<string, unknown>): "clean" | "actionable" {
  const verdict = parsed.verdict;
  if (verdict !== "clean" && verdict !== "actionable") {
    throw new Error("b-review did not return a valid JSON verdict ('clean' or 'actionable').");
  }
  return verdict === "actionable" || hasActionableReviewFinding(parsed) ? "actionable" : "clean";
}

function parseReviewPayload(rawText: string): ParsedReviewPayload {
  const parsed = extractJsonObject(rawText);
  if (!parsed) {
    throw new Error("b-review did not return a valid JSON verdict ('clean' or 'actionable').");
  }
  const verdict = resolveReviewVerdict(parsed);
  const summary = nonEmptyString(parsed.summary) ?? `Review verdict: ${verdict}`;
  const heading = verdict === "actionable" ? "Iterate" : "Review";
  const reportMarkdown = nonEmptyString(parsed.reportMarkdown) ?? `# ${heading}: ${summary}\n`;
  return { verdict, summary, reportMarkdown };
}

async function writeReviewReportArtifact(
  ctx: StageContext,
  verdict: "clean" | "actionable",
  body: string,
): Promise<{ logicalName: string; revision: string }> {
  const kind = verdict === "actionable" ? "iterate" : "review";
  const logicalName = verdict === "actionable"
    ? `iterate-${ctx.phase.slug}.md`
    : `review-${ctx.phase.slug}.md`;
  const existing = unwrapToolResult(
    await ctx.bridges.tool.workflow_state({
      operation: "read",
      subjectId: ctx.pinnedPlan.subjectId,
      kind,
      logicalName,
    }),
  ) as { revision?: string } | null;
  const written = unwrapToolResult(
    await ctx.bridges.tool.workflow_state({
      operation: "write",
      subjectId: ctx.pinnedPlan.subjectId,
      kind,
      logicalName,
      body,
      expectedRevision: existing?.revision ?? null,
    }),
  ) as { revision?: string; logicalName?: string } | null;
  if (!written || typeof written.revision !== "string") {
    throw new Error(`workflow_state write failed to persist ${logicalName}.`);
  }
  return { logicalName: written.logicalName ?? logicalName, revision: written.revision };
}

async function verifyReportStillExists(
  ctx: StageContext,
  proof: Pick<ReviewStageProof, "verdict" | "reportLogicalName" | "reportRevision">,
): Promise<boolean> {
  if (!proof.reportLogicalName) return true;
  const kind = proof.verdict === "actionable" ? "iterate" : "review";
  try {
    const found = unwrapToolResult(
      await ctx.bridges.tool.workflow_state({
        operation: "read",
        subjectId: ctx.pinnedPlan.subjectId,
        kind,
        logicalName: proof.reportLogicalName,
        ...(proof.reportRevision ? { revision: proof.reportRevision } : {}),
      }),
    ) as { revision?: string } | null;
    if (!found) return false;
    return !proof.reportRevision || found.revision === proof.reportRevision;
  } catch {
    return false;
  }
}

async function checkBuildFreshForReview(
  ctx: StageContext,
): Promise<{ fresh: true; buildProof: BuildStageProof; currentFp: string } | { fresh: false; reason: string }> {
  const buildProof = ctx.checkpoint.phases[ctx.phase.logicalName]?.build;
  if (!buildProof) {
    return { fresh: false, reason: "Build proof missing before review." };
  }
  const phaseCheck = await verifyPhaseRevisionMatches(ctx);
  if (!phaseCheck.ok) {
    return { fresh: false, reason: phaseCheck.reason };
  }
  const currentFp = await computeWorktreeFingerprint(ctx.cwd, ctx.bridges.sh);
  if (buildProof.phaseRevision !== ctx.phase.revision || buildProof.worktreeFingerprint !== currentFp) {
    return { fresh: false, reason: "Worktree or phase content changed since build was verified." };
  }
  return { fresh: true, buildProof, currentFp };
}

async function checkReviewStarting(ctx: StageContext) {
  const upstream = await checkBuildFreshForReview(ctx);
  if (!upstream.fresh) {
    return { status: "rewind" as const, targetStage: "build" as const, reason: upstream.reason };
  }
  const existing = ctx.checkpoint.phases[ctx.phase.logicalName]?.review;
  const matchesBuild =
    existing &&
    existing.phaseRevision === upstream.buildProof.phaseRevision &&
    existing.worktreeFingerprint === upstream.buildProof.worktreeFingerprint;
  if (matchesBuild && (await verifyReportStillExists(ctx, existing))) {
    if (existing.verdict === "clean") {
      return { status: "already-finished" as const };
    }
    const label = existing.reportLogicalName ?? "review report";
    return {
      status: "blocked" as const,
      reason: `Actionable review findings remain unresolved (${label}).`,
      nextSafeAction: `Fix the findings in ${label} and re-run /b-loop ${ctx.pinnedPlan.subjectId}.`,
    };
  }
  return { status: "dispatch" as const };
}

async function recoverReviewWorking(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
) {
  const upstream = await checkBuildFreshForReview(ctx);
  if (!upstream.fresh) {
    // Route through finish -> verifyResult so stale upstream rewinds cleanly to build.
    return { status: "finished" as const };
  }
  const handoff = await loadHandoff<ReviewHandoffRecord>(ctx, backend, "review");
  const finishedCurrent =
    handoff &&
    handoff.attemptId === ctx.attemptId &&
    handoff.worktreeFingerprint === upstream.currentFp &&
    handoff.phaseRevision === upstream.buildProof.phaseRevision;
  return finishedCurrent ? { status: "finished" as const } : { status: "retry" as const };
}

async function resolveFreshReviewCandidate(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
  buildProof: BuildStageProof,
): Promise<ReviewHandoffRecord | ReviewStageProof | null> {
  const handoff = await loadHandoff<ReviewHandoffRecord>(ctx, backend, "review");
  const candidate =
    handoff && handoff.attemptId === ctx.attemptId
      ? handoff
      : ctx.checkpoint.phases[ctx.phase.logicalName]?.review;
  if (!candidate) return null;
  if (candidate.phaseRevision !== buildProof.phaseRevision) return null;
  if (candidate.worktreeFingerprint !== buildProof.worktreeFingerprint) return null;
  return (await verifyReportStillExists(ctx, candidate)) ? candidate : null;
}

async function verifyReviewResult(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
): Promise<StageVerifyResult> {
  const upstream = await checkBuildFreshForReview(ctx);
  if (!upstream.fresh) {
    return { status: "stale_or_missing", reason: upstream.reason, rewindTo: "build" };
  }
  const candidate = await resolveFreshReviewCandidate(ctx, backend, upstream.buildProof);
  if (!candidate) {
    return { status: "stale_or_missing", reason: "Review proof is missing or stale for current build." };
  }
  const proof: ReviewStageProof = {
    phaseRevision: upstream.buildProof.phaseRevision,
    worktreeFingerprint: upstream.buildProof.worktreeFingerprint,
    reportLogicalName: candidate.reportLogicalName,
    reportRevision: candidate.reportRevision,
    verdict: candidate.verdict,
    verifiedAt: new Date().toISOString(),
  };
  if (proof.verdict === "actionable") {
    const label = proof.reportLogicalName ?? "iterate report";
    return {
      status: "blocked",
      reason: `Review found actionable issues recorded in ${label}.`,
      nextSafeAction: `Fix the findings in ${label} and re-run /b-loop ${ctx.pinnedPlan.subjectId}.`,
      proof,
    };
  }
  return { status: "verified", proof };
}

function createReviewStageAdapter(backend: RunStateBackend | undefined): StageAdapter {
  return {
    checkStarting: checkReviewStarting,
    async dispatchWorking(ctx) {
      const upstream = await checkBuildFreshForReview(ctx);
      if (!upstream.fresh) {
        throw new Error(`Cannot start b-review with stale build state: ${upstream.reason}`);
      }
      const handle = await ctx.bridges.agent(reviewStagePrompt(ctx, upstream.buildProof), {
        agent: "task",
        label: `b-review:${ctx.phase.slug}`,
        tools: [...STAGE_TOOLS.review],
      });
      return { jobHandle: agentHandleId(handle), handle };
    },
    async awaitFinished(ctx, dispatched) {
      const upstream = await checkBuildFreshForReview(ctx);
      if (!upstream.fresh) {
        throw new Error(`Build state drifted while b-review was running: ${upstream.reason}`);
      }
      const rawOutput = await waitForAgentOutput(ctx.bridges, dispatched.handle);
      const parsed = parseReviewPayload(rawOutput);
      const saved = await writeReviewReportArtifact(ctx, parsed.verdict, parsed.reportMarkdown);
      await persistHandoff<ReviewHandoffRecord>(ctx, backend, "review", {
        attemptId: ctx.attemptId,
        phaseRevision: upstream.buildProof.phaseRevision,
        worktreeFingerprint: upstream.buildProof.worktreeFingerprint,
        verdict: parsed.verdict,
        reportLogicalName: saved.logicalName,
        reportRevision: saved.revision,
        summary: parsed.summary,
        completedAt: new Date().toISOString(),
      });
    },
    recoverWorking: (ctx) => recoverReviewWorking(ctx, backend),
    verifyResult: (ctx) => verifyReviewResult(ctx, backend),
  };
}

interface ReceiptRecord {
  runId?: string;
  attemptId?: string;
  status?: "attempted" | "complete";
  artifactRevisions?: string[];
  kind?: string;
}

function sameSortedIds(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

async function runWorkflowStateCliReceipt(
  ctx: StageContext,
  operation: "write-receipt" | "read-receipt",
  fallbackXdgHome: string | undefined,
  payload?: Record<string, unknown>,
): Promise<ReceiptRecord | null> {
  const xdgPrefix = xdgEnvPrefixFor(ctx.xdgConfigHome, fallbackXdgHome);
  const argPart = payload ? ` ${shellQuote(JSON.stringify(payload))}` : "";
  const cmd = `cd ${shellQuote(resolve(ctx.cwd))} && ${xdgPrefix}bun ${shellQuote(WORKFLOW_STATE_CLI_PATH)} ${operation}${argPart}`;
  const out = (await runSh(ctx.bridges.sh, cmd)).trim();
  if (!out || out === "null") return null;
  return JSON.parse(out) as ReceiptRecord;
}

async function readReceiptSafe(ctx: StageContext): Promise<ReceiptRecord | null> {
  const raw = unwrapToolResult(await ctx.bridges.tool.workflow_state({ operation: "read-receipt" }));
  return (raw && typeof raw === "object" ? raw : null) as ReceiptRecord | null;
}

interface ReceiptWriteInput {
  attemptId: string;
  status: "attempted" | "complete";
  artifactRevisions: string[];
  kind: "rows" | "no-fact";
  metadataDuties: string[];
}

async function writeReceiptSafe(
  ctx: StageContext,
  req: ReceiptWriteInput,
  fallbackXdgHome?: string,
): Promise<ReceiptRecord | null> {
  try {
    const raw = unwrapToolResult(
      await ctx.bridges.tool.workflow_state({
        operation: "write-receipt",
        attemptId: req.attemptId,
        status: req.status,
        artifactRevisions: req.artifactRevisions,
        receiptKind: req.kind,
        metadataDuties: req.metadataDuties,
      }),
    );
    return (raw && typeof raw === "object" ? raw : null) as ReceiptRecord | null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!/write role|cannot execute/i.test(msg)) throw error;
    return runWorkflowStateCliReceipt(ctx, "write-receipt", fallbackXdgHome, {
      attemptId: req.attemptId,
      status: req.status,
      artifactRevisions: req.artifactRevisions,
      kind: req.kind,
      metadataDuties: req.metadataDuties,
    });
  }
}

type SqlAttemptReadResult =
  | { state: "absent" }
  | { state: "malformed" }
  | { state: "present"; data: Record<string, unknown> };

function readSqlAttemptFile(cwd: string): SqlAttemptReadResult {
  const attemptPath = join(cwd, ".context", "workflow", "sql-save-attempt.json");
  let rawText: string;
  try {
    rawText = readFileSync(attemptPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: "absent" };
    throw error;
  }
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { state: "present", data: parsed as Record<string, unknown> };
    }
    return { state: "malformed" };
  } catch {
    return { state: "malformed" };
  }
}

function sqlAttemptConflict(
  ctx: StageContext,
  sqlAttempt: SqlAttemptReadResult,
): string | null {
  if (sqlAttempt.state === "absent") return null;
  if (sqlAttempt.state === "malformed") {
    return `Malformed sql-save-attempt.json blocks save recovery for attemptId ${ctx.attemptId}.`;
  }
  const data = sqlAttempt.data;
  const sameSubject = data.subject === ctx.pinnedPlan.subjectId;
  const samePhase = !data.phase || data.phase === ctx.phase.logicalName;
  const sameAttempt = typeof data.attemptId === "string" && data.attemptId === ctx.attemptId;
  if (!sameSubject || !samePhase || !sameAttempt) {
    return `Conflicting sql-save-attempt.json (${String(data.attemptId ?? "unknown")} / ${String(data.subject ?? "unknown")}) blocks attemptId ${ctx.attemptId}.`;
  }
  return null;
}

function assertUpstreamReviewClean(ctx: StageContext): string | null {
  const phaseState = ctx.checkpoint.phases[ctx.phase.logicalName];
  if (!phaseState?.build || !phaseState.review) {
    return "Cannot run save before verified build and clean review proofs exist.";
  }
  if (phaseState.review.verdict !== "clean") {
    return "Cannot run save when review verdict is actionable.";
  }
  return null;
}

async function checkReviewWorktreeFresh(ctx: StageContext): Promise<string | null> {
  const phaseCheck = await verifyPhaseRevisionMatches(ctx);
  if (!phaseCheck.ok) return phaseCheck.reason;
  const phaseState = ctx.checkpoint.phases[ctx.phase.logicalName]!;
  const currentFp = await computeWorktreeFingerprint(ctx.cwd, ctx.bridges.sh);
  const revMatch =
    phaseState.build!.phaseRevision === ctx.phase.revision &&
    phaseState.review!.phaseRevision === ctx.phase.revision;
  if (!revMatch || phaseState.review!.worktreeFingerprint !== currentFp) {
    return "Worktree or phase content changed since clean review; rebuild and re-review before save.";
  }
  return null;
}

async function checkReviewFreshForSave(
  ctx: StageContext,
): Promise<{ ok: true } | { ok: false; kind: "blocked" | "stale"; reason: string }> {
  const reviewErr = assertUpstreamReviewClean(ctx);
  if (reviewErr) return { ok: false, kind: "blocked", reason: reviewErr };
  const staleReason = await checkReviewWorktreeFresh(ctx);
  if (staleReason) return { ok: false, kind: "stale", reason: staleReason };
  return { ok: true };
}

async function readRefRevision(ctx: StageContext, ref: SavedArtifactRef): Promise<string | null> {
  const target = ref.token
    ? { token: ref.token }
    : { subjectId: ref.subjectId, kind: ref.kind, logicalName: ref.logicalName };
  const raw = unwrapToolResult(
    await ctx.bridges.tool.workflow_state({
      operation: "read",
      ...target,
      ...(ref.revision ? { revision: ref.revision } : {}),
    }),
  ) as { revision?: string } | null;
  if (!raw || typeof raw.revision !== "string") return null;
  if (ref.revision && raw.revision !== ref.revision) return null;
  return raw.revision;
}

async function collectScopedKnownRevisions(ctx: StageContext): Promise<Set<string>> {
  const known = new Set<string>();
  const scopes = new Set<string>([ctx.pinnedPlan.subjectId, "memory", "backlog"]);
  for (const subjectId of scopes) {
    const items = unwrapToolResult(
      await ctx.bridges.tool.workflow_state({ operation: "list", subjectId }),
    );
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const rev = (item as { revision?: unknown } | null)?.revision;
      if (typeof rev === "string") known.add(rev);
    }
  }
  return known;
}

async function readTokenRevision(ctx: StageContext, token: string): Promise<boolean> {
  const hit = unwrapToolResult(
    await ctx.bridges.tool.workflow_state({ operation: "read", token }),
  ) as { revision?: string } | null;
  return Boolean(hit && typeof hit.revision === "string");
}

async function verifyRevisionsReadback(
  ctx: StageContext,
  revisions: readonly string[],
  savedRefs: readonly SavedArtifactRef[],
): Promise<boolean> {
  const verifiedSet = new Set<string>();
  for (const ref of savedRefs) {
    const rev = await readRefRevision(ctx, ref);
    if (!rev) return false;
    verifiedSet.add(rev);
    if (ref.token) verifiedSet.add(ref.token);
  }
  const unresolved: string[] = [];
  for (const id of revisions) {
    if (verifiedSet.has(id)) continue;
    if (id.startsWith("workflow-artifact:")) {
      if (!(await readTokenRevision(ctx, id))) return false;
      verifiedSet.add(id);
    } else {
      unresolved.push(id);
    }
  }
  if (unresolved.length === 0) return true;
  const scoped = await collectScopedKnownRevisions(ctx);
  return unresolved.every((rev) => scoped.has(rev));
}

function saveStagePrompt(ctx: StageContext): string {
  return [
    `Execute /b-save in /b-loop mode for phase ${ctx.phase.logicalName}.`,
    `Subject: ${ctx.pinnedPlan.subjectId}`,
    `attemptId: ${ctx.attemptId}`,
    "",
    "Strict boundaries:",
    '- Write durable session memory (`kind: "memory"`) and any needed backlog items via `workflow_state` (`write`).',
    "- Do NOT edit plan-*.md, phase-*.md, or subject lifecycle files, and do NOT run `git commit`.",
    '- If your `workflow_state` role permits `write-receipt`, preserve `metadataDuties: ["save-metadata", "readback", "probe"]`, write `status: "attempted"` with `receiptKind: "rows"` and your `artifactRevisions`, then write `status: "complete"` with those same fields; otherwise let the coordinator seal it after readback.',
    '- Return a single JSON object: {"summary":"...","savedArtifacts":[{"subjectId":"...","kind":"...","logicalName":"...","revision":"...","token":"..."}]}.',
  ].join("\n");
}

function parseSavedArtifacts(rawText: string): { savedRefs: SavedArtifactRef[]; summary: string } {
  const parsed = extractJsonObject(rawText);
  if (!parsed || !Array.isArray(parsed.savedArtifacts)) {
    return { savedRefs: [], summary: rawText.trim().slice(0, 200) };
  }
  const savedRefs: SavedArtifactRef[] = [];
  for (const item of parsed.savedArtifacts) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.subjectId === "string" && typeof rec.kind === "string" && typeof rec.logicalName === "string") {
      savedRefs.push({
        subjectId: rec.subjectId,
        kind: rec.kind,
        logicalName: rec.logicalName,
        ...(typeof rec.revision === "string" ? { revision: rec.revision } : {}),
        ...(typeof rec.token === "string" ? { token: rec.token } : {}),
      });
    }
  }
  return {
    savedRefs,
    summary: typeof parsed.summary === "string" ? parsed.summary : "Saved workflow metadata",
  };
}

async function resolveSavedRefsRevisions(ctx: StageContext, savedRefs: readonly SavedArtifactRef[]): Promise<string[]> {
  const revisions: string[] = [];
  for (const ref of savedRefs) {
    const rev = await readRefRevision(ctx, ref);
    if (!rev) {
      throw new Error(`Saved artifact failed readback: ${ref.subjectId}:${ref.kind}:${ref.logicalName}`);
    }
    revisions.push(rev);
  }
  return revisions;
}

async function inspectSaveOutcome(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
): Promise<{
  receipt: ReceiptRecord | null;
  journal: SaveJournalRecord | null;
  conflict: string | null;
}> {
  const sqlConflict = sqlAttemptConflict(ctx, readSqlAttemptFile(ctx.cwd));
  if (sqlConflict) {
    return { receipt: null, journal: null, conflict: sqlConflict };
  }
  const receipt = await readReceiptSafe(ctx);
  if (receipt?.attemptId && receipt.attemptId !== ctx.attemptId) {
    return {
      receipt,
      journal: null,
      conflict: `Receipt attemptId ${receipt.attemptId} does not match bound attemptId ${ctx.attemptId}.`,
    };
  }
  const journal = await loadHandoff<SaveJournalRecord>(ctx, backend, "save");
  if (journal && journal.attemptId !== ctx.attemptId) {
    return {
      receipt,
      journal,
      conflict: `Save journal attemptId ${journal.attemptId} does not match ${ctx.attemptId}.`,
    };
  }
  return { receipt, journal, conflict: null };
}

async function bindAndSealRowsReceipt(
  ctx: StageContext,
  resolvedRevs: string[],
  fallbackXdgHome?: string,
): Promise<void> {
  await writeReceiptSafe(ctx, {
    attemptId: ctx.attemptId,
    status: "attempted",
    artifactRevisions: resolvedRevs,
    kind: "rows",
    metadataDuties: [...SAVE_METADATA_DUTIES],
  }, fallbackXdgHome);
  await writeReceiptSafe(ctx, {
    attemptId: ctx.attemptId,
    status: "complete",
    artifactRevisions: resolvedRevs,
    kind: "rows",
    metadataDuties: [...SAVE_METADATA_DUTIES],
  }, fallbackXdgHome);
}

async function verifySaveFromCompletedReceipt(
  ctx: StageContext,
  receipt: ReceiptRecord,
  savedRefs: readonly SavedArtifactRef[],
): Promise<StageVerifyResult> {
  const revs = receipt.artifactRevisions ?? [];
  const readable = await verifyRevisionsReadback(ctx, revs, savedRefs);
  if (!readable) {
    return {
      status: "blocked",
      reason: `Save receipt for attemptId ${ctx.attemptId} references unreadable revisions.`,
      nextSafeAction: `Verify saved revisions in workflow_state for attemptId ${ctx.attemptId}.`,
      proof: { attemptId: ctx.attemptId, runId: receipt.runId, receiptStatus: "ambiguous", artifactRevisions: [...revs] },
    };
  }
  return {
    status: "verified",
    proof: {
      attemptId: ctx.attemptId,
      runId: receipt.runId,
      receiptStatus: "complete",
      artifactRevisions: [...revs],
      verifiedAt: new Date().toISOString(),
    },
  };
}

function upstreamSaveStartBlock(
  fresh: { ok: false; kind: "blocked" | "stale"; reason: string },
) {
  if (fresh.kind === "stale") {
    return { status: "rewind" as const, targetStage: "build" as const, reason: fresh.reason };
  }
  return { status: "blocked" as const, reason: fresh.reason, nextSafeAction: "Complete clean review before save." };
}

async function checkSaveStarting(ctx: StageContext, backend: RunStateBackend | undefined) {
  const fresh = await checkReviewFreshForSave(ctx);
  if (!fresh.ok) {
    return upstreamSaveStartBlock(fresh);
  }
  const outcome = await inspectSaveOutcome(ctx, backend);
  if (outcome.conflict) {
    return {
      status: "blocked" as const,
      reason: outcome.conflict,
      nextSafeAction: `Inspect receipt/journal for attemptId ${ctx.attemptId} before re-running /b-loop.`,
    };
  }
  if (outcome.receipt?.status === "complete" && outcome.receipt.attemptId === ctx.attemptId) {
    const revs = outcome.receipt.artifactRevisions ?? [];
    if (await verifyRevisionsReadback(ctx, revs, outcome.journal?.savedRefs ?? [])) {
      return { status: "already-finished" as const };
    }
    return {
      status: "blocked" as const,
      reason: `Completed save receipt for attemptId ${ctx.attemptId} failed artifact readback.`,
      nextSafeAction: `Inspect workflow_state artifacts for attemptId ${ctx.attemptId}.`,
    };
  }
  return { status: "dispatch" as const };
}

async function recoverCompletedReceiptWorking(
  ctx: StageContext,
  receipt: ReceiptRecord,
  savedRefs: readonly SavedArtifactRef[],
) {
  const revs = receipt.artifactRevisions ?? [];
  if (await verifyRevisionsReadback(ctx, revs, savedRefs)) {
    return { status: "finished" as const };
  }
  return {
    status: "uncertain" as const,
    reason: `Completed receipt for attemptId ${ctx.attemptId} failed artifact readback.`,
    nextSafeAction: `Inspect workflow_state revisions for attemptId ${ctx.attemptId}.`,
  };
}

async function recoverSaveWorking(ctx: StageContext, backend: RunStateBackend | undefined) {
  const outcome = await inspectSaveOutcome(ctx, backend);
  if (outcome.conflict) {
    return {
      status: "uncertain" as const,
      reason: outcome.conflict,
      nextSafeAction: `Inspect save receipt and sql-save-attempt.json for attemptId ${ctx.attemptId}.`,
    };
  }
  if (outcome.receipt?.status === "complete" && outcome.receipt.attemptId === ctx.attemptId) {
    return recoverCompletedReceiptWorking(ctx, outcome.receipt, outcome.journal?.savedRefs ?? []);
  }
  if (outcome.journal?.status === "applied") {
    return { status: "finished" as const };
  }
  if (outcome.receipt?.status === "attempted" && outcome.receipt.attemptId === ctx.attemptId) {
    return { status: "retry" as const };
  }
  return {
    status: "uncertain" as const,
    reason: `Ambiguous save outcome for attemptId ${ctx.attemptId}: missing matching receipt.`,
    nextSafeAction: `Inspect save receipt for attemptId ${ctx.attemptId} before retrying.`,
  };
}

async function sealAndVerifyAppliedRefs(
  ctx: StageContext,
  refs: readonly SavedArtifactRef[],
  fallbackXdgHome?: string,
): Promise<StageVerifyResult> {
  let resolvedRevs: string[];
  try {
    resolvedRevs = await resolveSavedRefsRevisions(ctx, refs);
  } catch (error) {
    return {
      status: "blocked",
      reason: `${error instanceof Error ? error.message : String(error)} (attemptId ${ctx.attemptId}).`,
      nextSafeAction: `Inspect save artifacts for attemptId ${ctx.attemptId} before retrying.`,
      proof: { attemptId: ctx.attemptId, receiptStatus: "ambiguous", artifactRevisions: [] },
    };
  }
  await bindAndSealRowsReceipt(ctx, resolvedRevs, fallbackXdgHome);
  const reread = await readReceiptSafe(ctx);
  const rereadMatches =
    reread !== null &&
    reread.attemptId === ctx.attemptId &&
    reread.status === "complete" &&
    sameSortedIds(reread.artifactRevisions ?? [], resolvedRevs);
  if (!rereadMatches) {
    return {
      status: "blocked",
      reason: `Save receipt readback failed or mismatched after sealing attemptId ${ctx.attemptId}.`,
      nextSafeAction: `Inspect workflow_state receipt for attemptId ${ctx.attemptId}.`,
      proof: {
        attemptId: ctx.attemptId,
        runId: reread?.runId,
        receiptStatus: "ambiguous",
        artifactRevisions: resolvedRevs,
      },
    };
  }
  return {
    status: "verified",
    proof: {
      attemptId: ctx.attemptId,
      runId: reread.runId,
      receiptStatus: "complete",
      artifactRevisions: resolvedRevs,
      verifiedAt: new Date().toISOString(),
    },
  };
}

function blockedMissingSaveResult(ctx: StageContext, receipt: ReceiptRecord | null): StageVerifyResult {
  return {
    status: "blocked",
    reason: `Save attemptId ${ctx.attemptId} has no completed verified receipt or saved artifact readback.`,
    nextSafeAction: `Inspect save attempt ${ctx.attemptId} and re-run /b-loop ${ctx.pinnedPlan.subjectId}.`,
    proof: {
      attemptId: ctx.attemptId,
      runId: receipt?.runId,
      receiptStatus: receipt?.status ?? "attempted",
      artifactRevisions: [],
    },
  };
}

async function verifySaveResult(
  ctx: StageContext,
  backend: RunStateBackend | undefined,
  fallbackXdgHome?: string,
): Promise<StageVerifyResult> {
  const reviewErr = assertUpstreamReviewClean(ctx);
  if (reviewErr) {
    return { status: "blocked", reason: reviewErr, nextSafeAction: "Complete clean review before save." };
  }
  const outcome = await inspectSaveOutcome(ctx, backend);
  if (outcome.conflict) {
    return {
      status: "blocked",
      reason: outcome.conflict,
      nextSafeAction: `Inspect save receipt for attemptId ${ctx.attemptId}.`,
      proof: { attemptId: ctx.attemptId, receiptStatus: "ambiguous", artifactRevisions: [] },
    };
  }
  if (outcome.receipt?.status === "complete" && outcome.receipt.attemptId === ctx.attemptId) {
    return verifySaveFromCompletedReceipt(ctx, outcome.receipt, outcome.journal?.savedRefs ?? []);
  }
  const refs = outcome.journal?.savedRefs;
  if (outcome.journal?.status === "applied" && refs && refs.length > 0) {
    return sealAndVerifyAppliedRefs(ctx, refs, fallbackXdgHome);
  }
  return blockedMissingSaveResult(ctx, outcome.receipt);
}

function createSaveStageAdapter(
  backend: RunStateBackend | undefined,
  fallbackXdgHome?: string,
): StageAdapter {
  return {
    checkStarting: (ctx) => checkSaveStarting(ctx, backend),
    async prepareStarting(ctx) {
      const reviewErr = assertUpstreamReviewClean(ctx);
      if (reviewErr) throw new Error(reviewErr);
      const sqlErr = sqlAttemptConflict(ctx, readSqlAttemptFile(ctx.cwd));
      if (sqlErr) throw new Error(sqlErr);
      const staleReason = await checkReviewWorktreeFresh(ctx);
      if (staleReason) {
        return {
          blocked: {
            reason: staleReason,
            nextSafeAction: `Re-run /b-loop ${ctx.pinnedPlan.subjectId} to rebuild and re-review before save.`,
          },
        };
      }
      await writeReceiptSafe(ctx, {
        attemptId: ctx.attemptId,
        status: "attempted",
        artifactRevisions: [],
        kind: "no-fact",
        metadataDuties: [...SAVE_METADATA_DUTIES],
      }, fallbackXdgHome);
      await persistHandoff<SaveJournalRecord>(ctx, backend, "save", {
        attemptId: ctx.attemptId,
        subjectId: ctx.pinnedPlan.subjectId,
        phaseLogicalName: ctx.phase.logicalName,
        status: "attempted",
        savedRefs: [],
      });
    },
    async dispatchWorking(ctx) {
      const reviewErr = assertUpstreamReviewClean(ctx);
      if (reviewErr) throw new Error(reviewErr);
      const handle = await ctx.bridges.agent(saveStagePrompt(ctx), {
        agent: "task",
        label: `b-save:${ctx.phase.slug}`,
        tools: [...STAGE_TOOLS.save],
      });
      return { jobHandle: agentHandleId(handle), handle };
    },
    async awaitFinished(ctx, dispatched) {
      const rawOutput = await waitForAgentOutput(ctx.bridges, dispatched.handle);
      const { savedRefs, summary } = parseSavedArtifacts(rawOutput);
      await persistHandoff<SaveJournalRecord>(ctx, backend, "save", {
        attemptId: ctx.attemptId,
        subjectId: ctx.pinnedPlan.subjectId,
        phaseLogicalName: ctx.phase.logicalName,
        status: "applied",
        savedRefs,
        summary,
        completedAt: new Date().toISOString(),
      });
    },
    recoverWorking: (ctx) => recoverSaveWorking(ctx, backend),
    verifyResult: (ctx) => verifySaveResult(ctx, backend, fallbackXdgHome),
  };
}

const phase3CommitStubAdapter: StageAdapter = {
  async dispatchWorking() {
    return { jobHandle: null, handle: null };
  },
  async verifyResult() {
    return {
      status: "blocked",
      reason: "Commit stage is not enabled until Phase 4.",
      nextSafeAction: "Complete Phase 4 (git-commit-and-closeout) to enable verified git commits.",
    };
  },
};

/** Create default OMP eval stage adapters (`build`, `review`, `save`, and configurable `commit`). */
export function createDefaultStageAdapters(options: StageAdapterOptions = {}): StageAdapters {
  const { runStateBackend, xdgConfigHome } = options;
  return {
    build: createBuildStageAdapter(runStateBackend),
    review: createReviewStageAdapter(runStateBackend),
    save: createSaveStageAdapter(runStateBackend, xdgConfigHome),
    commit: options.commitAdapter ?? phase3CommitStubAdapter,
  };
}
