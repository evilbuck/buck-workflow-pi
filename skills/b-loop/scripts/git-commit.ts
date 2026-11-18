/**
 * Scoped Git staging, baseline/tree pinning, crash-safe commit adoption,
 * and final `subject-lifecycle.ts close-verified` integration for `/b-loop <subject>`.
 *
 * Zero bare npm dependencies so OMP's Bun eval worker links cleanly.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { unwrapToolResult } from "./frontmatter.js";
import { computeWorktreeFingerprint, STAGE_TOOLS } from "./stages.js";
import type {
  CommitStageProof,
  SaveStageProof,
  StageAdapter,
  StageContext,
  StageVerifyResult,
  SubjectCloseoutVerifier,
  ValidatedBridges,
} from "./types.js";
import {
  agentHandleId,
  COMMIT_SHA_RE,
  extractJsonObject,
  isWorkflowScratchPath,
  parsePorcelainZ,
  type PorcelainEntry,
  runSh,
  shellQuote,
  xdgEnvPrefixFor,
} from "./validation.js";

const SUBJECT_LIFECYCLE_CLI_PATH = fileURLToPath(
  new URL("../../_shared/scripts/subject-lifecycle.ts", import.meta.url),
);

interface DeclaredPathPattern {
  path: string;
  isDirPrefix: boolean;
}

interface ReadArtifactSnapshot {
  revision?: string;
  sha256: string;
  text: string;
}

type ArtifactTextTransform = (raw: string) => string;

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeDeclaredPath(raw: string): DeclaredPathPattern | null {
  const trimmed = raw.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.startsWith("/")) return null;
  const isDirPrefix = trimmed.endsWith("/");
  const stripped = trimmed.replace(/^\.\//, "");
  const cleaned = posix.normalize(stripped).replace(/\/+$/, "");
  if (!cleaned || cleaned === ".." || cleaned.startsWith("../") || cleaned === ".") return null;
  return { path: cleaned, isDirPrefix };
}

function matchesDeclaredFile(relPath: string, declaredFiles: readonly string[]): boolean {
  const norm = relPath.replace(/\\/g, "/");
  for (const rawDeclared of declaredFiles) {
    const entry = normalizeDeclaredPath(rawDeclared);
    if (!entry) continue;
    if (entry.isDirPrefix) {
      if (norm.startsWith(`${entry.path}/`)) return true;
    } else if (norm === entry.path) {
      return true;
    }
  }
  return false;
}

function isDeterministicRunnerMetadataPath(relPath: string, subjectId: string): boolean {
  const norm = relPath.replace(/\\/g, "/");
  return norm.startsWith(`.context/${subjectId}/`);
}

function isVerifiedSaveOutputPath(relPath: string, save: SaveStageProof | undefined): boolean {
  const norm = relPath.replace(/\\/g, "/");
  if (!save || save.receiptStatus !== "complete") return false;
  const allowed = save.savedPaths ?? [];
  return allowed.some((p) => p.replace(/\\/g, "/") === norm);
}

function isAllowedCommitPath(
  relPath: string,
  subjectId: string,
  declaredFiles: readonly string[],
  save?: SaveStageProof,
): boolean {
  const norm = relPath.replace(/\\/g, "/");
  if (isDeterministicRunnerMetadataPath(norm, subjectId)) return true;
  if (isVerifiedSaveOutputPath(norm, save)) return true;
  return matchesDeclaredFile(norm, declaredFiles);
}

async function gitRevParse(cwd: string, sh: ValidatedBridges["sh"], ref: string): Promise<string> {
  const out = (await runSh(sh, `git -C ${shellQuote(cwd)} rev-parse --verify ${shellQuote(ref)}`)).trim();
  if (!COMMIT_SHA_RE.test(out)) {
    throw new Error(`Unexpected git SHA from rev-parse ${ref}: "${out}"`);
  }
  return out;
}

async function gitWriteTree(cwd: string, sh: ValidatedBridges["sh"]): Promise<string> {
  const tree = (await runSh(sh, `git -C ${shellQuote(cwd)} write-tree`)).trim();
  if (!COMMIT_SHA_RE.test(tree)) {
    throw new Error(`Unexpected tree hash from git write-tree: "${tree}"`);
  }
  return tree;
}

async function inspectSingleParentCommit(
  cwd: string,
  sh: ValidatedBridges["sh"],
  commitSha: string,
): Promise<{ parent: string | null; tree: string; parentCount: number }> {
  const qCwd = shellQuote(cwd);
  const revLine = (await runSh(sh, `git -C ${qCwd} rev-list --parents -n 1 ${shellQuote(commitSha)}`)).trim();
  const parts = revLine.split(/\s+/).filter(Boolean);
  const tree = await gitRevParse(cwd, sh, `${commitSha}^{tree}`);
  return {
    parent: parts.length === 2 ? parts[1] : null,
    tree,
    parentCount: Math.max(0, parts.length - 1),
  };
}

async function assertCleanIndexForCommitAdoption(
  cwd: string,
  sh: ValidatedBridges["sh"],
  subjectId: string,
  declaredFiles: readonly string[],
  save?: SaveStageProof,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const qCwd = shellQuote(cwd);
  const statusZ = await runSh(sh, `git -C ${qCwd} status --porcelain=v1 --untracked-files=all -z`);
  try {
    assertAllowedDirtyEntries(parsePorcelainZ(statusZ), subjectId, declaredFiles, save);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const stagedRaw = await runSh(sh, `git -C ${qCwd} diff --cached --name-only -z`);
  const stagedNames = stagedRaw.split("\0").filter(Boolean);
  if (stagedNames.length > 0) {
    return {
      ok: false,
      reason: `Unexpected staged index changes present while adopting landed commit (${stagedNames.join(", ")}).`,
    };
  }
  return { ok: true };
}

async function verifyCommitMatchesPin(
  cwd: string,
  sh: ValidatedBridges["sh"],
  commitSha: string,
  baselineHead: string,
  expectedTree: string,
): Promise<{ matches: true } | { matches: false; reason: string }> {
  const info = await inspectSingleParentCommit(cwd, sh, commitSha);
  if (info.parentCount !== 1 || info.parent !== baselineHead) {
    return {
      matches: false,
      reason: `HEAD ${commitSha} parent mismatch (expected single parent ${baselineHead}, got count=${info.parentCount} parent=${info.parent ?? "none"}).`,
    };
  }
  if (info.tree !== expectedTree) {
    return {
      matches: false,
      reason: `HEAD ${commitSha} tree ${info.tree} does not match pinned expectedTree ${expectedTree}.`,
    };
  }
  return { matches: true };
}

function assertAllowedDirtyEntries(
  dirtyEntries: readonly PorcelainEntry[],
  subjectId: string,
  declaredFiles: readonly string[],
  save?: SaveStageProof,
): string[] {
  const unrelated: string[] = [];
  const toStage = new Set<string>();
  for (const entry of dirtyEntries) {
    const candidates = entry.origPath ? [entry.path, entry.origPath] : [entry.path];
    for (const p of candidates) {
      if (isWorkflowScratchPath(p)) continue;
      if (!isAllowedCommitPath(p, subjectId, declaredFiles, save)) {
        unrelated.push(p);
      } else {
        toStage.add(p);
      }
    }
  }
  if (unrelated.length > 0) {
    throw new Error(
      `Unrelated dirty files outside declared phase files and Buck metadata: ${unrelated.join(", ")}.`,
    );
  }
  return [...toStage];
}

async function validatePreExistingStagedIndex(
  ctx: StageContext,
  allowResumedAllowedStaged: boolean,
): Promise<void> {
  const qCwd = shellQuote(ctx.cwd);
  const stagedRaw = await runSh(ctx.bridges.sh, `git -C ${qCwd} diff --cached --name-only -z`);
  const stagedNames = stagedRaw.split("\0").filter(Boolean);
  if (stagedNames.length === 0) return;

  const save = ctx.checkpoint.phases[ctx.phase.logicalName]?.save;
  const canResetResumed =
    allowResumedAllowedStaged &&
    stagedNames.every(
      (p) => !isWorkflowScratchPath(p) && isAllowedCommitPath(p, ctx.pinnedPlan.subjectId, ctx.phase.files, save),
    );
  if (!canResetResumed) {
    throw new Error(
      `Pre-existing staged index changes detected (${stagedNames.join(", ")}); unstage them before running /b-loop commit.`,
    );
  }
  await runSh(ctx.bridges.sh, `git -C ${qCwd} reset --mixed HEAD --`);
}

const OPEN_CRITERION_LINE_RE = new RegExp("^\\s*-\\s*(?:[\"']?)\\[\\s\\]\\s*");

function rewriteFrontmatterLine(line: string, today: string, inCriteria: boolean): string {
  if (/^status:\s*/.test(line)) return "status: completed";
  if (/^completed_at:\s*/.test(line)) return `completed_at: ${today}`;
  if (/^completed_by:\s*/.test(line)) return "completed_by: b-loop";
  if (inCriteria && OPEN_CRITERION_LINE_RE.test(line)) return line.replace("[ ]", "[x]");
  return line;
}

