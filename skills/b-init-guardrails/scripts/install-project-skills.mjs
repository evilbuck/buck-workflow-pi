#!/usr/bin/env node

/**
 * Copy the skills the managed AGENTS.md block loads into the target repo.
 *
 * The block tells every agent to read `skills/b-guardrails-check/` and
 * `skills/b-init-guardrails/` inside the repo. Those paths are not a global
 * plugin install. This script materializes them as regular files so the next
 * engineer can follow the block without buck-workflow installed.
 *
 * Usage:
 *   node <skill_dir>/scripts/install-project-skills.mjs --cwd <repo root>
 *
 * Idempotent. Overwrites only the two managed skill trees. Never symlinks.
 * Skips files named `*.test.[cm]?[jt]s`. Leaves every other path under
 * `skills/` alone, and never deletes files the source dropped. Refuses to
 * write through symlinked destination directories, and refuses to write when
 * the source skills directory is the target's own `skills/` (that is the
 * plugin repo, or an already-vendored copy).
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
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VENDOR_SKILLS = ["b-guardrails-check", "b-init-guardrails"];

export const GUARDRAILS_CHECK_SCRIPT =
  "node skills/b-guardrails-check/scripts/check.mjs --cwd .";

export const VENDORED_EXCLUDES = [
  "*/skills/b-guardrails-check/*",
  "*/skills/b-init-guardrails/*",
];

const scriptDir = dirname(fileURLToPath(import.meta.url));

export function defaultSourceSkillsDir() {
  return resolve(scriptDir, "../..");
}

export function isExcludedRel(rel) {
  return /(?:^|\/)[^/]+\.test\.(?:[cm]?[jt]s)$/.test(rel);
}

function skipName(name) {
  return name === "node_modules" || name === ".git";
}

function isDirectoryEntry(dirent, abs) {
  if (dirent.isDirectory()) return true;
  return dirent.isSymbolicLink() && statSync(abs).isDirectory();
}

function considerEntry(dirent, abs, rel, out) {
  if (skipName(dirent.name)) return;
  if (isDirectoryEntry(dirent, abs)) {
    walkSkill(abs, rel, out);
    return;
  }
  if (isExcludedRel(rel)) return;
  out.push(rel);
}

function walkSkill(dir, rel, out) {
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    considerEntry(dirent, join(dir, dirent.name), `${rel}/${dirent.name}`, out);
  }
}

function requireSkill(sourceSkillsDir, skill) {
  const root = join(sourceSkillsDir, skill);
  if (!existsSync(root)) throw new Error(`missing skill directory: ${skill}`);
  return root;
}

export function listVendoredFiles(sourceSkillsDir, skillNames = VENDOR_SKILLS) {
  const files = [];
  for (const skill of skillNames) walkSkill(requireSkill(sourceSkillsDir, skill), skill, files);
  return files.sort();
}

function samePath(left, right) {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return resolve(left) === resolve(right);
  }
}

export function isSelfInstall(cwd, sourceSkillsDir) {
  return samePath(join(cwd, "skills"), sourceSkillsDir);
}

function statOrNull(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function unchangedFile(existing, dest, bytes) {
  if (!existing || existing.isSymbolicLink() || !existing.isFile()) return false;
  return readFileSync(dest).equals(bytes);
}

function destChanged(dest, bytes) {
  return !unchangedFile(statOrNull(dest), dest, bytes);
}

function writeManagedFile(dest, bytes) {
  mkdirSync(dirname(dest), { recursive: true });
  const existing = statOrNull(dest);
  if (unchangedFile(existing, dest, bytes)) return "unchanged";
  if (existing && existing.isSymbolicLink()) unlinkSync(dest);
  writeFileSync(dest, bytes);
  return "copied";
}

export function addLizardExclude(cmd, pattern) {
  const flag = `-x "${pattern}"`;
  if (cmd.includes(flag)) return cmd;
  if (cmd.endsWith(" .")) return `${cmd.slice(0, -2)} ${flag} .`;
  return `${cmd} ${flag}`;
}

function lizardCommand(eco) {
  const cmd = eco?.complexity_cmd;
  if (typeof cmd !== "string") return null;
  if (!cmd.includes("lizard")) return null;
  return cmd;
}

function patchForEcosystem(eco) {
  const cmd = lizardCommand(eco);
  if (cmd === null) return [];
  const next = VENDORED_EXCLUDES.reduce(addLizardExclude, cmd);
  if (next === cmd) return [];
  return [{ from: cmd, to: next }];
}

export function complexityExcludePatches(contract) {
  const ecosystems = Array.isArray(contract?.ecosystems) ? contract.ecosystems : [];
  const seen = new Set();
  const patches = [];
  for (const patch of ecosystems.flatMap(patchForEcosystem)) {
    const key = `${patch.from}\u0000${patch.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    patches.push(patch);
  }
  return patches;
}

function replacePatch(text, patch) {
  const from = JSON.stringify(patch.from);
  if (!text.includes(from)) {
    throw new Error("complexity_cmd is not stored as a plain JSON string; leave guardrails.json unchanged and add the vendored skill excludes by hand");
  }
  return text.replaceAll(from, JSON.stringify(patch.to));
}

function applyPatches(text, patches) {
  return patches.reduce(replacePatch, text);
}

function patchExcludes(guardrailsPath, dryRun) {
  if (!existsSync(guardrailsPath)) return "absent";
  const text = readFileSync(guardrailsPath, "utf8");
  const patches = complexityExcludePatches(JSON.parse(text));
  if (patches.length === 0) return "present";
  if (dryRun) return "would-add";
  writeFileSync(guardrailsPath, applyPatches(text, patches));
  return "added";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scriptState(scripts, scriptValue) {
  if (scripts === undefined) return "no-scripts";
  if (!isRecord(scripts)) return "unsupported-scripts-shape";
  if (scripts["guardrails:check"] === scriptValue) return "present";
  if (Object.prototype.hasOwnProperty.call(scripts, "guardrails:check")) return "differs";
  return "missing";
}

function skipWs(text, index) {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

function scanString(text, start) {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "\\") i += 2;
    else if (text[i] === '"') return i + 1;
    else i += 1;
  }
  return i;
}

function scanContainer(text, start, close) {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === '"') i = scanString(text, i);
    else if (text[i] === "{" || text[i] === "[") i = scanContainer(text, i, text[i] === "{" ? "}" : "]");
    else if (text[i] === close) return i + 1;
    else i += 1;
  }
  return i;
}

function scanValueEnd(text, start) {
  const ch = text[start];
  if (ch === '"') return scanString(text, start);
  if (ch === "{" || ch === "[") return scanContainer(text, start, ch === "{" ? "}" : "]");
  let i = start;
  while (i < text.length && !"{}[],\"".includes(text[i]) && !/\s/.test(text[i])) i += 1;
  return i;
}

function rootMemberRange(text, key) {
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

function lineIndentBefore(text, index) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  return (text.slice(lineStart, index).match(/^[ \t]*/) || [""])[0];
}

