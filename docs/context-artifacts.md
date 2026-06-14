# Context Artifacts: Markdown Source, JSON Query Views

Buck workflow uses a hybrid `.context/` model.

## Canonical sources

Markdown remains the source of truth for narrative artifacts:

- subject `index.md`
- `research-*.md`
- `plan-*.md`
- memory files in `.context/memory/`
- backlog item files in `.context/backlog/items/`

JSON remains the source of truth for machine-owned state:

- `.context/workflow/current-session.json`
- other operational/session caches

## Generated indexes

Run:

```bash
npm run context:index
```

This regenerates:

- `.context/index/subjects.json`
- `.context/index/memory.json`
- `.context/index/backlog.json`
- `.context/index/artifacts.json`

These files are rebuildable query surfaces. Do not hand-edit them.

## Validation

Run:

```bash
npm run context:validate
```

Validator behavior:

- invalid enum/value fields are errors
- missing required fields are currently warnings for legacy drift
- exit code is non-zero only when hard errors are present

This keeps the validator useful on the existing repo while still surfacing older artifacts that need backfill.

## Current frontmatter contracts

### Memory

Required:

- `date`
- `domains`
- `topics`
- `related`
- `priority`
- `status`

Enums:

- `priority`: `high | medium | low`
- `status`: `active | completed | superseded`

### Subject index

Required:

- `status`
- `date`
- `subject`

Enums:

- `status`: `active | completed | superseded | draft`

### Research

Required:

- `status`
- `date`
- `subject`
- `topics`
- `informs`

Enums:

- `status`: `active | completed | superseded | draft`

### Plan

Required:

- `status`
- `date`
- `subject`
- `topics`
- `research`
- `memory`

Enums:

- `status`: `active | completed | superseded | draft`

### Backlog item

Required:

- `title`
- `status`
- `priority`
- `created`
- `updated`
- `completed`
- `related`

Enums:

- `priority`: `high | medium | low`
- `status`: `active | completed`

## jq examples

Active subjects:

```bash
jq '.[] | select(.status == "active") | {subject, date}' .context/index/subjects.json
```

Latest memory entries tagged with `buck-workflow`:

```bash
jq '.[] | select(.topics | index("buck-workflow")) | {date, subject, topics}' .context/index/memory.json
```

Open backlog items:

```bash
jq '.[] | select(.status == "active") | {title, priority, updated}' .context/index/backlog.json
```
