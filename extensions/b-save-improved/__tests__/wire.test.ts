import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  assembleApplyPayload,
  buildDigest,
  buildRetainInstruction,
  DIGEST_CAP,
  lastAssistantText,
  parseArgs,
  parseAuditorResponse,
  parseScribeResponse,
  resolveRoleModel,
  wire,
} from "../index.js";

function createMockApi(): { api: ExtensionAPI; commands: Map<string, Record<string, unknown>> } {
  const commands = new Map<string, Record<string, unknown>>();
  const api = {
    on: vi.fn(),
    registerCommand: vi.fn((name: string, opts: Record<string, unknown>) => {
      commands.set(name, opts);
    }),
    registerTool: vi.fn(),
    sendMessage: vi.fn(),
  } as unknown as ExtensionAPI;
  return { api, commands };
}

describe("b-save-improved wire", () => {
  it("registers the command with a truthy description and arity ≤ 2 handler", () => {
    const { api, commands } = createMockApi();
    wire(api);
    expect(commands.has("b-save-improved")).toBe(true);
    const cmd = commands.get("b-save-improved") as { handler: Function; description?: string };
    expect(typeof cmd.handler).toBe("function");
    expect(cmd.handler.length).toBeLessThanOrEqual(2);
    expect(cmd.description).toBeTruthy();
  });

  it("completes the five flags", () => {
    const { api, commands } = createMockApi();
    wire(api);
    const cmd = commands.get("b-save-improved") as {
      getArgumentCompletions?: (prefix: string) => Array<{ value: string }>;
    };
    expect(cmd.getArgumentCompletions).toBeTypeOf("function");
    const completions = cmd.getArgumentCompletions!("--")
      .map((c) => c.value)
      .sort();
    expect(completions).toEqual([
      "--archive-inferred",
      "--dry-run",
      "--model",
      "--no-retain",
      "--subject",
    ]);
  });
});

describe("parseArgs", () => {
  it("parses the five flags", () => {
    expect(parseArgs("--dry-run --archive-inferred --subject 2026-08-26.foo --no-retain --model xai/grok")).toEqual({
      dryRun: true,
      archiveInferred: true,
      subject: "2026-08-26.foo",
      noRetain: true,
      model: "xai/grok",
    });
  });

  it("defaults when no flags are given", () => {
    expect(parseArgs("")).toEqual({
      dryRun: false,
      archiveInferred: false,
      subject: null,
      noRetain: false,
      model: undefined,
    });
  });
});

