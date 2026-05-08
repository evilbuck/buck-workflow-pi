---
date: 2026-05-08
domains: [tooling, skills, pi-extension, grilling]
topics: [grillney-doc, pi-extension, pi-skill, tui, markdown-document, grilling, selectlist, custom-tool, sidecar-state]
subject: 2026-05-08.grillney-doc-skill
artifacts: [plan-grillney-doc-skill.md, brainstorm-grillney-doc.md, draft-commit.md, extensions/grill-me-dialog.ts]
related: [b-grill-auto-2026-05-08.md]
priority: high
status: active
---

# Session: 2026-05-08 - Grillney Document Skill

## Context
- **What**: Built a Pi extension + skill that transforms grilling interviews from linear chat Q&A into an editable markdown document workflow
- **Previous work**: Brainstorm + plan ran earlier in this session
- **Goal**: Build `grill-me_dialog` custom tool that agent calls — writes questions to `.md`, user edits answers in external editor, Done/Cancel TUI selector signals readiness

## Decisions Made
- **Tool name**: `grill-me_dialog` (not `grillney` to keep naming consistent)
- **Integration**: Mode flag on existing `b-grill-me` and `b-grill-with-docs` (not separate skill)
- **TUI**: Inline Done/Cancel SelectList in chat area (not floating overlay), following `preset.ts` / `question.ts` patterns
- **Document format**: `## Question N` + `### Answer` + `---` dividers, accumulating across turns
- **Sidecar state**: JSON in `.context/workflow/grill-doc-state.json` tracking file_path, slug, question_count, last_ai_hash
- **SHA256 edit detection**: Extension computes hash on write, compares on Done — warns if unchanged
- **File path**: `.context/<subject-folder>/grill-qa-<slug>-<n>.md`
- **Return type**: content is `Array<{type: "text", text: string}>` per Pi SDK convention, details is typed `DialogResult`

## Implementation Done
- **Created**: `extensions/grill-me-dialog.ts` — registers `grill-me_dialog` custom tool with 3 actions (create, wait, read)
- **Edited**: `extensions/index.ts` — added import + wire call for grill-me-dialog
- **Edited**: `skills/b-grill-me/SKILL.md` — added Document Mode section with activation, protocol, fallback
- **Edited**: `skills/b-grill-with-docs/SKILL.md` — added Document Mode section with domain-docs awareness

## Files Modified
- `extensions/grill-me-dialog.ts` (new — 15KB)
- `extensions/index.ts` (2 lines added)
- `skills/b-grill-me/SKILL.md` (doc-mode section appended)
- `skills/b-grill-with-docs/SKILL.md` (doc-mode section appended)

## Key Implementation Details
- `ctx.ui.custom()` with SelectList for Done/Cancel selector — same pattern as `preset.ts`
- SHA256 hash comparison for edit detection on Done press
- Path validation ensures all files are under `.context/`
- Lenient markdown parser for Q&A blocks (gracefully handles missing answers)
- Non-interactive fallback when `ctx.hasUI` is false
- Sidecar state persists between tool calls in `.context/workflow/grill-doc-state.json`

## Next Steps
- [ ] `/b-review` to validate the implementation
- [ ] Test in Pi to verify tool appears and TUI renders correctly
