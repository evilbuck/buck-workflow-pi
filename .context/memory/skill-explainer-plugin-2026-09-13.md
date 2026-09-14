---
date: 2026-09-13
domains: [skill, plugin, packaging]
topics: [skill-explainer, omp, codex, claude, grok, opencode, zcode, agent-skills]
related:
  - ../2026-09-13.skill-explainer-plugin/plan-skill-explainer-plugin.md
priority: medium
status: completed
subject: 2026-09-13.skill-explainer-plugin
artifacts:
  - .context/2026-09-13.skill-explainer-plugin/index.md
  - .context/2026-09-13.skill-explainer-plugin/plan-skill-explainer-plugin.md
  - skills/skill-explainer/
  - plugins/buck-workflow/skills/skill-explainer/
  - scripts/codex-plugin.test.ts
  - docs/buck-workflow.md
---

# Skill Explainer Plugin Installation

## User Goal

Install `/home/buckleyrobinson/Downloads/skill-explainer.skill` verbatim as part of Buck Workflow, OMP-first while retaining support for Codex, Claude Code, Grok Build, and every other supported Agent Skills consumer.

## Result

- Extracted all four archive members byte-for-byte into canonical `skills/skill-explainer/`.
- Copied the same bytes into the self-contained Codex bundle at `plugins/buck-workflow/skills/skill-explainer/`.
- Added `skill-explainer` to the curated Codex plugin validation and the skill-only runtime mapping. No prompt or slash-command wrapper was added.
- OMP/Pi receive the root skill through `package.json`; Claude Code, OpenCode, Grok Build, and ZCode receive it through the installer's shared skill fan-out; Codex receives its bundled copy. Cursor and Goose retain the project's existing manual/project discovery paths.
- Installed the local working tree into OMP with `omp install . --force`; `~/.omp/plugins/node_modules/buck-workflow` now symlinks to this repository.

## Verbatim Evidence

Source archive SHA-256: `15b9d02ca01d470f4139dbe313b58884c3208b543765a7e18818d66c08bfcbcd`.

| Archive member | SHA-256 |
|---|---|
| `SKILL.md` | `e18a59ded919add73f952cdebe9cacdb7b39d16f7d1ec0d9ce9f6f3846ab67aa` |
| `references/schema.md` | `f4bb90595b412d7207df5cbf67eb717b39ce93062c6defd251ec9c8846784a5e` |
| `assets/template.html` | `7978c3917bb9c8b56b527f44009252382ad96ca954a40f2fda31db36a1b1c595` |
| `scripts/render.py` | `d92a450df0b6a30b9aa6fc31d4e6d60bb42649d8f1761b886492460c2418201a` |

Both installed copies matched all four member hashes.

## Verification

- Render smoke: bundled `render.py` accepted valid temporary `analysis.json` and wrote a standalone HTML report.
- Harness fan-out smoke: a temporary home produced `skill-explainer` install entries for `claude`, `opencode`, `grok`, and `zcode`.
- Focused validation: `scripts/codex-plugin.test.ts` + `scripts/install.test.mjs` — 74 tests passed.
- Full unit gate: 35 files, 544 tests passed.
- Coverage: 77.2% vs 54.9% baseline — global ratchet passed.
- Patch coverage: no instrumented lines in the diff — gate passed.
- Complexity: supplied `skills/skill-explainer/scripts/render.py::validate` has CCN 28, a new hard-ceiling violation. The user's explicit requirement to copy the skill verbatim overrides this gate for this import; modifying or re-baselining the file would violate that requirement.
- Backlog unchanged; no deferred implementation work was created.

## Local Install Note

`node scripts/install.mjs --verify` found pre-existing copied/missing Claude/OpenCode bootstrap and skill surfaces outside this repository. Those unrelated user-level files were not overwritten. The repository packaging and installer fan-out are complete; local non-OMP harnesses still require their normal installer/reload flow.
