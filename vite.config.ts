import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/**/*.test.ts", "scripts/**/*.test.mjs", "skills/**/scripts/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
