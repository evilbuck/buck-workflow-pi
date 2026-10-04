# plans · readable `.context/` browser

Astro static site that serves the markdown in `.context/{subject}/` folders so
plans are easy to read. Markdown is sourced through a **`PlanSource` adapter**
(`src/lib/plans/`), so filesystem and SQL-backed plan storage are interchangeable.

## Run

```bash
cd docs/plans
npm install
npm run dev      # local preview with live .context/ reads
npm run build    # static output in dist/
npm run preview  # serve the built output
```

## Adapter contract

Pages call only three methods (`src/lib/plans/types.ts`):

- `listSubjects()` → subject folders with doc lists + `index.md` status
- `listDocuments(subject)` → parsed markdown documents
- `getDocument(subject, slug)` → one document or `null`

Implementations:

| File | Kind | State |
|---|---|---|
| `filesystem.ts` | `fs` | Live. Walks `PLAN_CONTEXT_DIR` (default: repo `.context/`). |
| `sql.ts` | `sql` | Typed stub. Fails closed until a plan-document table exists. |
| `index.ts` | `combined` | Union of both sources; SQL wins on slug collisions. |

Selection via `PLAN_SOURCE=fs|sql|combined` (default `fs`) through
`createPlanSource()`. Index/subject pages currently instantiate
`FilesystemPlanSource` directly at build time; switch them to
`createPlanSource()` once the SQL table lands — no page redesign needed.

## Adding the SQL source

1. Add the migration (proposed row shape is documented in `sql.ts`).
2. Fill in the three `SqlPlanSource` methods with `pg` queries against
   `SQL_MEMORY_URL`.
3. Set `PLAN_SOURCE=combined` to overlay database edits on committed files.

## Hover previews

Doc and subject pages inline a JSON map of linked-document synopses
(title, status/date, first-paragraph excerpt) alongside the
`LinkPreview` component (`src/components/LinkPreview.astro`). Hovering (or
keyboard-focusing) a plan link shows a popover placed on whichever side has
room, flipping left/right with vertical clamping. Relative `.md` links in
plan markdown are rewritten to extensionless site routes at build time so
both navigation and previews resolve; external URLs and asset links pass
through untouched.
