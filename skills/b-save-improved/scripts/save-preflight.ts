#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import {
  listSubjectFolders,
  readSubjectStatus,
  readFrontmatter,
  parseBacklogTodo,
  parsePhaseSummaryTable,
  phaseCriteriaAllChecked,
  planMemoryRefStyle,
  userGoalState,
  parseSimpleYaml,
} from "../../_shared/scripts/context-helpers.js";

const CONTEXT = ".context";
const LOOSE_ARTIFACT_NAME = /^(?:(?:plan|spec|research|iterate|brainstorm|phase)-.+\.md|draft-commit\.md)$/;

const STALE_REASON = "no writer since the 2026-06-05 extension slim-down";

function emit(payload: unknown, code: number): never {
  console.log(JSON.stringify(payload));
  process.exit(code);
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function text(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(stringValue).filter((item): item is string => item !== null);
  const scalar = stringValue(value);
  return scalar ? [scalar] : [];
}

function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slugFromBranch(branch: string): string {
  const segment = branch.split("/").at(-1) || "session";
  return segment.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
}

function normalizeSubjectName(name: string, today: string): string {
  const trimmed = name.trim();
  if (/^\d{4}-\d{2}-\d{2}\./.test(trimmed)) return trimmed;
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
  return `${today}.${slug}`;
}

function parseArgs(argv: string[]): { subject: string | null } {
  let subject: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") continue;
    if (argv[i] === "--subject") {
      if (!argv[i + 1]) emit({ error: "--subject requires a folder name" }, 1);
      subject = argv[++i];
    }
  }
  return { subject };
}

