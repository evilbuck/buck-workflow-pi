/**
 * Schema-aware column map for sql-memory. The map is intentionally hand-written
 * to mirror `migrations/001_initial_schema.sql`. It powers both the tool description
 * (the `xd://sql_memory` document) and the model-facing `fix` strings on Postgres
 * failures and gate denials.
 */

export interface ColumnRef {
  table: string;
  columns: string[];
  /** Columns that join to another table via a uuid FK. Used to spot guessed joins. */
  joined?: string[];
}

export const COLUMNS: Record<string, ColumnRef> = {
  users: {
    table: "users",
    columns: ["email", "skill_weight"],
    joined: ["email is text and the primary key; there is no users.id"],
  },
  projects: {
    table: "projects",
    columns: ["id", "origin_url", "name"],
    joined: ["id is uuid and the primary key"],
  },
  categories: {
    table: "categories",
    columns: ["slug", "description", "status"],
  },
  memories: {
    table: "memories",
    columns: [
      "id",
      "author",
      "project",
      "branch_name",
      "commit_sha",
      "body",
      "context",
      "category",
      "seq",
      "created_at",
      "valid_at",
      "invalid_at",
      "superseded_by",
      "value_score",
      "search",
    ],
    joined: [
      "author is text, not uuid (FK to users.email)",
      "project is uuid and may be null (FK to projects.id)",
      "id, superseded_by are uuid; compare uuid to an untyped literal, not a text cast",
    ],
  },
  tags: { table: "tags", columns: ["id", "slug"] },
  memory_tags: { table: "memory_tags", columns: ["memory_id", "tag_id"] },
  memory_ranks: { table: "memory_ranks", columns: ["id", "memory_id", "rater", "score", "created_at"] },
  memory_embeddings: {
    table: "memory_embeddings",
    columns: ["memory_id", "model", "dims", "embedding"],
  },
  schema_migrations: {
    table: "schema_migrations",
    columns: ["version", "applied_at", "checksum"],
  },
};

export const PUBLIC_TABLES = Object.keys(COLUMNS);

/** Join rules the recall query relies on. Used in the tool description. */
export const JOIN_HINTS = [
  "memories.author (text) joins to users.email",
  "memories.project (uuid) joins to projects.id",
  "memories.invalid_at must be NULL for active rows",
] as const;

export function columnList(table: string): string {
  const entry = COLUMNS[table];
  return entry ? entry.columns.join(", ") : `${table} is not allowlisted`;
}

export function tableRefFromStatement(statement: string): string | null {
  const match = statement.match(/\b(?:FROM|INTO|UPDATE|JOIN)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/i);
  if (!match) return null;
  const table = match[1]!.toLowerCase();
  if (COLUMNS[table]) return table;
  return table;
}

/**
 * Produce a `fix` string for a Postgres failure or gate denial. `kind` covers:
 *  - "missing-column": a column does not exist (e.g. `users.id`, `project_id`).
 *  - "uuid-cast": uuid/text operator error.
 *  - "catalog-deny": gate refusal of information_schema / non-public schema.
 *  - "non-public-schema": gate refusal of a non-public schema reference.
 *  - "unknown-table": gate refusal of a non-allowlisted table.
 *  - "denied": any other gate denial; recommends `remember`.
 *  - "write-replace": succeeded write gate feedback for `INSERT`/`UPDATE`/raw `sql`.
 */
export function fixFor(kind: string, statement: string, error?: { column?: string; table?: string }): string {
  switch (kind) {
    case "missing-column": {
      const table = error?.table?.toLowerCase() ?? tableRefFromStatement(statement) ?? "the referenced table";
      if (table === "users") return "users has no id. users columns: email, skill_weight. Use `SELECT * FROM users WHERE email = $1`.";
      const entry = COLUMNS[table];
      if (entry) return `${table} columns: ${entry.columns.join(", ")}. ${entry.joined?.join(" ") ?? ""}`;
      return `${table} columns are not documented here. Use the column card in the tool description or call \`op: "remember"\` instead of writing INSERT/UPDATE.`;
    }
    case "uuid-cast":
      return "memories.project and memories.id are uuid. Compare to an untyped literal or a bound $1 parameter; never cast the literal to text. To return a uuid column as text, cast it in the select list: `SELECT m.id::text AS id`. For writes, call `op: \"remember\"`.";
    case "catalog-deny":
      return `Schema inspection is denied. The nine public tables are: ${PUBLIC_TABLES.join(", ")}. Call \`op: "remember"\` to write without naming columns.`;
    case "non-public-schema":
      return `Cross-database or non-public schema references are not allowed. The nine public tables are: ${PUBLIC_TABLES.join(", ")}. Use the column card in the tool description, or call \`op: "remember"\` to write without naming columns.`;
    case "unknown-table":
      return `Only the nine public tables are allowlisted: ${PUBLIC_TABLES.join(", ")}. Call \`op: "remember"\` to write without naming columns.`;
    case "denied":
      return "Use the column card in the tool description, or call `op: \"remember\"` to write without naming columns.";
    case "write-replace":
      return `Do not write INSERT/UPDATE directly. Call \`op: "remember"\` and pass body + subject + optional previousId; the tool derives author, project, provenance, seq, source key, context, id, and timestamps. The tool validates category against current active slugs.`;
    case "identity-missing":
      return "remember requires git config user.email and a configured origin. Run `git config user.email \"<you@example.test>\"` and `git remote add origin <url>`, then retry.";
    default:
      return "Use the column card in the tool description, or call `op: \"remember\"` to write without naming columns.";
  }
}

/** Render the column card used in the tool description. */
export function columnCard(): string {
  const lines: string[] = ["Schema (nine public tables):"];
  for (const name of PUBLIC_TABLES) {
    const ref = COLUMNS[name]!;
    lines.push(`- ${ref.table}: ${ref.columns.join(", ")}`);
  }
  lines.push("");
  lines.push("Joins:");
  for (const hint of JOIN_HINTS) lines.push(`- ${hint}`);
  lines.push("");
  lines.push("To save: `op: \"remember\"` with body, subject, optional previousId, phase, category (default \"project\"). Do not assemble INSERT/UPDATE.");
  lines.push("Category must be currently active. Identical subject, phase, body, and previousId reuse the same active memory id; change body or phase for a distinct fact, or use previousId to supersede it.");
  return lines.join("\n");
}