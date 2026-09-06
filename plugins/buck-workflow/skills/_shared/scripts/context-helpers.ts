import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

// ---------- frontmatter parse (moved from import-context-memory.ts) ----------

/** Minimal YAML frontmatter split — body after first --- pair. */
export function splitFrontmatter(text: string): { yaml: string | null; body: string } {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return { yaml: null, body: text };
  }
  const nl = text.startsWith("---\r\n") ? "\r\n" : "\n";
  const close = text.indexOf(`${nl}---`, 4);
  if (close === -1) return { yaml: null, body: text };
  const yaml = text.slice(4, close).replace(/^\r?\n/, "");
  let body = text.slice(close + nl.length + 3);
  if (body.startsWith("\r\n")) body = body.slice(2);
  else if (body.startsWith("\n")) body = body.slice(1);
  return { yaml, body };
}

/** Tiny YAML subset for memory frontmatter (scalars + string arrays). */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  const flushList = () => {
    if (currentKey && currentList) result[currentKey] = currentList;
    currentKey = null;
    currentList = null;
  };

  for (const rawLine of yaml.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;

    const listItem = rawLine.match(/^\s+-\s+(.*)$/);
    if (listItem && currentList) {
      currentList.push(unquote(listItem[1].trim()));
      continue;
    }

    const kv = rawLine.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;

    flushList();
    const key = kv[1];
    const rest = kv[2].trim();
    if (rest === "" || rest === "|" || rest === ">") {
      currentKey = key;
      currentList = [];
      continue;
    }
    if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1).trim();
      result[key] = inner
        ? inner.split(",").map((s) => unquote(s.trim())).filter(Boolean)
        : [];
      continue;
    }
    result[key] = coerceScalar(unquote(rest));
  }
  flushList();
  return result;
}

export function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function coerceScalar(s: string): string | number | boolean | null {
  if (s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

export function extractTitle(body: string, fallback: string): string {
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return fallback;
}

export function readFrontmatter(text: string): {
  data: Record<string, unknown>;
  body: string;
  hadYaml: boolean;
} {
  const { yaml, body } = splitFrontmatter(text);
  if (yaml === null) return { data: {}, body, hadYaml: false };
  return { data: parseSimpleYaml(yaml), body, hadYaml: true };
}

// ---------- artifact classify / scan (moved from context-artifacts.mjs) ----------

export type ArtifactKind = "memory" | "subject-index" | "research" | "plan" | "backlog-item";

export interface ScannedArtifact {
  path: string;
  kind: ArtifactKind;
  frontmatter: Record<string, unknown>;
  errors: string[];
}

export interface ArtifactRegistryEntry {
  path: string;
  kind: ArtifactKind;
  subject: string;
  status: string;
  date: string;
  topics: string[];
  related: string[];
  errors: string[];
}

export interface SubjectIndexEntry {
  path: string;
  kind: string;
  subject: string;
  status: string;
  date: string;
  topics: string[];
  related: string[];
  informs: string[];
  artifacts: string[];
}

export interface MemoryIndexEntry {
  path: string;
  kind: string;
  date: string;
  domains: string[];
  topics: string[];
  subject: string;
  artifacts: string[];
  related: string[];
  priority: string;
  status: string;
}

export interface BacklogIndexEntry {
  path: string;
  kind: string;
  title: string;
  status: string;
  priority: string;
  created: string;
  updated: string;
  completed: string | null;
  related: string[];
}

export interface ContextIndexes {
  subjects: SubjectIndexEntry[];
  memory: MemoryIndexEntry[];
  backlog: BacklogIndexEntry[];
  artifacts: ArtifactRegistryEntry[];
}

const SCHEMAS: Record<ArtifactKind, { required: string[]; enums: Record<string, string[]> }> = {
  memory: {
    required: ["date", "domains", "topics", "related", "priority", "status"],
    enums: {
      priority: ["high", "medium", "low"],
      status: ["active", "completed", "superseded"],
    },
  },
  "subject-index": {
    required: ["status", "date", "subject"],
    enums: {
      status: ["active", "completed", "superseded", "draft"],
    },
  },
  research: {
    required: ["status", "date", "subject", "topics", "informs"],
    enums: {
      status: ["active", "completed", "superseded", "draft"],
    },
  },
  plan: {
    required: ["status", "date", "subject", "topics", "research", "memory"],
    enums: {
      status: ["active", "completed", "superseded", "draft"],
    },
  },
  "backlog-item": {
    required: ["title", "status", "priority", "created", "updated", "completed", "related"],
    enums: {
      priority: ["high", "medium", "low"],
      status: ["active", "completed"],
    },
  },
};

export function classifyArtifact(path: string): ArtifactKind | null {
  const normalized = path.replace(/\\/g, "/");
  const marker = "/.context/";
  const idx = normalized.indexOf(marker);
  const rel = idx >= 0 ? normalized.slice(idx + marker.length) : normalized.replace(/^\.context\//, "");

  if (rel === "memory/index.md") return null;
  if (rel.startsWith("memory/")) return "memory";
  if (/^\d{4}-\d{2}-\d{2}\.[^/]+\/index\.md$/.test(rel)) return "subject-index";
  if (/^\d{4}-\d{2}-\d{2}\.[^/]+\/research-.*\.md$/.test(rel)) return "research";
  if (/^\d{4}-\d{2}-\d{2}\.[^/]+\/plan-.*\.md$/.test(rel)) return "plan";
  if (/^backlog\/items\/.*\.md$/.test(rel)) return "backlog-item";

  return null;
}

export function validateArtifact(frontmatter: Record<string, unknown>, kind: ArtifactKind): string[] {
  const schema = SCHEMAS[kind];
  const errors: string[] = [];

  for (const field of schema.required) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, field)) {
      errors.push(`${kind}: missing required field '${field}'`);
    }
  }

  for (const [field, allowed] of Object.entries(schema.enums)) {
    const value = frontmatter[field];
    if (value !== undefined && !allowed.includes(value as string)) {
      errors.push(`${kind}: '${field}' must be one of [${allowed.join(", ")}], got '${value}'`);
    }
  }

  return errors;
}

