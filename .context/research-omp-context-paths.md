---
status: completed
date: 2026-09-29
topics: [omp, context-files, bootstrap, discovery]
informs: [plan-sql-memory-discovery.md]
---

# Verified OMP context paths

Sources: `omp://context-files.md` (Native .omp files; Other supported context conventions; Load order and shadowing), read directly from the running harness documentation.

- Default user context: `~/.omp/agent/AGENTS.md`, loaded automatically unless disabled.
- Other supported user context: `~/.agent/AGENTS.md` and `~/.agents/AGENTS.md` through the `agents` provider. These are lower priority than the native location.
- Only one user context file survives provider deduplication; native priority 100 shadows the agents provider at priority 70.
- `PI_CODING_AGENT_DIR` relocates the native agent directory. Named profiles default to `~/.omp/profiles/<name>/agent`.
- Context paths and filesystem targets are different facts. Local `readlink ~/.omp/agent/AGENTS.md` and `readlink -f ~/.omp/agent/AGENTS.md` both returned `/home/buckleyrobinson/.pi/agent/AGENTS.md`. OMP still discovers the native `.omp` path; this user's symlink supplies its contents from the `.pi` target.

The earlier deployment caveat referred to this local symlink target, not to OMP using `.pi` as its documented native directory. No personal dotfile was modified.
