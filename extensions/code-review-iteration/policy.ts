/**
 * policy — the `review_exec` trust boundary.
 *
 * The Reviewer may run reproduction commands only through this structured,
 * allowlisted runner: a command id plus full argv plus repo-relative cwd.
 * There is no shell, no caller environment, no credential inheritance.
 * Matching is structural (element-wise argv prefix), never string-prefix.
 * Host network is always on for spawned commands (not a sandbox); the
 * command record's `network_exposed` field records that actual exposure.
 * `allow_network` in the policy file is documentation of intent only.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { parseFrontmatter, FrontmatterParseError, type ListItem } from "./frontmatter.js";

export const SANITIZED_ENV_KEYS: readonly string[] = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "TZ",
  "TMPDIR",
  "TERM",
];

/** Characters that indicate shell syntax — such commands are never auto-mapped. */
const UNSAFE_SHELL_CHARS = /["'`|;&<>$()\\\n]/;

/** Credential-like names and process-injection vectors never pass through. */
const ENV_DENY_PATTERN =
  /TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|COOKIE|NODE_OPTIONS|NODE_PATH|LD_|DYLD_|BASH_ENV|SHELLOPTS|ENV|PYTHON|PERL|RUBYOPT|RUBYLIB|GEM_HOME|GEM_PATH|AWKPATH|GIT_|IFS/i;

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

export interface ExecPolicyCommand {
  id: string;
  executable: string;
  /** argv elements after the executable; requests must start with these. */
  argvPrefix: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  extraEnv?: string[];
}

export interface ExecPolicy {
  defaultTimeoutMs: number;
  defaultMaxOutputBytes: number;
  allowNetwork: boolean;
  commands: ExecPolicyCommand[];
}

export interface CommandRecord {
  /** Policy command id (e.g. git-status). */
  command_id: string;
  /** Evidence id assigned by the caller (c1, c2, …) for finding citations. */
  evidence_id?: string;
  argv: string[];
  cwd: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  exit_code: number | null;
  signal: string | null;
  timed_out: boolean;
  stdout_excerpt: string;
  stderr_excerpt: string;
  stdout_sha256: string;
  stderr_sha256: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  denied_reason: string | null;
  /** Always true for spawned commands — this runner is not a network sandbox. */
  network_exposed: boolean;
}

export interface ReviewExecRequest {
  id: unknown;
  argv: unknown;
  cwd?: unknown;
}

function coerceCommand(item: ListItem, file: string): ExecPolicyCommand {
  const str = (key: string): string | undefined => {
    const value = item[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  const id = str("id");
  const executable = str("executable");
  if (!id || !executable) {
    throw new PolicyError(`${file}: command entry needs non-empty id and executable`);
  }
  const prefix = item.argv_prefix;
  if (prefix !== undefined && !Array.isArray(prefix)) {
    throw new PolicyError(`${file}: command ${id} argv_prefix must be a list`);
  }
  const timeoutMs = str("timeout_ms");
  const maxOutputBytes = str("max_output_bytes");
  const extraEnv = item.extra_env;
  return {
    id,
    executable,
    argvPrefix: (prefix as string[] | undefined) ?? [],
    timeoutMs: timeoutMs !== undefined && /^\d+$/.test(timeoutMs) ? Number(timeoutMs) : undefined,
    maxOutputBytes: maxOutputBytes !== undefined && /^\d+$/.test(maxOutputBytes) ? Number(maxOutputBytes) : undefined,
    extraEnv: Array.isArray(extraEnv) ? (extraEnv as string[]) : undefined,
  };
}

/** Parse `review-exec-policy.md`. Throws PolicyError on contract violations. */
export function parseExecPolicy(text: string, file = "review-exec-policy.md"): ExecPolicy {
  let data;
  try {
    data = parseFrontmatter(text).data;
  } catch (e: unknown) {
    const message = e instanceof FrontmatterParseError ? e.message : String(e);
    throw new PolicyError(`${file}: parse failed — ${message}`);
  }
  if (data.schema_version !== "1") {
    throw new PolicyError(`${file}: unsupported schema_version (expected 1)`);
  }
  const num = (key: string, fallback: number): number => {
    const raw = data[key];
    if (typeof raw !== "string" || !/^\d+$/.test(raw)) return fallback;
    return Number(raw);
  };
  const rawCommands = data.commands;
  if (!Array.isArray(rawCommands)) {
    throw new PolicyError(`${file}: commands must be a list of command entries`);
  }
  const commands = (rawCommands as ListItem[]).map((item) => coerceCommand(item, file));
  const ids = new Set<string>();
  for (const command of commands) {
    if (ids.has(command.id)) throw new PolicyError(`${file}: duplicate command id ${command.id}`);
    ids.add(command.id);
  }
  return {
    defaultTimeoutMs: num("default_timeout_ms", 120_000),
    defaultMaxOutputBytes: num("max_output_bytes", 65_536),
    allowNetwork: data.allow_network === "true",
    commands,
  };
}

/** Fixed read-only Git operations always available to the Reviewer. */
export function readOnlyGitCommands(): ExecPolicyCommand[] {
  const subcommands = ["status", "diff", "log", "show", "blame", "ls-files"];
  return subcommands.map((sub) => ({
    id: `git-${sub}`,
    executable: "git",
    argvPrefix: [sub],
  }));
}

/**
 * Map deterministic check-contract command strings (e.g. `npm test`) to
 * policy entries. Anything with shell syntax is skipped, never guessed.
 */
export function checkContractCommands(commandStrings: string[]): { entries: ExecPolicyCommand[]; skipped: string[] } {
  const entries: ExecPolicyCommand[] = [];
  const skipped: string[] = [];
  for (const raw of commandStrings) {
    const text = raw.trim();
    if (text === "" || UNSAFE_SHELL_CHARS.test(text)) {
      if (text !== "") skipped.push(raw);
      continue;
    }
    const parts = text.split(/\s+/);
    entries.push({
      id: `check-${parts.map((part) => part.replace(/^-+/, "")).join("-")}`,
      executable: parts[0],
      argvPrefix: parts.slice(1),
    });
  }
  return { entries, skipped };
}

function isWithin(child: string, parent: string): boolean {
  if (child === parent) return true;
  return child.startsWith(parent + sep);
}

/** Resolve a repo-relative request cwd; rejects escape, including via symlink. */
export function resolveRequestCwd(root: string, requestCwd: string): { cwd: string } | { denied: string } {
  if (isAbsolute(requestCwd) || requestCwd.split(/[\\/]/).includes("..")) {
    return { denied: `cwd must be repo-relative (got ${JSON.stringify(requestCwd)})` };
  }
  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch {
    return { denied: "repository root is unreadable" };
  }
  const resolved = requestCwd === "" || requestCwd === "." ? realRoot : resolve(root, requestCwd);
  if (!isWithin(resolved, resolve(root)) && resolved !== realRoot) {
    return { denied: `cwd escapes repository root` };
  }
  let realCwd: string;
  try {
    realCwd = realpathSync(resolved);
  } catch {
    return { denied: `cwd does not exist or is unreadable` };
  }
  if (!isWithin(realCwd, realRoot)) {
    return { denied: `cwd escapes repository root` };
  }
  return { cwd: realCwd };
}

function matchStructural(entry: ExecPolicyCommand, argv: string[]): { denied: string } | { ok: true } {
  if (argv[0] !== entry.executable) {
    return { denied: `argv[0] must be ${entry.executable} for ${entry.id}` };
  }
  const rest = argv.slice(1);
  if (rest.length < entry.argvPrefix.length) {
    return { denied: `${entry.id} requires at least [${[entry.executable, ...entry.argvPrefix].join(" ")}]` };
  }
  for (let i = 0; i < entry.argvPrefix.length; i++) {
    if (rest[i] !== entry.argvPrefix[i]) {
      return { denied: `${entry.id} must start with [${[entry.executable, ...entry.argvPrefix].join(" ")}]` };
    }
  }
  return { ok: true };
}

export function sanitizedEnv(extraEnv: string[] | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SANITIZED_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  for (const key of extraEnv ?? []) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || ENV_DENY_PATTERN.test(key)) continue;
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

/** First `maxBytes` of `buf` that do not split a UTF-8 codepoint. */
function utf8BytePrefix(buf: Buffer, maxBytes: number): Buffer {
  if (maxBytes <= 0) return buf.subarray(0, 0);
  if (buf.length <= maxBytes) return buf;
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end);
}

function attachCappedStream(
  stream: NodeJS.ReadableStream | null,
  maxBytes: number,
): { excerpt: string; truncated: boolean; digest: () => string } {
  const hash = createHash("sha256");
  const cap = { excerpt: "", bytes: 0, truncated: false };
  stream?.on("data", (chunk: Buffer | string) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buf);
    if (cap.truncated) return;
    const room = maxBytes - cap.bytes;
    if (buf.length <= room) {
      cap.excerpt += buf.toString();
      cap.bytes += buf.length;
      return;
    }
    const prefix = utf8BytePrefix(buf, room);
    cap.excerpt += prefix.toString();
    cap.bytes += prefix.length;
    cap.truncated = true;
  });
  return {
    get excerpt() {
      return cap.excerpt;
    },
    get truncated() {
      return cap.truncated;
    },
    digest: () => hash.digest("hex"),
  };
}

