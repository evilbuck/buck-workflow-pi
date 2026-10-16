#!/usr/bin/env bun
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  existsSync as fileExistsSync, lstatSync, mkdirSync, readFileSync as fileReadSync, realpathSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import {
  readFrontmatter, setFrontmatterFields, appendFrontmatterListItem, planMemoryRefStyle, extractTitle,
} from "../../_shared/scripts/context-helpers.js";
import {
  applySubjectLifecycleTexts,
  inspectSubjectLifecycleTexts,
  type SubjectLifecycleResult,
} from "../../_shared/scripts/subject-lifecycle.js";
import { readSaveSources } from "./save-preflight.js";
import { classifyContextPath, consumerKey, type ConsumerScope } from "../../_shared/storage/consumers.js";
import type { ArtifactKey, ArtifactRevision, StorageStore } from "../../_shared/storage/contract.js";
import { completeSaveAttempt, loadSaveAttempt, prepareSaveAttempt, recordSaveMetadata, resumeSaveMetadata, saveSqlFacts, verifySqlSave, withSaveStore, type SaveAttempt, type SaveStoreDeps } from "../../../extensions/buck-loop/sql-save.js";
import { randomUUID } from "node:crypto";
import { revisionHash } from "../../_shared/storage/adapter-utils.js";
declare const Bun: { stdin: { text(): Promise<string> } };

type Applied = { path: string; action: "created" | "updated" | "moved" | "skipped"; reason: string };
type Report = { applied: Applied[]; staged_inferred: unknown[]; errors: string[]; error?: string; lifecycle?: SubjectLifecycleResult; run_id?: string };
type AnyRecord = Record<string, any>;

const dryRun = process.argv.includes("--dry-run");
const archiveInferred = process.argv.includes("--archive-inferred");
const report: Report = { applied: [], staged_inferred: [], errors: [] };
const pendingWrites = new Map<string, string>();
const sourceArtifacts = new Map<string, ArtifactRevision>();
const removedSources = new Set<string>();
const movedFrom = new Map<string, string>();
let authoritative = false;
let saveAttempt: SaveAttempt | null = null;

function existsSync(path: string): boolean {
  const rel = relative(cwd(), resolve(path)).split(sep).join("/");
  if (!authoritative || !rel.startsWith(".context/")) return fileExistsSync(path);
  return !removedSources.has(rel) && (pendingWrites.has(rel) || sourceArtifacts.has(rel)
    || [...sourceArtifacts.keys(), ...pendingWrites.keys()].some(name => name.startsWith(`${rel}/`)));
}
function readFileSync(path: string, encoding: "utf8"): string {
  const rel = relative(cwd(), resolve(path)).split(sep).join("/");
  if (!authoritative || !rel.startsWith(".context/")) return fileReadSync(path, encoding);
  const content = pendingWrites.get(rel) ?? (sourceArtifacts.has(rel) ? new TextDecoder().decode(sourceArtifacts.get(rel)!.bytes) : undefined);
  if (content === undefined || removedSources.has(rel)) throw new Error(`Artifact not in selected storage: ${rel}`);
  return content;
}
function sqlMemoryMode(): boolean {
  return Boolean(process.env.SQL_MEMORY_URL);
}
const cwd = () => process.cwd();
const BACKLOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isBacklogSlug(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80 && BACKLOG_SLUG.test(value);
}

function pathEscapesRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

function lexists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function rejectIfEscapes(root: string, candidate: string, path: string): string {
  if (pathEscapesRoot(root, candidate)) throw new Error(`path escapes .context: ${path}`);
  return candidate;
}

function containedContextPath(path: string): string {
  const root = resolve(cwd(), ".context");
  const full = resolve(cwd(), path);
  rejectIfEscapes(root, full, path);
  const rootCanon = lexists(root) ? realpathSync(root) : root;
  if (lexists(full)) {
    if (lstatSync(full).isSymbolicLink()) throw new Error(`path escapes .context: ${path}`);
    return rejectIfEscapes(rootCanon, realpathSync(full), path);
  }
  let ancestor = full;
  while (!lexists(ancestor)) ancestor = dirname(ancestor);
  const candidate = resolve(realpathSync(ancestor), relative(ancestor, full));
  return rejectIfEscapes(rootCanon, candidate, path);
}

