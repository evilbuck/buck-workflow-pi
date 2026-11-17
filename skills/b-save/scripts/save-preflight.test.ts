import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withConfiguredStore } from "../../_shared/scripts/workflow-state.js";
import { revisionHash } from "../../_shared/storage/adapter-utils.js";
import type { ArtifactKind, StorageStore } from "../../_shared/storage/contract.js";

const SCRIPT = resolve(import.meta.dirname, "save-preflight.ts");

interface SnapshotEntry {
  revision: string | null;
  sha256: string | null;
  text: string;
  kind: ArtifactKind | null;
  subject_id: string | null;
  logical_name: string | null;
  origin: string | null;
}
type Payload = Record<string, unknown> & {
  subject_candidates?: Array<{ name: string; status: string | null }>;
  suggested_subject?: string;
  subject: { name: string; path: string; status: string | null; created: boolean };
  loose_artifacts?: string[];
  plans: Array<Record<string, unknown>>;
  user_goal: { missing: string[]; waived: string[]; present: string[] };
  memory_backend?: { backend: string | null; expect_retain: boolean };
  backlog?: { open_items?: Array<Record<string, unknown>> };
  memory_index: { first_entry_shape: string };
  session_hint: { present: boolean; used: boolean; stale_reasons: string[]; started_at: string | null };
  deleted_sources: Array<{ path: string; revision: string; kind: ArtifactKind; logical_name: string }>;
  storage_snapshot: Record<string, SnapshotEntry>;
};
type RunResult = { code: number; payload: Payload };

interface Fixture {
  root: string;
  home: string;
  xdg: string;
  config: string;
  cleanup: () => void;
}

function fixture(git = true): Fixture {
  const root = mkdtempSync(join(tmpdir(), "save-preflight-"));
  const home = join(root, "home");
  const xdg = join(root, "xdg");
  mkdirSync(home);
  mkdirSync(xdg);
  const config = join(root, "config.yaml");
  writeFileSync(config, "version: 1\nstorage:\n  adapter: repo-files\n");
  if (git) execFileSync("git", ["init", "-q", "-b", "feature/x"], { cwd: root });
  return { root, home, xdg, config, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function run(root: string, f: Pick<Fixture, "home" | "xdg" | "config">, args: string[] = []): RunResult {
  try {
    const stdout = execFileSync("bun", [SCRIPT, ...args], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        HOME: f.home,
        XDG_CONFIG_HOME: f.xdg,
        BUCK_WORKFLOW_CONFIG: f.config,
      },
    });
    return { code: 0, payload: JSON.parse(stdout) };
  } catch (error) {
    const failure = error as { status?: number; stdout?: Buffer | string };
    return { code: failure.status ?? 1, payload: JSON.parse(String(failure.stdout)) };
  }
}

/**
 * Seed the configured store the same way the save pipelines do. The identity
 * scope must match the subprocess, so the fixture XDG home is bound for the call.
 */
async function seed(
  f: Fixture,
  entries: Array<{ kind: ArtifactKind; subjectId: string; logicalName: string; text: string }>,
): Promise<void> {
  const previousXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = f.xdg;
  try {
    await withConfiguredStore(f.root, async (store: StorageStore, context) => {
      await store.writeBatch(entries.map((entry) => {
        const bytes = new TextEncoder().encode(entry.text);
        return {
          key: {
            projectId: context.projectId,
            branchId: context.branchId,
            subjectId: entry.subjectId,
            kind: entry.kind,
            logicalName: entry.logicalName,
          },
          revision: randomUUID(),
          bytes,
          sha256: revisionHash(bytes),
          author: "test",
          source: "test-fixture",
          createdAt: "2026-08-26T00:00:00.000Z",
          links: [],
        };
      }));
    }, { configPath: f.config });
  } finally {
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
  }
}

function context(root: string): string {
  const path = join(root, ".context");
  mkdirSync(path, { recursive: true });
  return path;
}

