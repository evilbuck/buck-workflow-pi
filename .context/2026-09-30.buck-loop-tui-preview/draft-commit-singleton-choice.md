---
status: draft
date: 2026-10-02
subject: 2026-09-30.buck-loop-tui-preview
related: [research-singleton-choice-return.md]
---

fix(buck-loop): return sole legal continuation without a model

Handle a sole permitted action at the public chooser boundary before model resolution. Preserve the accepted result contract, record a truthful sole audit, and block if the audit cannot be written.

Cover model-independent singleton selection and audit failure. Preserve empty/operator-only rejection, multiple-choice routing, machine validation, and retry limits.

Verified: 19 choice tests, real no-model Bun smoke, and the passing durable guardrails contract.

Scope: `extensions/buck-loop/choice.ts` (singleton-fix hunks only), `extensions/buck-loop/__tests__/choice.test.ts`, `docs/CHANGELOG.md`, and this repair's context artifacts. `choice.ts` also contains TUI-preview assignment hunks: select only the repair hunks if committing separately, or explicitly approve including the repair in the loop checkpoint. No staging or commit performed; preserve unrelated working-tree changes.
