import { describe, expect, it } from "vitest";
import { rememberSqlMemory } from "./remember.js";
import { correctSqlMemory } from "./index.js";
import type { MigrationPool } from "./migrations.js";
import type { SqlGitRunner } from "./identity.js";

const origin = "git@github.com:acme/project.git";
const email = "you@example.test";
const commit = "298c503bb9edb4fa87c26cb7f7d1fda99643e66fd1";
const gitOutputs = {
  "config user.email": email,
  "remote get-url origin": origin,
  "rev-parse --abbrev-ref HEAD": "main",
  "rev-parse HEAD": commit,
};

function runner(outputs: Record<string, string | null>): SqlGitRunner {
  return async (args) => outputs[args.slice(2).join(" ")] ?? null;
}

interface StoredMemory {
  id: string;
  author: string;
  project: string;
  branch_name: string | null;
  commit_sha: string | null;
  body: string;
  context: { source_key: string; subject: string; phase: string | null; source: string };
  category: string;
  seq: number;
  invalid_at: string | null;
  superseded_by: string | null;
}

type QueryRows = { rows: Array<Record<string, unknown>> };

interface MemoryStore {
  pool: MigrationPool;
  memories: StoredMemory[];
  users: Set<string>;
  projects: Map<string, string>;
  categories: Map<string, string>;
  log: string[];
  insertedCount: () => number;
}

/** Stateful query fixture: lookups inspect persisted rows, not canned return ids. */
function memoryStore(): MemoryStore {
  const memories: StoredMemory[] = [];
  const users = new Set<string>();
  const projects = new Map<string, string>();
  const categories = new Map<string, string>([["project", "active"], ["decision", "active"]]);
  const log: string[] = [];
  let snapshot: StoredMemory[] | null = null;
  let inserts = 0;

  function memoryLookup(text: string, values: unknown[]): QueryRows {
    const project = projects.get(String(values[0]));
    if (text.includes("m.context @>")) {
      const key = JSON.parse(String(values[1])).source_key;
      return { rows: memories.filter((row) => row.project === project && row.invalid_at === null && row.context.source_key === key).map((row) => ({ id: row.id })) };
    }
    const row = memories.find((item) => item.project === project && item.id === values[1]);
    if (!row) return { rows: [] };
    if (text.includes("superseded_by::text")) return { rows: [{ successor: row.superseded_by }] };
    return { rows: row.invalid_at === null ? [{ id: row.id }] : [] };
  }

  function lookup(text: string, values: unknown[]): QueryRows | undefined {
    if (text.includes("FROM categories")) {
      return { rows: [...categories].filter(([, status]) => status === "active").map(([slug]) => ({ slug })) };
    }
    if (text.startsWith("SELECT id::text AS id FROM projects")) {
      const id = projects.get(String(values[0]));
      return { rows: id ? [{ id }] : [] };
    }
    if (text.startsWith("SELECT coalesce(max(seq)")) {
      const rows = memories.filter((row) => row.project === projects.get(String(values[0])) && row.invalid_at === null);
      return { rows: [{ bigint: Math.max(0, ...rows.map((row) => row.seq)) }] };
    }
    if (text.startsWith("SELECT m.")) return memoryLookup(text, values);
    return undefined;
  }

  function insert(text: string, values: unknown[]): QueryRows | undefined {
    if (text.startsWith("INSERT INTO users")) {
      users.add(String(values[0]));
      return { rows: [] };
    }
    if (text.startsWith("INSERT INTO projects")) {
      const url = String(values[0]);
      if (!projects.has(url)) projects.set(url, `project-${projects.size + 1}`);
      return { rows: [] };
    }
    if (!text.startsWith("INSERT INTO memories")) return undefined;
    if (!users.has(String(values[0]))) throw new Error("missing author");
    if (!Array.from(projects.values()).includes(String(values[1]))) throw new Error("missing project");
    const id = `memory-${++inserts}`;
    memories.push({
      id, author: String(values[0]), project: String(values[1]),
      branch_name: values[2] as string | null, commit_sha: values[3] as string | null,
      body: String(values[4]), context: JSON.parse(String(values[5])),
      category: String(values[6]), seq: Number(values[7]), invalid_at: null, superseded_by: null,
    });
    return { rows: [{ id }] };
  }

  function update(text: string, values: unknown[]): QueryRows | undefined {
    if (!text.startsWith("UPDATE memories")) return undefined;
    if (!snapshot) throw new Error("correction mutation outside transaction");
    if (text.includes("SET invalid_at = now()")) {
      const row = memories.find((item) => item.id === values[0] && item.project === values[1] && item.invalid_at === null);
      if (!row) return { rows: [] };
      row.invalid_at = "now";
      return { rows: [{ id: row.id }] };
    }
    const row = memories.find((item) => item.id === values[1] && item.project === values[2] && item.invalid_at !== null && item.superseded_by === null);
    if (!row) return { rows: [] };
    row.superseded_by = String(values[0]);
    return { rows: [{ id: row.id }] };
  }

  function query(text: string, values: unknown[] = []): QueryRows {
    log.push(text);
    const result = lookup(text, values) ?? insert(text, values) ?? update(text, values);
    if (!result) throw new Error(`Unhandled fixture query: ${text}`);
    return result;
  }

  const pool: MigrationPool = {
    async query(text, values) { return query(text, values); },
    async connect() {
      return {
        async query(text, values) {
          if (text === "BEGIN") { snapshot = structuredClone(memories); log.push(text); return { rows: [] }; }
          if (text === "ROLLBACK") {
            memories.splice(0, memories.length, ...snapshot!);
            snapshot = null;
            log.push(text);
            return { rows: [] };
          }
          if (text === "COMMIT") { snapshot = null; log.push(text); return { rows: [] }; }
          if (text.startsWith("SET ")) return { rows: [] };
          return query(text, values);
        },
        release() {},
      };
    },
  };
  return { pool, memories, users, projects, categories, log, insertedCount: () => inserts };
}

