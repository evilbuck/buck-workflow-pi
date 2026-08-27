import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CapturedExec {
  code: number;
  stdout: string;
  stderr: string;
}

export async function execFileCaptured(
  bin: string,
  args: string[],
  cwd: string,
): Promise<CapturedExec> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd,
      encoding: "utf-8",
    });
    return { code: 0, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (e: unknown) {
    const err = e as { code?: string | number; stdout?: string; stderr?: string };
    const code = typeof err.code === "number" ? err.code : 1;
    return {
      code,
      stdout: typeof err.stdout === "string" ? err.stdout : "",
      stderr: typeof err.stderr === "string" ? err.stderr : "",
    };
  }
}

export async function execFileCapturedWithStdin(
  bin: string,
  args: string[],
  cwd: string,
  stdin: string,
): Promise<CapturedExec> {
  const { promise, resolve } = Promise.withResolvers<CapturedExec>();
  const child = spawn(bin, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });
  child.on("error", (err) => {
    resolve({ code: 1, stdout, stderr: stderr || err.message });
  });
  child.on("close", (code) => {
    resolve({ code: code ?? 1, stdout, stderr });
  });
  child.stdin?.write(stdin);
  child.stdin?.end();
  return promise;
}

export type ProgressLevel = "info" | "warning" | "error";

export interface ProgressUI {
  notify?: (message: string, level?: ProgressLevel) => void;
  setStatus?: (key: string, text?: string) => void;
  setWorkingMessage?: (message?: string) => void;
}

export interface ProgressCtx {
  ui?: ProgressUI;
}

export interface Progress {
  step(label: string): void;
  fail(label: string): void;
  done(label: string): void;
  clear(): void;
}

function callSafe(fn: () => void): void {
  try {
    fn();
  } catch {
    // Custom-command UI surfaces are optional and must not abort the handler.
  }
}

export function createProgress(ctx: ProgressCtx, key: string): Progress {
  const ui = ctx.ui ?? {};
  return {
    step(label) {
      callSafe(() => ui.notify?.(label, "info"));
      callSafe(() => ui.setStatus?.(key, label));
      callSafe(() => ui.setWorkingMessage?.(label));
    },
    fail(label) {
      callSafe(() => ui.notify?.(label, "warning"));
      callSafe(() => ui.setStatus?.(key, label));
    },
    done(label) {
      callSafe(() => ui.notify?.(label, "info"));
      callSafe(() => ui.setStatus?.(key));
      callSafe(() => ui.setWorkingMessage?.());
    },
    clear() {
      callSafe(() => ui.setStatus?.(key));
      callSafe(() => ui.setWorkingMessage?.());
    },
  };
}

const ERROR_MESSAGE_CAP = 500;

export function recordCommandError(
  pi: { appendEntry: (customType: string, data?: unknown) => void },
  command: string,
  step: string,
  message: string,
  code?: number,
): void {
  const clipped = message.length > ERROR_MESSAGE_CAP ? `${message.slice(0, ERROR_MESSAGE_CAP)}…` : message;
  try {
    pi.appendEntry(`${command}-error`, {
      at: new Date().toISOString(),
      step,
      ...(code !== undefined ? { code } : {}),
      message: clipped,
    });
  } catch {
    // session write optional
  }
}

export const KAMAL_TAIL_LINES = 20;

export function createLineRing(maxLines: number): {
  push(chunk: string): void;
  finish(): string[];
} {
  const lines: string[] = [];
  let leftover = "";

  const take = (line: string): void => {
    if (line.length === 0) return;
    lines.push(line);
    if (lines.length > maxLines) lines.shift();
  };

  return {
    push(chunk) {
      leftover += chunk;
      const parts = leftover.split("\n");
      leftover = parts.pop() ?? "";
      for (const part of parts) take(part);
    },
    finish() {
      take(leftover);
      leftover = "";
      return [...lines];
    },
  };
}
