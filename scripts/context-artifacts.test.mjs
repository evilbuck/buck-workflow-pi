import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  scanContextDir,
  parseFrontmatter,
  classifyArtifact,
  validateArtifact,
  generateIndexes,
} from "./context-artifacts.mjs";

const TEST_ROOT = join("/tmp", "context-artifacts-test-" + process.pid);
function mkfile(fullPath, content) {
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

const VALID_MEMORY = `---
date: 2026-06-13
domains: [implementation, tooling]
topics: [context-format, hybrid-model]
subject: 2026-06-13.context-format-research
artifacts: [plan-hybrid-context-artifact-model.md]
related: []
priority: high
status: active
---

# Session notes`;

const VALID_SUBJECT_INDEX = `---
status: active
date: 2026-06-13
subject: 2026-06-13.context-format-research
topics: [context-format, markdown, json]
related: []
informs: []
artifacts: [plan-hybrid-context-artifact-model.md]
---

# Subject`;

const VALID_RESEARCH = `---
status: active
date: 2026-06-13
subject: 2026-06-13.context-format-research
topics: [context-format, markdown]
informs: [plan-hybrid-context-artifact-model.md]
---

# Research`;

const VALID_PLAN = `---
status: active
date: 2026-06-13
subject: 2026-06-13.context-format-research
topics: [context-format, tooling]
research: [research-context-format.md]
memory: []
---

# Plan`;

const VALID_BACKLOG = `---
title: Implement hybrid context artifact model
status: active
priority: medium
created: 2026-06-13
updated: 2026-06-13
completed: null
related: []
---

# Implement hybrid context artifact model`;

const VALID_COMPLETED_BACKLOG = `---
title: Completed item
status: completed
priority: low
created: 2026-06-01
updated: 2026-06-05
completed: 2026-06-05
related: []
---

# Completed item`;

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe("parseFrontmatter", () => {
  it("extracts scalar key-value pairs", () => {
    const fm = parseFrontmatter(`date: 2026-06-13\nstatus: active\n`);
    expect(fm.date).toBe("2026-06-13");
    expect(fm.status).toBe("active");
  });

  it("extracts array values from inline YAML", () => {
    const fm = parseFrontmatter(`topics: [foo, bar-baz, qux]\n`);
    expect(fm.topics).toBe("[foo, bar-baz, qux]");
  });

  it("extracts null values", () => {
    const fm = parseFrontmatter(`completed: null\n`);
    expect(fm.completed).toBe("null");
  });

  it("handles empty frontmatter block", () => {
    const fm = parseFrontmatter("");
    expect(fm).toEqual({});
  });

  it("stops at first blank line or non-key line", () => {
    const fm = parseFrontmatter(`status: active\n\n# Body\nstatus: in-body`);
    expect(fm.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// classifyArtifact
// ---------------------------------------------------------------------------

describe("classifyArtifact", () => {
  it("classifies memory files", () => {
    expect(classifyArtifact(".context/memory/foo-2026-06-13.md")).toBe(
      "memory"
    );
  });

  it("classifies subject index files", () => {
    expect(classifyArtifact(".context/2026-06-13.foo/index.md")).toBe(
      "subject-index"
    );
  });

  it("classifies research files", () => {
    expect(
      classifyArtifact(".context/2026-06-13.foo/research-bar.md")
    ).toBe("research");
  });

  it("classifies plan files", () => {
    expect(classifyArtifact(".context/2026-06-13.foo/plan-bar.md")).toBe(
      "plan"
    );
  });

  it("classifies backlog item files", () => {
    expect(
      classifyArtifact(".context/backlog/items/some-item.md")
    ).toBe("backlog-item");
  });

  it("returns null for unknown paths", () => {
    expect(classifyArtifact(".context/index/foo.json")).toBe(null);
    expect(classifyArtifact("README.md")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// validateArtifact — memory
// ---------------------------------------------------------------------------

describe("validateArtifact — memory", () => {
  it("passes valid memory frontmatter", () => {
    const fm = parseFrontmatter(VALID_MEMORY);
    const errors = validateArtifact(fm, "memory");
    expect(errors).toEqual([]);
  });

  it("requires date field", () => {
    const fm = parseFrontmatter(`status: active\n`);
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain("memory: missing required field 'date'");
  });

  it("requires domains field", () => {
    const fm = parseFrontmatter(
      `date: 2026-06-13\ntopics: []\nsubject: foo\nrelated: []\npriority: high\nstatus: active\n`
    );
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain("memory: missing required field 'domains'");
  });

  it("requires topics field", () => {
    const fm = parseFrontmatter(
      `date: 2026-06-13\ndomains: []\nsubject: foo\nrelated: []\npriority: high\nstatus: active\n`
    );
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain("memory: missing required field 'topics'");
  });

  it("requires related field", () => {
    const fm = parseFrontmatter(
      `date: 2026-06-13\ndomains: []\ntopics: []\nsubject: foo\npriority: high\nstatus: active\n`
    );
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain("memory: missing required field 'related'");
  });

  it("requires priority field", () => {
    const fm = parseFrontmatter(
      `date: 2026-06-13\ndomains: []\ntopics: []\nsubject: foo\nrelated: []\nstatus: active\n`
    );
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain("memory: missing required field 'priority'");
  });

  it("rejects invalid priority enum", () => {
    const fm = parseFrontmatter(
      `date: 2026-06-13\ndomains: []\ntopics: []\nsubject: foo\nrelated: []\npriority: urgent\nstatus: active\n`
    );
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain(
      "memory: 'priority' must be one of [high, medium, low], got 'urgent'"
    );
  });

  it("requires status field", () => {
    const fm = parseFrontmatter(
      `date: 2026-06-13\ndomains: []\ntopics: []\nsubject: foo\nrelated: []\npriority: high\n`
    );
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain("memory: missing required field 'status'");
  });

  it("rejects invalid status enum", () => {
    const fm = parseFrontmatter(
      `date: 2026-06-13\ndomains: []\ntopics: []\nsubject: foo\nrelated: []\npriority: high\nstatus: draft\n`
    );
    const errors = validateArtifact(fm, "memory");
    expect(errors).toContain(
      "memory: 'status' must be one of [active, completed, superseded], got 'draft'"
    );
  });
});

// ---------------------------------------------------------------------------
// validateArtifact — subject-index
// ---------------------------------------------------------------------------

describe("validateArtifact — subject-index", () => {
  it("passes valid subject index frontmatter", () => {
    const fm = parseFrontmatter(VALID_SUBJECT_INDEX);
    const errors = validateArtifact(fm, "subject-index");
    expect(errors).toEqual([]);
  });

  it("allows active status", () => {
    const fm = parseFrontmatter(
      `status: active\ndate: 2026-06-13\nsubject: foo\n`
    );
    const errors = validateArtifact(fm, "subject-index");
    expect(errors).toEqual([]);
  });

  it("allows draft status", () => {
    const fm = parseFrontmatter(
      `status: draft\ndate: 2026-06-13\nsubject: foo\n`
    );
    const errors = validateArtifact(fm, "subject-index");
    expect(errors).toEqual([]);
  });

  it("requires status field", () => {
    const fm = parseFrontmatter(`date: 2026-06-13\nsubject: foo\n`);
    const errors = validateArtifact(fm, "subject-index");
    expect(errors).toContain(
      "subject-index: missing required field 'status'"
    );
  });

  it("rejects invalid status enum", () => {
    const fm = parseFrontmatter(
      `status: unknown\ndate: 2026-06-13\nsubject: foo\n`
    );
    const errors = validateArtifact(fm, "subject-index");
    expect(
      errors.some((e) => e.includes("'status' must be one of"))
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateArtifact — research
// ---------------------------------------------------------------------------

describe("validateArtifact — research", () => {
  it("passes valid research frontmatter", () => {
    const fm = parseFrontmatter(VALID_RESEARCH);
    const errors = validateArtifact(fm, "research");
    expect(errors).toEqual([]);
  });

  it("requires subject field", () => {
    const fm = parseFrontmatter(
      `status: active\ndate: 2026-06-13\ntopics: []\ninforms: []\n`
    );
    const errors = validateArtifact(fm, "research");
    expect(errors).toContain("research: missing required field 'subject'");
  });
});

// ---------------------------------------------------------------------------
// validateArtifact — plan
// ---------------------------------------------------------------------------

describe("validateArtifact — plan", () => {
  it("passes valid plan frontmatter", () => {
    const fm = parseFrontmatter(VALID_PLAN);
    const errors = validateArtifact(fm, "plan");
    expect(errors).toEqual([]);
  });

  it("requires memory field", () => {
    const fm = parseFrontmatter(
      `status: active\ndate: 2026-06-13\nsubject: foo\ntopics: []\nresearch: []\n`
    );
    const errors = validateArtifact(fm, "plan");
    expect(errors).toContain("plan: missing required field 'memory'");
  });
});

// ---------------------------------------------------------------------------
// validateArtifact — backlog-item
// ---------------------------------------------------------------------------

describe("validateArtifact — backlog-item", () => {
  it("passes valid backlog item frontmatter", () => {
    const fm = parseFrontmatter(VALID_BACKLOG);
    const errors = validateArtifact(fm, "backlog-item");
    expect(errors).toEqual([]);
  });

  it("passes completed backlog item", () => {
    const fm = parseFrontmatter(VALID_COMPLETED_BACKLOG);
    const errors = validateArtifact(fm, "backlog-item");
    expect(errors).toEqual([]);
  });

  it("requires title field", () => {
    const fm = parseFrontmatter(
      `status: active\npriority: medium\ncreated: 2026-06-13\nupdated: 2026-06-13\ncompleted: null\nrelated: []\n`
    );
    const errors = validateArtifact(fm, "backlog-item");
    expect(errors).toContain(
      "backlog-item: missing required field 'title'"
    );
  });

  it("rejects invalid priority enum", () => {
    const fm = parseFrontmatter(
      `title: Foo\nstatus: active\npriority: urgent\ncreated: 2026-06-13\nupdated: 2026-06-13\ncompleted: null\nrelated: []\n`
    );
    const errors = validateArtifact(fm, "backlog-item");
    expect(errors).toContain(
      "backlog-item: 'priority' must be one of [high, medium, low], got 'urgent'"
    );
  });
});

// ---------------------------------------------------------------------------
// scanContextDir
// ---------------------------------------------------------------------------

describe("scanContextDir", () => {
  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("finds all markdown artifacts in .context/", () => {
    mkfile(
      join(TEST_ROOT, ".context/memory/test-2026-06-13.md"),
      VALID_MEMORY
    );
    mkfile(
      join(TEST_ROOT, ".context/2026-06-13.foo/index.md"),
      VALID_SUBJECT_INDEX
    );
    mkfile(
      join(TEST_ROOT, ".context/2026-06-13.foo/research-bar.md"),
      VALID_RESEARCH
    );
    mkfile(
      join(TEST_ROOT, ".context/backlog/items/test-item.md"),
      VALID_BACKLOG
    );
    mkfile(
      join(TEST_ROOT, ".context/index/subjects.json"),
      "{}"
    );

    const artifacts = scanContextDir(TEST_ROOT);
    const paths = artifacts.map((a) => a.path);

    expect(paths).toContain(
      join(TEST_ROOT, ".context/memory/test-2026-06-13.md")
    );
    expect(paths).toContain(
      join(TEST_ROOT, ".context/2026-06-13.foo/index.md")
    );
    expect(paths).toContain(
      join(TEST_ROOT, ".context/2026-06-13.foo/research-bar.md")
    );
    expect(paths).toContain(
      join(TEST_ROOT, ".context/backlog/items/test-item.md")
    );
    expect(paths.some((p) => p.endsWith(".json"))).toBe(false);
  });

  it("parses and classifies each artifact", () => {
    mkfile(
      join(TEST_ROOT, ".context/memory/test-2026-06-13.md"),
      VALID_MEMORY
    );
    mkfile(
      join(TEST_ROOT, ".context/2026-06-13.foo/index.md"),
      VALID_SUBJECT_INDEX
    );

    const artifacts = scanContextDir(TEST_ROOT);

    const memory = artifacts.find((a) => a.kind === "memory");
    expect(memory).toBeDefined();
    expect(memory.frontmatter.status).toBe("active");
    expect(memory.errors).toEqual([]);

    const subjectIndex = artifacts.find((a) => a.kind === "subject-index");
    expect(subjectIndex).toBeDefined();
    expect(subjectIndex.frontmatter.subject).toBe(
      "2026-06-13.context-format-research"
    );
  });

  it("flags missing required fields as errors", () => {
    mkfile(
      join(TEST_ROOT, ".context/memory/bad-memory.md"),
      `---\nstatus: active\n---\n# Body`
    );

    const artifacts = scanContextDir(TEST_ROOT);
    const bad = artifacts.find((a) => a.path.endsWith("bad-memory.md"));
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(bad.errors[0]).toContain("missing required field");
  });
});

// ---------------------------------------------------------------------------
// generateIndexes
// ---------------------------------------------------------------------------

describe("generateIndexes", () => {
  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("generates subjects index with required fields", () => {
    mkfile(
      join(TEST_ROOT, ".context/2026-06-13.foo/index.md"),
      VALID_SUBJECT_INDEX
    );

    const artifacts = scanContextDir(TEST_ROOT);
    const indexes = generateIndexes(artifacts);

    expect(indexes.subjects).toBeDefined();
    expect(Array.isArray(indexes.subjects)).toBe(true);
    expect(indexes.subjects.length).toBe(1);
    expect(indexes.subjects[0]).toMatchObject({
      subject: "2026-06-13.context-format-research",
      status: "active",
      date: "2026-06-13",
    });
  });

  it("generates memory index with required fields", () => {
    mkfile(
      join(TEST_ROOT, ".context/memory/test-2026-06-13.md"),
      VALID_MEMORY
    );

    const artifacts = scanContextDir(TEST_ROOT);
    const indexes = generateIndexes(artifacts);

    expect(indexes.memory).toBeDefined();
    expect(indexes.memory.length).toBe(1);
    expect(indexes.memory[0]).toMatchObject({
      date: "2026-06-13",
      subject: "2026-06-13.context-format-research",
      status: "active",
      priority: "high",
    });
    expect(Array.isArray(indexes.memory[0].topics)).toBe(true);
    expect(Array.isArray(indexes.memory[0].domains)).toBe(true);
  });

  it("generates backlog index with required fields", () => {
    mkfile(
      join(TEST_ROOT, ".context/backlog/items/test-item.md"),
      VALID_BACKLOG
    );
    mkfile(
      join(TEST_ROOT, ".context/backlog/items/completed-item.md"),
      VALID_COMPLETED_BACKLOG
    );

    const artifacts = scanContextDir(TEST_ROOT);
    const indexes = generateIndexes(artifacts);

    expect(indexes.backlog).toBeDefined();
    expect(indexes.backlog.length).toBe(2);
    expect(indexes.backlog.map((b) => b.title)).toContain(
      "Implement hybrid context artifact model"
    );
    expect(indexes.backlog.map((b) => b.status)).toContain("active");
    expect(indexes.backlog.map((b) => b.status)).toContain("completed");
  });

  it("includes path and kind on every index entry", () => {
    mkfile(
      join(TEST_ROOT, ".context/2026-06-13.foo/index.md"),
      VALID_SUBJECT_INDEX
    );
    mkfile(
      join(TEST_ROOT, ".context/memory/test-2026-06-13.md"),
      VALID_MEMORY
    );

    const artifacts = scanContextDir(TEST_ROOT);
    const indexes = generateIndexes(artifacts);

    for (const entry of [...indexes.subjects, ...indexes.memory]) {
      expect(entry).toHaveProperty("path");
      expect(entry).toHaveProperty("kind");
    }
  });

  it("deterministically sorts indexes by subject/date", () => {
    mkfile(
      join(TEST_ROOT, ".context/2026-06-13.foo/index.md"),
      VALID_SUBJECT_INDEX
    );
    mkfile(
      join(TEST_ROOT, ".context/2026-05-01.bar/index.md"),
      `---\nstatus: active\ndate: 2026-05-01\nsubject: 2026-05-01.bar\ntopics: []\nrelated: []\ninforms: []\nartifacts: []\n---\n# Subject`
    );

    const artifacts = scanContextDir(TEST_ROOT);
    const indexes = generateIndexes(artifacts);

    const subjects = indexes.subjects;
    expect(subjects[0].subject).toBe("2026-05-01.bar");
    expect(subjects[1].subject).toBe("2026-06-13.context-format-research");
  });
});
