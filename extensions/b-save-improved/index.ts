/**
 * b-save-improved Extension
 *
 * Deterministic session-record checkpoint — counterpart to the b-save skill.
 * File mechanics live in tested Bun scripts. The model is invoked twice:
 * scribe (narrative + backlog) and auditor (completion verdicts). Step 8
 * (retain/learn) is handed back to the mainline agent via pi.sendMessage.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createProgress, execFileCaptured, execFileCapturedWithStdin, recordCommandError } from "../command-progress.js";
import { lastAssistantText, resolveOmpRole, runOmpModelSession } from "../omp-models.js";

export { lastAssistantText };

const HERE = dirname(fileURLToPath(import.meta.url));
const PREFLIGHT = join(HERE, "..", "..", "skills", "b-save-improved", "scripts", "save-preflight.ts");
const APPLY = join(HERE, "..", "..", "skills", "b-save-improved", "scripts", "save-apply.ts");
export const DIGEST_CAP = 12_000;

const FLAGS = ["--dry-run", "--archive-inferred", "--subject", "--no-retain", "--model"];

export interface SaveArgs {
  dryRun: boolean;
  archiveInferred: boolean;
  subject: string | null;
  noRetain: boolean;
  model: string | undefined;
}

export function parseArgs(raw: string): SaveArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const out: SaveArgs = {
    dryRun: false,
    archiveInferred: false,
    subject: null,
    noRetain: false,
    model: undefined,
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--dry-run") out.dryRun = true;
    else if (token === "--archive-inferred") out.archiveInferred = true;
    else if (token === "--no-retain") out.noRetain = true;
    else if (token === "--subject") out.subject = tokens[++i] ?? null;
    else if (token.startsWith("--subject=")) out.subject = token.slice("--subject=".length);
    else if (token === "--model") out.model = tokens[++i];
    else if (token.startsWith("--model=")) out.model = token.slice("--model=".length);
  }
  return out;
}

interface DigestPiece {
  always: boolean;
  text: string;
  role?: "user" | "assistant";
}

function stringContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  const parts: string[] = [];
  for (const block of value) {
    if (!block || typeof block !== "object") continue;
    const rec = block as Record<string, unknown>;
    if (typeof rec.text === "string") parts.push(rec.text);
    else if (typeof rec.content === "string") parts.push(rec.content);
  }
  return parts.join("\n");
}

function toolPath(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const rec = args as Record<string, unknown>;
  if (typeof rec.path === "string") return rec.path;
  if (typeof rec.file === "string") return rec.file;
  if (typeof rec.file_path === "string") return rec.file_path;
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function classifyCompaction(rec: Record<string, unknown>): DigestPiece | null {
  const type = typeof rec.type === "string" ? rec.type : "";
  if (type !== "compaction" && type !== "compaction_summary") return null;
  const summary = stringContent(rec.summary ?? rec.content).trim();
  if (!summary) return null;
  return { always: true, text: `[compaction] ${summary}` };
}

function classifyChat(rec: Record<string, unknown>): DigestPiece | null {
  const role = typeof rec.role === "string" ? rec.role : "";
  if (role !== "user" && role !== "assistant") return null;
  const text = stringContent(rec.content).trim();
  if (!text) return null;
  return { always: false, role, text: `${role}: ${text}` };
}

function toolNameOf(rec: Record<string, unknown>): string {
  if (typeof rec.toolName === "string") return rec.toolName;
  if (typeof rec.name === "string") return rec.name;
  const fn = asRecord(rec.function);
  return typeof fn?.name === "string" ? fn.name : "";
}

function toolArgsOf(rec: Record<string, unknown>): unknown {
  if (rec.arguments !== undefined) return rec.arguments;
  if (rec.args !== undefined) return rec.args;
  if (rec.input !== undefined) return rec.input;
  return asRecord(rec.function)?.arguments;
}

function toolCommand(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const rec = args as Record<string, unknown>;
  for (const key of ["command", "cmd", "script"]) {
    if (typeof rec[key] === "string") return rec[key];
  }
  return "";
}

function classifyTool(rec: Record<string, unknown>): DigestPiece | null {
  const toolName = toolNameOf(rec);
  if (/^bash$/i.test(toolName)) {
    const command = toolCommand(toolArgsOf(rec)).replace(/\s+/g, " ").trim();
    if (!command) return null;
    return { always: false, text: `bash ${command.slice(0, 120)}` };
  }
  if (!/^(write|edit|read)$/i.test(toolName)) return null;
  const path = toolPath(toolArgsOf(rec));
  if (!path) return null;
  return { always: false, text: `${toolName} ${path}` };
}

function classifyEntry(entry: unknown): DigestPiece | null {
  const rec = asRecord(entry);
  if (!rec) return null;
  return classifyCompaction(rec) ?? classifyChat(rec) ?? classifyTool(rec);
}

function collectPieces(entries: unknown[]): DigestPiece[] {
  const pieces: DigestPiece[] = [];
  let pinnedGoal = false;
  for (const entry of entries) {
    const piece = classifyEntry(entry);
    if (!piece) continue;
    if (piece.role === "user" && !pinnedGoal) {
      pinnedGoal = true;
      piece.always = true;
    }
    pieces.push(piece);
  }
  return pieces;
}

export function buildDigest(
  entries: unknown[],
  gitStatus: string,
  gitDiffStat: string,
  cap = DIGEST_CAP,
): string {
  const pieces = collectPieces(entries);
  const footer = [
    "",
    "## git status",
    gitStatus.trim() || "(clean)",
    "",
    "## git diff --stat",
    gitDiffStat.trim() || "(none)",
  ].join("\n");

  const droppableIdx: number[] = [];
  for (let i = 0; i < pieces.length; i++) {
    if (!pieces[i].always) droppableIdx.push(i);
  }
  let omitted = 0;
  const dropped = new Set<number>();
  const render = (): string => {
    const kept = pieces.filter((_, i) => !dropped.has(i)).map((p) => p.text);
    const prefix = omitted > 0 ? `[digest truncated: ${omitted} earlier entries omitted]\n` : "";
    return prefix + kept.join("\n") + footer;
  };
  let text = render();
  let dropAt = 0;
  while (text.length > cap && dropAt < droppableIdx.length) {
    dropped.add(droppableIdx[dropAt]);
    omitted++;
    dropAt++;
    text = render();
  }
  return text.length > cap ? text.slice(0, cap) : text;
}

export function resolveRoleModel(cwd: string, role: "scribe" | "auditor"): string | undefined {
  return resolveOmpRole(cwd, role === "scribe" ? "slow" : "smol");
}


function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;
  try {
    return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

export interface ScribeOutput {
  memory: {
    frontmatter: Record<string, unknown>;
    title: string;
    body: string;
  };
  index_entry: { summary: string };
  backlog: {
    complete_explicit: Array<{ slug: string; outcome: string }>;
    complete_inferred: Array<{ slug: string; outcome: string; evidence?: string }>;
    new_items: Array<{ slug: string; title: string; priority: string; related?: string[]; body?: string }>;
  };
  retain_facts: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const BACKLOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isBacklogSlug(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80 && BACKLOG_SLUG.test(value);
}

function parseCompleteItem(item: unknown): { slug: string; outcome: string; evidence?: string } | null {
  const rec = asRecord(item);
  if (!rec || !isBacklogSlug(rec.slug) || typeof rec.outcome !== "string") return null;
  const parsed: { slug: string; outcome: string; evidence?: string } = { slug: rec.slug, outcome: rec.outcome };
  if (typeof rec.evidence === "string") parsed.evidence = rec.evidence;
  return parsed;
}

function parseNewItem(item: unknown): ScribeOutput["backlog"]["new_items"][number] | null {
  const rec = asRecord(item);
  if (!rec || !isBacklogSlug(rec.slug) || typeof rec.title !== "string" || typeof rec.priority !== "string") return null;
  return {
    slug: rec.slug,
    title: rec.title,
    priority: rec.priority,
    related: isStringArray(rec.related) ? rec.related : [],
    body: typeof rec.body === "string" ? rec.body : "",
  };
}


function listOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseScribeMemory(mem: Record<string, unknown>, idx: Record<string, unknown>, back: Record<string, unknown>, facts: unknown): ScribeOutput | null {
  if (typeof mem.title !== "string" || typeof mem.body !== "string") return null;
  if (typeof idx.summary !== "string" || !idx.summary.trim()) return null;
  return {
    memory: {
      frontmatter: asRecord(mem.frontmatter) ?? {},
      title: mem.title.trim(),
      body: mem.body,
    },
    index_entry: { summary: idx.summary.trim() },
    backlog: {
      complete_explicit: listOrEmpty(back.complete_explicit).flatMap((item) => {
        const parsed = parseCompleteItem(item);
        return parsed ? [{ slug: parsed.slug, outcome: parsed.outcome }] : [];
      }),
      complete_inferred: listOrEmpty(back.complete_inferred).flatMap((item) => {
        const parsed = parseCompleteItem(item);
        return parsed ? [parsed] : [];
      }),
      new_items: listOrEmpty(back.new_items).flatMap((item) => {
        const parsed = parseNewItem(item);
        return parsed ? [parsed] : [];
      }),
    },
    retain_facts: isStringArray(facts) ? facts : [],
  };
}

export function parseScribeResponse(raw: string): ScribeOutput | null {
  const rec = asRecord(extractJsonObject(raw));
  const mem = asRecord(rec?.memory);
  const idx = asRecord(rec?.index_entry);
  const back = asRecord(rec?.backlog);
  if (!rec || !mem || !idx || !back) return null;
  return parseScribeMemory(mem, idx, back, rec.retain_facts);
}

export interface AuditorVerdict {
  path: string;
  verdict: "complete" | "incomplete" | "uncertain";
  evidence: string;
}

function parseVerdictRow(item: unknown): AuditorVerdict | null {
  const rec = asRecord(item);
  if (!rec || typeof rec.path !== "string") return null;
  if (rec.verdict !== "complete" && rec.verdict !== "incomplete" && rec.verdict !== "uncertain") return null;
  return {
    path: rec.path,
    verdict: rec.verdict,
    evidence: typeof rec.evidence === "string" ? rec.evidence : "",
  };
}

export function parseAuditorResponse(raw: string): AuditorVerdict[] | null {
  const rec = asRecord(extractJsonObject(raw));
  if (!rec || !Array.isArray(rec.verdicts)) return null;
  const out: AuditorVerdict[] = [];
  for (const item of rec.verdicts) {
    const row = parseVerdictRow(item);
    if (row) out.push(row);
  }
  return out;
}

async function runModelSession(
  cwd: string,
  tools: string[],
  prompt: string,
  modelOverride?: string,
  timeoutMs = 60_000,
): Promise<string> {
  return runOmpModelSession({ cwd, tools, prompt, modelOverride, timeoutMs });
}


interface CommandUI {
  notify: (message: string, level?: "info" | "warning" | "error") => void;
  select?: (prompt: string, items: string[]) => Promise<string | null>;
  input?: (prompt: string, initial?: string) => Promise<string | null>;
}

interface CommandCtx {
  cwd: string;
  ui: CommandUI;
  hasUI?: boolean;
  sessionManager?: { getEntries: () => unknown[] };
}

function notify(ctx: CommandCtx, message: string, level: "info" | "warning" | "error" = "info"): void {
  try {
    ctx.ui.notify(message, level);
  } catch {
    // UI optional
  }
}

function fail(pi: ExtensionAPI, ctx: CommandCtx, step: string, message: string, code?: number): void {
  if (code === undefined) recordCommandError(pi, "b-save-improved", step, message);
  else recordCommandError(pi, "b-save-improved", step, message, code);
  notify(ctx, message, "error");
}

function preflightArgList(opts: SaveArgs, subjectOverride?: string): string[] {
  const args: string[] = [];
  const subject = subjectOverride ?? opts.subject;
  if (subject) args.push("--subject", subject);
  return args;
}

function buildScribePrompt(digest: string, preflight: Record<string, unknown>): string {
  return [
    "You are the scribe for a /b-save-improved checkpoint.",
    "Write ONE JSON object. No prose, no markdown fences required.",
    "Keys:",
    `- memory.frontmatter: { domains: string[], topics: string[], artifacts: string[], related: string[], priority: "high"|"medium"|"low", status: "completed" }`,
    "- memory.title, memory.body (markdown, no frontmatter)",
    "- index_entry.summary (one line)",
    "- backlog.complete_explicit: [{ slug, outcome }] only when the session explicitly marked the item done — cite that statement in outcome",
    "- backlog.complete_inferred: [{ slug, outcome, evidence }] for likely-done items without an explicit session statement",
    "- backlog.new_items: [{ slug, title, priority, related, body }]",
    "- retain_facts: string[] of self-contained facts including artifact paths",
    "- memory.body headings (omit a section only when empty): ## User Goal, ## What happened, ## Decision, ## What shipped, ## Verification, ## Leftover, ## Related",
    "- artifacts: subject-folder filenames and .context/memory paths only — not implementation source",
    "- related: other memory filenames, not source paths",
    "- backlog slugs: kebab-case [a-z0-9]+(-[a-z0-9]+)* (max 80); never paths or ..",
    "",
    "Subject:",
    JSON.stringify(preflight.subject ?? null),
    "",
    "Open backlog items:",
    JSON.stringify((preflight.backlog as { open_items?: unknown })?.open_items ?? []),
    "",
    "Session digest:",
    digest,
  ].join("\n");
}

function buildAuditorPrompt(preflight: Record<string, unknown>): string {
  return [
    "You are the auditor for a /b-save-improved checkpoint.",
    "Decide whether candidate artifacts are actually complete based on the repo, not the session story.",
    "Use read/grep. Return ONE JSON object: { \"verdicts\": [{ \"path\", \"verdict\": \"complete\"|\"incomplete\"|\"uncertain\", \"evidence\": \"file:line\" }] }.",
    "Only verdict complete if the files on disk prove it.",
    "",
    "Candidates:",
    JSON.stringify({
      specs: preflight.specs ?? [],
      phases_needs_adjudication: (preflight.phases as { needs_adjudication?: unknown })?.needs_adjudication ?? [],
      phase_files: (preflight.phases as { files?: unknown })?.files ?? [],
      iterates: preflight.iterates ?? [],
    }),
  ].join("\n");
}

export function assembleApplyPayload(
  preflight: Record<string, unknown>,
  scribe: ScribeOutput,
  verdicts: AuditorVerdict[],
): Record<string, unknown> {
  const subject = preflight.subject as { name: string; path: string; created?: boolean };
  const today = String(preflight.today ?? "");
  const memoryPath = (preflight.existing_memory as { path?: string } | undefined)?.path
    ?? `.context/memory/${String(subject?.name ?? "session").replace(/^\d{4}-\d{2}-\d{2}\./, "")}-${today}.md`;
  const memoryFile = memoryPath.replace(/^.*\//, "");
  const fm = { ...scribe.memory.frontmatter };
  fm.date = today;
  fm.subject = subject?.name;
  const completePaths = new Set(verdicts.filter((v) => v.verdict === "complete").map((v) => v.path));
  const specs = Array.isArray(preflight.specs) ? preflight.specs as Array<{ path: string }> : [];
  const iterates = Array.isArray(preflight.iterates) ? preflight.iterates as Array<{ path: string; addresses?: string }> : [];
  const phases = (preflight.phases ?? {}) as {
    auto_completable?: string[];
    files?: Array<{ path: string }>;
  };
  const phasesComplete = [
    ...(phases.auto_completable ?? []),
    ...((phases.files ?? []).map((f) => f.path).filter((p) => completePaths.has(p))),
  ];
  const uniquePhases = [...new Set(phasesComplete)];
  const plans = Array.isArray(preflight.plans)
    ? preflight.plans as Array<{ path: string; spec?: string | null }>
    : [];
  const crossrefs = plans.map((plan) => ({
    path: `${subject?.path}/${plan.path}`,
    key: "memory",
    value: `../memory/${memoryFile}`,
  }));
  const specPlans: Array<{ spec: string; plan: string }> = [];
  for (const plan of plans) {
    const spec = typeof plan.spec === "string" ? plan.spec.trim() : "";
    if (!spec) continue;
    crossrefs.push({
      path: `${subject?.path}/${spec}`,
      key: "memory",
      value: `../memory/${memoryFile}`,
    });
    specPlans.push({ spec, plan: plan.path.replace(/^.*\//, "") });
  }
  return {
    today,
    subject: { name: subject?.name, path: subject?.path, create: Boolean(subject?.created) },
    memory: {
      path: memoryPath,
      frontmatter: fm,
      title: scribe.memory.title,
      body: scribe.memory.body,
    },
    index_entry: { summary: scribe.index_entry.summary, status: String(fm.status ?? "completed") },
    crossrefs,
    verification_evidence: verdicts
      .filter((v) => v.verdict === "complete" && v.evidence.trim())
      .map((v) => ({ path: v.path, evidence: v.evidence.trim() })),
    spec_plans: specPlans,
    backlog: scribe.backlog,
    specs_complete: specs.map((s) => s.path).filter((p) => completePaths.has(p)),
    phases_complete: uniquePhases,
    phase_table_fixes: uniquePhases.map((file) => ({ file, status: "completed" })),
    iterates_complete: iterates.filter((it) => completePaths.has(it.path)).map((it) => ({
      path: it.path,
      addresses: it.addresses,
    })),
    subject_index_status: "completed",
    loose_artifacts: preflight.loose_artifacts ?? [],
  };
}

export function buildRetainInstruction(
  backend: { backend?: string | null; expect_retain?: boolean } | undefined,
  memoryPath: string,
  subjectName: string,
  facts: string[],
): string {
  const kind = backend?.backend;
  const tool =
    kind === "hindsight" || kind === "mnemopi" ? "retain"
      : kind === "local" ? "learn"
        : null;
  const factBlock = facts.length > 0
    ? facts.map((f, i) => `${i + 1}. ${f}`).join("\n")
    : `1. Session checkpoint written for ${subjectName} at ${memoryPath}.`;
  if (!tool) {
    return [
      "No harness memory tool is expected (memory.backend is unset).",
      "Skip retain/learn. Do not call the Hindsight HTTP API.",
      "Do not run b-memory-import — that skill is bulk backfill only.",
      `Memory file: ${memoryPath}`,
      `Subject: ${subjectName}`,
    ].join("\n");
  }
  return [
    `Call the ${tool} tool with 1–N self-contained facts about this session.`,
    `Memory file: ${memoryPath}`,
    `Subject: ${subjectName}`,
    "Do not call the Hindsight HTTP API.",
    "Do not run b-memory-import — that skill is bulk backfill only.",
    "",
    "Facts:",
    factBlock,
  ].join("\n");
}

async function runBSaveImproved(
  rawArgs: string,
  ctx: CommandCtx,
  pi: ExtensionAPI,
): Promise<void> {
  const opts = parseArgs(rawArgs);
  const progress = createProgress(ctx, "b-save-improved");
  try {
    progress.step("preflight…");
    let pre = await execFileCaptured("bun", [PREFLIGHT, ...preflightArgList(opts)], ctx.cwd);
    if (pre.code === 3) {
      notify(ctx, "No .context/ directory — nothing to save.", "warning");
      return;
    }
    if (pre.code === 1) {
      let err = "preflight failed";
      try {
        err = String((JSON.parse(pre.stdout) as { error?: string }).error ?? err);
      } catch {
        err = pre.stderr.trim() || err;
      }
      fail(pi, ctx, "preflight", err, 1);
      return;
    }
    if (pre.code === 2) {
      let candidates: Array<{ name: string; status?: string }> = [];
      let suggestedSubject = "";
      try {
        const parsed = JSON.parse(pre.stdout) as {
          subject_candidates?: Array<{ name: string; status?: string }>;
          suggested_subject?: string;
        };
        candidates = parsed.subject_candidates ?? [];
        if (typeof parsed.suggested_subject === "string") suggestedSubject = parsed.suggested_subject;
      } catch {
        candidates = [];
      }
      if (!ctx.hasUI || !ctx.ui.select) {
        fail(pi, ctx, "preflight", "Ambiguous subject — re-run with --subject <folder-name> (creates it if missing).");
        return;
      }
      const createLabel = suggestedSubject ? `Create ${suggestedSubject}` : null;
      const picked = await ctx.ui.select(
        "Which subject?",
        [...(createLabel ? [createLabel] : []), ...candidates.map((c) => c.name)],
      );
      if (!picked) return;
      const chosen = picked === createLabel ? suggestedSubject : picked;
      pre = await execFileCaptured("bun", [PREFLIGHT, ...preflightArgList(opts, chosen)], ctx.cwd);
      if (pre.code !== 0) {
        fail(pi, ctx, "preflight", "preflight failed after subject pick", pre.code);
        return;
      }
    }

    let preflight: Record<string, unknown>;
    try {
      preflight = JSON.parse(pre.stdout) as Record<string, unknown>;
    } catch {
      fail(pi, ctx, "preflight", "preflight returned invalid JSON");
      return;
    }

    const entries = ctx.sessionManager?.getEntries?.() ?? [];
    const git = (preflight.git ?? {}) as { status_porcelain?: string; diff_stat?: string };
    const digest = buildDigest(entries, git.status_porcelain ?? "", git.diff_stat ?? "");

    progress.step("Drafting session record…");
    const scribeModel = opts.model ?? resolveRoleModel(ctx.cwd, "scribe");
    let scribe: ScribeOutput | null = null;
    let scribeRaw = "";
    try {
      scribeRaw = await runModelSession(ctx.cwd, [], buildScribePrompt(digest, preflight), scribeModel, 120_000);
      scribe = parseScribeResponse(scribeRaw);
    } catch (error) {
      fail(pi, ctx, "scribe", `Could not draft the session record: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (!scribe) {
      fail(
        pi,
        ctx,
        "scribe",
        scribeRaw.trim()
          ? "Could not draft the session record. Scribe output was not valid JSON. Fall back to /b-save."
          : "Could not draft the session record. Model returned no text. Fall back to /b-save.",
      );
      return;
    }

    const phases = (preflight.phases ?? {}) as { needs_adjudication?: unknown[] };
    const specs = preflight.specs as unknown[] | undefined;
    const iterates = preflight.iterates as Array<{ status?: string }> | undefined;
    const needsAuditor =
      (Array.isArray(specs) && specs.length > 0) ||
      (Array.isArray(phases.needs_adjudication) && phases.needs_adjudication.length > 0) ||
      (Array.isArray(iterates) && iterates.some((it) => it.status === "active"));

    let verdicts: AuditorVerdict[] = [];
    let adjudicationSkipped = false;
    if (needsAuditor) {
      progress.step("Auditing completions…");
      const auditorModel = opts.model ?? resolveRoleModel(ctx.cwd, "auditor");
      try {
        const raw = await runModelSession(ctx.cwd, ["read", "grep"], buildAuditorPrompt(preflight), auditorModel, 120_000);
        const parsed = parseAuditorResponse(raw);
        verdicts = parsed ?? [];
        if (!parsed) adjudicationSkipped = true;
      } catch {
        adjudicationSkipped = true;
      }
    }

    const payload = assembleApplyPayload(preflight, scribe, verdicts);
    progress.step("Writing .context…");
    const applyArgs = ["bun", APPLY];
    if (opts.dryRun) applyArgs.push("--dry-run");
    if (opts.archiveInferred) applyArgs.push("--archive-inferred");
    const applied = await execFileCapturedWithStdin(applyArgs[0], applyArgs.slice(1), ctx.cwd, JSON.stringify(payload));
    let report: { applied?: Array<{ path: string; action: string; reason?: string }>; staged_inferred?: Array<{ slug?: string }>; errors?: unknown[] } = {};
    try {
      report = JSON.parse(applied.stdout) as typeof report;
    } catch {
      fail(pi, ctx, "apply", applied.stderr.trim() || "apply returned invalid JSON", applied.code);
      return;
    }
    if (applied.code !== 0) {
      const first = Array.isArray(report.errors) && report.errors.length > 0
        ? String(report.errors[0])
        : `apply exited ${applied.code}`;
      recordCommandError(pi, "b-save-improved", "apply", first, applied.code);
    }
    for (const row of report.applied ?? []) {
      notify(ctx, `${row.action} ${row.path}${row.reason ? ` — ${row.reason}` : ""}`);
    }
    if ((report.staged_inferred ?? []).length > 0) {
      const slugs = (report.staged_inferred ?? []).map((s) => s.slug ?? JSON.stringify(s)).join(", ");
      notify(ctx, `Staged inferred: ${slugs}. Re-run /b-save-improved --archive-inferred to archive these.`, "warning");
    }
    if (adjudicationSkipped) {
      notify(ctx, "Adjudication skipped — memory, index, cross-references, and explicit backlog completions still landed.", "warning");
    }
    const userGoal = (preflight.user_goal ?? {}) as { missing?: string[] };
    if ((userGoal.missing ?? []).length > 0) {
      notify(ctx, `User Goal missing on: ${(userGoal.missing ?? []).join(", ")}`, "warning");
    }
    const tableDrift = (phases as { table_drift?: unknown[] }).table_drift;
    if (Array.isArray(tableDrift) && tableDrift.length > 0) {
      notify(ctx, `Phase table drift remains: ${JSON.stringify(tableDrift)}`, "warning");
    }
    const backend = (preflight.memory_backend ?? {}) as { backend?: string | null; expect_retain?: boolean };
    if (!backend.expect_retain && (backend.backend == null || backend.backend === undefined)) {
      const which = await execFileCaptured("which", ["qmd"], ctx.cwd);
      if (which.code === 0) {
        const indexed = await execFileCaptured("qmd", ["index", ".context/memory"], ctx.cwd);
        if (indexed.code !== 0) {
          notify(ctx, "qmd re-index failed (non-blocking)", "warning");
        }
      }
    }

    if (!opts.noRetain && !opts.dryRun) {
      const memoryPath = String((payload.memory as { path?: string }).path ?? "");
      const instruction = buildRetainInstruction(
        backend,
        memoryPath,
        String((preflight.subject as { name?: string })?.name ?? ""),
        scribe.retain_facts,
      );
      pi.sendMessage(
        {
          customType: "b-save-improved-retain",
          content: instruction,
          display: true,
        },
        { triggerTurn: true },
      );
    }
  } finally {
    progress.clear();
  }
}

export function wire(pi: ExtensionAPI): void {
  pi.registerCommand("b-save-improved", {
    description: "Deterministic session-record checkpoint: preflight, scribe, auditor, apply; retain handed to the mainline agent",
    getArgumentCompletions(prefix: string) {
      return FLAGS.filter((flag) => flag.startsWith(prefix)).map((flag) => ({ value: flag, label: flag }));
    },
    handler: async (args: string, ctx: CommandCtx) => {
      await runBSaveImproved(args, ctx, pi);
    },
  });
}
