# Checkpoint success follows durable artifacts, not process noise

`/buck-loop` save and commit checkpoints used to fail completed work: a pool teardown error overrode a verified SQL save, and any unstaged non-`.context` path blocked the phase commit — including the phase's own deliverables. Checkpoints now trust the durable artifact. A save succeeds when `verifySqlSave` accepts the receipt; pool teardown, unsubscribe, and dispose errors are activity warnings and do not flip a completed session to `SqlMemoryError`. Only an unresolved save-stage SQL work failure (a failed insert, read-back, or correction with no later successful SQL call) suppresses the ordinary model retry. A commit checkpoint stages `.context/` plus paths named in the active phase's `files:` frontmatter, then refuses every other unstaged non-`.context` path with the existing refusal. See [ADR 0002](0002-observably-invoked-happy-path-loop.md) for why the runner exists.

## Considered Options

- Keep throw-on-any-unstaged: rejected. It forced an operator commit of the phase's own files every cycle.
- Stage every dirty path: rejected. Unrelated operator edits would land in the phase commit.
- Treat any SQL callback failure as stage failure: rejected. Teardown and a corrected intermediate call are not missing durable writes. The receipt remains the authority.

## Consequences

- Phase authors must list deliverables in `files:` (a YAML block list, one inline path, or a directory prefix ending in `/`). A missing or unreadable `files:` field grants no staging scope and restores the old refusal.
- A rename is in scope only when every non-`.context` path in the status row matches. Mixed-scope renames refuse before staging.
- Operators still resolve out-of-scope dirt themselves. Recovery stays [recover a blocked run](../howto/recover-buck-loop.md); do not bypass the refusal.
