/**
 * Closed-set choice tests. Jev is the continuation tool; the configured
 * choice-stage model is the tool-less fallback. Both are injected.
 * `block` is never offered. The smol role is not a model source.
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

import { choose, type ChoiceModelSelect } from "../choice.js";

const subject = "2026-09-18.choice-test";
const legal = [{ kind: "iterate" }, { kind: "document" }, { kind: "save" }] as const;

const picked: { selectModel: ChoiceModelSelect } = {
  selectModel: async () => ({ ok: true, id: "provider/choice", thinking: "low" }),
};

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

  it("accepts a Jev tool choice and does not call the choice-stage model", async () => {
    const cwd = repo();
    evaluate.mockResolvedValue(jevSave());

    await expect(choose({ ...picked, cwd, subject, legal })).resolves.toEqual({
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

    await choose({ ...picked, cwd: repo(), subject, legal, onActivity });

    expect(onActivity).toHaveBeenCalledWith({ kind: "text", delta: "Jev picked save (confidence 0.91)" });
  });

  it("falls back to the choice-stage model when the Jev tool fails", async () => {
    const cwd = repo();
    runOmpModelSession.mockResolvedValue('{"choice":"save","reason":"ready"}');

    await expect(choose({ ...picked, cwd, subject, legal })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "save" }, reason: "ready" },
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(1);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ source: "jev", legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "profile", legal, raw: '{"choice":"save","reason":"ready"}', accepted: true, reason: "ready", attempt: 1 }),
    ]);
    expect(runOmpModelSession).toHaveBeenCalledWith(expect.objectContaining({
      modelOverride: "provider/choice",
      thinkingLevel: "low",
      tools: [],
    }));
  });

  it("falls back to the choice-stage model when the Jev tool throws", async () => {
    const cwd = repo();
    evaluate.mockRejectedValue(new Error("socket hang up"));
    runOmpModelSession.mockResolvedValue('{"choice":"document","reason":"needed"}');

    await expect(choose({ ...picked, cwd, subject, legal })).resolves.toEqual({
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

    await expect(choose({ ...picked, cwd, subject, legal: [...legal, { kind: "block" }] })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "save" }, reason: "continue" },
    });
    expect(jevCriteria(evaluate.mock.calls[0]?.[0])).not.toHaveProperty("block");
    expect(smolPrompt(runOmpModelSession.mock.calls[0]?.[0])).not.toContain("\"block\"");
  });

  it("rejects an illegal profile choice before accepting the second legal choice", async () => {
    const cwd = repo();
    runOmpModelSession
      .mockResolvedValueOnce('{"choice":"advance","reason":"wrong"}')
      .mockResolvedValueOnce('{"choice":"document","reason":"needed"}');

    await expect(choose({ ...picked, cwd, subject, legal })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "document" }, reason: "needed" },
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(2);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ source: "jev", accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "profile", legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "profile", legal, accepted: true, reason: "needed", attempt: 2 }),
    ]);
  });

  it("fails closed after two illegal profile outputs without a default choice", async () => {
    const cwd = repo();
    runOmpModelSession
      .mockResolvedValueOnce('{"choice":"advance","reason":"wrong"}')
      .mockResolvedValueOnce('{"choice":"retry","reason":"also wrong"}');

    const result = await choose({ ...picked, cwd, subject, legal });
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
      expect.objectContaining({ source: "profile", legal, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "profile", legal, accepted: false, attempt: 2 }),
    ]);
  });

  it.each(["", "I recommend save because it is safe."])("blocks malformed profile output %j after retry", async (output) => {
    const cwd = repo();
    runOmpModelSession.mockResolvedValue(output);

    await expect(choose({ ...picked, cwd, subject, legal })).resolves.toMatchObject({ status: "blocked" });
    expect(runOmpModelSession).toHaveBeenCalledTimes(2);
    expect(audits(cwd)).toEqual([
      expect.objectContaining({ source: "jev", accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "profile", legal, raw: output, parsed: null, accepted: false, attempt: 1 }),
      expect.objectContaining({ source: "profile", legal, raw: output, parsed: null, accepted: false, attempt: 2 }),
    ]);
  });

  it("confines the choice-stage model to supplied kinds and disables tools", async () => {
    const cwd = repo();
    const limitedLegal = [{ kind: "iterate" }, { kind: "save" }] as const;
    runOmpModelSession.mockResolvedValue('{"choice":"save","reason":"continue"}');

    await choose({ ...picked, cwd, subject, legal: limitedLegal });

    expect(runOmpModelSession).toHaveBeenCalledWith(expect.objectContaining({ tools: [], agentPrefix: "buck-loop-choice", modelOverride: "provider/choice", thinkingLevel: "low" }));
    const prompt = smolPrompt(runOmpModelSession.mock.calls[0]?.[0]);
    expect(prompt).toContain("iterate");
    expect(prompt).toContain("save");
    expect(prompt).not.toContain("document");
    expect(prompt).not.toContain("advance");
    expect(prompt).toMatch(/\{\s*"choice".*"reason"/s);
  });

  it("blocks an empty legal set without calling Jev or the choice-stage model", async () => {
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

  it("blocks a missing choice stage before the continuation question and names the stage", async () => {
    const selectModel = vi.fn(async () => ({ ok: false as const, message: 'buckModels profile "work" is missing stage "choice"' }));
    await expect(choose({ cwd: repo(), subject, legal, selectModel })).resolves.toEqual({
      status: "blocked",
      reason: 'buckModels profile "work" is missing stage "choice"',
    });
    expect(selectModel).toHaveBeenCalledWith({ exclude: [], context: { continuation: null } });
    expect(evaluate).not.toHaveBeenCalled();
    expect(runOmpModelSession).not.toHaveBeenCalled();
  });

  it("keeps a recovered fallback answer on the first picked id", async () => {
    const selectModel = vi.fn<ChoiceModelSelect>(async () => ({ ok: true, id: "provider/choice", thinking: "low" }));
    runOmpModelSession
      .mockResolvedValueOnce('{"choice":"advance","reason":"wrong"}')
      .mockResolvedValueOnce('{"choice":"save","reason":"ready"}');
    await choose({ cwd: repo(), subject, legal, selectModel });
    expect(selectModel).toHaveBeenCalledTimes(1);
    expect(runOmpModelSession.mock.calls.map((call) => call[0]?.modelOverride)).toEqual(["provider/choice", "provider/choice"]);
  });

  it("re-picks after a failed choice-stage call and drops that id", async () => {
    const selectModel = vi.fn<ChoiceModelSelect>(async ({ exclude }) => {
      if (exclude.includes("provider/first")) return { ok: true, id: "provider/second", thinking: "high" };
      return { ok: true, id: "provider/first", thinking: "low" };
    });
    runOmpModelSession.mockRejectedValueOnce(new Error("provider down")).mockResolvedValue('{"choice":"save","reason":"ready"}');
    await expect(choose({ cwd: repo(), subject, legal, selectModel })).resolves.toEqual({
      status: "accepted",
      accepted: { choice: { kind: "save" }, reason: "ready" },
    });
    expect(selectModel.mock.calls.map((call) => call[0].exclude)).toEqual([[], ["provider/first"]]);
    expect(runOmpModelSession.mock.calls.map((call) => [call[0]?.modelOverride, call[0]?.thinkingLevel])).toEqual([
      ["provider/first", "low"],
      ["provider/second", "high"],
    ]);
  });

  it("blocks when the failed choice-stage id exhausts the stage", async () => {
    const selectModel = vi.fn<ChoiceModelSelect>(async ({ exclude }) => {
      if (exclude.length > 0) return { ok: false, message: 'buckModels stage "choice" has no available models; excluded: provider/first' };
      return { ok: true, id: "provider/first", thinking: "off" };
    });
    runOmpModelSession.mockRejectedValue(new Error("provider down"));
    await expect(choose({ cwd: repo(), subject, legal, selectModel })).resolves.toMatchObject({
      status: "blocked",
      reason: expect.stringContaining('stage "choice"'),
    });
    expect(runOmpModelSession).toHaveBeenCalledTimes(1);
  });
});
