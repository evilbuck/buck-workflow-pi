# Design Themes

`skills/_shared/design-brief.jsonc` is the **default** design language: warm-paper,
light-only, wired into `scripts/render-design-tokens.ts` and spliced byte-for-byte
into `skills/b-blueprint/references/blueprint-template.html` and
`skills/b-present/references/briefing-package-patterns.md`. It stays exactly as-is —
nothing in this directory edits it, moves it, or changes its consumers.

This directory holds **additional, named design languages**, one per subdirectory
(`themes/<name>/design-brief.jsonc`), for HTML deliverables that intentionally
want a different visual character than warm-paper — a distinct theme selected on
purpose, not a restyle of the default. Each file uses the same schema as
`../design-brief.jsonc` (`source`, `token_groups`, `typography`, `layout`,
`components`, `interaction_states`, `modes`, `responsive`, `mermaid`,
`accessibility`, `assumptions`, `ambiguities`) so a theme here can be loaded with
the same `loadDesignBrief`-style parser and, once it has a real consumer, wired
into a generated-token pipeline the same way the default brief already is.

## Available Themes

| Directory | Character | Use when |
|---|---|---|
| `../design-brief.jsonc` (default, top-level) | Warm paper, light-only. Off-white ground, white panels, one deep-teal accent. | Briefing packages, blueprints, reports, guides — printable/linkable documents read async by an individual. |
| `blueprint/design-brief.jsonc` | Architectural blueprint, dark-only. Navy drafting grid, corner crop marks, a drawing title block, one brass accent, a small cyan/teal/lavender classification palette, and a rotated hand-stamp motif for open vs. resolved items. | A single-file, full-viewport, one-slide-at-a-time facilitation deck driven live by a presenter — the deck IS the artifact, not a package with a shell around it. |

## Adding a theme

1. Copy the schema shape of `../design-brief.jsonc`, not its values — every group,
   typography scale, and component entry should describe what was actually
   *observed* in a real reference implementation, with `[inferred]`/`ambiguities`
   entries for anything filled in rather than measured.
2. Name the directory for the theme's character (`themes/blueprint/`, not
   `themes/theme-2/`); the file inside is always `design-brief.jsonc`, matching
   the default brief's filename so the same loader/schema works unmodified.
   Record the reference implementation's path in `source.reference_pages`.
3. Add a row to the table above.
4. Leave `../design-brief.jsonc`, `scripts/render-design-tokens.ts`, and
   `scripts/design-language.test.ts` untouched unless the new theme has gained a
   **real** consumer template that needs generated-token splicing — see the
   `ambiguities` entry in `blueprint/design-brief.jsonc` for what that wiring
   (a `--brief`-style flag, since both the path and the consumer list are
   currently hardcoded to the default brief).
