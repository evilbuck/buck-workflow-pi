---
status: completed
date: 2026-06-14
subject: 2026-06-14.design-brief-skill-update
topics: [design-brief, skill, agent-skills, subject-folder, docs]
research: []
iterations: []
spec: null
memory: [design-brief-skill-update-2026-06-14.md]
---

# Plan: design-brief skill update

## User Goal
As a Buck workflow user, I want `design-brief` to accept real design inputs in whatever form I have them and to understand nearby subject-folder artifacts without becoming tightly coupled to broader planning behavior.

## Goal
Update `skills/design-brief/SKILL.md` so it follows the portable skill format, handles screenshots/files/text/context as valid sources, and only looks into `.context/<subject>/` when subject-folder awareness is relevant.

## Context used / assumptions
- The original skill was a raw prompt, not a reusable agent-agnostic skill.
- The requested Buck workflow awareness was later narrowed: the skill should look in `.context/<subject>/`, not perform automatic plan-stitch orchestration.
- Existing repository docs list available skills in `README.md`; adding a user-facing skill should keep that catalog current.

## Scope
In scope:
- Rewrite `skills/design-brief/SKILL.md` with standard frontmatter and portable instructions.
- Expand accepted source forms to screenshots, files, descriptions, session context, and optional subject-folder artifacts.
- Add lightweight `.context/<subject>/` awareness.
- Update docs that enumerate available skills.

Out of scope:
- Adding prompt wrappers or command files for `design-brief`.
- Implementing automatic edits to plans/specs/brainstorms.
- Broader installer changes; existing skill-directory install behavior already covers this skill.

## Affected files
| File | Change |
|---|---|
| `skills/design-brief/SKILL.md` | Rewrite as a portable skill with mixed-input handling and `.context/<subject>/` awareness. |
| `README.md` | Add `design-brief` to the skills catalog. |

## Implementation steps
1. Read existing skill text and a representative portable skill to match repository conventions.
2. Rewrite `skills/design-brief/SKILL.md` with standard frontmatter and explicit source-handling rules.
3. Narrow Buck workflow awareness to inspecting `.context/<subject>/` for relevant artifacts.
4. Update `README.md` so the documented skill list includes `design-brief`.
5. Re-read the changed files to verify final wording and formatting.

## Verification
- `skills/design-brief/SKILL.md` starts with valid portable skill frontmatter.
- The skill explicitly accepts screenshots, files, descriptions, session context, and `.context/<subject>/` artifacts.
- Subject-folder guidance is limited to reading relevant artifacts, not broader orchestration behavior.
- `README.md` lists `design-brief` in the Skills table.

## Risks
- **R1 — Over-coupling to Buck workflow.** If the skill starts prescribing plan mutations, it stops being a generic brief extractor. *Mitigation*: limit subject awareness to reading `.context/<subject>/` artifacts and optional reference use.
- **R2 — Invented design detail from sparse input.** Mixed-source intake can encourage guessing. *Mitigation*: keep explicit observed/inferred rules and require unknowns to stay unknown.
- **R3 — Undocumented skill drift.** New repo skills can become invisible if README is not updated. *Mitigation*: keep the skills catalog in sync.

## Recommended next step
Done. If this skill later gets a dedicated prompt wrapper or workflow entrypoint, document that invocation surface separately rather than bloating the skill itself.
