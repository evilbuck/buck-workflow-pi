# Changelog

User-facing changes to Buck Workflow. This record starts with changes integrated on 2026-09-29; earlier release history has not been backfilled.

## Unreleased

### Changed

- **SQL memory is discoverable outside Buck skills and loops.** The global bootstrap and tool metadata explain when prior project knowledge warrants recall, when to skip redundant queries, and how to load the shared protocol. Ordinary recall needs no Jev approval; supervisor recall, stage restrictions, and `/b-save` ownership of durable writes remain unchanged.
- **Acceptance criteria determine Buck-loop phase completion.** A non-empty `acceptance_criteria` list must be fully checked before a phase counts as complete, even if its status says `completed`. Fully checked phases automatically synchronize `status: completed`, `completed_at`, and phase overview entries. Phases without a non-empty criteria list retain status-based completion.
- **fix-pr uses native feedback tooling when available.** The skill collects an exhaustive feedback inventory through the registered `fix_pr_feedback` tool, with the portable CLI as fallback. Native `pr://` views support orientation and targeted inspection, but are not evidence of completeness or settlement. Canonical and Codex skill instructions are synchronized.

### Fixed

- **Buck-loop stop and status retain the actual blocker and explain recovery.** Operator stops are informational rather than misleading failure warnings. Status distinguishes historical blockers from current failures and provides the appropriate resume or fresh-start instructions, including recovery from interrupted commit checkpoints.
