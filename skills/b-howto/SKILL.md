---
name: b-howto
description: Write Diátaxis how-to guides — one user action per file, numbered steps, last step Eat (the check that it worked). Writes to docs/howto/. Use when the user needs how-tos for keybindings, CLI, or everyday project actions, or after a session ships a new user-facing action. Distinct from b-docs (why/conventions/ADRs) and from tutorials (learning). May load and follow b-docs in the same session when the sequence depends on an unwritten decision.
triggers:
  - /b-howto
  - how-to
  - howto
  - write how-tos
---

# b-howto: How-to Guides

Write **how-to guides** in the Diátaxis sense: task-oriented steps for
someone already at work, not a tutorial for someone at study. Step 1,
do this; step 2, do that; last step, **Eat** — the observable check
that the task worked.

`b-docs` records *why* (conventions, ADRs, domain language).
`b-howto` records *how* (the sequence a human runs).
`b-save` records *what happened this session*. They do not overlap
files. They *do* load each other when the other kind of work shows
up in the same session — see Sibling below.

This is not a tutorial. Tutorials take a beginner on a managed path
to learn. A how-to assumes they already know they want the result
("join this window into the group") and need the working sequence.

## When to Use

- The user asks how to do something this project is set up for
  (keybindings, CLI, a workflow) and the answer should live in docs
- A session shipped a new user-facing action and `/b-review` flagged
  how-to impact, or the user says "write how-tos for this"
- Existing how-tos are a binding table, an ADR, or a chat answer —
  not a sequence someone can follow at the keyboard
- Typical actions already exist in `.context/` (plans, research,
  memory) and have no matching how-to

Most sessions need **no** how-tos. If nothing a human *does* changed,
say so and stop.

## When NOT to Use

