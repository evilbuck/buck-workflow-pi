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

| `sql.ts` | adapter-backed | Reads visible plan, phase, spec, research and subject-index artifacts through `workflow_state`. |
| `index.ts` | `createPlanSource()` | Always uses the configured workflow adapter; no filesystem or raw-SQL fallback. |

All page entrypoints use `createPlanSource()`. Adapter-backed builds resolve the
workflow checkout from `BUCK_WORKFLOW_ROOT`, defaulting to the checkout two
levels above `docs/plans`; normal store visibility applies before document
bytes are rendered. Set `BUCK_WORKFLOW_ROOT` when building from another
working directory.

The reader returns current-branch and published revisions only. It does not
select a raw SQL database or union adapter results with filesystem documents.

## Hover previews

Doc and subject pages inline a JSON map of linked-document synopses
(title, status/date, first-paragraph excerpt) alongside the
`LinkPreview` component (`src/components/LinkPreview.astro`). Hovering (or
keyboard-focusing) a plan link shows a popover placed on whichever side has
room, flipping left/right with vertical clamping. Relative `.md` links in
plan markdown are rewritten to extensionless site routes at build time so
both navigation and previews resolve; external URLs and asset links pass
through untouched.
