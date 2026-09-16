---
status: active
date: 2026-09-12
subject: 2026-09-12.pluggable-artifact-store
topics: [context, artifacts, symlink, gitignore, xdg, external-store]
research: []
iterations: []
spec: null
memory: []
---

# Plan: Pluggable Artifact Store (v1 — symlinked external store)

## User Goal

Buckley keeps Buck plans, research, brainstorms, backlog, and session memory available on every machine, even when a project gitignores `.context/`. Teammate access is a later, optional extra — not a v1 requirement. (Carried verbatim from the brainstorm.)

## Goal

Add one shared **auto-ensure** script that gives `.context/` a dual-mode resolution rule:

| State on disk | `.context` gitignored? | Behavior |
|---|---|---|
| Real directory | either | In-repo mode — untouched, skills behave as today |
| Symlink | either | External mode — verify target, ensure layout, never replace |
| Missing | yes + `origin` exists | **External mode** — create `~/.local/share/buck/projects/<host/org/repo>/` with the standard layout, symlink `.context` → it |
| Missing | yes + no `origin` | In-repo mode — `mkdir -p .context/memory` + one-line note |
| Missing | no | In-repo mode — `mkdir -p .context/memory` (today's behavior, unchanged) |

The committed surface for an external-mode project is the `.gitignore` line only — that line *is* the opt-in. Same `YYYY-MM-DD.subject/`, `memory/`, `backlog/` layout either way; worktrees sharing a git remote share one XDG store.

## Context used / assumptions

- **User-provided context:** none beyond the `/b-plan` invocation; the brainstorm at `brainstorm-pluggable-artifact-store.md` (6-question interview complete) is the authoritative intake.
- **Session context:** capability probe = `full` (system available-skills catalog lists `b-build`, `b-review`, `b-save`); active harness is ZCode, not OMP.
- **Artifacts used:** `brainstorm-pluggable-artifact-store.md` (v1 thesis, constraints, ideas table); sibling subject `2026-08-27.external-context-store` (team KV+CSV hydrate design; research locks "Hindsight is never the artifact SoT" — coexists, not coupled).
- **Code grounding:**
  - The current ensure point is a single bootstrap line: `GLOBAL_OR_PROJECT-AGENTS.md:34` — "If `.context/` missing: `mkdir -p .context/memory`". Skills themselves assume `.context/` exists; no skill `.md` mkdirs it.
  - Shared scripts live at `skills/_shared/scripts/` (`context-helpers.ts` + test as the pattern); `scripts/install.mjs` symlinks whole `skills/` dirs, so a new `_shared` script ships to every harness with no installer change.
  - `guardrails.json` v2 durable contract exists — this is a code-touching session, so `/b-guardrails-check` is blocking.
- **Assumptions (deferred Light Grill answers — override by editing this plan before build):**
  - Slug = normalized `origin` URL as nested `host/org/repo` (readable, stable across SSH↔HTTPS; org rename orphans the old dir — accepted).
  - No `origin` → in-repo mkdir (no other machine could share anyway).
  - Missing + not ignored → in-repo mkdir, no prompt (in-repo mode working as designed).

## Scope

- New shared script `skills/_shared/scripts/ensure-context-store.ts` implementing the mode table, slug normalization, gitignore detection (`git check-ignore`), symlink creation/repair, and safety invariants.
- Unit tests alongside (`context-helpers.test.ts` patterns, tmpdir fixtures).
- Bootstrap line swap in `GLOBAL_OR_PROJECT-AGENTS.md` (script call with plain-mkdir fallback when bun/Buck checkout unavailable).
- Docs: one how-to (`docs/howto/`) + a short dual-mode note in `docs/buck-workflow.md`; one-line coexist pointer added to the sibling subject's index.
- Warning path: `.context` is a symlink but no longer gitignored → warn (symlink would be committed and leaks the home path).

## Out of scope

- `ArtifactStore` TypeScript API and non-`fs` adapters (sqlite/postgres/GitHub issues) — deferred until a non-filesystem SoT exists.
- Migrate command; converting any existing real `.context/` tree.
- Team sharing / git-ancestry (stays with `2026-08-27.external-context-store` hydrate design).
- Semantic search / sqlite-vec / Hindsight as SoT (Hindsight stays LTM fact-mirror).
- Config file, daemon, split read/write adapters (one store; read and write use the same path).
- Re-installing bootstraps on user machines (documented follow-up: re-run `buck-workflow install`).

## Affected files

| File | Change |
|---|---|
| `skills/_shared/scripts/ensure-context-store.ts` | **New** — auto-ensure CLI + exported pure helpers |
| `skills/_shared/scripts/ensure-context-store.test.ts` | **New** — branch + normalization coverage |
| `GLOBAL_OR_PROJECT-AGENTS.md` | Replace step-3 mkdir line with script call + fallback |
| `docs/howto/use-external-artifact-store.md` | **New** — mode table, sync options, committed surface |
| `docs/buck-workflow.md` | Short dual-mode subsection |
| `.context/2026-08-27.external-context-store/index.md` | One-line related-subject pointer |
| `.context/2026-09-12.pluggable-artifact-store/` | This plan; index updated |

## Implementation steps

1. **Helpers + slug.** In `ensure-context-store.ts`: `resolveOriginSlug(cwd)` — `git remote get-url origin`, normalize (strip `https://`/`ssh://`/`git@`, SCP `host:path` → `host/path`, trailing `.git`/`/`); return `null` when no origin. `isGitignored(cwd, ".context")` via `git check-ignore -q` (authoritative; includes global excludes — documented).
2. **Mode resolution + ensure.** `ensureContextStore(cwd)` implementing the 5-branch table. Safety invariants: never delete, never replace a real directory with a symlink, never mkdir a real `.context/` in external mode, write only inside the store or `.context` link itself. Dangling symlink → recreate store layout, keep the link. Symlink-but-no-longer-ignored → warn on stderr. Idempotent; `--json` output; exit 0 on success, nonzero on hard failure.
3. **Tests.** tmpdir/git-fixture coverage: all 5 branches; slug cases (https, SSH, SCP, `.git` suffix, no origin); run-twice idempotency; real-dir-never-replaced; dangling-symlink repair; warn path.
4. **Bootstrap swap.** `GLOBAL_OR_PROJECT-AGENTS.md` step 3 becomes: if `.context/` missing, run `bun <skills-dir>/_shared/scripts/ensure-context-store.ts`, falling back to `mkdir -p .context/memory` when the script/bun isn't available.
5. **Docs.** How-to (sync the store with Syncthing/iCloud/private git repo; what gets committed = the ignore line; solo-vs-team relationship to the Aug 27 design) + `docs/buck-workflow.md` dual-mode note + sibling index pointer.
6. **Gates.** Run `/b-guardrails-check` (durable v2: bun test, diff-scoped lint, patch ≥ 90%); resolve any verdict before completion.

## Acceptance criteria

- [x] Script implements the 5-branch mode table; each branch has a passing test.
- [x] Scratch repo with `.context` gitignored + origin: first run creates XDG store + symlink; second run is a no-op.
- [x] A pre-existing real `.context/` directory is never converted (test asserts).
- [x] No-origin repo → in-repo mkdir, exit 0.
- [x] Symlink present but ignore line removed → warning emitted.
- [x] Bootstrap references the script with a plain-mkdir fallback.
- [x] How-to + dual-mode doc sections exist; sibling subject cross-linked.
- [ ] `/b-guardrails-check` verdict: pass. Unit/patch/ratchet passed (patch 100%, coverage 77.2). Complexity gate fail is pre-existing (`parseModelResponse`, `runBSaveImproved`, `plan-artifact` helpers) — none of the session-touched files exceed CCN 10. Not in this plan's diff.

## Verification

1. `bun test skills/_shared/scripts/ensure-context-store.test.ts`
2. Manual: in a scratch clone (`.context/` in `.gitignore`, real origin), run the script; inspect the symlink and store layout; re-run for idempotency. Repeat with the ignore line removed and with no origin.
3. `/b-guardrails-check` structured verdict.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` (or `/b-build-hard` if ambiguity appears) against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings route to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted, leave a note in memory and resume from this plan next turn.

(OMP execution recommendation: none — active harness is not OMP. Follow-up after merge: re-run `buck-workflow install` to refresh installed bootstrap copies.)

## Risks

- `git check-ignore` honors global excludes — a user who globally ignores `.context` gets external mode without a project-level line. Accepted and documented; it still reflects "git won't commit it".
- Org/user rename or remote URL change orphans the old store dir (new slug on next ensure). Nested slug chosen for readability over rename-proof hashes; no migration in v1.
- Removing the ignore line while the symlink exists would commit the symlink (leaks the home path) — mitigated by the script's warn path; `b-commit` interception is out of scope.
- Hosts without bun keep old behavior via the fallback line; installed bootstraps only pick up the new step after an installer re-run.

## Light Grill

- Q1: Store slug format → deferred (no user answer); proceeding with recommendation: nested `host/org/repo` from normalized origin. Override by editing this plan before `/b-build`.
- Q2: No-`origin` fallback → deferred; recommendation adopted: in-repo mkdir.
- Q3: Missing + not gitignored → deferred; recommendation adopted: in-repo mkdir, no prompt.
