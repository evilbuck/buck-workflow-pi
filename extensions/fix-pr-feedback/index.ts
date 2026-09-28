import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const STDOUT_CAP = 1024 * 1024;
const METADATA_CAP = 1024;
const CANDIDATE_CAP = 25;
const PROGRESS_CAP = 8;
const SAFE_PROGRESS_STAGES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bfetching (?:PR #\d+ metadata|reviews)\b/, "Fetching PR feedback: loading reviews."],
  [/\bfetching (?:inline|conversation) comments\b/, "Fetching PR feedback: loading comments."],
  [/\b(?:fetching checks|checks loaded:|check (?:pending|pass|fail|skipping):)\b/, "Fetching PR feedback: checking CI."],
  [/\b(?:walking review threads page|review threads page|review threads:)\b/, "Fetching PR feedback: loading review threads."],
  [/\b(?:fetching (?:annotations|failed log) for|annotations unavailable|failed log unavailable)\b/, "Fetching PR feedback: inspecting failed CI evidence."],
];
const COUNT_NAMES: Record<string, true> = {
  needs_judgment: true,
  resolved_thread: true,
  duplicate_id: true,
  empty: true,
  pending_checks: true,
};


const FeedbackParams = Type.Object({
  repo: Type.String({ pattern: "^[^/\\s]+/[^/\\s]+$", description: "GitHub repository as owner/repo." }),
  number: Type.Integer({ minimum: 1, description: "Positive pull request number." }),
  seenIds: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 256, pattern: "^[^\\r\\n]+(?![\\s\\S])", description: "One feedback ID per item; CR and LF are forbidden." }), { maxItems: 10_000 })),
});

type FeedbackParamsType = {
  repo: string;
  number: number;
  seenIds?: string[];
};

type ChildLike = Pick<ChildProcess, "stdout" | "stderr" | "kill"> & {
  on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
};

type Spawn = (bin: string, args: string[], options: { shell: false; stdio: ["ignore", "pipe", "pipe"] }) => ChildLike;

export interface FeedbackToolDeps {
  spawn?: Spawn;
  scriptPath?: string;
  tempDir?: string;
  remove?: (directory: string) => Promise<void>;
}

interface ToolError {
  error: true;
  code: "cancelled" | "fetch_failed" | "invalid_output" | "invalid_input";
  message: string;
}

interface CompactCandidate {
  id: string;
  source: string;
  pathLine: string;
  mechanical: string;
  seen: boolean;
}

interface CompactSummary {
  ok: true;
  inventoryPath: string;
  repo: string;
  number: number;
  headRefOid: string;
  counts: Record<string, number>;
  candidates: CompactCandidate[];
}

interface FeedbackResult {
  content: Array<{ type: "text"; text: string }>;
  details: CompactSummary | ToolError;
}

interface ProgressUpdate {
  content: Array<{ type: "text"; text: string }>;
  details: { progress: true };
}

function result(payload: CompactSummary | ToolError): FeedbackResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], details: payload };
}

function errorResult(code: ToolError["code"], message: string) {
  return result({ error: true, code, message });
}

function scriptAtRuntime(): string {
  return join(import.meta.dirname, "..", "..", "skills", "fix-pr", "scripts", "fetch-feedback.ts");
}

function progressReporter(onUpdate: ((update: ProgressUpdate) => void) | undefined): (chunk: Buffer | string) => void {
  const reported = new Set<string>();
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let discardingLine = false;
  const maxLineLength = 4096;
  const classifyLine = (line: string) => {
    if (reported.size >= PROGRESS_CAP) return;
    const stage = SAFE_PROGRESS_STAGES.find(([pattern]) => pattern.test(line))?.[1];
    if (stage === undefined || reported.has(stage)) return;
    reported.add(stage);
    onUpdate?.({ content: [{ type: "text", text: stage }], details: { progress: true } });
  };
  return (chunk) => {
    const text = typeof chunk === "string" ? chunk : decoder.write(chunk);
    const parts = text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (part.length > maxLineLength || pending.length + part.length > maxLineLength) {
        pending = "";
        discardingLine = true;
      } else if (!discardingLine) {
        pending += part;
      }
      if (i < parts.length - 1) {
        if (!discardingLine) classifyLine(pending);
        pending = "";
        discardingLine = false;
      }
    }
  };
}

