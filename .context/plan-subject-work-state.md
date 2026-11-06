---
status: completed
date: 2026-09-19
updated: 2026-09-19
subject: 2026-09-19.subject-work-state
topics: [subjects, lifecycle, scan, buck-loop, closeout, reopen]
research:
  - research-buck-loop-build-timeout.md
iterations:
  - iterate-subject-work-state.md
spec:
memory:
  - buck-loop-build-timeout-2026-09-19.md
  - subject-work-state-build-2026-09-19.md
---

# Plan: deterministic subject work-state

## User Goal

When I start new work, it does not land in a finished subject, and `/buck-loop` on a new plan does not report `done: all phases completed` because an older plan in that folder is finished. Subject lifecycle changes must go through one deterministic TypeScript authority; skills, commands, prompts, and extensions must not write `index.md status:` directly.

## Goal

Two independent code-owned seams, followed by a clean caller cutover:

1. **Plan identity in `scan`** — a named plan only sees phases that name it. This fixes the false `phased-complete` result.
2. **Canonical subject lifecycle authority** — one TypeScript module owns `index.md` lifecycle inspection and every legal transition. Its public operations express intent: `initialize`, `activate`, `close-verified`, and `reopen`; there is no generic status setter.
3. **Complete adoption** — every repository-owned subject lifecycle reader/writer uses the module or its Bun CLI. The active `/b-save` path performs verified closeout now; `b-save-improved` uses the same authority for future parity.

This authority owns only the subject lifecycle represented by `.context/<subject>/index.md`. Plan-file and phase-file `status:` fields remain separate contracts and are not folded into subject lifecycle.

## Context used / assumptions

- Trigger: `/buck-loop .context/2026-09-18.buck-loop-extension/plan-buck-loop-subject-picker.md` returned `done: all phases completed`. `scan` bound `planPath` correctly, then attributed completed phases owned by `plan-buck-loop-extension.md` to the picker plan.
- The stale session pointer and an `active` subject index let shared resolution reuse the finished epic. Shared resolution and `b-plan` currently encode different pointer rules; both must delegate to lifecycle inspection.
- Active `/b-save` is the pure prompt in `skills/b-save/SKILL.md` and `prompts/b-save.md`. Responsibility 2 can create a subject. Closeout must run after phase, iterate, and loose-artifact consolidation. Refusal reports blockers and leaves lifecycle unchanged; no direct-write fallback.
- `b-save-improved` currently writes `subject_index_status` before `applyStatuses`. Its cutover must separate ordinary index content from lifecycle fields, apply every artifact/status change, then invoke lifecycle intents last.
- Direct lifecycle instructions exist across subject-creating skills. Runtime writers also exist in `extensions/plan-artifact.ts` and `extensions/code-review-iteration/report.ts`; both are migration callers, not audit exceptions.
- `plugins/buck-workflow/skills/` is a physical Codex release bundle. `scripts/codex-plugin.test.ts` requires its `canonicalCopies` to match canonical skills byte-for-byte. The bundled authority is a distribution copy, not a second design.
- `readSubjectStatus` and `listSubjectFolders` expose the raw scalar without transition/provenance validation.
- `b-plan-update` already confirms before reopen. The authority preserves that gate, removes both direct subject-status write instructions, and keeps plan-file status distinct.
- Skills are passive content; no usable `skill_end` hook exists.
- Phase `plan:` basename matching is sufficient. Untagged phases remain compatible only in a sole-plan subject.

## Options (architecture)

| Option | Shape | Main strength | Rejected because |
|---|---|---|---|
| A. Generic status setter | `transitionSubject({ from?, to })` | Small API | Callers still choose raw states and can bypass verified closeout |
| B. Intent-command authority | `applySubjectLifecycleIntent({ kind })` plus `inspect` | Invalid transitions are not expressible through the supported interface | **Chosen** |
| C. Append-only lifecycle ledger | Events are authoritative; `index.md` is a projection | Full transition audit and replay | Adds a second persistent source, projection recovery, locking, and migration complexity not justified here |
| D. Skill-protocol only | Document lifecycle rules in Markdown | Portable | Does not prevent divergent mutations and does not fix `scan` |
| E. `tool_call` write guard | Reject direct lifecycle edits at runtime | Strong enforcement in one harness | Not portable across all target harnesses; may be added later, but is not the primary contract |
| F. Skill `skill_end` / `hooks/post` | Close after skill execution | Would centralize timing | Rejected: no such lifecycle event exists |