function containedUnder(rootRel: string, path: string): string {
  const full = containedContextPath(path);
  if (pathEscapesRoot(resolve(cwd(), rootRel), full)) throw new Error(`path escapes ${rootRel}: ${path}`);
  return full;
}


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
  return sqlMemoryMode() ? requiredSql(payload) : requiredFile(payload);
}

function requiredSql(payload: AnyRecord): string | null {
  const subject = missingSubject(payload);
  if (subject) return subject;
  return dryRun ? null : missingSqlReceipt(payload);
}

function requiredFile(payload: AnyRecord): string | null {
  return missingSubject(payload) ?? missingMemory(payload) ?? missingIndex(payload);
}

function missingSqlReceipt(payload: AnyRecord): string | null {
  const receipt = payload.sql_receipt;
  return !receipt || typeof receipt.path !== "string" || !Array.isArray(receipt.ids)
    ? "verified SQL receipt is required" : null;
}

function record(path: string, action: Applied["action"], reason: string): void {
  report.applied.push({ path, action, reason });
}

function mutate(path: string, content: string, reason: string): void {
  if (removedSources.has(path)) {
    record(path, "skipped", "source deletion requested");
    return;
  }
  const full = containedContextPath(path);
  const action = existsSync(full) ? "updated" : "created";
  if (!dryRun) {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    pendingWrites.set(path, content);
  }
  record(path, action, reason);
}

function yamlScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" && (/[:#\[\]{},\r\n]|^\s|\s$/.test(value))) return JSON.stringify(value);
  return String(value);
}
function inline(values: unknown): string {
  return `[${(Array.isArray(values) ? values : []).map(yamlScalar).join(", ")}]`;
}
function block(key: string, values: unknown): string[] {
  const list = Array.isArray(values) ? values : [];
  return list.length ? [`${key}:`, ...list.map((x) => `  - ${yamlScalar(x)}`)] : [`${key}: []`];
}
function asStringList(value: unknown): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}
function union(...values: unknown[]): string[] {
  return [...new Set(values.flatMap(asStringList))];
}

function evidenceLines(items: AnyRecord[]): string[] {
  return items
    .filter((x) => x && typeof x === "object" && typeof x.path === "string" && typeof x.evidence === "string" && x.path.trim() && x.evidence.trim())
    .map((x) => `- \`${x.path.trim()}\` — ${x.evidence.trim().replace(/\s+/g, " ")}`);
}

