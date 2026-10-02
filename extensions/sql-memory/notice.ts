export type SqlMemoryNoticeInput = {
  op: "sql" | "correct" | "remember" | "migrate";
  category?: unknown;
  body?: unknown;
  query?: unknown;
  rowCount?: unknown;
  applied?: unknown;
  error?: unknown;
  denied?: boolean;
};

const SECRET_KEY = /(?:password|connection|database_url|sql_memory_url|url)/i;
const MAX_NOTICE_LENGTH = 50;

function isSecretValue(value: string): boolean {
  return SECRET_KEY.test(value)
    || /(?:postgres(?:ql)?:\/\/|https?:\/\/)[^\s]+/i.test(value)
    || /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b[\s\S]*\b(?:FROM|INTO|TABLE|SET|WHERE)\b/i.test(value);
}

function safeValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return isSecretValue(clean) ? "redacted" : clean;
}

function short(value: string, limit = MAX_NOTICE_LENGTH): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function writeNotice(category: unknown, value: unknown): string {
  const safeCategory = safeValue(category);
  const label = safeCategory ? ` · ${short(safeCategory, 16)}` : "";
  const prefix = `Memory wrote${label}`;
  const body = safeValue(value);
  if (!body) return prefix;
  const remaining = MAX_NOTICE_LENGTH - prefix.length - 5;
  const synopsis = body.length > remaining ? `${body.slice(0, Math.max(0, remaining - 1))}…` : body;
  return `${prefix} · "${synopsis}"`;
}

export function formatSqlMemoryNotice(input: SqlMemoryNoticeInput): string {
  if (input.denied) return short(`Memory denied · ${safeValue(input.error) ?? "request denied"}`);
  if (input.error !== undefined) return short(`Memory failed · ${safeValue(input.error) ?? "operation failed"}`);
  if (input.op === "migrate") return `Memory migrate · applied ${Number.isFinite(input.applied) ? input.applied : 0}`;
  const query = safeValue(input.query);
  if (input.op === "correct" || input.op === "remember") return writeNotice(input.category, input.body);
  if (typeof input.rowCount === "number") {
    return input.rowCount === 0 ? "Memory recall · 0 rows" : short(`Memory recall · ${input.rowCount} ${input.rowCount === 1 ? "row" : "rows"}${query ? ` · "${query}"` : ""}`);
  }
  return writeNotice(input.category, input.body);
}
