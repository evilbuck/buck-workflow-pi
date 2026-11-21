#!/usr/bin/env bun

/**
 * Copy the skills the managed AGENTS.md block loads into the target repo.
 *
 * The block tells every agent to read `skills/b-guardrails-check/` and
 * `skills/b-init-guardrails/` inside the repo. Those paths are not a global
 * plugin install. This script materializes them as regular files so the next
 * engineer can follow the block without buck-workflow installed.
 *
 * Usage:
 *   bun <skill_dir>/scripts/install-project-skills.ts --cwd <repo root>
 *
 * Idempotent. Overwrites only the two managed skill trees. Never symlinks.
 * Skips files named `*.test.[cm]?[jt]s`. Leaves every other path under
 * `skills/` alone, and never deletes files the source dropped. Refuses to
 * write through symlinked destination directories, and refuses to write when
 * the source skills directory is the target's own `skills/` (that is the
 * plugin repo, or an already-vendored copy).
 *
 * Runner migration: when `package.json` records exactly a previously managed
 * `guardrails:check` command (see LEGACY_GUARDRAILS_CHECK_SCRIPTS), it is
 * rewritten to the current runner command. Any other existing value is the
 * project's own — reported as `differs` and never overwritten. Vendored
 * legacy runner files are never deleted: a stale `check.mjs` stays on disk
 * until removed by hand. `guardrails.json` user config is preserved; the only
 * edit is appending lizard excludes for the two vendored trees.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
  type Dirent,
  type Stats,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VENDOR_SKILLS = ["b-guardrails-check", "b-init-guardrails"];

export const GUARDRAILS_CHECK_SCRIPT =
  "bun skills/b-guardrails-check/scripts/check.ts --cwd .";

/**
 * Commands this installer itself wrote in earlier releases. Only these are
 * migrated to GUARDRAILS_CHECK_SCRIPT; a custom command stays untouched.
 */
export const LEGACY_GUARDRAILS_CHECK_SCRIPTS: readonly string[] = [
  "node skills/b-guardrails-check/scripts/check.mjs --cwd .",
];

export const VENDORED_EXCLUDES = [
  "*/skills/b-guardrails-check/*",
  "*/skills/b-init-guardrails/*",
];

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * Single boundary guard for this self-contained vendored script: parsed JSON
 * shapes are unknown at every use site below (package.json, guardrails.json,
 * complexity baselines). There is no shared type-guard module to import.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function defaultSourceSkillsDir(): string {
  return resolve(scriptDir, "../..");
}

export function isExcludedRel(rel: string): boolean {
  return /(?:^|\/)[^/]+\.test\.(?:[cm]?[jt]s)$/.test(rel);
}

function skipName(name: string): boolean {
  return name === "node_modules" || name === ".git";
}

function isDirectoryEntry(dirent: Dirent, abs: string): boolean {
  if (dirent.isDirectory()) return true;
  return dirent.isSymbolicLink() && statSync(abs).isDirectory();
}

function considerEntry(dirent: Dirent, abs: string, rel: string, out: string[]): void {
  if (skipName(dirent.name)) return;
  if (isDirectoryEntry(dirent, abs)) {
    walkSkill(abs, rel, out);
    return;
  }
  if (isExcludedRel(rel)) return;
  out.push(rel);
}

function walkSkill(dir: string, rel: string, out: string[]): void {
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    considerEntry(dirent, join(dir, dirent.name), `${rel}/${dirent.name}`, out);
  }
}

function requireSkill(sourceSkillsDir: string, skill: string): string {
  const root = join(sourceSkillsDir, skill);
  if (!existsSync(root)) throw new Error(`missing skill directory: ${skill}`);
  return root;
}

export function listVendoredFiles(sourceSkillsDir: string, skillNames: readonly string[] = VENDOR_SKILLS): string[] {
  const files: string[] = [];
  for (const skill of skillNames) walkSkill(requireSkill(sourceSkillsDir, skill), skill, files);
  return files.sort();
}

function samePath(left: string, right: string): boolean {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return resolve(left) === resolve(right);
  }
}

export function isSelfInstall(cwd: string, sourceSkillsDir: string): boolean {
  return samePath(join(cwd, "skills"), sourceSkillsDir);
}

