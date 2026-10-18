---
status: completed
memory: [b-save-improved-empty-scribe-2026-09-03.md]
---

# Model failure fallback for b-save-improved

## Problem

The scribe now uses OMP's `default` role, but a provider/model failure still stops the checkpoint after emitting diagnostics. The user should receive a clear model-specific action and the command should attempt one safe fallback before stopping.

## Decision

On a default-role model failure only (including empty assistant error output), notify the user that the configured/default model failed, retry once with OMP's `smol` role, and preserve the original error plus actionable guidance if that retry also fails. Explicit `--model` is never overridden or retried with a different model.

## Verification

Add handler tests for successful fallback, explicit-model no-fallback, and exhausted fallback diagnostics; run targeted suites and the guardrails contract.

Results: handler coverage verifies fallback success, explicit-model preservation, and exhausted fallback guidance. Targeted Vitest passed 42 tests. Durable guardrails passed unit, patch-coverage (97.73%), and coverage-ratchet gates; its complexity failure remains the documented pre-existing hotspot override.
