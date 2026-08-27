import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
      { role: "user", content: "AAAA".repeat(200) },
      { type: "compaction", summary: "keep-me" },
      { role: "assistant", content: "BBBB".repeat(200) },
    ];
    const digest = buildDigest(entries, "", "", 400);
    expect(digest).toContain("[digest truncated:");
    expect(digest).toContain("keep-me");
    expect(digest.startsWith("[digest truncated:")).toBe(true);
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
