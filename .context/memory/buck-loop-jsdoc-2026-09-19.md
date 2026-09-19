---
date: 2026-09-19
domains: [docs, extensions]
topics: [buck-loop, jsdoc, tsdoc, junior-onboarding]
related: []
priority: medium
status: completed
subject: 2026-09-18.buck-loop-extension
artifacts: []
---

# buck-loop inline JSDoc

Junior-readable JSDoc on every file under `extensions/buck-loop/`. Canonical TypeScript docs: `/** */` (TS language service / TSDoc tags). Host APIs (`ExtensionAPI`, `registerCommand`, `createAgentSession`, `sendMessage`, `createActivity`, `runOmpModelSession`) explained in English at the call site.

Start here: `extensions/buck-loop/index.ts` file map.

Verification: `npx vitest run extensions/buck-loop` 169/169. `npm run guardrails:check` status pass (durable v2).