- Why a decision was made — follow `b-docs` (do not write the ADR here)
- Domain language, conventions, architecture narrative — follow `b-docs`
- A learning path for a newcomer — that is a tutorial, not this skill
- Session history — use `b-save`
- Implementing the action rather than documenting it — use `b-build`
- A one-off chat answer the user did not ask to keep

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
The resolved subject (or the user's freeform request) tells you *which*
actions to document. `$ARGUMENTS` may name a surface ("aerospace groups",
"tmux panes") or a single action ("join the new group").

## Canonical Location

| What | Where |
|---|---|
| How-to index | `docs/howto/README.md` |
| One how-to per action | `docs/howto/<kebab-action>.md` |
| Format | [`HOWTO-FORMAT.md`](HOWTO-FORMAT.md) |

Create `docs/howto/` lazily. If the repo already has `docs/how-to/`,
`docs/recipes/`, or `docs/runbooks/` for this job, keep that tree and
apply this format there — do not invent a second cookbook.

Stay read-only on application code. `b-howto` edits docs, never
source. Config comments may *point* at a how-to; do not restyle
bindings to match the guides.

## Format

Follow [`HOWTO-FORMAT.md`](HOWTO-FORMAT.md) exactly:

- One action per file. Start, join, tab, leave are four how-tos.
- Numbered `## Steps`. Last step is **Eat:** plus the check.
- Name physical keys / real commands, not internal identifiers.
- Gotchas and related-guide links come *after* Eat.
- Why lives in ADRs; the index may link them.

## Sources (read before writing)

| Source | What it tells you |
|---|---|
| User request / `$ARGUMENTS` | Which action or surface to cover |
| Implementation | Bindings, scripts, CLI — the *actual* sequence |
| Active subject artifacts | Planned user-facing actions |
| `.context/` research, plans, memory | Typical actions already discussed |
| Existing `docs/howto/` | What is already written (update, don't duplicate) |
| ADRs / PRDs / `b-docs` output | Why — link it, do not copy it into a how-to |

Inventory from **what a human can do**, not from every config key.
A binding that exists is not automatically a how-to. A sequence the
user already asked "how do I…?" about is.

## Sibling: `b-docs`

`b-howto` owns *how*. `b-docs` owns *why*. Separate files, separate
skills — but either may **load and follow** the other in the same
session when the other kind of work is sitting in front of you.

**Follow `b-docs` when any of these are true:**
- The sequence depends on a decision that has no ADR (or the ADR
  still contains the how-to you are extracting).
- You would otherwise have to explain *why* inside a how-to.
- `/b-review` flagged documentation impact as well as how-to impact.

**Prefer why-first:** if both are needed and you were invoked
directly (not by `b-docs`), load `skills/b-docs/SKILL.md` *before*
writing how-tos so they can link the new ADR. If `b-docs` already
invoked you, skip this — write the how-tos and link what it created.

**Do not follow `b-docs` when:**
- This run was itself started by `b-docs` (once-each guard).
- The how-to is a pure operator sequence with no new decision,
  convention, or domain term.

**How:** load `skills/b-docs/SKILL.md` and execute it. Do not write
ADRs, `CONTEXT.md`, or conventions yourself. After it returns, finish
or patch how-to index links to the new ADR. Do not re-enter
`b-howto`.

## Behavior

1. Resolve subject / surface. If the user named one action, do that
   one. If they asked for a cookbook, inventory the typical actions
   for that surface.
2. **Why-first.** If Sibling says follow `b-docs` and this run was
   not started by `b-docs`, load `skills/b-docs/SKILL.md` now so
   how-tos can link the ADR. Then continue.
3. Read existing `docs/howto/` and the format file.
4. **Idempotency.** For each action:
   - No how-to → write one.
   - How-to exists and matches the implementation → leave it.
   - How-to exists but drifted (wrong chord, missing Eat, mashed
     together with another action) → edit in place or split.
5. Write or update `docs/howto/README.md` so every how-to is linked
   under a heading. Put project-wide key maps and hardware notes
   **once** on the index.
6. Point ADRs, PRDs, and living docs *at* the how-tos. Remove
   duplicated how-to sections from those files rather than
   maintaining two copies.
7. If `AGENTS.md` / `CLAUDE.md` exists, add or update a managed block
   so agents know how-tos live in `docs/howto/` and must not dump
   procedures into ADRs. Wrap it:

   ```markdown
   <!-- BEGIN b-howto -->
   - **User-facing how-tos live in `docs/howto/`.** One action per
     file, numbered steps ending in **Eat** (the check that it worked).
     These are Diátaxis how-to guides, not tutorials and not ADRs.
     Do not put how-tos in ADRs or PRDs; those stay why/decision.
     Link the index from both. Format: follow the `b-howto` skill.
   <!-- END b-howto -->
   ```

   Prefer extending an existing `b-docs` conventions block with that
   bullet when one already exists, instead of a second block.
8. Do not write `.context/` memory. Recommend `/b-save` after, unless
   Sibling still needs `b-docs` *after* the how-tos (rare: a decision
   only became visible while writing steps). Then follow `b-docs`,
   patch index links, and stop — do not re-enter `b-howto`.

## Voice

Someone already at the keyboard, not in class. Short, concrete,
present tense. "Press Option+G." "Confirm the neighbor with
Option+H/J/K/L." "Eat: both windows share the nested accordion."

## Closeout

```text
How-tos updated:
- docs/howto/README.md: index
- docs/howto/<action>.md: <one line — the Eat check>
- …

Linked from: <ADR/PRD/AGENTS, or none>

Living docs (if b-docs also ran):
- <ADR/CONTEXT/AGENTS, or none>

Next: /b-save to record the session, then /b-commit.
```

If nothing needed writing: say "No how-to updates needed". If
`b-docs` is still warranted (and you were not started by it), follow
it instead of stopping.

## Related

- `skills/b-howto/HOWTO-FORMAT.md` — format (source of truth)
- `skills/b-docs/SKILL.md` — living why-docs (complementary)
- `skills/b-review/SKILL.md` — may flag how-to impact
- `skills/b-save/SKILL.md` — session event record
- https://diataxis.fr/how-to-guides/ — the documentation type
