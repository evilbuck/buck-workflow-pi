# Changelog

User-facing changes to Buck Workflow. This record starts with changes integrated on 2026-09-29; earlier release history has not been backfilled.

## Unreleased

### Changed

- **SQL memory is discoverable outside Buck skills and loops.** The global bootstrap and tool metadata explain when prior project knowledge warrants recall, when to skip redundant queries, and how to load the shared protocol. Ordinary recall needs no Jev approval; supervisor recall, stage restrictions, and `/b-save` ownership of durable writes remain unchanged.
- **Acceptance criteria determine Buck-loop phase completion.** A non-empty `acceptance_criteria` list must be fully checked before a phase counts as complete, even if its status says `completed`. Fully checked phases automatically synchronize `status: completed`, `completed_at`, and phase overview entries. Phases without a non-empty criteria list retain status-based completion.
- **fix-pr uses native feedback tooling when available.** The skill collects an exhaustive feedback inventory through the registered `fix_pr_feedback` tool, with the portable CLI as fallback. Native `pr://` views support orientation and targeted inspection, but are not evidence of completeness or settlement. Canonical and Codex skill instructions are synchronized.

### Fixed

- **Buck-loop SQL saves preserve the real failure boundary.** The save tool exposes object-rooted arguments without weakening operation validation, derives provenance from the child worktree, and uses `remember`'s internal source-key reuse/readback. Unresolved tool failures now block with a sanitized diagnostic rather than generic completion ambiguity; verified completed receipts still win over late errors.
- **Buck-loop returns a sole legal continuation without a model call.** The chooser filters operator-only stops, records a `sole` transition audit, and returns the accepted action before resolving a model. Audit-write failures still block, and machine validation and retry limits remain unchanged.
- **Buck-loop ambiguous postconditions retain decision evidence.** The native repair-lift judgment now receives bounded plan, phase, state, work/review facts and the child/disk diagnosis. Its accepted or rejected lift is audited before any retry or operator handoff; audit-write failure blocks the run.
- **Buck-loop stop and status retain the actual blocker and explain recovery.** Operator stops are informational rather than misleading failure warnings. Status distinguishes historical blockers from current failures and provides the appropriate resume or fresh-start instructions, including recovery from interrupted commit checkpoints.
- **Buck-loop pins failed commit checkpoints across retries and restarts.** The saved target and pre-commit Git baseline remain authoritative until a clean, direct-child commit is verified. Cleanliness, completed phase status, and child-reported success alone cannot advance; missing legacy checkpoint identity stays blocked for manual recovery. An already-created commit with remaining dirt or divergent history cannot invoke a second commit child. Status identifies the retained checkpoint and its observed Git evidence. Stopped checkpoint runs require manual commit verification/completion before explicitly starting the next phase; status no longer recommends a fresh start or a no-op resume.
