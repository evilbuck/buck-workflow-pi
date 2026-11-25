---
name: b-iterate
description: Quick follow-up fixes, polish, and review-loop edits. Use for small changes after b-review, rename/string fixes, lint cleanup, or lightweight diagnostics.
---

# b-iterate: Quick Fix Agent

Handle quick follow-up fixes, polish, and review-loop edits.

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for all downstream artifact discovery.
If the protocol finds no subject, work from the user's inline description.
When the supervisor supplies a review repair scope, read the exact iterate revision through `workflow_state` and use the named slice. Use that artifact and slice throughout this run, including completion.

When the supervisor supplies a guardrails repair scope, use the named failed gate and slice. Read an iterate revision only if the supervisor explicitly supplies one. With neither an explicit artifact nor a scoped repair, list visible iterate artifacts through `workflow_state` for the resolved subject (`list` with `kind: iterate`, following pagination). Use the CLI equivalent where needed. Read the returned artifacts and consider their current active revisions. Use a sole active artifact, or ask which to use if multiple apply. If none exists, proceed from the inline task when it is sufficient. An adapter failure blocks artifact discovery. Checkout files are optional projections.

For plan-backed iterations, use the artifact's `reviewed_slice` when it is present. For a legacy artifact with no slice, use its plan context and, in an OMP execution session, check for an in-progress phase for that plan. Follow the selected artifact's issues in priority order (Critical → Warnings).

## Behavior

- Prefer tiny, focused changes.
- Escalate to `b-build` if the work spreads.
- Re-run the light subset of the deterministic check contract for code-touching work: lint and unit-test gates only. Skip coverage, patch, and complexity gates — those need a coherent full-build point. This keeps `b-iterate` genuinely quick.
- Before making a relevant project change, follow `skills/_shared/recall-project-memories.md` and `skills/_shared/workflow-state-access.md`. Do not call `sql_memory` or construct SQL.
- Hand back to `b-review` when done.

## Session Awareness Protocol

The Buck workflow plugin tracks your session automatically. You are responsible for the living memory — the plugin handles the rest.

At the START of your work:
1. Read `.context/workflow/current-session.json` if it exists
2. Read the memory file listed in session state (if any) for prior context
3. Optional: if OMP `recall` is available, recall decisions tied to the iterate subject (background only)
4. Apply **Context Resolution** (above) to find an `iterate-*.md` artifact
5. If an iteration artifact is found, read it fully and work through its issues in order

At EACH NATURAL STOP (you finished a coherent unit of work):
6. Read the current session memory file
7. Rewrite it in-place with consolidated, current information:
   - Add new decisions made since last update
   - Move abandoned approaches to an "Abandoned Approaches" section with reasons
   - Update "Files Modified" to reflect actual current state
   - Remove duplicates and superseded entries
   - Update frontmatter topics/domains if scope shifted
8. If no memory file exists yet, create one with proper frontmatter and record its path in current-session.json under memory_file

At COMPLETION:
9. If this run used an iterate artifact, complete it through the adapter as specified below. Otherwise proceed to the final memory update.
10. Do a final memory update
11. Tell the user to re-run `/b-review` against the same plan or phase before `/b-save`. Inside an execution session, return once your assignment is verified. The supervisor uses the completed artifact when one was selected, or the reported verification evidence for an artifact-free repair.

## Closeout

After completing iteration:
1. **Complete the selected iteration** — if an iterate artifact was used and its findings are verified, write a new revision of the same iterate artifact through `workflow_state` using the selected revision as the expected predecessor. Preserve its findings and metadata. Set `status: completed`, `completed: YYYY-MM-DD`, and `updated: YYYY-MM-DD`. Read back the exact new revision and return it. If the current revision changed during repair, revalidate against that revision before updating it.
2. **Changed files** — list what was modified
3. **Verification** — confirm the fixes work
4. **Draft commit message** — write the draft to the active subject folder (e.g. `.context/YYYY-MM-DD.subject/draft-commit.md`). If no subject folder exists yet, write to `.context/draft-commit.md` at the root. If the scope is the same as the original build's commit, update the existing draft rather than creating a new one. Replace `$TITLE` with a Conventional Commits subject; replace `$BODY` with why. Do not leave angle-bracket hints in the file.

   ```markdown
   ## Title
   $TITLE

   ## Body
   $BODY
   ```

5. Tell the user: "Run `/b-review` to validate the iteration (it flags documentation impact for `/b-docs`), then `/b-save` to finalize this session's record, then `/b-commit` to commit." Inside an OMP execution session, return the verification evidence and any completed iterate revision. The supervisor runs the remaining stages and enforces the required gates.

## Best For

- Rename and string fixes
- Lint or formatting cleanup
- Small follow-up edits from review
- Lightweight diagnostics or logging
