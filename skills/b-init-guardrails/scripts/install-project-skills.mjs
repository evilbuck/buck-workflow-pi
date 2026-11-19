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
 * Never copies `*.test.*`. Leaves every other path under `skills/` alone.
 * Refuses to write when the source skills directory is the target's own
 * `skills/` (that is the plugin repo, or an already-vendored copy).
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
  return ecosystems.flatMap(patchForEcosystem);
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
  if (!isRecord(scripts)) return "no-scripts";
  if (scripts["guardrails:check"] === scriptValue) return "present";
  if (Object.prototype.hasOwnProperty.call(scripts, "guardrails:check")) return "differs";
  return "missing";
}

function scriptsLineIndex(lines) {
  return lines.findIndex((line) => /^\s*"scripts"\s*:/.test(line));
}

function oneLineScripts(line) {
  return line.includes("{") && line.includes("}");
}

function indentOf(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : "";
}

function emptyScriptsLine(line, scriptValue) {
  const base = indentOf(line);
  const body = base + "  " + '"guardrails:check": ' + JSON.stringify(scriptValue);
  const replacement = "{\n" + body + "\n" + base + "}";
  const empty = "{" + "}";
  if (!line.includes(empty)) return line;
  return line.replace(empty, replacement);
}

function expandEmptyScripts(lines, idx, scriptValue) {
  const replacement = emptyScriptsLine(lines[idx], scriptValue);
  if (replacement === lines[idx]) return { status: "unsupported-scripts-shape", text: lines.join("\n") };
  const copy = lines.slice();
  copy[idx] = replacement;
  return { status: "added", text: copy.join("\n") };
}

function scriptEntry(indent, scriptValue, comma) {
  return indent + '"guardrails:check": ' + JSON.stringify(scriptValue) + comma;
}

function insertAfterOpen(lines, idx, scriptValue, hasKeys) {
  const indent = indentOf(lines[idx + 1] || "") || "  ";
  const copy = lines.slice();
  copy.splice(idx + 1, 0, scriptEntry(indent, scriptValue, hasKeys ? "," : ""));
  return { status: "added", text: copy.join("\n") };
}
function insertMissingScript(text, scriptValue, hasKeys) {
  const lines = text.split("\n");
  const idx = scriptsLineIndex(lines);
  if (idx < 0) return { status: "no-scripts", text };
  if (!oneLineScripts(lines[idx])) return insertAfterOpen(lines, idx, scriptValue, hasKeys);
  if (hasKeys) return { status: "unsupported-scripts-shape", text };
  return expandEmptyScripts(lines, idx, scriptValue);
}

export function insertGuardrailsScript(text, scriptValue = GUARDRAILS_CHECK_SCRIPT) {
  const scripts = JSON.parse(text).scripts;
  const state = scriptState(scripts, scriptValue);
  if (state !== "missing") return { status: state, text };
  return insertMissingScript(text, scriptValue, Object.keys(scripts).length > 0);
}

function ensureScript(packageJsonPath, dryRun) {
  if (!existsSync(packageJsonPath)) return "no-package-json";
  const text = readFileSync(packageJsonPath, "utf8");
  const result = insertGuardrailsScript(text);
  if (result.status !== "added") return result.status;
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
