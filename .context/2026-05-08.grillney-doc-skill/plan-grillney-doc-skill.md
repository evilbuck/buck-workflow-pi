---
status: active
date: 2026-05-08
subject: 2026-05-08.grillney-doc-skill
topics: [grillney-doc, pi-extension, pi-skill, tui, markdown-document, grilling]
research: []
spec:
memory: [grillney-doc-plan-2026-05-08.md]
---

# Plan: Grillney Document Skill

## Goal

Build a Pi extension + skill integration that transforms the grilling interview process from linear chat Q&A into an editable markdown document workflow. The agent writes questions to a shared `.md` file; the user edits answers in their external editor; an inline TUI Done/Cancel selector signals when the user is ready for the agent to read answers back.

## Context used / assumptions

- **Brainstorm artifact**: `.context/2026-05-08.grillney-doc-skill/brainstorm-grillney-doc.md` — fully resolved design with all major decisions made
- **Existing skills**: `b-grill-me` (SKILL.md) and `b-grill-with-docs` (SKILL.md) will gain a doc-mode section
- **Existing extension**: `extensions/index.ts` wires all extensions; the new `grill-me-dialog` extension registers alongside `b-grill-auto` and `tmux-window-status`
- **Pi extension patterns**: `question.ts` example shows `pi.registerTool()` with `ctx.ui.custom()` for inline TUI; `preset.ts` shows `SelectList` usage; `qna.ts` shows editor loading pattern
- **Package imports**: Uses `@mariozechner/pi-coding-agent` (ExtensionAPI), `@mariozechner/pi-tui` (Container, SelectList, Text, Key), `@sinclair/typebox` (Type for schemas)
- **Key assumption**: The extension registers a custom tool (`grill-me_dialog`) that the LLM calls — the LLM decides when to create the document and call the tool, guided by SKILL.md instructions
- **Key assumption**: Sidecar state (JSON) tracks document state between turns
- **Key assumption**: SHA256 hash detects external edits — if the hash hasn't changed when user clicks Done, the extension waits or warns

## Scope

### In scope

1. **Extension: `grill-me-dialog.ts`** — registers `grill-me_dialog` custom tool with Pi
   - Parameters: `file_path` (string), `action` (enum: "create" | "wait" | "read")
   - `create` action: validates path, creates empty QA file if needed, returns success
   - `wait` action: renders inline Done/Cancel selector, blocks until user signals, reads file content, returns answers
   - `read` action: reads file content without showing selector, returns current answers
   - SHA256 hash computation to detect external edits
   - Sidecar state file for tracking document state across turns
   - Custom render for tool call and result display
