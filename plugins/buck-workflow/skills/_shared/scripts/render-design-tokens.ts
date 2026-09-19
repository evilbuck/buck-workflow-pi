#!/usr/bin/env bun
/**
 * Renders the canonical design language in `skills/_shared/design-brief.jsonc`
 * into the exact text consumer templates must carry.
 *
 * The brief is authoritative. Templates never hand-maintain a copy of the
 * palette; they carry a generated block delimited by BEGIN/END markers, and
 * `design-language.test.ts` compares those blocks to this renderer byte-for-byte
 * so neither side can state a token the other lacks.
 *
 *   bun skills/_shared/scripts/render-design-tokens.ts            # print both blocks
 *   bun skills/_shared/scripts/render-design-tokens.ts --css
 *   bun skills/_shared/scripts/render-design-tokens.ts --mermaid
 *   bun skills/_shared/scripts/render-design-tokens.ts --write    # splice into consumers
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BRIEF_PATH = "skills/_shared/design-brief.jsonc";

/** Files carrying generated blocks. Keep in sync with CONSUMERS in the test. */
export const CONSUMER_FILES = [
  "skills/b-blueprint/references/blueprint-template.html",
  "skills/b-present/references/briefing-package-patterns.md",
] as const;

export interface TokenGroup {
  group: string;
  note?: string;
  tokens: Record<string, string>;
}

export interface DesignBrief {
  name: string;
  version: number;
  token_groups: TokenGroup[];
  /** Flattened `token_groups`, in declaration order. */
  tokens: Record<string, string>;
  mermaid: { cdn: string; config: Record<string, unknown> };
  [key: string]: unknown;
}

/** Truncate a line at the first `//` that is not inside a JSON string. */
function stripLineComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && inString) {
      i++;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString && ch === "/" && line[i + 1] === "/") {
      return line.slice(0, i);
    }
  }
  return line;
}

export function stripJsonComments(text: string): string {
  return text.split("\n").map(stripLineComment).join("\n");
}

function flattenTokens(groups: TokenGroup[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const group of groups) {
    for (const [name, value] of Object.entries(group.tokens)) {
      if (name in tokens) throw new Error(`duplicate design token: ${name}`);
      tokens[name] = value;
    }
  }
  return tokens;
}

export function loadDesignBrief(root = process.cwd()): DesignBrief {
  const raw = readFileSync(join(root, BRIEF_PATH), "utf8");
  const brief = JSON.parse(stripJsonComments(raw)) as DesignBrief;
  brief.tokens = flattenTokens(brief.token_groups);
  return brief;
}

const PROVENANCE = `from ${BRIEF_PATH} \u00b7 do not edit by hand \u00b7 regenerate with bun ${BRIEF_PATH.replace("design-brief.jsonc", "scripts/render-design-tokens.ts")} --write`;

export function renderTokenBlock(brief: DesignBrief): string {
  const lines = [`/* BEGIN generated:design-tokens \u00b7 ${PROVENANCE} */`, ":root{"];
  for (const group of brief.token_groups) {
    lines.push(`  /* ${group.group} */`);
    for (const [name, value] of Object.entries(group.tokens)) {
      lines.push(`  ${name}:${value};`);
    }
  }
  lines.push("}", "/* END generated:design-tokens */");
  return lines.join("\n");
}

/** Inverse of `renderTokenBlock` — reads declarations back out of rendered CSS. */
export function parseTokenBlock(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const line of css.split("\n")) {
    const match = /^\s*(--[a-z0-9-]+)\s*:\s*(.+);$/i.exec(line);
    if (match) tokens[match[1]] = match[2];
  }
  return tokens;
}

export function renderMermaidInit(brief: DesignBrief): string {
  return [
    `<!-- BEGIN generated:mermaid-init \u00b7 ${PROVENANCE} -->`,
    `<script src="${brief.mermaid.cdn}"></script>`,
    `<script>mermaid.initialize(${JSON.stringify(brief.mermaid.config)});</script>`,
    "<!-- END generated:mermaid-init -->",
  ].join("\n");
}

function blockPattern(name: string): RegExp {
  const open = name === "mermaid-init" ? "<!-- BEGIN generated:" : "\\/\\* BEGIN generated:";
  const close = name === "mermaid-init"
    ? `<!-- END generated:${name} -->`
    : `\\/\\* END generated:${name} \\*\\/`;
  return new RegExp(`^${open}${name}\\b.*?^${close}`, "ms");
}

/** The full marked block, markers included, or null when absent. */
export function extractGeneratedBlock(text: string, name: string): string | null {
  return blockPattern(name).exec(text)?.[0] ?? null;
}

export function spliceGeneratedBlock(text: string, name: string, block: string): string {
  const pattern = blockPattern(name);
  if (!pattern.test(text)) throw new Error(`no generated:${name} block to replace`);
  return text.replace(pattern, () => block);
}

function writeConsumers(brief: DesignBrief, root: string): string[] {
  const blocks: [string, string][] = [
    ["design-tokens", renderTokenBlock(brief)],
    ["mermaid-init", renderMermaidInit(brief)],
  ];
  const touched: string[] = [];
  for (const rel of CONSUMER_FILES) {
    const path = join(root, rel);
    const before = readFileSync(path, "utf8");
    let after = before;
    for (const [name, block] of blocks) after = spliceGeneratedBlock(after, name, block);
    if (after !== before) {
      writeFileSync(path, after);
      touched.push(rel);
    }
  }
  return touched;
}

export function main(argv: string[], root = process.cwd()): void {
  const brief = loadDesignBrief(root);
  if (argv.includes("--write")) {
    const touched = writeConsumers(brief, root);
    console.log(touched.length ? `updated:\n  ${touched.join("\n  ")}` : "already up to date");
    return;
  }
  if (argv.includes("--mermaid")) return console.log(renderMermaidInit(brief));
  if (argv.includes("--css")) return console.log(renderTokenBlock(brief));
  console.log(`${renderTokenBlock(brief)}\n\n${renderMermaidInit(brief)}`);
}

if (import.meta.main) main(process.argv.slice(2));
