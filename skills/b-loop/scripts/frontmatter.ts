/**
 * Zero-dependency Markdown frontmatter, YAML inline comment/array,
 * acceptance checkbox, and OMP tool payload helpers for `/b-loop`.
 */

/** Strip balanced outer quotes (requiring at least two characters). */
export function stripOuterQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

interface QuoteCursor {
  quote: '"' | "'" | null;
  escaped: boolean;
}

function stepQuoteCursor(cursor: QuoteCursor, ch: string): boolean {
  if (cursor.escaped) {
    cursor.escaped = false;
    return true;
  }
  if (cursor.quote === '"' && ch === "\\") {
    cursor.escaped = true;
    return true;
  }
  if (ch === '"' || ch === "'") {
    if (cursor.quote === ch) cursor.quote = null;
    else if (cursor.quote === null) cursor.quote = ch;
    return false;
  }
  return false;
}

/** Strip an unquoted `# ...` YAML comment at start of line or after whitespace. */
export function stripInlineComment(line: string): string {
  const cursor: QuoteCursor = { quote: null, escaped: false };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (stepQuoteCursor(cursor, ch)) continue;
    const isCommentStart = ch === "#" && cursor.quote === null && (i === 0 || /\s/.test(line[i - 1]));
    if (isCommentStart) return line.slice(0, i).trimEnd();
  }
  return line;
}

/** Split an inline YAML `[...]` body by comma while respecting quoted strings. */
export function splitInlineArray(inner: string): string[] {
  const items: string[] = [];
  const cursor: QuoteCursor = { quote: null, escaped: false };
  let current = "";

  for (const ch of inner) {
    const wasEscaped = cursor.escaped;
    stepQuoteCursor(cursor, ch);
    if (!wasEscaped && ch === "," && cursor.quote === null) {
      const cleaned = stripOuterQuotes(current.trim());
      if (cleaned) items.push(cleaned);
      current = "";
      continue;
    }
    current += ch;
  }

  const tail = stripOuterQuotes(current.trim());
  if (tail) items.push(tail);
  return items;
}

/** Parse a scalar or inline-list YAML value after comment stripping. */
export function parseScalarValue(raw: string): unknown {
  const trimmed = stripInlineComment(raw).trim();
  if (trimmed === "null" || trimmed === "~") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return splitInlineArray(trimmed.slice(1, -1));
  }
  return stripOuterQuotes(trimmed);
}

interface YamlParseState {
  result: Record<string, unknown>;
  currentKey: string;
  inList: boolean;
  listItems: string[];
}

function flushPendingList(state: YamlParseState): void {
  if (!state.inList || !state.currentKey) return;
  state.result[state.currentKey] = state.listItems;
  state.inList = false;
  state.currentKey = "";
  state.listItems = [];
}

function processFrontmatterLine(state: YamlParseState, line: string): void {
  const cleaned = stripInlineComment(line);
  const trimmed = cleaned.trim();
  if (!trimmed) return;

  const listMatch = /^\s*-\s+(.*)$/.exec(cleaned);
  if (listMatch && state.inList) {
    state.listItems.push(stripOuterQuotes(listMatch[1].trim()));
    return;
  }

  flushPendingList(state);

  const keyVal = /^([\w-]+)\s*:\s*(.*)$/.exec(cleaned);
  if (!keyVal) return;

  const key = keyVal[1];
  const rawVal = keyVal[2].trim();
  if (!rawVal) {
    state.currentKey = key;
    state.inList = true;
    state.listItems = [];
    return;
  }
  state.result[key] = parseScalarValue(rawVal);
}

/** Parse YAML frontmatter block without external YAML packages. */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) return {};

  const state: YamlParseState = {
    result: {},
    currentKey: "",
    inList: false,
    listItems: [],
  };
  for (const line of match[1].split(/\r?\n/)) {
    processFrontmatterLine(state, line);
  }
  flushPendingList(state);
  return state.result;
}

/** Count acceptance criteria checkboxes from an already-parsed frontmatter value. */
export function countAcceptanceCriteria(rawList: unknown): {
  total: number;
  checked: number;
  items: string[];
} {
  const items = Array.isArray(rawList)
    ? rawList.filter((x): x is string => typeof x === "string")
    : [];
  const checked = items.filter((item) => /^\s*(?:[-*]\s*)?\[[xX]\]/.test(item)).length;
  return { total: items.length, checked, items };
}

/** Extract acceptance criteria list and checked checkbox counts from Markdown frontmatter. */
export function parseAcceptanceCriteria(content: string): {
  total: number;
  checked: number;
  items: string[];
} {
  return countAcceptanceCriteria(parseFrontmatter(content).acceptance_criteria);
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractTextBlock(content: unknown[]): string | undefined {
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (rec.type === "text" && typeof rec.text === "string") return rec.text;
  }
  return undefined;
}

/** Normalize OMP `tool.<name>()` results and surface `isError: true` responses as thrown errors. */
export function unwrapToolResult(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw === "string") return tryParseJson(raw);
  if (typeof raw !== "object") return raw;

  const obj = raw as Record<string, unknown>;
  const text = Array.isArray(obj.content) ? extractTextBlock(obj.content) : undefined;
  if (obj.isError === true) {
    throw new Error(text?.trim() || "Workflow tool returned an error");
  }
  if (obj.details !== undefined) return obj.details;
  if (text !== undefined) return tryParseJson(text);
  return raw;
}
