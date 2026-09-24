import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { open, readdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { AttributionDatabase, type AttributionRecord } from "./db.js";
import {
  resolveGitHeadState,
  resolveGitIdentity,
  type GitIdentity,
  type GitRunner,
} from "./git-identity.js";
import { buildTokenReport } from "./report.js";

const IDENTITY_ENTRY = "buck.token-attribution.identity";

type SessionContext = Pick<ExtensionContext, "cwd" | "sessionManager" | "ui">;

interface UsageShape {
  input?: unknown;
  output?: unknown;
  cacheRead?: unknown;
  cacheWrite?: unknown;
  reasoningTokens?: unknown;
  totalTokens?: unknown;
  cost?: { total?: unknown };
}

interface AssistantShape {
  role?: unknown;
  provider?: unknown;
  model?: unknown;
  api?: unknown;
  timestamp?: unknown;
  usage?: UsageShape;
}

interface RawUsageEntry {
  type?: unknown;
  id?: unknown;
  timestamp?: unknown;
  message?: AssistantShape;
  data?: AssistantShape;
  provider?: unknown;
  model?: unknown;
  api?: unknown;
  usage?: UsageShape;
}
interface NormalizedAssistant {
  provider: string;
  model: string;
  api: string;
  timestamp: unknown;
  usage: UsageShape;
}


function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isoTimestamp(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function assistantFromEntry(entry: RawUsageEntry): AssistantShape | null {
  if (entry.message?.role === "assistant") return entry.message;
  if (entry.type !== "model_usage") return null;
  if (entry.data?.usage) return entry.data;
  return {
    role: "assistant",
    provider: entry.provider,
    model: entry.model,
    api: entry.api,
    timestamp: entry.timestamp,
    usage: entry.usage,
  };
}
function normalizeAssistant(entry: RawUsageEntry): NormalizedAssistant | null {
  const message = assistantFromEntry(entry);
  if (!message?.usage) return null;
  if (typeof message.provider !== "string" || typeof message.model !== "string") return null;
  return {
    provider: message.provider,
    model: message.model,
    api: typeof message.api === "string" ? message.api : "",
    timestamp: message.timestamp,
    usage: message.usage,
  };
}


function optionalFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}


interface ExtractedUsageRecord {
  record: AttributionRecord;
  fallbackEntryKey: string;
}

function extractUsageDelivery(
  raw: unknown,
  sessionFile: string,
  sessionId: string,
  identity: GitIdentity,
): ExtractedUsageRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as RawUsageEntry;
  const message = normalizeAssistant(entry);
  if (!message) return null;

  const recordedAt = isoTimestamp(entry.timestamp ?? message.timestamp);
  const totalTokens = finiteNumber(message.usage.totalTokens);
  const fallbackEntryKey = `${isoTimestamp(message.timestamp ?? entry.timestamp)}:${message.provider}:${message.model}:${totalTokens}`;
  const costUsd = optionalFiniteNumber(message.usage.cost?.total);

  return {
    fallbackEntryKey,
    record: {
      recordedAt,
      sessionFile,
      sessionId,
      entryKey: typeof entry.id === "string" && entry.id ? entry.id : fallbackEntryKey,
      projectKey: identity.projectKey,
      branch: identity.branch,
      worktreeRoot: identity.worktreeRoot,
      provider: message.provider,
      model: message.model,
      api: message.api,
      inputTokens: finiteNumber(message.usage.input),
      outputTokens: finiteNumber(message.usage.output),
      cacheReadTokens: finiteNumber(message.usage.cacheRead),
      cacheWriteTokens: finiteNumber(message.usage.cacheWrite),
      reasoningTokens: optionalFiniteNumber(message.usage.reasoningTokens),
      totalTokens,
      costUsd,
      costSource: costUsd === null ? "none" : "usage",
    },
  };
}

export function extractUsageRecord(
  raw: unknown,
  sessionFile: string,
  sessionId: string,
  identity: GitIdentity,
): AttributionRecord | null {
  return extractUsageDelivery(raw, sessionFile, sessionId, identity)?.record ?? null;
}

async function jsonlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await jsonlFiles(path));
    else if (entry.isFile() && extname(entry.name) === ".jsonl") files.push(path);
  }
  return files;
}

export interface ArtifactScanCursor {
  offset: number;
  remainder: Buffer;
}

export type ArtifactScanCursors = Map<string, ArtifactScanCursor>;

