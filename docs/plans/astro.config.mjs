import { defineConfig } from 'astro/config';

// Standalone docs site. Served from docs/plans/; no base path so that
// `astro build` output (dist/) can be hosted anywhere static works.
export default defineConfig({
  output: 'static',
});
