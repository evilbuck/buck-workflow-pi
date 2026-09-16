import { describe, it, expect } from "vitest";
import { parseFrontmatter, FrontmatterParseError } from "../frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses scalars, flow lists, and list-of-maps", () => {
    const text = [
      "---",
      "schema_version: 1",
      "selector: zai/glm-5.3",
      "aliases: [glm-5.3, glm53]",
      "enabled: true",
      "commands:",
      "  - id: vitest",
      "    executable: npx",
      "    argv_prefix: [vitest, run]",
      "---",
      "# Body",
    ].join("\n");
    const { data, body } = parseFrontmatter(text);
    expect(data.schema_version).toBe("1");
    expect(data.selector).toBe("zai/glm-5.3");
    expect(data.aliases).toEqual(["glm-5.3", "glm53"]);
    expect(data.enabled).toBe("true");
    expect(data.commands).toEqual([
      { id: "vitest", executable: "npx", argv_prefix: ["vitest", "run"] },
    ]);
    expect(body).toBe("# Body");
  });

  it("returns empty data when there is no frontmatter block", () => {
    const { data, body } = parseFrontmatter("Just a doc\n");
    expect(data).toEqual({});
    expect(body).toBe("Just a doc\n");
  });

  it("rejects duplicate keys", () => {
    expect(() => parseFrontmatter("---\na: 1\na: 2\n---\n")).toThrow(FrontmatterParseError);
  });

  it("rejects an unterminated block", () => {
    expect(() => parseFrontmatter("---\na: 1\n")).toThrow(/unterminated/);
  });

  it("rejects malformed lines", () => {
    expect(() => parseFrontmatter("---\nnope\n---\n")).toThrow(FrontmatterParseError);
    expect(() => parseFrontmatter("---\nkey: [a,,b]\n---\n")).toThrow(FrontmatterParseError);
  });

  it("rejects a list item under a non-list key", () => {
    expect(() => parseFrontmatter("---\na: 1\n  - id: x\n---\n")).toThrow(FrontmatterParseError);
  });
});
