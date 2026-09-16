---
schema_version: 1
default_timeout_ms: 180000
max_output_bytes: 65536
allow_network: true
commands: []
---

# review_exec policy

Editable command allowlist for Reviewer reproduction. The effective policy
at runtime is:

1. The `commands` list below (structural match: id + executable +
   element-wise argv prefix, optional timeout_ms / max_output_bytes /
   extra_env).
2. A fixed set of read-only git operations (git-status, git-diff, git-log,
   git-show, git-blame, git-ls-files).
3. The repository's deterministic check-contract commands from
   `guardrails.json` (auto-mapped; shell syntax is skipped, never guessed).

Commands run with host network access (recorded in the run report) under a
sanitized environment: only PATH, HOME, LANG, LC_ALL, TZ, TMPDIR, TERM, and
per-command extra_env keys survive. No shell is involved anywhere.

Example entry:

    commands:
      - id: vitest-run
        executable: npx
        argv_prefix: [vitest, run]
        timeout_ms: 600000
        max_output_bytes: 200000
