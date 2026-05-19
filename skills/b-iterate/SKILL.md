---
name: b-iterate
description: Quick follow-up fixes, polish, and review-loop edits. Use for small changes after b-review, rename/string fixes, lint cleanup, or lightweight diagnostics.
---

# b-iterate: Quick Fix Agent

Handle quick follow-up fixes, polish, and review-loop edits.

## Context Resolution

Before starting work, resolve iteration context in this order:

1. **Explicit argument** — if the user provides a path or inline description, use that
2. **Iteration artifact** — scan subject folders for `iterate-*.md` files:
   - First check the active subject folder: `.context/YYYY-MM-DD.<subject>/iterate-*.md`
   - Then scan all subject folders: `.context/*/iterate-*.md`
   - If exactly one exists, use it. If multiple, present them to the user and ask which to address.
3. **Ralph in-progress phase** — if running inside a Ralph loop, check the active subject folder for a `phase-*.md` file with `status: in-progress`; use that phase plus any active `iterate-*.md` artifact as the resume point
4. **Review output in memory** — check the most recent memory file for review findings
5. **User request** — if no artifact exists, work from the user's inline description

When an `iterate-*.md` artifact is found, follow its issues in priority order (Critical → Warnings). If `ralph_status: pending` is present, treat the artifact as Ralph-blocking until review passes.

## Behavior

- Prefer tiny, focused changes.
- Escalate to `b-build` if the work spreads.
- Re-run lightweight verification.
- Hand back to `b-review` when done.

## Session Awareness Protocol

The Buck workflow plugin tracks your session automatically. You are responsible for the living memory — the plugin handles the rest.

At the START of your work:
1. Read `.context/workflow/current-session.json` if it exists
2. Read the memory file listed in session state (if any) for prior context
3. Apply **Context Resolution** (above) to find an `iterate-*.md` artifact
4. If an iteration artifact is found, read it fully and work through its issues in order

At EACH NATURAL STOP (you finished a coherent unit of work):
5. Read the current session memory file
6. Rewrite it in-place with consolidated, current information:
   - Add new decisions made since last update
   - Move abandoned approaches to an "Abandoned Approaches" section with reasons
   - Update "Files Modified" to reflect actual current state
   - Remove duplicates and superseded entries
   - Update frontmatter topics/domains if scope shifted
7. If no memory file exists yet, create one with proper frontmatter and record its path in current-session.json under memory_file

At COMPLETION:
8. If you worked from an `iterate-*.md` artifact, update its frontmatter `status: completed` and `ralph_status: completed` if present
9. Do a final memory update
10. Tell the user to re-run `/b-review` against the same plan or phase before `/b-save` (and before `ralph_done` if inside a Ralph loop).

## Closeout

After completing iteration:
1. **Update iteration artifact** — if working from an `iterate-*.md` file:
   - Set `status: completed`
   - Set `ralph_status: completed` if the field exists
   - Set `completed: YYYY-MM-DD` (today's date)
   - Update `updated: YYYY-MM-DD` (if not already set to today)
2. **Changed files** — list what was modified
3. **Verification** — confirm the fixes work
4. **Draft commit message** — write the draft to the active subject folder (e.g. `.context/YYYY-MM-DD.subject/draft-commit.md`). If no subject folder exists yet, write to `.context/draft-commit.md` at the root. If the scope is the same as the original build's commit, update the existing draft rather than creating a new one. Include a Conventional Commits message for the follow-up changes:

   ```markdown
   ## Title
   <type>(<scope>): <short summary>

   ## Body
   <why this change was made, key constraints, notable behavior changes>
   ```

5. Tell the user: "Run `/b-review` to validate the iteration, then `/b-save` to finalize this session's record, or `/git-commit` to commit." If inside a Ralph loop, call `ralph_done` only after review passes and `/b-save` has durable state.

## Best For

- Rename and string fixes
- Lint or formatting cleanup
- Small follow-up edits from review
- Lightweight diagnostics or logging
