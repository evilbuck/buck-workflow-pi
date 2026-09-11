import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deliverNativeMemory, reindexMemory, runEffects } from "../effects.js";

describe("deliverNativeMemory", () => {
  it("records unsupported for hindsight and never calls save", async () => {
    let saved = 0;
    const outcome = await deliverNativeMemory({
      memory: {
        status: () => ({ enabled: true, backend: "hindsight" }),
        save: () => {
          saved += 1;
          return { stored: 3 };
        },
      },
    });
    expect(outcome).toEqual({
      name: "native_memory",
      outcome: "unsupported",
      detail: "hindsight pre-execution retain is unsupported on OMP 18.1.17",
    });
    expect(saved).toBe(0);
  });

  it("saves local backends when stored > 0 and retries stored:0 once", async () => {
    const ok = await deliverNativeMemory({
      memory: {
        status: () => ({ enabled: true, backend: "local" }),
        save: () => ({ stored: 2 }),
      },
    });
    expect(ok.outcome).toBe("succeeded");
    let calls = 0;
    const zero = await deliverNativeMemory({
      memory: {
        status: () => ({ enabled: true, backend: "mnemopi" }),
        save: () => {
          calls += 1;
          return { stored: 0 };
        },
      },
    });
    expect(calls).toBe(2);
    expect(zero.outcome).toBe("failed_nonblocking");
  });

  it("skips --no-retain and missing runtimes without failing the durable save", async () => {
    expect((await deliverNativeMemory({ noRetain: true })).outcome).toBe("skipped");
    expect((await deliverNativeMemory({})).outcome).toBe("skipped");
    const effects = await runEffects({ noRetain: true });
    expect(effects.map((e) => e.outcome)).toEqual(["skipped", "skipped"]);
    expect((await reindexMemory()).outcome).toBe("skipped");
  });
});

describe("extensions/index.ts registration", () => {
  it("does not register the engine as /b-save yet", () => {
    const source = readFileSync(new URL("../../index.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/b-save\/index/);
    expect(source).not.toMatch(/registerCommand\([^)]*b-save/);
  });
});