2. **Skill updates**: Add doc-mode section to `b-grill-me/SKILL.md` and `b-grill-with-docs/SKILL.md`
   - When to activate doc mode (user says "doc mode" or auto-detect)
   - Document format (## Question / ### Answer / --- dividers)
   - Agent protocol: write file → call `grill-me_dialog wait` → read answers → append more questions → repeat
   - Conversational fallback: if user cancels, switch back to inline Q&A
3. **Wiring**: Register the new extension in `extensions/index.ts`

### Out of scope

- Changes to `b-grill-auto` (that skill uses a different model as answerer — doc mode doesn't apply there)
- Floating overlays or full-screen TUI
- Tab-based in-TUI question answering (external editor only)
- Multi-user/collaborative editing
- File watching / auto-refresh (user signals readiness via Done button)

## Affected files

| File | Action | Description |
|------|--------|-------------|
| `extensions/grill-me-dialog.ts` | **Create** | New extension: registers `grill-me_dialog` custom tool |
| `extensions/index.ts` | **Edit** | Wire `grill-me-dialog` extension (add import + wire call) |
| `skills/b-grill-me/SKILL.md` | **Edit** | Add doc-mode section with activation trigger and agent protocol |
| `skills/b-grill-with-docs/SKILL.md` | **Edit** | Add doc-mode section (same as b-grill-me, plus domain-docs awareness) |

## Implementation steps

### Step 1: Create `extensions/grill-me-dialog.ts`

Create the extension file with the custom tool registration.

**Types and constants:**
```typescript
// Sidecar state file tracks document state between turns
interface GrillDocState {
  file_path: string;           // Absolute path to the QA markdown file
  subject: string;             // Subject folder name
  slug: string;                // e.g., "grill-qa-auth-1"
  question_count: number;      // Number of ## Question blocks in the file
  last_ai_hash: string;        // SHA256 of file content after last agent write
  last_reviewed_at: string;    // ISO timestamp of last user Done signal
}
```

**Tool schema (Typebox):**
```typescript
const ActionSchema = Type.Union([
  Type.Literal("create"),
  Type.Literal("wait"),
  Type.Literal("read"),
]);

const DialogParams = Type.Object({
  file_path: Type.String({ description: "Path to the QA markdown file" }),
  action: ActionSchema,
});
```

**Tool registration using `pi.registerTool()`:**

Following the `question.ts` pattern:
- `name`: `"grill-me_dialog"`
- `label`: `"Grill Doc Dialog"`
- `description`: Document-mode grilling dialog. Call with action "create" to initialize a QA file, "wait" to show Done/Cancel selector while user edits in external editor, "read" to read current answers.
- `parameters`: `DialogParams`
- `execute()`: Route by action
- `renderCall()`: Show tool call with file path and action
- `renderResult()`: Show result status

**Action handlers:**

1. `create`:
   - Validate path is under `.context/`
   - Read file or create empty with frontmatter comment
   - Compute initial SHA256
   - Write sidecar state to `.context/workflow/grill-doc-state.json`
   - Return success with file path

2. `wait`:
   - Read current file content and compute hash
   - Render `ctx.ui.custom()` with inline Done/Cancel SelectList
   - Block until user selects Done or Cancel
   - On Done: re-read file, compute new hash, compare with `last_ai_hash`
   - If hash unchanged: show "No changes detected" message, keep selector visible (don't auto-dismiss — let user decide)
   - If hash changed (or user proceeds anyway): update sidecar state, parse Q&A blocks, return structured answers
   - On Cancel: return cancelled status, preserve file on disk

3. `read`:
   - Read file content without TUI
   - Parse Q&A blocks
   - Return structured answers

**TUI component (for `wait` action):**

Following the `preset.ts` SelectList pattern:
```
┌──────────────────────────────────┐
│ 📝 Grill Doc: Edit answers in   │
│    your editor, then press Done  │
│                                  │
│ > ✅ Done                        │
│   ❌ Cancel                      │
│                                  │
│ ↑↓ navigate • Enter select      │
│ File: grill-qa-auth-1.md         │
└──────────────────────────────────┘
```

- Uses `Container`, `SelectList`, `Text`, `DynamicBorder` from `@mariozechner/pi-tui`
- `SelectList` with two items: `Done` and `Cancel`
- `selectList.onSelect` → resolve with the selection
- `selectList.onCancel` (Escape) → resolve with null
- On Done: check hash, if unchanged show notification "No edits detected — press Done again to proceed or Cancel to keep editing"
- Second Done press without changes: proceed anyway (user intent is clear)

**Q&A parsing:**

Parse the markdown file into structured data:
- Split on `## Question N` headers
- Extract question text and `### Answer` content per block
- Return array of `{ question_number, question_text, answer_text }` objects

### Step 2: Wire extension in `extensions/index.ts`

Add at the top:
```typescript
import { wire as wireGrillDialog } from "./grill-me-dialog.js";
```

In the main export function, after the existing wire calls:
```typescript
wireGrillDialog(pi);
```

### Step 3: Update `skills/b-grill-me/SKILL.md`

Add a new section after the existing content:

```markdown
## Document Mode (Doc Mode)

### Activation
- User says "use doc mode", "document mode", or "doc mode"
- OR auto-detect when the conversation has accumulated 5+ questions

### Agent Protocol

1. **Start**: When doc mode activates, create the QA file:
   - Path: `.context/<subject-folder>/grill-qa-<slug>-<n>.md`
   - Use `grill-me_dialog` tool with `action: "create"`
   - Tell user the file location

2. **Write questions**: Write questions to the file as markdown:
   ```markdown
   ---

   ## Question 1
   <question text>

   ### Answer
   _(Edit your answer here)_

   ---
   ```

3. **Wait for answers**: Call `grill-me_dialog` tool with `action: "wait"` — this shows Done/Cancel selector. Agent pauses.

4. **Read answers**: When tool returns, parse the structured answer data. Process answers and continue the interview.

5. **Append more questions**: Add new question blocks to the same file. Re-read the full file each turn. Call `wait` again.

6. **Completion**: When grilling is done, the file remains on disk as a permanent record.

### Fallback
If user cancels the Done/Cancel selector, fall back to inline Q&A for the rest of the session. The document is preserved — user can reference it later.
```

### Step 4: Update `skills/b-grill-with-docs/SKILL.md`

Add the same doc-mode section, with an additional note:

```markdown
### Domain-Docs Awareness
In doc mode, CONTEXT.md and ADR updates happen as usual when decisions crystallize.
The grill document captures Q&A pairs; CONTEXT.md/ADRs capture the canonical decisions.
```

## Verification

- [ ] Extension compiles without errors (run `tsc --noEmit` or equivalent)
- [ ] `grill-me_dialog` tool appears in Pi's tool list when extension is loaded
- [ ] `create` action creates the QA file and sidecar state
- [ ] `wait` action renders inline Done/Cancel selector in chat area
- [ ] Done reads file content and returns parsed Q&A
- [ ] Cancel returns cancelled status, file preserved
- [ ] SHA256 hash detects external edits correctly
- [ ] Skill files reference the tool and describe the protocol
- [ ] Wiring in `extensions/index.ts` loads the new extension

## Risks

| Risk | Mitigation |
|------|------------|
| LLM may not reliably call the `grill-me_dialog` tool at the right time | SKILL.md provides explicit protocol; agent instructions are clear about when to use each action |
| User edits markdown in unexpected format (breaks Q&A parsing) | Parser is lenient: looks for `## Question` and `### Answer` headers; gracefully handles missing answers |
| File path edge cases (symlinks, relative paths) | Normalize all paths to absolute; validate paths are under `.context/` |
| User clicks Done without editing (hash unchanged) | Show "no changes" notification; allow second Done press to proceed |
| Extension conflicts with existing b-grill-auto extension | Separate tool name (`grill-me_dialog` vs `b-grill-auto`); no shared state; independent wiring |

## Recommended next step

This plan has 4 implementation steps across 4 files. The scope is bounded and the patterns are well-established from existing Pi extension examples. **Recommended: `/b-build`** — this is straightforward implementation following known patterns (custom tool, SelectList, file I/O).

If you want to be cautious about the LLM reliably using the tool protocol, run `/b-build-hard` to allow for more iteration on the skill instructions and tool description.
