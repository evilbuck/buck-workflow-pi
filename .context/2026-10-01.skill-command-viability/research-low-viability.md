---
date: 2026-10-01
status: active
domains: [skills, commands]
topics: [viability, duplication, unused, jev]
related: [../2026-09-21.skill-command-extension-audit/research-skill-command-extension-audit.md]
informs: [plan-viability-cleanup.md]
---

# Low-viability skills and commands

Jev `jev-1.13.0`. Usage from OMP transcripts via `/home/buckleyrobinson/.local/share/mise/installs/jq/1.8.2/jq` (shell `jq` is a builtin and is not this binary): 245 session files, 670 user messages, token match. Prior audit session `01a0c3e1-61a4-7052-9740-472ee0edab4f` (2026-09-21) found the same clusters and did not collapse them.

## Formula

Locked weights, each axis 0–4, then normalized:

`0.40 distinctness + 0.25 writing + 0.20 package_fit + 0.15 use`

Use: 0 mentions = 0, 1 = 1, 2–4 = 2, 5–9 = 3, 10+ = 4. Missing Jev axes are dropped and the remaining weights renormalized.

Writing is biased low when the state was a digest, not the procedure. Control `b-plan` (36 mentions) scored distinct 3.83, fit 3.99, writing 1.19, composite 0.81. Trust writing only where the defect was in the state and confidence is high (`omp-orchestrate` 0.06 / 0.95, `omp-workflow` 0.10 / 0.92).

Cutoff for this list: composite under 0.45. Zero typed mentions alone did not put spine skills (`b-howto`, `b-handoff`, `b-triage`, …) on the list; those were not scored.

## Low list

| Viability | Surface | Mentions | Distinct | Fit | Why it ranks low | Action |
|---|---|---|---|---|---|---|
| 0.15 | `design-brief` | 0 | 0.10 (conf 0.92) | 1.99 | No contract beyond `b-create-ux-guide` | Fold in, delete skill |
| 0.16 | `slash-command-mirror` | 0 | 0.65 | 1.08 | Nested copy of `cross-platform-pi-omp-loading` | Fold into parent |
| 0.17 | `/omp-orchestrate` | 0 | 0.94 | 1.43 | Says it enters orchestrate mode and that it is a no-op | Doc, not a command |
| 0.17 | `/omp-workflow` | 0 | — | 1.93 | Same contradiction (writing 0.10, conf 0.92) | Doc, not a command |
| 0.19 | `node5-code-review` | 0 | 1.23 | 0.08 (conf 0.93) | Hard-coded to another repo; portable reviewers exist | Move or delete |
| 0.22 | `/omp-goal` | 0 | — | 1.93 | Stub that says it is not a toggle (writing 0.57) | Doc, not a command |
| 0.26 | `b-grill` | 0 | 0.85 | 2.02 | Shell over `b-grill-me` / `b-grill-auto`; duplicate `grill.py`; no prompt | Delete the shell |
| 0.27 | `/b-kamal-release` | 1 | — | 0.88 (conf 0.27) | Kamal-specific command, no skill. Fit is uncertain | Move with the Rails app, do not treat the score as settled |
| 0.35 | `b-grill-auto` | 0 | 1.57 | 2.28 | Mode copy of the shell; 0 mentions; no prompt | Keep only if the shell is deleted |
| 0.37 | `/b-build-hard` | 1 | 1.09 | 2.57 | 14-line alias of `b-build` hard | Keep. Low score is the alias, not a defect |
| 0.40 | `rails-app` | 0 | 2.82 | 0.33 | One app's footguns in a portable package | Move to that app |
| 0.40 | `cross-platform-pi-omp-loading` | 1 | 2.10 | 1.00 (conf 1.00) | Maintainer meta, not a task skill | Move to `docs/` |
| 0.42 | `b-grill-me` | 1 | 1.17 | 2.89 | Overlaps the shell and `b-grill-with-docs`. Empty headings | Keep as the user-mode command if `b-grill` goes |
| 0.44 | `llm-wiki-vault` | 0 | 3.72 | 0.21 (conf 0.82) | Unique job, wrong package (one vault path) | Move to a personal skill |
| 0.45 | `crawl4ai` | 0 | 2.67 | 1.26 (conf 0.78) | Third-party CLI notes `b-research` already points at | Fold the bootstrap into `b-research` |

## Not low, despite the 2026-09-21 delete notes

- `b-grill-with-docs` (0.45, distinct 1.99, conf 0.99) owns the CONTEXT.md/ADR contract. Keep this one.
- `thought-dump-writer` (0.46) has an explicit non-overlap with `b-capture` (single file + git checkpoint). Unused, not a duplicate.
- `manage-herdr-panes` (0.47) is a real Herdr cookbook behind `HERDR_ENV=1`. Wrong package, not a broken twin.
- `pi-rpc` (0.59) and `skill-explainer` (0.59) are distinct. Unused in these sessions is not a retire signal.
- `commands/` is 43/43 symlinks to `prompts/`. The 2026-09-11 mirror split is gone.

## Grill resolution

The two 2026-09-21 notes disagreed (delete `b-grill` vs delete `b-grill-me`). Current text: delete the shell (`b-grill`). Keep `b-grill-with-docs`. Keep `b-grill-me` as the slash entry for user mode. `b-grill-auto` only earns a slot once the shell is gone.
