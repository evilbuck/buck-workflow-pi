# Lifecycle Artifacts Contract

Shared contract for review-gated phase/plan state. Consumed by `b-build`, `b-review`, and (from Phase 2) `b-save`. Machine classification lives in `scripts/context-artifact-schemas.mjs` and `scripts/lifecycle-artifacts.mjs`.

## Ownership Split

| Actor | Owns | Must not |
|---|---|---|
| `b-build` | `pending → in-progress` on the active discrete phase; overview row may mirror `in-progress` | Mark acceptance criteria passed; set `status: completed`; complete overview rows |
| `b-review` | Verdict + durable evidence for the exact reviewed target | Mutate phase/plan/subject completion state |
| `b-save` (Phase 2+) | Closeout mutation: phase/overview/plan/subject/backlog/memory after a valid review-pass | Infer completion from chat, checkboxes, or a missing/stale pass |

In-plan failure and pass are mutually exclusive for one review attempt.

## Phase Status Flow

```
pending → in-progress (b-build)
in-progress → completed (b-save only, after valid review-pass)
```

Interrupted or unfinished work stays `in-progress`. Acceptance checkboxes remain unchecked until save closes a verified unit.

## Active Phase Selection

When resolving a phased subject without an explicit phase path:

1. Prefer **exactly one** phase with `status: in-progress`.
2. If multiple phases are `in-progress`, stop and ask — ambiguous.
3. Else prefer the single remaining non-completed (`pending`) phase when only one exists.
4. Else stop and present a menu of non-completed phases.

`in-progress` always outranks later `pending` phases. Never auto-advance to Phase N+1 while Phase N is still `in-progress`.

Legacy single-file phased plans (no discrete `phase-*.md` files): select only when exactly one non-completed phase section is deterministically identifiable. Otherwise fail explicitly and require a discrete phase path or migration. Do not guess.

## Review-Pass Artifact

### When to write

| Review outcome | Write | Do not write |
|---|---|---|
| In-plan defects | `iterate-*.md` (update if one already exists for the target) | `review-pass-*` |
| Pass | exactly one `review-pass-<target-stem>.md` | `iterate-*` for this attempt |
| Pass with out-of-plan follow-up | one `review-pass-…` with `verdict: pass-with-follow-up` | `iterate-*` (out-of-plan is not iterate) |
| Documentation impact only | still write pass when in-plan work is clean; set `documentation_impact: flagged` | treat docs impact as in-plan failure |

Documentation impact is non-blocking. It never turns pass into needs-work and never goes into `iterate-*`.

### Naming and location

- Path: `<subject-folder>/review-pass-<target-stem>.md`
- Target stem: basename of the reviewed phase, plan, or spec path without `.md`
  - e.g. target `.context/…/phase-1-review-gated-phase-state.md` → `review-pass-phase-1-review-gated-phase-state.md`
- Subject folder is the folder that owns the reviewed target, not “newest subject”

One pass file per target. A re-pass overwrites or supersedes the previous pass for that target; do not accumulate multiple active passes for the same stem.

### Required frontmatter

| Field | Required | Notes |
|---|---|---|
| `status` | yes | `active` until save consumes it; later `completed` / `superseded` |
| `date` | yes | review date `YYYY-MM-DD` |
| `subject` | yes | owning subject folder name |
| `target` | yes | repo-relative path of reviewed phase/plan/spec |
| `verdict` | yes | `pass` \| `pass-with-follow-up` |
| `documentation_impact` | yes | `none` \| `flagged` |
| `fingerprint` | yes | implementation fingerprint (see below) |
| `topics` | yes | at least `[review, review-pass]` |
| `related` | yes | array; include target and key implementation paths when known |
| `completed` | yes | `null` until save closes the unit |

### Required body sections

1. **Source** — reviewed target, subject, review command context
2. **Completion matrix** — each acceptance criterion / plan step with status and evidence cites
3. **Verification** — commands run and results (pass/fail + summary)
4. **Out-of-plan follow-ups** — list or `none`; never blocks this pass
5. **Fingerprint** — list of fingerprinted implementation paths and the fingerprint value

### Implementation fingerprint

Purpose: detect implementation drift after a pass so save can refuse a stale pass.

Rules:

- Hash **only** reviewed implementation paths (skills, scripts, source) that the review accepted.
- **Exclude** later durability writes under `.context/**` (memory, indexes, draft-commit, the review-pass itself, iterate artifacts, backlog mutations).
- Prefer a stable ordered list of `path` + content digest (e.g. sha256 of `path\0content` joined in path-sorted order).
- Record the path list in the pass body so a human can see the scope.
- If any fingerprinted implementation file changes after the pass, the pass is **stale** and must not close the unit.

Machine helpers: `computeImplementationFingerprint`, `isFingerprintMatch` in `scripts/lifecycle-artifacts.mjs`.

### Example skeleton

```markdown
---
status: active
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
target: .context/YYYY-MM-DD.subject-name/phase-1-example.md
verdict: pass
documentation_impact: none
fingerprint: sha256:<hex>
topics: [review, review-pass]
related:
  - .context/YYYY-MM-DD.subject-name/phase-1-example.md
completed: null
---

# Review Pass: phase-1-example

## Source
- Target: `.context/.../phase-1-example.md`
- Subject: `YYYY-MM-DD.subject-name`
- After: `/b-build` | `/b-build-hard` | `/b-iterate`

## Completion matrix
- [x] Criterion A — evidence: `path:line`, test name, or command output summary
- [x] Criterion B — evidence: …

## Verification
- `npx vitest run scripts/foo.test.mjs` — pass

## Out-of-plan follow-ups
none

## Fingerprint
- Algorithm: sha256-path-content-v1
- Paths:
  - `skills/b-review/SKILL.md`
  - `scripts/lifecycle-artifacts.mjs`
- Value: `sha256:<hex>`
```

## Iterate Artifact (failure only)

Unchanged intent from `b-review`: in-plan defects write/update `iterate-*.md`. No review-pass for that attempt. Out-of-plan findings never land in iterate.

## Validator / Classification Substrate

Phase 1 introduces:

- `review-pass` as a recognized artifact kind
- required fields and enums above
- filename pattern `review-pass-*.md` under a subject folder

Full multi-kind registry migration (phase, overview, iterate, spec, draft-commit, …) is reserved for Phase 9. Do not invent parallel schema sources.

## Absorbed Concepts

The separate “implementation ledger” idea is superseded by review-pass. Do not create both.
