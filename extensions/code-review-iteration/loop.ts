/**
 * loop — the bounded Reviewer → Fixer → fresh-Reviewer orchestration.
 *
 * One visibly bounded command, not a workflow engine: deterministic git
 * lifecycle around two isolated model sessions per pass, immutable pass
 * artifacts, resumable run state, and terminal outcomes of exactly
 * clean | blocked | exhausted | cancelled | failed. All model/git/IO
 * effects are injected so the sequencing is unit-testable end to end.
 */

import { readFileSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import type { CatalogLoad, FixerSelection, ModelCatalogEntry } from "./catalog.js";
import { reviewerThinking, selectFixerModel, thinkingFor } from "./catalog.js";
import { extractJson, maxBlockingHardness, validateFindingsPayload, type ValidatedFinding } from "./findings.js";
import {
  abortRebase,
  capturePreRun,
  changedPathsSince,
  checkpointCommit,
  createDetachedWorktree,
  detectBaseBranch,
  fetchBase,
  gitCommonDir,
  hasOngoingGitOperation,
  isGitCheckout,
  listUntracked,
  removeWorktree,
  resolveHead,
  resolveAndContinue,
  rebaseOntoFetched,
  conflictedFiles,
  worktreeFingerprint,
  currentBranch,
} from "./git-ops.js";
import { assembleFixerPrompt, assembleReviewerPrompt, type Persona } from "./prompts.js";
import type { CommandRecord, ReviewExecRequest } from "./policy.js";
import {
  appendCommandRecord,
  createRun,
  findResumable,
  newRunId,
  passDirFor,
  saveState,
  validateResume,
  writePassFixer,
  writePassReview,
  writePassReviewMarkdown,
  type FixerDisposition,
  type MinBlocking,
  type PassFixerRecord,
  type PassReviewRecord,
  type RunState,
} from "./run-state.js";
import { renderFinalReport, renderPassReviewMarkdown, resolveReportSubject, writeFinalReport } from "./report.js";
import { HARDNESSES, type Hardness, type Rating } from "./rubric.js";

const RATING_ORDER: readonly Rating[] = ["advisory", "low", "medium", "high", "critical"];
const MAX_REBASE_ATTEMPTS = 20;

export class LoopCancelledError extends Error {
  constructor() {
    super("review loop cancelled");
    this.name = "LoopCancelledError";
  }
}

export interface LoopDeps {
  runReviewerSession(opts: {
    cwd: string;
    prompt: string;
    model: string | null;
    temperature: number | null;
    thinkingLevel?: string | null;
    onCommand: (request: ReviewExecRequest) => Promise<CommandRecord>;
  }): Promise<string>;
  runFixerSession(opts: { cwd: string; prompt: string; model: string | null; thinkingLevel?: string | null }): Promise<string>;
  /** Execute one allowlisted review command; `seq` assigns its evidence id. */
  execReviewCommand(root: string, request: ReviewExecRequest, seq: number): Promise<CommandRecord>;
  runChecks(cwd: string): Promise<{ command: string; exitCode: number | null; passed: boolean }>;
  availableSelectors(): Promise<Set<string>>;
  loadCatalog(): CatalogLoad;
  fixerFallbackModel(tier: Hardness): string | null;
  baseGuidance(): string;
  persona(): Persona | null;
  untrackedSelection(paths: string[]): Promise<string[]>;
  notify(message: string, level?: "info" | "warning" | "error"): void;
  contextDir(cwd: string): string;
}

export interface LoopOptions {
  base?: string;
  reviewerModel?: string;
  reviewerRole?: string;
  reviewerTemperature?: number;
  fixerModel?: string;
  personaName: string | null;
  appendContext?: string;
  replacementGuidance?: string;
  minBlocking: MinBlocking;
  maxPasses: number;
  resume: boolean;
}

export interface LoopResult {
  status: RunState["status"];
  runId: string;
  reportPath: string | null;
}

function effectiveBlocking(finding: ValidatedFinding, minBlocking: MinBlocking): boolean {
  return RATING_ORDER.indexOf(finding.rating) >= RATING_ORDER.indexOf(minBlocking);
}

function blockingFindings(findings: ValidatedFinding[], minBlocking: MinBlocking): ValidatedFinding[] {
  return findings.filter((f) => effectiveBlocking(f, minBlocking));
}

function blockingSummary(findings: ValidatedFinding[]): string {
  return findings
    .map((f) => `- ${f.id} [${f.rating}/${f.score}, hardness ${f.fixHardness}] ${f.title} — ${f.location}`)
    .join("\n");
}

interface LoopContext {
  cwd: string;
  commonDir: string;
  branch: string | null;
  runDir: string | null;
  state: RunState | null;
  options: LoopOptions;
}

function terminalize(ctx: LoopContext, status: RunState["status"], reason: string): void {
  if (!ctx.state || !ctx.runDir) return;
  ctx.state.status = status;
  ctx.state.terminal = { reason, at: new Date().toISOString() };
  saveState(ctx.runDir, ctx.state);
}

async function resolveRebaseConflictsWithFixer(
  deps: LoopDeps,
  ctx: LoopContext,
  fixerModel: string | null,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_REBASE_ATTEMPTS; attempt++) {
    const files = conflictedFiles(ctx.cwd);
    if (files.length === 0) return true;
    const prompt =
      `You are resolving a git rebase conflict onto origin/${ctx.state?.base_branch ?? "base"}. ` +
      `These files have unresolved conflict markers:\n\n${files.map((f) => `- ${f}`).join("\n")}\n\n` +
      `For EACH file: read it, reconcile both sides, remove ALL conflict markers, and write the correct merged content. ` +
      `Do NOT run git. Do not add commentary.`;
    try {
      await deps.runFixerSession({ cwd: ctx.cwd, prompt, model: fixerModel });
    } catch (e: unknown) {
      deps.notify(`rebase-conflict fixer session failed: ${(e as Error).message}`, "error");
      return false;
    }
    const result = resolveAndContinue(ctx.cwd, files);
    if (result.status === "ok") return true;
    if (result.status === "failed") {
      deps.notify(`rebase continuation failed: ${result.error ?? "unknown"}`, "error");
      return false;
    }
  }
  return false;
}

