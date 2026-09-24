/**
 * Closed-set choice tests. Jev is the registered tool; `runOmpModelSession`
 * is the smol fallback. Both are mocked. `block` is never offered.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type * as OmpModels from "../../omp-models.js";
import { cleanupRepos, repo } from "./fixtures.js";

const { runOmpModelSession, evaluate } = vi.hoisted(() => ({
  runOmpModelSession: vi.fn(),
  evaluate: vi.fn(),
}));

vi.mock("../../omp-models.js", async (importOriginal) => ({
  ...(await importOriginal<typeof OmpModels>()),
  runOmpModelSession,
}));

vi.mock("../../typed-output/evaluator.js", () => ({
  createTypeSafeEvaluator: () => evaluate,
}));

import { choose } from "../choice.js";

const subject = "2026-09-18.choice-test";
const legal = [{ kind: "iterate" }, { kind: "document" }, { kind: "save" }] as const;

function audits(cwd: string): Array<Record<string, unknown>> {
  const dir = join(cwd, ".context", subject, "transition-audits");
  return readdirSync(dir)
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>);
}

function jevSave(confidence = 0.91) {
  return {
    ok: true,
    result: {
      model: "jev-latest",
      answers: {
        action: {
          type: "choice",
          choice: "save",
          confidence,
          probabilities: { iterate: 0.03, document: 0.06, save: confidence },
        },
      },
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  };
}

describe("choose", () => {
  beforeEach(() => {
    runOmpModelSession.mockReset();
    evaluate.mockReset();
    evaluate.mockResolvedValue({ ok: false, failure: { code: "provider_unavailable", message: "down" } });
  });
  afterEach(cleanupRepos);

function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  return value[key];
}

function jevCriteria(call: unknown): object {
  const criteria = field(field(field(call, "questions"), "action"), "criteria");
  if (!criteria || typeof criteria !== "object") throw new Error("Jev criteria missing");
  return criteria;
}

function smolPrompt(call: unknown): string {
  const prompt = field(call, "prompt");
  if (typeof prompt !== "string") throw new Error("smol was not called");
  return prompt;
}

  it("accepts a Jev tool choice and does not call smol", async () => {
    const cwd = repo();
    evaluate.mockResolvedValue(jevSave());

    await expect(choose({ cwd, subject, legal })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "save" }, reason: "Jev picked save (confidence 0.91)" },
    });
    expect(runOmpModelSession).not.toHaveBeenCalled();
    expect(Object.keys(jevCriteria(evaluate.mock.calls[0]?.[0]))).toEqual(["iterate", "document", "save"]);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ source: "jev", legal, accepted: true, attempt: 1 }),
    ]);
  });

  it("streams the Jev pick through the supplied sink", async () => {
    const onActivity = vi.fn();
    evaluate.mockResolvedValue(jevSave());

    await choose({ cwd: repo(), subject, legal, onActivity });

    expect(onActivity).toHaveBeenCalledWith({ kind: "text", delta: "Jev picked save (confidence 0.91)" });
  });

  it("falls back to smol when the Jev tool fails", async () => {
    const cwd = repo();
    runOmpModelSession.mockResolvedValue('{"choice":"save","reason":"ready"}');

    await expect(choose({ cwd, subject, legal })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "save" }, reason: "ready" },
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(1);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ source: "jev", legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "smol", legal, raw: '{"choice":"save","reason":"ready"}', accepted: true, reason: "ready", attempt: 1 }),
    ]);
  });

  it("falls back to smol when the Jev tool throws", async () => {
    const cwd = repo();
    evaluate.mockRejectedValue(new Error("socket hang up"));
    runOmpModelSession.mockResolvedValue('{"choice":"document","reason":"needed"}');

    await expect(choose({ cwd, subject, legal })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "document" }, reason: "needed" },
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(1);
  });

  it("does not accept a Jev answer of block", async () => {
    const cwd = repo();
    evaluate.mockResolvedValue({
      ok: true,
      result: {
        model: "jev-latest",
        answers: { action: { type: "choice", choice: "block", confidence: 0.99, probabilities: { block: 0.99, save: 0.01 } } },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    });
    runOmpModelSession.mockResolvedValue('{"choice":"save","reason":"continue"}');

    await expect(choose({ cwd, subject, legal: [...legal, { kind: "block" }] })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "save" }, reason: "continue" },
    });
    expect(jevCriteria(evaluate.mock.calls[0]?.[0])).not.toHaveProperty("block");
    expect(smolPrompt(runOmpModelSession.mock.calls[0]?.[0])).not.toContain("\"block\"");
  });

  it("rejects an illegal smol choice before accepting the second legal choice", async () => {
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
      expect.objectContaining({ source: "jev", accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "smol", legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "smol", legal, accepted: true, reason: "needed", attempt: 2 }),
    ]);
  });

  it("fails closed after two illegal smol outputs without a default choice", async () => {
    const cwd = repo();
    runOmpModelSession
      .mockResolvedValueOnce('{"choice":"advance","reason":"wrong"}')
      .mockResolvedValueOnce('{"choice":"retry","reason":"also wrong"}');

    const result = await choose({ cwd, subject, legal });
    expect(result.status).toBe("blocked");
    expect(result).toMatchObject({
      failure: {
        prompt: expect.stringContaining("Choose exactly one action"),
        agent: expect.objectContaining({ kind: "choice-session", role: "closed-set-choice" }),
        error: expect.objectContaining({ name: "InvalidChoiceResponseError" }),
      },
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(2);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ source: "jev", accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "smol", legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "smol", legal, accepted: false, attempt: 2 }),
    ]);
  });

  it.each(["", "I recommend save because it is safe."])("blocks malformed smol output %j after retry", async (output) => {
    const cwd = repo();
    runOmpModelSession.mockResolvedValue(output);

    await expect(choose({ cwd, subject, legal })).resolves.toMatchObject({ status: "blocked" });
    expect(runOmpModelSession).toHaveBeenCalledTimes(2);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ source: "jev", accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "smol", legal, raw: output, parsed: null, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "smol", legal, raw: output, parsed: null, accepted: false, attempt: 2 }),
    ]);
  });

  it("confines smol to supplied kinds and disables tools", async () => {
    const cwd = repo();
    const limitedLegal = [{ kind: "iterate" }, { kind: "save" }] as const;
    runOmpModelSession.mockResolvedValue('{"choice":"save","reason":"continue"}');

    await choose({ cwd, subject, legal: limitedLegal });

    expect(runOmpModelSession).toHaveBeenCalledWith(expect.objectContaining({ tools: [], agentPrefix: "buck-loop-choice" }));
    const prompt = smolPrompt(runOmpModelSession.mock.calls[0]?.[0]);
    expect(prompt).toContain("iterate");
    expect(prompt).toContain("save");
    expect(prompt).not.toContain("document");
    expect(prompt).not.toContain("advance");
    expect(prompt).toMatch(/\{\s*"choice".*"reason"/s);
  });

  it("blocks an empty legal set without calling Jev or smol", async () => {
    await expect(choose({ cwd: repo(), subject, legal: [] })).resolves.toMatchObject({
      status: "blocked",
      reason: "No legal choices were supplied.",
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(runOmpModelSession).not.toHaveBeenCalled();
  });

  it("refuses a legal set that is only block", async () => {
    await expect(choose({ cwd: repo(), subject, legal: [{ kind: "block" }] })).resolves.toMatchObject({
      status: "blocked",
      reason: "block is not a model choice.",
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(runOmpModelSession).not.toHaveBeenCalled();
  });
});
