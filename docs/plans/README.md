# plans · readable `.context/` browser

Astro static site for visible workflow Markdown, sourced through the existing
**`PlanSource` adapter** (`src/lib/plans/`). The configured repo-files,
external-files, SQLite, or PostgreSQL service supplies canonical document bytes.

## Run

```bash
cd docs/plans
npm install
npm run dev      # local preview using the configured workflow store
npm run build    # static output in dist/
npm run preview  # serve the built output
```

## Adapter contract

Pages call only three methods (`src/lib/plans/types.ts`):

- `listSubjects()` → subject folders with doc lists + `index.md` status
- `listDocuments(subject)` → parsed markdown documents
- `getDocument(subject, slug)` → one document or `null`

Implementations:

| `sql.ts` | adapter-backed | Reads visible knowledge Markdown, including plan/phase/spec/research, review/iterate/brainstorm, subject indexes, and nested captures; excludes private execution records and binaries. |
| `index.ts` | `createPlanSource()` | Always uses the configured workflow adapter; no filesystem or raw-SQL fallback. |

All page entrypoints use `createPlanSource()`. Adapter-backed builds resolve the
workflow checkout from `BUCK_WORKFLOW_ROOT`, defaulting to the checkout two
levels above `docs/plans`; normal store visibility applies before document
bytes are rendered. Set `BUCK_WORKFLOW_ROOT` when building from another
working directory.

The reader returns current-branch and published revisions only. It does not
select a raw SQL database or union adapter results with filesystem documents.

Each reader captures one immutable visible view. Production static builds share
that reader across routes, so subject listings, document bytes and link targets
come from the same snapshot without reloading the entire store per link. New
reader instances capture fresh bytes. Development does not share the production
reader, but Astro can cache static route props: restart the development server
after backend-only edits, and rebuild static output to refresh a published site.
Document hover payloads include only referenced targets, not every sibling
document. This keeps large builds from multiplying full-store reads and
unrelated preview data.

## Hover previews

Doc and subject pages inline a JSON map of linked-document synopses
(title, status/date, first-paragraph excerpt) alongside the
`LinkPreview` component (`src/components/LinkPreview.astro`). Hovering (or
keyboard-focusing) a plan link shows a popover placed on whichever side has
room, flipping left/right with vertical clamping. Relative `.md` links in
plan markdown are rewritten to extensionless site routes at build time so
both navigation and previews resolve; external URLs and asset links pass
through untouched.
