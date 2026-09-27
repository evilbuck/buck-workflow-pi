import type { ExtensionAPI, ExtensionUIDialogOptions } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  candidatesFromSelection,
  pickStageModels,
  stageModelChoices,
  type ModelPickerHost,
  type StageModelChoice,
} from "./model-picker.js";
import {
  BUCK_STAGE_KEYS,
  globalOmpConfigPath,
  parseBuckModels,
  projectOmpConfigPath,
  writeBuckModelsScope,
  type BuckConfigSource,
  type BuckModelCandidate,
  type BuckModelsConfig,
  type BuckProfileWrite,
  type BuckStageConfig,
  type BuckStageKey,
  type BuckThinking,
} from "../omp-models.js";
import { buildDoctorReport, type DoctorLoad } from "./doctor.js";

const PROJECT_SCOPE = "Project (.omp/config.yml)";
const GLOBAL_SCOPE = "User-global (~/.omp/agent/config.yml)";
const EDIT_PROFILE = "Create or edit a profile";
const ACTIVATE_PROFILE = "Activate a profile";
const CREATE_PROFILE = "Create a new profile";
/** Display prefix for existing profiles; reserved so picker labels round-trip. */
const EDIT_PROFILE_PREFIX = "Edit profile: ";
const KEEP_STAGE = "Keep current stage";
const EDIT_STAGE = "Edit this stage";
const OMIT_THINKING = "off (omit)";
const THINKING_CHOICES = [OMIT_THINKING, "minimal", "low", "medium", "high", "xhigh"] as const;

type NoticeLevel = "info" | "warning" | "error";

interface BuckModelsUI extends ModelPickerHost {
  select?: (prompt: string, items: string[]) => Promise<string | null | undefined>;
  input?: (prompt: string, placeholder?: string) => Promise<string | null | undefined>;
  confirm?: (title: string, message: string, opts?: ExtensionUIDialogOptions) => Promise<boolean>;
  notify: (message: string, level?: NoticeLevel) => void;
}

interface InteractiveBuckModelsUI extends BuckModelsUI {
  select: NonNullable<BuckModelsUI["select"]>;
  input: NonNullable<BuckModelsUI["input"]>;
  confirm: NonNullable<BuckModelsUI["confirm"]>;
}

interface BuckModelsContext {
  cwd: string;
  hasUI?: boolean;
  ui: BuckModelsUI;
  modelRegistry?: { getAvailable(): Array<{ provider: string; id: string }> };
}

export interface BuckModelsDeps {
  readText?: (path: string) => string;
  writeScope?: typeof writeBuckModelsScope;
  pickStageModels?: (
    ui: BuckModelsUI,
    title: string,
    choices: readonly StageModelChoice[],
    selected: readonly string[],
  ) => Promise<string[] | null>;
  readDoctorLoad?: (cwd: string) => {
    project: BuckModelsConfig | null;
    globalConfig: BuckModelsConfig | null;
    invalidPath: string | null;
  };
}

function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function scopeFrom(choice: string): BuckConfigSource {
  return choice === PROJECT_SCOPE ? "project" : "global";
}

function targetConfig(scope: BuckConfigSource, project: BuckModelsConfig, globalConfig: BuckModelsConfig): BuckModelsConfig {
  return scope === "project" ? project : globalConfig;
}

function profileNames(scope: BuckConfigSource, project: BuckModelsConfig, globalConfig: BuckModelsConfig): string[] {
  const names = new Set(Object.keys(targetConfig(scope, project, globalConfig).profiles));
  if (scope === "project") {
    for (const name of Object.keys(globalConfig.profiles)) names.add(name);
  }
  return [...names].sort();
}

function stageAt(config: BuckModelsConfig, profile: string, stage: BuckStageKey): BuckStageConfig | undefined {
  const stages = config.profiles[profile]?.stages;
  if (!stages || !Object.prototype.hasOwnProperty.call(stages, stage)) return undefined;
  return stages[stage];
}

