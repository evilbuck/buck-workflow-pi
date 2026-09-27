import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, type WriteStream } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { finished } from "node:stream/promises";
import type { ActivityEvent } from "../extension-activity.js";
import type { LoopCommand, LoopProgress } from "./loop.js";
import type { LoopState } from "./types.js";

export const ACTIVITY_LOG_RELPATH = ".context/workflow/buck-loop.log.jsonl";
export const ACTIVITY_LOG_VERSION = 1 as const;
const MAX_BUFFERED_BYTES = 1024 * 1024;

type RecordBase = {
  version: typeof ACTIVITY_LOG_VERSION;
  timestamp: string;
  invocationId: string;
};

export type BuckLoopLogRecord =
  | (RecordBase & { type: "invocation"; command: "start" | "resume"; path?: string })
  | (RecordBase & { type: "progress" } & LoopProgress)
  | (RecordBase & { type: "activity" } & ActivityEvent)
  | (RecordBase & { type: "terminal"; state: LoopState; reason: string; ok: boolean });

export type BuckLoopActivityLog = {
  progress(progress: LoopProgress): void;
  activity(event: ActivityEvent): void;
  terminal(result: { state: LoopState; reason: string; ok: boolean }): void;
  flush(): Promise<void>;
  close(): Promise<void>;
};

export type CreateBuckLoopActivityLogOptions = {
  cwd: string;
  command: LoopCommand;
  path?: string;
  onWarning(message: string): void;
};

const preparedRoots = new Set<string>();

function noOpLog(): BuckLoopActivityLog {
  return {
    progress: () => undefined,
    activity: () => undefined,
    terminal: () => undefined,
    flush: async () => undefined,
    close: async () => undefined,
  };
}

function prepareLogPath(root: string, warn: (message: string) => void): void {
  if (preparedRoots.has(root)) return;
  preparedRoots.add(root);
  try {
    const gitPath = execFileSync("git", ["rev-parse", "--git-path", "info/exclude"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const excludePath = resolve(root, gitPath);
    mkdirSync(dirname(excludePath), { recursive: true });
    const existing = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
    if (!existing.split(/\r?\n/).includes(ACTIVITY_LOG_RELPATH)) {
      appendFileSync(excludePath, (existing && !existing.endsWith("\n") ? "\n" : "") + ACTIVITY_LOG_RELPATH + "\n");
    }
    execFileSync("git", ["rm", "--cached", "-f", "--quiet", "--ignore-unmatch", "--", ACTIVITY_LOG_RELPATH], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    warn(`buck-loop: activity log hygiene skipped for ${root}; ${ACTIVITY_LOG_RELPATH} may be committed if staged`);
  }
}

/**
 * Opens the local JSONL drain for a running command. Status and stop return a
 * no-op handle so inspecting or aborting a run never changes the current log.
 */
export function createBuckLoopActivityLog(options: CreateBuckLoopActivityLogOptions): BuckLoopActivityLog {
  if (options.command === "status" || options.command === "stop") return noOpLog();

  const root = resolve(options.cwd);
  let warned = false;
  const warnOnce = (message: string): void => {
    if (warned) return;
    warned = true;
    options.onWarning(message);
  };
  let hygieneWarning: string | null = null;
  prepareLogPath(root, (message) => { hygieneWarning = message; });

  const path = join(root, ACTIVITY_LOG_RELPATH);
  let stream: WriteStream;
  try {
    mkdirSync(dirname(path), { recursive: true });
    stream = createWriteStream(path, { flags: options.command === "start" ? "w" : "a", encoding: "utf8", highWaterMark: MAX_BUFFERED_BYTES });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnOnce(`buck-loop: activity log disabled: ${message}`);
    return noOpLog();
  }
  if (hygieneWarning) warnOnce(hygieneWarning);
  const invocationId = randomUUID();
  let enabled = true;
  let closed = false;
  let closing: Promise<void> | undefined;
  let backpressured = false;
  stream.on("drain", () => { backpressured = false; });

  const disable = (error: unknown): void => {
    if (!enabled) return;
    enabled = false;
    const message = error instanceof Error ? error.message : String(error);
    warnOnce(`buck-loop: activity log disabled: ${message}`);
    stream.destroy();
  };
  stream.on("error", disable);

  const write = (record: BuckLoopLogRecord): void => {
    if (!enabled || closed) return;
    try {
      const line = JSON.stringify(record) + "\n";
      if (backpressured || stream.writableLength + Buffer.byteLength(line) > MAX_BUFFERED_BYTES) {
        disable(new Error("pending activity exceeds the 1 MiB buffer limit"));
        return;
      }
      backpressured = !stream.write(line);
    } catch (error) {
      disable(error);
    }
  };
  const base = (): RecordBase => ({
    version: ACTIVITY_LOG_VERSION,
    timestamp: new Date().toISOString(),
    invocationId,
  });

  write(options.command === "start"
    ? { ...base(), type: "invocation", command: "start", path: options.path }
    : { ...base(), type: "invocation", command: "resume" });

  return {
    progress: (progress) => write({ ...base(), type: "progress", ...progress }),
    activity: (event) => write({ ...base(), type: "activity", ...event }),
    terminal: (result) => write({ ...base(), type: "terminal", ...result }),
    flush: async () => {
      if (!enabled || closed) return;
      await new Promise<void>((resolve) => {
        stream.write("", (error) => {
          if (error) disable(error);
          resolve();
        });
      });
    },
    close: () => {
      if (closing) return closing;
      closed = true;
      closing = finished(stream).catch(disable);
      stream.end();
      return closing;
    },
  };
}
