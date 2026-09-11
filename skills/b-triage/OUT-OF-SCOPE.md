# Out-of-Scope Knowledge Base

`.out-of-scope/` at the repo root stores persistent records of rejected
feature requests. It serves two purposes:

1. **Institutional memory**: why a feature was rejected, so the reasoning
   isn't lost when the issue is closed.
2. **Deduplication**: when a new issue matches a prior rejection, surface
   the previous decision instead of re-litigating it.

## Directory structure

```
.out-of-scope/
├── dark-mode.md
├── plugin-system.md
└── graphql-api.md
```

One file per **concept**, not per issue. Multiple issues requesting the
same thing are grouped under one file.

## File format

Relaxed, readable style — more like a short design document than a
database entry.

```markdown
# Dark Mode

This project does not support dark mode or user-facing theming.

## Why this is out of scope

The rendering pipeline assumes a single color palette. Supporting multiple
themes would require a theme context provider, per-component theme-aware
style resolution, and a persistence layer for user preferences — a
significant architectural change that doesn't align with the project's
focus.

## Prior requests

- #42: "Add dark mode support"
- #87: "Night theme for accessibility"
```

### Naming the file

Short, descriptive kebab-case: `dark-mode.md`, `plugin-system.md`. The name
should be recognizable enough that someone browsing the directory
understands what was rejected without opening the file.

### Writing the reason

Substantive, not "we don't want this" but *why*: project scope/philosophy,
technical constraints, or a strategic decision. Durable — avoid referencing
temporary circumstances ("too busy right now"); those are deferrals, not
rejections.

## When to check `.out-of-scope/`

During triage step 1 (Gather context), read all files. Match by concept
similarity, not keyword ("night theme" matches `dark-mode.md`). If there's
a match, surface it: "This is similar to `.out-of-scope/dark-mode.md`. We
rejected this before because [reason]. Do you still feel the same way?"

The maintainer may: **confirm** (new issue added to the file's "Prior
requests", then closed), **reconsider** (file deleted/updated, issue
proceeds through normal triage), or **disagree** (related but distinct,
proceed normally).

## When to write to `.out-of-scope/`

Only when an **enhancement** (not a bug) is *rejected* as `wontfix`.
Applies to enhancement PRs the same as issues.

Do **not** write here when something is closed as `wontfix` because it's
**already implemented** — that's a built feature, not a rejected one;
recording it would poison the dedup checks with false rejections. Point to
where the feature already lives instead.

The flow: check for a matching file → append or create → post a comment
linking it → close with `wontfix`.

## Updating or removing entries

If the maintainer reconsiders a previously rejected concept, delete the
file. Don't reopen old issues; they're historical records. The new issue
that triggered the reconsideration proceeds through normal triage.