function subject(root: string, name: string, status: string, body = ""): string {
  const path = join(context(root), name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "index.md"), `---\nstatus: ${status}\n---\n${body}`);
  return path;
}

function commit(root: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["-c", "user.email=t@example.test", "-c", "user.name=t", "commit", "-qm", message], { cwd: root });
}

describe("save-preflight", () => {
  it("returns structured failures for a non-repo and for absent stored context", () => {
    const a = fixture(false);
    const b = fixture();
    try {
      expect(run(a.root, a)).toMatchObject({ code: 1, payload: { error: expect.any(String) } });
      expect(run(b.root, b)).toEqual({ code: 3, payload: { error: "no stored or projected context" } });
    } finally { a.cleanup(); b.cleanup(); }
  });

  it("reports ambiguity and lets --subject disambiguate", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.alpha", "active");
      subject(f.root, "2026-08-21.beta", "active");
      const ambiguous = run(f.root, f);
      expect(ambiguous.code).toBe(2);
      expect(ambiguous.payload).toMatchObject({ error: "ambiguous subject" });
      expect(ambiguous.payload.suggested_subject).toMatch(/^\d{4}-\d{2}-\d{2}\.x$/);
      expect(ambiguous.payload.subject_candidates?.map((candidate) => candidate.name)).toEqual([
        "2026-08-21.beta", "2026-08-20.alpha",
      ]);
      const selected = run(f.root, f, ["--subject", "2026-08-21.beta", "--json"]);
      expect(selected.code).toBe(0);
      expect(selected.payload.subject).toMatchObject({ name: "2026-08-21.beta", status: "active", created: false });
    } finally { f.cleanup(); }
  });

  it("chooses the active subject while still listing completed subjects", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.active", "active");
      subject(f.root, "2026-08-26.completed", "completed");
      const result = run(f.root, f);
      expect(result.code).toBe(0);
      expect(result.payload.subject.name).toBe("2026-08-20.active");
      expect(result.payload.subject_candidates).toEqual([
        { name: "2026-08-26.completed", status: "completed" },
        { name: "2026-08-20.active", status: "active" },
      ]);
    } finally { f.cleanup(); }
  });

  it("reports stale session hints without using them", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.real", "active");
      const workflow = join(f.root, ".context/workflow");
      mkdirSync(workflow);
      writeFileSync(join(workflow, "current-session.json"), JSON.stringify({ started_at: "2026-08-26T10:00:00Z", subject: "stale", memory_file: "old.md" }));
      const hint = run(f.root, f).payload.session_hint;
      expect(hint).toMatchObject({ present: true, used: false, started_at: "2026-08-26T10:00:00Z", subject: "stale", memory_file: "old.md" });
      expect(hint.stale_reasons).toContain("no writer since the 2026-06-05 extension slim-down");
    } finally { f.cleanup(); }
  });

  it.each([
    ["- 2026-08-26 — [Title](x.md) — `completed`\n\n  - detail\n", "two-line"],
    ["- 2026-05-08 | `x.md` | domains: []\n", "single-line"],
    ["", "empty"],
  ])("classifies memory index shape", (contents, shape) => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.x", "active");
      mkdirSync(join(f.root, ".context/memory"));
      writeFileSync(join(f.root, ".context/memory/index.md"), contents);
      expect(run(f.root, f).payload.memory_index.first_entry_shape).toBe(shape);
    } finally { f.cleanup(); }
  });

  it("reads hindsight backend and defaults missing config to null", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.x", "active");
      let result = run(f.root, f).payload.memory_backend;
      expect(result).toMatchObject({ backend: null, expect_retain: false });
      const config = join(f.home, ".omp/agent/config.yml");
      mkdirSync(dirname(config), { recursive: true });
      writeFileSync(config, "memory:\n  backend: hindsight\n");
      result = run(f.root, f).payload.memory_backend;
      expect(result).toMatchObject({ backend: "hindsight", expect_retain: true });
    } finally { f.cleanup(); }
  });

  it("gathers artifacts and leaves fixture files unchanged", () => {
    const f = fixture();
    try {
      const dir = subject(f.root, "2026-08-20.work", "active");
      const plan = join(dir, "plan-work.md");
      const text = "---\nstatus: active\nmemory: [../memory/a.md]\nspec: spec-work.md\n---\n# Plan\n\n## User Goal\n\n";
      writeFileSync(plan, text);
      writeFileSync(join(f.root, ".context/backlog.md"), "# legacy\n");
      writeFileSync(join(f.root, ".context/Research_Memory_Index.md"), "# idx\n");
      writeFileSync(join(f.root, ".context/_QRPRO.md"), "");
      writeFileSync(join(f.root, ".context/plan-orphan.md"), "# plan\n");
      writeFileSync(join(f.root, ".context/draft-commit.md"), "# draft\n");
      const before = statSync(plan).mtimeMs;
      const payload = run(f.root, f).payload;
      expect(payload.user_goal.missing).toContain("plan-work.md");
      expect(payload.plans[0]).toMatchObject({ path: "plan-work.md", memory_ref_style: "yaml", memory_refs: ["../memory/a.md"], spec: "spec-work.md" });
      expect(payload.loose_artifacts).toEqual([".context/draft-commit.md", ".context/plan-orphan.md"]);
      expect(readFileSync(plan, "utf8")).toBe(text);
      expect(statSync(plan).mtimeMs).toBe(before);
    } finally { f.cleanup(); }
  });

  it("synthesizes a subject from the branch when no folders exist", () => {
    const f = fixture();
    try {
      context(f.root);
      const payload = run(f.root, f).payload;
      expect(payload.subject.created).toBe(true);
      expect(payload.subject.name).toMatch(/^\d{4}-\d{2}-\d{2}\.x$/);
      expect(payload.subject.path).toBe(`.context/${payload.subject.name}`);
    } finally { f.cleanup(); }
  });

  it("creates a missing --subject folder name instead of failing", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.alpha", "active");
      const dated = run(f.root, f, ["--subject", "2026-08-26.b-save-improved"]);
      expect(dated.code).toBe(0);
      expect(dated.payload.subject).toMatchObject({
        name: "2026-08-26.b-save-improved",
        path: ".context/2026-08-26.b-save-improved",
        status: null,
        created: true,
      });
      const slugged = run(f.root, f, ["--subject", "b-save-improved"]);
      expect(slugged.code).toBe(0);
      expect(slugged.payload.subject).toMatchObject({
        name: expect.stringMatching(/^\d{4}-\d{2}-\d{2}\.b-save-improved$/),
        created: true,
      });
    } finally { f.cleanup(); }
  });
});

