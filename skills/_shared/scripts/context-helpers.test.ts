import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendFrontmatterListItem,
  classifyArtifact,
  extractTitle,
  listSubjectFolders,
  parseBacklogTodo,
  parsePhaseSummaryTable,
  parseSimpleYaml,
  phaseCriteriaAllChecked,
  planMemoryRefStyle,
  readFrontmatter,
  readSubjectStatus,
  setFrontmatterFields,
  splitFrontmatter,
  userGoalState,
  validateArtifact,
} from "./context-helpers.js";

const temps: string[] = [];

function tmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "context-helpers-"));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  while (temps.length > 0) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("splitFrontmatter", () => {
  it("returns null yaml when the document has no fence", () => {
    expect(splitFrontmatter("# Title\n\nbody")).toEqual({
      yaml: null,
      body: "# Title\n\nbody",
    });
  });

  it("splits a --- fenced block from the body", () => {
    const text = "---\nstatus: active\n---\n\n# Title\n";
    const result = splitFrontmatter(text);
    expect(result.yaml).toBe("status: active");
    expect(result.body).toBe("\n# Title\n");
  });
});

describe("parseSimpleYaml", () => {
  it("parses scalars and inline arrays", () => {
    const data = parseSimpleYaml("status: active\ntopics: [foo, bar-baz]\ncompleted: null\n");
    expect(data.status).toBe("active");
    expect(data.topics).toEqual(["foo", "bar-baz"]);
    expect(data.completed).toBeNull();
  });

  it("parses block lists", () => {
    const data = parseSimpleYaml("related:\n  - a.md\n  - b.md\n");
    expect(data.related).toEqual(["a.md", "b.md"]);
  });
});

describe("readFrontmatter", () => {
  it("reports hadYaml false when there is no fence", () => {
    const result = readFrontmatter("# Title\n");
    expect(result).toEqual({ data: {}, body: "# Title\n", hadYaml: false });
  });

  it("parses fenced yaml into typed values", () => {
    const result = readFrontmatter("---\ndomains: [a, b]\nstatus: active\n---\n\n# Hi\n");
    expect(result.hadYaml).toBe(true);
    expect(result.data.domains).toEqual(["a", "b"]);
    expect(result.data.status).toBe("active");
    expect(result.body).toBe("\n# Hi\n");
  });
});

describe("extractTitle", () => {
  it("returns the first ATX h1", () => {
    expect(extractTitle("intro\n# Hello world\n", "fallback")).toBe("Hello world");
  });

  it("returns the fallback when no h1 exists", () => {
    expect(extractTitle("## Not a title\n", "fallback")).toBe("fallback");
  });
});

describe("classifyArtifact", () => {
  it("classifies the five known kinds and rejects the rest", () => {
    expect(classifyArtifact(".context/memory/foo-2026-06-13.md")).toBe("memory");
    expect(classifyArtifact(".context/2026-06-13.foo/index.md")).toBe("subject-index");
    expect(classifyArtifact(".context/2026-06-13.foo/research-bar.md")).toBe("research");
    expect(classifyArtifact(".context/2026-06-13.foo/plan-bar.md")).toBe("plan");
    expect(classifyArtifact(".context/backlog/items/some-item.md")).toBe("backlog-item");
    expect(classifyArtifact(".context/memory/index.md")).toBeNull();
    expect(classifyArtifact("README.md")).toBeNull();
  });
});

describe("validateArtifact", () => {
  it("flags missing required fields", () => {
    const errors = validateArtifact({ status: "active" }, "memory");
    expect(errors.some((e) => e.includes("missing required field"))).toBe(true);
  });

  it("flags illegal enum values", () => {
    const errors = validateArtifact({ priority: "urgent" }, "memory");
    expect(errors.some((e) => e.includes("'priority' must be one of"))).toBe(true);
  });
});

describe("listSubjectFolders / readSubjectStatus", () => {
  it("returns date-prefixed folders name-sorted with status from index.md", () => {
    const root = tmpRoot();
    mkdirSync(join(root, ".context", "2026-08-26.later"), { recursive: true });
    mkdirSync(join(root, ".context", "2026-08-20.earlier"), { recursive: true });
    mkdirSync(join(root, ".context", "not-a-subject"), { recursive: true });
    writeFileSync(join(root, ".context", "2026-08-20.earlier", "index.md"), "---\nstatus: active\n---\n");
    writeFileSync(join(root, ".context", "2026-08-26.later", "index.md"), "---\nstatus: completed\n---\n");

    const folders = listSubjectFolders(root);
    expect(folders.map((f) => f.name)).toEqual(["2026-08-20.earlier", "2026-08-26.later"]);
    expect(folders[0]?.status).toBe("active");
    expect(folders[1]?.status).toBe("completed");
    expect(readSubjectStatus(join(root, ".context", "not-a-subject"))).toBeNull();
  });
});

