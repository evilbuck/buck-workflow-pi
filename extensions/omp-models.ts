/**
 * OMP catalog helpers for nested createAgentSession() calls.
 *
 * Nested sessions must use OMP's agentDir + modelPattern. Pi's getModel()
 * and ~/.pi/agent/settings.json are the wrong catalog under OMP.
 */
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parse, parseDocument } from "yaml";

export type ActivityEvent =
  | { kind: "text"; delta: string }
  | { kind: "toolStart"; tool: string; target?: string }
  | { kind: "toolEnd"; tool: string; ok: boolean; message?: string }
  | { kind: "retry"; message: string }
  | { kind: "complete"; ok: boolean; message?: string };

const TOOL_ARG_KEYS = ["path", "filePath", "filepath", "command", "query", "pattern"] as const;

function extractToolTarget(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  for (const key of TOOL_ARG_KEYS) {
    const value = (args as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function extractErrorMessage(result: unknown): string | undefined {
  if (result && typeof result === "object") {
    const record = result as { error?: unknown; message?: unknown };
    if (typeof record.message === "string") return record.message;
    if (record.error && typeof record.error === "object" && "message" in record.error) {
      const message = (record.error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (typeof record.error === "string") return record.error;
  }
  if (typeof result === "string") return result;
  return undefined;
}

function asTextDelta(raw: unknown): ActivityEvent | null {
  const update = raw as {
    assistantMessageEvent?: { type?: unknown; delta?: unknown };
  };
  if (update.assistantMessageEvent?.type !== "text_delta") return null;
  const delta = update.assistantMessageEvent.delta;
  return typeof delta === "string" && delta.length > 0 ? { kind: "text", delta } : null;
}

function asToolStart(raw: unknown): ActivityEvent | null {
  const start = raw as { toolName?: unknown; args?: unknown };
  if (typeof start.toolName !== "string") return null;
  const target = extractToolTarget(start.args);
  return target === undefined
    ? { kind: "toolStart", tool: start.toolName }
    : { kind: "toolStart", tool: start.toolName, target };
}

function asToolEnd(raw: unknown): ActivityEvent | null {
  const end = raw as { toolName?: unknown; isError?: unknown; result?: unknown };
  if (typeof end.toolName !== "string") return null;
  const ok = end.isError !== true;
  const message = ok ? undefined : extractErrorMessage(end.result);
  if (ok) return { kind: "toolEnd", tool: end.toolName, ok: true };
  return message === undefined
    ? { kind: "toolEnd", tool: end.toolName, ok: false }
    : { kind: "toolEnd", tool: end.toolName, ok: false, message };
}

function asRetry(raw: unknown): ActivityEvent | null {
  const retry = raw as { errorMessage?: unknown };
  const message =
    typeof retry.errorMessage === "string" && retry.errorMessage
      ? retry.errorMessage
      : "model retry";
  return { kind: "retry", message };
}

function asComplete(): ActivityEvent {
  return { kind: "complete", ok: true, message: "agent finished" };
}

export function normalizeActivityEvent(raw: unknown): ActivityEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const type = (raw as { type?: unknown }).type;
  switch (type) {
    case "message_update":
      return asTextDelta(raw);
    case "tool_execution_start":
      return asToolStart(raw);
    case "tool_execution_end":
      return asToolEnd(raw);
    case "auto_retry_start":
      return asRetry(raw);
    case "agent_end":
      return asComplete();
    default:
      return null;
  }
}

export function ompAgentDir(): string {
  return process.env.OMP_AGENT_DIR || join(homedir(), ".omp", "agent");
}

export type DifficultyTier = "easy" | "medium" | "hard";

/** Phase-file difficulty. Independent of review Hardness (`DifficultyTier`). */
export type PhaseDifficulty = "hard" | "not-hard";

export interface OmpModelMapping {
  easy: string;
  medium: string;
  hard: string;
}

/** Review Hardness / nested-session modelRoles keys, first hit wins, then `default`. */
export const DIFFICULTY_TO_ROLE: Record<DifficultyTier, readonly string[]> = {
  easy: ["smol", "tiny", "task"],
  medium: ["slow", "task", "default"],
  hard: ["default", "plan", "slow"],
};

export function parsePhaseDifficulty(raw: string | undefined | null): PhaseDifficulty {
  return raw?.trim().toLowerCase() === "hard" ? "hard" : "not-hard";
}

export function phaseDifficultyToTier(difficulty: PhaseDifficulty): DifficultyTier {
  return difficulty === "hard" ? "hard" : "medium";
}

export function parseModelRoles(text: string): Record<string, string> {
  const roles: Record<string, string> = {};
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^modelRoles:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break;
    const match = line.match(/^\s+([A-Za-z][\w-]*)\s*:\s*(\S+)\s*$/);
    if (match) roles[match[1]] = match[2];
  }
  return roles;
}

export function readOmpModelRoles(cwd: string): Record<string, string> {
  for (const path of [join(cwd, ".omp", "config.yml"), join(ompAgentDir(), "config.yml")]) {
    try {
      if (!existsSync(path)) continue;
      const roles = parseModelRoles(readFileSync(path, "utf8"));
      if (Object.keys(roles).length > 0) return roles;
    } catch {
      // ignore unreadable config
    }
  }
  return {};
}

export function resolveOmpRole(cwd: string, role: string): string | undefined {
  const roles = readOmpModelRoles(cwd);
  return roles[role] ?? roles.default;
}

export function mappingFromOmpRoles(cwd: string): OmpModelMapping | null {
  const roles = readOmpModelRoles(cwd);
  const pick = (keys: readonly string[]): string | undefined => {
    for (const key of keys) {
      if (roles[key]) return roles[key];
    }
    return roles.default;
  };
  const easy = pick(DIFFICULTY_TO_ROLE.easy);
  const medium = pick(DIFFICULTY_TO_ROLE.medium);
  const hard = pick(DIFFICULTY_TO_ROLE.hard);
  if (!easy || !medium || !hard) return null;
  return { easy, medium, hard };
}

/** Stage groups shared by Buck skills. Unknown keys are ignored. */
export const BUCK_STAGE_KEYS = [
  "brainstorm-plan",
  "phase",
  "build",
  "review",
  "iterate",
  "save",
  "commit",
  "docs",
  "choice",
  "research",
  "grill",
  "present",
] as const;

export type BuckStageKey = (typeof BUCK_STAGE_KEYS)[number];

const BUCK_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export type BuckThinking = (typeof BUCK_THINKING_LEVELS)[number];

export interface BuckModelCandidate {
  id: string;
  note?: string;
}

/** Parsed stage. `thinking` is `off` when the key was omitted. */
export interface BuckStageConfig {
  models: BuckModelCandidate[];
  thinking: BuckThinking;
}

export interface BuckProfile {
  stages: Partial<Record<BuckStageKey, BuckStageConfig>>;
}

export interface BuckModelsConfig {
  active: string;
  profiles: Record<string, BuckProfile>;
}

export type BuckConfigSource = "project" | "global";

export type BuckResolveStop =
  | { code: "missing-active"; name: string }
  | { code: "unknown-profile"; name: string }
  | { code: "missing-stage"; profile: string; stage: string }
  | { code: "no-candidates"; profile: string; stage: string; excluded: string[] }
  | { code: "invalid-config"; path: string };

type ActiveNameResult =
  | { ok: true; name: string }
  | { ok: false; stop: BuckResolveStop };

export type BuckStageResolution =
  | {
      ok: true;
      profile: string;
      stage: BuckStageKey;
      source: BuckConfigSource;
      thinking: BuckThinking;
      configured: BuckModelCandidate[];
      available: BuckModelCandidate[];
      excluded: string[];
    }
  | { ok: false; stop: BuckResolveStop };

export interface BuckStageWrite {
  models: Array<{ id: string; note?: string }>;
  thinking?: BuckThinking;
}

export interface BuckProfileWrite {
  active?: string;
  profile: string;
  stages: Partial<Record<BuckStageKey, BuckStageWrite>>;
}

export function isBuckStageKey(value: string): value is BuckStageKey {
  return (BUCK_STAGE_KEYS as readonly string[]).includes(value);
}

export function projectOmpConfigPath(cwd: string): string {
  return join(cwd, ".omp", "config.yml");
}

export function globalOmpConfigPath(): string {
  return join(ompAgentDir(), "config.yml");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseThinking(value: unknown): BuckThinking {
  if (typeof value !== "string") return "off";
  const normalized = value.trim().toLowerCase();
  return (BUCK_THINKING_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as BuckThinking)
    : "off";
}

function parseCandidate(value: unknown): BuckModelCandidate | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") return null;
  const id = record.id.trim();
  if (!id) return null;
  return typeof record.note === "string" ? { id, note: record.note } : { id };
}

function parseStage(value: unknown): BuckStageConfig {
  const record = asRecord(value);
  const models: BuckModelCandidate[] = [];
  if (record && Array.isArray(record.models)) {
    for (const item of record.models) {
      const candidate = parseCandidate(item);
      if (candidate) models.push(candidate);
    }
  }
  return { models, thinking: parseThinking(record?.thinking) };
}

function parseProfile(value: unknown): BuckProfile {
  const record = asRecord(value) ?? {};
  const stages: BuckProfile["stages"] = {};
  for (const key of BUCK_STAGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) stages[key] = parseStage(record[key]);
  }
  return { stages };
}
function buildBuckModelsConfig(root: unknown): BuckModelsConfig {
  const buck = asRecord(asRecord(root)?.buckModels);
  if (!buck) return { active: "", profiles: {} };
  const profiles: Record<string, BuckProfile> = {};
  for (const [name, value] of Object.entries(asRecord(buck.profiles) ?? {})) {
    profiles[name] = parseProfile(value);
  }
  return { active: typeof buck.active === "string" ? buck.active : "", profiles };
}

/** Parse `buckModels` only. Invalid YAML and a missing key are an empty config. */
export function parseBuckModels(text: string): BuckModelsConfig {
  let root: unknown;
  try {
    root = parse(text);
  } catch {
    return { active: "", profiles: {} };
  }
  return buildBuckModelsConfig(root);
}

/**
 * Read one `buckModels` file. A missing file is null config; malformed YAML
 * records its path instead of silently falling through to another profile.
 */
export function readBuckModelsFile(path: string): { config: BuckModelsConfig | null; invalidPath: string | null } {
  if (!existsSync(path)) return { config: null, invalidPath: null };
  const text = readFileSync(path, "utf8");
  try {
    return { config: buildBuckModelsConfig(parse(text)), invalidPath: null };
  } catch {
    return { config: null, invalidPath: path };
  }
}

export function formatBuckStop(stop: BuckResolveStop): string {
  switch (stop.code) {
    case "missing-active":
      return `buckModels active name "${stop.name}" is missing`;
    case "unknown-profile":
      return `unknown buckModels profile "${stop.name}"`;
    case "missing-stage":
      return `buckModels profile "${stop.profile}" is missing stage "${stop.stage}"`;
    case "no-candidates":
      return `buckModels stage "${stop.stage}" has no available models; excluded: ${stop.excluded.join(", ")}`;
    case "invalid-config":
      return `buckModels config at "${stop.path}" is not valid YAML; fix it or move it aside`;
  }
}


function lookupStage(
  config: BuckModelsConfig | null,
  profile: string,
  stage: BuckStageKey,
): BuckStageConfig | undefined {
  const stages = config?.profiles[profile]?.stages;
  if (!stages || !Object.prototype.hasOwnProperty.call(stages, stage)) return undefined;
  return stages[stage];
}


function trimmedActive(config: BuckModelsConfig | null): string {
  if (!config) return "";
  return config.active.trim();
}

function firstNonBlank(projectName: string, globalName: string): string {
  if (projectName !== "") return projectName;
  return globalName;
}

function profileKnown(config: BuckModelsConfig | null, name: string): boolean {
  if (!config) return false;
  return Object.prototype.hasOwnProperty.call(config.profiles, name);
}

function nameKnown(
  project: BuckModelsConfig | null,
  globalConfig: BuckModelsConfig | null,
  name: string,
): boolean {
  if (profileKnown(project, name)) return true;
  return profileKnown(globalConfig, name);
}

function missingActive(name: string): ActiveNameResult {
  return { ok: false, stop: { code: "missing-active", name } };
}

function unknownProfile(name: string): ActiveNameResult {
  return { ok: false, stop: { code: "unknown-profile", name } };
}

function knownActive(name: string): ActiveNameResult {
  return { ok: true, name };
}

function resolveActiveName(
  project: BuckModelsConfig | null,
  globalConfig: BuckModelsConfig | null,
): ActiveNameResult {
  const name = firstNonBlank(trimmedActive(project), trimmedActive(globalConfig));
  if (name === "") return missingActive(name);
  if (!nameKnown(project, globalConfig, name)) return unknownProfile(name);
  return knownActive(name);
}

function filterAvailable(
  models: BuckModelCandidate[],
  availableIds: ReadonlySet<string>,
): { available: BuckModelCandidate[]; excluded: string[] } {
  const available: BuckModelCandidate[] = [];
  const excluded: string[] = [];
  for (const model of models) {
    if (availableIds.has(model.id)) available.push(model);
    else excluded.push(model.id);
  }
  return { available, excluded };
}

/**
 * Resolve one stage. Project key presence wins, including an empty model list.
 * Availability filtering does not mutate `project` or `globalConfig`.
 */
export function resolveBuckStage(opts: {
  project: BuckModelsConfig | null;
  global: BuckModelsConfig | null;
  stage: string;
  availableIds: ReadonlySet<string>;
  invalidConfigPaths?: readonly string[];
}): BuckStageResolution {
  const invalid = opts.invalidConfigPaths?.find((path) => path.length > 0);
  if (invalid) return { ok: false, stop: { code: "invalid-config", path: invalid } };
  const active = resolveActiveName(opts.project, opts.global);
  if (!active.ok) return active;
  if (!isBuckStageKey(opts.stage)) {
    return { ok: false, stop: { code: "missing-stage", profile: active.name, stage: opts.stage } };
  }
  const projectStage = lookupStage(opts.project, active.name, opts.stage);
  const stage = projectStage ?? lookupStage(opts.global, active.name, opts.stage);
  if (!stage) {
    return { ok: false, stop: { code: "missing-stage", profile: active.name, stage: opts.stage } };
  }
  const filtered = filterAvailable(stage.models, opts.availableIds);
  if (filtered.available.length === 0) {
    return {
      ok: false,
      stop: { code: "no-candidates", profile: active.name, stage: opts.stage, excluded: filtered.excluded },
    };
  }
  return {
    ok: true,
    profile: active.name,
    stage: opts.stage,
    source: projectStage ? "project" : "global",
    thinking: stage.thinking,
    configured: stage.models,
    available: filtered.available,
    excluded: filtered.excluded,
  };
}

function stagePlain(stage: BuckStageConfig): Record<string, unknown> {
  const body: Record<string, unknown> = {
    models: stage.models.map((model) => (model.note === undefined ? { id: model.id } : { id: model.id, note: model.note })),
  };
  if (stage.thinking !== "off") body.thinking = stage.thinking;
  return body;
}

function buckModelsPlain(config: BuckModelsConfig): Record<string, unknown> {
  const profiles: Record<string, Record<string, unknown>> = {};
  for (const [name, profile] of Object.entries(config.profiles)) {
    const stages: Record<string, unknown> = {};
    for (const key of BUCK_STAGE_KEYS) {
      const stage = profile.stages[key];
      if (stage) stages[key] = stagePlain(stage);
    }
    profiles[name] = stages;
  }
  return { active: config.active, profiles };
}

function applyProfileWrite(current: BuckModelsConfig, update: BuckProfileWrite): void {
  if (update.active !== undefined) current.active = update.active;
  const profile = current.profiles[update.profile] ?? { stages: {} };
  for (const key of BUCK_STAGE_KEYS) {
    const stage = update.stages[key];
    if (!stage) continue;
    profile.stages[key] = {
      models: stage.models.flatMap((model) => {
        const id = model.id.trim();
        if (!id) return [];
        return [typeof model.note === "string" ? { id, note: model.note } : { id }];
      }),
      thinking: stage.thinking ?? "off",
    };
  }
  current.profiles[update.profile] = profile;
}

/** Read-modify-write one profile. Refuses to overwrite a document YAML cannot parse. */
export function writeBuckProfile(path: string, update: BuckProfileWrite): void {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const doc = parseDocument(existing);
  if (doc.errors.length > 0) {
    throw new Error(`cannot update ${path}: ${doc.errors[0]?.message ?? "invalid YAML"}`);
  }
  const current = parseBuckModels(existing);
  applyProfileWrite(current, update);
  doc.set("buckModels", buckModelsPlain(current));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, String(doc));
}

export function writeBuckModelsScope(opts: BuckProfileWrite & { scope: BuckConfigSource; cwd: string }): string {
  const path = opts.scope === "project" ? projectOmpConfigPath(opts.cwd) : globalOmpConfigPath();
  writeBuckProfile(path, opts);
  return path;
}

export function contentToText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const rec = block as { type?: unknown; text?: unknown };
    if (rec.type === "text" && typeof rec.text === "string") parts.push(rec.text);
  }
  return parts.join("").trim();
}