function memoryIndexShape(contents: string): "two-line" | "single-line" | "empty" {
  const lines = contents.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (/^- \d{4}-\d{2}-\d{2} — \[/.test(lines[0] ?? "") && /^  - /.test(lines[1] ?? "")) return "two-line";
  if (/^- \d{4}-\d{2}-\d{2} \| /.test(lines[0] ?? "")) return "single-line";
  return "empty";
}

function memoryBackend(): { source: string; backend: string | null; expect_retain: boolean } {
  const source = join(process.env.HOME || homedir(), ".omp/agent/config.yml");
  if (!existsSync(source)) return { source, backend: null, expect_retain: false };
  const lines = readFileSync(source, "utf8").split(/\r?\n/);
  const start = lines.findIndex((line) => /^memory:\s*(?:#.*)?$/.test(line));
  let backend: string | null = null;
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\S/.test(lines[i]) && lines[i].trim()) break;
      const match = lines[i].match(/^\s+backend:\s*["']?([^\s#"']+)/);
      if (match) { backend = match[1]; break; }
    }
  }
  if (!backend || !["hindsight", "mnemopi", "local"].includes(backend)) return { source, backend: null, expect_retain: false };
  return { source, backend, expect_retain: backend === "hindsight" || backend === "mnemopi" };
}

function uncheckedCriteria(data: Record<string, unknown>): string[] {
  return toArray(data.acceptance_criteria).filter((criterion) => !/^\[x\]/i.test(criterion.trim()));
}

function markdownMemoryRefs(contents: string): string[] {
  const line = contents.split(/\r?\n/).find((candidate) => /^\*\*memory:\*\*/i.test(candidate.trim()));
  return line ? [...line.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]) : [];
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  let branch: string;
  try {
    if (git(["rev-parse", "--is-inside-work-tree"]) !== "true") emit({ error: "not a git repository" }, 1);
    branch = git(["symbolic-ref", "--short", "HEAD"]);
  } catch {
    emit({ error: "not a git repository" }, 1);
  }

  if (!existsSync(CONTEXT)) emit({ error: "no .context directory" }, 3);
  try {
    if (!statSync(CONTEXT).isDirectory()) throw new Error("not a directory");
    accessSync(CONTEXT, constants.R_OK);
    readdirSync(CONTEXT);
  } catch {
    emit({ error: ".context directory is unreadable" }, 1);
  }

  const today = localDate();
  const folders = listSubjectFolders(".");
  const subjectCandidates = folders
    .map(({ name, status }) => ({ name, status }))
    .sort((a, b) => b.name.localeCompare(a.name));
  let selectedName: string;
  let selectedStatus: "draft" | "active" | "completed" | null;
  let created = false;

  if (args.subject) {
    const existing = join(CONTEXT, args.subject);
    if (existsSync(existing)) {
      selectedName = args.subject;
      selectedStatus = readSubjectStatus(existing);
    } else {
      selectedName = normalizeSubjectName(args.subject, today);
      selectedStatus = null;
      created = true;
    }
  } else {
    const active = folders.filter((folder) => folder.status === "active");
    const eligible = active.length ? active : folders.filter((folder) => folder.status === "draft");
    if (eligible.length > 1) {
      emit({
        error: "ambiguous subject",
        subject_candidates: subjectCandidates,
        suggested_subject: `${today}.${slugFromBranch(branch)}`,
      }, 2);
    }
    if (eligible.length === 1) {
      selectedName = eligible[0].name;
      selectedStatus = eligible[0].status;
    } else {
      selectedName = `${today}.${slugFromBranch(branch)}`;
      selectedStatus = null;
      created = true;
    }
  }

  const subjectPath = join(CONTEXT, selectedName);
  const subjectFiles = existsSync(subjectPath)
    ? readdirSync(subjectPath, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name).sort()
    : [];

  const hintPath = join(CONTEXT, "workflow/current-session.json");
  let hintData: Record<string, unknown> = {};
  if (existsSync(hintPath)) {
    try { hintData = JSON.parse(readFileSync(hintPath, "utf8")) as Record<string, unknown>; } catch { hintData = {}; }
  }
  const sessionHint = {
    path: hintPath,
    present: existsSync(hintPath),
    started_at: stringValue(hintData.started_at),
    subject: stringValue(hintData.subject),
    memory_file: stringValue(hintData.memory_file),
    used: false,
    stale_reasons: existsSync(hintPath) ? [STALE_REASON] : [],
  };

  const memoryIndexPath = join(CONTEXT, "memory/index.md");
  const subjectSlug = selectedName.replace(/^\d{4}-\d{2}-\d{2}\./, "");
  const existingMemoryPath = join(CONTEXT, "memory", `${subjectSlug}-${today}.md`);
  const todoPath = join(CONTEXT, "backlog/todo.md");
  const itemsDir = join(CONTEXT, "backlog/items");
  const archiveDir = join(CONTEXT, "backlog/archive");
  const completedLog = join(archiveDir, "completed.md");
  const parsedTodo = parseBacklogTodo(text(todoPath));
  const openItems = parsedTodo.sections.flatMap((section) => section.items).filter((item) => !item.checked).map((item) => {
    const itemPath = join(CONTEXT, "backlog", item.link);
    const itemData = readFrontmatter(text(itemPath)).data;
    return { slug: item.slug, label: item.label, link: item.link, related: toArray(itemData.related), status: stringValue(itemData.status) };
  });

  const specs = subjectFiles.filter((name) => /^spec-.*\.md$/.test(name)).map((name) => {
    const parsed = readFrontmatter(text(join(subjectPath, name)));
    return { path: name, status: stringValue(parsed.data.status), acceptance_present: toArray(parsed.data.acceptance_criteria).length > 0 };
  });

  const overviewName = subjectFiles.find((name) => /^plan-.*-phases\.md$/.test(name)) ?? null;
  const rows = overviewName ? parsePhaseSummaryTable(text(join(subjectPath, overviewName))) : [];
  const phaseFiles = subjectFiles.filter((name) => /^phase-.*\.md$/.test(name)).map((name) => {
    const data = readFrontmatter(text(join(subjectPath, name))).data;
    return { path: name, status: stringValue(data.status), completed_at: stringValue(data.completed_at), criteria_all_checked: phaseCriteriaAllChecked(data), criteria_unchecked: uncheckedCriteria(data) };
  });
  const autoCompletable = phaseFiles.filter((file) => file.criteria_all_checked && file.status !== "completed").map((file) => file.path);
  const needsAdjudication = phaseFiles.filter((file) => !file.criteria_all_checked && !["completed", "pending", "draft"].includes(file.status ?? "")).map((file) => file.path);
  const tableDrift = rows.flatMap((row) => {
    const file = phaseFiles.find((candidate) => candidate.path === row.file);
    return file && file.status !== row.status ? [{ file: row.file, table_says: row.status, file_says: file.status }] : [];
  });

  const plans = subjectFiles.filter((name) => /^plan-.*\.md$/.test(name) && !/-phases\.md$/.test(name)).map((name) => {
    const contents = text(join(subjectPath, name));
    const parsed = readFrontmatter(contents);
    const style = planMemoryRefStyle(contents);
    return {
      path: name,
      memory_ref_style: style,
      memory_refs: style === "yaml" ? toArray(parsed.data.memory) : style === "bold-line" ? markdownMemoryRefs(contents) : [],
      spec: stringValue(parsed.data.spec),
    };
  });
  const iterates = subjectFiles.filter((name) => /^iterate-.*\.md$/.test(name)).map((name) => {
    const parsed = readFrontmatter(text(join(subjectPath, name)));
    const addresses = stringValue(parsed.data.addresses);
    const plan = addresses ? plans.find((candidate) => candidate.path === basename(addresses)) : null;
    const planData = plan ? readFrontmatter(text(join(subjectPath, plan.path))).data : {};
    return { path: name, status: stringValue(parsed.data.status), addresses, plan_has_iterations_ref: toArray(planData.iterations).includes(name) };
  });

  const userGoal = { missing: [] as string[], waived: [] as string[], present: [] as string[] };
  for (const name of subjectFiles.filter((candidate) => /^(?:plan|brainstorm)-.*\.md$/.test(candidate))) {
    userGoal[userGoalState(text(join(subjectPath, name)))].push(name);
  }

  const looseArtifacts = readdirSync(CONTEXT, { withFileTypes: true }).filter((entry) => entry.isFile() && LOOSE_ARTIFACT_NAME.test(entry.name)).map((entry) => join(CONTEXT, entry.name)).sort();
  const output = {
    code: 0,
    today,
    subject: { name: selectedName, path: subjectPath, status: selectedStatus, created },
    subject_candidates: subjectCandidates,
    session_hint: sessionHint,
    loose_artifacts: looseArtifacts,
    existing_memory: { path: existingMemoryPath, present: existsSync(existingMemoryPath) },
    memory_index: { path: memoryIndexPath, first_entry_shape: memoryIndexShape(text(memoryIndexPath)) },
    backlog: { todo_path: todoPath, items_dir: itemsDir, archive_dir: archiveDir, completed_log: completedLog, open_items: openItems },
    specs,
    phases: { overview: overviewName ? join(subjectPath, overviewName) : null, rows, files: phaseFiles, auto_completable: autoCompletable, needs_adjudication: needsAdjudication, table_drift: tableDrift },
    iterates,
    plans,
    user_goal: userGoal,
    memory_backend: memoryBackend(),
    git: { status_porcelain: git(["status", "--porcelain"]), diff_stat: git(["diff", "--stat"]), branch },
  };
  console.log(JSON.stringify(output));
}

// Keep the imported parser part of this script's explicit, dependency-free YAML contract.
void parseSimpleYaml;

if (import.meta.main) {
  try { main(); } catch (error) {
    emit({ error: error instanceof Error ? error.message : String(error) }, 1);
  }
}