async function prepareBaseAndCheckpoint(deps: LoopDeps, ctx: LoopContext): Promise<RunState["status"] | "continue"> {
  const base = ctx.options.base ?? detectBaseBranch(ctx.cwd);
  if (!base) {
    deps.notify("No origin default branch detected and no --base given; refusing to review a stale base.", "error");
    return "failed";
  }
  // Checkpoint the dirty start BEFORE fetching and rebasing: the checkpoint
  // lands on the current base, so the rebase runs on a clean tree and never
  // needs an autostash. With an autostash, a rebase conflict followed by
  // `--continue` can leave the autostash reapply conflict (UU + markers) in
  // the working tree, which the checkpoint would then commit.
  const pre = capturePreRun(ctx.cwd);
  if (pre.dirty) {
    const selected = await deps.untrackedSelection(pre.untracked);
    const sha = checkpointCommit(ctx.cwd, selected, "chore(code-review): pre-review checkpoint");
    if (ctx.state) {
      ctx.state.checkpoint_commit = sha;
      ctx.state.worktree_fingerprint = worktreeFingerprint(ctx.cwd);
    }
    deps.notify(
      `Dirty start checkpointed${sha ? ` at ${sha.slice(0, 12)}` : " (nothing staged)"}; ${selected.length}/${pre.untracked.length} untracked path(s) included.`,
      "info",
    );
  }
  if (ctx.state) ctx.state.base_branch = base;
  const fetched = fetchBase(ctx.cwd, base);
  if (!fetched.ok || !fetched.commit) {
    deps.notify(`git fetch origin ${base} failed: ${fetched.error ?? "unknown"}. Hard stop.`, "error");
    return "failed";
  }
  const rebase = rebaseOntoFetched(ctx.cwd);
  if (rebase.status === "failed") {
    deps.notify(`rebase onto fetched ${base} failed: ${rebase.error ?? "unknown"}. Hard stop.`, "error");
    return "failed";
  }
  if (rebase.status === "conflict") {
    deps.notify(`rebase conflict in ${rebase.files.length} file(s); routing to a hard-capability Fixer.`, "info");
    const hardFixer = ctx.options.fixerModel
      ?? deps.loadCatalog().entries.find((e) => e.fixerCapability === "hard")?.selector
      ?? deps.fixerFallbackModel("hard");
    const resolved = await resolveRebaseConflictsWithFixer(deps, ctx, hardFixer ?? null);
    if (!resolved) {
      abortRebase(ctx.cwd);
      deps.notify("Could not complete the rebase; aborted and restored the pre-run state.", "error");
      return "failed";
    }
  }
  if (ctx.state) ctx.state.base_commit = fetched.commit;
  return "continue";
}

function nullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function reviewerPrompt(deps: LoopDeps, ctx: LoopContext, pass: number, reviewedHead: string): string {
  const persona = deps.persona();
  const state = ctx.state!;
  const replacement = ctx.options.replacementGuidance;
  return assembleReviewerPrompt({
    branch: ctx.branch,
    reviewedHead,
    baseBranch: state.base_branch,
    baseCommit: state.base_commit,
    pass,
    baseGuidance: deps.baseGuidance(),
    personaBody: replacement === undefined ? nullable(persona?.body) : null,
    appendContext: nullable(ctx.options.appendContext),
    replacementGuidance: nullable(replacement),
  });
}

interface ValidatedReview {
  findings: ValidatedFinding[];
  errors: string[];
}

function reviewThinking(deps: LoopDeps, selector: string | null): string | null {
  return reviewerThinking(selector, deps.loadCatalog().entries);
}

function reviewRecord(deps: LoopDeps, ctx: LoopContext, reviewedHead: string, validation: ValidatedReview): PassReviewRecord {
  const state = ctx.state!;
  const persona = deps.persona();
  const thinking = reviewThinking(deps, state.reviewer_model);
  return {
    persona: persona ? persona.name : "(replacement)",
    requested_model: state.reviewer_model,
    requested_temperature: state.requested_temperature,
    thinking_level: thinking,
    reviewed_head: reviewedHead,
    findings: validation.findings,
    errors: validation.errors,
  };
}

function commandRecorder(
  deps: LoopDeps,
  ctx: LoopContext,
  worktreePath: string,
  pass: number,
  executedIds: string[],
): (request: ReviewExecRequest) => Promise<CommandRecord> {
  return async (request) => {
    const seq = executedIds.length + 1;
    const record = await deps.execReviewCommand(worktreePath, request, seq);
    executedIds.push(record.evidence_id ?? `c${seq}`);
    appendCommandRecord(ctx.runDir!, pass, record);
    return record;
  };
}

function parseReviewerOutput(raw: string, evidenceIds: string[]): { validation: ValidatedReview } | { error: string } {
  let validation: ValidatedReview;
  try {
    validation = validateFindingsPayload(extractJson(raw), new Set(evidenceIds));
  } catch (e: unknown) {
    return { error: `reviewer output unusable: ${(e as Error).message}` };
  }
  if (validation.errors.length > 0) {
    // A payload that violates the findings contract must never be read as
    // "no findings": that would terminalize the loop as clean.
    return { error: `reviewer payload failed validation:\n${validation.errors.join("\n")}` };
  }
  return { validation };
}

async function runSessionAndRecordReview(
  deps: LoopDeps,
  ctx: LoopContext,
  pass: number,
  reviewedHead: string,
  worktreePath: string,
  executedIds: string[],
): Promise<{ review: PassReviewRecord } | { error: string }> {
  const raw = await deps.runReviewerSession({
    cwd: worktreePath,
    prompt: reviewerPrompt(deps, ctx, pass, reviewedHead),
    model: ctx.state?.reviewer_model ?? null,
    temperature: ctx.state?.requested_temperature ?? null,
    thinkingLevel: reviewThinking(deps, ctx.state?.reviewer_model ?? null),
    onCommand: commandRecorder(deps, ctx, worktreePath, pass, executedIds),
  });
  const output = parseReviewerOutput(raw, executedIds);
  if ("error" in output) return output;
  const review = reviewRecord(deps, ctx, reviewedHead, output.validation);
  writePassReview(ctx.runDir!, pass, review);
  writePassReviewMarkdown(ctx.runDir!, pass, renderPassReviewMarkdown(review, pass));
  return { review };
}