function updateFrontmatterBlock(yamlLines: string[], today: string): string[] {
  const out: string[] = [];
  let inCriteria = false;
  let hasStatus = false;
  let hasCompletedAt = false;
  let hasCompletedBy = false;

  for (const line of yamlLines) {
    if (/^[A-Za-z0-9_-]+:/.test(line)) inCriteria = line.startsWith("acceptance_criteria:");
    if (/^status:\s*/.test(line)) hasStatus = true;
    else if (/^completed_at:\s*/.test(line)) hasCompletedAt = true;
    else if (/^completed_by:\s*/.test(line)) hasCompletedBy = true;
    out.push(rewriteFrontmatterLine(line, today, inCriteria));
  }
  if (!hasStatus) out.unshift("status: completed");
  if (!hasCompletedAt) out.push(`completed_at: ${today}`);
  if (!hasCompletedBy) out.push("completed_by: b-loop");
  return out;
}

function renderCompletedPhaseMarkdown(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return normalized;
  }
  const closeIdx = normalized.indexOf("\n---\n", 4);
  const eofCloseIdx = closeIdx < 0 && normalized.endsWith("\n---") ? normalized.length - 4 : closeIdx;
  if (eofCloseIdx < 0) return normalized;
  const yamlBlock = normalized.slice(4, eofCloseIdx).split("\n");
  const rest = normalized.slice(eofCloseIdx);
  const today = new Date().toISOString().slice(0, 10);
  const updatedYaml = updateFrontmatterBlock(yamlBlock, today).join("\n");
  return `---\n${updatedYaml}${rest}`;
}

