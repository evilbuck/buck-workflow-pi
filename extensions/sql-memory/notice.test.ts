import { describe, expect, it } from "vitest";
import { formatSqlMemoryNotice } from "./notice.js";

describe("formatSqlMemoryNotice", () => {
  it("formats writes as a bounded single line", () => {
    const notice = formatSqlMemoryNotice({ op: "correct", category: "decision", body: "settled\n" + "x".repeat(100) });
    expect(notice.startsWith('Memory wrote · decision · "settled ')).toBe(true);
    expect(notice.endsWith('…"')).toBe(true);
    expect(notice).not.toContain("\n");
    expect(notice.length).toBeLessThanOrEqual(50);
  });

  it("redacts URL categories and normalizes category whitespace before truncation", () => {
    expect(formatSqlMemoryNotice({ op: "correct", category: "postgres://user:pass@db/x", body: "hello" }))
      .toBe('Memory wrote · redacted · "hello"');
    expect(formatSqlMemoryNotice({ op: "sql", category: "dec\nision", body: "hello" }))
      .toBe('Memory wrote · dec ision · "hello"');
    expect(formatSqlMemoryNotice({ op: "sql", category: "\r\n\t ", body: "hello" }))
      .toBe('Memory wrote · "hello"');
    const notice = formatSqlMemoryNotice({ op: "correct", category: "decision\n".repeat(20), body: "x".repeat(100) });
    expect(notice).not.toContain("\n");
    expect(notice.length).toBeLessThanOrEqual(50);
  });

  it("formats recall counts with the bound query, and omits query for zero rows", () => {
    expect(formatSqlMemoryNotice({ op: "sql", rowCount: 3, query: "buck-loop decisions" }))
      .toBe('Memory recall · 3 rows · "buck-loop decisions"');
    expect(formatSqlMemoryNotice({ op: "sql", rowCount: 0, query: "secret" })).toBe("Memory recall · 0 rows");
  });

  it("redacts URL-like synopsis and bounds denial and failure reasons", () => {
    expect(formatSqlMemoryNotice({ op: "sql", body: "postgres://user:pass@db.test/x", category: "pitfall" }))
      .toBe('Memory wrote · pitfall · "redacted"');
    expect(formatSqlMemoryNotice({ op: "sql", denied: true, error: "statement denied\n" + "x".repeat(90) })).toMatch(/^Memory denied · /);
    expect(formatSqlMemoryNotice({ op: "sql", error: "postgres://user:pass@db.test/x" })).toBe("Memory failed · redacted");
    expect(formatSqlMemoryNotice({ op: "sql", error: "syntax error near SELECT body FROM memories" })).toBe("Memory failed · redacted");
    for (const denied of [false, true]) {
      const notice = formatSqlMemoryNotice({ op: "sql", denied, error: "reason ".repeat(30) });
      expect(notice.length).toBeLessThanOrEqual(50);
      expect(notice).not.toContain("\n");
    }
  });

  it("formats migration results", () => {
    expect(formatSqlMemoryNotice({ op: "migrate", applied: 2 })).toBe("Memory migrate · applied 2");
  });
});