async function runReviewerPass(
  deps: LoopDeps,
  ctx: LoopContext,
  pass: number,
): Promise<{ review: PassReviewRecord } | { error: string }> {
  const reviewedHead = resolveHead(ctx.cwd);
  const worktreePath = join(ctx.runDir!, "review-wt-" + String(pass).padStart(2, "0"));
  const created = createDetachedWorktree(ctx.cwd, reviewedHead, worktreePath);
  if (!created.ok) return { error: `disposable worktree creation failed: ${created.error ?? "unknown"}` };
  const executedIds: string[] = [];
  try {
    return await runSessionAndRecordReview(deps, ctx, pass, reviewedHead, worktreePath, executedIds);
  } catch (e: unknown) {
    if (e instanceof LoopCancelledError) throw e;
    return { error: `reviewer session failed: ${(e as Error).message}` };
  } finally {
    removeWorktree(ctx.cwd, worktreePath);
  }
}

function catalogAllows(capability: Hardness, required: Hardness): boolean {
  return HARDNESSES.indexOf(capability) >= HARDNESSES.indexOf(required);
}

function parseDispositions(raw: string): FixerDisposition[] {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null || !("dispositions" in parsed)) return [];
  const list = (parsed as { dispositions: unknown }).dispositions;
  if (!Array.isArray(list)) return [];
  const valid = ["valid", "invalid", "already_fixed", "blocked"];
  return list.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const entry = item as Record<string, unknown>;
    if (typeof entry.finding_id !== "string" || typeof entry.disposition !== "string" || !valid.includes(entry.disposition)) {
      return [];
    }
    return [{
      finding_id: entry.finding_id,
      disposition: entry.disposition as FixerDisposition["disposition"],
      note: typeof entry.note === "string" ? entry.note : "",
    }];
  });
}

interface FixerChoice {
  model: string | null;
  selection: FixerSelection;
  thinking: string | null;
}

function catalogEntryFor(entries: ModelCatalogEntry[], selector: string | null): ModelCatalogEntry | null {
  if (!selector) return null;
  const base = selector.split(":")[0];
  return entries.find((entry) => entry.selector === selector || entry.selector === base) ?? null;
}

async function chooseFixer(deps: LoopDeps, ctx: LoopContext, requiredHardness: Hardness): Promise<FixerChoice> {
  const catalog = deps.loadCatalog();
  const selection = selectFixerModel({
    entries: catalog.entries,
    availableSelectors: await deps.availableSelectors(),
    requiredHardness,
    reviewerSelector: ctx.state!.reviewer_model ?? undefined,
  });
  const selected = selection.selector === "" ? deps.fixerFallbackModel(requiredHardness) : selection.selector;
  const model = ctx.options.fixerModel ?? selected;
  const entry = catalogEntryFor(catalog.entries, model);
  const thinking = entry ? thinkingFor(entry, requiredHardness) : null;
  return { model, selection, thinking };
}

function reportFixerChoice(
  deps: LoopDeps,
  catalog: CatalogLoad,
  selection: FixerSelection,
  explicitModel: string | undefined,
  requiredHardness: Hardness,
): void {
  if (selection.reusedReviewer) {
    deps.notify("Only the Reviewer's own model is capable and available; reusing it (recorded in the report).", "warning");
  }
  if (!explicitModel) return;
  const entry = catalogEntryFor(catalog.entries, explicitModel);
  if (entry && !catalogAllows(entry.fixerCapability, requiredHardness)) {
    deps.notify(
      `Explicit fixer ${explicitModel} is catalogued below the required ${requiredHardness} hardness; honoring the explicit choice.`,
      "warning",
    );
  }
}

function fixerRecord(
  fixerModel: string | null,
  requiredHardness: Hardness,
  dispositions: FixerDisposition[],
  checks: { command: string; exitCode: number | null; passed: boolean },
  checkpoint: string | null,
  changedPaths: string[],
): PassFixerRecord {
  return {
    model: fixerModel,
    requested_hardness: requiredHardness,
    dispositions,
    changed_paths: changedPaths,
    checks: { command: checks.command, exit_code: checks.exitCode, passed: checks.passed },
    checkpoint_commit: checkpoint,
  };
}

