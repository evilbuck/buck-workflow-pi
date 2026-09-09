---
name: b-capture
description: Live note-taking mode — the user dumps thoughts (often dictated, messy) and a subagent writes durable rough notes the same turn. Do not tidy or synthesize until the user says so.
---

# b-capture: Note-taking mode

How we take notes. The user dumps. You scribe. A subagent writes messy durable notes *this turn*. Polish is later, and only when they say so.

Topic-agnostic. Not tied to any domain — skills, code, research, or otherwise.

This is not `/b-research` (agent investigates and synthesizes) and not `/b-explore` (agent traces the codebase).

## When to use

- "write the notes as we go"
- "use a subagent, don't wait until the end"
- "I'll dictate / word vomit"
- "we'll tidy later — I'll tell you when"

## When not to use

- Agent should go look things up → `/b-research` or `/b-explore`
- User wants a plan → `/b-plan`
- User asked to tidy or synthesize *now* → leave this mode; do that work

## Mode contract (state this back on turn 1)

1. **Per-turn, never batched.** Every dump is written down on the turn it arrives.
2. **Subagent writes.** Mainline stays free for the next dump.
3. **Messy is correct.** Record contradictions; do not resolve them. Strike through wrong turns (`~~…~~` + reason); never delete.
4. **Repair dictation by context.** Speech-to-text garble is fixed silently when intent is clear. Two plausible readings → record both, flag it. Never silently pick.
5. **Polish is deferred.** No tidy-up, no summary-of-summaries, until the user explicitly says so. `/b-save` does not count.

## Write boundary

Default: `.context/YYYY-MM-DD.<subject>/` only.
If the user named a path, that path is the notes root.
Do not modify application code.

## Turn 1 — scaffold before any dump lands

Resolve subject via `skills/_shared/subject-resolution.md`. If none, infer from `$ARGUMENTS` or the first dump. Create `index.md` with `status: draft`.

Create:

```
<notes-root>/
  index.md                 # status: draft; what this is; file map
  notes/raw-capture-log.md # the spine — append-only pointers, newest at bottom
  notes/entries/           # one immutable file per dump; never rewritten
  glossary.md
  open-questions.md
```

Seed the log with a tag legend. End the log with:

```markdown
<!-- New entries append below this line. -->
```

Keep that comment the last line forever.

### Claim tags (every factual claim gets one)

| Tag | Meaning |
| --- | --- |
| `[verified]` | Opened the named file this session |
| `[unverified]` | User-reported, not yet checked |
| `[inference]` | Reasoned, not observed |
| `[conflict]` | Two sources disagree; both recorded |
| `[question]` | Open — also row in `open-questions.md` |

State the five-point contract in a few lines. Invite the first dump.

If `$ARGUMENTS` is already a dump (multiple sentences), scaffold then write `notes/entries/001.md` and a log pointer as Entry 1 in the same turn.

## Every later turn — dispatch, don't transcribe yourself

1. Repair obvious garble.
2. Allocate the next unused `notes/entries/<NNN>.md` (zero-pad, never reuse a path an in-flight agent owns). Spawn **one** subagent for this dump. Brief: verbatim dump, entry number, that exclusive target file, tag legend, "write this file only — never rewrite it, never touch any other file", "do not synthesize". Acceptance = that file exists with one tagged entry.
3. Do not idle. Cheap `[verified]` checks on the main thread are fine.
4. Mainline owns shared files. Append one pointer above the log marker (`- Entry N → notes/entries/NNN.md`). Do not wait for the subagent. Never let a subagent write the log, glossary, open-questions, or index. Glossary / open-questions / index updates wait until no other dump is in flight, or happen on a later turn.
5. Split a subject into `notes/<subject>.md` only when it has earned the page. Leave a pointer in the log. Update the index map.
6. Operator testimony is ground truth for symptoms. Verify *why*, don't re-measure what the user reported.

## Reply

Lead with what landed. Surface only contradictions and unverified claims. Do not summarize the notes — the user is mid-flow. Invite the next dump.

## Leaving note-taking mode

Only when the user says tidy / refine / synthesize / "start consolidating". Then stop capturing and do that work from the notes tree. Until then, stay in this mode even if the notes look messy enough to polish.