**Decision:** combine plan-scoped `scan` with the intent-command authority. Keep `index.md` as the persisted compatibility surface, but make the TypeScript module its only supported lifecycle writer. Add a repository policy audit so future skills/prompts cannot quietly reintroduce direct status instructions.

## Scope

### 1. Plan-scoped phases (`extensions/buck-loop/scan.ts`)

`loadResolved` already has `planAbs` before `listPhases`; pass it through.

A phase belongs to `planAbs` when:

- `frontmatter.plan` basename equals `basename(planAbs)`, or
- `plan` is absent and the subject contains exactly one non-overview `plan-*.md` file.

A named plan with zero belonging phases is `unphased`. All belonging phases completed is `phased-complete`. Completed sibling phases are invisible.

Regression fixture: completed phases naming `plan-buck-loop-extension.md` beside `plan-buck-loop-subject-picker.md`. Scanning the picker plan must return `unphased`; scanning the epic plan must remain `phased-complete`.

### 2. Canonical lifecycle module (`skills/_shared/scripts/subject-lifecycle.ts`)

Expose one implementation through an imported API and thin Bun CLI:

```ts
type SubjectLifecycleState = "draft" | "active" | "completed";
type SubjectLifecycleIntent =
  | { kind: "initialize"; subjectDir: string }
  | { kind: "activate"; subjectDir: string }
  | { kind: "close-verified"; subjectDir: string }
  | { kind: "reopen"; subjectDir: string; reason: string };

inspectSubjectLifecycle(subjectDir: string): SubjectLifecycleInspection;
applySubjectLifecycleIntent(intent: SubjectLifecycleIntent): SubjectLifecycleResult;
```

No public generic setter, arbitrary target state, caller-supplied completion boolean, or direct frontmatter writer.

```text
missing   --initialize-->      draft
draft     --activate-->        active
active    --close-verified-->  completed
completed --reopen-->          active
```

`missing` means neither canonical metadata nor a legacy `status: draft|active|completed` exists. An absent index and an index with unrelated content qualify. `initialize` must not downgrade or overwrite any canonical/legacy lifecycle.

- **`initialize`** creates minimal `draft` lifecycle while preserving unrelated content. Canonical draft retry is unchanged. Active, completed, or any legacy scalar returns `invalid-transition` without writing.
- **`activate`** owns draft-to-active. Canonical active retry is unchanged. Legacy draft/open-active canonicalizes with `changed: true`. Legacy verified-closed refuses activation and must close canonically before confirmed reopen.
- **`close-verified`** owns active-to-completed and computes ownership/phase evidence internally. Open work returns `not-verified`; malformed ownership returns `legacy-ambiguous`; neither mutates. Canonical completed retry is unchanged. Legacy completed or verified-complete legacy active canonicalizes completed with `changed: true`.
- **`reopen`** owns completed-to-active and requires a reason after user confirmation. Reopen from missing/draft/active is `invalid-transition`, not a retry.

Illegal edges return `invalid-transition`; open work `not-verified`; malformed legacy evidence `legacy-ambiguous`. Canonical no-op retries do not increment revision. Successful legacy canonicalization writes provenance and a canonical revision.

The module atomically preserves unrelated frontmatter and the complete body. Canonical metadata includes compatible `status:`, schema version, revision, last transition, and reopen reason. Plan/phase statuses remain evidence only. Legacy inspection uses plan-scoped evidence:

- raw completed is effectively completed;
- raw active/draft with all owned phases complete and no unphased plan is legacy verified-closed and excluded from reuse;
- legacy open work is canonicalized only by a matching valid intent, never `initialize`;
- malformed/ambiguous legacy state fails closed.

`verified-closed` is a verifier result, not persisted state. Canonical active after reopen stays active during inspection; only a later explicit `close-verified` may close it again.