function decodeArtifactBody(readRaw: Record<string, unknown> | null): string | null {
  if (typeof readRaw?.text === "string") return readRaw.text;
  if (typeof readRaw?.bytesBase64 === "string") {
    return Buffer.from(readRaw.bytesBase64, "base64").toString("utf8");
  }
  return null;
}

async function readArtifactSnapshot(
  ctx: StageContext,
  kind: string,
  logicalName: string,
): Promise<ReadArtifactSnapshot | null> {
  const readRaw = unwrapToolResult(
    await ctx.bridges.tool.workflow_state({
      operation: "read",
      subjectId: ctx.pinnedPlan.subjectId,
      kind,
      logicalName,
    }),
  ) as { revision?: string; sha256?: string; text?: string; bytesBase64?: string } | null;

  const diskPath = join(ctx.cwd, ".context", ctx.pinnedPlan.subjectId, logicalName);
  const storedText = decodeArtifactBody(readRaw);
  const text = storedText ?? (existsSync(diskPath) ? readFileSync(diskPath, "utf8") : null);
  if (text === null) return null;
  return {
    revision: readRaw?.revision,
    sha256: readRaw?.sha256 ?? sha256Hex(text),
    text,
  };
}

function computeExpectedText(
  snapshot: ReadArtifactSnapshot | null,
  pinnedSha256: string | undefined,
  transform: ArtifactTextTransform,
): { nextText: string; expectedSha256: string } | null {
  if (!snapshot) return null;
  if (pinnedSha256 && snapshot.sha256 === pinnedSha256) {
    return { nextText: snapshot.text, expectedSha256: pinnedSha256 };
  }
  const nextText = transform(snapshot.text);
  return { nextText, expectedSha256: sha256Hex(nextText) };
}

function syncArtifactDiskIfNeeded(diskPath: string, nextText: string): void {
  const currentDisk = existsSync(diskPath) ? readFileSync(diskPath, "utf8") : null;
  if (currentDisk === nextText) return;
  mkdirSync(dirname(diskPath), { recursive: true });
  writeFileSync(diskPath, nextText, "utf8");
}

async function commitArtifactUpdate(
  ctx: StageContext,
  kind: string,
  logicalName: string,
  snapshot: ReadArtifactSnapshot | null,
  nextText: string | null,
): Promise<{ revision?: string; sha256?: string }> {
  if (!snapshot || nextText === null) return {};
  const diskPath = join(ctx.cwd, ".context", ctx.pinnedPlan.subjectId, logicalName);
  if (nextText === snapshot.text && typeof snapshot.revision === "string") {
    // Unchanged revision: FileStorageStore already projected under its lock; only
    // repair a missing/divergent editable file without racing a later locked write.
    syncArtifactDiskIfNeeded(diskPath, nextText);
    return { revision: snapshot.revision, sha256: snapshot.sha256 };
  }
  const written = unwrapToolResult(
    await ctx.bridges.tool.workflow_state({
      operation: "write",
      subjectId: ctx.pinnedPlan.subjectId,
      kind,
      logicalName,
      body: nextText,
      expectedRevision: snapshot.revision ?? null,
    }),
  ) as { revision?: string; sha256?: string } | null;
  // Do not write the editable projection after writeBatch releases the store lock.
  // repo-files adapters project under the same locked section as the CAS write.
  return { revision: written?.revision, sha256: written?.sha256 ?? sha256Hex(nextText) };
}

function markOverviewRowCompleted(raw: string, phaseLogicalName: string): string {
  const lines = raw.split(/\r?\n/);
  const updated = lines.map((line) => {
    if (!line.includes(`(${phaseLogicalName})`) && !line.includes(`| ${phaseLogicalName}`)) return line;
    return line.replace(/\|\s*(?:pending|in-progress)\s*\|/i, "| completed |");
  });
  return updated.join("\n");
}

async function verifyPriorPhaseCommits(ctx: StageContext, baselineHead: string): Promise<void> {
  const idx = ctx.pinnedPlan.phases.findIndex((p) => p.logicalName === ctx.phase.logicalName);
  const priorPhases = idx > 0 ? ctx.pinnedPlan.phases.slice(0, idx) : [];
  for (const prev of priorPhases) {
    const sha = ctx.checkpoint.completedPhaseCommits[prev.logicalName];
    const commitProof = ctx.checkpoint.phases[prev.logicalName]?.commit;
    if (!sha || commitProof?.commitId !== sha) {
      throw new Error(`Final commit blocked: earlier phase ${prev.logicalName} lacks verified commit proof.`);
    }
    const objType = (await runSh(ctx.bridges.sh, `git -C ${shellQuote(ctx.cwd)} cat-file -t ${shellQuote(sha)}`)).trim();
    if (objType !== "commit") {
      throw new Error(`Final commit blocked: earlier phase commit ${sha} is invalid object "${objType}".`);
    }
    await runSh(ctx.bridges.sh, `git -C ${shellQuote(ctx.cwd)} merge-base --is-ancestor ${shellQuote(sha)} ${shellQuote(baselineHead)}`);
  }
}

interface LifecycleInspectPayload {
  state?: string;
  effectiveState?: string;
  canonical?: boolean;
  provenance?: string;
  verifiedClosed?: boolean;
  blockers?: string[];
}

