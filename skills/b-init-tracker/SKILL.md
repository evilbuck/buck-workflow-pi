---
name: b-init-tracker
description: >
  Configure this repo's issue-tracker config: where issues live and the
  triage label vocabulary. Sections A (tracker) + B (labels) only — domain
  docs (CONTEXT.md, ADRs) are b-docs' job, not this skill's. Run once before
  first use of b-issue-create, fix-pr, or b-triage; idempotent, safe to
  re-run. Use when the user says "set up the issue tracker", "configure
  triage labels", or when a skill references docs/agents/issue-tracker.md
  or triage-labels.md that don't exist yet.
---

# b-init-tracker: Issue-Tracker Config Init

Scaffold the per-repo configuration that `b-issue-create`, `fix-pr`, and
`b-triage` assume: where issues live, and the label vocabulary for the five
canonical triage roles.

> Origin: ported from `mattpocock/skills` (`skills/engineering/setup-matt-pocock-skills/`, Sections A + B only, MIT). See `THIRD-PARTY-NOTICES.md` at the repo root.

**Out of scope**: domain docs (`CONTEXT.md`, `docs/adr/`) — Section C of the
upstream skill. This repo already owns that via `b-docs` + `CONTEXT.md`.
Do not write `docs/agents/domain.md`.

This is a prompt-driven skill, not a deterministic script: explore, present
what you found, confirm with the user, then write.

## Process

### 1. Explore (never assume; detect before writing)

- `git remote -v`: is this a GitHub repo? Which one? (GitLab if the remote
  points there instead.)
- `AGENTS.md` and `CLAUDE.md` at the repo root: which exists? Does either
  already carry an `## Agent skills` block?
- **`docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`**:
  check each **independently** — do not treat the pair as one unit.
  Whichever already exists, **never overwrite it**; read its content and
  summarize it back to the user instead of drafting a new one. Whichever is
  **missing, still run its section** to create it (Section A for
  `issue-tracker.md`, Section B — only if a triage skill is installed — for
  `triage-labels.md`), even when its sibling already exists. This prevents a
  repo that has one file but not the other from being permanently stranded:
  a partial prior run (or a hand-authored `issue-tracker.md` with no
  `triage-labels.md`) must self-heal on the next `b-init-tracker` run rather
  than silently skipping the missing file forever.
- Is a `triage` skill installed (a `b-triage` or `triage` skill folder, or
  in your available skills)? This decides whether Section B runs at all.

### 2. Present findings and ask (skip only the sections whose file already exists)

For each doc file that already exists, skip straight to step 3 with its
existing content as the source of truth — do not re-ask that file's
questions. For each doc file that is **missing**, ask its section's
question below even if the sibling file is present.

Otherwise, one question at a time, recommended answer first:

**Tracker.** GitHub if `git remote` points there; GitLab if it points at a
GitLab host; otherwise offer GitHub / GitLab / local markdown
(`.scratch/<feature>/`) / other (freeform). Record the choice in
`docs/agents/issue-tracker.md` using the matching seed template:
[issue-tracker-github.md](issue-tracker-github.md),
[issue-tracker-gitlab.md](issue-tracker-gitlab.md),
[issue-tracker-local.md](issue-tracker-local.md).

**Labels** (only if a triage skill is installed). Ask: "Keep the default
triage labels? (recommended: yes)". Defaults are the five canonical roles,
each label string equal to its name: `needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`. On yes, write them as-is
using [triage-labels-seed.md](triage-labels-seed.md). On no, collect the
overrides (existing tracker label names) so `b-triage` applies them instead
of creating duplicates.

### 3. Confirm and edit

Show the user a draft of the `## Agent skills` block (below) and, only when
writing fresh, the contents of `docs/agents/issue-tracker.md` /
`triage-labels.md`. Let them edit before writing.

### 4. Write (idempotent managed block)

**Pick the file to edit**: `CLAUDE.md` if it exists, else `AGENTS.md`. If
neither exists, ask the user which to create — don't pick for them. Never
create one when the other already exists.

Write (or refresh in place) an idempotent managed block, mirroring
`b-init-guardrails`'s `<!-- BEGIN b-init-guardrails --> … <!-- END -->`
pattern **as a sibling block, never nested inside it**:

```markdown
<!-- BEGIN b-init-tracker -->
## Agent Skills: Issue Tracker

Managed by `b-init-tracker`. Do not edit manually; re-run the skill to refresh.

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Triage labels

[one-line summary of the label vocabulary, or "not configured — triage skill not installed"]. See `docs/agents/triage-labels.md`.
<!-- END b-init-tracker -->
```

**Idempotency rule**: compute the block's content fresh each run. If it is
byte-identical to what is already in the file, write nothing (a re-run
against an unchanged repo produces an empty `git diff`). If the summary
lines would change (tracker or label config changed), replace the block
in place — never append a duplicate block, never touch content outside the
markers.

**Never overwrite `docs/agents/issue-tracker.md` or `triage-labels.md` when
they already exist** — those are the source of truth this block summarizes;
this skill only re-derives the summary from them.

### 5. Done

Tell the user setup is complete (or already was) and which skills now read
from these files (`b-issue-create`, `fix-pr`, `b-triage`). Re-running is
only needed to switch trackers, change label vocabulary, or refresh the
`AGENTS.md` summary after editing the docs files by hand.
