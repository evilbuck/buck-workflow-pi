---
status: completed
created: 2026-09-13
updated: 2026-09-13
research: []
spec: null
memory: [skill-explainer-plugin-2026-09-13.md]
---

# Plan: Install Skill Explainer

## User Goal

Copy `/home/buckleyrobinson/Downloads/skill-explainer.skill` into Buck Workflow verbatim and make it discoverable from OMP, Pi, Claude Code, Codex, OpenCode, Grok Build, ZCode, Cursor project installs, Goose/Summon, and other Agent Skills-compatible consumers.

## Implementation

1. Extract the archive's `skill-explainer/` directory byte-for-byte into canonical `skills/skill-explainer/`.
2. Copy the same bytes into the self-contained Codex release bundle at `plugins/buck-workflow/skills/skill-explainer/`.
3. Register the curated Codex bundle expectation and document the skill-only surface; do not add a slash-command wrapper.
4. Verify member hashes, package discovery, Codex plugin validation, and a real offline render smoke test.

## Constraints

- The four packaged files remain byte-identical to the archive members.
- `skills/` remains the canonical source. The Codex plugin bundle remains self-contained.
- OMP/Pi use package discovery; Claude/OpenCode/Grok/ZCode use the installer's shared `skills/` links; Cursor and Goose retain their documented project/manual mechanisms.

## Verification

- Compare SHA-256 for every archive member against both installed copies.
- Run `scripts/codex-plugin.test.ts`.
- Run `skill-explainer/scripts/render.py` against a valid temporary `analysis.json`, then inspect the generated standalone HTML.
- Run the repository guardrails contract after the edit batch.

## Outcome

Completed. The canonical skill and Codex bundle are byte-identical to the source archive. OMP now links this working tree as its installed `buck-workflow` package; the installer fan-out covers Claude Code, OpenCode, Grok Build, and ZCode. Pi uses the same root package, Codex uses the self-contained bundle, and Cursor/Goose retain their documented project/manual discovery paths.

The deterministic guardrails passed unit tests, global coverage, and patch coverage. Complexity is overridden for this import: the supplied `render.py::validate` is CCN 28, but changing it would violate the user's explicit verbatim-copy requirement.