async function inspectSubjectLifecycleJson(
  cwd: string,
  subjectId: string,
  sh: ValidatedBridges["sh"],
  xdgConfigHome?: string,
): Promise<LifecycleInspectPayload> {
  const subjectDir = join(cwd, ".context", subjectId);
  const prefix = xdgEnvPrefixFor(xdgConfigHome);
  const cmd = `${prefix}bun ${shellQuote(SUBJECT_LIFECYCLE_CLI_PATH)} inspect --subject ${shellQuote(subjectDir)} --json`;
  const raw = (await runSh(sh, cmd)).trim();
  try {
    return JSON.parse(raw) as LifecycleInspectPayload;
  } catch {
    throw new Error(`Invalid JSON from subject-lifecycle inspect: ${raw.slice(0, 160)}`);
  }
}

async function preflightSubjectCloseout(ctx: StageContext, fallbackXdgHome?: string): Promise<void> {
  const inspected = await inspectSubjectLifecycleJson(
    ctx.cwd,
    ctx.pinnedPlan.subjectId,
    ctx.bridges.sh,
    ctx.xdgConfigHome ?? fallbackXdgHome,
  );
  if (inspected.provenance === "malformed") {
    throw new Error("Final commit blocked: subject lifecycle index.md has malformed provenance.");
  }
  if (inspected.state !== "active" && inspected.state !== "completed") {
    throw new Error(`Final commit blocked: subject index.md must be active before close-verified (got ${inspected.state ?? "missing"}).`);
  }
  const ownIncompleteBlocker = `${ctx.phase.logicalName}: phase is not completed`;
  const otherBlockers = (inspected.blockers ?? []).filter((b) => b !== ownIncompleteBlocker);
  if (otherBlockers.length > 0) {
    throw new Error(`Final commit blocked by subject-lifecycle closeout blockers: ${otherBlockers.join("; ")}`);
  }
}

async function runSubjectLifecycleCloseVerified(
  ctx: StageContext,
  fallbackXdgHome?: string,
): Promise<void> {
  const subjectDir = join(ctx.cwd, ".context", ctx.pinnedPlan.subjectId);
  const prefix = xdgEnvPrefixFor(ctx.xdgConfigHome, fallbackXdgHome);
  const cmd = `${prefix}bun ${shellQuote(SUBJECT_LIFECYCLE_CLI_PATH)} close-verified --subject ${shellQuote(subjectDir)} --json`;
  const raw = (await runSh(ctx.bridges.sh, cmd)).trim();
  let parsed: { ok?: boolean; resultingState?: string; effectiveState?: string; code?: string; blockers?: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON from subject-lifecycle close-verified: ${raw.slice(0, 160)}`);
  }
  if (!parsed.ok || (parsed.resultingState !== "completed" && parsed.effectiveState !== "completed")) {
    const detail = Array.isArray(parsed.blockers) ? parsed.blockers.join("; ") : parsed.code ?? "not verified";
    throw new Error(`subject-lifecycle close-verified failed: ${detail}`);
  }
}

/** Verify completed subject closeout via `subject-lifecycle.ts inspect --json`. */
export const verifySubjectCloseoutWithLifecycle: SubjectCloseoutVerifier = async ({
  cwd,
  subjectId,
  sh,
  xdgConfigHome,
}) => {
  let parsed: LifecycleInspectPayload;
  try {
    parsed = await inspectSubjectLifecycleJson(cwd, subjectId, sh, xdgConfigHome);
  } catch (error) {
    return { ok: false, reason: `Subject closeout inspection failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  const hasBlockers = Array.isArray(parsed.blockers) && parsed.blockers.length > 0;
  if (!parsed.canonical || parsed.state !== "completed" || parsed.effectiveState !== "completed" || !parsed.verifiedClosed || hasBlockers) {
    const detail = hasBlockers
      ? parsed.blockers!.join("; ")
      : `state=${parsed.state ?? "unknown"} canonical=${String(parsed.canonical)}`;
    return { ok: false, reason: `Subject closeout not verified completed (${detail}).` };
  }
  return { ok: true };
};

async function stageAllowedPaths(cwd: string, sh: ValidatedBridges["sh"], paths: readonly string[]): Promise<void> {
  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40).map((p) => shellQuote(p)).join(" ");
    await runSh(sh, `git -C ${shellQuote(cwd)} add -A -- ${chunk}`);
  }
}

async function assertUpstreamReadyForCommit(ctx: StageContext): Promise<void> {
  const ps = ctx.checkpoint.phases[ctx.phase.logicalName];
  if (!ps?.build || ps.review?.verdict !== "clean" || ps.save?.receiptStatus !== "complete") {
    throw new Error(`Cannot prepare commit for ${ctx.phase.logicalName} before build, clean review, and completed save are verified.`);
  }
  if (!ps.review.worktreeFingerprint) {
    throw new Error(
      `Cannot prepare commit for ${ctx.phase.logicalName}: reviewed source freshness cannot be established (missing review worktree fingerprint).`,
    );
  }
  // Fingerprint ignores `.context/**`, so only declared source / HEAD drift invalidates review.
  const currentFp = await computeWorktreeFingerprint(ctx.cwd, ctx.bridges.sh);
  if (currentFp !== ps.review.worktreeFingerprint) {
    throw new Error(
      `Cannot prepare commit for ${ctx.phase.logicalName}: declared source snapshot changed since clean review.`,
    );
  }
}