describe("buildDigest", () => {
  it("keeps user, assistant, compaction, and write/edit/read paths; drops tool bodies", () => {
    const digest = buildDigest(
      [
        { role: "user", content: "hello" },
        { role: "assistant", content: "working" },
        { type: "tool", toolName: "write", arguments: { path: "a.ts" }, result: "HUGE BODY" },
        { type: "tool", name: "grep", arguments: { pattern: "x" } },
        { type: "compaction", summary: "early history" },
      ],
      " M a.ts",
      "a.ts | 1 +",
    );
    expect(digest).toContain("user: hello");
    expect(digest).toContain("assistant: working");
    expect(digest).toContain("write a.ts");
    expect(digest).toContain("[compaction] early history");
    expect(digest).not.toContain("HUGE BODY");
    expect(digest).not.toContain("grep");
    expect(digest).toContain("M a.ts");
    expect(digest).toContain("a.ts | 1 +");
  });
  it("drops oldest non-compaction content first and prefixes a truncation notice", () => {
    const entries = [
      { role: "user", content: "GOAL: ship parity" },
      { role: "assistant", content: "BBBB".repeat(200) },
      { type: "compaction", summary: "keep-me" },
      { role: "assistant", content: "CCCC".repeat(50) },
    ];
    const digest = buildDigest(entries, "", "", 400);
    expect(digest).toContain("[digest truncated:");
    expect(digest).toContain("keep-me");
    expect(digest).toContain("user: GOAL: ship parity");
    expect(digest).toContain("CCCC");
    expect(digest).not.toContain("BBBB");
    expect(digest.startsWith("[digest truncated:")).toBe(true);
  });

  it("pins the first user message so the session goal survives cap truncation", () => {
    const entries: unknown[] = [{ role: "user", content: "GOAL: ship parity" }];
    for (let i = 0; i < 40; i++) {
      entries.push({ role: "assistant", content: `filler ${i} ${"y".repeat(400)}` });
      entries.push({ role: "user", content: `later user ${i} ${"z".repeat(400)}` });
    }
    const digest = buildDigest(entries, "", "", 2_000);
    expect(digest).toContain("user: GOAL: ship parity");
    expect(digest.startsWith("[digest truncated:")).toBe(true);
    expect(digest).not.toContain("later user 0");
  });

  it("summarizes bash tool calls as one-liners truncated to 120 chars", () => {
    const long = `npm test ${"x".repeat(200)}`;
    const digest = buildDigest(
      [
        { type: "tool", name: "bash", arguments: { command: "npm run test:unit" } },
        { type: "tool", toolName: "Bash", arguments: { command: long } },
        { type: "tool", name: "bash", arguments: { command: "   git\n status   --porcelain   " } },
      ],
      "",
      "",
    );
    expect(digest).toContain("bash npm run test:unit");
    expect(digest).toContain(`bash npm test ${"x".repeat(111)}`);
    expect(digest).not.toContain("x".repeat(112));
    expect(digest).toContain("bash git status --porcelain");
  });

  it("defaults the cap to DIGEST_CAP", () => {
    expect(DIGEST_CAP).toBe(12_000);
  });
});