export async function scanSessionArtifacts(
  ledger: AttributionDatabase,
  sessionFile: string,
  identity: GitIdentity,
  cursors: ArtifactScanCursors = new Map(),
): Promise<number> {
  const sessionId = basename(sessionFile, ".jsonl");
  const artifactRoot = join(dirname(sessionFile), sessionId);
  let inserted = 0;

  for (const file of await jsonlFiles(artifactRoot)) {
    let cursor = cursors.get(file) ?? { offset: 0, remainder: Buffer.alloc(0) };
    let handle;
    try {
      handle = await open(file, "r");
      const size = (await handle.stat()).size;
      if (size < cursor.offset) cursor = { offset: 0, remainder: Buffer.alloc(0) };
      const appendedByteCount = size - cursor.offset;
      if (appendedByteCount === 0 && cursor.remainder.length === 0) {
        cursors.set(file, cursor);
        continue;
      }
      const appended = Buffer.allocUnsafe(appendedByteCount);
      const { bytesRead } = await handle.read(appended, 0, appendedByteCount, cursor.offset);
      cursor.offset += bytesRead;
      const content = cursor.remainder.length === 0
        ? appended.subarray(0, bytesRead)
        : Buffer.concat([cursor.remainder, appended.subarray(0, bytesRead)]);
      let lineStart = 0;
      for (let index = 0; index < content.length; index += 1) {
        if (content[index] !== 0x0a) continue;
        const line = content.toString("utf8", lineStart, index).trim();
        const currentLineStart = lineStart;
        lineStart = index + 1;
        if (!line) continue;
        let delivery: ExtractedUsageRecord | null;
        try {
          delivery = extractUsageDelivery(JSON.parse(line), file, sessionId, identity);
        } catch {
          // Unrelated malformed JSONL must not break attribution for the turn.
          continue;
        }
        if (!delivery) continue;
        try {
          if (ledger.insertReconciled(delivery.record, delivery.fallbackEntryKey)) inserted += 1;
        } catch (error) {
          // Keep the failed line so the next scan retries it.
          cursor.remainder = Buffer.from(content.subarray(currentLineStart));
          cursors.set(file, cursor);
          throw error;
        }
      }
      cursor.remainder = Buffer.from(content.subarray(lineStart));
      cursors.set(file, cursor);
    } catch {
      // A disappearing or unreadable nested artifact can be retried next turn.
    } finally {
      await handle?.close();
    }
  }
  return inserted;
}

export interface TokenAttributionWireOptions {
  databasePath?: string;
  gitRunner?: GitRunner;
}

export function wire(pi: ExtensionAPI, options: TokenAttributionWireOptions = {}): void {
  let ledger: AttributionDatabase | null = null;
  let lastIdentityKey = "";
  let commandRegistered = false;
  let cachedIdentity: { cwd: string; headKey: string; identity: GitIdentity } | null = null;
  const artifactCursors: ArtifactScanCursors = new Map();

  const database = (): AttributionDatabase => {
    ledger ??= new AttributionDatabase(options.databasePath);
    return ledger;
  };

  const identityFor = async (cwd: string): Promise<GitIdentity> => {
    const headState = await resolveGitHeadState(cwd, options.gitRunner);
    const headKey = headState?.key ?? "(non-git)";
    if (cachedIdentity?.cwd === cwd && cachedIdentity.headKey === headKey) {
      return cachedIdentity.identity;
    }
    const identity = await resolveGitIdentity(cwd, options.gitRunner, headState);
    cachedIdentity = { cwd, headKey, identity };
    return identity;
  };

  const persistIdentity = (identity: GitIdentity): void => {
    const key = `${identity.projectKey}\0${identity.branch ?? ""}`;
    if (key === lastIdentityKey) return;
    pi.appendEntry(IDENTITY_ENTRY, identity);
    lastIdentityKey = key;
  };

  const scanNested = async (ctx: SessionContext, identity: GitIdentity): Promise<void> => {
    const sessionFile = ctx.sessionManager.getSessionFile?.();
    if (sessionFile) {
      await scanSessionArtifacts(database(), sessionFile, identity, artifactCursors);
    }
  };

  const registerReportCommand = (): void => {
    if (commandRegistered) return;
    const existingCommands = pi.getCommands();
    const commandName = existingCommands.some((command) => command.name === "tokens") ? "token-use" : "tokens";
    pi.registerCommand(commandName, {
      description: commandName === "tokens"
        ? "Show estimated token use for the current project and its branches"
        : "Show estimated token use (registered as /token-use because /tokens already exists)",
      handler: async (args, ctx) => {
        try {
          const identity = await identityFor(ctx.cwd);
          const report = buildTokenReport(database(), identity.projectKey, args);
          ctx.ui.notify(report, "info");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify(`Token report unavailable: ${message}`, "error");
        }
      },
    });
    commandRegistered = true;
  };

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index] as { type?: string; customType?: string; data?: GitIdentity };
      if (entry.type !== "custom" || entry.customType !== IDENTITY_ENTRY || !entry.data) continue;
      lastIdentityKey = `${entry.data.projectKey}\0${entry.data.branch ?? ""}`;
      break;
    }
    registerReportCommand();
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    try {
      const identity = await identityFor(ctx.cwd);
      persistIdentity(identity);
      const sessionFile = ctx.sessionManager.getSessionFile?.();
      if (!sessionFile) return;
      const sessionId = basename(sessionFile, ".jsonl");
      const record = extractUsageRecord(
        { type: "message", timestamp: event.message.timestamp, message: event.message },
        sessionFile,
        sessionId,
        identity,
      );
      if (record) database().insert(record);
      await scanNested(ctx, identity);
    } catch {
      // Attribution must never interrupt the assistant response.
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    try {
      const identity = await identityFor(ctx.cwd);
      persistIdentity(identity);
      await scanNested(ctx, identity);
    } catch {
      // The next event can retry; the session identity entry remains a fallback.
    }
  });

}

export default wire;
