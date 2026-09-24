import type { ExtensionAPI, ExtensionUIDialogOptions } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
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

const PROJECT_SCOPE = "Project (.omp/config.yml)";
const GLOBAL_SCOPE = "User-global (~/.omp/agent/config.yml)";
const EDIT_PROFILE = "Create or edit a profile";
const ACTIVATE_PROFILE = "Activate a profile";
const CREATE_PROFILE = "Create a new profile";
const KEEP_STAGE = "Keep current stage";
const EDIT_STAGE = "Edit this stage";
const OMIT_THINKING = "off (omit)";
const THINKING_CHOICES = [OMIT_THINKING, "minimal", "low", "medium", "high", "xhigh"] as const;

type NoticeLevel = "info" | "warning" | "error";

interface BuckModelsUI {
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

function splitRows(value: string): string[] {
  const rows: string[] = [];
  let row = "";
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      row += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === ",") {
      rows.push(row);
      row = "";
    } else {
      row += character;
    }
  }
  rows.push(escaped ? `${row}\\` : row);
  return rows;
}

function parseRows(value: string): BuckModelCandidate[] {
  return splitRows(value).flatMap((row) => {
    const [rawId, ...noteParts] = row.split("|");
    const id = rawId?.trim() ?? "";
    if (!id) return [];
    const note = noteParts.join("|").trim();
    return note ? [{ id, note }] : [{ id }];
  });
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
  const profileChoices = names.map((name) => `Edit profile: ${name}`);
  const selected = await ui.select?.("Profile to create or edit", [CREATE_PROFILE, ...profileChoices]);
  if (!selected) return null;
  if (selected !== CREATE_PROFILE) {
    const selectedIndex = profileChoices.indexOf(selected);
    return selectedIndex === -1 ? null : names[selectedIndex] ?? null;
  }
  const name = (await ui.input?.("New profile name"))?.trim();
  return name || null;
}

async function editStages(
  ui: BuckModelsUI,
  scope: BuckConfigSource,
  profile: string,
  project: BuckModelsConfig,
  globalConfig: BuckModelsConfig,
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
    const rows = await ui.input?.(
      `Replacement models for ${label} (comma-separated id | optional note; escape note commas as \\,)`,
      formatRows(effective.stage?.models ?? []),
    );
    if (rows === undefined || rows === null) return null;
    const currentThinking = effective.stage?.thinking ?? "off";
    const keepThinking = `Keep current (${currentThinking})`;
    const selectedThinking = await ui.select?.(
      `Thinking for ${label}`,
      [keepThinking, ...THINKING_CHOICES],
    );
    if (!selectedThinking) return null;
    stages[key] = {
      models: parseRows(rows),
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

async function buildProfileUpdate(
  ui: InteractiveBuckModelsUI,
  ctx: BuckModelsContext,
  scope: BuckConfigSource,
  profile: string,
  action: string,
  project: BuckModelsConfig,
  globalConfig: BuckModelsConfig,
): Promise<BuckProfileWrite | null> {
  const stages = action === EDIT_PROFILE
    ? await editStages(ui, scope, profile, project, globalConfig)
    : {};
  if (stages === null) return null;
  const activate = action === ACTIVATE_PROFILE
    ? true
    : await ui.confirm("Activate profile", `Make "${profile}" active in ${scope} scope?`);
  const available = new Set((ctx.modelRegistry?.getAvailable() ?? []).map((model) => `${model.provider}/${model.id}`));
  const unavailable = unavailableIds(scope, profile, stages, project, globalConfig, available);
  if (unavailable.length > 0) {
    ui.notify(`Unavailable model ids will still be saved: ${unavailable.join(", ")}`, "warning");
  }
  return { active: activate ? profile : undefined, profile, stages };
}

async function runCommand(ctx: BuckModelsContext, deps: BuckModelsDeps): Promise<void> {
  const ui = interactiveUi(ctx);
  if (!ui) return;
  const chosenScope = await ui.select("Write Buck model profile to", [PROJECT_SCOPE, GLOBAL_SCOPE]);
  if (!chosenScope) return;
  const scope = scopeFrom(chosenScope);
  const { project, globalConfig } = readConfigs(ctx.cwd, deps.readText ?? readText);
  const action = await ui.select("Buck model profile action", [EDIT_PROFILE, ACTIVATE_PROFILE]);
  if (!action) return;
  const profile = await chooseProfile(ui, action, profileNames(scope, project, globalConfig));
  if (!profile) return;
  const update = await buildProfileUpdate(ui, ctx, scope, profile, action, project, globalConfig);
  if (!update) return;
  const save = await ui.confirm("Save Buck model profile", `Write profile "${profile}" to ${scope} scope?`);
  if (!save) return;
  const path = (deps.writeScope ?? writeBuckModelsScope)({ scope, cwd: ctx.cwd, ...update });
  ui.notify(`Saved ${scope} profile "${profile}" to ${path}.`, "info");
}

export function wireBuckModels(pi: ExtensionAPI, deps: BuckModelsDeps = {}): void {
  pi.registerCommand("buck-models", {
    description: "Create, edit, and activate project or user-global Buck model profiles",
    handler: async (_args: string, ctx: unknown) => runCommand(ctx as BuckModelsContext, deps),
  });
}
