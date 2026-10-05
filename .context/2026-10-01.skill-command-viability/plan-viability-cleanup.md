---
status: active
date: 2026-10-01
subject: 2026-10-01.skill-command-viability
topics: [skills, commands, viability, cleanup]
research: [research-low-viability.md]
iterations: []
memory: []
---

# Plan: Viability cleanup checklist

## User Goal

The maintainer can walk one checklist, change any recommendation in place, and apply or skip each item without losing track of what was decided.

Synthesized from the request to walk through and update the list. Edit this section if that is not the goal.

## Goal

Turn the Jev viability ranking into a bounded, reversible catalog cleanup the operator drives one todo at a time.

D1, F1–F3, G1, and M1–M3 are phased in [plan-viability-cleanup-phases.md](plan-viability-cleanup-phases.md). X1–X3 stay on this checklist and are not phased.

## Context used / assumptions

- User-provided context: walk-through todo list they can update, based on the audit and the recommendations.
- Session context: Jev `jev-1.13.0` scores, jq 1.8.2 mention counts (245 sessions, 670 user messages), prior audit `01a0c3e1` that found the clusters and did not collapse them.
- Artifacts used: `research-low-viability.md`.
- Buck capability: full. Probe source: system available-skills catalog. Sentinels `b-build`, `b-review`, `b-save` present.
- This plan is one checklist on purpose. It exceeds the `b-phase` step-count threshold. Do not phase it unless the operator asks.

## Decision Closure

Selected course: one operator checklist. Each todo starts at `recommended`. The operator sets `Status` before doing the work. Nothing in this plan is applied until that edit. Deletes are one commit each so `git revert <sha>` is the rollback.

Evidence: viability research in this subject; catalog rows in `README.md` and `docs/buck-workflow.md`; `commands/` are symlinks to `prompts/`; `plugins/buck-workflow/skills/` is a physical Codex copy pinned by `scripts/codex-plugin.test.ts`; `skills/design-brief/` is not `skills/_shared/design-brief.jsonc`.

Excluded scope: `b-build-hard`, `b-grill-me`, `b-grill-with-docs`, `b-grill-auto` (until G1 is done), `thought-dump-writer`, `pi-rpc`, `skill-explainer`, `extensions/b-kamal-release` unless X2 is set to `do`, and any rewrite of the shared design-language JSONC.

Next action: edit statuses, then do the first todo whose status is `do`.

## Assumptions Ledger

| id | statement | status | blocking | evidence or validation_path |
|---|---|---|---|---|
| A-1 | `skills/design-brief/` is a skill, not the design-language file `skills/_shared/design-brief.jsonc` | validated | false | Separate paths. F1 forbids deleting the JSONC. |
| A-2 | A prompt delete that leaves `commands/<name>.md` fails `scripts/commands-mirror.test.ts` | validated | false | Docs and the 43/43 symlink inventory. D1 deletes both sides together. |
| A-3 | Move-out todos have no destination yet | deferred | false | Operator writes `Destination:` on M1–M3 before setting Status to `do`. Until then those todos stay `recommended`. |
| A-4 | `/b-kamal-release` is not a confirmed delete | deferred | false | Jev fit 0.88, confidence 0.27. X2 stays `keep` until the operator changes it. |

## Material Risks

- failure_mode: F1 deletes `skills/_shared/design-brief.jsonc` along with the skill.
  impact: blueprint and present HTML lose their token source.
  mitigation: F1 names the forbidden path and checks the file still exists.
  rollback_or_fallback: `git revert` of the F1 commit.
  validation_path: after F1, `test -f skills/_shared/design-brief.jsonc` and `npx vitest run skills/_shared/scripts/design-language.test.ts`.

- failure_mode: D1 deletes `prompts/omp-goal.md` before the 6-step completion-audit text is copied into `docs/buck-workflow.md`.
  impact: `b-review` loses the only write-up of that protocol (`docs/buck-workflow.md` currently points at the prompt).
  mitigation: D1 copies the protocol into the doc, then deletes the slash surface.
  rollback_or_fallback: `git revert` of the D1 commit.
  validation_path: `rg -n "6-step completion-audit" docs/buck-workflow.md` returns a hit that is not only a link to `prompts/omp-goal.md`.

- failure_mode: F3 deletes `crawl4ai` while `skills/b-research/SKILL.md` still says to invoke it.
  impact: research runs follow a missing skill.
  mitigation: same todo updates `b-research` first.
  rollback_or_fallback: `git revert` of the F3 commit.
  validation_path: `rg -n "skills/crawl4ai" skills/b-research/SKILL.md` returns no hit.

## Scope

