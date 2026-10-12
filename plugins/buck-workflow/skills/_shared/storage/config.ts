import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { STORAGE_ADAPTERS, type StorageAdapter } from "./contract.js";
import { configuredOrigin, redactOrigin } from "./identity.js";

export interface StorageSelection {
  adapter: StorageAdapter;
  root?: string;
  database?: string;
  connection_env?: string;
}
export interface ProjectStorageConfig {
  origins: readonly string[];
  integration_ref?: string;
  storage?: StorageSelection;
}
export interface StorageConfig {
  version: 1;
  storage: StorageSelection;
  projects: Readonly<Record<string, ProjectStorageConfig>>;
}
export interface ResolvedStorageConfig {
  configPath: string;
  storage: StorageSelection;
  projectKey?: string;
  integrationRef?: string;
}

function machineConfigPath(): string {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "buck-workflow", "config.yaml");
}
function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be a mapping`);
  return value as Record<string, unknown>;
}
function knownKeys(value: Record<string, unknown>, allowed: readonly string[], name: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${name} key: ${key}`);
}
function validateSelection(raw: Record<string, unknown>, name: string): void {
  if (typeof raw.adapter !== "string" || !STORAGE_ADAPTERS.includes(raw.adapter as StorageAdapter)) throw new Error(`${name}.adapter must be one of ${STORAGE_ADAPTERS.join(", ")}`);
  validateOptionalStrings(raw, name);
  validateConnectionEnv(raw, name);
  validateAdapterFields(raw, name);
}
function validateOptionalStrings(raw: Record<string, unknown>, name: string): void {
  for (const key of ["root", "database", "connection_env"] as const) {
    const item = raw[key];
    if (item !== undefined && (typeof item !== "string" || item.length === 0)) throw new Error(`${name}.${key} must be a non-empty string`);
  }
}
function validateConnectionEnv(raw: Record<string, unknown>, name: string): void {
  if (raw.connection_env && !/^[A-Z_][A-Z0-9_]*$/.test(raw.connection_env as string)) throw new Error(`${name}.connection_env must name an environment variable`);
}
function validateAdapterFields(raw: Record<string, unknown>, name: string): void {
  if (raw.adapter !== "external-files" && raw.root !== undefined) throw new Error(`${name}.root is only valid for external-files`);
  if (raw.adapter !== "sqlite" && raw.database !== undefined) throw new Error(`${name}.database is only valid for sqlite`);
  if (raw.adapter !== "postgres" && raw.connection_env !== undefined) throw new Error(`${name}.connection_env is only valid for postgres`);
}
function selection(value: unknown, name: string): StorageSelection {
  const raw = record(value, name);
  knownKeys(raw, ["adapter", "root", "database", "connection_env"], name);
  validateSelection(raw, name);
  return raw as unknown as StorageSelection;
}

function parseProject(key: string, value: unknown, originsSeen: Set<string>): ProjectStorageConfig {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key)) throw new Error(`Invalid project key: ${key}`);
  const project = record(value, `projects.${key}`);
  knownKeys(project, ["origins", "integration_ref", "storage"], `projects.${key}`);
  if (!Array.isArray(project.origins) || project.origins.length === 0 || project.origins.some((origin) => typeof origin !== "string" || !origin.trim())) throw new Error(`projects.${key}.origins must be a non-empty string list`);
  const origins = (project.origins as string[]).map(configuredOrigin);
  for (const origin of origins) {
    if (originsSeen.has(origin)) throw new Error("Project origin is ambiguous after canonical normalization");
    originsSeen.add(origin);
  }
  if (project.integration_ref !== undefined && (typeof project.integration_ref !== "string" || !/^refs\/[A-Za-z0-9._/-]+$/.test(project.integration_ref))) throw new Error(`projects.${key}.integration_ref must be a full ref`);
  return {
    origins,
    ...(project.integration_ref === undefined ? {} : { integration_ref: project.integration_ref as string }),
    ...(project.storage === undefined ? {} : { storage: selection(project.storage, `projects.${key}.storage`) }),
  };
}

function storageWithDefaults(storage: StorageSelection): StorageSelection {
  if (storage.adapter === "external-files" && storage.root === undefined) {
    const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return { ...storage, root: join(base, "buck-workflow", "{project}", ".context") };
  }
  if (storage.adapter === "sqlite" && storage.database === undefined) {
    return { ...storage, database: join(homedir(), ".config", "buck-workflow", "state.sqlite") };
  }
  return storage;
}

export function parseStorageConfig(source: string): StorageConfig {
  const document = parseDocument(source, { uniqueKeys: true, version: "1.2" });
  if (document.errors.length) throw new Error(`Invalid storage config YAML: ${document.errors[0]!.message}`);
  const root = record(document.toJS({ mapAsMap: false }), "config");
  knownKeys(root, ["version", "storage", "projects"], "config");
  if (root.version !== 1) throw new Error("config.version must be 1");
  const defaultStorage = root.storage === undefined ? { adapter: "repo-files" as const } : selection(root.storage, "storage");
  const projects = root.projects === undefined ? {} : record(root.projects, "projects");
  const parsedProjects: Record<string, ProjectStorageConfig> = {};
  const originsSeen = new Set<string>();
  for (const [key, value] of Object.entries(projects)) parsedProjects[key] = parseProject(key, value, originsSeen);
  return { version: 1, storage: defaultStorage, projects: parsedProjects };
}

export function resolveStorageConfig(config: StorageConfig, origin: string | undefined, options: { configPath?: string } = {}): ResolvedStorageConfig {
  const canonicalOrigin = origin === undefined ? undefined : redactOrigin(origin);
  const matches = Object.entries(config.projects).filter(([, project]) => canonicalOrigin !== undefined && project.origins.some((alias) => redactOrigin(alias) === canonicalOrigin));
  if (matches.length > 1) throw new Error("Ambiguous project storage configuration");
  const [projectKey, project] = matches[0] ?? [];
  return {
    configPath: options.configPath ?? machineConfigPath(),
    storage: storageWithDefaults(project?.storage ?? config.storage),
    ...(projectKey ? { projectKey } : {}),
    ...(project?.integration_ref ? { integrationRef: project.integration_ref } : {}),
  };
}

export async function loadStorageConfig(options: { configPath?: string; origin?: string } = {}): Promise<ResolvedStorageConfig> {
  const configPath = options.configPath ?? process.env.BUCK_WORKFLOW_CONFIG ?? machineConfigPath();
  let source: string;
  try {
    source = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && options.configPath === undefined && process.env.BUCK_WORKFLOW_CONFIG === undefined) {
      return resolveStorageConfig({ version: 1, storage: { adapter: "repo-files" }, projects: {} }, options.origin, { configPath });
    }
    throw new Error(`Cannot read Buck Workflow storage config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return resolveStorageConfig(parseStorageConfig(source), options.origin, { configPath });
}