function appendVerificationEvidence(body: string, lines: string[]): string {
  const missing = lines.filter((line) => !body.includes(line));
  if (!missing.length) return body;
  const headings = [...body.matchAll(/^## Verification[ \t]*$/gm)];
  if (!headings.length) {
    return `${body.replace(/\s+$/, "")}\n\n## Verification\n\n${missing.join("\n")}`;
  }
  const at = headings[headings.length - 1];
  const headEnd = (at.index ?? 0) + at[0].length;
  const after = body.slice(headEnd);
  const next = after.match(/^## [^\n]*$/m);
  const chunk = (next ? after.slice(0, next.index) : after).trim();
  const inserted = `\n\n${[chunk, missing.join("\n")].filter(Boolean).join("\n\n")}\n\n`;
  return `${body.slice(0, headEnd)}${inserted}${next ? after.slice(next.index) : ""}`;
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
  const fm = { ...(payload.memory?.frontmatter ?? {}) };
  fm.artifacts = union(fm.artifacts, payload.iterates_complete.map((x: AnyRecord) => basename(x.path)));
  if (sqlMemoryMode()) return fm;
  payload.memory.body = appendVerificationEvidence(String(payload.memory.body ?? ""), evidenceLines(payload.verification_evidence));
  const full = containedContextPath(payload.memory.path);
  if (!existsSync(full)) {
    mutate(payload.memory.path, memoryDocument(fm, payload.memory.title, payload.memory.body), "write session memory");
    return fm;
  }
  const old = readFileSync(full, "utf8");
  const parsed = readFrontmatter(old);
  for (const key of ["domains", "topics", "artifacts", "related"]) fm[key] = union(parsed.data[key], fm[key]);
  const title = extractTitle(parsed.body, payload.memory.title);
  const priorBody = parsed.body.replace(/^\s*# .*\r?\n?/, "").trim();
  const nextBody = payload.memory.body.trim();
  const updateHeading = `## ${payload.today} update`;
  const addition = `${updateHeading}\n\n${nextBody}`;
  const body = priorBody.includes(addition) || priorBody.includes(nextBody) ? priorBody : `${priorBody}\n\n${addition}`.trim();
  mutate(payload.memory.path, memoryDocument(fm, title, body), "merge session memory");
  return fm;
}

function applyIndex(payload: AnyRecord, fm: AnyRecord): void {
  if (sqlMemoryMode()) return;
  const indexPath = ".context/memory/index.md";
  const full = containedContextPath(indexPath);
  const old = existsSync(full) ? readFileSync(full, "utf8") : "";
  const file = basename(payload.memory.path);
  if (old.includes(`](${file})`)) return;
  const entry = `- ${payload.today} — [${payload.index_entry.summary}](${file}) — \`${payload.index_entry.status}\`\n\n  - ${payload.today} | \`${file}\` | domains: ${inline(fm.domains)} | topics: ${inline(fm.topics)} | status: ${payload.index_entry.status}\n\n`;
  mutate(indexPath, entry + old, "prepend normalized memory index entry");
}

function applyCrossrefs(payload: AnyRecord): void {
  for (const ref of payload.crossrefs) {
    if (removedSources.has(ref.path)) continue;
    const full = containedContextPath(ref.path);
    const old = readFileSync(full, "utf8");
    const style = planMemoryRefStyle(old);
    let next = old;
    if (ref.key !== "memory" || style !== "bold-line") {
      next = appendFrontmatterListItem(old, ref.key, ref.value);
    } else if (!old.includes(ref.value)) {
      next = old.replace(/^(\*\*memory:\*\*[^\r\n]*)/m, `$1, [${ref.value}](${ref.value})`);
    }
    if (next !== old) mutate(ref.path, next, "add memory cross-reference");
  }
}

function applySpecPlans(payload: AnyRecord): void {
  for (const ref of payload.spec_plans) {
    const path = subjectFile(payload, ref.spec);
    const full = containedContextPath(path);
    if (!existsSync(full)) {
      record(ref.spec, "skipped", "spec file not found");
      continue;
    }
    const old = readFileSync(full, "utf8");
    const next = appendFrontmatterListItem(old, "plans", ref.plan);
    if (next !== old) mutate(path, next, "link plan from spec");
  }
}

function archiveItem(payload: AnyRecord, item: AnyRecord): void {
  if (!isBacklogSlug(item.slug)) throw new Error(`invalid backlog slug: ${String(item.slug)}`);
  const todoPath = ".context/backlog/todo.md";
  const itemPath = `.context/backlog/items/${item.slug}.md`;
  const source = containedUnder(".context/backlog/items", itemPath);
  if (!existsSync(source)) throw new Error(`backlog item missing: ${itemPath}`);
  const original = readFileSync(source, "utf8");
  const title = String(readFrontmatter(original).data.title ?? extractTitle(readFrontmatter(original).body, item.slug));
  const rewritten = setFrontmatterFields(original, { status: "completed", completed: payload.today, updated: payload.today });
  const archivePath = `.context/backlog/archive/${payload.today.slice(0, 7)}/${item.slug}.md`;
  const destination = containedUnder(".context/backlog/archive", archivePath);
  const todo = existsSync(containedContextPath(todoPath)) ? readFileSync(containedContextPath(todoPath), "utf8") : "";
  const nextTodo = todo.split(/(?<=\n)/).filter((line) => !(line.startsWith("- [ ]") && line.includes(`items/${item.slug}.md`))).join("");
  if (nextTodo !== todo) mutate(todoPath, nextTodo, `remove completed backlog item ${item.slug}`);
  if (!dryRun) {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(source, rewritten);
    renameSync(source, destination);
    pendingWrites.set(archivePath, rewritten);
    removedSources.add(itemPath);
    movedFrom.set(archivePath, itemPath);
  }
  record(archivePath, "moved", `archive completed backlog item ${item.slug}`);
  const completedPath = ".context/backlog/archive/completed.md";
  const completed = existsSync(containedContextPath(completedPath)) ? readFileSync(containedContextPath(completedPath), "utf8") : "";
  const line = `- [x] ${title} (${payload.today}) — \`${payload.subject.name}/index.md\`. ${item.outcome}`;
  if (!completed.includes(line)) mutate(completedPath, `${completed.replace(/\s*$/, "")}\n\n${line}\n`, `log completed backlog item ${item.slug}`);
}

function newBacklogItem(payload: AnyRecord, item: AnyRecord): void {
  if (!isBacklogSlug(item.slug)) throw new Error(`invalid backlog slug: ${String(item.slug)}`);
  const path = `.context/backlog/items/${item.slug}.md`;
  const full = containedUnder(".context/backlog/items", path);
  if (existsSync(full)) {
    record(path, "skipped", `backlog item exists: ${item.slug}`);
    return;
  }
  const related = block("related", item.related);
  const text = ["---", `title: ${yamlScalar(item.title)}`, "status: active", `priority: ${yamlScalar(item.priority)}`, `created: ${payload.today}`, `updated: ${payload.today}`, "completed: null", ...related, "---", "", `# ${item.title}`, "", String(item.body ?? "").trim(), ""].join("\n");
  mutate(path, text, `create backlog item ${item.slug}`);
  const todoPath = ".context/backlog/todo.md";
  const old = existsSync(containedContextPath(todoPath)) ? readFileSync(containedContextPath(todoPath), "utf8") : "# Backlog\n\n";
  const line = `- [ ] [${item.title}](items/${item.slug}.md) — ${item.priority} priority`;
  if (!old.includes(`items/${item.slug}.md`)) {
    const match = old.match(/^# Backlog\r?\n(?:\r?\n)?/);
    const at = match ? match[0].length : 0;
    mutate(todoPath, old.slice(0, at) + line + "\n" + old.slice(at), `add ${item.slug} to backlog`);
  }
}

function updateFile(path: string, fields: AnyRecord, reason: string): void {
  if (removedSources.has(path)) return;
  const old = readFileSync(containedContextPath(path), "utf8");
  const next = setFrontmatterFields(old, fields);
  if (next !== old) mutate(path, next, reason);
}

function fixPhaseTables(payload: AnyRecord): void {
  if (!payload.phase_table_fixes.length) return;
  const overview = [...sourceArtifacts.keys(), ...pendingWrites.keys()]
    .filter(path => dirname(path) === payload.subject.path).map(path => basename(path)).find(name => /phases\.md$/.test(name));
  if (!overview) throw new Error("phase overview not found");
  const path = join(payload.subject.path, overview);
  let text = readFileSync(containedContextPath(path), "utf8");
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
    if (removedSources.has(planPath)) continue;
    const old = readFileSync(containedContextPath(planPath), "utf8");
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

function markdownSection(body: string, heading: string): string {
  const match = body.match(new RegExp(`^## ${heading}\\s*\\r?\\n([\\s\\S]*?)(?=^## |$)`, "m"));
  return match?.[1]?.trim() ?? "";
}

function subjectIndexBody(payload: AnyRecord, memoryFile: string): string {
  const body = String(payload.memory.body ?? "");
  const parts = [`# ${payload.memory.title}`, ""];
  for (const heading of ["User Goal", "What shipped", "Verification"]) {
    const text = markdownSection(body, heading);
    if (text) {
      parts.push(`## ${heading}`, "", text, "");
    }
  }
  parts.push("## Related", "", `Memory: \`.context/memory/${memoryFile}\``, "");
  return parts.join("\n");
}
function subjectIndexSections(payload: AnyRecord, memoryFile: string, existing: string): string[] {
  const sections: string[] = [];
  const body = String(payload.memory.body ?? "");
  for (const heading of ["What shipped", "Verification"]) {
    if (new RegExp(`^## ${heading}[ \\t]*$`, "m").test(existing)) continue;
    const text = markdownSection(body, heading);
    if (text) sections.push(`## ${heading}\n\n${text}`);
  }
  if (!/^## Related[ \t]*$/m.test(existing)) {
    sections.push(`## Related\n\nMemory: \`.context/memory/${memoryFile}\``);
  }
  return sections;
}

function createSubjectIndexText(fields: AnyRecord, payload: AnyRecord, memoryFile: string): string {
  const text = [
    "---",
    `date: ${yamlScalar(fields.date)}`,
    `subject: ${yamlScalar(fields.subject)}`,
    `topics: ${inline(fields.topics)}`,
    `memory: ${inline(fields.memory)}`,
    "---",
    "",
    subjectIndexBody(payload, memoryFile),
  ].join("\n");
  return text.endsWith("\n") ? text : `${text}\n`;
}

function applySubjectMetadata(payload: AnyRecord, fm: AnyRecord): void {
  const path = join(payload.subject.path, "index.md");
  const full = containedContextPath(path);
  if (!existsSync(full)) return;
  const old = readFileSync(full, "utf8");
  const parsed = readFrontmatter(old);
  const merged = setFrontmatterFields(old, {
    date: payload.today,
    subject: payload.subject.name,
    topics: union(parsed.data.topics, fm.topics),
  });
  if (merged !== old) mutate(path, merged, "update subject index without a SQL memory body");
}

function applySubjectIndex(payload: AnyRecord, fm: AnyRecord): void {
  if (sqlMemoryMode()) {
    applySubjectMetadata(payload, fm);
    return;
  }
  const path = join(payload.subject.path, "index.md");
  const memoryFile = basename(payload.memory.path);
  const fields = {
    date: payload.today,
    subject: payload.subject.name,
    topics: union(fm.topics),
    memory: [memoryFile],
  };
  if (!existsSync(containedContextPath(path))) {
    mutate(path, createSubjectIndexText(fields, payload, memoryFile), "create subject index");
    return;
  }
  const old = readFileSync(containedContextPath(path), "utf8");
  const parsed = readFrontmatter(old);
  const merged = setFrontmatterFields(old, {
    date: fields.date,
    subject: fields.subject,
    topics: union(parsed.data.topics, fields.topics),
    memory: union(parsed.data.memory, fields.memory),
  });
  if (parsed.body.trim()) {
    const sections = subjectIndexSections(payload, memoryFile, merged);
    const next = sections.length ? `${merged.trimEnd()}\n\n${sections.join("\n\n")}\n` : merged;
    if (next !== old) mutate(path, next, sections.length ? "append subject index sections" : "update subject index frontmatter");
    return;
  }
  const filled = `${merged.trimEnd()}\n\n${subjectIndexBody(payload, memoryFile)}`;
  mutate(path, filled.endsWith("\n") ? filled : `${filled}\n`, "fill subject index");
}

function applyStatuses(payload: AnyRecord): void {
  for (const path of payload.specs_complete) updateFile(subjectFile(payload, path), { status: "completed" }, "complete spec");
  for (const path of payload.phases_complete) {
    updateFile(join(payload.subject.path, path), { status: "completed", completed_at: `"${payload.today}"` }, "complete phase");
  }
  fixPhaseTables(payload);
}

function applyLoose(payload: AnyRecord): void {
  for (const loose of payload.loose_artifacts) {
    if (removedSources.has(loose)) continue;
    const source = containedContextPath(loose);
    const destination = containedContextPath(join(payload.subject.path, basename(loose)));
    if (existsSync(destination)) {
      record(loose, "skipped", `destination exists: ${join(payload.subject.path, basename(loose))}`);
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(source, destination);
      pendingWrites.set(join(payload.subject.path, basename(loose)), fileReadSync(destination, "utf8"));
      removedSources.add(loose);
      movedFrom.set(join(payload.subject.path, basename(loose)), loose);
    }
    record(join(payload.subject.path, basename(loose)), "moved", `consolidate loose artifact ${loose}`);
  }
}

function lifecycleSubjectFiles(subjectPath: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const name of new Set([...sourceArtifacts.keys(), ...pendingWrites.keys()])) {
    if (dirname(name) === subjectPath && name.endsWith(".md") && !removedSources.has(name)) {
      files.set(basename(name), readFileSync(containedContextPath(name), "utf8"));
    }
  }
  return files;
}

function prepareLifecycleText(text: string, files: ReadonlyMap<string, string>): string {
  if (inspectSubjectLifecycleTexts(text, files).state === "missing") {
    text = applySubjectLifecycleTexts(text, files, { kind: "initialize" });
  }
  if (inspectSubjectLifecycleTexts(text, files).state === "draft" && [...files.keys()].some(name => /^plan-.*\.md$/.test(name))) {
    text = applySubjectLifecycleTexts(text, files, { kind: "activate" });
  }
  return text;
}

function applyLifecycle(payload: AnyRecord): void {
  if (dryRun) return;
  const path = join(payload.subject.path, "index.md");
  if (removedSources.has(path)) return;
  const files = lifecycleSubjectFiles(payload.subject.path);
  let text = files.get("index.md") ?? "";
  const before = inspectSubjectLifecycleTexts(text, files, payload.subject.path);
  try {
    text = prepareLifecycleText(text, files);
    text = applySubjectLifecycleTexts(text, files, { kind: "close-verified" });
    const after = inspectSubjectLifecycleTexts(text, files, payload.subject.path);
    report.lifecycle = { ...after, ok: true, code: "applied", changed: text !== files.get("index.md"), previousState: before.state, resultingState: after.state };
  } catch (error) {
    const after = inspectSubjectLifecycleTexts(text, files, payload.subject.path);
    const message = error instanceof Error ? error.message : String(error);
    const code = /malformed|ambiguous/.test(message) ? "legacy-ambiguous" : /evidence/.test(message) ? "not-verified" : "invalid-transition";
    report.lifecycle = { ...after, ok: false, code, changed: text !== files.get("index.md"), previousState: before.state, resultingState: after.state };
  }
  if (text !== files.get("index.md")) mutate(path, text, "apply canonical subject lifecycle");
}

function validateBacklog(payload: AnyRecord): void {
  const items = [...payload.backlog.new_items, ...payload.backlog.complete_explicit, ...payload.backlog.complete_inferred];
  for (const item of items) {
    const slug = item && typeof item === "object" ? (item as AnyRecord).slug : undefined;
    if (!isBacklogSlug(slug)) throw new Error(`invalid backlog slug: ${String(slug)}`);
  }
}

function validateCrossrefs(payload: AnyRecord): void {
  for (const ref of payload.crossrefs) {
    if (!ref || typeof ref.path !== "string") throw new Error("crossref path is required");
    containedContextPath(ref.path);
  }
}

function validateSpecPlans(payload: AnyRecord): void {
  if (Object.prototype.hasOwnProperty.call(payload, "subject_index_status")) {
    throw new Error("subject_index_status is not supported; lifecycle is computed");
  }
  for (const ref of payload.spec_plans) {
    if (!ref || typeof ref.spec !== "string" || typeof ref.plan !== "string") throw new Error("spec_plans entries need spec and plan strings");
    containedContextPath(subjectFile(payload, ref.spec));
  }
}

function validateEvidence(items: AnyRecord[]): void {
  for (const item of items) {
    if (!item || typeof item.path !== "string" || typeof item.evidence !== "string") throw new Error("verification_evidence entries need path and evidence strings");
  }
}

function validateLoose(payload: AnyRecord): void {
  for (const loose of payload.loose_artifacts) {
    if (typeof loose !== "string") throw new Error(`invalid loose artifact: ${String(loose)}`);
    containedContextPath(loose);
  }
}

function validateDeletedSources(payload: AnyRecord): void {
  for (const deleted of payload.deleted_sources ?? []) {
    const path = typeof deleted === "string" ? deleted : deleted.path;
    if (typeof path !== "string") throw new Error("deleted source path is required");
    containedContextPath(path);
    if (!path.startsWith(`${payload.subject.path}/`) && !/^\.context\/(?:memory|backlog)\//.test(path)) throw new Error(`deleted source is outside the save scope: ${path}`);
    const snapshot = payload.storage_snapshot?.[path];
    if (!snapshot?.revision) throw new Error(`deleted source requires a captured revision: ${path}`);
  }
}

function validatePayload(payload: AnyRecord): void {
  validateBacklog(payload);
  if (!sqlMemoryMode()) containedContextPath(payload.memory.path);
  containedContextPath(payload.subject.path);
  validateCrossrefs(payload);
  validateSpecPlans(payload);
  validateEvidence(payload.verification_evidence);
  validateLoose(payload);
  validateDeletedSources(payload);
}

function applyAll(payload: AnyRecord): void {
  for (const deleted of payload.deleted_sources ?? []) {
    removedSources.add(typeof deleted === "string" ? deleted : deleted.path);
  }
  if (payload.subject.create && !dryRun) mkdirSync(containedContextPath(payload.subject.path), { recursive: true });
  applyIterates(payload);
  const fm = applyMemory(payload);
  applySubjectIndex(payload, fm);
  applyIndex(payload, fm);
  applyCrossrefs(payload);
  applySpecPlans(payload);
  applyBacklog(payload);
  applyStatuses(payload);
  applyLoose(payload);
  applyLifecycle(payload);
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
  ensureArray(payload, "verification_evidence");
  ensureArray(payload, "spec_plans");
}

function failSchema(message: string): number {
  report.error = message;
  report.errors.push(message);
  console.log(JSON.stringify(report));
  return 2;
}

function saveSourcePath(item: ArtifactRevision, subjectName: string): string | null {
  const key = item.key;
  if (key.subjectId === "save-attempts" || key.kind === "receipt") return null;
  const path = key.subjectId === "save-apply" ? `.context/${key.logicalName}` : `.context/${key.subjectId}/${key.logicalName}`;
  if (key.subjectId !== subjectName && !["memory", "backlog", "save-apply"].includes(key.subjectId)) return null;
  const classified = classifyContextPath(path);
  return classified.kind === key.kind && classified.subjectId === key.subjectId && classified.logicalName === key.logicalName ? path : null;
}

function assertSourceSnapshot(path: string, snapshot: AnyRecord): void {
  const current = sourceArtifacts.get(path);
  if ((current?.revision || null) !== snapshot.revision) throw new Error(`stale revision rejected: ${path}`);
  if (snapshot.origin === null && current !== undefined) throw new Error(`stale revision rejected: ${path}`);
  if (snapshot.origin === "repo-projection" && current && new TextDecoder().decode(current.bytes) !== snapshot.text) throw new Error(`stale revision rejected: ${path}`);
}

function validateSourceSnapshots(payload: AnyRecord): void {
  for (const [path, snapshot] of Object.entries(payload.storage_snapshot ?? {}) as Array<[string, AnyRecord]>) {
    if (!path.startsWith(`${payload.subject.path}/`) && !/^\.context\/(?:memory|backlog)\//.test(path) && !sourceArtifacts.has(path)) continue;
    assertSourceSnapshot(path, snapshot);
  }
}

/** Capture read revisions before any local mutation; seal against that snapshot. */
async function loadSources(payload: AnyRecord, deps: SaveStoreDeps): Promise<void> {
  await withSaveStore(cwd(), deps, async (store, context) => {
    const { artifacts } = await readSaveSources(store, context, cwd());
    for (const item of artifacts.values()) {
      const path = saveSourcePath(item, payload.subject.name);
      if (path !== null) sourceArtifacts.set(path, item);
    }
    validateSourceSnapshots(payload);
    authoritative = true;
    if (dryRun) return;
    for (const [path, item] of sourceArtifacts) {
      const full = containedContextPath(path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, item.bytes);
    }
  });
}

function assertMetadataRevision(expected: ArtifactRevision, actual: ArtifactRevision | null | undefined): void {
  if (!actual || actual.revision !== expected.revision || actual.sha256 !== expected.sha256) throw new Error("uncertain save metadata persistence");
}

async function commitMetadataRevisions(store: StorageStore, scope: ConsumerScope, attempt: SaveAttempt, local: readonly ArtifactRevision[], corrections: readonly ArtifactRevision[]): Promise<void> {
  const stored = await store.writeBatch(local);
  if (stored.length !== local.length) throw new Error("uncertain save metadata persistence");
  for (let index = 0; index < local.length; index++) assertMetadataRevision(local[index]!, stored[index]);
  for (const replacement of corrections) {
    const corrected = await store.correct({
      key: replacement.key, predecessorRevision: replacement.expectedRevision!, replacement,
      idempotencyKey: `${attempt.attemptId}:metadata:${replacement.key.subjectId}:${replacement.key.logicalName}`,
      publishedRevisionIds: scope.publishedRevisionIds,
    });
    assertMetadataRevision(replacement, corrected);
  }
}

function metadataRevision(scope: ConsumerScope, path: string, content: string, previous: ArtifactRevision | undefined): ArtifactRevision {
  const classified = classifyContextPath(path);
  const bytes = new TextEncoder().encode(content);
  return { key: consumerKey(scope, classified.kind, classified.subjectId, classified.logicalName), revision: randomUUID(), bytes, sha256: revisionHash(bytes), author: "buck-save", source: "save-apply", createdAt: new Date().toISOString(), links: previous?.links ?? sourceArtifacts.get(movedFrom.get(path) ?? "")?.links ?? [], expectedRevision: previous?.revision || null };
}

async function sealAppliedBytes(deps: SaveStoreDeps, metadataDigest: string): Promise<void> {
  if (!saveAttempt) throw new Error("Save attempt is not bound");
  const attempt = saveAttempt;
  await withSaveStore(cwd(), deps, async (store, context) => {
    const local: ArtifactRevision[] = [];
    const corrections: ArtifactRevision[] = [];
    const writes: ArtifactRevision[] = [...pendingWrites.entries()].map(([path, content]) => {
      const previous = sourceArtifacts.get(path);
      const revision = metadataRevision(context, path, content, previous);
      if (previous?.revision && previous.key.branchId !== context.branchId) corrections.push(revision);
      else local.push(revision);
      return revision;
    });
    await commitMetadataRevisions(store, context, attempt, local, corrections);
    const removed: ArtifactKey[] = [];
    for (const path of removedSources) {
      const previous = sourceArtifacts.get(path);
      if (!previous?.revision) continue;
      const key = { ...previous.key, branchId: context.branchId };
      await store.correct({ key, predecessorRevision: previous.revision, replacement: null, idempotencyKey: `${attempt.attemptId}:remove:${path}`, publishedRevisionIds: context.publishedRevisionIds });
      rmSync(containedContextPath(path), { force: true });
      removed.push(key);
    }
    await recordSaveMetadata(cwd(), attempt, writes, removed, { store, context }, metadataDigest);
    await completeSaveAttempt(cwd(), attempt, { store, context });
  });
  report.run_id = attempt.runId;
}

async function bindApplyAttempt(payload: AnyRecord, deps: SaveStoreDeps): Promise<SaveAttempt> {
  if (!sqlMemoryMode()) {
    const prepared = prepareSaveAttempt(cwd(), payload.subject.name);
    if ("error" in prepared) throw new Error(prepared.error);
    await saveSqlFacts(cwd(), prepared, [], deps);
    return prepared;
  }
  const attempt = await loadSaveAttempt(cwd(), deps);
  if (!attempt || attempt.subject !== payload.subject.name) throw new Error("Durable SQL save attempt is missing");
  const check = await verifySqlSave(cwd(), payload.subject.name, deps, false, attempt.attemptId);
  if (check.status !== "verified") throw new Error(check.status === "block" ? check.reason : "SQL save facts are not verified");
  await withSaveStore(cwd(), deps, async (store, context) => {
    const receipt = await store.readReceipt(context.projectId, attempt.runId);
    if (JSON.stringify(receipt?.artifactRevisions) !== JSON.stringify(payload.sql_receipt.ids)) throw new Error("SQL receipt does not match payload");
  });
  return attempt;
}

function schemaError(payload: AnyRecord): string | null {
  try { return required(payload); }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}

export async function runApply(payload: AnyRecord, deps: SaveStoreDeps = {}): Promise<number> {
  report.applied = [];
  report.staged_inferred = [];
  report.errors = [];
  delete report.error;
  delete report.lifecycle;
  delete report.run_id;
  pendingWrites.clear();
  sourceArtifacts.clear();
  removedSources.clear();
  movedFrom.clear();
  authoritative = false;
  saveAttempt = null;
  const invalid = schemaError(payload);
  if (invalid) return failSchema(invalid);
  defaults(payload);
  const { storage_snapshot: _snapshot, ...metadataInput } = payload;
  const metadataDigest = revisionHash(new TextEncoder().encode(JSON.stringify(metadataInput)));
  try {
    validatePayload(payload);
    if (!dryRun) saveAttempt = await bindApplyAttempt(payload, deps);
    const replayed = !dryRun && saveAttempt && await resumeSaveMetadata(cwd(), saveAttempt, metadataDigest, deps);
    if (replayed) report.run_id = saveAttempt!.runId;
    else {
      await loadSources(payload, deps);
      applyAll(payload);
      if (!dryRun) await sealAppliedBytes(deps, metadataDigest);
    }
  } catch (error) { report.errors.push(error instanceof Error ? error.message : String(error)); }
  console.log(JSON.stringify(report));
  return report.errors.length ? 1 : 0;
}

async function main(): Promise<number> {
  try {
    return await runApply(JSON.parse(await Bun.stdin.text()));
  } catch {
    return failSchema("invalid JSON payload");
  }
}


if (import.meta.main) {
  process.exitCode = await main();
}
