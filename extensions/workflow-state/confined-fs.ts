import { existsSync, realpathSync } from "node:fs";
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

/** Checkout-only file tools. Symlinks are resolved before authorization.
 * Machine storage, identity, configuration, and credentials stay outside this root.
 */
export function confinedFileTools(cwd: string, names: readonly string[]): ToolDefinition[] {
  const root = realpathSync(cwd);
  return names.map((name) => confine(name, root, cwd));
}
function confine(name: string, root: string, cwd: string): ToolDefinition {
  const factory = FACTORIES[name as FileToolName];
  if (!factory) throw new Error(`no confined file tool for ${name}`);
  const tool = factory(cwd);
  const execute = tool.execute.bind(tool);
  return {
    ...tool,
    async execute(id, params, signal, onUpdate, ctx) {
      const requested = requestedPath(params);
      authorizeCheckoutPath(root, requested);
      return execute(id, params, signal, onUpdate, ctx);
    },
  } as ToolDefinition;
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

function authorizeCheckoutPath(root: string, requested: string): void {
  const expanded = expandHome(requested);
  const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
  const existing = deepestExisting(absolute);
  let real: string;
  try { real = realpathSync(existing); }
  catch { throw new Error("path is outside the checkout"); }
  if (!inside(root, real)) throw new Error("path is outside the checkout");
  if (existing === absolute) return;
  const suffix = relative(existing, absolute);
  if (suffix.startsWith(`..${sep}`) || suffix === ".." || isAbsolute(suffix)) throw new Error("path is outside the checkout");
  if (!inside(root, resolve(real, suffix))) throw new Error("path is outside the checkout");
}

function deepestExisting(absolute: string): string {
  let cursor = absolute;
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) throw new Error("path is outside the checkout");
    cursor = parent;
  }
  return cursor;
}