export function lastAssistantText(messages: Array<{ role?: string; content?: unknown }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const text = contentToText(message.content);
    if (text) return text;
  }
  return "";
}

export class EmptyModelResponseError extends Error {
  constructor(messages: Array<{ role?: string; content?: unknown; stopReason?: unknown; errorMessage?: unknown }>) {
    const assistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!assistant) {
      super("Model completed without an assistant message.");
      this.name = "EmptyModelResponseError";
      return;
    }
    const details = [
      typeof assistant.stopReason === "string" ? `stop reason: ${assistant.stopReason}` : "",
      typeof assistant.errorMessage === "string" ? `error: ${assistant.errorMessage}` : "",
      Array.isArray(assistant.content)
        ? `content blocks: ${assistant.content.map((block) =>
          block && typeof block === "object" && "type" in block ? String(block.type) : typeof block,
        ).join(", ")}`
        : "",
    ].filter(Boolean);
    super(`Model returned no text${details.length > 0 ? ` (${details.join("; ")})` : ""}.`);
    this.name = "EmptyModelResponseError";
  }
}

export async function runOmpModelSession(opts: {
  cwd: string;
  tools: string[];
  prompt: string;
  modelOverride?: string;
  timeoutMs?: number;
  onActivity?: (event: ActivityEvent) => void;
  /** Sampling temperature; injected per-request via the agent's streamFn. */
  temperature?: number;
  /** Agent-id prefix; defaults to the original b-save-improved identity. */
  agentPrefix?: string;
  /** Exact agent id when the caller must report a failed call to its parent. */
  agentId?: string;
  customTools?: NonNullable<Parameters<typeof createAgentSession>[0]>["customTools"];
  /** Thinking level; defaults to "off" as before. */
  thinkingLevel?: string;
}): Promise<string> {
  const { cwd, tools, prompt, modelOverride, timeoutMs = 60_000, onActivity } = opts;
  const sessionOpts: Parameters<typeof createAgentSession>[0] & {
    agentDir?: string;
    modelPattern?: string;
    toolNames?: string[];
    restrictToolNames?: boolean;
    disableExtensionDiscovery?: boolean;
    enableMCP?: boolean;
    enableLsp?: boolean;
    agentId?: string;
  } = {
    cwd,
    agentDir: ompAgentDir(),
    thinkingLevel: (opts.thinkingLevel as typeof sessionOpts.thinkingLevel) ?? "off",
    // `tools` is Pi's legacy allowlist; OMP 18 uses `toolNames`.
    tools,
    toolNames: tools,
    restrictToolNames: true,
    disableExtensionDiscovery: true,
    enableMCP: false,
    enableLsp: false,
    agentId: opts.agentId ?? `${opts.agentPrefix ?? "b-save-improved-model"}-${randomUUID()}`,
    sessionManager: SessionManager.inMemory(cwd),
  };
  if (modelOverride) sessionOpts.modelPattern = modelOverride;
  if (opts.customTools) sessionOpts.customTools = opts.customTools;
  const created = await createAgentSession(sessionOpts);
  const session = created.session;
  if (opts.temperature !== undefined) {
    const originalStream = session.agent.streamFn;
    session.agent.streamFn = (...args) => {
      const [model, context, options] = args;
      return originalStream(model, context, { ...options, temperature: opts.temperature });
    };
  }
  let unsubscribe: (() => void) | null = null;
  if (onActivity) {
    const bridge = (rawEvent: unknown): void => {
      const normalized = normalizeActivityEvent(rawEvent);
      if (normalized) onActivity(normalized);
    };
    unsubscribe = session.subscribe(bridge);
  }
  const timer = setTimeout(() => {
    void session.abort();
  }, timeoutMs);
  try {
    await session.prompt(prompt);
    const messages = session.messages as Array<{
      role?: string;
      content?: unknown;
      stopReason?: unknown;
      errorMessage?: unknown;
    }>;
    const text = lastAssistantText(messages);
    if (!text) throw new EmptyModelResponseError(messages);
    return text;
  } finally {
    if (unsubscribe) unsubscribe();
    clearTimeout(timer);
    session.dispose();
  }
}