function toArray(value: unknown): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1).trim();
      return inner ? inner.split(",").map((item) => item.trim()).filter(Boolean) : [];
    }
    return [value];
  }
  return [String(value)];
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export function scanContextDir(root: string): ScannedArtifact[] {
  const contextDir = join(root, ".context");
  const artifacts: ScannedArtifact[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const kind = classifyArtifact(fullPath);
      if (!kind) {
        continue;
      }

      let frontmatter: Record<string, unknown> = {};
      let errors: string[] = [];

      try {
        const raw = readFileSync(fullPath, "utf-8");
        const parsed = readFrontmatter(raw);
        if (parsed.hadYaml) {
          frontmatter = parsed.data;
        }
        errors = validateArtifact(frontmatter, kind);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors = [`failed to read file: ${message}`];
      }

      artifacts.push({ path: fullPath, kind, frontmatter, errors });
    }
  }

  walk(contextDir);
  return artifacts;
}

export function generateIndexes(artifacts: ScannedArtifact[]): ContextIndexes {
  const subjects: SubjectIndexEntry[] = [];
  const memory: MemoryIndexEntry[] = [];
  const backlog: BacklogIndexEntry[] = [];
  const registry: ArtifactRegistryEntry[] = [];

  for (const artifact of artifacts) {
    const { path, kind, frontmatter, errors } = artifact;
    const relPath = relative(".", path);
    const subject = asString(frontmatter.subject);
    const status = asString(frontmatter.status);
    const date = asString(frontmatter.date || frontmatter.created);
    const topics = toArray(frontmatter.topics);
    const related = toArray(frontmatter.related);

    registry.push({
      path: relPath,
      kind,
      subject,
      status,
      date,
      topics,
      related,
      errors: [...errors],
    });

    if (kind === "subject-index") {
      subjects.push({
        path: relPath,
        kind,
        subject,
        status,
        date,
        topics,
        related,
        informs: toArray(frontmatter.informs),
        artifacts: toArray(frontmatter.artifacts),
      });
      continue;
    }

    if (kind === "memory") {
      memory.push({
        path: relPath,
        kind,
        date,
        domains: toArray(frontmatter.domains),
        topics,
        subject,
        artifacts: toArray(frontmatter.artifacts),
        related,
        priority: asString(frontmatter.priority),
        status,
      });
      continue;
    }

    if (kind === "backlog-item") {
      const completedRaw = frontmatter.completed;
      backlog.push({
        path: relPath,
        kind,
        title: asString(frontmatter.title),
        status,
        priority: asString(frontmatter.priority),
        created: asString(frontmatter.created),
        updated: asString(frontmatter.updated),
        completed: completedRaw === "null" || completedRaw == null ? null : asString(completedRaw),
        related,
      });
    }
  }

  subjects.sort((a, b) => a.subject.localeCompare(b.subject));
  memory.sort((a, b) => b.date.localeCompare(a.date));
  backlog.sort((a, b) => b.created.localeCompare(a.created));
  registry.sort((a, b) => a.path.localeCompare(b.path));

  return { subjects, memory, backlog, artifacts: registry };
}

