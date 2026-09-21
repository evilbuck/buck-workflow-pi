/**
 * Host ModelRegistry access that works on both upstream Pi and the OMP fork.
 *
 * OMP rewrites `@mariozechner/pi-coding-agent` imports to
 * `@oh-my-pi/pi-coding-agent`, whose `ModelRegistry` has no `static create`
 * and whose `AuthStorage.create` is async. Upstream Pi still has the
 * synchronous factory pair this command was written against.
 */

import { join } from "node:path";

/** Minimal registry surface used to list authenticated model selectors. */
export type HostRegistry = {
  getAvailable(): Array<{ provider: string; id: string }>;
};

/** Auth store with a `create` factory (sync on Pi, async on the OMP fork). */
export type HostAuthStorage = {
  create?: (path: string) => unknown | Promise<unknown>;
};

/**
 * ModelRegistry as either Pi's `static create` factory or the OMP fork's
 * constructable class.
 */
export type HostModelRegistry = {
  create?: (auth: unknown, modelsPath: string) => HostRegistry;
  new (auth: unknown, modelsPath?: string): HostRegistry;
};

/**
 * Open the host model registry, or `null` if the host API cannot be used.
 *
 * @param ModelRegistry - Pi factory class or OMP constructable class
 * @param AuthStorage - auth store with `create`
 * @param agentDir - OMP/Pi agent directory holding `auth.json` and `models.json`
 * @returns the opened registry, or `null` when construction throws or APIs are missing
 */
export async function openHostModelRegistry(
  ModelRegistry: HostModelRegistry,
  AuthStorage: HostAuthStorage,
  agentDir: string,
): Promise<HostRegistry | null> {
  try {
    if (typeof AuthStorage.create !== "function") return null;
    const auth = await Promise.resolve(AuthStorage.create(join(agentDir, "auth.json")));
    if (typeof ModelRegistry.create === "function") {
      return ModelRegistry.create(auth, join(agentDir, "models.json"));
    }
    return new ModelRegistry(auth, join(agentDir, "models.json"));
  } catch {
    return null;
  }
}