function buildCommitStageProof(params: {
  baselineHead: string;
  expectedTree: string;
  isFinalPhase: boolean;
  phaseRes: { revision?: string; sha256?: string };
  phaseExpectedSha?: string;
  overviewExpectedSha?: string;
}): CommitStageProof {
  const proof: CommitStageProof = {
    baselineHead: params.baselineHead,
    expectedTree: params.expectedTree,
  };
  if (params.isFinalPhase) proof.closeoutApplied = true;
  if (params.phaseRes.revision) proof.completedPhaseRevision = params.phaseRes.revision;
  if (params.phaseRes.sha256) proof.completedPhaseSha256 = params.phaseRes.sha256;
  if (params.phaseExpectedSha) proof.expectedPhaseSha256 = params.phaseExpectedSha;
  if (params.overviewExpectedSha) proof.expectedOverviewSha256 = params.overviewExpectedSha;
  return proof;
}

async function pinPreMutationCommitProof(
  ctx: StageContext,
  baselineHead: string,
  expectedPhaseSha256?: string,
  expectedOverviewSha256?: string,
): Promise<void> {
  if (!ctx.pinStageProof) return;
  const prePin: CommitStageProof = { baselineHead };
  if (expectedPhaseSha256) prePin.expectedPhaseSha256 = expectedPhaseSha256;
  if (expectedOverviewSha256) prePin.expectedOverviewSha256 = expectedOverviewSha256;
  await ctx.pinStageProof(prePin);
}

async function stageAndWriteExpectedTree(ctx: StageContext): Promise<string> {
  const qCwd = shellQuote(ctx.cwd);
  const postStatus = await runSh(ctx.bridges.sh, `git -C ${qCwd} status --porcelain=v1 --untracked-files=all -z`);
  const save = ctx.checkpoint.phases[ctx.phase.logicalName]?.save;
  const toStage = assertAllowedDirtyEntries(
    parsePorcelainZ(postStatus),
    ctx.pinnedPlan.subjectId,
    ctx.phase.files,
    save,
  );
  if (toStage.length > 0) {
    await stageAllowedPaths(ctx.cwd, ctx.bridges.sh, toStage);
  }
  return gitWriteTree(ctx.cwd, ctx.bridges.sh);
}

async function assertFreshCommitHygiene(
  ctx: StageContext,
  baselineHead: string,
  existingPrep: CommitStageProof | undefined,
  fallbackXdgHome: string | undefined,
  isFinalPhase: boolean,
): Promise<void> {
  const qCwd = shellQuote(ctx.cwd);
  const resumingIncompletePrep = Boolean(existingPrep?.baselineHead && !existingPrep.expectedTree);
  await validatePreExistingStagedIndex(ctx, resumingIncompletePrep);
  const initialStatus = await runSh(ctx.bridges.sh, `git -C ${qCwd} status --porcelain=v1 --untracked-files=all -z`);
  const save = ctx.checkpoint.phases[ctx.phase.logicalName]?.save;
  assertAllowedDirtyEntries(parsePorcelainZ(initialStatus), ctx.pinnedPlan.subjectId, ctx.phase.files, save);
  if (isFinalPhase) {
    await verifyPriorPhaseCommits(ctx, baselineHead);
    await preflightSubjectCloseout(ctx, fallbackXdgHome);
  }
}

async function prepareFreshCommitTree(
  ctx: StageContext,
  baselineHead: string,
  existingPrep?: CommitStageProof,
  fallbackXdgHome?: string,
): Promise<CommitStageProof> {
  const isFinalPhase = ctx.pinnedPlan.phases[ctx.pinnedPlan.phases.length - 1]?.logicalName === ctx.phase.logicalName;
  await assertFreshCommitHygiene(ctx, baselineHead, existingPrep, fallbackXdgHome, isFinalPhase);

  const phaseSnap = await readArtifactSnapshot(ctx, "phase", ctx.phase.logicalName);
  const phasePlan = computeExpectedText(phaseSnap, existingPrep?.expectedPhaseSha256, renderCompletedPhaseMarkdown);
  const overviewLogical = ctx.pinnedPlan.overviewLogicalName;
  const overviewSnap = overviewLogical ? await readArtifactSnapshot(ctx, "plan", overviewLogical) : null;
  const overviewPlan = computeExpectedText(overviewSnap, existingPrep?.expectedOverviewSha256, (raw) =>
    markOverviewRowCompleted(raw, ctx.phase.logicalName),
  );

  await pinPreMutationCommitProof(ctx, baselineHead, phasePlan?.expectedSha256, overviewPlan?.expectedSha256);
  const phaseRes = await commitArtifactUpdate(ctx, "phase", ctx.phase.logicalName, phaseSnap, phasePlan?.nextText ?? null);
  if (overviewLogical && overviewPlan) {
    await commitArtifactUpdate(ctx, "plan", overviewLogical, overviewSnap, overviewPlan.nextText);
  }
  if (isFinalPhase) {
    await runSubjectLifecycleCloseVerified(ctx, fallbackXdgHome);
  }

  const expectedTree = await stageAndWriteExpectedTree(ctx);
  return buildCommitStageProof({
    baselineHead,
    expectedTree,
    isFinalPhase,
    phaseRes,
    phaseExpectedSha: phasePlan?.expectedSha256,
    overviewExpectedSha: overviewPlan?.expectedSha256,
  });
}