async function runFixerPass(
  deps: LoopDeps,
  ctx: LoopContext,
  pass: number,
  blocking: ValidatedFinding[],
  requiredHardness: Hardness,
): Promise<PassFixerRecord> {
  const choice = await chooseFixer(deps, ctx, requiredHardness);
  reportFixerChoice(deps, deps.loadCatalog(), choice.selection, ctx.options.fixerModel, requiredHardness);
  const preHead = resolveHead(ctx.cwd);
  const untrackedBefore = new Set(listUntracked(ctx.cwd));
  const raw = await deps.runFixerSession({
    cwd: ctx.cwd,
    prompt: assembleFixerPrompt({
      passDir: passDirFor(ctx.runDir!, pass),
      blockingFindings: blockingSummary(blocking),
      baseBranch: ctx.state!.base_branch,
    }),
    model: choice.model,
    thinkingLevel: choice.thinking,
  });
  const dispositions = parseDispositions(raw);
  const checks = await deps.runChecks(ctx.cwd);
  // Stage files the Fixer created (e.g. a new regression test) so the
  // checkpoint commit carries the whole fix; user-excluded untracked files
  // stay out because only paths absent before the session are selected.
  const fixerUntracked = listUntracked(ctx.cwd).filter((path) => !untrackedBefore.has(path));
  const checkpoint = checks.passed
    ? checkpointCommit(ctx.cwd, fixerUntracked, `fix(code-review): pass ${pass} verified fixes`)
    : null;
  ctx.state!.fixer_model = choice.model;
  ctx.state!.last_head = resolveHead(ctx.cwd);
  ctx.state!.worktree_fingerprint = worktreeFingerprint(ctx.cwd);
  return fixerRecord(choice.model, requiredHardness, dispositions, checks, checkpoint, changedPathsSince(ctx.cwd, preHead, fixerUntracked));
}

function baseBranchFor(ctx: LoopContext): string {
  return ctx.options.base ?? detectBaseBranch(ctx.cwd) ?? "master";
}

function statePersona(ctx: LoopContext): string {
  return ctx.options.personaName ?? "(replacement)";
}

function stateReviewer(ctx: LoopContext): string | null {
  return nullable(ctx.options.reviewerModel);
}

function stateTemperature(ctx: LoopContext): number | null {
  return nullable(ctx.options.reviewerTemperature);
}

function newLoopState(ctx: LoopContext, head: string, fingerprint: string): RunState {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    run_id: newRunId(),
    status: "running",
    branch: ctx.branch,
    base_branch: baseBranchFor(ctx),
    base_commit: null,
    start_head: head,
    last_head: head,
    checkpoint_commit: null,
    pass: 0,
    persona: statePersona(ctx),
    reviewer_model: stateReviewer(ctx),
    fixer_model: null,
    requested_temperature: stateTemperature(ctx),
    min_blocking: ctx.options.minBlocking,
    max_passes: ctx.options.maxPasses,
    created_worktree: null,
    worktree_fingerprint: fingerprint,
    started_at: now,
    updated_at: now,
    terminal: null,
  };
}

async function tryResume(deps: LoopDeps, ctx: LoopContext): Promise<void> {
  if (!ctx.options.resume) return;
  const resumable = findResumable(ctx.commonDir, ctx.branch);
  if (!resumable) return;
  const check = validateResume(resumable.state, {
    head: resolveHead(ctx.cwd),
    fingerprint: worktreeFingerprint(ctx.cwd),
    gitOperationInProgress: hasOngoingGitOperation(ctx.cwd),
  });
  if (!check.ok) {
    deps.notify(
      `Found run ${resumable.state.run_id} but will not resume: ${check.reason}. The old run is preserved for inspection.`,
      "warning",
    );
    return;
  }
  ctx.runDir = resumable.dir;
  ctx.state = resumable.state;
  ctx.state.status = "running";
  ctx.state.terminal = null;
  saveState(ctx.runDir, ctx.state);
  deps.notify(`Resuming run ${resumable.state.run_id} at pass ${resumable.state.pass + 1}.`, "info");
}

