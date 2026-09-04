---
date: 2026-09-03
domains: [extensions, omp, testing]
topics: [b-save-improved, scribe-model, model-roles, empty-response, model-fallback]
related: [guardrails-override-complexity-2026-08-27.md]
priority: high
status: completed
subject: 2026-09-03.b-save-improved-empty-scribe
artifacts:
  - extensions/omp-models.ts
  - extensions/b-save-improved/index.ts
  - extensions/b-save-improved/__tests__/handler.test.ts
  - extensions/b-save-improved/__tests__/wire.test.ts
  - extensions/omp-models.test.ts
  - .context/backlog/items/pi-runtime-source-clean-worktree.md
  - .context/2026-09-03.b-save-improved-empty-scribe/plan-model-fallback.md
---

# b-save-improved empty scribe repair

## Diagnosis

A live OMP PTY run exposed the generic “Model returned no text” failure as a provider 404 for the configured `slow` role model (`claude-fable-5-1`). The nested session had only returned an assistant error block, which the previous extraction reduced to an empty string.

## Decision

The scribe now resolves to OMP’s `default` role; `slow` remains unused by this command, while the auditor still uses `smol`. An explicit `--model` remains authoritative. Nested scribe sessions preserve OMP’s settings, use OMP’s restricted-tool/session options, disable ambient extensions and services, and get a unique nested agent ID. Empty assistant results now retain stop reason, provider error, and content-block type in the reported failure.

When the selected default scribe model fails, the command now warns with its model identifier and the provider diagnostic, then retries once with OMP’s configured `smol` role. A second failure names both models and directs the user to change the OMP role or pass `--model <provider/model>`. An explicit `--model` is never silently replaced.

## Verification

- Targeted Vitest: 42 tests passed across the b-save-improved handler/wire and OMP model tests, including successful fallback, explicit-model preservation, and exhausted-fallback guidance.
- Guardrails durable contract: unit gate passed; patch coverage 97.73%; global coverage ratchet 71.15% ≥ 54.9%.
- Live OMP dry-run with the default role advanced from `Drafting session record…` to `Writing .context`, proving the scribe returned usable JSON and reached apply without the prior slow-role 404. The dry run was stopped before any persistent apply.
- Complexity gate remains failed only for documented pre-existing hotspots. The explicit 2026-08-27 override covers `parseArgs` and `runBSaveImproved`; the active `complexity-burn-down` backlog item tracks retirement.

## Follow-up

Added active backlog item `pi-runtime-source-clean-worktree` to locate the Pi coding-agent runtime source when `node_modules/@mariozechner/pi-coding-agent` is absent from a clean worktree.
