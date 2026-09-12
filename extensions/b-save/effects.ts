export type EffectName = "native_memory" | "reindex";

export type EffectOutcome = {
  name: EffectName;
  outcome: "succeeded" | "failed_nonblocking" | "unsupported" | "skipped";
  detail: string | null;
};

export type MemoryStatus = {
  enabled?: boolean;
  backend?: string;
};

export type MemorySaveResult = {
  stored?: number;
};

export type MemoryCtx = {
  status?: () => MemoryStatus | Promise<MemoryStatus>;
  save?: (payload: unknown) => MemorySaveResult | Promise<MemorySaveResult>;
};

export type EffectsInput = {
  noRetain?: boolean;
  memory?: MemoryCtx | null;
  facts?: unknown;
};

const ALLOWED_SAVE: Record<string, true> = { local: true, mnemopi: true };

async function once<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

function skipped(name: EffectName, detail: string): EffectOutcome {
  return { name, outcome: "skipped", detail };
}

function unsupported(name: EffectName, detail: string): EffectOutcome {
  return { name, outcome: "unsupported", detail };
}

function failed(name: EffectName, detail: string): EffectOutcome {
  return { name, outcome: "failed_nonblocking", detail };
}

function classifyBackend(status: MemoryStatus): EffectOutcome | null {
  const backend = status.backend ?? "none";
  if (!status.enabled || backend === "off" || backend === "none") {
    return skipped("native_memory", "backend " + backend);
  }
  if (backend === "hindsight") {
    return unsupported("native_memory", "hindsight pre-execution retain is unsupported on OMP 18.1.17");
  }
  if (!ALLOWED_SAVE[backend]) return unsupported("native_memory", "unknown backend " + backend);
  return null;
}

async function saveWithCount(memory: MemoryCtx, facts: unknown, backend: string): Promise<EffectOutcome> {
  try {
    const result = await once(async () => {
      const saved = await memory.save!(facts ?? {});
      if (!saved || typeof saved.stored !== "number" || saved.stored < 1) {
        throw new Error("stored count was " + String(saved?.stored ?? 0));
      }
      return saved;
    });
    return { name: "native_memory", outcome: "succeeded", detail: backend + " stored " + result.stored };
  } catch (error) {
    return failed("native_memory", String(error));
  }
}

export async function deliverNativeMemory(input: EffectsInput): Promise<EffectOutcome> {
  if (input.noRetain) return skipped("native_memory", "--no-retain");
  if (!input.memory?.status || !input.memory.save) {
    return skipped("native_memory", "memory runtime missing");
  }
  try {
    const status = await input.memory.status();
    const classified = classifyBackend(status);
    if (classified) return classified;
    return saveWithCount(input.memory, input.facts, status.backend ?? "none");
  } catch (error) {
    return failed("native_memory", String(error));
  }
}

export async function reindexMemory(): Promise<EffectOutcome> {
  return skipped("reindex", "non-OMP adapter not claimed in this release");
}

export async function runEffects(input: EffectsInput): Promise<EffectOutcome[]> {
  const native = await deliverNativeMemory(input);
  const reindex = await reindexMemory();
  return [native, reindex];
}
