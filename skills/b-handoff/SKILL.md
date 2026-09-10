---
name: b-handoff
description: >
  Compact the current conversation into a portable handoff doc for a DIFFERENT
  agent, harness, or machine to pick up. Writes to the OS temp dir (never the
  workspace or .context/), emits a suggested-skills section, references
  artifacts by path/URL instead of duplicating them, and redacts secrets.
  Use when the user says "hand off", "pick this up elsewhere", or needs a
  cross-directory seed doc. Chat-only recap is b-recap; historical record is
  b-save.
---

# b-handoff: Portable Session Handoff

Write a handoff document summarising the current conversation so a **fresh agent -- possibly a different harness, directory, or machine** -- can continue the work. Save it to the **OS temp dir, not the current workspace**.

## Routing: b-handoff vs b-recap vs b-save

| Skill | Output | Use when |
|---|---|---|
| `b-recap` | Chat text only, no artifact | Orienting mid-session or on return; read-only |
| `b-save` | Historical record in `.context/` + memory | Persisting what happened for this repo's future sessions |
| **`b-handoff`** | **Portable seed doc in the OS temp dir** | **A different agent/harness/machine picks the work up** |

If the next session runs in this same repo checkout, `b-save` may be the right call instead -- or run both. If the user just wants to see where things stand, use `b-recap`.

## Destination (load-bearing)

Write the handoff doc to the **OS temp dir**:

- macOS/Linux: `$TMPDIR` (fall back to `/tmp` when unset)
- Windows: `%TEMP%`
- Never the workspace, never `.context/` -- a handoff is transient and cross-directory; polluting the repo with it is wrong.

Name it `b-handoff-<slug>-<YYYY-MM-DD>.md` and print the full path when done.

## Procedure

1. **Focus.** If the user passed arguments (`$ARGUMENTS`), treat them as what the next session will focus on and tailor the doc accordingly -- lead with that focus, trim unrelated threads.
2. **Summarise compactly.** Goal, current state, key decisions, open questions, concrete next steps. Keep it seed-sized: enough to resume, not a transcript.
3. **Emit a `## Suggested skills` section** naming which skills the next agent should load (e.g. `b-plan`, `b-build`, `b-review`) with one clause each on why.
4. **Reference artifacts by path or URL instead of duplicating their content** -- specs, plans, ADRs, issues, commits, diffs. The receiving agent reads them; do not paste them in. Quote at most a one-line pointer per artifact.
5. **Redact secrets before writing** -- API keys, passwords, tokens, and personally identifiable information are stripped or replaced with `<redacted>`. Never write secret values into the handoff doc.

## Output template

```markdown
# Handoff: <topic>

**Focus for next session:** <from $ARGUMENTS, or "continue where this left off">
**Current state:** <1-2 sentences>

## Key decisions
- <decision> -- <why>

## Open questions
- <question>

## Next steps
1. <concrete step>

## Suggested skills
- `<skill>` -- <why the next agent should load it>

## Artifacts (by reference, not content)
- `<path or URL>` -- <what it holds>

## Redactions
- <what was stripped, if anything>
```

Report the written path plus any redactions made.