function effectiveStage(
  scope: BuckConfigSource,
  profile: string,
  stage: BuckStageKey,
  project: BuckModelsConfig,
  globalConfig: BuckModelsConfig,
): { stage?: BuckStageConfig; ownership: string } {
  if (scope === "global") {
    const globalStage = stageAt(globalConfig, profile, stage);
    return { stage: globalStage, ownership: globalStage ? "user-global owned" : "unset" };
  }
  const projectStage = stageAt(project, profile, stage);
  if (projectStage) return { stage: projectStage, ownership: "project-owned" };
  const globalStage = stageAt(globalConfig, profile, stage);
  return { stage: globalStage, ownership: globalStage ? "user-global fallthrough" : "unset" };
}

function escapeRowText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(",", "\\,");
}

function formatRows(models: BuckModelCandidate[]): string {
  return models
    .map((model) => model.note === undefined
      ? escapeRowText(model.id)
      : `${escapeRowText(model.id)} | ${escapeRowText(model.note)}`)
    .join(", ");
}


function stageSummary(stage: BuckStageConfig | undefined): string {
  const models = formatRows(stage?.models ?? []) || "(no models)";
  return `models: ${models}; thinking: ${stage?.thinking ?? "off"}`;
}

async function chooseProfile(
  ui: BuckModelsUI,
  action: string,
  names: string[],
): Promise<string | null> {
  if (action === ACTIVATE_PROFILE) {
    if (names.length === 0) {
      ui.notify("No Buck model profiles exist in this scope or its fallthrough.", "error");
      return null;
    }
    return (await ui.select?.("Profile to activate", names)) ?? null;
  }
  const profileChoices = names.map((name) => `${EDIT_PROFILE_PREFIX}${name}`);
  const selected = await ui.select?.("Profile to create or edit", [CREATE_PROFILE, ...profileChoices]);
  if (!selected) return null;
  if (selected !== CREATE_PROFILE) {
    const selectedIndex = profileChoices.indexOf(selected);
    return selectedIndex === -1 ? null : names[selectedIndex] ?? null;
  }
  const name = (await ui.input?.("New profile name"))?.trim();
  if (!name) return null;
  if (name === CREATE_PROFILE || name.startsWith(EDIT_PROFILE_PREFIX)) {
    ui.notify(`"${name}" collides with the profile picker labels; choose another name.`, "error");
    return null;
  }
  return name;
}

async function editStages(
  ui: BuckModelsUI,
  scope: BuckConfigSource,
  profile: string,
  project: BuckModelsConfig,
  globalConfig: BuckModelsConfig,
  available: readonly string[],
  pick: NonNullable<BuckModelsDeps["pickStageModels"]>,
): Promise<BuckProfileWrite["stages"] | null> {
  const stages: BuckProfileWrite["stages"] = {};
  for (const key of BUCK_STAGE_KEYS) {
    const effective = effectiveStage(scope, profile, key, project, globalConfig);
    const label = `${key} — ${effective.ownership}`;
    const action = await ui.select?.(
      `${label}\nCurrent ${stageSummary(effective.stage)}`,
      [KEEP_STAGE, EDIT_STAGE],
    );
    if (!action) return null;
    if (action === KEEP_STAGE) continue;
    const current = effective.stage?.models ?? [];
    const selected = await pick(
      ui,
      `Models for ${label}`,
      stageModelChoices(available, current),
      current.map((model) => model.id),
    );
    if (selected === null) return null;
    const currentThinking = effective.stage?.thinking ?? "off";
    const keepThinking = `Keep current (${currentThinking})`;
    const selectedThinking = await ui.select?.(
      `Thinking for ${label}`,
      [keepThinking, ...THINKING_CHOICES],
    );
    if (!selectedThinking) return null;
    stages[key] = {
      models: candidatesFromSelection(selected, current),
      thinking: selectedThinking === keepThinking
        ? effective.stage?.thinking
        : selectedThinking === OMIT_THINKING ? undefined : selectedThinking as BuckThinking,
    };
  }
  return stages;
}

function unavailableIds(
  scope: BuckConfigSource,
  profile: string,
  stages: BuckProfileWrite["stages"],
  project: BuckModelsConfig,
  globalConfig: BuckModelsConfig,
  available: ReadonlySet<string>,
): string[] {
  const unavailable = new Set<string>();
  for (const key of BUCK_STAGE_KEYS) {
    const stage = Object.prototype.hasOwnProperty.call(stages, key)
      ? stages[key]
      : effectiveStage(scope, profile, key, project, globalConfig).stage;
    for (const model of stage?.models ?? []) {
      if (!available.has(model.id)) unavailable.add(model.id);
    }
  }
  return [...unavailable].sort();
}

