---
date: 2026-06-14
domains: [skill, docs, buck-workflow]
topics: [design-brief, subject-folder, agent-skills, readme]
related: [".context/2026-06-14.design-brief-skill-update/plan-design-brief-skill-update.md", "skills/design-brief/SKILL.md", "README.md"]
priority: medium
status: completed
subject: 2026-06-14.design-brief-skill-update
artifacts: ["plan-design-brief-skill-update.md", "index.md"]
---

# design-brief skill updated

Rewrote `skills/design-brief/SKILL.md` from a narrow screenshot-only prompt into a portable skill.

## What changed
- Added standard skill frontmatter: `name: design-brief`, concise trigger-oriented `description`.
- Expanded accepted inputs to session context, screenshots, design files, plain-language descriptions, and optional `.context/<subject>/` artifacts.
- Added explicit source-merging, observed-vs-inferred, and responsive breakpoint guidance.
- Narrowed Buck workflow awareness after user correction: inspect `.context/<subject>/` for nearby brainstorm/plan/spec/design artifacts, but do not prescribe broader automatic plan-stitch behavior.
- Updated `README.md` skills table to list `design-brief`.

## Verification
- Re-read `skills/design-brief/SKILL.md` end-to-end after edits; frontmatter and section structure are clean.
- Re-read `README.md` skills table; `design-brief` entry is present.
- Search showed no other repository docs referenced `design-brief`, so no further doc updates were required.

## Notes
The key correction from the user was scope control: subject awareness means reading `.context/<subject>/`, not owning plan synchronization logic.