function statOrNull(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function unchangedFile(existing: Stats | null, dest: string, bytes: Buffer): boolean {
  if (!existing || existing.isSymbolicLink() || !existing.isFile()) return false;
  return readFileSync(dest).equals(bytes);
}

function destChanged(dest: string, bytes: Buffer): boolean {
  return !unchangedFile(statOrNull(dest), dest, bytes);
}

function writeManagedFile(dest: string, bytes: Buffer): "copied" | "unchanged" {
  mkdirSync(dirname(dest), { recursive: true });
  const existing = statOrNull(dest);
  if (unchangedFile(existing, dest, bytes)) return "unchanged";
  if (existing && existing.isSymbolicLink()) unlinkSync(dest);
  writeFileSync(dest, bytes);
  return "copied";
}

export function addLizardExclude(cmd: string, pattern: string): string {
  const flag = `-x "${pattern}"`;
  if (cmd.includes(flag)) return cmd;
  if (cmd.endsWith(" .")) return `${cmd.slice(0, -2)} ${flag} .`;
  return `${cmd} ${flag}`;
}

function lizardCommand(eco: unknown): string | null {
  if (!isRecord(eco)) return null;
  const cmd = eco["complexity_cmd"];
  return typeof cmd === "string" && cmd.includes("lizard") ? cmd : null;
}

function patchForEcosystem(eco: unknown): ComplexityExcludePatch[] {
  const cmd = lizardCommand(eco);
  if (cmd === null) return [];
  const next = VENDORED_EXCLUDES.reduce(addLizardExclude, cmd);
  if (next === cmd) return [];
  return [{ from: cmd, to: next }];
}

export interface ComplexityExcludePatch {
  from: string;
  to: string;
}

export function complexityExcludePatches(contract: unknown): ComplexityExcludePatch[] {
  const ecosystems = isRecord(contract) && Array.isArray(contract["ecosystems"]) ? contract["ecosystems"] : [];
  const seen = new Set<string>();
  const patches: ComplexityExcludePatch[] = [];
  for (const patch of ecosystems.flatMap(patchForEcosystem)) {
    const key = `${patch.from}\u0000${patch.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    patches.push(patch);
  }
  return patches;
}

function replacePatch(text: string, patch: ComplexityExcludePatch): string {
  const from = JSON.stringify(patch.from);
  if (!text.includes(from)) {
    throw new Error("complexity_cmd is not stored as a plain JSON string; leave guardrails.json unchanged and add the vendored skill excludes by hand");
  }
  return text.replaceAll(from, JSON.stringify(patch.to));
}

function applyPatches(text: string, patches: ComplexityExcludePatch[]): string {
  return patches.reduce(replacePatch, text);
}

function patchExcludes(guardrailsPath: string, dryRun: boolean): ExcludeStatus {
  if (!existsSync(guardrailsPath)) return "absent";
  const text = readFileSync(guardrailsPath, "utf8");
  const patches = complexityExcludePatches(JSON.parse(text));
  if (patches.length === 0) return "present";
  if (dryRun) return "would-add";
  writeFileSync(guardrailsPath, applyPatches(text, patches));
  return "added";
}

export type ScriptEditStatus =
  | "present"
  | "differs"
  | "missing"
  | "no-scripts"
  | "unsupported-scripts-shape"
  | "added"
  | "migrated";

export type ScriptInstallStatus = ScriptEditStatus | "no-package-json" | "would-add" | "would-migrate";

export type ExcludeStatus = "absent" | "present" | "would-add" | "added";

export interface InstallResult {
  cwd: string;
  sourceSkillsDir: string;
  self: boolean;
  copied: string[];
  unchanged: string[];
  script: ScriptInstallStatus | "skipped";
  excludes: ExcludeStatus | "skipped";
}

export interface ScriptEdit {
  status: ScriptEditStatus;
  text: string;
}

function scriptState(scripts: unknown, scriptValue: string): ScriptEditStatus {
  if (scripts === undefined) return "no-scripts";
  if (!isRecord(scripts)) return "unsupported-scripts-shape";
  if (scripts["guardrails:check"] === scriptValue) return "present";
  if (Object.prototype.hasOwnProperty.call(scripts, "guardrails:check")) return "differs";
  return "missing";
}

function skipWs(text: string, index: number): number {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

function scanString(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "\\") i += 2;
    else if (text[i] === '"') return i + 1;
    else i += 1;
  }
  return i;
}

function scanContainer(text: string, start: number, close: string): number {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === '"') i = scanString(text, i);
    else if (text[i] === "{" || text[i] === "[") i = scanContainer(text, i, text[i] === "{" ? "}" : "]");
    else if (text[i] === close) return i + 1;
    else i += 1;
  }
  return i;
}

function scanValueEnd(text: string, start: number): number {
  const ch = text[start];
  if (ch === '"') return scanString(text, start);
  if (ch === "{" || ch === "[") return scanContainer(text, start, ch === "{" ? "}" : "]");
  let i = start;
  while (i < text.length && !"{}[],\"".includes(text[i]) && !/\s/.test(text[i])) i += 1;
  return i;
}

interface MemberRange {
  valueStart: number;
  valueEnd: number;
}

function rootMemberRange(text: string, key: string): MemberRange | null {
  const open = skipWs(text, 0);
  if (text[open] !== "{") return null;
  let i = skipWs(text, open + 1);
  while (i < text.length && text[i] !== "}") {
    if (text[i] !== '"') return null;
    const keyEnd = scanString(text, i);
    const colon = skipWs(text, keyEnd);
    if (text[colon] !== ":") return null;
    const valueStart = skipWs(text, colon + 1);
    const valueEnd = scanValueEnd(text, valueStart);
    if (JSON.parse(text.slice(i, keyEnd)) === key) return { valueStart, valueEnd };
    i = skipWs(text, valueEnd);
    if (text[i] === ",") i = skipWs(text, i + 1);
  }
  return null;
}

function lineIndentBefore(text: string, index: number): string {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  return (text.slice(lineStart, index).match(/^[ \t]*/) || [""])[0];
}

function indentUnit(text: string): string {
  const match = text.match(/\n([ \t]+)\S/);
  return match ? match[1] : "  ";
}

function lastContentIndex(text: string, from: number, to: number): number {
  for (let i = to - 1; i >= from; i -= 1) {
    if (!/\s/.test(text[i])) return i;
  }
  return -1;
}

function guardrailsEntry(scriptValue: string): string {
  return '"guardrails:check": ' + JSON.stringify(scriptValue);
}

function expandEmptyObject(text: string, open: number, close: number, body: string): string {
  if (!text.slice(open + 1, close).includes("\n")) {
    return text.slice(0, open) + "{" + body + "}" + text.slice(close + 1);
  }
  const closeIndent = lineIndentBefore(text, close);
  const innerIndent = closeIndent + indentUnit(text);
  return text.slice(0, open) + "{\n" + innerIndent + body + "\n" + closeIndent + "}" + text.slice(close + 1);
}

function appendToObject(text: string, open: number, close: number, body: string): string {
  const inner = text.slice(open + 1, close);
  const last = lastContentIndex(text, open + 1, close);
  if (inner.includes("\n")) {
    const innerIndent = lineIndentBefore(text, close) + indentUnit(text);
    return text.slice(0, last + 1) + ",\n" + innerIndent + body + text.slice(last + 1);
  }
  const separator = inner.includes(", ") ? ", " : ",";
  return text.slice(0, last + 1) + separator + body + text.slice(last + 1);
}

function insertIntoScriptsObject(text: string, range: MemberRange | null, scriptValue: string): string | null {
  if (!range || text[range.valueStart] !== "{") return null;
  const open = range.valueStart;
  const close = range.valueEnd - 1;
  const body = guardrailsEntry(scriptValue);
  if (lastContentIndex(text, open + 1, close) < 0) return expandEmptyObject(text, open, close, body);
  return appendToObject(text, open, close, body);
}

function insertScriptsMember(text: string, scriptValue: string): string | null {
  const open = skipWs(text, 0);
  if (text[open] !== "{") return null;
  const close = scanContainer(text, open, "}") - 1;
  const pretty = text.slice(open + 1, close).includes("\n");
  const memberIndent = lineIndentBefore(text, close) + indentUnit(text);
  const nested = pretty
    ? "{\n" + memberIndent + indentUnit(text) + guardrailsEntry(scriptValue) + "\n" + memberIndent + "}"
    : '{"guardrails:check": ' + JSON.stringify(scriptValue) + "}";
  const body = '"scripts": ' + nested;
  const last = lastContentIndex(text, open + 1, close);
  if (last < 0) return expandEmptyObject(text, open, close, body);
  const lead = pretty ? ",\n" + memberIndent : ", ";
  return text.slice(0, last + 1) + lead + body + text.slice(last + 1);
}

function editedTextHasScriptValue(text: string, scriptValue: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) && isRecord(parsed["scripts"]) && parsed["scripts"]["guardrails:check"] === scriptValue;
  } catch {
    return false;
  }
}

interface JsonStringLiteral {
  start: number;
  end: number;
  value: string;
}

function recordString(text: string, index: number, found: JsonStringLiteral[]): number {
  const end = scanString(text, index);
  try {
    const value: unknown = JSON.parse(text.slice(index, end));
    if (typeof value === "string") found.push({ start: index, end, value });
  } catch {
    // A broken literal cannot be the unique legacy command.
  }
  return end;
}

function visitContainer(
  text: string,
  open: number,
  token: "{" | "[",
  visit: (start: number) => number,
): number {
  const close = token === "{" ? "}" : "]";
  let index = skipWs(text, open + 1);
  while (index < text.length && text[index] !== close) {
    if (token === "{") {
      if (text[index] !== '"') return text.length;
      const keyEnd = scanString(text, index);
      const colon = skipWs(text, keyEnd);
      if (text[colon] !== ":") return text.length;
      index = visit(colon + 1);
    } else {
      index = visit(index);
    }
    index = skipWs(text, index);
    if (text[index] === ",") index = skipWs(text, index + 1);
  }
  return index < text.length ? index + 1 : index;
}

/** Every JSON string in `text`, matched by parsed value so `\/` and `/` are the same command. */
function jsonStringLiterals(text: string): JsonStringLiteral[] {
  const found: JsonStringLiteral[] = [];
  const visit = (start: number): number => {
    const index = skipWs(text, start);
    const token = text[index];
    if (token === '"') return recordString(text, index, found);
    if (token === "{" || token === "[") return visitContainer(text, index, token, visit);
    return scanValueEnd(text, index);
  };
  visit(0);
  return found;
}

/**
 * Rewrite exactly the previously managed guardrails:check command to the
 * current runner. Returns null unless the existing value is one of
 * LEGACY_GUARDRAILS_CHECK_SCRIPTS and occurs exactly once in the file, so a
 * custom command — or the same command recorded elsewhere — is never touched.
 * The match is on the parsed string, so a slash-escaped encoding still migrates.
 */
function migrateLegacyScript(text: string, scripts: unknown, scriptValue: string): string | null {
  if (!isRecord(scripts)) return null;
  const current = scripts["guardrails:check"];
  if (typeof current !== "string") return null;
  if (!LEGACY_GUARDRAILS_CHECK_SCRIPTS.includes(current)) return null;
  const matches = jsonStringLiterals(text).filter((literal) => literal.value === current);
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (!match) return null;
  const edited = `${text.slice(0, match.start)}${JSON.stringify(scriptValue)}${text.slice(match.end)}`;
  return editedTextHasScriptValue(edited, scriptValue) ? edited : null;
}

export function insertGuardrailsScript(text: string, scriptValue: string = GUARDRAILS_CHECK_SCRIPT): ScriptEdit {
  const parsed: unknown = JSON.parse(text);
  const scripts = isRecord(parsed) ? parsed["scripts"] : undefined;
  const state = scriptState(scripts, scriptValue);
  if (state !== "missing" && state !== "no-scripts") {
    if (state === "differs") {
      const migrated = migrateLegacyScript(text, scripts, scriptValue);
      if (migrated !== null) return { status: "migrated", text: migrated };
    }
    return { status: state, text };
  }
  const edited = state === "no-scripts"
    ? insertScriptsMember(text, scriptValue)
    : insertIntoScriptsObject(text, rootMemberRange(text, "scripts"), scriptValue);
  if (edited === null) return { status: "unsupported-scripts-shape", text };
  return { status: "added", text: edited };
}

function ensureScript(packageJsonPath: string, dryRun: boolean): ScriptInstallStatus {
  if (!existsSync(packageJsonPath)) return "no-package-json";
  const text = readFileSync(packageJsonPath, "utf8");
  const result = insertGuardrailsScript(text);
  if (result.status !== "added" && result.status !== "migrated") return result.status;
  if (!editedTextHasScriptValue(result.text, GUARDRAILS_CHECK_SCRIPT)) {
    throw new Error("edited package.json failed validation; refusing to write");
  }
  if (!dryRun) writeFileSync(packageJsonPath, result.text);
  return dryRun ? (result.status === "migrated" ? "would-migrate" : "would-add") : result.status;
}

function pushRel(bucket: "copied" | "unchanged", rel: string, copied: string[], unchanged: string[]): void {
  if (bucket === "copied") copied.push(rel);
  else unchanged.push(rel);
}

function placeFile(source: string, root: string, rel: string, dryRun: boolean, copied: string[], unchanged: string[]): void {
  const bytes = readFileSync(join(source, rel));
  const dest = join(root, "skills", rel);
  if (dryRun) {
    pushRel(destChanged(dest, bytes) ? "copied" : "unchanged", rel, copied, unchanged);
    return;
  }
  pushRel(writeManagedFile(dest, bytes), rel, copied, unchanged);
}

function copyVendored(source: string, root: string, files: string[], dryRun: boolean): { copied: string[]; unchanged: string[] } {
  const copied: string[] = [];
  const unchanged: string[] = [];
  for (const rel of files) placeFile(source, root, rel, dryRun, copied, unchanged);
  return { copied, unchanged };
}

function destDirRels(files: string[]): Set<string> {
  const dirs = new Set<string>(["skills"]);
  for (const rel of files) {
    let dir = dirname(join("skills", rel));
    while (dir !== "." && !dirs.has(dir)) {
      dirs.add(dir);
      dir = dirname(dir);
    }
  }
  return dirs;
}

function assertNoSymlinkedDestDirs(root: string, files: string[]): void {
  for (const rel of destDirRels(files)) {
    const dest = join(root, rel);
    const entry = statOrNull(dest);
    if (entry?.isSymbolicLink()) throw new Error(`refusing to install through symlinked directory: ${dest}`);
  }
}

function skippedResult(root: string, source: string, files: string[]): InstallResult {
  return {
    cwd: root,
    sourceSkillsDir: source,
    self: true,
    copied: [],
    unchanged: files,
    script: "skipped",
    excludes: "skipped",
  };
}

function installedResult(root: string, source: string, placed: { copied: string[]; unchanged: string[] }, dryRun: boolean): InstallResult {
  return {
    cwd: root,
    sourceSkillsDir: source,
    self: false,
    copied: placed.copied,
    unchanged: placed.unchanged,
    script: ensureScript(join(root, "package.json"), dryRun),
    excludes: patchExcludes(join(root, "guardrails.json"), dryRun),
  };
}

export function installProjectSkills({ sourceSkillsDir, cwd, dryRun = false }: {
  sourceSkillsDir: string;
  cwd: string;
  dryRun?: boolean;
}): InstallResult {
  const source = resolve(sourceSkillsDir);
  const root = resolve(cwd);
  const files = listVendoredFiles(source);
  if (isSelfInstall(root, source)) return skippedResult(root, source, files);
  assertNoSymlinkedDestDirs(root, files);
  return installedResult(root, source, copyVendored(source, root, files, dryRun), dryRun);
}

interface CliArgs {
  cwd: string;
  source: string;
  dryRun: boolean;
  help: boolean;
}

const FLAG: Record<string, (args: CliArgs) => void> = {
  "--dry-run": (args) => {
    args.dryRun = true;
  },
  "--help": (args) => {
    args.help = true;
  },
  "-h": (args) => {
    args.help = true;
  },
};

function takePathFlag(args: CliArgs, argv: string[], index: number, key: "cwd" | "source"): number {
  const flag = argv[index];
  args[key] = resolve(requiredValue(argv, index + 1, flag));
  return index + 1;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { cwd: process.cwd(), source: defaultSourceSkillsDir(), dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--cwd") i = takePathFlag(args, argv, i, "cwd");
    else if (flag === "--source") i = takePathFlag(args, argv, i, "source");
    else if (FLAG[flag]) FLAG[flag](args);
    else throw new Error(`unknown argument: ${flag}`);
  }
  return args;
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function printUsage(): void {
  process.stdout.write("usage: install-project-skills.ts [--cwd <repo>] [--source <skills dir>] [--dry-run]\n");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  const result = installProjectSkills({
    sourceSkillsDir: args.source,
    cwd: args.cwd,
    dryRun: args.dryRun,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function runCli(): void {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url))) runCli();