/**
 * Execute one allowlisted review command and return its sanitized evidence
 * record. Denials and spawn failures are records, not exceptions, so the
 * Reviewer sees `not run` with a policy reason and there is never an
 * unrestricted fallback.
 */
export function runReviewCommand(
  policy: ExecPolicy,
  root: string,
  request: ReviewExecRequest,
  now: () => number = Date.now,
): Promise<CommandRecord> {
  const startedMs = now();
  const base = {
    command_id: typeof request.id === "string" ? request.id : "",
    argv: Array.isArray(request.argv) ? request.argv.map(String) : [],
    cwd: typeof request.cwd === "string" && request.cwd !== "" ? request.cwd : ".",
    started_at: new Date(startedMs).toISOString(),
    stdout_sha256: "",
    stderr_sha256: "",
    denied_reason: null as string | null,
  };
  const finish = (record: Partial<CommandRecord>): CommandRecord => ({
    ...base,
    ended_at: "",
    duration_ms: 0,
    exit_code: null,
    signal: null,
    timed_out: false,
    stdout_excerpt: "",
    stderr_excerpt: "",
    stdout_truncated: false,
    stderr_truncated: false,
    denied_reason: null,
    stdout_sha256: "",
    stderr_sha256: "",
    network_exposed: false,
    ...record,
  });
  const entry = policy.commands.find((command) => command.id === base.command_id) ?? null;
  const deny = (reason: string): Promise<CommandRecord> => {
    const endedMs = now();
    return Promise.resolve(
      finish({
        ended_at: new Date(endedMs).toISOString(),
        duration_ms: endedMs - startedMs,
        exit_code: null,
        signal: null,
        timed_out: false,
        stdout_excerpt: "",
        stderr_excerpt: "",
        stdout_truncated: false,
        stderr_truncated: false,
        denied_reason: reason,
      }),
    );
  };
  if (!entry) return deny(`unknown command id ${JSON.stringify(base.command_id)}`);
  if (base.argv.length === 0) return deny("argv must be a non-empty array");
  const structural = matchStructural(entry, base.argv);
  if ("denied" in structural) return deny(structural.denied);
  const cwdResult = resolveRequestCwd(root, base.cwd);
  if ("denied" in cwdResult) return deny(cwdResult.denied);

  return new Promise<CommandRecord>((resolveRecord) => {
    const timeoutMs = entry.timeoutMs ?? policy.defaultTimeoutMs;
    const maxOutput = entry.maxOutputBytes ?? policy.defaultMaxOutputBytes;
    const child = spawn(base.argv[0], base.argv.slice(1), {
      cwd: cwdResult.cwd,
      env: sanitizedEnv(entry.extraEnv),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    const stdout = attachCappedStream(child.stdout, maxOutput);
    const stderr = attachCappedStream(child.stderr, maxOutput);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    const settle = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      clearTimeout(timer);
      const endedMs = now();
      resolveRecord(
        finish({
          ended_at: new Date(endedMs).toISOString(),
          duration_ms: endedMs - startedMs,
          exit_code: exitCode,
          signal: signal ?? null,
          timed_out: timedOut,
          stdout_excerpt: stdout.excerpt,
          stderr_excerpt: stderr.excerpt,
          stdout_truncated: stdout.truncated,
          stderr_truncated: stderr.truncated,
          denied_reason: null,
          stdout_sha256: stdout.digest(),
          stderr_sha256: stderr.digest(),
          network_exposed: true,
        }),
      );
    };
    child.on("error", (err) => {
      clearTimeout(timer);
      const endedMs = now();
      resolveRecord(
        finish({
          ended_at: new Date(endedMs).toISOString(),
          duration_ms: endedMs - startedMs,
          exit_code: null,
          signal: null,
          timed_out: false,
          stdout_excerpt: "",
          stderr_excerpt: err.message,
          stdout_truncated: false,
          stderr_truncated: false,
          denied_reason: `spawn failed: ${err.message}`,
          stdout_sha256: "",
          stderr_sha256: "",
          network_exposed: false,
        }),
      );
    });
    child.on("close", (code, signal) => settle(code, signal));
  });
}