export function writeIndexes(indexes: ContextIndexes, root = "."): void {
  const outputDir = join(root, ".context", "index");
  mkdirSync(outputDir, { recursive: true });

  for (const [name, data] of Object.entries(indexes)) {
    writeFileSync(join(outputDir, `${name}.json`), JSON.stringify(data, null, 2) + "\n", "utf-8");
  }
}

// ---------- subject / backlog / phase / goal ----------

export interface SubjectFolder {
  name: string;
  path: string;
  status: "draft" | "active" | "completed" | null;
}

export function readSubjectStatus(folder: string): SubjectFolder["status"] {
  let text: string;
  try {
    text = readFileSync(join(folder, "index.md"), "utf-8");
  } catch {
    return null;
  }
  const m = text.match(/^status:\s*["']?(draft|active|completed)["']?\s*$/m);
  return m ? (m[1] as SubjectFolder["status"]) : null;
}

export function listSubjectFolders(root: string): SubjectFolder[] {
  const contextDir = join(root, ".context");
  let names: string[] = [];
  try {
    names = readdirSync(contextDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}\./.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
  return names.map((name) => {
    const path = join(contextDir, name);
    return { name, path, status: readSubjectStatus(path) };
  });
}

export interface BacklogItem {
  checked: boolean;
  label: string;
  link: string;
  slug: string;
  trailer: string;
}

export interface BacklogTodo {
  heading: string | null;
  items: BacklogItem[];
}

export function parseBacklogTodo(text: string): { sections: BacklogTodo[]; raw: string } {
  const sections: BacklogTodo[] = [];
  let current: BacklogTodo = { heading: null, items: [] };

  const pushCurrent = () => {
    if (current.heading !== null || current.items.length > 0) sections.push(current);
  };

  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      pushCurrent();
      current = { heading: heading[1].trim(), items: [] };
      continue;
    }

    const item = line.match(/^- \[([ xX])\]\s+(.*)$/);
    if (!item) continue;

    const checked = item[1] !== " ";
    const rest = item[2];
    const linked = rest.match(/^\[([^\]]+)\]\(([^)]+)\)(?:\s+[—-]\s+(.*))?$/);
    if (linked) {
      current.items.push({
        checked,
        label: linked[1],
        link: linked[2],
        slug: basename(linked[2]).replace(/\.md$/, ""),
        trailer: linked[3] ?? "",
      });
    } else {
      current.items.push({
        checked,
        label: rest,
        link: "",
        slug: "",
        trailer: "",
      });
    }
  }
  pushCurrent();
  return { sections, raw: text };
}

export interface PhaseRow {
  phase: string;
  status: string;
  difficulty: string;
  file: string;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

export function parsePhaseSummaryTable(text: string): PhaseRow[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex(
    (line) => /\|/.test(line) && /Phase/i.test(line) && /Status/i.test(line) && /File/i.test(line),
  );
  if (headerIdx === -1) return [];

  const header = splitTableRow(lines[headerIdx]);
  const col = {
    phase: header.findIndex((cell) => /^phase$/i.test(cell)),
    status: header.findIndex((cell) => /^status$/i.test(cell)),
    difficulty: header.findIndex((cell) => /^difficulty$/i.test(cell)),
    file: header.findIndex((cell) => /^file$/i.test(cell)),
  };

  const rows: PhaseRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/\|/.test(line)) break;
    if (/^\|?\s*:?-{3,}/.test(line.trim())) continue;
    const cells = splitTableRow(line);
    if (cells.length < 2) continue;
    const fileCell = col.file >= 0 ? (cells[col.file] ?? "") : "";
    const linked = fileCell.match(/\[([^\]]+)\]\([^)]+\)/);
    rows.push({
      phase: col.phase >= 0 ? (cells[col.phase] ?? "") : "",
      status: col.status >= 0 ? (cells[col.status] ?? "") : "",
      difficulty: col.difficulty >= 0 ? (cells[col.difficulty] ?? "") : "",
      file: (linked ? linked[1] : fileCell).trim(),
    });
  }
  return rows;
}

export function phaseCriteriaAllChecked(frontmatter: Record<string, unknown>): boolean {
  const criteria = frontmatter.acceptance_criteria;
  if (!Array.isArray(criteria) || criteria.length === 0) return false;
  return criteria.every((entry) => String(entry).trimStart().startsWith("[x]"));
}

