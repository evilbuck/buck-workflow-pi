import { describe, it, expect } from "vitest";
import {
  openHostModelRegistry,
  type HostModelRegistry,
  type HostAuthStorage,
} from "../model-registry.js";

const AGENT_DIR = "/tmp/omp-agent";

function piShaped(models: Array<{ provider: string; id: string }>): {
  ModelRegistry: HostModelRegistry;
  AuthStorage: HostAuthStorage;
} {
  const AuthStorage: HostAuthStorage = {
    create(path: string) {
      return { path };
    },
  };
  const ModelRegistry = class {
    static create(_auth: unknown, _modelsPath: string) {
      return { getAvailable: () => models };
    }
  } as unknown as HostModelRegistry;
  return { ModelRegistry, AuthStorage };
}

function ompShaped(models: Array<{ provider: string; id: string }>): {
  ModelRegistry: HostModelRegistry;
  AuthStorage: HostAuthStorage;
} {
  const AuthStorage: HostAuthStorage = {
    async create(path: string) {
      return { path };
    },
  };
  const ModelRegistry = class {
    constructor(_auth: unknown, _modelsPath?: string) {}
    getAvailable() {
      return models;
    }
  } as unknown as HostModelRegistry;
  return { ModelRegistry, AuthStorage };
}

describe("openHostModelRegistry", () => {
  it("opens via ModelRegistry.create when the Pi factory exists", async () => {
    const { ModelRegistry, AuthStorage } = piShaped([{ provider: "zai", id: "glm-5.3" }]);
    const registry = await openHostModelRegistry(ModelRegistry, AuthStorage, AGENT_DIR);
    expect(registry?.getAvailable()).toEqual([{ provider: "zai", id: "glm-5.3" }]);
  });

  it("opens via constructor when ModelRegistry.create is missing (OMP fork)", async () => {
    const { ModelRegistry, AuthStorage } = ompShaped([
      { provider: "openai-codex", id: "gpt-5.6-terra" },
    ]);
    expect("create" in ModelRegistry).toBe(false);
    const registry = await openHostModelRegistry(ModelRegistry, AuthStorage, AGENT_DIR);
    expect(registry?.getAvailable()).toEqual([{ provider: "openai-codex", id: "gpt-5.6-terra" }]);
  });

  it("returns null when AuthStorage.create throws", async () => {
    const AuthStorage: HostAuthStorage = {
      create() {
        throw new Error("no auth db");
      },
    };
    const { ModelRegistry } = piShaped([]);
    expect(await openHostModelRegistry(ModelRegistry, AuthStorage, AGENT_DIR)).toBeNull();
  });

  it("returns null when AuthStorage.create is missing", async () => {
    const { ModelRegistry } = ompShaped([]);
    expect(await openHostModelRegistry(ModelRegistry, {}, AGENT_DIR)).toBeNull();
  });
});
