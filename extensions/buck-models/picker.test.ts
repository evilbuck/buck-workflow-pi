/**
 * Seam: createBuckModelPicker({ evaluate, random }).pick()
 * — the parent-extension call later runtimes use.
 * Fakes replace only the TypeSafe evaluator and random source.
 * Expected ids are literals, not recomputed from the picker.
 */
import { describe, expect, it } from "vitest";
import type { BuckStageResolution } from "../omp-models.js";
import type { TypeSafeEvaluation, TypeSafeEvaluator, TypeSafeRequest } from "../typed-output/evaluator.js";
import { createBuckModelPicker } from "./picker.js";

const ALPHA = "provider/alpha";
const BETA = "provider/beta";
const GAMMA = "provider/gamma";

function resolution(thinking: "off" | "high" = "off"): Extract<BuckStageResolution, { ok: true }> {
  return {
    ok: true,
    profile: "work",
    stage: "build",
    source: "project",
    thinking,
    configured: [
      { id: ALPHA, note: "long context" },
      { id: BETA },
      { id: GAMMA, note: "" },
    ],
    available: [
      { id: ALPHA, note: "long context" },
      { id: BETA },
      { id: GAMMA, note: "" },
    ],
    excluded: ["provider/missing"],
  };
}

function jev(choice: string, confidence: number): TypeSafeEvaluation {
  return {
    ok: true,
    result: {
      model: "jev",
      usage: { input_tokens: 1, output_tokens: 1 },
      answers: {
        model: {
          type: "choice",
          choice,
          confidence,
          probabilities: { [choice]: confidence },
        },
      },
    },
  };
}

function picker(evaluate: TypeSafeEvaluator, random: () => number = () => 0) {
  return createBuckModelPicker({ evaluate, random });
}

describe("createBuckModelPicker", () => {
  it("sends a Choice request with stage, skill, notes, and caller context", async () => {
    let seen: TypeSafeRequest | undefined;
    const evaluate: TypeSafeEvaluator = async (request) => {
      seen = request;
      return jev(BETA, 0.9);
    };
    const context = { path: ".context/phase.md", body: "implement picker", difficulty: "hard" };

    await picker(evaluate).pick({
      resolution: resolution(),
      skill: "b-build-hard",
      context,
    });

    expect(seen).toEqual({
      state: {
        stage: "build",
        skill: "b-build-hard",
        candidates: [
          { id: ALPHA, note: "long context" },
          { id: BETA },
          { id: GAMMA },
        ],
        context,
      },
      questions: {
        model: {
          type: "choice",
          instructions: "Pick exactly one configured model id for this Buck stage.",
          criteria: {
            [ALPHA]: "long context",
            [BETA]: BETA,
            [GAMMA]: GAMMA,
          },
        },
      },
    });
  });

  it("runs the exact Jev id when confidence is low", async () => {
    const picked = await picker(async () => jev(GAMMA, 0.02)).pick({
      resolution: resolution("high"),
      skill: "b-build",
      context: { command: "/b-build" },
    });

    expect(picked).toEqual({
      ok: true,
      id: GAMMA,
      thinking: "high",
      source: "jev",
      confidence: 0.02,
    });
  });

  it("uses the injected random index when Jev is unavailable, errors, or has no legal answer", async () => {
    const cases: TypeSafeEvaluation[] = [
      { ok: false, failure: { code: "provider_unavailable", message: "down" } },
      { ok: false, failure: { code: "missing_credentials", message: "none" } },
      { ok: true, result: { model: "jev", usage: { input_tokens: 0, output_tokens: 0 }, answers: {} } },
      jev("provider/not-configured", 0.99),
    ];
    const positions = [0, 0.4, 0.999];
    const expected = [ALPHA, BETA, GAMMA];

    for (const evaluation of cases) {
      for (let i = 0; i < positions.length; i += 1) {
        const picked = await picker(async () => evaluation, () => positions[i]).pick({
          resolution: resolution(),
          skill: "b-build",
          context: {},
        });
        expect(picked).toEqual({
          ok: true,
          id: expected[i],
          thinking: "off",
          source: "random",
          confidence: null,
        });
      }
    }
  });

  it("excludes a failed id on re-pick and stops by stage name when none remain", async () => {
    const original = resolution();
    const seen: string[][] = [];
    const evaluate: TypeSafeEvaluator = async (request) => {
      const criteria = request.questions.model?.criteria;
      seen.push(criteria && typeof criteria === "object" ? Object.keys(criteria) : []);
      return jev(BETA, 0.2);
    };
    const modelPicker = picker(evaluate, () => 0);

    const first = await modelPicker.pick({
      resolution: original,
      skill: "b-build",
      context: { path: "plan.md" },
    });
    const second = await modelPicker.pick({
      resolution: original,
      skill: "b-build",
      context: { path: "plan.md" },
      exclude: [ALPHA],
    });
    const exhausted = await modelPicker.pick({
      resolution: original,
      skill: "b-build",
      context: { path: "plan.md" },
      exclude: [ALPHA, BETA, GAMMA],
    });

    expect(first).toMatchObject({ ok: true, id: BETA, source: "jev" });
    expect(second).toMatchObject({ ok: true, id: BETA });
    expect(seen[1]).toEqual([BETA, GAMMA]);
    expect(exhausted).toEqual({
      ok: false,
      stop: {
        code: "no-candidates",
        profile: "work",
        stage: "build",
        excluded: ["provider/missing", ALPHA, BETA, GAMMA],
      },
    });
    expect(original.available.map((candidate) => candidate.id)).toEqual([ALPHA, BETA, GAMMA]);
    expect("id" in exhausted).toBe(false);
  });

  it("does not treat the first id as the fallback when random is out of range", async () => {
    const picked = await picker(
      async () => ({ ok: false, failure: { code: "provider_unavailable", message: "down" } }),
      () => 1,
    ).pick({
      resolution: resolution(),
      skill: "b-build",
      context: {},
    });

    expect(picked).toEqual({
      ok: false,
      stop: {
        code: "no-candidates",
        profile: "work",
        stage: "build",
        excluded: ["provider/missing", ALPHA, BETA, GAMMA],
      },
    });
  });
});
