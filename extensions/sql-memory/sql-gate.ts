const MEMORY_TABLES: Record<string, true> = {
  users: true,
  projects: true,
  categories: true,
  memories: true,
  tags: true,
  memory_tags: true,
  memory_ranks: true,
  memory_embeddings: true,
  schema_migrations: true,
};

const DENIED: Record<string, true> = {
  DELETE: true, TRUNCATE: true, DROP: true, ALTER: true, CREATE: true,
  GRANT: true, REVOKE: true, COPY: true, CALL: true, DO: true, EXECUTE: true,
  DBLINK: true, DBLINK_EXEC: true, NEXTVAL: true, SETVAL: true,
};
// Only functions needed for ordinary memory reads/writes. Unknown calls are denied,
// including extension functions that can access other databases or the filesystem.
const SAFE_FUNCTIONS: Record<string, true> = {
  COUNT: true, MAX: true, MIN: true, SUM: true, AVG: true,
  COALESCE: true, NULLIF: true, LOWER: true, UPPER: true,
  NOW: true, CURRENT_TIMESTAMP: true, GEN_RANDOM_UUID: true,
  LENGTH: true, ARRAY_AGG: true, JSONB_AGG: true, TO_TSVECTOR: true,
  TO_TSQUERY: true, PLAINTEXT_TO_TSQUERY: true, TS_RANK: true,
};
const RELATION_INTRODUCERS: Record<string, true> = { FROM: true, JOIN: true, INTO: true, UPDATE: true };
const CLAUSE_ENDS: Record<string, true> = {
  WHERE: true, GROUP: true, HAVING: true, ORDER: true, LIMIT: true,
  OFFSET: true, UNION: true, RETURNING: true,
};

interface Token { value: string; kind: "word" | "symbol" | "literal" | "dollar"; }
interface ScannedToken { token: Token; next: number; }
export type SqlGateResult = { allowed: true } | { allowed: false; reason: string };

function skipLineComment(sql: string, start: number): number {
  let cursor = start + 2;
  while (cursor < sql.length && sql[cursor] !== "\n") cursor++;
  return cursor;
}

function skipBlockComment(sql: string, start: number): number | null {
  let cursor = start + 2;
  let depth = 1;
  while (cursor < sql.length && depth > 0) {
    if (sql.startsWith("/*", cursor)) { depth++; cursor += 2; }
    else if (sql.startsWith("*/", cursor)) { depth--; cursor += 2; }
    else cursor++;
  }
  return depth === 0 ? cursor : null;
}

function scanQuoted(sql: string, start: number): ScannedToken | null {
  const quote = sql[start]!;
  let cursor = start + 1;
  let value = "";
  while (cursor < sql.length) {
    if (sql[cursor] === quote) {
      if (sql[cursor + 1] === quote) { value += quote; cursor += 2; continue; }
      const kind = quote === '"' ? "word" : "literal";
      return { token: { value: quote === '"' ? value.toLowerCase() : value, kind }, next: cursor + 1 };
    }
    // Reject ambiguous strings rather than guessing the server's lexer setting.
    if (sql[cursor] === "\\") return null;
    value += sql[cursor]!;
    cursor++;
  }
  return null;
}

function scanWord(sql: string, start: number): ScannedToken {
  let cursor = start + 1;
  while (cursor < sql.length && /[A-Za-z0-9_$]/.test(sql[cursor]!)) cursor++;
  return { token: { value: sql.slice(start, cursor).toUpperCase(), kind: "word" }, next: cursor };
}

function scanNumber(sql: string, start: number): ScannedToken {
  let cursor = start + 1;
  while (cursor < sql.length && /[A-Za-z0-9_.]/.test(sql[cursor]!)) cursor++;
  return { token: { value: sql.slice(start, cursor), kind: "literal" }, next: cursor };
}

