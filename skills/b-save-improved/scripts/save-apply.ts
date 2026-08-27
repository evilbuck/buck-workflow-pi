#!/usr/bin/env bun
import { basename, dirname, join } from "node:path";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync,
} from "node:fs";
import {
  readFrontmatter, setFrontmatterFields, appendFrontmatterListItem, planMemoryRefStyle, extractTitle,
} from "../../_shared/scripts/context-helpers.js";
declare const Bun: { stdin: { text(): Promise<string> } };

type Applied = { path: string; action: "created" | "updated" | "moved" | "skipped"; reason: string };
type Report = { applied: Applied[]; staged_inferred: unknown[]; errors: string[]; error?: string };
type AnyRecord = Record<string, any>;

const dryRun = process.argv.includes("--dry-run");
const archiveInferred = process.argv.includes("--archive-inferred");
const report: Report = { applied: [], staged_inferred: [], errors: [] };
const cwd = () => process.cwd();
const absolute = (path: string) => join(cwd(), path);

function missingSubject(payload: AnyRecord): string | null {
  if (!payload.subject || typeof payload.subject.name !== "string" || typeof payload.subject.path !== "string") {
    return "subject.name and subject.path are required";
  }
  return null;
}

function missingMemory(payload: AnyRecord): string | null {
  if (!payload.memory || typeof payload.memory.path !== "string" || !payload.memory.frontmatter || typeof payload.memory.title !== "string" || typeof payload.memory.body !== "string") {
    return "memory path, frontmatter, title, and body are required";
  }
  return null;
}

function missingIndex(payload: AnyRecord): string | null {
  if (!payload.index_entry || typeof payload.index_entry.summary !== "string" || typeof payload.index_entry.status !== "string") {
    return "index_entry summary and status are required";
  }
  return null;
}

function required(payload: AnyRecord): string | null {
  if (!payload || typeof payload !== "object") return "payload must be an object";
  if (typeof payload.today !== "string") return "today is required";
  return missingSubject(payload) ?? missingMemory(payload) ?? missingIndex(payload);
}

function record(path: string, action: Applied["action"], reason: string): void {
  report.applied.push({ path, action, reason });
}

function mutate(path: string, content: string, reason: string): void {
  const full = absolute(path);
  const action = existsSync(full) ? "updated" : "created";
  if (!dryRun) {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  record(path, action, reason);
}

function yamlScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" && (/[:#\[\]{},]|^\s|\s$/.test(value))) return JSON.stringify(value);
  return String(value);
}
function inline(values: unknown): string {
  return `[${(Array.isArray(values) ? values : []).map(yamlScalar).join(", ")}]`;
}
function block(key: string, values: unknown): string[] {
  const list = Array.isArray(values) ? values : [];
  return list.length ? [`${key}:`, ...list.map((x) => `  - ${yamlScalar(x)}`)] : [`${key}: []`];
}
function union(...values: unknown[]): string[] {
  return [...new Set(values.flatMap((v) => Array.isArray(v) ? v.map(String) : []))];
}

function memoryDocument(frontmatter: AnyRecord, title: string, body: string): string {
  const lines = [
    "---", `date: ${yamlScalar(frontmatter.date)}`, `domains: ${inline(frontmatter.domains)}`,
    `topics: ${inline(frontmatter.topics)}`, `subject: ${yamlScalar(frontmatter.subject)}`,
    ...block("artifacts", frontmatter.artifacts), ...block("related", frontmatter.related),
    `priority: ${yamlScalar(frontmatter.priority)}`, `status: ${yamlScalar(frontmatter.status)}`, "---", "", `# ${title}`, "", body.trim(), "",
  ];
  return lines.join("\n");
}