### 3. CLI contract for prompt-only callers

```text
bun skills/_shared/scripts/subject-lifecycle.ts inspect --subject <dir> --json
bun skills/_shared/scripts/subject-lifecycle.ts initialize --subject <dir> --json
bun skills/_shared/scripts/subject-lifecycle.ts activate --subject <dir> --json
bun skills/_shared/scripts/subject-lifecycle.ts close-verified --subject <dir> --json
bun skills/_shared/scripts/subject-lifecycle.ts reopen --subject <dir> --reason <text> --json
bun skills/_shared/scripts/subject-lifecycle.ts audit --repo . --json
```

- Exit 0: applied/idempotent. Exit 2: semantic refusal. Exit 1: malformed invocation or runtime failure.
- Diagnostics use stderr; stdout is one JSON result with previous/resulting state, changed flag, provenance, and evidence/blockers.
- `audit` is a repository policy check, not a unit test or guardrails gate. It scans `skills/`, `prompts/`, `commands/`, `extensions/`, and `plugins/buck-workflow/skills/`. TypeScript detection is syntax-aware; Markdown detection targets imperative direct-write instructions. Only test fixtures, the canonical authority, and its byte-identical bundled copy are allowlisted.
- Add `npm run subject-lifecycle:check`. Keep it separate from `npm test` and `guardrails:check`; a dedicated `lifecycle_audit` pull-request CI job runs it.

### 4. Caller cutover

All repository-owned lifecycle consumers move together:

- **Creation** — subject creators, including active `b-save` responsibility 2, call `initialize`; none write a scalar directly.
- **Activation** — `b-plan`, `b-phase`, `b-pr-review-2-issues`, `code-review-universal`, `code-smells`, and equivalent workflows call `activate` after initialization/draft inspection.
- **Runtime extensions** — `extensions/plan-artifact.ts` initializes then activates. `extensions/code-review-iteration/report.ts` uses inspection for selection and initializes/activates a new report subject. Their tests move with them.
- **Inspection** — shared resolution, `b-plan`, `b-plan-update`, `skills/b-save-improved/SKILL.md`, preflight, report resolution, pickers, and menus stop parsing raw status.
- **Active `/b-save`** — initialize on create; activate draft plan work; after phase, iterate, and loose-artifact consolidation call `close-verified`. Exit 2 is not a save rollback: report blockers, leave lifecycle unchanged/open, do not claim closeout, and never directly write status.
- **`b-save-improved`** — update ordinary index content without lifecycle fields, apply all artifact/status/loose changes, then activate eligible draft plan work and invoke `close-verified` last. Remove `subject_index_status`; return the lifecycle result.
- **Reopen** — `b-plan-update` confirms, invokes `reopen --reason`, removes both direct-write instructions, and distinguishes plan status from subject lifecycle.
- **Codex bundle** — recopy each changed `canonicalCopies` skill and `_shared` file into `plugins/buck-workflow/skills/`; parity remains test-enforced.
- **Commands** — symlinks inherit prompt changes; any real command uses the CLI without duplicate transition logic.

### 5. Explicit reopen behavior

1. `b-plan-update` inspects through the authority.
2. Completed state triggers the existing explicit confirmation.
3. Approval invokes `reopen` with a reason.
4. The authority writes completed-to-active, increments revision, and preserves unrelated content.
5. Inspection remains canonical active despite old completed phases.
6. A later `/b-save` may explicitly `close-verified`. If no new work was added, immediate re-close is legitimate explicit intent—not inspection undoing reopen.

No caller may emulate reopen by writing `status: active`.

## Out of scope

- A general state engine for plan, phase, iterate, spec, or backlog artifact statuses.
- Append-only lifecycle event sourcing or a second authoritative state file.
- Skill lifecycle hooks, `hooks/post` as after-skill, or named-skill pub/sub.
- `/buck-loop` TUI subject picker (`.context/2026-09-19.buck-loop-subject-picker/`).
- Changing `LoopState` or the transition table.
- Inferring closeout from git, tests, or guardrails; subject close verification remains plan/phase-artifact based.
- Preventing a human from manually editing Markdown. Such edits are unsupported; canonical inspection detects missing/inconsistent lifecycle provenance and fails closed.

