import { DatabaseSync } from "node:sqlite";
import type { ArtifactKey, ArtifactRevision } from "../storage/contract.js";
import { defineStorageConformance, type ConformanceBackend, type ConformanceStore } from "../storage/conformance.js";
import { isRevisionVisible } from "../storage/visibility.js";


const sqliteFixture: ConformanceBackend = {
  name: "throwaway node:sqlite",
  async create() {
    const database = new DatabaseSync(":memory:");
    database.exec(`CREATE TABLE revisions (
      project_id TEXT NOT NULL, subject_id TEXT NOT NULL, kind TEXT NOT NULL, logical_name TEXT NOT NULL, branch_id TEXT NOT NULL,
      revision TEXT NOT NULL, bytes BLOB NOT NULL, sha256 TEXT NOT NULL, author TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL,
      links TEXT NOT NULL, PRIMARY KEY(project_id, subject_id, kind, logical_name, branch_id, revision)
    );
    CREATE TABLE current_pointer (
      project_id TEXT NOT NULL, subject_id TEXT NOT NULL, kind TEXT NOT NULL, logical_name TEXT NOT NULL, branch_id TEXT NOT NULL, revision TEXT NOT NULL,
      PRIMARY KEY(project_id, subject_id, kind, logical_name, branch_id)
    );
    CREATE TABLE subject_lifecycle (subject_id TEXT PRIMARY KEY, revision TEXT NOT NULL, state TEXT NOT NULL, evidence TEXT NOT NULL);`);
    const keyColumns = (key: ArtifactKey) => [key.projectId, key.subjectId, key.kind, key.logicalName, key.branchId ?? ""];
    const decode = (row: Record<string, unknown>, key: ArtifactKey): ArtifactRevision => ({ key, revision: String(row.revision), bytes: new Uint8Array(row.bytes as ArrayBuffer), sha256: String(row.sha256), author: String(row.author), source: String(row.source), createdAt: String(row.created_at), links: JSON.parse(String(row.links)) as ArtifactKey[] });
    const store: ConformanceStore = {
      async read(key) {
        const row = database.prepare(`SELECT r.revision, r.bytes, r.sha256, r.author, r.source, r.created_at, r.links
          FROM revisions r JOIN current_pointer p USING(project_id, subject_id, kind, logical_name, branch_id, revision)
          WHERE r.project_id=? AND r.subject_id=? AND r.kind=? AND r.logical_name=? AND r.branch_id=?`).get(...keyColumns(key)) as Record<string, unknown> | undefined;
        return row ? decode(row, key) : null;
      },
      async list(query) {
        const rows = database.prepare(`SELECT r.project_id, r.subject_id, r.kind, r.logical_name, r.branch_id, r.revision, r.bytes, r.sha256, r.author, r.source, r.created_at, r.links
          FROM revisions r JOIN current_pointer p USING(project_id, subject_id, kind, logical_name, branch_id, revision)
          WHERE r.project_id=? ORDER BY r.created_at`).all(query.projectId) as Record<string, unknown>[];
        const visible = rows.map((row) => decode(row, { projectId: String(row.project_id), subjectId: String(row.subject_id), kind: String(row.kind) as ArtifactKey["kind"], logicalName: String(row.logical_name), branchId: String(row.branch_id) }))
          .filter((item) => (query.subjectId === undefined || item.key.subjectId === query.subjectId)
            && (query.kind === undefined || item.key.kind === query.kind)
            && (query.logicalNamePrefix === undefined || item.key.logicalName.startsWith(query.logicalNamePrefix))
            && isRevisionVisible(item, { projectId: query.projectId, branchId: query.branchId, publishedRevisionIds: new Set(query.publishedRevisionIds), worktreeId: query.worktreeId, runId: query.runId }));
        return query.limit === undefined ? visible : visible.slice(0, query.limit);
      },
      async writeBatch(revisions) {
        database.exec("BEGIN IMMEDIATE");
        try {
          for (const item of revisions) {
            const columns = keyColumns(item.key);
            const pointer = database.prepare(`SELECT revision FROM current_pointer WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=?`).get(...columns) as { revision: string } | undefined;
            if (item.expectedRevision !== undefined && item.expectedRevision !== (pointer?.revision ?? null)) throw new Error("stale revision rejected");
            database.prepare(`INSERT INTO revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...columns, item.revision, item.bytes, item.sha256, item.author, item.source, item.createdAt, JSON.stringify(item.links));
            database.prepare(`INSERT INTO current_pointer VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, subject_id, kind, logical_name, branch_id) DO UPDATE SET revision=excluded.revision`).run(...columns, item.revision);
          }
          database.exec("COMMIT");
          return revisions;
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
      },
      async correct(input) {
        const current = await this.read(input.key);
        if (current?.revision !== input.predecessorRevision) throw new Error("stale correction rejected");
        if (input.replacement === null) {
          database.prepare("DELETE FROM current_pointer WHERE project_id=? AND subject_id=? AND kind=? AND logical_name=? AND branch_id=?").run(...keyColumns(input.key));
          return null;
        }
        await this.writeBatch([input.replacement]);
        return input.replacement;
      },
      async transition(input) {
        const current = database.prepare("SELECT revision, state FROM subject_lifecycle WHERE subject_id=?").get(input.subjectId) as { revision: string; state: string } | undefined;
        const state = current?.state ?? "active";
        const revision = current?.revision ?? input.fromRevision;
        if (revision !== input.fromRevision || state !== input.expectedState) throw new Error("stale lifecycle transition refused");
        if (input.nextState === "completed" && input.evidence.length === 0) throw new Error("completion requires evidence");
        const nextRevision = `${input.subjectId}-r${Number(revision.split("-r").at(-1) ?? 1) + 1}`;
        database.prepare(`INSERT INTO subject_lifecycle VALUES (?, ?, ?, ?) ON CONFLICT(subject_id) DO UPDATE SET revision=excluded.revision, state=excluded.state, evidence=excluded.evidence`).run(input.subjectId, nextRevision, input.nextState, JSON.stringify(input.evidence));
        return nextRevision;
      },
    };
    return { store, dispose: () => database.close() };
  },
};

defineStorageConformance(sqliteFixture);
