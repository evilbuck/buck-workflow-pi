---
name: skill-explainer
description: Explain what a skill or slash-command actually does and produce a visual HTML report of it — the step-by-step flow, where deterministic code stops and model judgment begins, the inputs it needs, what it returns, and what it changes on disk. Use this whenever someone points at a skill folder or command file and asks what it does, how it works, whether it's safe to run, what it touches, or asks for it to be explained, documented, reviewed, audited or walked through — including for a teammate, a junior engineer, a product manager or a stakeholder. Also use it when someone asks for a diagram or visual of a skill's flow.
---

# Skill Explainer

Read a skill folder, work out what it really does, and write a single self-contained
HTML file that explains it to someone who has never seen it.

Two stages, kept separate on purpose:

1. **Analyse** — you read the source and write `analysis.json`.
2. **Render** — `scripts/render.py` turns that JSON into HTML. It never improvises.

The split means every report looks the same and a visual bug is fixed in one place.
It also means the analysis is reviewable on its own.

## Who the report is for

A junior engineer, a product manager, a stakeholder. Write every line so one of them
could read it start to finish without stopping. That constraint also serves the staff
engineer who wants the shape of the thing in ninety seconds — the failure mode to
avoid is not "too simple", it is a wall of detail nobody finishes.

Concretely: no jargon without a glossary entry, no restating the source file's prose,
no step described in terms of the file's internal structure. Say what happens.

## Step 1 — Read everything

Given a skill folder path:

```bash
find <path> -type f | head -50
```

Read `SKILL.md` first, then **read every file in `scripts/`**. This is not optional.
The single most common way to get this report wrong is trusting the prose about what
is automated. "Run the analysis" in a SKILL.md often means the model does it by hand
with no script anywhere. Only a file you have actually read counts as deterministic.

Skim `references/` and `assets/` for purpose; you do not need to read large reference
files in full, just enough to say what they are for and when they load.

A slash-command `.md` file works the same way — it just usually has no bundled files,
so the resources section comes out short or empty. That is fine.

## Step 2 — Write analysis.json

Read `references/schema.md` for the full field list and the rules for choosing
`actor`. Write the file to the working directory.

Two things carry most of the report's value, so spend your effort there:

**The actor call on every step.** `script` means a real command or file operation you
found in a file. `llm` means judgment — choosing, phrasing, classifying, deciding
whether to continue. When the model picks the arguments and a script runs them,
that's two steps, not one.

**`plain_english` on every step.** One or two sentences, active voice, written for
someone outside the team. This is the text people actually read.

Then the handoffs — every crossing between those two kinds of step. Those crossings
are the reason two runs of the same skill differ, and naming them is the thing a
reader can't work out for themselves.

## Step 3 — Render

```bash
python scripts/render.py analysis.json -o <skill-name>-report.html
```

It validates first and prints every problem at once if something is off. Fix the JSON
and run it again. On success it writes one file with no external dependencies — it
opens from disk, offline, and can be emailed as-is.

Tell the user the path. Don't paste the HTML into the conversation.

## Step 4 — Check it

Open the report or re-read your analysis against these:

- Does step 1 make sense to someone who has never heard of this skill?
- Is anything marked `script` that you did not find in an actual file?
- Does the mutation list include everything the skill writes, including files it
  writes as a side effect rather than as its output?
- Would a stakeholder reading only the top of the page know what this thing does and
  whether it touches their files?

A good smoke test: run this skill on its own folder. If the report doesn't explain
skill-explainer clearly, it won't explain anything else clearly either.

## Scope

One skill per report. If someone asks about a plugin containing several skills, ask
which one, or produce one file per skill — don't merge them into a single diagram.