function readJsonIfExists<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeTerminalReport(deps: LoopDeps, ctx: LoopContext, finalHead: string): Promise<string | null> {
  if (!ctx.runDir || !ctx.state) return null;
  const passes = [];
  for (let pass = 1; pass <= ctx.state.pass; pass++) {
    const dir = passDirFor(ctx.runDir, pass);
    passes.push({
      pass,
      review: readJsonIfExists<PassReviewRecord>(join(dir, "review.json")),
      fixer: readJsonIfExists<PassFixerRecord>(join(dir, "fixer.json")),
    });
  }
  const subject = resolveReportSubject(deps.contextDir(ctx.cwd));
  const markdown = renderFinalReport({ state: ctx.state, passes, runDir: ctx.runDir, finalHead });
  const path = writeFinalReport(subject.dir, ctx.state.run_id, markdown);
  if (subject.created) deps.notify(`No active subject; created ${subject.dir}.`, "info");
  return path;
}

function repoRelative(cwd: string, file: string): string | null {
  const rel = relative(cwd, file);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel;
}

async function terminalResult(
  deps: LoopDeps,
  ctx: LoopContext,
  status: RunState["status"],
  reason: string,
): Promise<LoopResult> {
  terminalize(ctx, status, reason);
  const reportPath = await writeTerminalReport(deps, ctx, resolveHead(ctx.cwd));
  if (status === "clean" && reportPath) {
    const rel = repoRelative(ctx.cwd, reportPath);
    if (rel) checkpointCommit(ctx.cwd, [rel], "docs(code-review): record review-iteration report");
    if (ctx.state?.created_worktree) removeWorktree(ctx.cwd, ctx.state.created_worktree);
  } else if (ctx.state && ctx.runDir) {
    // The terminal report itself can add untracked files inside the repo
    // (`.context/` subject); refresh the stored resume position so the run
    // stays resumable instead of failing its own fingerprint check.
    ctx.state.last_head = resolveHead(ctx.cwd);
    ctx.state.worktree_fingerprint = worktreeFingerprint(ctx.cwd);
    saveState(ctx.runDir, ctx.state);
  }
  return { status, runId: ctx.state?.run_id ?? "", reportPath };
}

function freshContext(cwd: string, options: LoopOptions): LoopContext {
  return {
    cwd,
    commonDir: gitCommonDir(cwd),
    branch: currentBranch(cwd),
    runDir: null,
    state: null,
    options,
  };
}

async function initializeRun(deps: LoopDeps, ctx: LoopContext): Promise<LoopResult | null> {
  await tryResume(deps, ctx);
  const catalog = deps.loadCatalog();
  if (catalog.errors.length > 0) {
    deps.notify(`Model catalog preflight failed:\n${catalog.errors.join("\n")}`, "error");
    // A resumed run is already persisted as running; terminalize it on disk
    // so pruneRuntime and a later --resume see the failure.
    return terminalResult(deps, ctx, "failed", `model catalog preflight failed (${catalog.errors.length} error(s))`);
  }
  for (const warning of catalog.warnings) deps.notify(warning, "warning");
  if (!ctx.state) {
    const pre = capturePreRun(ctx.cwd);
    ctx.state = newLoopState(ctx, pre.head, worktreeFingerprint(ctx.cwd));
    const created = createRun(ctx.commonDir, ctx.state);
    ctx.runDir = created.dir;
    ctx.state = created.state;
  }
  const prepared = await prepareBaseAndCheckpoint(deps, ctx);
  if (prepared !== "continue") return terminalResult(deps, ctx, prepared, `base preparation failed: ${prepared}`);
  // The rebase above may have moved HEAD; persist the post-rebase position so
  // a crash before the first pass cannot make this run unresumable.
  ctx.state.last_head = resolveHead(ctx.cwd);
  ctx.state.worktree_fingerprint = worktreeFingerprint(ctx.cwd);
  saveState(ctx.runDir!, ctx.state!);
  return null;
}

async function resolveReviewedPass(
  deps: LoopDeps,
  ctx: LoopContext,
  pass: number,
  review: PassReviewRecord,
): Promise<LoopResult | null> {
  const blocking = blockingFindings(review.findings, ctx.options.minBlocking);
  if (blocking.length === 0) {
    const reason = review.findings.length === 0
      ? "reviewer reported no findings"
      : `no ${ctx.options.minBlocking}-or-higher findings remain (${review.findings.length} report-only)`;
    const result = await terminalResult(deps, ctx, "clean", reason);
    deps.notify(`✅ Clean: ${reason}. Report: ${result.reportPath ?? "(write failed)"}`, "info");
    return result;
  }
  const required = maxBlockingHardness(blocking);
  if (!required) return terminalResult(deps, ctx, "failed", "blocking findings present but no fix hardness computable");
  return runFixerForPass(deps, ctx, pass, blocking, required);
}

