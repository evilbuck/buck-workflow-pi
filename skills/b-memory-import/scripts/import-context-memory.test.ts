#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildRetainItem,
  computeBankScope,
  documentIdFor,
  listMemoryMarkdown,
  parseArgs,
  parseFrontmatter,
  parseSimpleYaml,
  planImport,
  sha256Hex,
  splitFrontmatter,
  type MemoryFile,
} from "./import-context-memory";
describe("splitFrontmatter", () => {
  test("splits yaml and body", () => {
    const text = `---
date: 2026-08-14
topics: [a, b]
---
# Title

Body line.
`;
    const { yaml, body } = splitFrontmatter(text);
    expect(yaml).toContain("date: 2026-08-14");
    expect(body.startsWith("# Title")).toBe(true);
  });

  test("no frontmatter returns full body", () => {
    const { yaml, body } = splitFrontmatter("just text\n");
    expect(yaml).toBeNull();
    expect(body).toBe("just text\n");
  });
});

describe("parseSimpleYaml", () => {
  test("scalars and bracket arrays", () => {
    const raw = parseSimpleYaml(`date: 2026-08-14
topics: [omp, memory]
status: active
`);
    expect(raw.date).toBe("2026-08-14");
    expect(raw.topics).toEqual(["omp", "memory"]);
    expect(raw.status).toBe("active");
  });

  test("block lists", () => {
    const raw = parseSimpleYaml(`related:
  - a.md
  - b.md
`);
    expect(raw.related).toEqual(["a.md", "b.md"]);
  });
});

describe("parseFrontmatter", () => {
  test("extracts known fields", () => {
    const { frontmatter, body } = parseFrontmatter(`---
date: 2026-06-06
domains: [research, omp]
topics:
  - hindsight
subject: 2026-06-06.omp-integration
status: completed
---
# Hello

World
`);
    expect(frontmatter.date).toBe("2026-06-06");
    expect(frontmatter.domains).toEqual(["research", "omp"]);
    expect(frontmatter.topics).toEqual(["hindsight"]);
    expect(frontmatter.subject).toBe("2026-06-06.omp-integration");
    expect(body).toContain("# Hello");
  });
});

describe("documentIdFor", () => {
  test("stable for same path", () => {
    expect(documentIdFor(".context/memory/foo.md")).toBe(
      documentIdFor(".context/memory/foo.md"),
    );
  });

  test("differs across paths", () => {
    expect(documentIdFor("a.md")).not.toBe(documentIdFor("b.md"));
  });

  test("normalizes slashes", () => {
    expect(documentIdFor("x\\y.md")).toBe(documentIdFor("x/y.md"));
  });
});

describe("computeBankScope", () => {
  test("global", () => {
    expect(computeBankScope("evilbuck", "global", "buck-workflow-pi")).toEqual({
      bankId: "evilbuck",
    });
  });

  test("per-project", () => {
    expect(computeBankScope("evilbuck", "per-project", "buck-workflow-pi")).toEqual({
      bankId: "evilbuck-buck-workflow-pi",
    });
  });

  test("per-project-tagged", () => {
    expect(
      computeBankScope("evilbuck", "per-project-tagged", "buck-workflow-pi"),
    ).toEqual({
      bankId: "evilbuck",
      retainTags: ["project:buck-workflow-pi"],
    });
  });
});

describe("buildRetainItem", () => {
  const file: MemoryFile = {
    absPath: "/tmp/x.md",
    relPath: ".context/memory/sample-2026-08-14.md",
    sha256: sha256Hex("body"),
    bytes: 4,
    mtimeMs: 0,
    frontmatter: {
      date: "2026-08-14",
      subject: "demo",
      status: "active",
      topics: ["t"],
      raw: {},
    },
    body: "# Sample\n\nDecision: use retain.\n",
    title: "Sample",
  };

  test("sets document_id tags metadata timestamp", () => {
    const item = buildRetainItem(file, ["project:demo"]);
    expect(item.document_id).toBe(documentIdFor(file.relPath));
    expect(item.tags).toEqual(["project:demo"]);
    expect(item.update_mode).toBe("replace");
    expect(item.timestamp).toBe("2026-08-14T12:00:00Z");
    expect(item.metadata.path).toBe(file.relPath);
    expect(item.metadata.source).toBe("buck-context-memory");
    expect(item.content).toContain("path: .context/memory/sample-2026-08-14.md");
    expect(item.content).toContain("Decision: use retain.");
  });
});

describe("planImport", () => {
  const mk = (rel: string, sha: string): MemoryFile => ({
    absPath: `/tmp/${rel}`,
    relPath: rel,
    sha256: sha,
    bytes: 1,
    mtimeMs: 0,
    frontmatter: { raw: {} },
    body: "x",
    title: rel,
  });

  test("skips unchanged sha", () => {
    const files = [mk("a.md", "aaa"), mk("b.md", "bbb")];
    const manifest = {
      version: 1 as const,
      bank_id: "x",
      project_label: "p",
      scoping: "global" as const,
      files: {
        "a.md": {
          sha256: "aaa",
          document_id: "d",
          imported_at: "t",
          bytes: 1,
        },
      },
    };
    const plan = planImport(files, manifest, false, null);
    expect(plan.skipped).toBe(1);
    expect(plan.toImport.map((f) => f.relPath)).toEqual(["b.md"]);
  });

  test("force reimports all", () => {
    const files = [mk("a.md", "aaa")];
    const manifest = {
      version: 1 as const,
      bank_id: "x",
      project_label: "p",
      scoping: "global" as const,
      files: {
        "a.md": {
          sha256: "aaa",
          document_id: "d",
          imported_at: "t",
          bytes: 1,
        },
      },
    };
    const plan = planImport(files, manifest, true, null);
    expect(plan.skipped).toBe(0);
    expect(plan.toImport).toHaveLength(1);
  });

  test("limit caps", () => {
    const files = [mk("a.md", "1"), mk("b.md", "2"), mk("c.md", "3")];
    const plan = planImport(files, null, false, 2);
    expect(plan.toImport).toHaveLength(2);
  });
});

describe("parseArgs", () => {
  test("defaults and flags", () => {
    const a = parseArgs(["--dry-run", "--force", "--limit", "3", "--root", "/tmp/proj"]);
    expect(a.dryRun).toBe(true);
    expect(a.force).toBe(true);
    expect(a.limit).toBe(3);
    expect(a.root).toBe(resolve("/tmp/proj"));
    expect(a.memoryDir.endsWith(".context/memory")).toBe(true);
  });
});

describe("list integration light", () => {
  test("walks nested md", () => {
    const root = mkdtempSync(join(tmpdir(), "bmem-"));
    const mem = join(root, ".context", "memory");
    mkdirSync(mem, { recursive: true });
    writeFileSync(
      join(mem, "one.md"),
      `---\ndate: 2026-01-01\n---\n# One\n`,
    );
    writeFileSync(join(mem, "index.md"), "# index\n");
    const files = listMemoryMarkdown(mem, root);
    expect(files).toHaveLength(1);
    expect(files[0].relPath).toBe(".context/memory/one.md");
    expect(files[0].frontmatter.date).toBe("2026-01-01");
  });
});
