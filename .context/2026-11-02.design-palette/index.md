---
date: 2026-11-02
subject: 2026-11-02.design-palette
topics: [design-palette, oklch, design-brief, skill, ui]
status: completed
lifecycle_schema: 1
lifecycle_revision: 3
lifecycle_last_transition: close-verified
---

# Subject: Deterministic UI design palette skill

Add `b-design-palette`: an LLM skill that extracts palette inputs from a brief or styleguide, then a deterministic TypeScript script that computes an OKLCH-based UI palette and writes `design-brief.jsonc`.

## Artifacts

| File | Type | Description |
|---|---|---|
| `plan-design-palette.md` | Plan | Skill + script scope, inputs, output contract |
| `plan-design-palette-phases.md` | Phases overview | Two discrete phases |
| `phase-1-palette-script.md` | Phase | Color math, CLI, golden/contrast/gamut tests |
| `phase-2-skill-docs.md` | Phase | SKILL.md + README registration |
