import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/**/*.test.ts", "scripts/**/*.test.mjs", "skills/**/scripts/**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      "skills/b-auto-fix/scripts/auto-fix.test.ts",
      "skills/b-memory-import/scripts/import-context-memory.test.ts",
<<<<<<< HEAD
=======
      "skills/b-hindsight-import-projects/scripts/import-projects.test.ts",
>>>>>>> 30e0849 (feat: <short summary>)
    ],
  },
});