Catalog surfaces the ranking marked under 0.45, except the intentional alias `/b-build-hard`. Each applied todo updates its README and `docs/buck-workflow.md` rows and the Codex bundle when that skill is in `scripts/codex-plugin.test.ts`.

## Out of scope

- Phasing this checklist.
- Rewriting grill procedure text, empty headings in `b-grill-me`, or `grill.py` behavior.
- Deleting `b-grill-with-docs`, `b-grill-me`, or `/b-build-hard`.
- Touching `extensions/b-kamal-release/` unless X2 is explicitly `do`.
- `product-tour` removal. It was only partially scored.

## Affected files

Touched only by the todo that names them:

- `prompts/omp-{goal,orchestrate,workflow}.md` and their `commands/` symlinks
- `skills/design-brief/`, `plugins/buck-workflow/skills/design-brief/`
- `skills/cross-platform-pi-omp-loading/slash-command-mirror/`
- `skills/crawl4ai/`, `plugins/buck-workflow/skills/crawl4ai/`, `skills/b-research/SKILL.md`
- `skills/b-grill/`, `plugins/buck-workflow/skills/b-grill/`
- `skills/rails-app/`, `skills/llm-wiki-vault/`, `skills/cross-platform-pi-omp-loading/`
- `skills/manage-herdr-panes/`, `prompts/b-kamal-release.md`, `prompts/product-tour.md` only if an X todo is set to `do`
- `README.md`, `docs/buck-workflow.md`, `scripts/codex-plugin.test.ts`, `AGENTS.md` (llm-wiki paragraph only, on M2)

## How to update this list

Edit the todo. Do not renumber ids.

| Status | Meaning |
|---|---|
| `recommended` | Default from the audit. Not started. |
| `do` | Operator accepted the recommendation. Safe to apply. |
| `keep` | Operator rejected the recommendation. Leave the surface. |
| `skip` | Not this pass. |
| `done` | Applied and the done-when check passed. Check the box. |

One `done` todo per commit. Do not batch deletes.

## Implementation steps

### Docs that pretend to be commands

- [x] **D1** Status: `done`
  - Action: stop shipping `/omp-goal`, `/omp-orchestrate`, and `/omp-workflow` as slash commands. Copy the goal-mode 6-step protocol and the harness no-op notes into `docs/buck-workflow.md` first. Then delete `prompts/omp-goal.md`, `prompts/omp-orchestrate.md`, `prompts/omp-workflow.md` and the matching `commands/` symlinks.
  - Why: writing scores 0.06 and 0.10, confidence 0.92–0.95. The bodies both enter a mode and say they cannot.
  - Done when: those six paths are gone; `npx vitest run scripts/commands-mirror.test.ts` passes; the protocol grep in R1's sibling risk (the omp-goal validation path above) hits the doc.
  - Verified 2026-10-03: all six prompt/command paths are absent, including dangling symlinks; `docs/buck-workflow.md:138-158` preserves the 6-step completion-audit and completion evidence rule; `npx vitest run scripts/commands-mirror.test.ts` passed all 4 tests. Save and commit remain separate checkpoints.

### Fold a duplicate into the sibling that stays

- [ ] **F1** Status: `recommended`
  - Action: delete `skills/design-brief/` and `plugins/buck-workflow/skills/design-brief/`. Point any "make a UI brief" instruction at `b-create-ux-guide`. Remove `design-brief` from `scripts/codex-plugin.test.ts` `canonicalCopies`.
  - Do not touch: `skills/_shared/design-brief.jsonc`, `skills/_shared/themes/**/design-brief.jsonc`, or the design-language tests.
  - Why: distinct 0.10, confidence 0.92.
  - Done when: skill dirs are gone, JSONC file still exists, `npx vitest run scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts` passes.

- [ ] **F2** Status: `recommended`
  - Action: move any unique symlink steps from `skills/cross-platform-pi-omp-loading/slash-command-mirror/SKILL.md` into the parent `SKILL.md`, then delete the child directory. Update the parent link and `docs/buck-workflow.md` line that cites the child path.
  - Why: distinct 0.65, fit 1.08, 0 mentions.
  - Done when: the child directory is gone and the parent still states the `prompts/` ↔ `commands/` symlink rule.

- [ ] **F3** Status: `recommended`
  - Action: fold the install/bootstrap section of `skills/crawl4ai/SKILL.md` into `skills/b-research/SKILL.md` as a short optional paragraph. Delete `skills/crawl4ai/` and `plugins/buck-workflow/skills/crawl4ai/`. Remove `crawl4ai` from the Codex allowlist.
  - Why: fit 1.26, confidence 0.78. It is third-party CLI notes.
  - Done when: `rg -n "skills/crawl4ai" skills/b-research` is empty, and the Codex test passes.