async function checkPinnedCommitAtBaseline(
  ctx: StageContext,
  existing: CommitStageProof & { expectedTree: string },
) {
  const currentTree = await gitWriteTree(ctx.cwd, ctx.bridges.sh);
  if (currentTree === existing.expectedTree) return { status: "dispatch" as const };
  return {
    status: "blocked" as const,
    reason: `Staged index tree ${currentTree} does not match pinned expectedTree ${existing.expectedTree} at baselineHead ${existing.baselineHead}.`,
    nextSafeAction: `Inspect git status/diff against expectedTree ${existing.expectedTree} before re-running /b-loop.`,
  };
}

async function checkPinnedCommitAdoption(
  ctx: StageContext,
  existing: CommitStageProof & { expectedTree: string },
  currentHead: string,
) {
  const match = await verifyCommitMatchesPin(ctx.cwd, ctx.bridges.sh, currentHead, existing.baselineHead, existing.expectedTree);
  if (!match.matches) {
    return {
      status: "blocked" as const,
      reason: match.reason,
      nextSafeAction: `Inspect HEAD ${currentHead} against expected baselineHead ${existing.baselineHead} and expectedTree ${existing.expectedTree}.`,
    };
  }
  const clean = await assertCleanIndexForCommitAdoption(
    ctx.cwd,
    ctx.bridges.sh,
    ctx.pinnedPlan.subjectId,
    ctx.phase.files,
    ctx.checkpoint.phases[ctx.phase.logicalName]?.save,
  );
  if (!clean.ok) {
    return {
      status: "blocked" as const,
      reason: clean.reason,
      nextSafeAction: `Inspect index/worktree before adopting commit ${currentHead}.`,
    };
  }
  return { status: "already-finished" as const };
}

async function checkFullyPinnedCommitStarting(
  ctx: StageContext,
  existing: CommitStageProof & { expectedTree: string },
) {
  const currentHead = await gitRevParse(ctx.cwd, ctx.bridges.sh, "HEAD");
  if (currentHead === existing.baselineHead) {
    return checkPinnedCommitAtBaseline(ctx, existing);
  }
  return checkPinnedCommitAdoption(ctx, existing, currentHead);
}

async function checkCommitStarting(ctx: StageContext) {
  const existing = ctx.checkpoint.phases[ctx.phase.logicalName]?.commit;
  if (existing?.baselineHead && existing.expectedTree) {
    return checkFullyPinnedCommitStarting(ctx, existing as CommitStageProof & { expectedTree: string });
  }
  try {
    await assertUpstreamReadyForCommit(ctx);
  } catch (error) {
    return {
      status: "blocked" as const,
      reason: error instanceof Error ? error.message : String(error),
      nextSafeAction: "Complete build, review, and save before commit.",
    };
  }
  if (!existing?.baselineHead) {
    return { status: "dispatch" as const };
  }
  const currentHead = await gitRevParse(ctx.cwd, ctx.bridges.sh, "HEAD");
  if (currentHead === existing.baselineHead) return { status: "dispatch" as const };
  return {
    status: "blocked" as const,
    reason: `HEAD moved from pre-pinned baselineHead ${existing.baselineHead} to ${currentHead} before expectedTree was finalized.`,
    nextSafeAction: "Inspect git log and reset or re-verify before re-running /b-loop.",
  };
}

async function verifyExistingPinnedTreeStage(
  ctx: StageContext,
  existing: CommitStageProof & { expectedTree: string },
  currentHead: string,
): Promise<{ proof: CommitStageProof }> {
  if (currentHead === existing.baselineHead) {
    const currentTree = await gitWriteTree(ctx.cwd, ctx.bridges.sh);
    if (currentTree !== existing.expectedTree) {
      throw new Error(`Staged index tree ${currentTree} drifted from pinned expectedTree ${existing.expectedTree}.`);
    }
    return { proof: existing };
  }
  const match = await verifyCommitMatchesPin(ctx.cwd, ctx.bridges.sh, currentHead, existing.baselineHead, existing.expectedTree);
  if (!match.matches) throw new Error(match.reason);
  return { proof: existing };
}

async function prepareCommitStarting(
  ctx: StageContext,
  fallbackXdgHome?: string,
): Promise<{ proof: CommitStageProof }> {
  const existing = ctx.checkpoint.phases[ctx.phase.logicalName]?.commit;
  const currentHead = await gitRevParse(ctx.cwd, ctx.bridges.sh, "HEAD");
  if (existing?.baselineHead && existing.expectedTree) {
    // Existing pin: adopt or continue without re-checking review freshness against post-commit HEAD.
    return verifyExistingPinnedTreeStage(ctx, existing as CommitStageProof & { expectedTree: string }, currentHead);
  }
  await assertUpstreamReadyForCommit(ctx);
  if (existing?.baselineHead && currentHead !== existing.baselineHead) {
    throw new Error(`HEAD moved from pre-pinned baselineHead ${existing.baselineHead} to ${currentHead} before tree pinning finished.`);
  }
  const proof = await prepareFreshCommitTree(ctx, existing?.baselineHead ?? currentHead, existing, fallbackXdgHome);
  return { proof };
}

