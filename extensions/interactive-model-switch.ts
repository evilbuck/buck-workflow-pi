/**
 * Parent-session model switch for interactive Buck commands.
 * `/buck-loop` is not in this table; `choice` stays loop-only.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createBuckModelPicker, type BuckModelPickInput, type ResolvedBuckStage } from "./buck-models/picker.js";
import {
  contentToText,
  formatBuckStop,
  globalOmpConfigPath,
  readBuckModelsFile,
  projectOmpConfigPath,
  resolveBuckStage,
  type BuckStageKey,
  type BuckThinking,
} from "./omp-models.js";
import { listSubjectFolders, readSubjectStatus } from "../skills/_shared/scripts/context-helpers.js";

export const CONVERSATION_TAIL_MESSAGES = 8;
export const CONVERSATION_TAIL_CHARS = 12_000;

/** Pinned skill → stage map. `choice` is absent on purpose. */
export const INTERACTIVE_STAGE_BY_SKILL: Readonly<Record<string, BuckStageKey>> = {
  "b-brainstorm": "brainstorm-plan",
  "b-plan": "brainstorm-plan",
  "b-phase": "phase",
  "b-build": "build",
  "b-build-hard": "build",
  "b-review": "review",
  "b-iterate": "iterate",
  "b-save": "save",
  "b-commit": "commit",
  "b-docs": "docs",
  "b-howto": "docs",
  "b-research": "research",
  "b-explore": "research",
  "b-grill": "grill",
  "b-grill-me": "grill",
  "b-grill-auto": "grill",
  "b-grill-with-docs": "grill",
  "b-present": "present",
};

const ARTIFACT_NAME = /^(index|tasks|brainstorm-.+|research-.+|plan-.+|spec-.+|phase-.+|iterate-.+)\.md$/;
const SKILL_PREFIX = /^\/(?:skill:)?(b-[\w-]+)(\s|$)/;
const AUTO_SWITCH_GRACE_MS = 100;

export interface ConversationMessage {
  role?: string;
  content?: unknown;
}

export interface InteractiveSelectRequest {
  cwd: string;
  stage: BuckStageKey;
  skill: string;
  commandText: string;
  subjectArtifacts: readonly string[];
  conversationTail: string;
  availableIds: ReadonlySet<string>;
}

export type InteractiveSelectResult =
  | { ok: true; id: string; thinking: BuckThinking }
  | { ok: false; message: string };

export interface InteractiveSwitchDeps {
  select?: (request: InteractiveSelectRequest) => Promise<InteractiveSelectResult>;
  now?: () => number;
}

interface SwitchSnapshot {
  model: { provider: string; id: string } | null;
  thinking: ThinkingLevel | null;
}

interface SwitchHost {
  ui?: { notify: (message: string, level: string) => void };
  cwd?: string;
  model?: { provider: string; id: string };
  modelRegistry?: {
    getAvailable: () => Array<{ provider: string; id: string }>;
    find: (provider: string, id: string) => unknown;
  };
  sessionManager?: {
    getBranch?: () => ConversationMessage[];
    getEntries?: () => ConversationMessage[];
  };
}

export function conversationTail(messages: readonly ConversationMessage[]): string {
  const spoken = messages.filter((message) => message.role === "user" || message.role === "assistant");
  const newest = spoken.slice(-CONVERSATION_TAIL_MESSAGES).map((message) => contentToText(message.content));
  while (newest.join("\n").length > CONVERSATION_TAIL_CHARS && newest.length > 1) newest.shift();
  const text = newest.join("\n");
  if (text.length <= CONVERSATION_TAIL_CHARS) return text;
  return text.slice(text.length - CONVERSATION_TAIL_CHARS);
}

export function resolveSubjectArtifacts(cwd: string): string[] {
  const name = resolveSubjectName(cwd);
  if (!name) return [];
  const dir = join(cwd, ".context", name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => ARTIFACT_NAME.test(file))
    .sort()
    .map((file) => `.context/${name}/${file}`);
}

