/**
 * Phase 2 contract tests: worker mode prompts, expected result frontmatter,
 * and audit metadata for build, review, iterate, and save modes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  rmSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  runWorker,
  getWorkerPrompt,
  getExpectedAuditFields,
  type WorkerResult,
} from "../worker.js";
import type { ChunkQueueItem, WorkerMode } from "../types.js";

const TEST_ROOT = join("/tmp", "bflow-phase2-test-" + Date.now());

function makeChunk(overrides: Partial<ChunkQueueItem> = {}): ChunkQueueItem {
  return {
    id: "phase-1-test",
    type: "phase",
    path: "phase-1-test.md",
    status: "pending",
    workerAttempts: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prompt contract tests
// ---------------------------------------------------------------------------

describe("Phase 2: Worker prompt contracts", () => {
  const chunk = makeChunk();
  const goal = "Implement autonomous b-flow inner loop";
  const resultFile = "/tmp/result.md";

  describe("build mode prompt", () => {
    it("references the b-build skill", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "build");
      expect(prompt).toContain("skills/b-build/SKILL.md");
      expect(prompt).toContain("Mode: Build");
    });

    it("references b-build-hard for hard difficulty", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "build", undefined, "hard");
      expect(prompt).toContain("b-build-hard");
    });

    it("does not reference b-build-hard for easy/medium difficulty", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "build", undefined, "medium");
      expect(prompt).not.toContain("b-build-hard");
    });

    it("includes expected result frontmatter", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "build");
      expect(prompt).toContain("mode: build");
      expect(prompt).toContain("changed_files: [list]");
      expect(prompt).toContain("acceptance_criteria_met: [list]");
      expect(prompt).toContain("acceptance_criteria_missed: [list]");
    });
  });

  describe("review mode prompt", () => {
    it("references the b-review skill", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "review");
      expect(prompt).toContain("skills/b-review/SKILL.md");
      expect(prompt).toContain("Mode: Review");
    });

    it("includes plan reference when inputPath provided", () => {
      const prompt = getWorkerPrompt(
        chunk, goal, resultFile, "review",
        ".context/plan.md",
      );
      expect(prompt).toContain(".context/plan.md");
      expect(prompt).toContain("plan/phase acceptance contract");
    });

    it("includes review-specific frontmatter fields", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "review");
      expect(prompt).toContain("review_passed: <true | false>");
      expect(prompt).toContain("issues_found: <true | false>");
      expect(prompt).toContain("requires_replan: <true | false>");
      expect(prompt).toContain("iterate_file: <path if issues found>");
      expect(prompt).toContain("issue_fingerprint: <hash or label>");
    });
  });

  describe("iterate mode prompt", () => {
    it("references the b-iterate skill", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "iterate");
      expect(prompt).toContain("skills/b-iterate/SKILL.md");
      expect(prompt).toContain("Mode: Iterate");
    });

    it("includes iterate artifact reference when inputPath provided", () => {
      const prompt = getWorkerPrompt(
        chunk, goal, resultFile, "iterate",
        "iterate-fix-types.md",
      );
      expect(prompt).toContain("iterate-fix-types.md");
      expect(prompt).toContain("active iterate artifact");
    });

    it("includes iterate-specific frontmatter fields", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "iterate");
      expect(prompt).toContain("iterate_artifact: <path of iterate file addressed>");
      expect(prompt).toContain("iterate_status: <completed | partial | failed>");
    });
  });

  describe("save mode prompt", () => {
    it("includes save workflow instructions", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "save");
      expect(prompt).toContain("Mode: Save");
      expect(prompt).toContain("draft-commit.md");
    });

    it("includes save-specific frontmatter fields", () => {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, "save");
      expect(prompt).toContain("phase_completed: <phase file path>");
      expect(prompt).toContain("draft_commit: <path to draft-commit.md>");
    });
  });

  it("all modes include chunk info and goal", () => {
    const modes: WorkerMode[] = ["build", "review", "iterate", "save"];
    for (const mode of modes) {
      const prompt = getWorkerPrompt(chunk, goal, resultFile, mode);
      expect(prompt).toContain(chunk.id);
      expect(prompt).toContain(goal);
      expect(prompt).toContain(resultFile);
      expect(prompt).toContain(`mode: ${mode}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Audit metadata contract tests
// ---------------------------------------------------------------------------

describe("Phase 2: Worker audit metadata", () => {
  it("includes mode in audit fields", () => {
    const audit = getExpectedAuditFields(makeChunk(), "build");
    expect(audit.mode).toBe("build");
  });

  it("includes mode for all worker modes", () => {
    const modes: WorkerMode[] = ["build", "review", "iterate", "save"];
    for (const mode of modes) {
      const audit = getExpectedAuditFields(makeChunk(), mode);
      expect(audit.mode).toBe(mode);
    }
  });

  it("includes inputPath when provided", () => {
    const audit = getExpectedAuditFields(makeChunk(), "review", "plan.md");
    expect(audit.inputPath).toBe("plan.md");
  });

  it("inputPath is null when not provided", () => {
    const audit = getExpectedAuditFields(makeChunk(), "build");
    expect(audit.inputPath).toBeNull();
  });

  it("includes difficulty when provided", () => {
    const audit = getExpectedAuditFields(makeChunk(), "build", undefined, "hard");
    expect(audit.difficulty).toBe("hard");
  });

  it("difficulty is null when not provided", () => {
    const audit = getExpectedAuditFields(makeChunk(), "build");
    expect(audit.difficulty).toBeNull();
  });

  it("includes chunk metadata", () => {
    const chunk = makeChunk({ id: "phase-2", type: "phase", path: "phase-2.md" });
    const audit = getExpectedAuditFields(chunk, "build");
    expect(audit.chunkId).toBe("phase-2");
    expect(audit.chunkType).toBe("phase");
    expect(audit.chunkPath).toBe("phase-2.md");
  });
});

// ---------------------------------------------------------------------------
// Worker invocation with mode — audit file written correctly
// ---------------------------------------------------------------------------

describe("Phase 2: Worker audit file written with mode", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("writes audit file with mode, pid, chunkId, and resultFile", async () => {
    const subject = "2026-05-18.test-audit";
    const subjectDir = join(TEST_ROOT, ".context", subject);
    mkdirSync(subjectDir, { recursive: true });

    const chunk = makeChunk();

    // Mock spawn that immediately exits 0 after writing result file
    const mockSpawn = (args: string[], opts: { cwd: string }) => {
      // Find the result file path from the prompt
      const promptFile = args.find((a) => a.startsWith("@"));
      let resultPath = "";
      if (promptFile) {
        const pf = promptFile.slice(1);
        if (existsSync(pf)) {
          const content = readFileSync(pf, "utf-8");
          const match = content.match(/Write the result file to: (.+)/);
          if (match) resultPath = match[1];
        }
      }

      // Write a minimal result file
      if (resultPath) {
        const dir = resultPath.substring(0, resultPath.lastIndexOf("/"));
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(
          resultPath,
          [
            "---",
            `chunk_id: ${chunk.id}`,
            "mode: build",
            "status: completed",
            "---",
            "",
            "# Done",
          ].join("\n"),
        );
      }

      const listeners: Record<string, Function[]> = {};
      return {
        pid: 12345,
        stdout: { on: (_evt: string, fn: Function) => {} },
        stderr: { on: (_evt: string, fn: Function) => {} },
        on: (evt: string, fn: Function) => {
          if (!listeners[evt]) listeners[evt] = [];
          listeners[evt].push(fn);
          // Simulate immediate close
          if (evt === "close") {
            setTimeout(() => fn(0), 10);
          }
        },
        kill: () => {},
      };
    };

    const result = await runWorker(chunk, {
      projectRoot: TEST_ROOT,
      subject,
      goal: "test audit",
      mode: "review",
      inputPath: "plan.md",
      spawnFn: mockSpawn as any,
    });

    expect(result.type).toBe("WORKER_COMPLETED");
    expect(result.mode).toBe("review");

    // Check audit file
    const auditDir = join(subjectDir, "worker-audits");
    const auditFiles = existsSync(auditDir)
      ? require("fs").readdirSync(auditDir).filter((f: string) => f.endsWith("-audit.json"))
      : [];
    expect(auditFiles.length).toBe(1);

    const auditContent = JSON.parse(
      readFileSync(join(auditDir, auditFiles[0]), "utf-8"),
    );
    expect(auditContent.mode).toBe("review");
    expect(auditContent.chunkId).toBe(chunk.id);
    expect(auditContent.pid).toBe(12345);
    expect(auditContent.inputPath).toBe("plan.md");
    expect(auditContent.startedAt).toBeDefined();
    expect(auditContent.resultFile).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// WorkerResult mode field
// ---------------------------------------------------------------------------

describe("Phase 2: WorkerResult includes mode", () => {
  it("WORKER_COMPLETED includes mode", () => {
    const result: WorkerResult = {
      type: "WORKER_COMPLETED",
      resultFile: "/tmp/result.md",
      status: "completed",
      mode: "build",
    };
    expect(result.mode).toBe("build");
  });

  it("WORKER_FAILED includes mode", () => {
    const result: WorkerResult = {
      type: "WORKER_FAILED",
      error: "timeout",
      mode: "review",
    };
    expect(result.mode).toBe("review");
  });
});
