import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseExecPolicy,
  readOnlyGitCommands,
  checkContractCommands,
  resolveRequestCwd,
  runReviewCommand,
  sanitizedEnv,
  PolicyError,
  type ExecPolicy,
} from "../policy.js";

const POLICY_MD = [
  "---",
  "schema_version: 1",
  "default_timeout_ms: 30000",
  "max_output_bytes: 4096",
  "allow_network: true",
  "commands:",
  "  - id: node-eval",
  "    executable: node",
  "    argv_prefix: [-e]",
  "    timeout_ms: 2000",
  "    max_output_bytes: 512",
  "  - id: git-status",
  "    executable: git",
  "    argv_prefix: [status]",
  "---",
].join("\n");

describe("parseExecPolicy", () => {
  it("parses defaults and command entries", () => {
    const policy = parseExecPolicy(POLICY_MD);
    expect(policy.defaultTimeoutMs).toBe(30_000);
    expect(policy.defaultMaxOutputBytes).toBe(4096);
    expect(policy.allowNetwork).toBe(true);
    expect(policy.commands).toEqual([
      { id: "node-eval", executable: "node", argvPrefix: ["-e"], timeoutMs: 2000, maxOutputBytes: 512, extraEnv: undefined },
      { id: "git-status", executable: "git", argvPrefix: ["status"], timeoutMs: undefined, maxOutputBytes: undefined, extraEnv: undefined },
    ]);
  });

  it("rejects bad schema versions, missing fields, and duplicate ids", () => {
    expect(() => parseExecPolicy("---\nschema_version: 2\n---\n")).toThrow(PolicyError);
    expect(() =>
      parseExecPolicy("---\nschema_version: 1\ncommands:\n  - executable: x\n---\n"),
    ).toThrow(/id and executable/);
    expect(() =>
      parseExecPolicy("---\nschema_version: 1\ncommands:\n  - id: a\n    executable: x\n  - id: a\n    executable: y\n---\n"),
    ).toThrow(/duplicate command id a/);
    expect(() => parseExecPolicy("---\nschema_version: 1\n---\n")).toThrow(/commands must be a list/);
  });
});

describe("built-in command sources", () => {
  it("readOnlyGitCommands exposes fixed read-only subcommands", () => {
    expect(readOnlyGitCommands().map((c) => c.id)).toEqual([
      "git-status",
      "git-diff",
      "git-log",
      "git-show",
      "git-blame",
      "git-ls-files",
    ]);
  });

  it("checkContractCommands splits safe strings and skips shell syntax", () => {
    const { entries, skipped } = checkContractCommands(["npm test", "vitest run --reporter=dot", "npm run x && echo hi", "  "]);
    expect(entries).toEqual([
      { id: "check-npm-test", executable: "npm", argvPrefix: ["test"] },
      { id: "check-vitest-run-reporter=dot", executable: "vitest", argvPrefix: ["run", "--reporter=dot"] },
    ]);
    expect(skipped).toEqual(["npm run x && echo hi"]);
  });
});