function interactiveUi(ctx: BuckModelsContext): InteractiveBuckModelsUI | null {
  const ui = ctx.ui;
  if (!ctx.hasUI || !ui.select || !ui.input || !ui.confirm) {
    ui.notify("/buck-models requires an interactive host UI.", "error");
    return null;
  }
  return ui as InteractiveBuckModelsUI;
}

function readConfigs(cwd: string, load: (path: string) => string): {
  project: BuckModelsConfig;
  globalConfig: BuckModelsConfig;
} {
  return {
    project: parseBuckModels(load(projectOmpConfigPath(cwd))),
    globalConfig: parseBuckModels(load(globalOmpConfigPath())),
  };
}

/**
 * Parse text captured from a single read. Invalid YAML is invalid config —
 * never an empty scope — so the doctor fails closed on the content it saw.
 */
function parseBuckModelsOnce(text: string, path: string): { config: BuckModelsConfig; invalidPath: string | null } {
  try {
    parse(text);
  } catch {
    return { config: { active: "", profiles: {} }, invalidPath: path };
  }
  return { config: parseBuckModels(text), invalidPath: null };
}

function readDoctorLoad(cwd: string, load: (path: string) => string): {
  project: BuckModelsConfig | null;
  globalConfig: BuckModelsConfig | null;
  invalidPath: string | null;
} {
  const projectPath = projectOmpConfigPath(cwd);
  const globalPath = globalOmpConfigPath();
  let project: BuckModelsConfig | null = null;
  let globalConfig: BuckModelsConfig | null = null;
  let invalidPath: string | null = null;
  // IO failures (unreadable/unopenable file) fail closed as invalid config.
  // Each path is read exactly once; classification uses that captured text.
  try {
    const projectRaw = load(projectPath);
    if (projectRaw.length > 0) {
      const parsed = parseBuckModelsOnce(projectRaw, projectPath);
      if (parsed.invalidPath) invalidPath = parsed.invalidPath;
      project = parsed.config;
    }
  } catch {
    invalidPath = projectPath;
  }
  try {
    const globalRaw = load(globalPath);
    if (globalRaw.length > 0) {
      const parsed = parseBuckModelsOnce(globalRaw, globalPath);
      if (parsed.invalidPath && invalidPath === null) invalidPath = parsed.invalidPath;
      globalConfig = parsed.config;
    }
  } catch {
    invalidPath ??= globalPath;
  }
  return { project, globalConfig, invalidPath };
}

function availableIds(ctx: BuckModelsContext): ReadonlySet<string> | null {
  if (!ctx.modelRegistry || typeof ctx.modelRegistry.getAvailable !== "function") return null;
  const ids = new Set<string>();
  let models: Iterable<{ provider: string; id: string }>;
  try {
    models = ctx.modelRegistry.getAvailable();
  } catch {
    return null;
  }
  for (const model of models) {
    ids.add(`${model.provider}/${model.id}`);
  }
  return ids;
}

