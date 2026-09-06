---
name: b-docs
description: Update the project's living documentation from implementation — domain language, architecture decisions, conventions, and architecture narrative. Runs after b-review flags documentation impact. Writes to canonical doc locations (CONTEXT.md, docs/adr/, docs/, AGENTS.md/CLAUDE.md conventions block), never to .context/.
---

# b-docs: Living-Documentation Sync

Keep the project's **living documentation** in sync with what was actually
implemented. This captures the *meaning* of the work — conventions, domain
language, architecture decisions — so the next agent or engineer doesn't have
to reverse-engineer it from code.

`b-save` records the **event** (what happened this session) into `.context/`.
`b-docs` records the **meaning** (what the code now is) into the project's
canonical doc locations. They are complementary. Run `b-docs` **before**
`/b-save` so doc changes are included in the commit.

## When to Use

- After `/b-review` flags **documentation impact** (the normal trigger)
- A session introduced, changed, or codified conventions
- A session realized an architecture decision worth recording
- A session discovered "what is already there" that was undocumented

Most changes need **no** doc update — `/b-docs` is conditional, gated on
`b-review`'s documentation-impact finding. If there is nothing to update, say
so and stop.

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
The resolved subject (or fresh session) is the source for reading the plan,
spec, phase, and `b-review` finding that tell you *what* to document.

## Canonical Documentation Locations

Every Buck project keeps living docs in these locations. `b-docs` writes **only**
to them. Do not invent parallel doc trees — a second convention beside these is
prohibited. Reuse the formats that already exist:

| What | Where | Format source |
|---|---|---|
| **Domain language** (glossary / ubiquitous language) | `CONTEXT.md` (repo root); `CONTEXT-MAP.md` + per-context `CONTEXT.md` for multi-context repos | [`b-grill-with-docs/CONTEXT-FORMAT.md`](../b-grill-with-docs/CONTEXT-FORMAT.md) |
| **Architecture decisions** | `docs/adr/0001-slug.md` (sequential) | [`b-grill-with-docs/ADR-FORMAT.md`](../b-grill-with-docs/ADR-FORMAT.md) |
| **Agent & dev conventions** | Managed block in `AGENTS.md` / `CLAUDE.md` | idempotent managed block (see below) |
| **Architecture narrative** (structure, data flow, module boundaries) | `docs/` | free-form; extend existing docs, don't fork |
| **README** | `README.md` | **read-only** — flag needed changes in the report; do not rewrite hand-authored prose |

Create files **lazily** — only when you have something to write. `CONTEXT.md`
and `docs/adr/` are created on first use, same as `b-grill-with-docs`.

## Sources (what to read before writing)

| Source | Method | What it tells you |
|---|---|---|
| Implementation diff | `git diff`, `git diff --cached`, recent `git log` | What actually changed |
| Plan / spec / phase | Read the active subject artifacts | What was intended |
| `b-review` finding | The Documentation Impact section from the preceding review | What b-review flagged |
| Existing living docs | Read the canonical locations above | What's already documented (update, don't duplicate) |

Derive doc impact from the diff + plan. If a `b-review` documentation-impact
finding is present, use it as the priority list.

## What to Capture

1. **New or changed conventions** — patterns other agents/engineers should
   follow that aren't yet in `AGENTS.md`/`CLAUDE.md` or `docs/`.
2. **Architecture decisions realized in the build** — new shapes, boundaries,
   tech choices with lock-in. These are **ADR candidates** (see gate below).
3. **New or shifted domain language** — terms a domain expert would use, now
   reflected in code but missing from `CONTEXT.md`.
4. **New module boundaries / data flows** not reflected in the architecture
   narrative under `docs/`.
5. **Constraints not visible in code** — compliance, performance contracts,
   partner-API limits.
6. **Deviations from documented conventions** — where the docs now contradict
   the code; correct the docs (or flag if the code is the bug).

## Principles

- **Conservative.** Only update what genuinely changed. Do not rewrite docs
  that are still accurate. Edits, not rewrites.
