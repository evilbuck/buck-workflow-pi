---
status: completed
phase: 1
order: 1
plan: plan-design-palette.md
phases_overview: plan-design-palette-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Ship deterministic OKLCH palette CLI with golden, contrast, and gamut tests."
omp_execution: none
files:
  - skills/b-design-palette/scripts/color-math.ts
  - skills/b-design-palette/scripts/palette-build.ts
  - skills/b-design-palette/scripts/emit-jsonc.ts
  - skills/b-design-palette/scripts/design-palette.ts
  - skills/b-design-palette/scripts/design-palette.test.ts
from_plan_steps: [1, 2, 3, 4]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] CLI accepts --brand (required hex) and optional --secondary, --accent, --scheme, --neutral, --status-*, --dark/--no-dark, --name, --purpose, --audience, --out, --stdout."
  - "[x] Output design-brief.jsonc includes commented sections: meta, inputs, scales (brand/neutral/status/secondary/accent), roles.light, roles.dark (when enabled), contrast report."
  - "[x] Brand tint scale keys 50–950 derived via OKLCH lightness steps with sRGB gamut mapping."
  - "[x] Neutrals are tinted by temperature (warm/cool/pure); status hues fixed and matched to brand L/C; secondary/accent via scheme hue rotation."
  - "[x] Every semantic on-* foreground passes WCAG AA (≥4.5) against its fill; contrast report lists ratio and pass."
  - "[x] npx vitest run skills/b-design-palette/scripts/design-palette.test.ts passes with golden #3366ff, contrast assertions, and out-of-gamut brand gamut mapping."
  - "[x] No new npm dependencies; cyclomatic complexity of new functions stays within guardrails hard ceiling."
completed_at: 2026-11-02
completed_by: null
---

# Phase 1: Palette script + tests

## Context

Parent plan User Goal: one brand color → deterministic UI `design-brief.jsonc`.

## Implementation Details

1. **color-math.ts** — hex↔sRGB↔linear↔OKLab↔OKLCH; in-gamut check; chroma binary-search gamut map; relative luminance; contrast ratio; pick black/white (or near) on-color.
2. **palette-build.ts** — parse inputs; build scales; derive roles for light/dark; assemble contrast pairs.
3. **emit-jsonc.ts** — stable key order, `//` section comments, hex lowercase.
4. **design-palette.ts** — argv parse, write file or stdout, exit codes.
5. **Tests** — golden snapshot fields for `#3366ff` complementary; AA for primary/on-primary etc.; high-chroma brand stays in gamut after map.

## Verification

- `npx vitest run skills/b-design-palette/scripts/design-palette.test.ts`
- `npm run guardrails:check` at coherent checkpoint
