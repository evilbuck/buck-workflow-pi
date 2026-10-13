import { closeSync, constants, lstatSync, mkdirSync, openSync, readSync, realpathSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";

const FACTORIES = {
  read: createReadToolDefinition,
  edit: createEditToolDefinition,
  write: createWriteToolDefinition,
  grep: createGrepToolDefinition,
  find: createFindToolDefinition,
  ls: createLsToolDefinition,
} as const;

type FileToolName = keyof typeof FACTORIES;
const MUTATING: Record<string, true> = { write: true, edit: true };
const OUTSIDE = "path is outside the checkout";

/** Checkout-only file tools. Symlinks are not followed into a write.
 * Machine storage, identity, configuration, credentials, and Git metadata stay outside this sink.
 */
export function confinedFileTools(cwd: string, names: readonly string[]): ToolDefinition[] {
  const root = realpathSync(cwd);
  return names.map((name) => confine(name, root, cwd));
}

function confine(name: string, root: string, cwd: string): ToolDefinition {
  const factory = FACTORIES[name as FileToolName];
  if (!factory) throw new Error(`no confined file tool for ${name}`);
  const mutate = MUTATING[name] === true;
  const tool = mutate ? mutatingTool(name as FileToolName, root, cwd) : factory(cwd);
  const execute = tool.execute.bind(tool);
  return {
    ...tool,
    async execute(id, params, signal, onUpdate, ctx) {
      authorizeCheckoutPath(root, requestedPath(params), mutate);
      return execute(id, params, signal, onUpdate, ctx);
    },
  } as ToolDefinition;
}

function mutatingTool(name: FileToolName, root: string, cwd: string): ToolDefinition {
  const operations = checkoutOperations(root);
  if (name === "write") return createWriteToolDefinition(cwd, { operations });
  return createEditToolDefinition(cwd, { operations });
}

function checkoutOperations(root: string) {
  return {
    mkdir: async (dir: string) => { mkdirCheckout(root, dir); },
    writeFile: async (file: string, content: string) => { writeCheckout(root, file, content); },
    readFile: async (file: string) => readCheckout(root, file),
    access: async (file: string) => { closeCheckout(openCheckout(root, file, constants.O_RDONLY | constants.O_NOFOLLOW)); },
  };
}

function requestedPath(params: unknown): string {
  if (!params || typeof params !== "object" || !("path" in params)) return ".";
  const path = params.path;
  return typeof path === "string" && path.length > 0 ? path : ".";
}

function expandHome(filePath: string): string {
  if (filePath === "~") return homedir();
  if (filePath.startsWith("~/")) return homedir() + filePath.slice(1);
  return filePath;
}

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function absolutePath(root: string, requested: string): string {
  const expanded = expandHome(requested);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
}

function authorizeCheckoutPath(root: string, requested: string, mutate: boolean): void {
  const absolute = absolutePath(root, requested);
  const existing = deepestExisting(absolute);
  if (lstatSync(existing).isSymbolicLink()) {
    let real: string;
    try { real = realpathSync(existing); }
    catch { throw new Error(OUTSIDE); }
    if (mutate || !inside(root, real)) throw new Error(OUTSIDE);
    const suffix = relative(existing, absolute);
    if (!safeSuffix(suffix) || !inside(root, resolve(real, suffix))) throw new Error(OUTSIDE);
    return;
  }
  let real: string;
  try { real = realpathSync(existing); }
  catch { throw new Error(OUTSIDE); }
  if (!inside(root, real)) throw new Error(OUTSIDE);
  if (existing === absolute) {
    if (mutate) rejectGitMetadata(absolute);
    return;
  }
  const suffix = relative(existing, absolute);
  if (!safeSuffix(suffix) || !inside(root, resolve(real, suffix))) throw new Error(OUTSIDE);
  if (mutate) rejectGitMetadata(absolute);
}

function safeSuffix(suffix: string): boolean {
  return suffix !== ".." && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}

function rejectGitMetadata(absolute: string): void {
  if (absolute.split(sep).includes(".git")) throw new Error(OUTSIDE);
}

function deepestExisting(absolute: string): string {
  let cursor = absolute;
  for (;;) {
    try {
      lstatSync(cursor);
      return cursor;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(OUTSIDE);
      const parent = dirname(cursor);
      if (parent === cursor) throw new Error(OUTSIDE);
      cursor = parent;
    }
  }
}

function partsWithin(root: string, absolute: string): string[] {
  if (!inside(root, absolute)) throw new Error(OUTSIDE);
  const parts = relative(root, absolute).split(sep).filter((part) => part && part !== ".");
  if (parts.some((part) => part === ".." || part === ".git")) throw new Error(OUTSIDE);
  return parts;
}

function openCheckout(root: string, absolute: string, flags: number): number {
  const parts = partsWithin(root, absolute);
  let dir = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    for (let index = 0; index < parts.length - 1; index += 1) {
      const next = openSync(fdPath(dir, parts[index]!), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      closeSync(dir);
      dir = next;
    }
    const name = parts[parts.length - 1];
    if (!name) throw new Error(OUTSIDE);
    const file = openSync(fdPath(dir, name), flags, 0o666);
    closeSync(dir);
    dir = -1;
    return file;
  } catch (error) {
    if (dir >= 0) closeSync(dir);
    if (error instanceof Error && error.message === OUTSIDE) throw error;
    throw new Error(OUTSIDE);
  }
}

function fdPath(dir: number, name: string): string {
  return `/proc/self/fd/${dir}/${name}`;
}

function closeCheckout(fd: number): void {
  closeSync(fd);
}

function writeCheckout(root: string, absolute: string, content: string): void {
  const fd = openCheckout(root, absolute, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW);
  try {
    const data = Buffer.from(content, "utf8");
    let offset = 0;
    while (offset < data.length) offset += writeSync(fd, data, offset);
  } finally { closeSync(fd); }
}

function readCheckout(root: string, absolute: string): Buffer {
  const fd = openCheckout(root, absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const chunks: Buffer[] = [];
    const buf = Buffer.alloc(65536);
    for (;;) {
      const count = readSync(fd, buf, 0, buf.length, null);
      if (count === 0) break;
      chunks.push(Buffer.from(buf.subarray(0, count)));
    }
    return Buffer.concat(chunks);
  } finally { closeSync(fd); }
}

function mkdirCheckout(root: string, absolute: string): void {
  const parts = partsWithin(root, absolute);
  let dir = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    for (const name of parts) {
      const path = fdPath(dir, name);
      try { mkdirSync(path); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new Error(OUTSIDE); }
      const next = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      closeSync(dir);
      dir = next;
    }
  } catch (error) {
    if (error instanceof Error && error.message === OUTSIDE) throw error;
    throw new Error(OUTSIDE);
  } finally { if (dir >= 0) closeSync(dir); }
}
