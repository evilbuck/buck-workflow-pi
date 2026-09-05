# How-to Format

How-tos live in `docs/howto/`. Create the directory lazily — only when
the first how-to is needed.

A how-to is a **Diátaxis how-to guide for one action**: task-oriented
steps for someone already at work. Numbered steps, then **Eat** — the
check that it worked. Why/decision belongs in an ADR or `b-docs`
output. Learning paths belong in a tutorial, not here. Session
history belongs in `.context/`.

## Index

`docs/howto/README.md` is the table of contents. Group related how-tos
under headings. Link every how-to. Link ADRs for *why* at the bottom
of the index, not inside every how-to.

```md
# How-to guides

Everyday tasks this project is set up for. Each how-to is numbered
steps, then **Eat** — the check that it worked.

## <Group>

1. [Start a nested group](start-nested-group.md)
2. [Join a neighbor into the group](join-window-into-group.md)
```

Project-specific key maps, modifier translations, and hardware notes
belong once on the index, not copied into every how-to.

## One file per action

| Rule | Example |
|---|---|
| Filename | `join-window-into-group.md` (kebab-case, the action) |
| Title | `# Join a neighbor into the group` |
| Opening | One or two sentences of *what this is*. Optional analogue (`Linux: Super+Alt+arrows`). |
| Body | `## Steps` then a numbered list |
| Last step | **Eat:** an observable check that it worked |
| After Eat | Only gotchas, related how-tos, or "if it failed, do X" |

Do not combine start / join / leave / reset into one file. Those are
four actions. Link them instead.

## Template

```md
# <Action in the user's words>

<One or two sentences: what this does.>

<Optional: analogue on another OS or tool, and why the chord differs.>

## Steps

1. <Do this.>
2. <Then this.>
3. **Eat:** <the check that it worked.>

<Optional gotcha. Optional link to the next how-to.>
```

## Steps

- Imperative. One move per step.
- Name the actual keys, commands, or UI, not internal identifiers.
  Write **Option+Ctrl+H**, not `alt-ctrl-h = 'join-with left'`.
- When documenting keybindings, use **physical keys** if the project
  maps layouts that way. Say so on the index.
- Prerequisites are a step or a link ("Start the group first:
  [Start a nested group](start-nested-group.md)"), not a lecture.
- The last numbered step is always **Eat:**. If you cannot name a
  check, the how-to is not done.

**Eat** is the successful-result check (house style). Bad:
"Eat: press the key." Good: "Eat: both windows share one nested
accordion. Other siblings stay root tiles."

## Do not

- Dump binding tables, CLI flags, or architecture into a how-to.
  Those belong in config comments, ADRs, or living docs.
- Restate the *why*. Link the ADR from the index.
- Write a tutorial ("first learn what a container is").
- Write unfilled templates (`$TITLE`, `<short summary>`).
- Number steps that are not actions ("understand the tree model").
- Mix two audiences. A how-to is for the operator, not the next
  agent implementing a feature.

## Voice

Someone already at the keyboard. Short, concrete, present tense.
"Press Option+G." "Confirm the neighbor." "Eat: the window is a
sibling of the group."