export async function selectInteractiveModel(request: InteractiveSelectRequest): Promise<InteractiveSelectResult> {
  const project = readBuckModelsFile(projectOmpConfigPath(request.cwd));
  const global = readBuckModelsFile(globalOmpConfigPath());
  const invalidConfigPaths = [project.invalidPath, global.invalidPath].filter(
    (path): path is string => path !== null,
  );
  const resolution = resolveBuckStage({
    project: project.config,
    global: global.config,
    stage: request.stage,
    availableIds: request.availableIds,
    invalidConfigPaths,
  });
  if (!resolution.ok) return { ok: false, message: formatBuckStop(resolution.stop) };
  const pick = await createBuckModelPicker().pick(pickerInput(request, resolution));
  if (!pick.ok) return { ok: false, message: formatBuckStop(pick.stop) };
  return { ok: true, id: pick.id, thinking: pick.thinking };
}

export function wireInteractiveModelSwitch(pi: ExtensionAPI, deps: InteractiveSwitchDeps = {}): void {
  const select = deps.select ?? selectInteractiveModel;
  const now = deps.now ?? Date.now;
  let cwd = "";
  let autoSwitching = false;
  let lastAutoSwitchAt = 0;
  let switched = false;
  let userOverrode = false;
  let original: SwitchSnapshot = { model: null, thinking: null };

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
  });

  pi.on("input", async (event, ctx) => {
    const text = event.text?.trim() ?? "";
    const skill = text.match(SKILL_PREFIX)?.[1];
    const stage = skill ? INTERACTIVE_STAGE_BY_SKILL[skill] : undefined;
    if (!skill || !stage) return { action: "continue" as const };
    return handleMappedInput({
      pi,
      host: ctx as SwitchHost,
      cwd: cwd || (ctx as SwitchHost).cwd || "",
      stage,
      skill,
      text,
      select,
      now,
      markApplied: (saved) => {
        if (!switched) original = saved;
        switched = true;
        userOverrode = false;
      },
      setAuto: (value) => {
        autoSwitching = value;
        if (value) lastAutoSwitchAt = now();
      },
    });
  });

  pi.on("model_select", async () => {
    if (!switched || autoSwitching) return;
    if (now() - lastAutoSwitchAt < AUTO_SWITCH_GRACE_MS) return;
    userOverrode = true;
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!switched) return;
    const restore = !userOverrode;
    const saved = original;
    switched = false;
    userOverrode = false;
    original = { model: null, thinking: null };
    if (!restore) return;
    await restoreSnapshot(pi, ctx as SwitchHost, saved, (value) => {
      autoSwitching = value;
      if (value) lastAutoSwitchAt = now();
    });
  });
}

interface MappedInput {
  pi: ExtensionAPI;
  host: SwitchHost;
  cwd: string;
  stage: BuckStageKey;
  skill: string;
  text: string;
  select: (request: InteractiveSelectRequest) => Promise<InteractiveSelectResult>;
  now: () => number;
  markApplied: (saved: SwitchSnapshot) => void;
  setAuto: (value: boolean) => void;
}

async function handleMappedInput(input: MappedInput): Promise<{ action: "continue" | "handled" }> {
  let saved: SwitchSnapshot | null = null;
  try {
    const picked = await input.select(buildRequest(input.cwd, input.stage, input.skill, input.text, input.host));
    if (!picked.ok) {
      input.host.ui?.notify(refusal(picked.message), "error");
      return { action: "handled" };
    }
    saved = snapshot(input.pi, input.host);
    await applyPickedModel(input.pi, input.host, picked, input.setAuto);
    input.markApplied(saved);
    return { action: "continue" };
  } catch (error) {
    if (saved) await restoreSnapshot(input.pi, input.host, saved, input.setAuto);
    input.host.ui?.notify(refusal(error instanceof Error ? error.message : String(error)), "error");
    return { action: "handled" };
  }
}

