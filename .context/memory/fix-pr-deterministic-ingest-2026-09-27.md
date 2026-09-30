---
date: 2026-09-27
domains: [skills, testing]
topics: [fix-pr, ingest, ci-checks, typescript]
related: []
priority: high
status: completed
---

# Deterministic fix-pr ingest

Replaced the truncated TSV `fetch-feedback.sh` with `skills/fix-pr/scripts/fetch-feedback.ts` (user asked for TypeScript, not bash+jq). The loaded skill runs that sibling script. Stdout is the summary JSON. Stderr is live progress, including a 2s heartbeat while `gh` is in flight. Inventory is mode 0600 under `${TMPDIR:-/tmp}`. No extension, no model call.

Codex bundle is a full copy. Fixture tests 10/10. `scripts/codex-plugin.test.ts` passed. Live smoke `evilbuck/buck-workflow-pi` #51 exited 0 with `ok: true`, number 51, and a 0600 inventory. Guardrails durable contract passed. `shellcheck` was not installed and does not apply to the TypeScript script.
