---
status: completed
date: 2026-11-02
subject: 2026-11-02.design-palette
topics: [design-palette, oklch, design-brief, skill, ui]
research: []
iterations: []
spec: null
memory: []
---

# Plan: b-design-palette skill

## User Goal
As a Buck workflow user designing web/app UIs, I want a skill that takes one brand color (and optional overrides from a brief or styleguide) and produces a deterministic `design-brief.jsonc` with a full UI color palette, semantic roles, light/dark mappings, and a WCAG contrast report.

## Goal
Ship `skills/b-design-palette/` with a portable SKILL.md and a deterministic TypeScript CLI that computes all color math in OKLCH and writes commented `design-brief.jsonc`. Register the skill in README.

## Context used / assumptions
- Existing `skills/design-brief` extracts qualitative UI briefs; this skill owns quantitative palette generation.
- Existing `skills/_shared/design-brief.jsonc` is the Buck HTML-deliverable language; consumer project briefs are separate outputs (default `design-brief.jsonc` in cwd or `--out`).
- No new npm dependency: OKLab/OKLCH and WCAG math are implemented in-repo for determinism.
- Script-backed skills live under `skills/<name>/scripts/` and are covered by vitest via `skills/**/scripts/**/*.test.ts`.
- Codex plugin bundle is curated; this skill ships under repo `skills/` only unless later promoted.

## Scope
In scope:
- `skills/b-design-palette/SKILL.md` — extract inputs from brief/styleguide (LLM), call script for math.
- Deterministic script: brand tint scale 50–950, tinted neutrals, status colors, secondary/accent via hue schemes, semantic roles light/dark, on-colors with WCAG AA, gamut mapping to sRGB, JSONC emit with comments.
- CLI flags for brand, optional secondary/accent, scheme, neutral temperature, status overrides, dark mode, meta, output path.
- Golden + contrast + gamut tests; sample deterministic for `#3366ff`.
- README skills catalog entry.

Out of scope:
- Reading screenshots or inventing layout/typography (delegated to `design-brief` / styleguide skills).
- Overwriting `skills/_shared/design-brief.jsonc`.
- Adding the skill to the Codex curated plugin bundle.
- CSS/Tailwind codegen beyond the JSONC brief.

## Affected files
| File | Change |
|---|---|
| `skills/b-design-palette/SKILL.md` | New skill |
| `skills/b-design-palette/scripts/design-palette.ts` | CLI orchestration |
| `skills/b-design-palette/scripts/color-math.ts` | OKLCH / gamut / WCAG |
| `skills/b-design-palette/scripts/palette-build.ts` | Scales, roles, report |
| `skills/b-design-palette/scripts/emit-jsonc.ts` | Commented JSONC writer |
| `skills/b-design-palette/scripts/design-palette.test.ts` | Golden, contrast, gamut |
| `README.md` | Catalog row |
| `.context/2026-11-02.design-palette/*` | Plan/phases |

## Implementation steps
1. Implement OKLCH conversion, chroma reduction gamut map, relative luminance, contrast ratio helpers.
2. Build tint scales, neutrals, status, secondary/accent, semantic roles, on-colors; emit JSONC.
3. Wire CLI (`--brand` required; optional overrides; `--out`; `--stdout`).
4. Add deterministic tests (golden `#3366ff`, AA pairs, out-of-gamut brand).
5. Write SKILL.md procedure and README entry.

## Verification
- `npx vitest run skills/b-design-palette/scripts/design-palette.test.ts`
- `npm run guardrails:check`
- `npm test` (vitest + bun)
- `npm run subject-lifecycle:check`
- Manual: `bun skills/b-design-palette/scripts/design-palette.ts --brand '#3366ff' --stdout` shows scales + roles + contrast.

## Risks
- **R1 — Out-of-gamut OKLCH → sRGB.** High chroma brands clip. *Mitigation*: binary-search chroma until in gamut; test with a high-chroma brand.
- **R2 — Contrast false confidence.** Pairing by luminance alone can miss edge cases. *Mitigation*: verify every role pair in the contrast report; fail generation if primary/on-primary < 4.5.
- **R3 — Confusion with shared Buck brief.** *Mitigation*: skill and script docs state consumer `design-brief.jsonc` is distinct from `skills/_shared/design-brief.jsonc`.

## Recommended next step
Phase 1: palette script + tests.