## Affected files

| File | Change |
|---|---|
| `extensions/buck-loop/scan.ts`, scan tests | Plan-scoped phases; mixed/untagged regressions |
| `skills/_shared/scripts/subject-lifecycle.ts`, tests | Canonical API/CLI/verifier/legacy inspection/policy audit and transition/refusal coverage |
| `skills/_shared/scripts/context-helpers.ts`, tests | Delegate lifecycle reads/listing to canonical inspection |
| `skills/_shared/subject-resolution.md` | Inspect lifecycle, reject stale closed pointers, replace direct-writer guidance |
| Subject-creating/activating skill files | Replace every direct lifecycle creation/mutation with intents |
| `skills/b-plan-update/SKILL.md` | Remove both direct reopen writes; separate plan status wording |
| `skills/b-save/SKILL.md`, `prompts/b-save.md` | Initialize missing subjects; final verified close with refusal handling |
| `skills/b-save-improved/SKILL.md`, preflight/apply scripts/tests | Inspect via authority; preserve lifecycle fields; run intents after all other mutations; remove caller-selected status |
| `extensions/b-save-improved/index.ts`, tests | Remove `subject_index_status`; surface lifecycle result |
| `extensions/plan-artifact.ts`, tests | Replace active-index write with `initialize -> activate` |
| `extensions/code-review-iteration/report.ts`, tests | Replace raw selection/direct creation with inspection/intents |
| Changed `plugins/buck-workflow/skills/**` canonical copies | Recopy byte-for-byte, including bundled `_shared/subject-lifecycle.ts` |
| `package.json` | Add `subject-lifecycle:check`, separate from tests/guardrails |
| `.github/workflows/test.yml` | Add blocking `lifecycle_audit` PR job |
| Living docs / managed conventions | Document authority, transitions/refusals, bundle parity, direct-write prohibition |

Command symlinks are not edited independently; prompt targets carry their changes.

## Implementation steps

1. Add the failing mixed-plan scan test, then implement plan-scoped phase ownership with sole-plan untagged compatibility.
2. Add lifecycle tests for every legal edge/retry/refusal, precise missing-vs-legacy behavior, reopen persistence, verification blockers, preservation, and CLI results.
3. Implement `subject-lifecycle.ts` as the sole canonical writer; keep CLI parsing thin.
4. Migrate shared readers/resolution; stale session pointers require effective open state.
5. Migrate plan-artifact, code-review reports, and save-improved extension payload assembly.
6. Inventory and migrate every subject-creating or lifecycle-mutating skill/prompt/command; delete direct-write fallbacks.
7. Update active `b-save` creation/final-close ordering and refusal behavior independently of `b-save-improved`.
8. Update `b-save-improved` so all non-lifecycle mutations precede lifecycle intents and `subject_index_status` disappears.
9. Recopy changed `canonicalCopies` into the physical Codex bundle and run parity tests.
10. Add the syntax-aware policy audit, package script, and dedicated PR CI job. Do not disguise it as a unit test or guardrails sub-gate.
11. Run mixed-folder, reopen/re-close, save, extension, legacy, and audit-negative smoke scenarios.

## Acceptance criteria

- [x] Picker-plan scan is `unphased`; original epic remains `phased-complete`; sole-plan untagged behavior is preserved.
- [x] API exposes only named intents—no generic setter or caller-supplied verified boolean.
- [x] `initialize` never downgrades canonical or legacy lifecycle; every retry, legacy canonicalization, and illegal edge has a tested result.
- [x] `close-verified` computes evidence internally and refuses open/ambiguous work without mutation.
- [x] Legacy stale-active complete work is excluded from reuse and canonicalized completed only through `close-verified`.
- [x] Confirmed reopen persists active until a later explicit close intent.
- [x] `b-plan-update` distinguishes plan status from subject lifecycle and contains no direct subject-status mutation.
- [x] Active `/b-save` initializes missing subjects, closes only after all consolidation, and reports blockers without fallback writes.
- [x] `b-save-improved` runs lifecycle last and neither accepts nor emits `subject_index_status`.
- [x] Plan-artifact and code-review-report extensions use lifecycle inspection/intents only.
- [x] Lifecycle writes are atomic and preserve unrelated index frontmatter/body.
- [x] Canonical and physical Codex-bundle lifecycle files/skills pass byte-for-byte parity.
- [x] Only canonical `subject-lifecycle.ts` and its byte-identical bundled distribution copy write lifecycle fields in shipped runtime code.
- [x] `npm run subject-lifecycle:check` reports zero violations; dedicated `lifecycle_audit` PR CI exits 0.

