import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type * as OmpModels from "../../omp-models.js";
import { cleanupRepos, repo } from "./fixtures.js";

const { runOmpModelSession } = vi.hoisted(() => ({ runOmpModelSession: vi.fn() }));

vi.mock("../../omp-models.js", async (importOriginal) => ({
  ...(await importOriginal<typeof OmpModels>()),
  runOmpModelSession,
}));

import { choose } from "../choice.js";

const subject = "2026-09-18.choice-test";
const legal = [{ kind: "iterate" }, { kind: "document" }, { kind: "save" }, { kind: "block" }] as const;

function audits(cwd: string): Array<Record<string, unknown>> {
  const dir = join(cwd, ".context", subject, "transition-audits");
  return readdirSync(dir)
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>);
}

describe("choose", () => {
  beforeEach(() => runOmpModelSession.mockReset());
  afterEach(cleanupRepos);

  it("accepts a first-attempt legal JSON choice and records its audit", async () => {
    const cwd = repo();
    runOmpModelSession.mockResolvedValue('{"choice":"save","reason":"ready"}');

    await expect(choose({ cwd, subject, legal })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "save" }, reason: "ready" },
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(1);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ legal, raw: '{"choice":"save","reason":"ready"}', accepted: true, reason: "ready", attempt: 1 }),
    ]);
  });

  it("rejects an illegal choice before accepting the second legal choice", async () => {
    const cwd = repo();
    runOmpModelSession
      .mockResolvedValueOnce('{"choice":"advance","reason":"wrong"}')
      .mockResolvedValueOnce('{"choice":"document","reason":"needed"}');

    await expect(choose({ cwd, subject, legal })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "document" }, reason: "needed" },
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(2);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ legal, accepted: true, reason: "needed", attempt: 2 }),
    ]);
  });

  it("fails closed after two illegal outputs without a default choice", async () => {
    const cwd = repo();
    runOmpModelSession
      .mockResolvedValueOnce('{"choice":"advance","reason":"wrong"}')
      .mockResolvedValueOnce('{"choice":"retry","reason":"also wrong"}');

    const result = await choose({ cwd, subject, legal });
    expect(result.status).toBe("blocked");
    expect(runOmpModelSession).toHaveBeenCalledTimes(2);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ legal, accepted: false, attempt: 2 }),
    ]);
  });

  it.each(["", "I recommend save because it is safe."])("blocks malformed output %j after retry", async (output) => {
    const cwd = repo();
    runOmpModelSession.mockResolvedValue(output);

    await expect(choose({ cwd, subject, legal })).resolves.toMatchObject({ status: "blocked" });
    expect(runOmpModelSession).toHaveBeenCalledTimes(2);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ legal, raw: output, parsed: null, accepted: false, attempt: 1 }),
      expect.objectContaining({ legal, raw: output, parsed: null, accepted: false, attempt: 2 }),
    ]);
  });

  it("confines the model to supplied kinds and disables tools", async () => {
    const cwd = repo();
    const limitedLegal = [{ kind: "iterate" }, { kind: "save" }] as const;
    runOmpModelSession.mockResolvedValue('{"choice":"save","reason":"continue"}');

    await choose({ cwd, subject, legal: limitedLegal });

    expect(runOmpModelSession).toHaveBeenCalledWith(expect.objectContaining({ tools: [], agentPrefix: "buck-loop-choice" }));
    const prompt = (runOmpModelSession.mock.calls[0]?.[0] as { prompt: string }).prompt;
    expect(prompt).toContain("iterate");
    expect(prompt).toContain("save");
    expect(prompt).not.toContain("document");
    expect(prompt).not.toContain("advance");
    expect(prompt).toMatch(/\{\s*"choice".*"reason"/s);
  });

  it("blocks an empty legal set without calling the model", async () => {
    await expect(choose({ cwd: repo(), subject, legal: [] })).resolves.toMatchObject({ status: "blocked" });
    expect(runOmpModelSession).not.toHaveBeenCalled();
  });
});
