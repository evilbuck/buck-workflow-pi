import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "detect-stack.ts");

function ecosystemNames(root: string): string[] {
  const result = spawnSync("bun", [SCRIPT], { cwd: root, encoding: "utf8" });
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout) as { ecosystems: Array<{ name: string }> };
  return parsed.ecosystems.map((ecosystem) => ecosystem.name);
}

describe("vendored skill trees", () => {
  it("does not treat vendored detector scripts as a TypeScript project", () => {
    const root = mkdtempSync(join(tmpdir(), "detect-stack-"));
    try {
      mkdirSync(join(root, "skills/b-init-guardrails/scripts"), { recursive: true });
      writeFileSync(join(root, "skills/b-init-guardrails/scripts/detect-stack.ts"), "export const marker = 1;\n");
      writeFileSync(join(root, "app.py"), "print('hi')\n");
      const names = ecosystemNames(root);
      expect(names).not.toContain("typescript");
      expect(names).toContain("python");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("still detects TypeScript outside the vendored trees", () => {
    const root = mkdtempSync(join(tmpdir(), "detect-stack-"));
    try {
      mkdirSync(join(root, "skills/b-guardrails-check"), { recursive: true });
      writeFileSync(join(root, "skills/b-guardrails-check/check.ts"), "export const marker = 1;\n");
      writeFileSync(join(root, "src.ts"), "export const app = 1;\n");
      expect(ecosystemNames(root)).toContain("typescript");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