async function runDoctor(ctx: BuckModelsContext, deps: BuckModelsDeps): Promise<void> {
  try {
    const load = deps.readDoctorLoad ?? ((cwd: string) => readDoctorLoad(cwd, deps.readText ?? readText));
    const { project, globalConfig, invalidPath } = load(ctx.cwd);
    const doctorLoad: DoctorLoad = {
      project,
      global: globalConfig,
      invalidPath,
      availableIds: availableIds(ctx),
    };
    const report = buildDoctorReport(doctorLoad);
    ctx.ui.notify(report.text, report.severity);
  } catch (error) {
    ctx.ui.notify(`/buck-models --doctor failed: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

async function buildProfileUpdate(
  ui: InteractiveBuckModelsUI,
  ctx: BuckModelsContext,
  scope: BuckConfigSource,
  profile: string,
  action: string,
  project: BuckModelsConfig,
  globalConfig: BuckModelsConfig,
  pick: NonNullable<BuckModelsDeps["pickStageModels"]>,
): Promise<BuckProfileWrite | null> {
  const available = (ctx.modelRegistry?.getAvailable() ?? []).map((model) => `${model.provider}/${model.id}`);
  const stages = action === EDIT_PROFILE
    ? await editStages(ui, scope, profile, project, globalConfig, available, pick)
    : {};
  if (stages === null) return null;
  const activate = action === ACTIVATE_PROFILE
    ? true
    : await ui.confirm("Activate profile", `Make "${profile}" active in ${scope} scope?`);
  const unavailable = unavailableIds(scope, profile, stages, project, globalConfig, new Set(available));
  if (unavailable.length > 0) {
    ui.notify(`Unavailable model ids will still be saved: ${unavailable.join(", ")}`, "warning");
  }
  return { active: activate ? profile : undefined, profile, stages };
}

async function runCommand(ctx: BuckModelsContext, deps: BuckModelsDeps, args: string): Promise<void> {
  const routed = await dispatchArgs(ctx, args, deps);
  if (routed !== "interactive") return;
  await runInteractive(ctx, deps);
}

async function runInteractive(ctx: BuckModelsContext, deps: BuckModelsDeps): Promise<void> {
  const ic = await collectInteractiveContext(ctx, deps);
  if (!ic) return;
  const action = await ic.ui.select("Buck model profile action", [EDIT_PROFILE, ACTIVATE_PROFILE]);
  if (!action) return;
  const profile = await chooseProfile(ic.ui, action, profileNames(ic.scope, ic.project, ic.globalConfig));
  if (!profile) return;
  const update = await buildProfileUpdate(
    ic.ui,
    ctx,
    ic.scope,
    profile,
    action,
    ic.project,
    ic.globalConfig,
    ic.pick,
  );
  if (!update) return;
  await persistProfileUpdate(ic.ui, ic.scope, update, ctx.cwd, deps.writeScope ?? writeBuckModelsScope);
}

interface InteractiveContext {
  ui: InteractiveBuckModelsUI;
  scope: BuckConfigSource;
  project: BuckModelsConfig;
  globalConfig: BuckModelsConfig;
  pick: NonNullable<BuckModelsDeps["pickStageModels"]>;
}

async function collectInteractiveContext(
  ctx: BuckModelsContext,
  deps: BuckModelsDeps,
): Promise<InteractiveContext | null> {
  const ui = interactiveUi(ctx);
  if (!ui) return null;
  const chosenScope = await ui.select("Write Buck model profile to", [PROJECT_SCOPE, GLOBAL_SCOPE]);
  if (!chosenScope) return null;
  const scope = scopeFrom(chosenScope);
  const { project, globalConfig } = readConfigs(ctx.cwd, deps.readText ?? readText);
  return {
    ui,
    scope,
    project,
    globalConfig,
    pick: deps.pickStageModels ?? pickStageModels,
  };
}

async function persistProfileUpdate(
  ui: InteractiveBuckModelsUI,
  scope: BuckConfigSource,
  update: BuckProfileWrite,
  cwd: string,
  writeScope: NonNullable<BuckModelsDeps["writeScope"]>,
): Promise<void> {
  const save = await ui.confirm("Save Buck model profile", `Write profile "${update.profile}" to ${scope} scope?`);
  if (!save) return;
  const path = writeScope({ scope, cwd, ...update });
  ui.notify(`Saved ${scope} profile "${update.profile}" to ${path}.`, "info");
}

type CommandRoute = "interactive" | "handled";

async function dispatchArgs(ctx: BuckModelsContext, args: string, deps: BuckModelsDeps): Promise<CommandRoute> {
  const trimmed = args.trim();
  if (trimmed === "--doctor") {
    await runDoctor(ctx, deps);
    return "handled";
  }
  if (trimmed !== "") {
    ctx.ui.notify(
      'Usage: /buck-models [--doctor]\n  --doctor  read-only audit of every saved Buck model profile against the live registry.',
      "error",
    );
    return "handled";
  }
  return "interactive";
}

export function wireBuckModels(pi: ExtensionAPI, deps: BuckModelsDeps = {}): void {
  pi.registerCommand("buck-models", {
    description: "Create, edit, and activate project or user-global Buck model profiles. Pass --doctor for a read-only availability audit.",
    handler: async (args: string, ctx: unknown) => runCommand(ctx as BuckModelsContext, deps, args),
  });
}
