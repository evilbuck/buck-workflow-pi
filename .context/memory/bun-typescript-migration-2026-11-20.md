---
date: 2026-11-20
domains: [tooling, testing]
topics: [bun, typescript, guardrails, extension-timeout]
related: []
priority: medium
status: active
subject: 2026-11-20.bun-typescript-migration
---
# Bun TypeScript migration

Bun 1.4+ replaces Node as the runtime for workflow-owned skill and loose scripts. TypeScript browser assets are transpiled for self-contained HTML; legacy .mjs report configs remain accepted. Existing projects can preview and apply the guardrails copy upgrade via the current checkout's b-init-guardrails installer; custom package commands are not migrated automatically, and stale legacy files are preserved.

Verification: durable guardrails passed (unit, global ratchet 86.8%, complexity; lint and functional disabled; patch advisory); Bun suites 102 passed; packed browser behavior 3 passed; scoped production TypeScript check passed. Mutation probes established detection of a missing release gate, missing sync inputs, disabled browser switching, and disabled legacy upgrade. Whole-project tsc still reports 165 diagnostics outside the migrated paths.

Open: user reported an extension handler timeout at 30000ms. A live session held the large repo-files manifest lock; the specific timed-out event and cause remain unconfirmed. No timeout fix has been made. Release script can proceed after failed git status or registry lookup; characterize but do not use it until fixed.
