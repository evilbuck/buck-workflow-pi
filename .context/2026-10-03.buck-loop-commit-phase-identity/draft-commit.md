## Title
fix(buck-loop): retain commit checkpoint identity through retries and restart

## Body
Keep the checkpoint target and immutable Git baseline authoritative until a clean direct-child commit is verified. Recover interrupted commits through the explicit blocked machine edge instead of selecting the next phase from completed build metadata.

Distinguish pending, verified, and unsafe Git evidence so advanced HEAD with dirt, divergent history, or failed probes cannot invoke another commit child. Validate persisted ownership, retain legacy manual recovery, and report evidence-specific recovery guidance.

Cover public supervisor recovery with real Git repositories, both fresh-process crash windows, and valid/stale disposable SQL receipts. Update recovery docs and preserve existing staging admission and retry ceilings.

## Commit readiness
Not ready: required unit/global-ratchet gates remain blocked by the untouched SQL-save subject directive test and SQL-memory correction notice test. Re-review and durable save are still required; no commit or supervisor-state choice was made by this iteration.