## Verification

- Targeted Vitest: buck-loop scan, lifecycle, context helpers, save-improved preflight/apply, plan-artifact, code-review report, and Codex bundle parity tests.
- Run `npm run subject-lifecycle:check`; verify clean JSON and the dedicated CI job invokes the same script.
- Audit negative smoke: temporary TypeScript and imperative Markdown direct writers produce exit 1 with exact file/line findings; clean fixture exits 0.
- Mixed-folder smoke: plan B `unphased`; plan A `phased-complete`.
- Lifecycle smoke: `initialize -> activate -> close-verified -> reopen -> close-verified`; verify revision, preservation, immediate explicit re-close, and illegal-edge refusal.
- Legacy matrix: raw completed, open active, stale complete active, draft, missing, and malformed ownership. Verify initialize cannot downgrade and only matching intents canonicalize.
- Active `/b-save` complete/incomplete fixture smoke; blockers retain other saved artifacts and lifecycle state.
- `b-save-improved` smoke verifies artifact/status/loose mutations precede lifecycle and payload omits `subject_index_status`.
- Plan-artifact and code-review report smoke produce canonical metadata through the authority.
- Run `npm test` and full guardrails at the coherent code checkpoint.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact for in-plan issues, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings start a separate `/b-plan`. Run docs/how-to updates if review flags them.
4. Run `/b-save`.
5. Run `/b-commit`.

## Risks

- **Large migration.** Skills and extensions beyond the original bug path write lifecycle; policy audit is blocking.
- **Physical Codex bundle.** Missing a recopy causes shipped divergence; parity test is mandatory.
- **Prompt execution.** Active `/b-save` can skip a command; real prompt smoke and policy audit are required.
- **Save ordering.** Save-improved must move lifecycle last without rolling back unrelated successful save work on close refusal.
- **Legacy ambiguity.** Initialize must never overwrite legacy scalar state; malformed evidence fails closed.
- **Unphased plans stay open.** Broader completion evidence is separate scope.
- **Audit precision.** Distinguish subject lifecycle from other statuses, ordinary index edits, symlink mirrors, and fixtures with syntax-aware checks and a narrow path allowlist.
- **Cross-harness resolution.** Repository, package, and Codex-bundle callers must resolve the same shared module without harness APIs.
- **Manual edits.** Humans can bypass shipped callers; inconsistent canonical metadata is detected/refused.

## Revision Log

### 2026-09-19 — centralize lifecycle transitions and cover active b-save
- Added: deterministic TypeScript lifecycle authority, intent/CLI contract, legal transition table, explicit reopen semantics, legacy reconciliation, full caller cutover, and a blocking repository-writer audit.
- Modified: active `/b-save` is now the primary verified-close integration; `b-save-improved` is parity only. Computed `verified-closed` is a verifier result rather than a persisted lifecycle state.
- Removed: direct skill/prompt/extension mutation of subject `index.md status:` from the planned architecture (explicit clean cutover).
- Inputs: current user corrections; live `b-save`, `b-save-improved`, subject-resolution, lifecycle-writer, package-test, and PR-CI contracts; three interface alternatives evaluated in-session.

### 2026-09-19 — parallel lifecycle audit corrections
- Added omitted runtime writers (plan-artifact and code-review reports), active-save creation/refusal ordering, and save-improved final-transition ordering.
- Defined missing, legacy, retry, refusal, and canonicalization semantics so initialize cannot downgrade legacy work.
- Added physical Codex-bundle parity and a dedicated lifecycle policy CI job instead of hiding the audit in unit tests or guardrails.
