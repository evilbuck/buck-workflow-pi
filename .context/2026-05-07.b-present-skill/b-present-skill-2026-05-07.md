---
date: 2026-05-07
domains: [tooling, skills, buck-workflow, presentation]
topics: [b-present, revealjs, mermaid, slide-deck, architecture-diagrams, presentation-skill]
subject: 2026-05-07.b-present-skill
artifacts: [skills/b-present/SKILL.md, skills/b-present/references/revealjs-templates.md, prompts/b-present.md, docs/buck-workflow.md]
related: [b-phase-skill-2026-05-01.md, b-phase-discrete-files-2026-05-06.md]
priority: high
status: active
---

# Session: 2026-05-07 - b-present Skill Creation

## Context
- Previous work: b-phase skill, discrete phase files, buck-workflow-pi project
- Goal: Create a b-present skill that generates Reveal.js slide decks from .context/ artifacts

## Decisions Made
- Chose Reveal.js over custom HTML document (old b-present was document-style with sidebar)
- Added Mermaid diagram support via reveal.js-mermaid-plugin for architecture, flow, and sequence diagrams
- Single self-contained HTML file output (not multi-file like old version)
- CDN-based (jsdelivr) for Reveal.js 5.1.0 + mermaid plugin 11.12.3
- Dark theme (black.css + monokai) as default for diagram readability
- Output location: `.context/YYYY-MM-DD.<subject>/presentations/<slug>-presentation.html`

## Implementation Notes
- Key files created:
  - `skills/b-present/SKILL.md` (384 lines) — main skill with slide structure, diagram rules, layout patterns
  - `skills/b-present/references/revealjs-templates.md` (469 lines) — complete HTML boilerplate, CDN URLs, layout patterns
  - `prompts/b-present.md` (107 lines) — updated prompt template referencing the skill
- Key files modified:
  - `docs/buck-workflow.md` — updated b-present section and quick reference table
- Replaced old document-style presentation (sidebar + sections) with Reveal.js slide deck
- Supports multiple source types: plans, phased plans, brainstorms, specs, grill sessions
- Diagram rules: generate only from source content, never invent relationships

## Architecture
- Skill (SKILL.md) contains workflow, rules, layout patterns
- References file contains HTML templates (loaded on demand)
- Prompt template points agent to read skill + references before generating
- Three-tier: prompt template (entry) → skill (rules) → references (templates)

## Next Steps
- [ ] Test b-present with a real plan to verify HTML generation
- [ ] Test with a phased plan to verify phase detail slides
- [ ] Consider adding a `scripts/` helper to auto-open the generated HTML
- [ ] Potentially add a `run-in-idle-pane` integration to serve the presentation
