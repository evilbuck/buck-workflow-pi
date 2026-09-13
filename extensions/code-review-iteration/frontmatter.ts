/**
 * frontmatter — strict, tiny YAML-subset parser for extension-owned Markdown
 * seeds (model catalog entries, reviewer personas, exec policy).
 *
 * Supported grammar (anything else is a parse error, never a silent default):
 *   key: scalar
 *   key: [a, b, c]          # flow list of strings
 *   listkey:                # list of maps
 *     - key: scalar
 *       key: [a, b]
 *
 * Consumers coerce scalars (numbers, booleans, enums) and validate.
 */

export type Scalar = string;
export type FlowList = string[];
export type ListItem = Record<string, Scalar | FlowList>;
export type FrontmatterValue = Scalar | FlowList | ListItem[];
export type FrontmatterData = Record<string, FrontmatterValue>;

export class FrontmatterParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`${message} (line ${line})`);
    this.name = "FrontmatterParseError";
  }
}

const FLOW_LIST_RE = /^\[(.*)\]$/;

function splitFlowList(raw: string, line: number): FlowList {
  const inner = raw.trim();
  if (inner === "") return [];
  return inner.split(",").map((part) => {
    const item = part.trim().replace(/^['"]|['"]$/g, "");
    if (item === "") throw new FrontmatterParseError("empty list item", line);
    return item;
  });
}

function parseScalar(raw: string, line: number): Scalar {
  const value = raw.trim().replace(/^['"]|['"]$/g, "");
  if (value === "") throw new FrontmatterParseError("empty scalar value", line);
  return value;
}

function parseLine(rawLine: string, line: number): { key: string; value: Scalar | FlowList | null } {
  const text = rawLine.trim();
  const colon = text.indexOf(":");
  if (colon <= 0) throw new FrontmatterParseError("expected `key: value`", line);
  const key = text.slice(0, colon).trim();
  if (key === "") throw new FrontmatterParseError("empty key", line);
  const rest = text.slice(colon + 1).trim();
  if (rest === "") return { key, value: null };
  const flow = FLOW_LIST_RE.exec(rest);
  return { key, value: flow ? splitFlowList(flow[1], line) : parseScalar(rest, line) };
}

/**
 * Extract and parse the leading `---`-delimited frontmatter block.
 * Returns `{ data, body }`; a document with no frontmatter block returns
 * empty data and the full text as body.
 */
export function parseFrontmatter(text: string): { data: FrontmatterData; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { data: {}, body: text };
  const data: FrontmatterData = {};
  let currentListKey: string | null = null;
  let currentItem: ListItem | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "---") return { data, body: lines.slice(i + 1).join("\n") };
    if (line.trim() === "") continue;
    const isListItem = /^\s*-\s+/.test(line);
    if (isListItem && currentListKey === null) {
      throw new FrontmatterParseError("list item outside a list key", i + 1);
    }
    if (isListItem && currentListKey !== null) {
      const parsed = parseLine(line.replace(/^\s*-\s+/, ""), i + 1);
      if (parsed.value === null) throw new FrontmatterParseError("list item needs `key: value`", i + 1);
      currentItem = { [parsed.key]: parsed.value };
      const existing = data[currentListKey];
      if (!Array.isArray(existing)) throw new FrontmatterParseError(`expected list under ${currentListKey}`, i + 1);
      (existing as ListItem[]).push(currentItem);
      continue;
    }
    const parsed = parseLine(line, i + 1);
    if (parsed.value === null) {
      if (data[parsed.key] !== undefined) throw new FrontmatterParseError(`duplicate key ${parsed.key}`, i + 1);
      data[parsed.key] = [];
      currentListKey = parsed.key;
      currentItem = null;
      continue;
    }
    if (currentItem !== null && currentListKey !== null && !isListItem) {
      if (parsed.key in currentItem) throw new FrontmatterParseError(`duplicate key ${parsed.key} in list item`, i + 1);
      currentItem[parsed.key] = parsed.value;
      continue;
    }
    if (data[parsed.key] !== undefined) throw new FrontmatterParseError(`duplicate key ${parsed.key}`, i + 1);
    data[parsed.key] = parsed.value;
    currentListKey = null;
    currentItem = null;
  }
  throw new FrontmatterParseError("unterminated frontmatter block", lines.length);
}
