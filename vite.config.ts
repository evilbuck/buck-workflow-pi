import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Loop/storage suites drive real git + adapter I/O per test; the 5s
    // default times out under CI load (locally ~1s per heavy test).
    testTimeout: 30_000,
    setupFiles: ["scripts/vitest-identity-setup.ts"],
    include: ["extensions/**/*.test.ts", "scripts/**/*.test.ts", "skills/**/scripts/**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      "skills/b-auto-fix/scripts/auto-fix.test.ts",
      "skills/b-memory-import/scripts/import-context-memory.test.ts",
      "skills/b-memory-import/scripts/import-projects.test.ts",
      "skills/pack-self-contained-html-reports/scripts/pack.test.ts",
    ],
  },
});
