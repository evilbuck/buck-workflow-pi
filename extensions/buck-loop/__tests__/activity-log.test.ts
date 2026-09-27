import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ACTIVITY_LOG_RELPATH,
  createBuckLoopActivityLog,
} from "../activity-log.js";

const roots: string[] = [];

function root(git = false): string {
  const directory = mkdtempSync(join(tmpdir(), "buck-loop-activity-log-"));
  roots.push(directory);
  if (git) execFileSync("git", ["init", "-q"], { cwd: directory });
  return directory;
}

function records(directory: string): Array<Record<string, unknown>> {
  return readFileSync(join(directory, ACTIVITY_LOG_RELPATH), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

afterEach(() => {
  roots.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("buck-loop activity log", () => {
  it("writes ordered, versioned JSONL records before close", async () => {
    const directory = root();
    const log = await createBuckLoopActivityLog({ cwd: directory, command: "start", path: "plan.md", onWarning: () => undefined });

    log.progress({ state: "building", operation: "run-skill", label: "Building", target: "phase.md" });
    log.activity({ kind: "toolStart", tool: "read", target: "plan.md" });
    await log.flush();

    const disk = records(directory);
    expect(disk.map((record) => record.type)).toEqual(["invocation", "progress", "activity"]);
    expect(disk.every((record) => record.version === 1)).toBe(true);
    expect(disk.every((record) => typeof record.timestamp === "string" && !Number.isNaN(Date.parse(record.timestamp as string)))).toBe(true);
    expect(new Set(disk.map((record) => record.invocationId))).toHaveLength(1);
    expect(disk[0]).toMatchObject({ command: "start", path: "plan.md" });
    await log.close();
  });

  it("truncates for start, appends for resume, and does not touch status or stop", async () => {
    const directory = root();
    const logPath = join(directory, ACTIVITY_LOG_RELPATH);
    const first = await createBuckLoopActivityLog({ cwd: directory, command: "start", path: "first.md", onWarning: () => undefined });
    await first.close();
    const previous = readFileSync(logPath, "utf8");

    const resumed = await createBuckLoopActivityLog({ cwd: directory, command: "resume", onWarning: () => undefined });
    await resumed.close();
    expect(records(directory).map((record) => record.command)).toEqual(["start", "resume"]);

    const restarted = await createBuckLoopActivityLog({ cwd: directory, command: "start", path: "second.md", onWarning: () => undefined });
    await restarted.close();
    expect(records(directory)).toHaveLength(1);
    expect(records(directory)[0]).toMatchObject({ command: "start", path: "second.md" });
    expect(readFileSync(logPath, "utf8")).not.toBe(previous);

    const before = readFileSync(logPath, "utf8");
    await (await createBuckLoopActivityLog({ cwd: directory, command: "status", onWarning: () => undefined })).close();
    await (await createBuckLoopActivityLog({ cwd: directory, command: "stop", onWarning: () => undefined })).close();
    expect(readFileSync(logPath, "utf8")).toBe(before);
  });

  it("locally ignores the runtime log in Git repositories", async () => {
    const directory = root(true);
    const log = await createBuckLoopActivityLog({ cwd: directory, command: "start", path: "plan.md", onWarning: () => undefined });
    await log.close();

    expect(existsSync(join(directory, ACTIVITY_LOG_RELPATH))).toBe(true);
    expect(readFileSync(join(directory, ".git/info/exclude"), "utf8")).toContain(ACTIVITY_LOG_RELPATH);
    expect(() => execFileSync("git", ["check-ignore", "-q", ACTIVITY_LOG_RELPATH], { cwd: directory })).not.toThrow();
  });

  it("warns when a previously tracked activity log is removed from the index", async () => {
    const directory = root(true);
    mkdirSync(join(directory, ".context", "workflow"), { recursive: true });
    writeFileSync(join(directory, ACTIVITY_LOG_RELPATH), "{\"type\":\"old\"}\n");
    execFileSync("git", ["add", "--", ACTIVITY_LOG_RELPATH], { cwd: directory });
    execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-qm", "track log"], { cwd: directory });
    const warnings: string[] = [];
    const log = createBuckLoopActivityLog({ cwd: directory, command: "start", onWarning: (message) => warnings.push(message) });
    await log.close();
    expect(execFileSync("git", ["ls-files", "--", ACTIVITY_LOG_RELPATH], { cwd: directory, encoding: "utf8" }).trim()).toBe("");
    expect(existsSync(join(directory, ACTIVITY_LOG_RELPATH))).toBe(true);
    expect(warnings).toEqual([expect.stringContaining("removed")]);
  });


  it("warns once and leaves the loop-facing handle usable when opening fails", async () => {
    const directory = root();
    writeFileSync(join(directory, ".context"), "not a directory");
    const warnings: string[] = [];
    const log = await createBuckLoopActivityLog({
      cwd: directory,
      command: "start",
      path: "plan.md",
      onWarning: (message) => warnings.push(message),
    });

    log.activity({ kind: "text", delta: "still running" });
    await log.close();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("activity log disabled");
  });

  it("flushes a burst in order and closes with the terminal record", async () => {
    const directory = root(true);
    const warnings: string[] = [];
    const log = createBuckLoopActivityLog({ cwd: directory, command: "start", onWarning: (message) => warnings.push(message) });
    for (let index = 0; index < 2_000; index++) log.activity({ kind: "text", delta: String(index) });
    log.terminal({ state: "done", reason: "burst complete", ok: true });
    await Promise.all([log.close(), log.close()]);
    const disk = records(directory);
    expect(disk.slice(1, -1).map((record) => record.delta)).toEqual(Array.from({ length: 2_000 }, (_, index) => String(index)));
    expect(disk.at(-1)).toMatchObject({ type: "terminal", state: "done", reason: "burst complete" });
    expect(warnings).toEqual([]);
  });

  it("disables once when a synchronous burst exceeds the bounded pending buffer", async () => {
    const directory = root(true);
    const warnings: string[] = [];
    const log = createBuckLoopActivityLog({ cwd: directory, command: "start", onWarning: (message) => warnings.push(message) });
    const delta = "x".repeat(16_384);
    for (let index = 0; index < 100; index++) log.activity({ kind: "text", delta });
    await log.flush();
    await log.close();
    expect(warnings).toEqual([expect.stringContaining("1 MiB buffer limit")]);
    expect(readFileSync(join(directory, ACTIVITY_LOG_RELPATH)).byteLength).toBeLessThanOrEqual(1024 * 1024);
  });

  it("shares the warning budget between hygiene and asynchronous open failures", async () => {
    const directory = root();
    mkdirSync(join(directory, ACTIVITY_LOG_RELPATH), { recursive: true });
    const warnings: string[] = [];
    const log = createBuckLoopActivityLog({ cwd: directory, command: "start", onWarning: (message) => warnings.push(message) });
    await log.flush();
    await log.close();
    expect(warnings).toEqual([expect.stringContaining("hygiene skipped")]);
  });
});
