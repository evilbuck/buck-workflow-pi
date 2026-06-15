---
date: 2026-06-14
domains: [docs, buck-workflow, bootstrap]
topics: [agents, bootstrap, global-vs-project, installable-source]
related: ["AGENTS.md", "GLOBAL_OR_PROJECT-AGENTS.md", "README.md"]
priority: low
status: completed
subject: 2026-06-14.agents-bootstrap-clarification
artifacts: ["index.md"]
---

# AGENTS bootstrap clarification

Added a short section to `AGENTS.md` clarifying that:
- `GLOBAL_OR_PROJECT-AGENTS.md` is the installable bootstrap source for global harness `AGENTS.md` files.
- the repository root `AGENTS.md` is project-specific guidance for `buck-workflow-pi`.
- bootstrap-policy changes belong in `GLOBAL_OR_PROJECT-AGENTS.md`; repo-local guidance changes belong in `AGENTS.md`.

## Verification
- Re-read the inserted section in `AGENTS.md` after editing.
- Existing README/install docs already described the same distinction, so no further doc change was needed.