function save(store: MemoryStore, body: string, extra: { previousId?: string; category?: string; phase?: string | null } = {}) {
  return rememberSqlMemory({
    pool: store.pool, cwd: "/cwd", subject: "subject-a", body, git: runner(gitOutputs),
    correct: correctSqlMemory, ...extra,
  });
}

describe("rememberSqlMemory", () => {
  it("persists the body with tool-owned identity and context, and retries without another row", async () => {
    const store = memoryStore();
    const first = await save(store, "first fact", { phase: "phase-1" });
    const retry = await save(store, "first fact", { phase: "phase-1" });
    expect(retry).toBe(first);
    expect(store.insertedCount()).toBe(1);
    expect(store.memories).toEqual([{
      id: first, author: email, project: store.projects.get(origin), branch_name: "main", commit_sha: commit,
      body: "first fact", context: {
        source_key: expect.any(String), subject: "subject-a", phase: "phase-1", source: "sql-memory-remember",
      }, category: "project", seq: 1, invalid_at: null, superseded_by: null,
    }]);
  });

  it("keeps distinct bodies and source keys separate in the same subject", async () => {
    const store = memoryStore();
    const first = await save(store, "one");
    const second = await save(store, "two");
    expect(second).not.toBe(first);
    expect(store.memories.map((row) => row.body)).toEqual(["one", "two"]);
    expect(store.memories[0].context.source_key).not.toBe(store.memories[1].context.source_key);
    expect(await save(store, "one")).toBe(first);
    expect(store.insertedCount()).toBe(2);
    expect(store.memories.map((row) => row.seq)).toEqual([1, 2]);
  });

  it("retries a correction with one successor, preserving the predecessor body and linkage", async () => {
    const store = memoryStore();
    const previousId = await save(store, "before");
    const id = await save(store, "after", { previousId });
    expect(await save(store, "after", { previousId })).toBe(id);
    expect(store.insertedCount()).toBe(2);
    expect(store.memories).toHaveLength(2);
    expect(store.memories[0]).toMatchObject({ id: previousId, body: "before", invalid_at: "now", superseded_by: id });
    expect(store.memories[1]).toMatchObject({ id, body: "after", invalid_at: null, superseded_by: null });
    expect(store.memories[0].context.source_key).not.toBe(store.memories[1].context.source_key);
    const begin = store.log.indexOf("BEGIN");
    const claim = store.log.findIndex((line) => line.startsWith("UPDATE memories SET invalid_at"));
    const link = store.log.findIndex((line) => line.startsWith("UPDATE memories SET superseded_by"));
    expect(begin).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(begin);
    expect(link).toBeGreaterThan(claim);
    expect(store.log.indexOf("COMMIT")).toBeGreaterThan(link);
  });

  it("rejects a seeded category that is now a candidate before any insert", async () => {
    const store = memoryStore();
    store.categories.set("project", "candidate");
    await expect(save(store, "fact")).rejects.toThrow(/active category/);
    expect(store.users.size).toBe(0);
    expect(store.projects.size).toBe(0);
    expect(store.memories).toEqual([]);
  });

  it("accepts a newly active category rather than restricting saves to migration seeds", async () => {
    const store = memoryStore();
    store.categories.set("new-category", "active");
    const id = await save(store, "fact", { category: "new-category" });
    expect(store.memories).toMatchObject([{ id, body: "fact", category: "new-category", invalid_at: null }]);
  });

  it("rejects an unknown category before any insert", async () => {
    const store = memoryStore();
    await expect(save(store, "fact", { category: "unknown" })).rejects.toThrow(/active category/);
    expect(store.users.size).toBe(0);
    expect(store.projects.size).toBe(0);
    expect(store.memories).toEqual([]);
  });

  it.each(["config user.email", "remote get-url origin"])("performs no queries or writes when %s is missing", async (missing) => {
    const store = memoryStore();
    await expect(rememberSqlMemory({
      pool: store.pool, cwd: "/cwd", body: "fact", subject: "subject-a", git: runner({ ...gitOutputs, [missing]: null }),
    })).rejects.toThrow(missing === "config user.email" ? /user.email/ : /origin/);
    expect(store.log).toEqual([]);
    expect(store.users.size).toBe(0);
    expect(store.projects.size).toBe(0);
    expect(store.memories).toEqual([]);
  });

  it("performs no queries or writes when the git runner throws", async () => {
    const store = memoryStore();
    await expect(rememberSqlMemory({
      pool: store.pool, cwd: "/cwd", body: "fact", subject: "subject-a",
      git: async () => { throw new Error("git failed"); },
    })).rejects.toThrow("git failed");
    expect(store.log).toEqual([]);
    expect(store.users.size).toBe(0);
    expect(store.projects.size).toBe(0);
    expect(store.memories).toEqual([]);
  });
});