function scanDollarQuote(sql: string, start: number): ScannedToken | null {
  const delimiter = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(start))?.[0];
  if (!delimiter) return null;
  const end = sql.indexOf(delimiter, start + delimiter.length);
  if (end < 0) return null;
  return { token: { value: sql.slice(start + delimiter.length, end), kind: "dollar" }, next: end + delimiter.length };
}

function scanToken(sql: string, start: number, migration: boolean): ScannedToken | null {
  const char = sql[start]!;
  if (char === "'" || char === '"') return scanQuoted(sql, start);
  if (/[A-Za-z_]/.test(char)) return scanWord(sql, start);
  if (/[0-9]/.test(char)) return scanNumber(sql, start);
  if (char === "$" && /[A-Za-z_$]/.test(sql[start + 1] ?? "")) {
    return migration ? scanDollarQuote(sql, start) : null;
  }
  return { token: { value: char, kind: "symbol" }, next: start + 1 };
}

function skipTrivia(sql: string, cursor: number): number | null {
  if (/\s/.test(sql[cursor]!)) return cursor + 1;
  if (sql.startsWith("--", cursor)) return skipLineComment(sql, cursor);
  if (sql.startsWith("/*", cursor)) return skipBlockComment(sql, cursor);
  return cursor;
}

function unsupportedStringPrefix(tokens: Token[]): boolean {
  const last = tokens.at(-1);
  return (last?.kind === "word" && (last.value === "E" || last.value === "U")) || last?.value === "&";
}

function tokenize(sql: string, migration = false): Token[] | null {
  const tokens: Token[] = [];
  let cursor = 0;
  while (cursor < sql.length) {
    const next = skipTrivia(sql, cursor);
    if (next === null) return null;
    if (next !== cursor) { cursor = next; continue; }
    if (sql[cursor] === "'" && unsupportedStringPrefix(tokens)) return null;
    const scanned = scanToken(sql, cursor, migration);
    if (scanned === null) return null;
    tokens.push(scanned.token);
    cursor = scanned.next;
  }
  return tokens;
}

function statementBoundaryError(tokens: Token[]): string | null {
  const semicolons = tokens.filter((token) => token.value === ";").length;
  return semicolons > 1 || (semicolons === 1 && tokens.at(-1)?.value !== ";")
    ? "Only one SQL statement is allowed"
    : null;
}

function deniedStatementError(tokens: Token[]): string | null {
  for (const token of tokens) {
    if (token.kind === "word" && DENIED[token.value]) return `${token.value} statements are not allowed through sql_memory`;
  }
  return null;
}

function supportedStatementError(tokens: Token[]): string | null {
  const first = tokens.find((token) => token.value !== ";");
  if (first?.kind === "word" && ["SELECT", "INSERT", "UPDATE"].includes(first.value)) return null;
  return "Only SELECT, INSERT, or UPDATE statements are allowed";
}

function statementError(tokens: Token[]): string | null {
  return statementBoundaryError(tokens) ?? deniedStatementError(tokens) ?? supportedStatementError(tokens);
}

function isSqlConstruct(tokens: Token[], index: number): boolean {
  const value = tokens[index]!.value;
  if (["INTO", "VALUES", "IN", "AS", "OVER", "FILTER", "EXISTS", "SELECT", "WHERE", "SET"].includes(value)) return true;
  return tokens[index - 1]?.value === "INTO"
    || (tokens[index - 1]?.value === "." && tokens[index - 3]?.value === "INTO");
}

function functionError(tokens: Token[]): string | null {
  for (let index = 0; index < tokens.length - 1; index++) {
    const token = tokens[index]!;
    if (token.kind !== "word" || tokens[index + 1]?.value !== "(") continue;
    if (isSqlConstruct(tokens, index)) continue;
    if (tokens[index - 1]?.value === "." || !SAFE_FUNCTIONS[token.value]) {
      return `Function ${token.value} is not allowlisted`;
    }
  }
  return null;
}

