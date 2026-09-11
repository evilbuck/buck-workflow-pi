import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { listSubjectFolders, readFrontmatter, readSubjectStatus } from "../../skills/_shared/scripts/context-helpers.js";

const CONTEXT = ".context";
const DIGEST_CAP = 12_000;
const DATE_PREFIX = /^\d\d\d\d-\d\d-\d\d\./;
const LOOSE_NAME = /^(?:plan|spec|research|iterate|brainstorm|phase)-.+\.md$|^draft-commit\.md$/;

export type SubjectCandidate = { name: string; status: string | null };

export type SnapshotOk = {
  kind: "ok";
  snapshot: SaveSnapshot;
};

export type SnapshotAmbiguous = {
  kind: "ambiguous";
  candidates: SubjectCandidate[];
  suggested_subject: string;
};

export type SaveSnapshot = {
  subject: { name: string; path: string; status: string | null; created: boolean };
  subject_candidates: SubjectCandidate[];
  session_evidence: {
    present: boolean;
    valid: boolean;
    used: boolean;
    stale_reasons: string[];
    fields: Record<string, unknown>;
  };
  loose_artifacts: Array<{ path: string; move: boolean }>;
  plans: Array<{ path: string; spec: string | null }>;
  specs: string[];
  iterates: string[];
  phases: string[];
  input_hashes: Record<string, string>;
  redacted_text: Record<string, string>;
  proposal_dependencies: Record<string, string[]>;
};

export type SnapshotOptions = {
  subject?: string | null;
  branch?: string;
  today?: string;
};

export function hashContent(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function redactUntrusted(text: string, cap = DIGEST_CAP) {
  const redacted = text.replace(/sk-[A-Za-z0-9]+/g, "[redacted-secret]");
  if (redacted.length <= cap) return redacted;
  return redacted.slice(0, cap);
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

function slugFromBranch(branch: string) {
  const segment = branch.split("/").at(-1) || "session";
  const slug = segment.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "session";
}

function normalizeSubjectName(name: string, today: string) {
  const trimmed = name.trim();
  if (DATE_PREFIX.test(trimmed)) return trimmed;
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
  return today + "." + slug;
}

function assertContained(root: string, name: string) {
  if (!name || name.includes("..") || name.includes(sep) || name.startsWith("/")) {
    throw new Error("Subject path escapes .context containment");
  }
  const base = resolve(root, CONTEXT);
  const full = resolve(base, name);
  if (full !== join(base, name) && !full.startsWith(base + sep)) {
    throw new Error("Subject path escapes .context containment");
  }
  return full;
}

function readText(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : null;
}

function sessionEvidence(root: string, selectedName: string) {
  const path = join(root, CONTEXT, "workflow", "current-session.json");
  const present = existsSync(path);
  if (!present) {
    return { present: false, valid: false, used: false, stale_reasons: [], fields: {} };
  }
  try {
    const fields = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!fields || typeof fields !== "object") {
      return { present: true, valid: false, used: false, stale_reasons: ["invalid json"], fields: {} };
    }
    const record = fields as Record<string, unknown>;
    const stale_reasons: string[] = [];
    const hinted = stringField(record.subject);
    if (hinted && hinted !== selectedName) stale_reasons.push("subject mismatch");
    const memoryFile = stringField(record.memory_file);
    if (memoryFile && !existsSync(join(root, memoryFile)) && !existsSync(join(root, CONTEXT, "memory", memoryFile))) {
      stale_reasons.push("missing memory_file");
    }
    return { present: true, valid: true, used: false, stale_reasons, fields: record };
  } catch {
    return { present: true, valid: false, used: false, stale_reasons: ["invalid json"], fields: {} };
  }
}

function isLooseName(name: string) {
  return LOOSE_NAME.test(name);
}

function enumerateLoose(root: string, selectedName: string) {
  const dir = join(root, CONTEXT);
  const entries = readdirSync(dir, { withFileTypes: true });
  const artifacts: Array<{ path: string; move: boolean }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isLooseName(entry.name)) continue;
    const rel = join(CONTEXT, entry.name);
    const parsed = readFrontmatter(readText(join(dir, entry.name)));
    const owner = stringField(parsed.data.subject);
    artifacts.push({ path: rel, move: owner === selectedName });
  }
  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  return artifacts;
}