function commitPrompt(ctx: StageContext, proof: CommitStageProof): string {
  return [
    `Draft a Conventional Commits message for phase ${ctx.phase.logicalName} in subject ${ctx.pinnedPlan.subjectId}.`,
    `Pinned tree: ${proof.expectedTree} (baseline HEAD: ${proof.baselineHead}).`,
    "Do NOT edit files or run git commands; the supervisor executes git commit against the pinned staged tree.",
    'Return JSON: {"title":"feat(scope): summary","body":"optional concise rationale"}.',
  ].join("\n");
}

function unwrapCommitDraftText(item: unknown): string {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  const rec = item as { text?: unknown; output?: unknown };
  if (typeof rec.text === "string") return rec.text;
  if (typeof rec.output === "string") return rec.output;
  return "";
}

function formatCommitMessageText(raw: string, defaultTitle: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return defaultTitle;
  const parsed = extractJsonObject(trimmed);
  if (parsed && typeof parsed.title === "string" && parsed.title.trim()) {
    const title = parsed.title.trim().split(/\r?\n/)[0];
    const body = typeof parsed.body === "string" && parsed.body.trim() ? `\n\n${parsed.body.trim()}` : "";
    return `${title}${body}`;
  }
  const firstLine = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("```"));
  return firstLine && firstLine.length <= 100 ? firstLine : defaultTitle;
}

async function extractCommitMessage(ctx: StageContext, handle: unknown): Promise<string> {
  const defaultTitle = `chore(b-loop): complete ${ctx.phase.slug}`;
  if (!handle || (handle as { alreadyMoved?: boolean }).alreadyMoved) return defaultTitle;
  const waited = await ctx.bridges.wait([handle]);
  const item = Array.isArray(waited) ? waited[0] : waited;
  return formatCommitMessageText(unwrapCommitDraftText(item), defaultTitle);
}

async function recoverCommitWorking(ctx: StageContext) {
  const proof = ctx.checkpoint.phases[ctx.phase.logicalName]?.commit;
  if (!proof?.baselineHead || !proof.expectedTree) {
    return {
      status: "uncertain" as const,
      reason: "Interrupted commit checkpoint lacks baselineHead or expectedTree pin.",
      nextSafeAction: "Inspect git status and checkpoint before retrying commit.",
    };
  }
  const currentHead = await gitRevParse(ctx.cwd, ctx.bridges.sh, "HEAD");
  if (currentHead === proof.baselineHead) {
    const currentTree = await gitWriteTree(ctx.cwd, ctx.bridges.sh);
    if (currentTree === proof.expectedTree) {
      return { status: "retry" as const };
    }
    return {
      status: "uncertain" as const,
      reason: `Staged index tree ${currentTree} differs from pinned expectedTree ${proof.expectedTree}.`,
      nextSafeAction: "Inspect staged index and working tree before retrying.",
    };
  }
  const match = await verifyCommitMatchesPin(ctx.cwd, ctx.bridges.sh, currentHead, proof.baselineHead, proof.expectedTree);
  if (match.matches) {
    const clean = await assertCleanIndexForCommitAdoption(
      ctx.cwd,
      ctx.bridges.sh,
      ctx.pinnedPlan.subjectId,
      ctx.phase.files,
      ctx.checkpoint.phases[ctx.phase.logicalName]?.save,
    );
    if (!clean.ok) {
      return {
        status: "uncertain" as const,
        reason: clean.reason,
        nextSafeAction: `Inspect index/worktree before adopting commit ${currentHead}.`,
      };
    }
    return { status: "finished" as const };
  }
  return {
    status: "uncertain" as const,
    reason: match.reason,
    nextSafeAction: `Inspect HEAD ${currentHead} against baselineHead ${proof.baselineHead} and expectedTree ${proof.expectedTree}.`,
  };
}

async function verifyCommitAtBaseline(ctx: StageContext, proof: CommitStageProof): Promise<StageVerifyResult> {
  const currentTree = await gitWriteTree(ctx.cwd, ctx.bridges.sh);
  if (currentTree === proof.expectedTree) {
    return { status: "stale_or_missing", reason: `Commit at expectedTree ${proof.expectedTree} has not landed yet.` };
  }
  return {
    status: "blocked",
    reason: `Index tree ${currentTree} diverges from pinned expectedTree ${proof.expectedTree}.`,
    nextSafeAction: `Inspect git status at HEAD ${proof.baselineHead} before retrying.`,
  };
}

async function verifyFinalCommitCloseoutIfLast(
  ctx: StageContext,
  currentHead: string,
  fallbackXdgHome?: string,
): Promise<StageVerifyResult | null> {
  const lastLogical = ctx.pinnedPlan.phases[ctx.pinnedPlan.phases.length - 1]?.logicalName;
  if (lastLogical !== ctx.phase.logicalName) return null;
  const closeout = await verifySubjectCloseoutWithLifecycle({
    cwd: ctx.cwd,
    subjectId: ctx.pinnedPlan.subjectId,
    sh: ctx.bridges.sh,
    xdgConfigHome: ctx.xdgConfigHome ?? fallbackXdgHome,
  });
  if (closeout.ok) return null;
  return {
    status: "blocked",
    reason: closeout.reason,
    nextSafeAction: `Ensure subject-lifecycle close-verified landed in final commit ${currentHead}.`,
  };
}