function indentUnit(text) {
  const match = text.match(/\n([ \t]+)\S/);
  return match ? match[1] : "  ";
}

function lastContentIndex(text, from, to) {
  for (let i = to - 1; i >= from; i -= 1) {
    if (!/\s/.test(text[i])) return i;
  }
  return -1;
}

function guardrailsEntry(scriptValue) {
  return '"guardrails:check": ' + JSON.stringify(scriptValue);
}

function expandEmptyObject(text, open, close, body) {
  if (!text.slice(open + 1, close).includes("\n")) {
    return text.slice(0, open) + "{" + body + "}" + text.slice(close + 1);
  }
  const closeIndent = lineIndentBefore(text, close);
  const innerIndent = closeIndent + indentUnit(text);
  return text.slice(0, open) + "{\n" + innerIndent + body + "\n" + closeIndent + "}" + text.slice(close + 1);
}

function appendToObject(text, open, close, body) {
  const inner = text.slice(open + 1, close);
  const last = lastContentIndex(text, open + 1, close);
  if (inner.includes("\n")) {
    const innerIndent = lineIndentBefore(text, close) + indentUnit(text);
    return text.slice(0, last + 1) + ",\n" + innerIndent + body + text.slice(last + 1);
  }
  const separator = inner.includes(", ") ? ", " : ",";
  return text.slice(0, last + 1) + separator + body + text.slice(last + 1);
}

