import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseStorageConfig, resolveStorageConfig, type StorageSelection } from "../storage/config.js";
import { digest, legacySnapshot, selectSnapshot, validateSnapshot, type MigrationSnapshot } from "../storage/migration.js";
import { doctorLegacySql, dryRun, importSnapshot, prepareCutover, quarantineLegacy, retainPrivate, switchCutover, type CutoverJournal } from "../storage/cutover.js";
import { openStore, rebindMigratedConsumers, resolveTrustedContext, type TrustedWorkflowContext } from "./workflow-state.js";

type Input = Record<string, unknown>;
interface Command { cwd: string; context: TrustedWorkflowContext; input: Input; path: string }
const COMMANDS: Record<string, (command: Command) => Promise<unknown>> = {
  "migration-export": exportMigration,
  "migration-import": command => importMigration(command, false),
  "migration-import-legacy": command => importMigration(command, true),
  "migration-quarantine": async ({ input, path }) => {
    if (typeof input.file !== "string") throw new Error("Quarantine requires legacy JSON file");
    return quarantineLegacy(path, JSON.parse(await readFile(resolve(input.file), "utf8")));
  },
  "migration-dry-run": command => startCutover(command, true),
  "migration-cutover": command => startCutover(command, false),
  "migration-resume": command => resumeCutover(command, false),
  "migration-rollback": command => resumeCutover(command, true),
};
/** Operator executable only; never exposed through model-facing workflow_state. */
export async function migrationCommand(operation: string, input: Input, cwd: string): Promise<unknown> {
  const context = await resolveTrustedContext(cwd);
  if (operation === "doctor") return { adapter: context.selection!.storage.adapter, projectConfigured: Boolean(context.selection!.projectKey), legacy: doctorLegacySql(process.env) };
  if (typeof input.path !== "string") throw new Error("Migration requires private output/journal path");
  const handler = COMMANDS[operation];
  if (!handler) throw new Error("Unknown migration command");
  return handler({ cwd, context, input, path: resolve(input.path) });
}
function openContextStore(command: Command, storage: StorageSelection, readOnly = false) {
  return openStore(command.cwd, { ...command.context.selection!, storage }, command.context.projectId, command.context.manifestRoot!, { readOnly, migrationBranchId: command.context.branchId });
}
async function exportMigration(command: Command): Promise<unknown> {
  const { context, input, path } = command;
  const source = await openContextStore(command, context.selection!.storage, true);
  try {
    let snapshot = await source.store.migrationSnapshot(context.projectId);
    if (input.scope === "branch") snapshot = selectSnapshot(snapshot, { branchId: context.branchId });
    else if (input.scope === "run") snapshot = selectSnapshot(snapshot, { branchId: context.branchId, worktreeId: context.worktreeId, runId: context.runId });
    else if (input.scope !== undefined && input.scope !== "project") throw new Error("Export scope must be project, branch, or run");
    validateSnapshot(snapshot);
    await retainPrivate(path, snapshot);
    return { digest: digest(snapshot), records: Object.fromEntries(Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length])) };
  } finally { await source.close(); }
}
async function importMigration(command: Command, legacy: boolean): Promise<unknown> {
  const { context, input, path } = command;
  if (typeof input.file !== "string") throw new Error("Import requires snapshot or original legacy JSON file");
  const original = JSON.parse(await readFile(resolve(input.file), "utf8"));
  const snapshot: MigrationSnapshot = legacy ? legacySnapshot(context.projectId, original) : original;
  if (snapshot.projectId !== context.projectId) throw new Error("Import project identity mismatch");
  const destination = await openContextStore(command, context.selection!.storage);
  try { await importSnapshot(destination.store, path, digest(context.selection!.storage), snapshot); return { complete: true, digest: digest(snapshot) }; }
  finally { await destination.close(); }
}
async function resumeCutover(command: Command, rollback: boolean): Promise<unknown> {
  const { context, input, path } = command;
  if (input.quiesced !== true) throw new Error("Stop all project writers; explicit quiesced:true is required");
  const journal = JSON.parse(await readFile(path, "utf8")) as CutoverJournal;
  if (journal.projectId !== context.projectId || journal.configPath !== resolve(context.selection!.configPath)) throw new Error("Cutover journal context mismatch");
  const source = await openContextStore(command, journal.source, true);
  const destination = await openContextStore(command, journal.destination);
  try {
    const result = await switchCutover(path, source.store, destination.store, (from, to) => rebindMigratedConsumers(context.projectId, from, to), rollback);
    return { status: result.status, digest: result.snapshotDigest, ...(result.rescue ? { rescueDigest: result.rescue.digest } : {}) };
  } finally { await destination.close(); await source.close(); }
}
async function startCutover(command: Command, dry: boolean): Promise<unknown> {
  const { context, input, path } = command;
  const selection = context.selection!;
  if (!selection.projectKey) throw new Error("Backend cutover requires an explicit project entry in config");
  const config = parseStorageConfig(JSON.stringify({ version: 1, storage: input.destination }));
  const target = resolveStorageConfig(config, undefined).storage;
  if (digest(target) === digest(selection.storage)) throw new Error("Source and destination must differ");
  const source = await openContextStore(command, selection.storage, true);
  const destination = await openContextStore(command, target);
  try {
    if (dry) return dryRun(await source.store.migrationSnapshot(context.projectId), await destination.store.migrationSnapshot(context.projectId));
    if (input.quiesced !== true) throw new Error("Stop all project writers; explicit quiesced:true is required");
    await prepareCutover({ path, configPath: selection.configPath, projectKey: selection.projectKey, source: selection.storage, destination: target, sourceStore: source.store, destinationStore: destination.store, projectId: context.projectId });
    const result = await switchCutover(path, source.store, destination.store, (from, to) => rebindMigratedConsumers(context.projectId, from, to));
    return { status: result.status, digest: result.snapshotDigest };
  } finally { await destination.close(); await source.close(); }
}