describe("parseBacklogTodo", () => {
  it("splits ungrouped items from ## sections and extracts slugs", () => {
    const text = `# Backlog

- [ ] [Live TUI](items/deterministic-extension-progress.md) — high priority
- [x] [Done](archive/2026-07/done.md) — done 2026-07-25

## Other
- [ ] Phase leftover without a link
`;
    const parsed = parseBacklogTodo(text);
    expect(parsed.raw).toBe(text);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0]?.heading).toBeNull();
    expect(parsed.sections[0]?.items).toEqual([
      {
        checked: false,
        label: "Live TUI",
        link: "items/deterministic-extension-progress.md",
        slug: "deterministic-extension-progress",
        trailer: "high priority",
      },
      {
        checked: true,
        label: "Done",
        link: "archive/2026-07/done.md",
        slug: "done",
        trailer: "done 2026-07-25",
      },
    ]);
    expect(parsed.sections[1]?.heading).toBe("Other");
    expect(parsed.sections[1]?.items[0]).toMatchObject({
      checked: false,
      label: "Phase leftover without a link",
      link: "",
      slug: "",
    });
  });
});

describe("parsePhaseSummaryTable", () => {
  it("reads Phase/Status/Difficulty/File rows including linked files", () => {
    const text = `## Phase Summary

| Phase | Status | Difficulty | File |
|---|---|---|---|
| 1: Types | pending | easy | [phase-1-types.md](phase-1-types.md) |
| 2: Worker | completed | hard | phase-2-worker.md |
`;
    expect(parsePhaseSummaryTable(text)).toEqual([
      { phase: "1: Types", status: "pending", difficulty: "easy", file: "phase-1-types.md" },
      { phase: "2: Worker", status: "completed", difficulty: "hard", file: "phase-2-worker.md" },
    ]);
  });
});

describe("phaseCriteriaAllChecked", () => {
  it("is true only when every criterion starts with [x]", () => {
    expect(phaseCriteriaAllChecked({ acceptance_criteria: ["[x] a", "[x] b"] })).toBe(true);
    expect(phaseCriteriaAllChecked({ acceptance_criteria: ["[x] a", "[ ] b"] })).toBe(false);
    expect(phaseCriteriaAllChecked({ acceptance_criteria: [] })).toBe(false);
    expect(phaseCriteriaAllChecked({})).toBe(false);
  });
});

describe("userGoalState", () => {
  it("classifies present, waived, and missing including empty bodies", () => {
    expect(userGoalState("## User Goal\n\nShip a deterministic save.\n")).toBe("present");
    expect(userGoalState("## User Goal\n\nTechnical chore — extract helpers\n")).toBe("waived");
    expect(userGoalState("## User Goal\n\nTechnical chore - ascii hyphen\n")).toBe("waived");
    expect(userGoalState("## User Goal\n\n")).toBe("missing");
    expect(userGoalState("# Title\n\nNo section here\n")).toBe("missing");
  });
});

describe("setFrontmatterFields", () => {
  it("creates a frontmatter block when none exists", () => {
    const next = setFrontmatterFields("# Title\n", { status: "active", related: [] });
    expect(next.startsWith("---\n")).toBe(true);
    expect(readFrontmatter(next).data.status).toBe("active");
    expect(readFrontmatter(next).data.related).toEqual([]);
    expect(readFrontmatter(next).body).toContain("# Title");
  });

  it("rewrites existing keys in place and inserts new keys before the close", () => {
    const text = "---\ntitle: X\nstatus: active\n---\n\n# X\n";
    const next = setFrontmatterFields(text, { status: "completed", completed: "2026-08-26" });
    expect(next).toMatch(/^---\ntitle: X\nstatus: completed\ncompleted: 2026-08-26\n---\n/);
  });
});

describe("appendFrontmatterListItem", () => {
  it("keeps inline lists inline and is idempotent", () => {
    const text = "---\nrelated: [package.json]\n---\n\n# X\n";
    const once = appendFrontmatterListItem(text, "related", "scripts/publish.mjs");
    expect(readFrontmatter(once).data.related).toEqual(["package.json", "scripts/publish.mjs"]);
    expect(once).toContain("related: [package.json, scripts/publish.mjs]");
    expect(appendFrontmatterListItem(once, "related", "scripts/publish.mjs")).toBe(once);
  });

  it("keeps block lists as block lists", () => {
    const text = "---\nrelated:\n  - a.md\n---\n\n# X\n";
    const next = appendFrontmatterListItem(text, "related", "b.md");
    expect(next).toContain("related:\n  - a.md\n  - b.md\n");
    expect(readFrontmatter(next).data.related).toEqual(["a.md", "b.md"]);
  });
});

describe("planMemoryRefStyle", () => {
  it("detects yaml, bold-line, and none", () => {
    expect(planMemoryRefStyle("---\nmemory: []\n---\n\n# Plan\n")).toBe("yaml");
    expect(
      planMemoryRefStyle("# Plan\n\n**memory:** [../memory/a.md](../memory/a.md)\n"),
    ).toBe("bold-line");
    expect(planMemoryRefStyle("# Plan\n\nNo refs\n")).toBe("none");
  });
});