/** An adapter with no `.context` projection at all: discovery and reads come from stored state. */
function adapterFixture(adapter: "sqlite" | "external-files"): Fixture {
  const f = fixture();
  const storage = adapter === "sqlite"
    ? `storage:\n  adapter: sqlite\n  database: ${join(f.root, "state.sqlite")}\n`
    : `storage:\n  adapter: external-files\n  root: ${join(f.root, "external")}\n`;
  writeFileSync(f.config, `version: 1\n${storage}`);
  return f;
}

describe("save-preflight adapter authority", () => {
  it("discovers and reads an adapter-only subject with no .context directory", async () => {
    const f = adapterFixture("sqlite");
    try {
      await seed(f, [
        { kind: "subject-index", subjectId: "2026-08-20.stored", logicalName: "index.md", text: "---\nstatus: active\n---\n# Stored\n" },
        { kind: "plan", subjectId: "2026-08-20.stored", logicalName: "plan-stored.md", text: "---\nstatus: active\nmemory: [../memory/a.md]\n---\n# Plan\n\n## User Goal\n\n" },
      ]);
      expect(existsSync(join(f.root, ".context"))).toBe(false);
      const result = run(f.root, f);
      expect(result.code).toBe(0);
      expect(result.payload.subject).toMatchObject({ name: "2026-08-20.stored", status: "active", created: false });
      expect(result.payload.plans).toEqual([
        expect.objectContaining({ path: "plan-stored.md", memory_ref_style: "yaml", memory_refs: ["../memory/a.md"] }),
      ]);
      expect(result.payload.storage_snapshot?.[".context/2026-08-20.stored/index.md"]).toMatchObject({
        origin: "stored",
        kind: "subject-index",
        logical_name: "index.md",
      });
    } finally { f.cleanup(); }
  });

  it("captures the current stored revision and text for CAS on every snapshot entry", async () => {
    const f = adapterFixture("sqlite");
    try {
      const body = "---\nstatus: draft\n---\n# Revision one\n";
      await seed(f, [{ kind: "subject-index", subjectId: "2026-08-20.cas", logicalName: "index.md", text: body }]);
      const first = run(f.root, f).payload.storage_snapshot?.[".context/2026-08-20.cas/index.md"];
      expect(first).toMatchObject({ origin: "stored", text: body });
      expect(first?.revision).toMatch(/^[0-9a-f-]{36}$/);

      await seed(f, [{ kind: "subject-index", subjectId: "2026-08-20.cas", logicalName: "index.md", text: "---\nstatus: completed\n---\n# Revision two\n" }]);
      const second = run(f.root, f).payload.storage_snapshot?.[".context/2026-08-20.cas/index.md"];
      expect(second).toMatchObject({ origin: "stored", text: "---\nstatus: completed\n---\n# Revision two\n" });
      expect(second?.revision).not.toBe(first?.revision);
    } finally { f.cleanup(); }
  });

  it("never lets a stale local file override stored state", async () => {
    const f = adapterFixture("sqlite");
    try {
      const stored = "---\nstatus: active\n---\n# Stored wins\n";
      await seed(f, [{ kind: "subject-index", subjectId: "2026-08-20.authoritative", logicalName: "index.md", text: stored }]);
      const dir = subject(f.root, "2026-08-20.authoritative", "completed", "# Stale local copy\n");
      writeFileSync(join(dir, "plan-stale.md"), "---\nstatus: active\n---\n# stale plan\n");
      const result = run(f.root, f);
      expect(result.code).toBe(0);
      expect(result.payload.subject).toMatchObject({ name: "2026-08-20.authoritative", status: "active", created: false });
      const snapshot = result.payload.storage_snapshot;
      expect(snapshot?.[".context/2026-08-20.authoritative/index.md"]).toMatchObject({ origin: "stored", text: stored });
      // A non-repo adapter never enumerates the projection, so a local-only plan is
      // not discoverable at all and cannot influence plans or phases.
      expect(snapshot?.[".context/2026-08-20.authoritative/plan-stale.md"]).toBeUndefined();
      expect(result.payload.plans).toEqual([]);
    } finally { f.cleanup(); }
  });

  it("carries explicit empty authority for referenced paths that have no stored source", async () => {
    const f = adapterFixture("external-files");
    try {
      await seed(f, [{ kind: "subject-index", subjectId: "2026-08-20.absent", logicalName: "index.md", text: "---\nstatus: active\n---\n" }]);
      const snapshot = run(f.root, f).payload.storage_snapshot;
      expect(snapshot?.[".context/memory/index.md"]).toMatchObject({ revision: null, text: "", origin: null });
      expect(snapshot?.[".context/backlog/todo.md"]).toMatchObject({ revision: null, text: "", origin: null });
      expect(snapshot?.[".context/workflow/current-session.json"]).toMatchObject({ revision: null, text: "", origin: null });
    } finally { f.cleanup(); }
  });

  it("reads backlog and memory authority from the store rather than disk", async () => {
    const f = adapterFixture("sqlite");
    try {
      await seed(f, [
        { kind: "subject-index", subjectId: "2026-08-20.backlog", logicalName: "index.md", text: "---\nstatus: active\n---\n" },
        { kind: "backlog", subjectId: "backlog", logicalName: "todo.md", text: "## Open\n\n- [ ] [Alpha](items/alpha.md)\n" },
        { kind: "backlog", subjectId: "backlog", logicalName: "items/alpha.md", text: "---\nstatus: active\nrelated: [plan-backlog.md]\n---\n# Alpha\n" },
        { kind: "memory", subjectId: "memory", logicalName: "index.md", text: "- 2026-08-26 — [Title](x.md) — `completed`\n\n  - detail\n" },
      ]);
      const payload = run(f.root, f).payload;
      expect(payload.backlog?.open_items).toEqual([
        { slug: "alpha", label: "Alpha", link: "items/alpha.md", related: ["plan-backlog.md"], status: "active" },
      ]);
      expect(payload.memory_index?.first_entry_shape).toBe("two-line");
      expect(payload.storage_snapshot?.[".context/backlog/items/alpha.md"]).toMatchObject({ origin: "stored" });
    } finally { f.cleanup(); }
  });

  it("ignores an unusable local export when a non-repo adapter has the subject", async () => {
    const f = adapterFixture("external-files");
    try {
      await seed(f, [{ kind: "plan", subjectId: "2026-08-20.adapter-only", logicalName: "plan-x.md", text: "---\nstatus: active\n---\n# Plan\n" }]);
      writeFileSync(join(f.root, ".context"), "not an export directory");
      const result = run(f.root, f, ["--subject", "2026-08-20.adapter-only"]);
      expect(result.code).toBe(0);
      expect(result.payload.subject).toMatchObject({ name: "2026-08-20.adapter-only", created: false });
      expect(result.payload.plans).toMatchObject([{ path: "plan-x.md" }]);
    } finally { f.cleanup(); }
  });

  it("keeps nested logical names exact and never projects subject-scoped SQL facts", async () => {
    const f = adapterFixture("sqlite");
    try {
      await seed(f, [
        { kind: "subject-index", subjectId: "2026-08-20.identity", logicalName: "index.md", text: "---\nstatus: active\n---\n" },
        { kind: "plan", subjectId: "2026-08-20.identity", logicalName: "notes/plan-nested.md", text: "---\nstatus: active\n---\n# Nested\n" },
        { kind: "memory", subjectId: "2026-08-20.identity", logicalName: "memory/fact.md", text: "Private fact without a Markdown projection" },
      ]);
      const result = run(f.root, f);
      expect(result.code).toBe(0);
      expect(result.payload.plans).toEqual([]);
      expect(result.payload.storage_snapshot[".context/2026-08-20.identity/notes/plan-nested.md"]).toMatchObject({ logical_name: "notes/plan-nested.md", origin: "stored" });
      expect(result.payload.storage_snapshot[".context/2026-08-20.identity/plan-nested.md"]).toBeUndefined();
      expect(result.payload.storage_snapshot[".context/2026-08-20.identity/memory/fact.md"]).toBeUndefined();
      expect(result.payload.storage_snapshot[".context/memory/memory/fact.md"]).toBeUndefined();
    } finally { f.cleanup(); }
  });

  it("fails closed when the configured store cannot be reached", () => {
    const f = fixture();
    try {
      context(f.root);
      subject(f.root, "2026-08-20.present", "active");
      writeFileSync(f.config, "version: 1\nstorage:\n  adapter: postgres\n  connection_env: PREFLIGHT_TEST_PG\n");
      const result = run(f.root, f);
      expect(result.code).toBe(1);
      expect(String(result.payload.error)).toMatch(/^storage unavailable: /);
      expect(result.payload.subject).toBeUndefined();
      expect(result.payload.storage_snapshot).toBeUndefined();
    } finally {
      delete process.env.PREFLIGHT_TEST_PG;
      f.cleanup();
    }
  });

  it("fails closed on an invalid storage config instead of reading local files", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.present", "active");
      writeFileSync(f.config, "version: 1\nstorage:\n  adapter: not-an-adapter\n");
      const result = run(f.root, f);
      expect(result.code).toBe(1);
      expect(String(result.payload.error)).toMatch(/^storage unavailable: /);
    } finally { f.cleanup(); }
  });

  it("reports only Git-tracked deletions that have a captured canonical revision", async () => {
    // A tracked deletion is authoritative intent only where `.context` is the
    // editable projection, so this runs against the repo-files adapter.
    const f = fixture();
    try {
      const index = "---\nstatus: active\n---\n# tracked\n";
      const tracked = subject(f.root, "2026-08-20.tracked", "active", "# tracked\n");
      mkdirSync(join(f.root, ".context/memory"), { recursive: true });
      writeFileSync(join(f.root, ".context/memory/note.md"), "# note\n");
      commit(f.root, "context");
      await seed(f, [
        { kind: "subject-index", subjectId: "2026-08-20.tracked", logicalName: "index.md", text: index },
        { kind: "memory", subjectId: "memory", logicalName: "note.md", text: "# note\n" },
      ]);
      rmSync(join(tracked, "index.md"));
      rmSync(join(f.root, ".context/memory/note.md"));
      const deleted = run(f.root, f).payload.deleted_sources;
      expect(deleted.map((entry) => entry.path)).toEqual([
        ".context/2026-08-20.tracked/index.md",
        ".context/memory/note.md",
      ]);
      expect(deleted.map((entry) => entry.kind)).toEqual(["subject-index", "memory"]);
      for (const entry of deleted) expect(entry.revision).toMatch(/^[0-9a-f-]{36}$/);
    } finally { f.cleanup(); }
  });

  it("never infers a deletion for a non-repo adapter", async () => {
    const f = adapterFixture("sqlite");
    try {
      const dir = subject(f.root, "2026-08-20.tracked", "active", "# tracked\n");
      commit(f.root, "context");
      await seed(f, [{ kind: "subject-index", subjectId: "2026-08-20.tracked", logicalName: "index.md", text: "---\nstatus: active\n---\n" }]);
      rmSync(join(dir, "index.md"));
      expect(run(f.root, f).payload.deleted_sources).toEqual([]);
    } finally { f.cleanup(); }
  });

  it("keeps deletions out of scope when they belong to another subject", async () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.mine", "active", "# mine\n");
      const other = subject(f.root, "2026-08-21.other", "active", "# other\n");
      commit(f.root, "context");
      await seed(f, [
        { kind: "subject-index", subjectId: "2026-08-20.mine", logicalName: "index.md", text: "---\nstatus: active\n---\n" },
        { kind: "subject-index", subjectId: "2026-08-21.other", logicalName: "index.md", text: "---\nstatus: active\n---\n" },
      ]);
      rmSync(join(other, "index.md"));
      const payload = run(f.root, f, ["--subject", "2026-08-20.mine"]).payload;
      expect(payload.deleted_sources).toEqual([]);
    } finally { f.cleanup(); }
  });

  it("keeps repo-files readable through its editable projection with no stored revision", () => {
    const f = fixture();
    try {
      const dir = subject(f.root, "2026-08-20.projected", "active");
      writeFileSync(join(dir, "plan-projected.md"), "---\nstatus: active\n---\n# Projected\n\n## User Goal\n\n");
      const snapshot = run(f.root, f).payload.storage_snapshot;
      expect(snapshot?.[".context/2026-08-20.projected/index.md"]).toMatchObject({ origin: "repo-projection", revision: null });
      expect(snapshot?.[".context/2026-08-20.projected/plan-projected.md"]).toMatchObject({ origin: "repo-projection", text: expect.stringContaining("# Projected") });
    } finally { f.cleanup(); }
  });
});