describe("resolveRoleModel", () => {
  it("maps scribe→slow and auditor→smol from project OMP config.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "bsave-role-"));
    try {
      mkdirSync(join(dir, ".omp"), { recursive: true });
      writeFileSync(
        join(dir, ".omp", "config.yml"),
        [
          "modelRoles:",
          "  default: xai-oauth/grok-4.6:xhigh",
          "  slow: zai/glm-5.3:max",
          "  smol: minimax-code/MiniMax-M3:minimal",
          "",
        ].join("\n"),
      );
      mkdirSync(join(dir, ".pi", "agent"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "agent", "settings.json"),
        JSON.stringify({ buckModelMapping: { easy: "pi/easy", medium: "pi/medium", hard: "pi/hard" } }),
      );
      expect(resolveRoleModel(dir, "scribe")).toBe("zai/glm-5.3:max");
      expect(resolveRoleModel(dir, "auditor")).toBe("minimax-code/MiniMax-M3:minimal");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("parseScribeResponse / parseAuditorResponse", () => {
  it("strips fences and validates scribe JSON", () => {
    const parsed = parseScribeResponse(`\`\`\`json
{"memory":{"frontmatter":{"domains":["x"],"topics":["y"],"priority":"high","status":"completed"},"title":"T","body":"B"},"index_entry":{"summary":"S"},"backlog":{"complete_explicit":[],"complete_inferred":[],"new_items":[]},"retain_facts":["fact"]}
\`\`\``);
    expect(parsed?.memory.title).toBe("T");
    expect(parsed?.index_entry.summary).toBe("S");
    expect(parsed?.retain_facts).toEqual(["fact"]);
  });

  it("returns null for invalid scribe JSON", () => {
    expect(parseScribeResponse("not json")).toBeNull();
    expect(parseScribeResponse('{"memory":{}}')).toBeNull();
  });

  it("drops path-like backlog slugs from scribe output", () => {
    const parsed = parseScribeResponse(JSON.stringify({
      memory: { frontmatter: {}, title: "T", body: "B" },
      index_entry: { summary: "S" },
      backlog: {
        complete_explicit: [{ slug: "../x", outcome: "nope" }, { slug: "ok-item", outcome: "done" }],
        complete_inferred: [{ slug: "/tmp/x", outcome: "nope" }],
        new_items: [{ slug: "..", title: "X", priority: "high", body: "nope" }, { slug: "new-item", title: "N", priority: "low" }],
      },
      retain_facts: [],
    }));
    expect(parsed?.backlog.complete_explicit).toEqual([{ slug: "ok-item", outcome: "done" }]);
    expect(parsed?.backlog.complete_inferred).toEqual([]);
    expect(parsed?.backlog.new_items).toEqual([{ slug: "new-item", title: "N", priority: "low", related: [], body: "" }]);
  });


describe("lastAssistantText", () => {
  const json = '{"memory":{"frontmatter":{"domains":["x"],"topics":["y"],"priority":"high","status":"completed"},"title":"T","body":"B"},"index_entry":{"summary":"S"},"backlog":{}}';

  it("reads string content", () => {
    expect(lastAssistantText([{ role: "assistant", content: json }])).toBe(json);
  });

  it("reads OMP/Pi array content and skips thinking blocks", () => {
    expect(lastAssistantText([{
      role: "assistant",
      content: [
        { type: "thinking", thinking: "ignore" },
        { type: "text", text: json },
      ],
    }])).toBe(json);
  });

  it("returns empty when only thinking is present", () => {
    expect(lastAssistantText([{
      role: "assistant",
      content: [{ type: "thinking", thinking: "no text" }],
    }])).toBe("");
  });
});

  it("parses auditor verdicts and ignores malformed rows", () => {
    const parsed = parseAuditorResponse(
      `prose {"verdicts":[{"path":"spec.md","verdict":"complete","evidence":"a:1"},{"path":"bad","verdict":"nope"}]}`,
    );
    expect(parsed).toEqual([{ path: "spec.md", verdict: "complete", evidence: "a:1" }]);
  });
});

describe("assembleApplyPayload / buildRetainInstruction", () => {
  const scribe = parseScribeResponse(
    JSON.stringify({
      memory: { frontmatter: { domains: ["x"], topics: ["y"], priority: "high", status: "completed" }, title: "T", body: "B" },
      index_entry: { summary: "S" },
      backlog: { complete_explicit: [], complete_inferred: [], new_items: [] },
      retain_facts: ["fact-one"],
    }),
  )!;

  it("feeds complete auditor verdicts and auto-completable phases into apply", () => {
    const payload = assembleApplyPayload(
      {
        today: "2026-08-26",
        subject: { name: "2026-08-26.foo", path: ".context/2026-08-26.foo", created: false },
        existing_memory: { path: ".context/memory/foo-2026-08-26.md" },
        specs: [{ path: "spec-x.md" }],
        iterates: [{ path: "iterate-x.md", addresses: "plan-x.md", status: "active" }],
        plans: [{ path: "plan-x.md" }],
        phases: { auto_completable: ["phase-1.md"], files: [{ path: "phase-2.md" }] },
        loose_artifacts: [".context/orphan.md"],
      },
      scribe,
      [
        { path: "spec-x.md", verdict: "complete", evidence: "a:1" },
        { path: "phase-2.md", verdict: "complete", evidence: "b:1" },
        { path: "iterate-x.md", verdict: "incomplete", evidence: "c:1" },
      ],
    );
    expect(payload.specs_complete).toEqual(["spec-x.md"]);
    expect(payload.phases_complete).toEqual(["phase-1.md", "phase-2.md"]);
    expect(payload.iterates_complete).toEqual([]);
    expect((payload.crossrefs as Array<{ value: string }>)[0]?.value).toBe("../memory/foo-2026-08-26.md");
  });

  it("carries auditor evidence and spec plan links into the apply payload", () => {
    const payload = assembleApplyPayload(
      {
        today: "2026-08-26",
        subject: { name: "2026-08-26.foo", path: ".context/2026-08-26.foo", created: false },
        existing_memory: { path: ".context/memory/foo-2026-08-26.md" },
        specs: [{ path: "spec-x.md" }],
        iterates: [],
        plans: [{ path: "plan-x.md", spec: "spec-x.md" }, { path: "plan-y.md" }],
        phases: {},
      },
      scribe,
      [
        { path: "spec-x.md", verdict: "complete", evidence: "src/a.ts:42" },
        { path: "plan-x.md", verdict: "complete", evidence: "" },
        { path: "plan-y.md", verdict: "incomplete", evidence: "src/b.ts:1" },
      ],
    );
    expect(payload.verification_evidence).toEqual([{ path: "spec-x.md", evidence: "src/a.ts:42" }]);
    expect(payload.spec_plans).toEqual([{ spec: "spec-x.md", plan: "plan-x.md" }]);
    expect(payload.crossrefs).toContainEqual({
      path: ".context/2026-08-26.foo/spec-x.md",
      key: "memory",
      value: "../memory/foo-2026-08-26.md",
    });
  });

  it("names retain vs learn vs skip from the memory backend", () => {
    expect(buildRetainInstruction({ backend: "hindsight" }, "m.md", "subj", ["f"])).toContain("Call the retain tool");
    expect(buildRetainInstruction({ backend: "local" }, "m.md", "subj", [])).toContain("Call the learn tool");
    expect(buildRetainInstruction({ backend: null }, "m.md", "subj", [])).toContain("No harness memory tool");
  });

  it("classifies array content blocks and function-style tool calls", () => {
    const digest = buildDigest(
      [
        { role: "user", content: [{ type: "text", text: "hi" }] },
        { type: "tool", function: { name: "edit", arguments: { file: "b.ts" } } },
        { type: "tool", name: "read", arguments: { file_path: "c.ts" } },
      ],
      "",
      "",
    );
    expect(digest).toContain("user: hi");
    expect(digest).toContain("edit b.ts");
    expect(digest).toContain("read c.ts");
  });
});

describe("golden parity: preflight + payload + apply", () => {
  const REPO = resolve(import.meta.dirname, "../../..");
  const PREFLIGHT = join(REPO, "skills/b-save-improved/scripts/save-preflight.ts");
  const APPLY = join(REPO, "skills/b-save-improved/scripts/save-apply.ts");

  function count(text: string, pattern: RegExp): number {
    return [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))].length;
  }

  it("reproduces the b-save exemplar shape end-to-end and stays idempotent", () => {
    const root = mkdtempSync(join(tmpdir(), "bsave-golden-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
      const subjectDir = join(root, ".context/2026-08-26.golden");
      mkdirSync(subjectDir, { recursive: true });
      mkdirSync(join(root, ".context/memory"), { recursive: true });
      writeFileSync(join(subjectDir, "index.md"), "---\nstatus: active\n---\n\n# Golden\n\nExisting narrative.\n");
      writeFileSync(
        join(subjectDir, "plan-feature.md"),
        "---\nstatus: active\nsubject: 2026-08-26.golden\nspec: spec-feature.md\n---\n\n# Plan\n\n## User Goal\n\nParity.\n",
      );
      writeFileSync(join(subjectDir, "spec-feature.md"), "---\nstatus: active\nplans: []\n---\n\n# Spec\n");
      writeFileSync(join(root, ".context/memory/index.md"), "- 2026-05-08 | `old.md` | status: completed\n");

      const pre = JSON.parse(
        execFileSync("bun", [PREFLIGHT, "--subject", "2026-08-26.golden"], { cwd: root, encoding: "utf8" }),
      ) as Record<string, any>;
      expect(pre.plans).toEqual([
        expect.objectContaining({ path: "plan-feature.md", spec: "spec-feature.md" }),
      ]);

      const scribe = parseScribeResponse(JSON.stringify({
        memory: {
          frontmatter: { domains: ["extensions"], topics: ["parity"], artifacts: [], related: [], priority: "high", status: "completed" },
          title: "Golden parity",
          body: [
            "## User Goal", "", "Zero fidelity loss.", "",
            "## What happened", "", "Compared exemplars.", "",
            "## Decision", "", "Deterministic applies.", "",
            "## What shipped", "", "- Evidence lines", "",
            "## Verification", "", "Vitest suite green.", "",
            "## Leftover", "", "None.", "",
            "## Related", "", "- nothing",
          ].join("\n"),
        },
        index_entry: { summary: "Golden parity checkpoint" },
        backlog: { complete_explicit: [], complete_inferred: [], new_items: [] },
        retain_facts: [],
      }))!;
      const payload = assembleApplyPayload(pre, scribe, [
        { path: "spec-feature.md", verdict: "complete", evidence: "extensions/a.ts:42" },
      ]);
      const apply = (p: unknown) => JSON.parse(execFileSync("bun", [APPLY], {
        cwd: root, input: JSON.stringify(p), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
      }));

      expect(apply(payload).errors).toEqual([]);

      const today = pre.today;
      const memoryPath = join(root, ".context/memory", `golden-${today}.md`);
      const memory = readFileSync(memoryPath, "utf8");
      for (const heading of ["User Goal", "What happened", "Decision", "What shipped", "Verification", "Leftover", "Related"]) {
        expect(count(memory, new RegExp(`^## ${heading}$`, "m"))).toBe(1);
      }
      expect(memory).toContain("- `spec-feature.md` — extensions/a.ts:42");
      expect(memory).toMatch(/^## Verification\n\nVitest suite green\.\n\n- `spec-feature\.md` — extensions\/a\.ts:42$/m);

      const index = readFileSync(join(root, ".context/memory/index.md"), "utf8");
      expect(index.startsWith(`- ${today} — [Golden parity checkpoint](golden-${today}.md) — \`completed\`\n`)).toBe(true);
      expect(index).toContain(`  - ${today} | \`golden-${today}.md\` | domains: [extensions] | topics: [parity] | status: completed`);

      const subjectIndex = readFileSync(join(subjectDir, "index.md"), "utf8");
      expect(subjectIndex).toMatch(/^status: completed$/m);
      expect(subjectIndex).toMatch(/^date: \d{4}-\d{2}-\d{2}$/m);
      expect(subjectIndex).toMatch(/^subject: 2026-08-26\.golden$/m);
      expect(subjectIndex).toMatch(/^topics: \[parity\]$/m);
      expect(subjectIndex).toMatch(new RegExp(`^memory: \\[golden-${today}\\.md\\]$`, "m"));
      expect(subjectIndex).toContain("# Golden");
      expect(subjectIndex).toContain("Existing narrative.");
      for (const heading of ["What shipped", "Verification", "Related"]) {
        expect(count(subjectIndex, new RegExp(`^## ${heading}$`, "m"))).toBe(1);
      }
      expect(subjectIndex).toContain("- Evidence lines");
      expect(subjectIndex).toContain("Vitest suite green.");
      expect(subjectIndex).toContain(`## Related\n\nMemory: \`.context/memory/golden-${today}.md\``);

      const spec = readFileSync(join(subjectDir, "spec-feature.md"), "utf8");
      expect(spec).toMatch(/^status: completed$/m);
      expect(spec).toContain(`memory: [../memory/golden-${today}.md]`);
      expect(spec).toContain("plans: [plan-feature.md]");

      const plan = readFileSync(join(subjectDir, "plan-feature.md"), "utf8");
      expect(plan).toContain(`memory: [../memory/golden-${today}.md]`);

      // Re-run the same payload: nothing duplicates.
      expect(apply(payload).errors).toEqual([]);
      const memoryAgain = readFileSync(memoryPath, "utf8");
      expect(count(memoryAgain, /extensions\/a\.ts:42/g)).toBe(1);
      expect(count(memoryAgain, /^## Verification$/m)).toBe(1);
      const subjectIndexAgain = readFileSync(join(subjectDir, "index.md"), "utf8");
      expect(count(subjectIndexAgain, /^## What shipped$/m)).toBe(1);
      expect(count(subjectIndexAgain, /^## Related$/m)).toBe(1);
      expect((readFileSync(join(subjectDir, "spec-feature.md"), "utf8").match(/plan-feature\.md/g) ?? []).length).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