function pickerInput(request: InteractiveSelectRequest, resolution: ResolvedBuckStage): BuckModelPickInput {
  return {
    resolution,
    skill: request.skill,
    context: {
      command: request.commandText,
      subjectArtifacts: request.subjectArtifacts,
      conversation: request.conversationTail,
    },
  };
}

function buildRequest(
  cwd: string,
  stage: BuckStageKey,
  skill: string,
  commandText: string,
  host: SwitchHost,
): InteractiveSelectRequest {
  const available = host.modelRegistry?.getAvailable() ?? [];
  return {
    cwd,
    stage,
    skill,
    commandText,
    subjectArtifacts: resolveSubjectArtifacts(cwd),
    conversationTail: conversationTail(sessionMessages(host)),
    availableIds: new Set(available.map((model) => `${model.provider}/${model.id}`)),
  };
}

function sessionMessages(host: SwitchHost): ConversationMessage[] {
  const manager = host.sessionManager;
  if (typeof manager?.getBranch === "function") return manager.getBranch();
  if (typeof manager?.getEntries === "function") return manager.getEntries();
  return [];
}

function refusal(message: string): string {
  return `${message} Refusing the command before it runs. No host-default model was used.`;
}

function snapshot(pi: ExtensionAPI, host: SwitchHost): SwitchSnapshot {
  const model = host.model;
  return {
    model: model ? { provider: model.provider, id: model.id } : null,
    thinking: typeof pi.getThinkingLevel === "function" ? pi.getThinkingLevel() : null,
  };
}

async function applyPickedModel(
  pi: ExtensionAPI,
  host: SwitchHost,
  picked: { id: string; thinking: BuckThinking },
  setAuto: (value: boolean) => void,
): Promise<void> {
  const slash = picked.id.indexOf("/");
  const parsed = slash > 0 ? { provider: picked.id.slice(0, slash), id: picked.id.slice(slash + 1) } : null;
  const model = parsed ? host.modelRegistry?.find(parsed.provider, parsed.id) : undefined;
  if (!parsed || !model) throw new Error(`Model ${picked.id} is not in the host registry`);
  setAuto(true);
  try {
    const applied = await pi.setModel(model as Parameters<typeof pi.setModel>[0]);
    if (!applied) throw new Error(`Could not apply model ${picked.id}`);
    pi.setThinkingLevel(picked.thinking);
  } finally {
    setAuto(false);
  }
}

async function restoreSnapshot(
  pi: ExtensionAPI,
  host: SwitchHost,
  original: SwitchSnapshot,
  setAuto: (value: boolean) => void,
): Promise<void> {
  setAuto(true);
  try {
    if (original.model && host.modelRegistry) {
      const model = host.modelRegistry.find(original.model.provider, original.model.id);
      if (model) await pi.setModel(model as Parameters<typeof pi.setModel>[0]);
    }
    if (original.thinking) pi.setThinkingLevel(original.thinking);
  } finally {
    setAuto(false);
  }
}

function resolveSubjectName(cwd: string): string | null {
  const path = join(cwd, ".context", "workflow", "current-session.json");
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as { subject?: unknown };
      const subject = typeof parsed.subject === "string" ? parsed.subject : "";
      if (subject && isOpenSubject(cwd, subject)) return subject;
    } catch {
      // Fall through to the unique open subject.
    }
  }
  const open = listSubjectFolders(cwd).filter((folder) => folder.status === "active" || folder.status === "draft");
  return open.length === 1 ? open[0].name : null;
}

function isOpenSubject(cwd: string, name: string): boolean {
  const folder = join(cwd, ".context", name);
  if (!existsSync(folder)) return false;
  const status = readSubjectStatus(folder);
  return status === "active" || status === "draft";
}
