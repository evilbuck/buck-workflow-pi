---
informs: [plan-grillney-doc-skill.md]
---

# Plan: Grillney Document Skill

## What we might build
A Pi skill + companion extension that transforms the grilling interview process from linear chat Q&A into an editable markdown document workflow. Instead of answering questions one-by-one in the chat, the agent writes questions to a shared `.md` file on disk, and the user edits answers freely in their editor of choice. An inline TUI selector (Done/Cancel) rendered in the chat area signals when the user is ready for the agent to read answers back.

## Why it matters
- Current grill skills (b-grill-me, b-grill-with-docs, b-grill-auto) force linear, one-at-a-time Q&A in the chat window
- Users can't easily go back and revise earlier answers without scrolling through conversation history
- Non-linear thinking (jumping between questions, refining answers iteratively) is blocked by the chat model
- Answering in an external editor is faster and more comfortable than typing in the chat input

## Constraints / preferences
- Must work within the Buck workflow stages (grill skills)
- Uses Pi's TUI component system (`ctx.ui.custom()`) for an inline Done/Cancel selector in the chat area
- Extension provides the TUI widget; skill provides the agent prompt instructions
- Questions appear dynamically — document is created as soon as there's substance (even one answer)

## Resolved decisions
- [x] **Integration**: Mode flag on existing `b-grill-me` AND `b-grill-with-docs` skills (not a separate skill)
- [x] **TUI style**: Inline chat-area selector (arrows + Enter), NOT a floating overlay. Uses `SelectList` pattern from `@earendil-works/pi-tui`.
- [x] **Filename**: `grill-qa-<subject>-<n>.md` — supports multiple QAs per subject (e.g., `grill-qa-auth-1.md`, `grill-qa-auth-2.md`)
- [x] **Document lifecycle**: Questions accumulate across turns — agent appends new questions, never replaces. User can edit any answer at any time. Agent re-reads full file each turn.
- [x] **Cancel behavior**: User cancels → document is preserved on disk, agent returns to normal chat. User can re-engage doc mode later by referencing the existing file.

## Open questions
_No open questions — all major decisions resolved._

## Design Decisions

### Document Lifecycle
- **Dynamic creation**: Agent starts conversational. As soon as there's substance (one answer collected), the agent writes the markdown file.
- **Accumulating document**: Questions accumulate across turns — the agent appends new questions, never replaces. User can edit any answer at any time. The agent re-reads the full file on each turn to pick up user edits.
- **Re-read on demand**: User can tell the agent "refresh your knowledge base" at any point — the agent re-reads the file.

### Markdown Document Format
```markdown
---
## Question 1
<Question text here>

### Answer
<Pre-formatted answer section>

---

## Question 2
<Question text here>

### Answer
<Pre-formatted answer section>

---
```

Simple, flat, no grouping. Visual dividers (`---`) fence each question block.

### Agent Pause / Hand-off Protocol
1. Agent writes the markdown file to `.context/YYYY-MM-DD.subject/grill-qa-<subject>-<n>.md`
2. Agent tells the user the file location
3. Agent presents an inline chat-area selector (↑↓ arrows + Enter) with **Done** / **Cancel** options
4. User opens file in their editor, fills in answers
5. User navigates to **Done** (or **Cancel**) in the chat selector and presses Enter
6. Extension computes SHA256 hash to detect external edits, reads file content, returns answers to agent

### TUI Component (Extension)
- Built as a Pi extension using `ctx.ui.custom()` — rendered inline in the chat area, NOT as an overlay
- Renders a simple selector list: `[Done]` / `[Cancel]` navigable with ↑↓ arrows and Enter
- On Done: reads the file, computes hash, returns success with file content
- On Cancel: returns cancelled state (agent falls back to inline Q&A)
- Keyboard: Enter = Done, Escape = Cancel (matching existing Pi patterns)
- Pattern: `SelectList` from `@earendil-works/pi-tui` (see `preset.ts` / `tools.ts` examples)

### Skill + Extension Boundary

| Component | Responsibility |
|-----------|---------------|
| **Extension** (`grill-me-dialog.ts`) | Registers `grill-me_dialog` custom tool. Renders inline Done/Cancel selector in chat area. Computes SHA256. Returns file state to caller. |
| **Skill** (mode flag) | Adds doc-mode instructions to existing `b-grill-me` and `b-grill-with-docs` skills. Instructs agent on: when to create the document, markdown format, how to read it back, conversational protocol. |
| **Custom Tool** (`grill-me_dialog`) | Called by LLM with file path. Shows inline selector. Waits for user signal. Returns answers. |

### Integration with Existing Grill Skills
- **Mode flag** on both `b-grill-me` and `b-grill-with-docs`
- Trigger: user says "use doc mode" or the skill auto-detects when multiple questions are accumulating
- The SKILL.md file for each grill skill gains a doc-mode section that activates the document workflow

## Architecture

```
┌─────────────────────────────────────────┐
│  Agent (guided by SKILL.md prompt)      │
│  - Decides when to write doc            │
│  - Formats questions in markdown        │
│  - Calls grill-me_dialog tool           │
│  - Reads file after Done signal         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Extension (grill-me-dialog.ts)         │
│  - Registers grill-me_dialog tool       │
│  - Renders TUI Done/Cancel overlay      │
│  - Computes SHA256 hash for edit detect │
│  - Returns file content to agent        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Markdown file (.context/.../grill-qa-  │
│  <subject>-<n>.md)                      │
│  - Questions with ## headers            │
│  - ### Answer sections                  │
│  - --- dividers between questions       │
│  - Edited by user in external editor    │
│  - <n> increments per QA session        │
└─────────────────────────────────────────┘
```

## Sidecar State
The extension maintains a JSON sidecar file tracking document state:
```json
{
  "plan_path": ".context/YYYY-MM-DD.subject/grill-qa-<subject>-<n>.md",
  "subject": "YYYY-MM-DD.subject",
  "slug": "grill-qa-<subject>-<n>",
  "question_count": 3,
  "last_ai_hash": "<sha256>",
  "last_reviewed_at": "2026-05-08T12:00:00Z"
}
```

## Notes
- Pi already has a `questionnaire` tool example (tab-based TUI with options) — this is different because it uses external editor, not in-TUI selection
- Pi has a `qna` command example (extract questions → load into editor) — closer pattern but one-shot, no TUI overlay for Done/Cancel signaling
- The inline selector pattern exists in `preset.ts` (SelectList) and `tools.ts` examples
- The `questionnaire.ts` example shows tab-based multi-question TUI — we're doing external editor instead
- The `qna.ts` example shows extracting questions and loading into editor — closest pattern but one-shot, no Done/Cancel signal
