---
name: b-wizard
description: >
  Generate an interactive bash wizard that walks a human through steps only
  they can perform. Use when provisioning infrastructure, setting up
  credentials or CI secrets, walking an unfamiliar third-party dashboard, or
  running a one-off migration or cutover. Don't invoke this for steps the
  agent can perform itself.
---

# b-wizard: Interactive Setup Wizards

> Origin: ported from `mattpocock/skills` (`skills/engineering/wizard/`,
> MIT). See `THIRD-PARTY-NOTICES.md` at the repo root.

A **wizard** is a bash script that walks a human, step by step, through a
manual procedure too tedious to do by hand and too tedious to re-explain to
an AI every time. It opens each URL, says exactly what to do and copy,
captures the values, writes them where they belong (`.env`, GitHub secrets),
offers confirmation gates before irreversible actions, and shows how many
stages are left.

The UX is solved by `template.sh` in this skill directory: staged progress,
a `confirm` helper for gating irreversible actions (yours to call in each
stage you author), cross-platform URL open (including WSL), hidden secret
entry, idempotent `.env` upserts, `gh secret`/`gh variable` writes, and a
closing summary. **Your job is only to scope the procedure and author its
stages.** The library above the `STAGES` marker is identical in every wizard;
never hand-edit it.

A wizard is ephemeral by default: built for one run, saved to a scratch or
`scripts/` path, deleted when done. Commit it only when the user wants a
repeatable setup path that should live in the repo.

## Process

### 1. Scope the procedure

Work out every manual step the human must take and every value captured
along the way. Read the repo first, don't ask cold:

- For setup: `.env`, `.env.example`, `.env.*`, `README`,
  `docker-compose*`, framework config, `.github/workflows/*` (every
  `secrets.*` / `vars.*` reference is a value the wizard must produce).
- For a migration: the current state, the target state, and the
  irreversible actions between them.

Then show the user the ordered stages plus the values each produces, and
confirm: they may add, drop, or reorder.

### 2. Map each stage's journey

For each stage, write the precise path a human follows: which URL to open,
what to do there, where a value is shown, which variable it fills. Where
you don't know the current UI or exact command, say so and ask the user or
check the docs: never invent steps that may not exist.

### 3. Author the wizard

Copy `template.sh` to the target path. Replace the example stage with one
`stage` per step, in dependency order, using the library helpers (`stage`,
`say`/`step`, `open_url`, `ask`/`ask_secret`, `write_env`,
`set_secret`/`set_var`, `pause`/`confirm`). Set `TOTAL_STAGES` to match.
Open the URL before asking for its value, `ask_secret` for secrets,
`write_env` every persisted value, `set_secret` only what CI needs, and
call `confirm` yourself before any irreversible action in the stage you
author — the library provides the helper, it does not gate for you. Keep a
stage to one focused task.

### 4. Verify and hand off

- `bash -n <script>`; run `shellcheck` if available. `chmod +x <script>`.
- Don't run it end-to-end: it opens browsers and blocks on human input.
  Trace statically instead: every value from step 1 is captured and lands
  where step 1 said, and every `set_secret` name matches a `secrets.*`
  reference in CI.
- Tell the user how to run it. If repeatable, commit it and link it from
  the README so the next person runs the script instead of asking an AI.
