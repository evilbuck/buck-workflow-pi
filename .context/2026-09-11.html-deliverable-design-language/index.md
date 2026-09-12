---
status: active
date: 2026-09-11
subject: 2026-09-11.html-deliverable-design-language
topics: [design-system, b-blueprint, b-present, html-deliverables, drift-guard]
---

# HTML deliverable design language

Unify `b-blueprint` and `b-present` on one design language, extracted from the
2026-09-11 overlap-audit pages, and make it impossible for the two to drift.

## User Goal

Anyone who generates a report, blueprint, briefing or guide from a Buck workflow
skill gets a document that looks like it came from the same house — without the
agent re-deciding a palette each time.

## What shipped

| Artifact | Role |
|---|---|
| `skills/_shared/design-brief.jsonc` | **Authoritative** design language: tokens, type scale, layout shell, component set, interaction states, responsive breakpoints, Mermaid theme, a11y notes, observed-vs-inferred provenance |
| `skills/_shared/scripts/render-design-tokens.ts` | Renders the `:root` token block and the Mermaid init from the brief; `--write` splices them into consumers |
| `skills/_shared/scripts/design-language.test.ts` | Bidirectional drift guard — 8 vitest cases |
| `skills/b-blueprint/references/blueprint-template.html` | Rewritten: dark GitHub theme → shared warm-paper language |
| `skills/b-present/references/briefing-package-patterns.md` | Rewritten CSS + page skeletons on the same tokens |
| `skills/b-blueprint/SKILL.md`, `skills/b-present/SKILL.md`, `skills/_shared/SKILL.md` | Point at the brief; document the regeneration command |
| `tests/e2e/design-language.spec.ts` | Browser verification — palette wiring, overflow sweep, Mermaid render, mobile rail |

## Decisions

- **Home is `skills/_shared/`.** It is the existing cross-skill protocol registry
  (`skill://_shared/<file>`), so the brief is reachable from any skill without a
  second convention.
- **Generation, not two loops.** The brief renders the CSS; the guard compares
  byte-for-byte. A copy cannot state a token the brief lacks, in either direction.
- **Light-only.** The reference pages ship no dark mode; these are printable,
  linkable documents. Recorded in the brief as a decision, not an omission.
- **Blueprint goes light.** Its dark-first aesthetic shared nothing with the
  reference pages — full rewrite rather than a palette swap.
- **Syntax colours are an inferred extension.** The reference pages carry only
  inline code. The light syntax palette reuses the accent/series/status hues and
  is marked inferred in the brief.

## Verification

- `npm test` — 28 vitest files / 482 tests, 70 bun tests. Baseline was 27 / 474.
- Drift guard mutation-tested in both directions plus value drift; all three caught.
- `uvx lizard -C 10 -w` on the new TypeScript — clean.
- `npx playwright test tests/e2e/design-language.spec.ts --project=chromium` — 6/6.
- `--write` re-run reports `already up to date` (checked-in blocks == renderer output).