async function verifyCommitResult(
  ctx: StageContext,
  fallbackXdgHome?: string,
): Promise<StageVerifyResult> {
  const proof = ctx.checkpoint.phases[ctx.phase.logicalName]?.commit;
  if (!proof?.baselineHead || !proof.expectedTree) {
    return { status: "stale_or_missing", reason: "Commit baselineHead and expectedTree are missing." };
  }
  const currentHead = await gitRevParse(ctx.cwd, ctx.bridges.sh, "HEAD");
  if (currentHead === proof.baselineHead) {
    return verifyCommitAtBaseline(ctx, proof);
  }
  const match = await verifyCommitMatchesPin(ctx.cwd, ctx.bridges.sh, currentHead, proof.baselineHead, proof.expectedTree);
  if (!match.matches) {
    return {
      status: "blocked",
      reason: match.reason,
      nextSafeAction: `Inspect HEAD ${currentHead} vs expected parent ${proof.baselineHead} and expectedTree ${proof.expectedTree}.`,
    };
  }
  const clean = await assertCleanIndexForCommitAdoption(
    ctx.cwd,
    ctx.bridges.sh,
    ctx.pinnedPlan.subjectId,
    ctx.phase.files,
    ctx.checkpoint.phases[ctx.phase.logicalName]?.save,
  );
  if (!clean.ok) {
    return {
      status: "blocked",
      reason: clean.reason,
      nextSafeAction: `Inspect index/worktree before adopting commit ${currentHead}.`,
    };
  }
  const closeoutErr = await verifyFinalCommitCloseoutIfLast(ctx, currentHead, fallbackXdgHome);
  if (closeoutErr) return closeoutErr;
  return {
    status: "verified",
    commitId: currentHead,
    proof: {
      ...proof,
      commitId: currentHead,
      verifiedAt: new Date().toISOString(),
    },
  };
}

function pinnedCommitProofOrThrow(ctx: StageContext): CommitStageProof & { expectedTree: string } {
  const proof = ctx.checkpoint.phases[ctx.phase.logicalName]?.commit;
  if (!proof?.baselineHead || !proof.expectedTree) {
    throw new Error("Commit stage requires pinned baselineHead and expectedTree.");
  }
  return proof as CommitStageProof & { expectedTree: string };
}

async function dispatchCommitWorking(ctx: StageContext) {
  const proof = pinnedCommitProofOrThrow(ctx);
  const currentHead = await gitRevParse(ctx.cwd, ctx.bridges.sh, "HEAD");
  if (currentHead !== proof.baselineHead) {
    return { jobHandle: null, handle: { alreadyMoved: true } };
  }
  const handle = await ctx.bridges.agent(commitPrompt(ctx, proof), {
    agent: "task",
    label: `b-commit:${ctx.phase.slug}`,
    tools: [...STAGE_TOOLS.commit],
  });
  return { jobHandle: agentHandleId(handle), handle };
}

async function awaitCommitFinished(ctx: StageContext, dispatched: { handle?: unknown }) {
  const proof = pinnedCommitProofOrThrow(ctx);
  const currentHead = await gitRevParse(ctx.cwd, ctx.bridges.sh, "HEAD");
  if (currentHead !== proof.baselineHead) return;
  const currentTree = await gitWriteTree(ctx.cwd, ctx.bridges.sh);
  if (currentTree !== proof.expectedTree) {
    throw new Error(`Refusing commit: staged tree ${currentTree} != expectedTree ${proof.expectedTree}.`);
  }
  const message = await extractCommitMessage(ctx, dispatched.handle);
  const qCwd = shellQuote(ctx.cwd);
  const eof = `__BLOOP_COMMIT_${randomUUID().replace(/-/g, "")}__`;
  // Create the commit from the pinned tree+parent, not whatever the index becomes after the wait.
  const commitSha = (
    await runSh(
      ctx.bridges.sh,
      `git -C ${qCwd} commit-tree ${shellQuote(proof.expectedTree)} -p ${shellQuote(proof.baselineHead)} -F - <<'${eof}'\n${message}\n${eof}`,
    )
  ).trim();
  if (!COMMIT_SHA_RE.test(commitSha)) {
    throw new Error(`Unexpected commit-tree SHA "${commitSha}".`);
  }
  const branchRef = ctx.pinnedPlan.branchRef;
  // Conditionally advance the branch only if it still points at baselineHead.
  await runSh(
    ctx.bridges.sh,
    `git -C ${qCwd} update-ref ${shellQuote(branchRef)} ${shellQuote(commitSha)} ${shellQuote(proof.baselineHead)}`,
  );
}

/** Build the guarded `commit` stage adapter with scoped staging, tree pinning, and closeout folding. */
export function createCommitStageAdapter(options: { xdgConfigHome?: string } = {}): StageAdapter {
  const { xdgConfigHome } = options;
  return {
    checkStarting: checkCommitStarting,
    prepareStarting: (ctx) => prepareCommitStarting(ctx, xdgConfigHome),
    dispatchWorking: dispatchCommitWorking,
    awaitFinished: awaitCommitFinished,
    recoverWorking: recoverCommitWorking,
    verifyResult: (ctx) => verifyCommitResult(ctx, xdgConfigHome),
  };
}
