# analysis.json schema

One object. `identity`, `steps` and `transitions` are required; everything else is
omitted from the report when absent. `render.py` validates this and lists every
problem at once.

## identity

```json
{
  "name": "concise-email",
  "source_path": "/mnt/skills/plugins/concise-email",
  "description": "One or two sentences. What it does, in plain words. Not the frontmatter description verbatim if that reads like keyword soup.",
  "triggers": ["make this email shorter", "how's this draft?"]
}
```

`triggers` are real phrases a person would type, pulled from the description's
"use when" clauses. Three to six.

## steps[]

```json
{
  "id": "draft",
  "label": "Rewrite the draft",            // <= 60 chars, shows in the diagram
  "actor": "llm",                          // script | llm | user | tool
  "plain_english": "The model rewrites the email, cutting hedging and filler but keeping every commitment the original made.",
  "reads": ["the user's draft"],
  "writes": ["the tightened draft"]
}
```

Order the array in normal execution order — the diagram stacks them top to bottom.

**Choosing `actor`.** This is the judgment call the whole report hangs on:

| actor | use when |
|---|---|
| `script` | a command, file operation or script run — same input, same output, every time |
| `tool` | an external call (API, connector, web fetch) — deterministic mechanics, non-deterministic response |
| `llm` | anything needing judgment: choosing, phrasing, classifying, deciding whether to proceed |
| `user` | the skill stops and waits for a person |

Read the actual files in `scripts/` before labelling anything `script`. Prose like
"run the analysis" often means the model does it by hand. When a step is a script
whose *arguments* the model chooses, that's two steps: an `llm` step that decides,
then a `script` step that runs.

`plain_english` is written for someone who has never seen this skill: one or two
sentences, no jargon, active voice. Say what happens, not what the file says.

## transitions[]

```json
{ "from": "draft", "to": "review", "condition": "always", "kind": "linear" }
```

`kind` is `linear`, `branch` (condition matters), `loop` (goes backwards) or
`abort` (bails out — drawn in red). Omit `condition` for plain linear steps;
include it on every branch, loop and abort.

## handoffs[]

Every crossing between a `script`/`tool` step and an `llm` step. These are why two
runs differ, so name them explicitly rather than making the reader infer them.

```json
{
  "direction": "script_to_llm",            // or llm_to_script
  "passes": "the raw text of the draft",
  "judgment": "which sentences carry meaning and which are padding",
  "returns": "a rewritten draft"
}
```

## inputs[] / outputs[]

```json
{ "name": "draft email", "required": true, "source": "user", "description": "The text to tighten." }
{ "name": "tightened draft", "location": "returned in the reply", "description": "Same meaning, fewer words." }
```

`source` is `user`, `file`, `env` or `tool`.

## mutations[]

Anything that changes state. If the skill only reads, use `[]` — the report says
"reads only", which is worth knowing.

```json
{
  "target": "stories.md",
  "kind": "overwrite",                     // create | overwrite | delete | external
  "reversible": true,
  "blast_radius": "Only this one file in the working directory."
}
```

`reversible: false` and `kind: "delete"` both flag the row as hard to undo.

## resources[]

```json
{ "path": "scripts/render.py", "tier": 3, "purpose": "Turns the analysis into HTML.", "when": "Run at the final step." }
```

`tier` follows progressive disclosure: 1 = name and description, always in context;
2 = the SKILL.md body; 3 = bundled files read on demand.

## glossary[]

Terms that appear in the skill and would stop a non-engineer. Four to eight.
Define them in one sentence, in context.

```json
{ "term": "frontmatter", "definition": "The few lines at the top of the file, between --- markers, that name the skill and say when to use it." }
```