function compactCounts(value: unknown): Record<string, number> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const counts: Record<string, number> = {};
  for (const [name, count] of Object.entries(value)) {
    if (COUNT_NAMES[name] !== true || !Number.isInteger(count) || count < 0) return null;
    counts[name] = count;
  }
  return counts;
}

function isCompactMetadata(value: unknown): value is string {
  return typeof value === "string" && value.length <= METADATA_CAP;
}

function hasRequiredSummaryMetadata(value: Record<string, unknown>): value is Record<string, unknown> & { inventoryPath: string; headRefOid: string } {
  return isCompactMetadata(value.inventoryPath)
    && value.inventoryPath.length > 0
    && isCompactMetadata(value.headRefOid)
    && value.headRefOid.length > 0;
}


function compactCandidates(value: unknown): CompactCandidate[] | null {
  if (!Array.isArray(value)) return null;
  const candidates: CompactCandidate[] = [];
  for (const candidate of value.slice(0, CANDIDATE_CAP)) {
    if (typeof candidate !== "object" || candidate === null) return null;
    const item = candidate as Record<string, unknown>;
    if (!isCompactMetadata(item.id) || !isCompactMetadata(item.source) || !isCompactMetadata(item.pathLine) || !isCompactMetadata(item.mechanical) || typeof item.seen !== "boolean") return null;
    candidates.push({ id: item.id, source: item.source, pathLine: item.pathLine, mechanical: item.mechanical, seen: item.seen });
  }
  return candidates;
}

function compactSummary(value: unknown, expected: FeedbackParamsType): CompactSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.ok !== true || raw.repo !== expected.repo || raw.number !== expected.number || !hasRequiredSummaryMetadata(raw)) return null;
  const counts = compactCounts(raw.counts);
  const candidates = compactCandidates(raw.candidates);
  if (!counts || !candidates) return null;
  return {
    ok: true,
    inventoryPath: raw.inventoryPath,
    repo: raw.repo,
    number: raw.number,
    headRefOid: raw.headRefOid,
    counts,
    candidates,
  };
}

function cancellationDeadline(child: ChildLike, signal: AbortSignal | undefined, settle: () => void): () => void {
  let timer: NodeJS.Timeout | undefined;
  const cancel = () => {
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      child.stdout?.destroy();
      child.stderr?.destroy();
      settle();
    }, 250);
    child.kill("SIGTERM");
  };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  return () => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  };
}

function collectOutput(child: ChildLike, reportProgress: (chunk: Buffer | string) => void, signal: AbortSignal | undefined): Promise<{ code: number; stdout: string; oversized: boolean }> {
  const { promise, resolve } = Promise.withResolvers<{ code: number; stdout: string; oversized: boolean }>();
  let stdout = "";
  const decoder = new StringDecoder("utf8");
  let bytes = 0;
  let oversized = false;
  child.stdout?.on("data", (chunk: Buffer | string) => {
    if (oversized) return;
    bytes += Buffer.byteLength(chunk);
    if (bytes > STDOUT_CAP) {
      oversized = true;
      stdout = "";
      child.kill("SIGKILL");
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve({ code: 1, stdout: "", oversized });
      return;
    }
    stdout += typeof chunk === "string" ? chunk : decoder.write(chunk);
  });
  // Stderr can contain arbitrary PR titles and CI logs, including on failure.
  child.stderr?.on("data", reportProgress);
  child.on("error", () => resolve({ code: 1, stdout, oversized }));
  child.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout + decoder.end(), oversized }));
  const cleanupCancellation = cancellationDeadline(child, signal, () => resolve({ code: 1, stdout: "", oversized }));
  return promise.finally(cleanupCancellation);
}

