---
date: 2026-09-29
domains: [docs, dotfiles, workflow]
topics: [omp, bootstrap, chezmoi, sql-memory]
related:
  - GLOBAL_OR_PROJECT-AGENTS.md
  - .context/2026-09-29.sql-memory-discovery/research-omp-context-paths.md
  - .context/memory/sql-memory-discovery-2026-09-29.md
priority: medium
status: completed
---

# Latest bootstrap installed for OMP

User explicitly requested installing the latest bootstrap after confirming native OMP context discovery. Resolved the existing OMP path as a symlink to `/home/buckleyrobinson/.pi/agent/AGENTS.md`. The OMP symlink is not chezmoi-managed; the Pi target is managed by `/home/buckleyrobinson/.local/share/chezmoi/dot_pi/agent/AGENTS.md`.

Replaced that managed source with the current repository's `GLOBAL_OR_PROJECT-AGENTS.md`, previewed the targeted apply, and applied only the target file using `CHEZMOI_SKIP_UPDATE_CHECK=1 chezmoi apply --no-pager --force --include files /home/buckleyrobinson/.pi/agent/AGENTS.md`. The include filter excluded scripts; no unrelated dotfiles or provider settings were changed. Existing OMP/Pi sharing is preserved, so both see the updated instructions.

Verification: `cmp` confirmed byte identity between repository source, chezmoi source, and the OMP bootstrap path. Targeted `chezmoi diff` was empty after apply. Reading `~/.omp/agent/AGENTS.md` showed the new all-session SQL recall policy, installed-protocol pointer, skip/fallback rules, and no mandatory Jev lookup gate.

The previous deployment caveat is resolved. Start a new OMP session to refresh auto-loaded context. SQL/Jev tooling remains unavailable in this session; this installation does not claim to enable the database tool.

This deployment changed Markdown only and used content already verified by the preceding implementation's passing durable guardrails; no new code was changed. Backlog unchanged: the requested installation is complete with no new required work. Source and repository records remain uncommitted; automatic staging is prohibited by the git-commit skill.