function parsedRelation(tokens: Token[], index: number): { table?: string; error?: string } {
  const introducer = tokens[index]!.value;
  const relation = tokens[index + 1];
  if (!relation || relation.kind !== "word") return { error: `Unparseable relation following ${introducer}` };
  const table = relation.value.toLowerCase();
  const separator = tokens[index + 2]?.value;
  if (separator === "@") return { error: "Cross-database references are not allowed" };
  if (separator !== ".") return { table };
  if (table !== "public") return { error: "Cross-database or non-public schema references are not allowed" };
  return qualifiedRelation(tokens, index + 3);
}

function qualifiedRelation(tokens: Token[], index: number): { table?: string; error?: string } {
  const relation = tokens[index];
  if (!relation || relation.kind !== "word") return { error: "Unparseable qualified relation" };
  if (tokens[index + 1]?.value === ".") return { error: "Three-part database/schema/table references are not allowed" };
  return { table: relation.value.toLowerCase() };
}

function relationError(tokens: Token[], index: number): string | null {
  const parsed = parsedRelation(tokens, index);
  if (parsed.error) return parsed.error;
  const table = parsed.table!;
  if (!MEMORY_TABLES[table]) return `Table ${table} is not allowlisted`;
  return tokens[index]!.value === "FROM" ? commaFromRelationError(tokens, index) : null;
}

function commaFromRelationError(tokens: Token[], index: number): string | null {
  for (let cursor = index + 2; cursor < tokens.length; cursor++) {
    const value = tokens[cursor]!.value;
    if (CLAUSE_ENDS[value]) return null;
    if (value === ",") return "Comma-separated FROM relations are not allowed";
  }
  return null;
}


function relationTargetsError(tokens: Token[]): string | null {
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.kind !== "word" || !RELATION_INTRODUCERS[token.value]) continue;
    const error = relationError(tokens, index);
    if (error) return error;
  }
  return null;
}

export function checkSqlStatement(sql: string): SqlGateResult {
  const scanned = tokenize(sql);
  if (!scanned || scanned.length === 0) return { allowed: false, reason: "SQL statement is empty or unparseable" };
  const tokens = scanned.filter((token) => token.value !== ";");
  const boundaryError = statementError(scanned);
  if (boundaryError) return { allowed: false, reason: boundaryError };
  const callError = functionError(tokens);
  if (callError) return { allowed: false, reason: callError };
  const targetError = relationTargetsError(tokens);
  if (targetError) return { allowed: false, reason: targetError };
  return { allowed: true };
}

// Autonomous migrations admit a deliberately small grammar. Procedural SQL,
// computed expressions, and unparsed forms require exact-file acknowledgment.
const SIMPLE_TYPE = "(?:INT|INTEGER|BIGINT|TEXT|UUID|BOOLEAN|NUMERIC|TIMESTAMPTZ)";
const COLUMN = `[A-Z_][A-Z_0-9]* ${SIMPLE_TYPE}(?: NOT NULL)?(?: PRIMARY KEY)?`;
const ADDITIVE_STATEMENTS = [
  /^CREATE EXTENSION IF NOT EXISTS VECTOR$/,
  new RegExp(`^CREATE TABLE IF NOT EXISTS [A-Z_][A-Z_0-9]* \\( ${COLUMN}(?: , ${COLUMN})* \\)$`),
  new RegExp(`^ALTER TABLE [A-Z_][A-Z_0-9]* ADD COLUMN (?:IF NOT EXISTS )?${COLUMN}$`),
  /^CREATE INDEX IF NOT EXISTS [A-Z_][A-Z_0-9]* ON [A-Z_][A-Z_0-9]* \( [A-Z_][A-Z_0-9]* \)$/,
];

export function containsDestructiveMigration(sql: string): boolean {
  const tokens = tokenize(sql, true);
  if (!tokens || tokens.some((token) => token.kind !== "word" && !["(", ")", ",", ";"].includes(token.value))) return true;
  const statements = tokens.map((token) => token.value).join(" ").replace(/ ;$/, "").split(" ; ");
  return statements.some((statement) => !ADDITIVE_STATEMENTS.some((pattern) => pattern.test(statement)));
}