describe("resolveRequestCwd", () => {
  it("accepts repo-relative paths and rejects escapes, including symlink escape", () => {
    const root = mkdtempSync(join(tmpdir(), "policy-root-"));
    const outside = mkdtempSync(join(tmpdir(), "policy-out-"));
    try {
      mkdirSync(join(root, "src", "x"), { recursive: true });
      expect(resolveRequestCwd(root, ".")).toEqual({ cwd: realpathSync(root) });
      expect(resolveRequestCwd(root, "src/x")).toEqual({ cwd: realpathSync(join(root, "src/x")) });
      expect(resolveRequestCwd(root, "../etc")).toHaveProperty("denied");
      expect(resolveRequestCwd(root, "src/../../etc")).toHaveProperty("denied");
      expect(resolveRequestCwd(root, "/etc/passwd")).toHaveProperty("denied");
      symlinkSync(outside, join(root, "escape"));
      expect(resolveRequestCwd(root, "escape")).toHaveProperty("denied");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("sanitizedEnv", () => {
  beforeAll(() => {
    process.env.POLICY_TEST_SECRET = "hunter2";
    process.env.POLICY_TEST_EXTRA = "kept";
  });

  it("keeps the allowlist and safe extras, drops credential-like keys", () => {
    const env = sanitizedEnv(["POLICY_TEST_EXTRA", "POLICY_TEST_SECRET", "not a key!"]);
    expect(env.POLICY_TEST_EXTRA).toBe("kept");
    expect(env.POLICY_TEST_SECRET).toBeUndefined();
    expect(Object.keys(env)).not.toContain("not a key!");
  });

  it("drops process-injection variables from extras", () => {
    process.env.POLICY_TEST_NODE_OPTIONS = "--require=evil.js";
    process.env.POLICY_TEST_BASH_ENV = "evil.sh";
    process.env.LD_POLICY_TEST = "1";
    const env = sanitizedEnv([
      "POLICY_TEST_NODE_OPTIONS",
      "POLICY_TEST_BASH_ENV",
      "LD_POLICY_TEST",
      "NODE_OPTIONS",
      "BASH_ENV",
      "LD_PRELOAD",
      "PYTHONPATH",
    ]);
    expect(Object.keys(env)).not.toContain("POLICY_TEST_NODE_OPTIONS");
    expect(Object.keys(env)).not.toContain("POLICY_TEST_BASH_ENV");
    expect(Object.keys(env)).not.toContain("LD_POLICY_TEST");
    expect(env.NODE_OPTIONS).toBeUndefined();
    expect(env.BASH_ENV).toBeUndefined();
    expect(env.LD_PRELOAD).toBeUndefined();
    expect(env.PYTHONPATH).toBeUndefined();
  });
});
describe("runReviewCommand", () => {
  const policy: ExecPolicy = parseExecPolicy(POLICY_MD);
  const root = process.cwd();

  it("denies unknown ids structurally, with a policy reason", async () => {
    const record = await runReviewCommand(policy, root, { id: "rm-rf", argv: ["rm", "-rf", "/"] });
    expect(record.denied_reason).toMatch(/unknown command id/);
    expect(record.exit_code).toBeNull();
    expect(record.network_exposed).toBe(false);
  });

  it("denies argv that does not match executable and prefix element-wise", async () => {
    const wrongBin = await runReviewCommand(policy, root, { id: "node-eval", argv: ["bash", "-c", "echo hi"] });
    expect(wrongBin.denied_reason).toMatch(/argv\[0\] must be node/);
    const wrongPrefix = await runReviewCommand(policy, root, { id: "git-status", argv: ["git", "push"] });
    expect(wrongPrefix.denied_reason).toMatch(/must start with/);
    const tooShort = await runReviewCommand(policy, root, { id: "git-status", argv: ["git"] });
    expect(tooShort.denied_reason).toMatch(/requires at least/);
  });

  it("denies cwd escape", async () => {
    const record = await runReviewCommand(policy, root, { id: "git-status", argv: ["git", "status"], cwd: ".." });
    expect(record.denied_reason).toMatch(/repo-relative/);
  });

  it("runs an allowed command and records evidence with hashes", async () => {
    const record = await runReviewCommand(policy, root, {
      id: "node-eval",
      argv: ["node", "-e", "console.log('hello evidence')"],
    });
    expect(record.denied_reason).toBeNull();
    expect(record.exit_code).toBe(0);
    expect(record.stdout_excerpt).toContain("hello evidence");
    expect(record.stdout_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(record.timed_out).toBe(false);
    expect(record.cwd).toBe(".");
    expect(record.network_exposed).toBe(true);
  });

  it("records non-zero exit codes without treating them as denial", async () => {
    const record = await runReviewCommand(policy, root, {
      id: "node-eval",
      argv: ["node", "-e", "process.exit(3)"],
    });
    expect(record.denied_reason).toBeNull();
    expect(record.exit_code).toBe(3);
  });

  // Real process + real timer: the SIGKILL-of-process-tree path can only be
  // exercised against the platform clock. Kept at 150ms to bound the cost.
  it("kills the process tree on timeout", async () => {
    const fastPolicy = parseExecPolicy(
      POLICY_MD.replace("timeout_ms: 2000", "timeout_ms: 150"),
    );
    const record = await runReviewCommand(fastPolicy, root, {
      id: "node-eval",
      argv: ["node", "-e", "setInterval(() => {}, 60000)"],
    });
    expect(record.timed_out).toBe(true);
    expect(record.duration_ms).toBeLessThan(5_000);
  });

  it("caps output excerpts and marks truncation", async () => {
    const record = await runReviewCommand(policy, root, {
      id: "node-eval",
      argv: ["node", "-e", "process.stdout.write('x'.repeat(2000))"],
    });
    expect(record.stdout_truncated).toBe(true);
    expect(record.stdout_excerpt.length).toBe(512);
  });

  it("caps excerpts by bytes so multibyte output cannot exceed the cap", async () => {
    const record = await runReviewCommand(policy, root, {
      id: "node-eval",
      argv: ["node", "-e", "process.stdout.write('é'.repeat(400))"],
    });
    expect(record.stdout_truncated).toBe(true);
    expect(Buffer.byteLength(record.stdout_excerpt, "utf8")).toBe(512);
  });

  it("walks back to a codepoint boundary instead of emitting U+FFFD", async () => {
    const record = await runReviewCommand(policy, root, {
      id: "node-eval",
      argv: ["node", "-e", "process.stdout.write('€'.repeat(200))"],
    });
    expect(record.stdout_truncated).toBe(true);
    expect(record.stdout_excerpt).not.toContain("\uFFFD");
    expect(Buffer.byteLength(record.stdout_excerpt, "utf8")).toBe(510);
    expect(record.stdout_excerpt).toBe("€".repeat(170));
  });
});