async function runFixerForPass(
  deps: LoopDeps,
  ctx: LoopContext,
  pass: number,
  blocking: ValidatedFinding[],
  required: Hardness,
): Promise<LoopResult | null> {
  deps.notify(`Fixer pass ${pass}: ${blocking.length} blocking finding(s), required hardness ${required}.`, "info");
  const fixer = await runFixerPass(deps, ctx, pass, blocking, required);
  writePassFixer(
    ctx.runDir!,
    pass,
    fixer,
    `# Pass ${String(pass).padStart(2, "0")} fixer\n\nModel ${fixer.model ?? "—"}; checks ${fixer.checks.passed ? "passed" : "FAILED"}; checkpoint ${fixer.checkpoint_commit ?? "none"}.\n`,
  );
  saveState(ctx.runDir!, ctx.state!);
  if (!fixer.checks.passed) {
    return terminalResult(
      deps,
      ctx,
      "blocked",
      `deterministic checks failed after fixer pass ${pass} (${fixer.checks.command} exit ${fixer.checks.exit_code ?? "—"}); no checkpoint commit created`,
    );
  }
  deps.notify(`Fixer pass ${pass} committed ${fixer.checkpoint_commit?.slice(0, 12) ?? "?"}; starting fresh review.`, "info");
  return null;
}

async function resumeIncompleteFixer(deps: LoopDeps, ctx: LoopContext): Promise<LoopResult | null> {
  if (!ctx.state || !ctx.runDir || ctx.state.pass < 1) return null;
  const dir = passDirFor(ctx.runDir, ctx.state.pass);
  const review = readJsonIfExists<PassReviewRecord>(join(dir, "review.json"));
  const fixer = readJsonIfExists<PassFixerRecord>(join(dir, "fixer.json"));
  if (!review || fixer) return null;
  deps.notify(`Resuming incomplete fixer for pass ${ctx.state.pass}.`, "info");
  return resolveReviewedPass(deps, ctx, ctx.state.pass, review);
}

async function runOnePass(deps: LoopDeps, ctx: LoopContext): Promise<LoopResult | null> {
  const state = ctx.state!;
  const pass = state.pass + 1;
  state.pass = pass;
  deps.notify(`Review pass ${pass}/${state.max_passes} — ${state.persona} · ${state.reviewer_model ?? "session default"}`, "info");
  const outcome = await runReviewerPass(deps, ctx, pass);
  if ("error" in outcome) return terminalResult(deps, ctx, "failed", outcome.error);
  state.last_head = outcome.review.reviewed_head;
  saveState(ctx.runDir!, state);
  return resolveReviewedPass(deps, ctx, pass, outcome.review);
}

/**
 * Run the full loop. Never pushes; creates checkpoint commits only.
 */
export async function runReviewLoop(deps: LoopDeps, cwd: string, options: LoopOptions): Promise<LoopResult> {
  if (!isGitCheckout(cwd)) {
    deps.notify("Not inside a non-bare git checkout; nothing to review.", "error");
    return { status: "failed", runId: "", reportPath: null };
  }
  const ctx = freshContext(cwd, options);
  try {
    const initialized = await initializeRun(deps, ctx);
    if (initialized) return initialized;
    const incomplete = await resumeIncompleteFixer(deps, ctx);
    if (incomplete) return incomplete;
    while (ctx.state!.pass < ctx.state!.max_passes) {
      const result = await runOnePass(deps, ctx);
      if (result) return result;
    }
    return terminalResult(
      deps,
      ctx,
      "exhausted",
      `blocking findings unresolved after ${ctx.state!.max_passes} review passes`,
    );
  } catch (e: unknown) {
    const status = e instanceof LoopCancelledError ? "cancelled" : "failed";
    return terminalResult(deps, ctx, status, (e as Error).message);
  }
}