export function userGoalState(text: string): "present" | "waived" | "missing" {
  const match = text.match(/^## User Goal\s*$/m);
  if (!match || match.index === undefined) return "missing";
  const after = text.slice(match.index + match[0].length);
  const next = after.search(/\n##\s+/);
  const section = (next === -1 ? after : after.slice(0, next)).trim();
  if (!section) return "missing";
  const first = section.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  if (/^Technical chore\s+[—-]/.test(first)) return "waived";
  return "present";
}

// ---------- frontmatter write ----------

type ListStyle = "inline" | "block";

function serializeScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return String(value);
}

function serializeInlineArray(arr: unknown[]): string {
  if (arr.length === 0) return "[]";
  return `[${arr.map((item) => serializeScalar(item)).join(", ")}]`;
}

function serializeFieldLines(key: string, value: unknown, style: ListStyle): string[] {
  if (Array.isArray(value)) {
    if (style === "block" && value.length > 0) {
      return [`${key}:`, ...value.map((item) => `  - ${serializeScalar(item)}`)];
    }
    return [`${key}: ${serializeInlineArray(value)}`];
  }
  return [`${key}: ${serializeScalar(value)}`];
}

function detectListStyle(rest: string): ListStyle {
  const trimmed = rest.trim();
  if (trimmed === "" || trimmed === "|" || trimmed === ">") return "block";
  return "inline";
}

function consumeField(lines: string[], start: number): number {
  const kv = lines[start].match(/^([A-Za-z0-9_]+):\s*(.*)$/);
  if (!kv) return start + 1;
  const rest = kv[2].trim();
  if (rest === "" || rest === "|" || rest === ">") {
    let j = start + 1;
    while (j < lines.length && /^\s+-\s+/.test(lines[j])) j++;
    return j;
  }
  return start + 1;
}

function reconstructDocument(yamlLines: string[], body: string): string {
  const yaml = yamlLines.join("\n").replace(/\n+$/, "");
  const bodyPart = body.startsWith("\n") ? body : `\n${body}`;
  return `---\n${yaml}\n---${bodyPart}`;
}

export function setFrontmatterFields(text: string, fields: Record<string, unknown>): string {
  const { yaml, body, hadYaml } = (() => {
    const split = splitFrontmatter(text);
    return { ...split, hadYaml: split.yaml !== null };
  })();

  if (!hadYaml || yaml === null) {
    const created = Object.entries(fields).flatMap(([key, value]) =>
      serializeFieldLines(key, value, "inline"),
    );
    return reconstructDocument(created, text);
  }

  const lines = yaml.split(/\r?\n/);
  const out: string[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < lines.length) {
    const kv = lines[i].match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const key = kv[1];
    const end = consumeField(lines, i);
    if (key in fields) {
      out.push(...serializeFieldLines(key, fields[key], detectListStyle(kv[2])));
      seen.add(key);
    } else {
      out.push(...lines.slice(i, end));
    }
    i = end;
  }
  for (const [key, value] of Object.entries(fields)) {
    if (!seen.has(key)) {
      out.push(...serializeFieldLines(key, value, "inline"));
    }
  }
  return reconstructDocument(out, body);
}

export function appendFrontmatterListItem(text: string, key: string, value: string): string {
  const { yaml, body } = splitFrontmatter(text);
  if (yaml === null) {
    return setFrontmatterFields(text, { [key]: [value] });
  }

  const data = parseSimpleYaml(yaml);
  const existing = data[key];
  if (Array.isArray(existing) && existing.map(String).includes(value)) return text;
  if (existing === value) return text;

  const lines = yaml.split(/\r?\n/);
  const out: string[] = [];
  let found = false;
  let i = 0;
  while (i < lines.length) {
    const kv = lines[i].match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv || kv[1] !== key) {
      out.push(lines[i]);
      i++;
      continue;
    }
    found = true;
    const style = detectListStyle(kv[2]);
    const end = consumeField(lines, i);
    const current = toArray(existing);
    current.push(value);
    out.push(...serializeFieldLines(key, current, style));
    i = end;
  }
  if (!found) {
    out.push(...serializeFieldLines(key, [value], "inline"));
  }
  return reconstructDocument(out, body);
}

export function planMemoryRefStyle(text: string): "yaml" | "bold-line" | "none" {
  const parsed = readFrontmatter(text);
  if (parsed.hadYaml && Object.prototype.hasOwnProperty.call(parsed.data, "memory")) {
    return "yaml";
  }
  if (/^\*\*memory:\*\*/m.test(text)) return "bold-line";
  return "none";
}