- **No duplication.** Reference `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` rather
  than restating the formats. Do not copy a term that's already defined.
- **Codify steady state, not history.** Living docs describe what the system
  *is*. Session history is `.context/memory/`'s job — never put a changelog or
  "we did X on date Y" entry in living docs.
- **Distinct from `b-save`.** Write only to the canonical locations above.
  Never write to `.context/`.
- **Preserve human authorship.** `AGENTS.md`/`CLAUDE.md` and `docs/` contain
  hand-written guidance. Touch only the specific lines that changed.

## ADR Gate

Only create an ADR when **all three** are true (reuse
[`ADR-FORMAT.md`](../b-grill-with-docs/ADR-FORMAT.md)):

1. **Hard to reverse** — changing your mind later is meaningful.
2. **Surprising without context** — a future reader will wonder "why this way?"
3. **The result of a real trade-off** — genuine alternatives existed.

If a decision is easy to reverse, not surprising, or had no real alternative,
it does not get an ADR. Record it in `CONTEXT.md` or `docs/` instead, or skip.

## Managed-Block Convention for AGENTS.md / CLAUDE.md

Writing to `AGENTS.md` or `CLAUDE.md` is the riskiest operation — these files
carry project-specific, hand-authored instructions. **Always** wrap anything
`b-docs` writes there in an idempotent managed block, and **never** edit content
outside the block:

```markdown
<!-- BEGIN b-docs:conventions -->
### Conventions

- <convention 1>
- <convention 2>
<!-- END b-docs:conventions -->
```

Rules:
- On first write, insert the block. On subsequent runs, **replace only the
  block's contents**, preserving everything outside it verbatim.
- Append new conventions inside the block; merge duplicates; remove lines that
  the implementation contradicts.
- If the file has neither `AGENTS.md` nor `CLAUDE.md`, do not create one for
  conventions alone — use `docs/` instead. (These files are project policy;
  `b-docs` contributes a section, not the whole file.)

## CONTEXT.md Updates

Follow [`CONTEXT-FORMAT.md`](../b-grill-with-docs/CONTEXT-FORMAT.md) exactly:
- Single context → one root `CONTEXT.md`. Multi-context (a `CONTEXT-MAP.md`
  exists) → the relevant per-context `CONTEXT.md`.
- Only terms **meaningful to domain experts** — not implementation details.
- Be opinionated: pick one canonical term, list others as `_Avoid_`.
- Create the file lazily on first term.

## Behavior

1. Resolve subject; read diff, plan, and any `b-review` finding.
2. Read the existing canonical docs to avoid duplication.
3. For each doc-affecting change, write to the correct canonical location:
   - Domain language → `CONTEXT.md`
   - Decision meeting the ADR gate → new `docs/adr/NNNN-slug.md`
   - Convention → managed block in `AGENTS.md`/`CLAUDE.md`
   - Architecture narrative → extend existing `docs/` file
4. For `README.md` changes, **flag in the report only** — do not edit.
5. Stay read-only on application code. `b-docs` edits docs, never source.

## Closeout

Report what changed:

```text
Living docs updated:
- CONTEXT.md: +2 terms (Order Cancellation, Digital Fulfillment), 1 renamed
- docs/adr/0008-event-sourcing.md: new (write model event-sourced)
- AGENTS.md: conventions block updated (+error-handling pattern)
- docs/architecture.md: data-flow diagram + write-model section

Flagged (not auto-applied):
- README.md: setup section needs the new env var

Next: /b-save to record the session, then /b-commit.
```

If nothing needed updating: say "No living-doc updates needed" and recommend
`/b-save` → `/b-commit`.

## Related

- `skills/b-grill-with-docs/CONTEXT-FORMAT.md` — domain-language format (source of truth)
- `skills/b-grill-with-docs/ADR-FORMAT.md` — ADR format (source of truth)
- `skills/b-review/SKILL.md` — produces the documentation-impact finding that triggers this skill
- `skills/b-save/SKILL.md` — records the session event in `.context/` (complementary, not overlapping)
- Global `AGENTS.md` — declares these canonical locations as project policy