async function invokeFeedback(params: FeedbackParamsType, signal: AbortSignal | undefined, onUpdate: ((update: ProgressUpdate) => void) | undefined, deps: Required<FeedbackToolDeps>) {
  if (signal?.aborted) return errorResult("cancelled", "fix_pr_feedback cancelled before fetch started");
  if (params.seenIds?.some((id) => /[\r\n]/.test(id))) {
    return errorResult("invalid_input", "seenIds must not contain carriage returns or newlines");
  }
  let tempDirectory: string | undefined;
  if (params.seenIds?.length) {
    try {
      tempDirectory = await mkdtemp(join(deps.tempDir, "fix-pr-feedback-"));
    } catch {
      return errorResult("fetch_failed", "fix_pr_feedback could not create its temporary directory");
    }
  }
  let response: FeedbackResult;
  try {
    const args = [deps.scriptPath, params.repo, String(params.number)];
    if (params.seenIds?.length && tempDirectory !== undefined) {
      const seenPath = join(tempDirectory, "seen-ids");
      await writeFile(seenPath, `${params.seenIds.join("\n")}\n`, { mode: 0o600 });
      args.push("--seen-ids-file", seenPath);
    }
    const reportProgress = progressReporter(onUpdate);
    const child = deps.spawn("bun", args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const execution = await collectOutput(child, reportProgress, signal);
    if (signal?.aborted) response = errorResult("cancelled", "fix_pr_feedback cancelled");
    else if (execution.oversized) response = errorResult("invalid_output", "fix_pr_feedback exceeded the stdout byte limit");
    else if (execution.code !== 0) response = errorResult("fetch_failed", `fix_pr_feedback exited ${execution.code}`);
    else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(execution.stdout);
      } catch {
        response = errorResult("invalid_output", "fix_pr_feedback returned invalid JSON");
        parsed = undefined;
      }
      if (parsed !== undefined) {
        const summary = compactSummary(parsed, params);
        response = summary ? result(summary) : errorResult("invalid_output", "fix_pr_feedback returned an invalid summary");
      }
    }
  } catch {
    response = errorResult("fetch_failed", "fix_pr_feedback could not start");
  }
  if (tempDirectory !== undefined) {
    try {
      await deps.remove(tempDirectory);
    } catch {
      return errorResult("fetch_failed", "fix_pr_feedback could not clean its temporary directory");
    }
  }
  if (signal?.aborted) return errorResult("cancelled", "fix_pr_feedback cancelled");
  return response;
}

export function feedbackTool(deps: FeedbackToolDeps = {}): ToolDefinition<typeof FeedbackParams> {
  const resolved: Required<FeedbackToolDeps> = {
    spawn: deps.spawn ?? ((bin, args, options) => nodeSpawn(bin, args, options)),
    scriptPath: deps.scriptPath ?? scriptAtRuntime(),
    tempDir: deps.tempDir ?? tmpdir(),
    remove: deps.remove ?? ((directory) => rm(directory, { recursive: true, force: true })),
  };
  return {
    name: "fix_pr_feedback",
    label: "Fix PR Feedback",
    description: "Fetch a complete, compact PR feedback inventory through the canonical fix-pr ingest. Read-only from GitHub; fails closed.",
    promptSnippet: "fix_pr_feedback: exhaustive PR review, thread, and CI inventory via the canonical fetcher.",
    promptGuidelines: ["Use fix_pr_feedback for exhaustive PR feedback ingestion; native PR views are orientation only."],
    executionMode: "parallel",
    parameters: FeedbackParams,
    async execute(_id, params, signal, onUpdate) {
      return invokeFeedback(params, signal, onUpdate as ((update: ProgressUpdate) => void) | undefined, resolved);
    },
  };
}

export function wire(api: ExtensionAPI, deps: FeedbackToolDeps = {}): void {
  api.registerTool(feedbackTool(deps));
}
