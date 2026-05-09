---
date: 2026-05-09
domains: [docs, skill, planning]
topics: [b-present, presentation-package, grill-with-docs, context]
subject: 2026-05-07.b-present-skill
artifacts: [CONTEXT.md, grill-session-b-present-presentation-package.md]
related: [b-present-skill-2026-05-07.md]
priority: high
status: completed
---

# Session: 2026-05-09 - b-present grill with docs

## Context
- Goal: stress-test and clarify the design of `b-present`.
- Existing repo state described `b-present` as a Reveal.js slide deck generator.
- The grilling session redefined the artifact around async-readable briefing packages.

## Decisions Made
- Keep the command name `b-present`.
- Redefine “present” to mean a human-readable presentation artifact, not necessarily slides.
- Replace the slide-deck model with a small static presentation package.
- Primary output is an async-reading-first overview page with optional detail pages.
- Package shape: `presentations/<slug>/` with `index.html`, package-local `assets/`, `sources/`, and `manifest.json`.
- Use parent plan for goal/scope/narrative; phased plan for execution detail.
- Surface contradictions visibly rather than silently merging.
- Allow direct source links and client-rendered markdown source views.
- Tiny local server is acceptable and preview launch is part of core `b-present` flow.
- Old slide-deck output can break outright.

## Implementation Notes
- `CONTEXT.md` was created at repo root because no domain context file existed.
- `CONTEXT.md` now records glossary and resolved ambiguities for the new b-present model.
- Created `.context/2026-05-07.b-present-skill/grill-session-b-present-presentation-package.md` so future b-* workflows can discover the grilling artifact directly.
- Current repo docs/prompt/skill still contradict the new model and will need in-place rewrite.

## Next Steps
- [ ] Rewrite `skills/b-present/SKILL.md` to describe briefing-package output instead of Reveal.js slides.
- [ ] Rewrite `prompts/b-present.md` to match the new package contract and preview workflow.
- [ ] Update `docs/buck-workflow.md` and `README.md` to redefine b-present.
- [ ] Decide whether to write an ADR for the slide-deck → briefing-package shift.
