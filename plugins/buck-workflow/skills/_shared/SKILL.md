---
name: _shared
description: Shared resources and cross-skill protocols. Internal skill that re-exports content from skills/_shared/* so other skills can reference it via skill://_shared/<file>.
---

# _shared: Cross-Skill Resources

This skill exists so that other skills can reference shared resources through the
`skill://_shared/<file>.md` URL form. The body content for each resource lives in
the sibling `.md` files in this directory; load them by filename.

## Available Resources

| File | Purpose |
|---|---|
| `subject-resolution.md` | Shared protocol all `b-*` skills use to find the active subject when invoked without an explicit path. **Read this when a skill says "apply the shared subject-resolution protocol."** |
| `design-brief.jsonc` | Canonical design language for every HTML deliverable the workflow generates — blueprints, briefing packages, reports, guides. Tokens, type scale, layout shell, component set, responsive breakpoints, Mermaid theme. **Read this before authoring or restyling any generated HTML.** |
| `scripts/render-design-tokens.ts` | Renders the `:root` token block and the Mermaid init from `design-brief.jsonc` into consumer templates. `bun skills/_shared/scripts/render-design-tokens.ts --write`. |
| `themes/` | Additional named design languages beyond the default warm-paper brief (e.g. `themes/blueprint/design-brief.jsonc`, a dark facilitation-deck theme) — same schema as `design-brief.jsonc`, one directory per theme, not wired into the generated-token pipeline. **Read `themes/README.md` before picking or adding a theme.** |

## Usage

When a skill body references `skills/_shared/<file>.md` or `../_shared/<file>.md`,
the harness resolves it to `skill://_shared/<file>.md` and loads the matching
file from this directory. Treat each file as the canonical content; this
SKILL.md is a registration shim, not a substitute.

`design-brief.jsonc` is authoritative for the design language: consumer templates
carry generated blocks, never hand-maintained copies of the palette.
`scripts/design-language.test.ts` compares those blocks to the renderer
byte-for-byte, so neither side can state a token the other lacks. To change a
colour, edit the brief and run the renderer with `--write`.

`themes/` holds *additional* design languages selected on purpose for a
deliverable that shouldn't look like warm-paper — not restyles of the default
and not replacements for it. `design-brief.jsonc` stays the only brief the
generated-token pipeline and its two consumer templates read; see
`themes/README.md` for what a theme file needs and when it graduates into
that pipeline.