function applyMemory(payload: AnyRecord): AnyRecord {
  const fm = { ...payload.memory.frontmatter };
  fm.artifacts = union(fm.artifacts, payload.iterates_complete.map((x: AnyRecord) => basename(x.path)));
  const full = absolute(payload.memory.path);
  if (!existsSync(full)) {
    mutate(payload.memory.path, memoryDocument(fm, payload.memory.title, payload.memory.body), "write session memory");
    return fm;
  }
  const old = readFileSync(full, "utf8");
  const parsed = readFrontmatter(old);
  for (const key of ["domains", "topics", "artifacts", "related"]) fm[key] = union(parsed.data[key], fm[key]);
  const title = extractTitle(parsed.body, payload.memory.title);
  const priorBody = parsed.body.replace(/^\s*# .*\r?\n?/, "").trim();
  const updateHeading = `## ${payload.today} update`;
  const addition = `${updateHeading}\n\n${payload.memory.body.trim()}`;
  const body = priorBody.includes(addition) ? priorBody : `${priorBody}\n\n${addition}`.trim();
  mutate(payload.memory.path, memoryDocument(fm, title, body), "merge session memory");
  return fm;
}

function applyIndex(payload: AnyRecord, fm: AnyRecord): void {
  const indexPath = ".context/memory/index.md";
  const old = existsSync(absolute(indexPath)) ? readFileSync(absolute(indexPath), "utf8") : "";
  const file = basename(payload.memory.path);
  if (old.split(/\r?\n/, 1)[0]?.includes(`](${file})`)) return;
  const entry = `- ${payload.today} — [${payload.index_entry.summary}](${file}) — \`${payload.index_entry.status}\`\n\n  - ${payload.today} | \`${file}\` | domains: ${inline(fm.domains)} | topics: ${inline(fm.topics)} | status: ${payload.index_entry.status}\n\n`;
  mutate(indexPath, entry + old, "prepend normalized memory index entry");
}

function applyCrossrefs(payload: AnyRecord): void {
  for (const ref of payload.crossrefs) {
    const full = absolute(ref.path);
    const old = readFileSync(full, "utf8");
    const style = planMemoryRefStyle(old);
    let next = old;
    if (style === "yaml") next = appendFrontmatterListItem(old, ref.key, ref.value);
    else if (style === "bold-line") {
      if (!old.includes(ref.value)) next = old.replace(/^(\*\*memory:\*\*[^\r\n]*)/m, `$1, [${ref.value}](${ref.value})`);
    } else next = appendFrontmatterListItem(old, ref.key, ref.value);
    if (next !== old) mutate(ref.path, next, "add memory cross-reference");
  }
}

function archiveItem(payload: AnyRecord, item: AnyRecord): void {
  const todoPath = ".context/backlog/todo.md";
  const itemPath = `.context/backlog/items/${item.slug}.md`;
  const source = absolute(itemPath);
  if (!existsSync(source)) throw new Error(`backlog item missing: ${itemPath}`);
  const original = readFileSync(source, "utf8");
  const title = String(readFrontmatter(original).data.title ?? extractTitle(readFrontmatter(original).body, item.slug));
  const rewritten = setFrontmatterFields(original, { status: "completed", completed: payload.today, updated: payload.today });
  const archivePath = `.context/backlog/archive/${payload.today.slice(0, 7)}/${item.slug}.md`;
  const todo = existsSync(absolute(todoPath)) ? readFileSync(absolute(todoPath), "utf8") : "";
  const nextTodo = todo.split(/(?<=\n)/).filter((line) => !(line.startsWith("- [ ]") && line.includes(`items/${item.slug}.md`))).join("");
  if (nextTodo !== todo) mutate(todoPath, nextTodo, `remove completed backlog item ${item.slug}`);
  if (!dryRun) {
    mkdirSync(dirname(absolute(archivePath)), { recursive: true });
    writeFileSync(source, rewritten);
    renameSync(source, absolute(archivePath));
  }
  record(archivePath, "moved", `archive completed backlog item ${item.slug}`);
  const completedPath = ".context/backlog/archive/completed.md";
  const completed = existsSync(absolute(completedPath)) ? readFileSync(absolute(completedPath), "utf8") : "";
  const line = `- [x] ${title} (${payload.today}) — \`${payload.subject.name}/index.md\`. ${item.outcome}`;
  if (!completed.includes(line)) mutate(completedPath, `${completed.replace(/\s*$/, "")}\n\n${line}\n`, `log completed backlog item ${item.slug}`);
}

function newBacklogItem(payload: AnyRecord, item: AnyRecord): void {
  const path = `.context/backlog/items/${item.slug}.md`;
  const related = block("related", item.related);
  const text = ["---", `title: ${yamlScalar(item.title)}`, "status: active", `priority: ${yamlScalar(item.priority)}`, `created: ${payload.today}`, `updated: ${payload.today}`, "completed: null", ...related, "---", "", `# ${item.title}`, "", String(item.body ?? "").trim(), ""].join("\n");
  mutate(path, text, `create backlog item ${item.slug}`);
  const todoPath = ".context/backlog/todo.md";
  const old = existsSync(absolute(todoPath)) ? readFileSync(absolute(todoPath), "utf8") : "# Backlog\n\n";
  const line = `- [ ] [${item.title}](items/${item.slug}.md) — ${item.priority} priority`;
  if (!old.includes(`items/${item.slug}.md`)) {
    const match = old.match(/^# Backlog\r?\n(?:\r?\n)?/);
    const at = match ? match[0].length : 0;
    mutate(todoPath, old.slice(0, at) + line + "\n" + old.slice(at), `add ${item.slug} to backlog`);
  }
}

function updateFile(path: string, fields: AnyRecord, reason: string): void {
  const old = readFileSync(absolute(path), "utf8");
  const next = setFrontmatterFields(old, fields);
  if (next !== old) mutate(path, next, reason);
}

function fixPhaseTables(payload: AnyRecord): void {
  if (!payload.phase_table_fixes.length) return;
  const folder = absolute(payload.subject.path);
  const overview = existsSync(folder) ? readdirSync(folder).find((x) => /phases\.md$/.test(x)) : undefined;
  if (!overview) throw new Error("phase overview not found");
  const path = join(payload.subject.path, overview);
  let text = readFileSync(absolute(path), "utf8");
  for (const fix of payload.phase_table_fixes) {
    text = text.split("\n").map((line) => {
      if (!line.includes(`[${fix.file}](${fix.file})`)) return line;
      const cells = line.split("|");
      if (cells.length < 6) return line;
      const old = cells[2];
      const lead = old.match(/^\s*/)?.[0] ?? "";
      const trail = old.match(/\s*$/)?.[0] ?? "";
      cells[2] = `${lead}${fix.status}${trail}`;
      return cells.join("|");
    }).join("\n");
  }
  mutate(path, text, "repair phase summary status");
}

function subjectFile(payload: AnyRecord, name: string): string {
  return name.startsWith(".context/") ? name : join(payload.subject.path, name);
}

function applyIterates(payload: AnyRecord): void {
  for (const iterate of payload.iterates_complete) {
    updateFile(subjectFile(payload, iterate.path), { status: "completed", completed: payload.today }, "complete iterate artifact");
    if (!iterate.addresses) continue;
    const planPath = subjectFile(payload, iterate.addresses);
    const old = readFileSync(absolute(planPath), "utf8");
    const next = appendFrontmatterListItem(old, "iterations", basename(iterate.path));
    if (next !== old) mutate(planPath, next, "link completed iterate");
  }
}

function applyBacklog(payload: AnyRecord): void {
  for (const item of payload.backlog.complete_explicit) archiveItem(payload, item);
  if (archiveInferred) {
    for (const item of payload.backlog.complete_inferred) archiveItem(payload, item);
  } else {
    report.staged_inferred.push(...payload.backlog.complete_inferred);
  }
  for (const item of payload.backlog.new_items) newBacklogItem(payload, item);
}

function applyStatuses(payload: AnyRecord): void {
  for (const path of payload.specs_complete) updateFile(subjectFile(payload, path), { status: "completed" }, "complete spec");
  for (const path of payload.phases_complete) {
    updateFile(join(payload.subject.path, path), { status: "completed", completed_at: `"${payload.today}"` }, "complete phase");
  }
  fixPhaseTables(payload);
  if (payload.subject.create || !payload.subject_index_status) return;
  const path = join(payload.subject.path, "index.md");
  const data = readFrontmatter(readFileSync(absolute(path), "utf8")).data;
  if (data.status !== payload.subject_index_status) updateFile(path, { status: payload.subject_index_status }, "update subject status");
}

function applyLoose(payload: AnyRecord): void {
  for (const loose of payload.loose_artifacts) {
    const destination = join(payload.subject.path, basename(loose));
    if (existsSync(absolute(destination))) {
      record(loose, "skipped", `destination exists: ${destination}`);
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(absolute(destination)), { recursive: true });
      renameSync(absolute(loose), absolute(destination));
    }
    record(destination, "moved", `consolidate loose artifact ${loose}`);
  }
}

function applyAll(payload: AnyRecord): void {
  if (payload.subject.create) {
    if (!dryRun) mkdirSync(absolute(payload.subject.path), { recursive: true });
    const index = `---\nstatus: ${payload.subject_index_status ?? "active"}\ndate: ${payload.today}\nsubject: ${payload.subject.name}\n---\n`;
    mutate(join(payload.subject.path, "index.md"), index, "create subject index");
  }
  applyIterates(payload);
  const fm = applyMemory(payload);
  applyIndex(payload, fm);
  applyCrossrefs(payload);
  applyBacklog(payload);
  applyStatuses(payload);
  applyLoose(payload);
}

function ensureArray(target: AnyRecord, key: string): void {
  if (!Array.isArray(target[key])) target[key] = [];
}

function defaults(payload: AnyRecord): void {
  if (!payload.backlog || typeof payload.backlog !== "object") payload.backlog = {};
  ensureArray(payload, "crossrefs");
  ensureArray(payload.backlog, "complete_explicit");
  ensureArray(payload.backlog, "complete_inferred");
  ensureArray(payload.backlog, "new_items");
  ensureArray(payload, "specs_complete");
  ensureArray(payload, "phases_complete");
  ensureArray(payload, "phase_table_fixes");
  ensureArray(payload, "iterates_complete");
  ensureArray(payload, "loose_artifacts");
}

function failSchema(message: string): number {
  report.error = message;
  report.errors.push(message);
  console.log(JSON.stringify(report));
  return 2;
}

export function runApply(payload: AnyRecord): number {
  report.applied = [];
  report.staged_inferred = [];
  report.errors = [];
  delete report.error;
  const invalid = required(payload);
  if (invalid) return failSchema(invalid);
  defaults(payload);
  try { applyAll(payload); }
  catch (error) { report.errors.push(error instanceof Error ? error.message : String(error)); }
  console.log(JSON.stringify(report));
  return report.errors.length ? 1 : 0;
}

async function main(): Promise<number> {
  try {
    return runApply(JSON.parse(await Bun.stdin.text()));
  } catch {
    return failSchema("invalid JSON payload");
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