function hashFile(root: string, rel: string, hashes: Record<string, string>, redacted: Record<string, string>, key: string) {
  const abs = join(root, rel);
  if (!existsSync(abs) || !statSync(abs).isFile()) return;
  const text = readFileSync(abs, "utf8");
  hashes[rel] = hashContent(text);
  redacted[key] = redactUntrusted(text);
}

function resolveSubject(root: string, opts: SnapshotOptions, today: string, branch: string) {
  const folders = listSubjectFolders(root);
  const candidates = folders
    .map((folder) => ({ name: folder.name, status: folder.status }))
    .sort((a, b) => b.name.localeCompare(a.name));

  if (opts.subject) {
    assertContained(root, opts.subject);
    const existing = join(root, CONTEXT, opts.subject);
    if (existsSync(existing)) {
      return {
        kind: "ok" as const,
        candidates,
        selectedName: opts.subject,
        selectedStatus: readSubjectStatus(existing),
        created: false,
      };
    }
    const selectedName = normalizeSubjectName(opts.subject, today);
    assertContained(root, selectedName);
    return { kind: "ok" as const, candidates, selectedName, selectedStatus: null, created: true };
  }

  const active = folders.filter((folder) => folder.status === "active");
  const eligible = active.length ? active : folders.filter((folder) => folder.status === "draft");
  if (eligible.length > 1) {
    return {
      kind: "ambiguous" as const,
      candidates,
      suggested_subject: today + "." + slugFromBranch(branch),
    };
  }
  if (eligible.length === 1) {
    return {
      kind: "ok" as const,
      candidates,
      selectedName: eligible[0].name,
      selectedStatus: eligible[0].status,
      created: false,
    };
  }
  return {
    kind: "ok" as const,
    candidates,
    selectedName: today + "." + slugFromBranch(branch),
    selectedStatus: null,
    created: true,
  };
}

function listMarkdownFiles(absSubject: string) {
  if (!existsSync(absSubject)) return [];
  return readdirSync(absSubject, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

export function takeSnapshot(root: string, opts: SnapshotOptions = {}): SnapshotOk | SnapshotAmbiguous {
  const today = opts.today ?? localToday();
  const branch = opts.branch ?? "session";
  if (!existsSync(join(root, CONTEXT))) {
    throw new Error("no .context directory");
  }

  const resolved = resolveSubject(root, opts, today, branch);
  if (resolved.kind === "ambiguous") {
    return {
      kind: "ambiguous",
      candidates: resolved.candidates,
      suggested_subject: resolved.suggested_subject,
    };
  }

  const selectedName = resolved.selectedName;
  const subjectPath = join(CONTEXT, selectedName);
  const absSubject = join(root, subjectPath);
  const subjectFiles = listMarkdownFiles(absSubject);
  const plans = subjectFiles
    .filter((name) => name.startsWith("plan-") && name.endsWith(".md") && !name.endsWith("-phases.md"))
    .map((name) => {
      const parsed = readFrontmatter(readText(join(absSubject, name)));
      return { path: name, spec: stringField(parsed.data.spec) };
    });
  const specs = subjectFiles.filter((name) => name.startsWith("spec-") && name.endsWith(".md"));
  const iterates = subjectFiles.filter((name) => name.startsWith("iterate-") && name.endsWith(".md"));
  const phases = subjectFiles.filter((name) => name.startsWith("phase-") && name.endsWith(".md"));

  const input_hashes: Record<string, string> = {};
  const redacted_text: Record<string, string> = {};
  for (const name of subjectFiles) {
    hashFile(root, join(subjectPath, name), input_hashes, redacted_text, name);
  }
  hashFile(root, join(CONTEXT, "backlog", "todo.md"), input_hashes, redacted_text, "todo");
  hashFile(root, join(CONTEXT, "memory", "index.md"), input_hashes, redacted_text, "memory_index");
  hashFile(root, join(CONTEXT, "workflow", "current-session.json"), input_hashes, redacted_text, "session_evidence");

  return {
    kind: "ok",
    snapshot: {
      subject: {
        name: selectedName,
        path: subjectPath,
        status: resolved.selectedStatus,
        created: resolved.created,
      },
      subject_candidates: resolved.candidates,
      session_evidence: sessionEvidence(root, selectedName),
      loose_artifacts: enumerateLoose(root, selectedName),
      plans,
      specs,
      iterates,
      phases,
      input_hashes,
      redacted_text,
      proposal_dependencies: {
        memory_draft: ["subject_index", "session_evidence", "plans"],
        crossref: ["plans", "specs"],
        backlog: ["todo"],
        phases: ["phase_files", "overview"],
      },
    },
  };
}


