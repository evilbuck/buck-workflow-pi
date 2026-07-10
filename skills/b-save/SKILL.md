---
name: b-save
description: Close reviewed Buck workflow state and checkpoint durable session memory
triggers:
  - /b-save
---

# b-save: Save-Owned Closeout

Record the current session in `.context/`. When the active work has a matching
valid review-pass, also perform the sole authoritative completion transition.
`b-save` is prompt-driven; no extension or plugin owns closeout state.

## Canonical Authority

This skill is the complete executable contract. `prompts/b-save.md` and its
`commands/b-save.md` mirror are thin loaders only. Load:

- `skills/_shared/subject-resolution.md`
- `skills/_shared/lifecycle-artifacts.md`

Plans are intent; memory is history; review-pass is acceptance evidence.
`b-build` starts work, `b-review` records the verdict, and only `b-save` closes
accepted state.

## Resolve the Exact Save Target

1. Apply shared subject resolution. An explicit target path wins; otherwise use
   the current session subject before scanning subjects.
2. Read `.context/workflow/current-session.json` when present, then its
   `memory_file`.
3. In a discrete phased plan, select the single `in-progress` phase before any
   later `pending` phase. Multiple `in-progress` phases are ambiguous: stop and
   ask rather than mutating either.
4. A legacy single-file phased plan has no deterministic phase/overview/backlog
   transaction. Checkpoint and require migration to discrete phases or an
   explicit full-plan review; never guess a section closeout.
5. For non-phased work, resolve the explicit/current plan or spec. Do not choose
   a target by newest-directory ordering.
6. If no subject exists, create one using the normal dated subject convention
   and treat this invocation as a checkpoint, not an accepted closeout.

Use the resolved subject and target for every later lookup. Never combine
artifacts from different subjects.

## Two Save Modes

### Checkpoint

Use checkpoint mode when work is interrupted, no review-pass exists, or review
has not accepted the exact target. Create/update memory, indexes, cross-links,
backlog notes, and draft commit material, but keep the target, parent,
overview, subject, current memory, and review evidence active. Never infer
acceptance from chat, checked boxes, changed files, or an absent iterate.

### Accepted closeout

Close only when all preconditions below pass. Perform every preflight read
before the first completion write.

## Closeout Preflight

For target `<subject>/<target>.md`, require exactly
`<subject>/review-pass-<target-stem>.md`.

The review-pass must:

- classify and validate as `review-pass`;
- have `status: active`;
- name the exact repo-relative target path;
- use `verdict: pass` or `verdict: pass-with-follow-up`;
- carry a non-empty implementation fingerprint;
- still match the current contents of every implementation path listed in its
  `## Fingerprint` section.

Use `computeImplementationFingerprint` and `isFingerprintMatch` from
`scripts/lifecycle-artifacts.mjs`. Fingerprint only the paths recorded by
review; never add `.context/**` durability files.

Also scan the owning subject for `iterate-*.md`. An iterate with
`status: active` whose `addresses` names the target path or basename blocks
closeout. Do not auto-complete an iterate merely because files changed.

Refusal is non-destructive:

| Condition | Result |
|---|---|
| Review-pass missing | Checkpoint; report `missing-review-pass` |
| Review-pass target/status/verdict invalid | Checkpoint; report the exact mismatch |
| Fingerprint drift | Checkpoint; report `stale-review-pass` and require re-review |
| Active iterate for target | Checkpoint; report `active-iterate` |
| Target and pass already completed | Idempotent no-op; continue only durable index/draft reconciliation |

## Save Transaction

Treat closeout as one recoverable transaction. The normalized transition is
modeled by `closeAcceptedUnit` in `scripts/lifecycle-artifacts.mjs`; its fixture
tests are the behavior reference.

### Intermediate discrete phase

1. Set the exact phase to `status: completed`, set `completed_at` and
   `completed_by: b-save`, and check only its review-verified acceptance items.
2. Set exactly the matching overview row to `completed`. Keep overview
   frontmatter, parent plan/spec, and subject index `active`.
3. Complete and archive the current phase backlog item:
   - remove its checkbox from `.context/backlog/todo.md`;
   - set item `status: completed`, `updated`, and `completed`;
   - move it to `.context/backlog/archive/YYYY-MM/`;
   - append one stable summary to `archive/completed.md`.
4. Select the first phase in phase order whose dependencies are all completed.
   Expose that one backlog item in `todo.md` exactly once. Do not expose a
   blocked phase or duplicate an existing checkbox.
5. Complete the current session memory. The subject remains active because
   later units remain.

### Final discrete phase

Apply the phase/backlog transition above, then:

- mark the phases overview and its parent plan/spec completed;
- mark the subject `index.md` completed only when no phase, plan, spec, or
  iterate unit in that subject remains active;
- create no next-phase queue entry;
- complete the current session memory.

### Non-phased plan or spec

After a valid matching pass, check the reviewed acceptance items and complete
the target, linked parent plan/spec artifacts, current memory, and subject
index. Keep the subject active if any other unit is still active. Never invent
a phase or phase backlog item.

### Pass with out-of-plan follow-up

`pass-with-follow-up` accepts the current target. Close it normally. Create or
link the separate follow-up backlog/plan requested by the review-pass; never
reopen the accepted unit or convert the follow-up into an iterate.

## Durable Session Record

In both save modes:

1. Create or consolidate the subject folder without moving unrelated work.
2. Create/update one session memory with required frontmatter:
   `date`, `domains`, `topics`, `related`, `priority`, `status`, `subject`, and
   `artifacts`.
3. Set memory `status: completed` only for an accepted closeout; interrupted or
   refused work remains `active`.
4. Back-fill `memory:` references in the target plan/spec/overview and relevant
   artifact links in the memory.
5. Add one entry to `.context/memory/index.md`; reruns update the existing entry
   rather than duplicating it.
6. Reconcile backlog additions and completed summaries by stable path.
7. Write/update the active subject's `draft-commit.md` from the actual work and
   durable artifacts.
8. Warn, without blocking, when a plan/brainstorm lacks `## User Goal` and has
   no `Technical chore — <reason>` waiver.

QMD is optional. If `qmd` is installed, load its skill and refresh the memory
collection. If absent or an unrelated collection update fails, report the
warning and continue; QMD can never fail save.

## Write Order and Recovery

After preflight succeeds, write in this order:

1. target phase/plan/spec;
2. phases overview and parent links/status;
3. backlog item, archive summary, and `todo.md`;
4. subject index;
5. memory and memory index;
6. draft commit;
7. review-pass last, setting `status: completed` and `completed: YYYY-MM-DD`.

The active review-pass is the recovery marker. If interrupted before step 7,
rerun the same save: every list insertion, archive entry, cross-reference, and
backlog promotion must be path-keyed and idempotent. If target and pass are
already completed, do not promote or archive again.

## Output and Staging Boundary

Report:

- resolved subject and target;
- `checkpoint`, `applied`, `refused`, or `noop`;
- review-pass path and fingerprint result;
- completed/current/next phase state;
- warnings, including documentation or out-of-plan follow-ups;
- an exact repo-relative list of paths created, modified, moved, or deleted.

Then print an explicit staging checklist for those paths. Do **not** stage
files. Staging is the user-owned gate before `/b-commit`.

The closeout edge is:

```text
/b-review → /b-docs (if flagged) → /b-save → explicit stage → /b-commit
```

## Related

- `skills/_shared/lifecycle-artifacts.md`
- `skills/_shared/subject-resolution.md`
- `scripts/lifecycle-artifacts.mjs`
- `skills/b-build/SKILL.md`
- `skills/b-review/SKILL.md`