function insertIntoScriptsObject(text, range, scriptValue) {
  if (!range || text[range.valueStart] !== "{") return null;
  const open = range.valueStart;
  const close = range.valueEnd - 1;
  const body = guardrailsEntry(scriptValue);
  if (lastContentIndex(text, open + 1, close) < 0) return expandEmptyObject(text, open, close, body);
  return appendToObject(text, open, close, body);
}

function insertScriptsMember(text, scriptValue) {
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

export function insertGuardrailsScript(text, scriptValue = GUARDRAILS_CHECK_SCRIPT) {
  const scripts = JSON.parse(text).scripts;
  const state = scriptState(scripts, scriptValue);
  if (state !== "missing" && state !== "no-scripts") return { status: state, text };
  const edited = state === "no-scripts"
    ? insertScriptsMember(text, scriptValue)
    : insertIntoScriptsObject(text, rootMemberRange(text, "scripts"), scriptValue);
  if (edited === null) return { status: "unsupported-scripts-shape", text };
  return { status: "added", text: edited };
}

function editedTextAddsScript(text) {
  try {
    return JSON.parse(text).scripts["guardrails:check"] === GUARDRAILS_CHECK_SCRIPT;
  } catch {
    return false;
  }
}

function ensureScript(packageJsonPath, dryRun) {
  if (!existsSync(packageJsonPath)) return "no-package-json";
  const text = readFileSync(packageJsonPath, "utf8");
  const result = insertGuardrailsScript(text);
  if (result.status !== "added") return result.status;
  if (!editedTextAddsScript(result.text)) {
    throw new Error("edited package.json failed validation; refusing to write");
  }
  if (!dryRun) writeFileSync(packageJsonPath, result.text);
  return dryRun ? "would-add" : "added";
}

function pushRel(bucket, rel, copied, unchanged) {
  if (bucket === "copied") copied.push(rel);
  else unchanged.push(rel);
}

function placeFile(source, root, rel, dryRun, copied, unchanged) {
  const bytes = readFileSync(join(source, rel));
  const dest = join(root, "skills", rel);
  if (dryRun) {
    pushRel(destChanged(dest, bytes) ? "copied" : "unchanged", rel, copied, unchanged);
    return;
  }
  pushRel(writeManagedFile(dest, bytes), rel, copied, unchanged);
}

function copyVendored(source, root, files, dryRun) {
  const copied = [];
  const unchanged = [];
  for (const rel of files) placeFile(source, root, rel, dryRun, copied, unchanged);
  return { copied, unchanged };
}

function destDirRels(files) {
  const dirs = new Set(["skills"]);
  for (const rel of files) {
    let dir = dirname(join("skills", rel));
    while (dir !== "." && !dirs.has(dir)) {
      dirs.add(dir);
      dir = dirname(dir);
    }
  }
  return dirs;
}

function assertNoSymlinkedDestDirs(root, files) {
  for (const rel of destDirRels(files)) {
    const dest = join(root, rel);
    const entry = statOrNull(dest);
    if (entry?.isSymbolicLink()) throw new Error(`refusing to install through symlinked directory: ${dest}`);
  }
}

function skippedResult(root, source, files) {
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

function installedResult(root, source, placed, dryRun) {
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

export function installProjectSkills({ sourceSkillsDir, cwd, dryRun = false }) {
  const source = resolve(sourceSkillsDir);
  const root = resolve(cwd);
  const files = listVendoredFiles(source);
  if (isSelfInstall(root, source)) return skippedResult(root, source, files);
  assertNoSymlinkedDestDirs(root, files);
  return installedResult(root, source, copyVendored(source, root, files, dryRun), dryRun);
}

const FLAG = {
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

function takePathFlag(args, argv, index, key) {
  const flag = argv[index];
  args[key] = resolve(requiredValue(argv, index + 1, flag));
  return index + 1;
}

function parseArgs(argv) {
  const args = { cwd: process.cwd(), source: defaultSourceSkillsDir(), dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--cwd") i = takePathFlag(args, argv, i, "cwd");
    else if (flag === "--source") i = takePathFlag(args, argv, i, "source");
    else if (FLAG[flag]) FLAG[flag](args);
    else throw new Error(`unknown argument: ${flag}`);
  }
  return args;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function printUsage() {
  process.stdout.write("usage: install-project-skills.mjs [--cwd <repo>] [--source <skills dir>] [--dry-run]\n");
}

function main() {
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

function runCli() {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url))) runCli();