### Delete the grill shell, keep the commands

- [ ] **G1** Status: `recommended`
  - Action: delete `skills/b-grill/` and `plugins/buck-workflow/skills/b-grill/`. Remove `b-grill` from the Codex allowlist. Repoint README and `docs/buck-workflow.md` grill rows to `b-grill-me`, `b-grill-auto`, and `b-grill-with-docs`.
  - Precondition: `cmp skills/b-grill/grill.py skills/b-grill-auto/grill.py`. If they differ, stop and set Status back to `recommended` with a note. Do not delete unique shell behavior blindly.
  - Keep: `b-grill-me`, `b-grill-with-docs`, `b-grill-auto`, and `skills/b-grill-with-docs/ADR-FORMAT.md` plus `CONTEXT-FORMAT.md` (`b-docs` cites those paths).
  - Why: distinct 0.85, 0 mentions, no prompt. `b-grill-with-docs` owns the extra contract (distinct 1.99, confidence 0.99).
  - Done when: `skills/b-grill/` is gone, the two format files remain, Codex test passes.

### Move out of the portable package

Do not set these to `do` until `Destination:` is filled (A-3).

- [ ] **M1** Status: `recommended` Destination:
  - Action: move `skills/rails-app/` to the destination. Drop the README row.
  - Why: fit 0.33, 0 mentions. One app's footguns.
  - Done when: the skill is not under this repo's `skills/` and the destination has the file.

- [ ] **M2** Status: `recommended` Destination:
  - Action: move `skills/llm-wiki-vault/` to the destination. Drop the README row and the `AGENTS.md` vault-wiki paragraph.
  - Why: distinct 3.72, fit 0.21, confidence 0.82. Unique job, wrong package.
  - Done when: this repo no longer contains the skill or the AGENTS.md advertisement.

- [ ] **M3** Status: `recommended` Destination: `docs/cross-platform-pi-omp-loading.md`
  - Action: move the parent skill body (after F2) to that doc. Delete the skill directory. Update docs that link the skill path.
  - Why: fit 1.00, confidence 1.00. Maintainer meta.
  - Depends on: F2 `done` or `skip`.
  - Done when: no `skills/cross-platform-pi-omp-loading/` directory, and the doc exists.

### Decide, do not apply the default

- [ ] **X1** Status: `keep` Destination:
  - Surface: `manage-herdr-panes`. Viability 0.47, just above the cutoff. Real cookbook, `HERDR_ENV=1` gate, wrong package.
  - Change Status to `do` and fill Destination only if it should leave this repo.

- [ ] **X2** Status: `keep`
  - Surface: `/b-kamal-release` plus `extensions/b-kamal-release/`. Fit confidence 0.27. One mention. Wired in `extensions/index.ts`.
  - Leave it. Set Status to `do` only with a written destination and a note that the extension wire must be removed in the same commit.

- [ ] **X3** Status: `keep`
  - Surface: `product-tour`. Partially scored (fit 1.99 only). Unused here, not a duplicate.
  - Leave it.

## Acceptance criteria

- [ ] Every todo is `keep`, `skip`, or `done`. None left at `recommended` or `do`.
- [ ] Each `done` todo has its done-when check recorded as passed in the todo body.
- [ ] `skills/_shared/design-brief.jsonc` still exists.
- [ ] `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passes after the last `done` todo that touches those surfaces.
- [ ] README and `docs/buck-workflow.md` do not name a skill or command this plan deleted.

## Verification

Per todo, the done-when line is the check. After the last applied todo, run:

```bash
npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts
rg -n "skills/design-brief/|skills/b-grill/SKILL|skills/crawl4ai|prompts/omp-goal|prompts/omp-orchestrate|prompts/omp-workflow" README.md docs/buck-workflow.md
```

The `rg` must not hit a path this plan deleted. Hits for `b-grill-me`, `b-grill-with-docs`, and `design-brief.jsonc` are expected.

## Execution Instructions

Walk this list yourself. Recommended OMP mode: none. The workflow table would say `workflow` because this is a migrate/sweep; ignore that unless you explicitly want agents to execute todos you have already set to `do`.

1. Set Status on the todos you accept or reject.
2. Apply one `do` todo, run its done-when check, set `done`, commit.
3. Do not run `/b-build` across the whole plan. The decisions are yours.

## Risks

- A half-updated README row points at a deleted skill. Each todo owns its rows so a stopped walk stays consistent for `done` items only.
- G1 `cmp` fails because the two `grill.py` files differ. Stop. That is not a license to merge them inside this plan.
