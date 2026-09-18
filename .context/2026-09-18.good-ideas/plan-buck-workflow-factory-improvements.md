---
status: active
date: 2026-09-18
subject: 2026-09-18.good-ideas
topics: [software-factory, workflow-integrity, guardrails, skill-catalog, installer, codex, hooks]
research: []
iterations: []
spec:
memory: [good-ideas-plan-2026-09-18.md]
---

# Plan: Harden Buck Workflow integrity and enforcement

## User Goal

Buck Workflow users and maintainers can trust that installed skills, mirrored distribution surfaces, and declared quality gates match their documented contract and fail automatically when a required invariant is broken.

## Goal

Turn the five Buck Workflow recommendations in the software-factory comparison into a current-checkout implementation plan. Adopt the underlying mechanisms where evidence supports them, correct stale counts and assumptions, and reject the literal changes that would break Buck Workflow’s portability or packaging contracts.

## Context used / assumptions

- **User-provided context:** `../software-factory-comparison.html`, especially `#cross-pollination` (“What each should steal from the others”).
- **Capability probe:** full Buck Workflow mode; `b-build`, `b-review`, and `b-save` are present in the system available-skills catalog.
- **Validation method:** five parallel read-only scouts independently checked the current checkout for guardrail promotion, hook/security-audit wiring, Codex bundle drift, installer/mirror/PATH integrity, and skill frontmatter/test discovery.
- **Canonical surfaces:** root `skills/` is the canonical general skill tree; `plugins/buck-workflow/skills/` is a deliberately curated, self-contained Codex release bundle; `prompts/` is the intended command source of truth once the existing mirror-drift item is completed.
- **Guardrail baseline:** the v2 contract exposes six verdict gates, not five. Brownfield staging already exists implicitly through skipped/advisory results and ratchets; explicit enforcement states and a machine runner do not.
- **Hook posture:** hook installation is opt-in and repository-local. It must preserve or safely refuse around existing hooks; package installation must never silently replace `core.hooksPath`.
- **Existing work:** `.context/backlog/items/commands-mirror-drift.md` owns command content/symlink remediation. `.context/2026-09-09.installer-source-integrity/plan-installer-source-integrity.md` already owns installer source-root diagnostics. `.context/2026-09-16.decision-closure/phase-5-narrative-and-proof.md` owns syncing the specific Codex skills changed by that work, not a general bundle-parity invariant.
- **Repository state:** `.context/backlog/todo.md` is already unmerged (`UU`). This plan creates the backing backlog item but does not edit or resolve that unrelated conflict.

## Validated recommendation matrix

| Report recommendation | Current-checkout verdict | Plan decision | Priority |
|---|---|---|---|
| Required-versus-optional gates with staged promotion | **Adapt.** There are six gates and partial staging already exists. CI runs `npm test` only; no deterministic non-agent runner executes the full contract. | Add explicit `required` / `advisory` / `disabled` enforcement states, extract one deterministic verdict engine, and invoke it from the skill and PR CI. Preserve ratchet semantics. | P1 |
| A hooks path invoking `scripts/security-audit.sh` | **Adapt.** The 696-line scanner is real and unwired, but it scans all tracked files and normally all history. Blind `core.hooksPath` replacement would disable other tooling. | Add an explicit install/status/remove hook flow and a pre-push launcher. Preserve/chains existing hooks or fail safely. Select and document the audit profile before enabling. | P2 |
| Replace `plugins/buck-workflow/skills/` with a symlink | **Reject literally; adapt the goal.** The report counts are stale. The physical 30-skill Codex bundle is intentional and includes two Codex-only skills. | Keep the self-contained directory. Add a declared curated inventory plus recursive path/byte parity for canonical copies, with explicit Codex-only exceptions. | P0 |
| Zero-drift allowlist and real PATH probe | **Adapt.** Installer source-root verification already exists and the reported 53/55 split no longer reproduces. Command mirror drift and login-shell package discovery remain unguarded. | After the existing mirror item establishes the final set, enforce an exact prompt-to-command symlink mirror. Add a hermetic packed-package login-shell PATH smoke test. Do not add a second skill allowlist. | P0/P1 |
| Frontmatter and test-wiring sweep | **Adopt narrowly.** Exactly one of 64 direct root skills lacks frontmatter: `skills/code-review/SKILL.md`. Its seven `pr-ref` tests are already discovered and pass, so the exclusion claim is stale. | Repair that frontmatter and add a direct-root skill catalog invariant to the existing Vitest/CI path. Do not conflate root catalog validation with the Codex bundle. | P0 |

## Scope

1. Repair and mechanically validate direct root-skill metadata.
2. Validate the curated Codex bundle against canonical sources without converting it to a symlink.
3. Finish the existing command-mirror decision, then enforce it and prove the published CLI is discoverable in an isolated login shell.
4. Make guardrail enforcement states explicit, move verdict computation into one deterministic executable, and trigger required gates in pull-request CI.
5. Expose the existing security audit through an opt-in, coexistence-safe pre-push hook flow.
6. Update only the living documentation and managed agent block whose contracts change.

## Out of scope

- Replacing the Codex bundle with a directory symlink or exposing all canonical skills through the plugin.
- Reopening the completed guardrails-initialization item or fixing existing patch-coverage and complexity debt inside this plan.
- Adding new gate categories, selecting a new linter, or creating a general CI platform abstraction.
- Re-deciding the eight current `commands/` exceptions inside this plan; the existing mirror-drift item owns that migration.
- Automatically modifying Git hooks during the normal Buck Workflow package/harness install.
- Rewriting `scripts/security-audit.sh` into a staged-diff scanner unless hook smoke evidence proves the existing profiles unusable.
- Reviving `extensions/b-flow` or addressing other report findings outside `#cross-pollination`.

## Affected files

### Definite

- `skills/code-review/SKILL.md`
- `scripts/skill-frontmatter.test.ts` (new)
- `scripts/codex-plugin.test.ts`
- `scripts/install.test.mjs`
- `skills/b-guardrails-check/scripts/check.mjs` (new deterministic verdict engine)
- `skills/b-guardrails-check/scripts/check.test.ts` (new)
- `skills/b-guardrails-check/SKILL.md`
- `skills/b-guardrails-check/docs/contract-resolution.md`
- `skills/b-init-guardrails/SKILL.md`
- `skills/b-init-guardrails/docs/ratchet-protocol.md`
- `skills/b-init-guardrails/docs/agents-block.md`
- `guardrails.json`
- `package.json`
- `.github/workflows/test.yml`
- `AGENTS.md` managed guardrails block
- `scripts/hooks.mjs` (new hook install/status/remove module)
- `scripts/hooks.test.mjs` (new)
- `scripts/hooks/pre-push` (new managed launcher)
- `scripts/install.mjs` (CLI dispatch only)

### Conditional

- `plugins/buck-workflow/skills/**` — only copies declared by the curated inventory; content changes remain owned by their originating work.
- `plugins/buck-workflow/README.md` — only if the bundle-sync maintenance contract changes.
- `scripts/security-audit.sh` — only if the selected pre-push profile needs a missing noninteractive option; otherwise unchanged.
- `README.md`, `agent-install_instructions.md`, and `docs/buck-workflow.md` — hook enable/disable and guardrail-promotion behavior after implementation review confirms documentation impact.
- `.context/backlog/items/commands-mirror-drift.md` — referenced as a prerequisite, not rewritten by this plan.

## Implementation steps

### 1. Establish catalog invariants first (P0)

1. Add top-of-file YAML frontmatter to `skills/code-review/SKILL.md` with `name: code-review` and a nonempty description derived from the existing purpose.
2. Add `scripts/skill-frontmatter.test.ts` over literal direct `skills/*/SKILL.md` files. Assert opening/closing delimiters, nonempty `name` and `description`, directory/name equality, duplicate-name absence, and support for existing block-scalar descriptions.
3. Extend `scripts/codex-plugin.test.ts` with one curated bundle specification classifying each bundled skill as canonical-copy or Codex-only.
4. For canonical copies, compare recursive path sets and bytes with `skills/<name>/`. Assert the bundle directory set exactly equals the declared inventory. Explicitly classify `b-build-hard` and `b-commit` as Codex-only.
5. Keep `plugins/buck-workflow/.codex-plugin/plugin.json` on `./skills/` and keep the bundle physical/self-contained.

### 2. Close distribution and install gaps (P0/P1)

1. Complete or consume `.context/backlog/items/commands-mirror-drift.md` so the command surface has one approved contract. Do not encode the current historical count.
2. Add a repository invariant deriving names from `prompts/`: every prompt has a `commands/<name>.md` symlink resolving to that prompt; `commands/` contains no undeclared extras or physical-file twins except any explicitly retained, documented exception from the prerequisite decision.
3. Keep `scripts/install.mjs --verify` as the operational mixed-checkout diagnostic; do not introduce another source-root verifier.
4. Extend installer/package tests to run `npm pack`, install into an isolated temporary npm prefix, deliberately place that prefix’s bin directory on PATH, and launch `buck-workflow --list` by bare command name through `bash -lc`.
5. Keep the test hermetic: no user dotfile edits, no dependence on the workstation’s permanent PATH, and no hard-coded skill/command counts.

### 3. Promote guardrails through one executable contract (P1)

1. Add explicit enforcement state per existing verdict gate: `required`, `advisory`, or `disabled`. Separate enforcement state from measurement semantics such as ratchet baselines and “new/worsened only” complexity checks.
2. Initialize current behavior without surprise: unit/global-ratchet required; absent functional/lint disabled; lint advisory until a clean baseline; complexity required for new/worsened violations only; patch coverage advisory until its existing backlog debt and CI compare-base/artifact behavior are reproducible.
3. Move verdict computation into `skills/b-guardrails-check/scripts/check.mjs`. The script reads `guardrails.json`, runs configured commands without a shell-injection surface, emits the existing structured verdict shape, and exits nonzero only when a required gate fails.
4. Make `b-guardrails-check` invoke/interpret that runner rather than duplicating result logic in prose. Keep contract resolution and no-contract diagnostics in the skill.
5. Update `b-init-guardrails`, the ratchet protocol, generated managed block, repository `AGENTS.md`, and the current `guardrails.json` together as one schema cutover. Promotion must be explicit and monotonic; demotion or baseline weakening requires recorded approval.
6. Add a dedicated package script and PR workflow step invoking the deterministic runner after provisioning/pinning Lizard and diff-cover. Keep the existing unit-test job.
7. Promote advisory gates only after the same command is green in a clean CI environment. Existing patch/complexity remediation remains separate work.

### 4. Add opt-in pre-push security enforcement (P2)

1. Add explicit `hooks install`, `hooks status`, and `hooks remove` CLI paths backed by a focused hooks module; normal install does not configure hooks.
2. Resolve the actual hooks directory for the named repository. If a pre-existing `core.hooksPath` or `pre-push` hook cannot be safely chained and restored, fail with actionable diagnostics rather than overwrite it.
3. Install a managed pre-push launcher that resolves the shipped `scripts/security-audit.sh` from the durable Buck Workflow checkout/package location and propagates exits 0/1/2 unchanged.
4. Benchmark and select a fixed profile before enabling: full-history default preserves the existing audit contract but may be slow; `--skip-history` reduces coverage. Document the selected profile and offer the other as an explicit option rather than silently weakening checks.
5. Test install/reinstall/status/remove and coexistence in disposable repositories with no hook, a legacy `.git/hooks/pre-push`, and an existing `core.hooksPath`.
6. Smoke-push to a local bare remote with clean content and a seeded detectable secret. Confirm the clean push succeeds, the finding blocks, and removal restores prior behavior.

### 5. Integrate documentation and release proof

1. Update plugin maintenance wording only if the new parity specification changes the manual sync process.
2. Document the guardrail state/promotion model and deterministic CI command in the guardrail skill docs and generated managed block.
3. Document hook enable/status/remove, coexistence guarantees, audit profile, expected latency, and exit behavior.
4. Run `b-review`; treat any changed domain language or conventions as `b-docs` input, then close with `b-save` and `b-commit` once the pre-existing backlog conflict is resolved.

## Acceptance criteria

- [x] Every direct `skills/*/SKILL.md` has valid opening frontmatter, a nonempty description, a unique name, and a name matching its directory; `skills/code-review/SKILL.md` is discoverable.
- [x] Root catalog validation is selected by the existing Vitest/`npm test` path, while the already-discovered `skills/code-review/scripts/pr-ref.test.ts` remains passing.
- [x] The Codex bundle remains a physical, self-contained curated surface; canonical-copy entries have recursive path/byte parity and only explicitly classified Codex-only entries diverge.
- [x] The approved prompt/command mirror contract has a deterministic drift test derived from the canonical tree, not from historical counts.
- [x] A packed Buck Workflow installation is discoverable and runnable by bare command name in a hermetic login-shell test.
- [x] The six existing guardrail verdict gates each have an explicit enforcement state without changing their names or ratchet meaning.
- [x] One deterministic runner is the verdict source for both `b-guardrails-check` and pull-request CI; required failure exits nonzero, advisory/disabled results do not.
- [x] CI provisions every required external measurement tool and proves the configured compare base and coverage artifact exist before patch coverage can be promoted.
- [x] Hook setup is explicit, repository-scoped, idempotent, removable, and never silently disables an existing hook path or hook file.
- [x] The pre-push launcher resolves the shipped audit script, documents its profile, preserves exit semantics, allows a clean local push, and blocks a seeded finding.
- [x] No implementation encodes the report's stale 5-gate, 53/55-symlink, 8-of-28-drift, or excluded-test counts as contracts.

## Verification

- `npx vitest run scripts/skill-frontmatter.test.ts scripts/codex-plugin.test.ts`
- Mutation checks: malformed skill metadata, changed bundled byte, undeclared bundle directory, missing/wrong command symlink.
- Focused isolated-package test in `scripts/install.test.mjs`, including `bash -lc 'command -v buck-workflow && buck-workflow --list'` with only the temporary prefix added to PATH.
- Guardrail runner contract tests for required failure, advisory failure, disabled/null command, coverage regression, unchanged baseline hotspot, and new complexity violation.
- Run the new guardrail package command locally and in `.github/workflows/test.yml`; compare its gate names/statuses with the documented `b-guardrails-check` verdict.
- Run `npx vitest run skills/code-review/scripts/pr-ref.test.ts` to retain the already-confirmed seven-test coverage.
- Hook tests in disposable repositories plus a smoke push to a local bare remote for exits 0, 1, and 2.
- `npm test` as the existing CI-equivalent suite.
- `/b-guardrails-check` at the coherent completion point; a failing required gate blocks completion.

## Execution Instructions

Current recommendation: **`workflow`**, not yet enabled. The plan is a cross-cutting audit/sweep across four independent surfaces and benefits from per-workstream review fan-out and a final synthesis barrier. Run `/b-phase` first because the plan spans catalog integrity, distribution integrity, guardrail enforcement, and hook integration; re-evaluate whether the resulting hard dependencies warrant `orchestrate`. Do not create an OMP eval cell or stamp `omp_execution` until the user confirms the execution mode.

## Risks

- A literal Codex bundle symlink would break the self-contained release contract and expose unintended skills; the plan explicitly rejects it.
- A new runner can create two guardrail implementations if the skill retains independent verdict logic. The executable must become the single computation source.
- Lizard and diff-cover currently resolve from the workstation PATH, not package dependencies; CI enforcement is false confidence until versions and installation are reproducible.
- Immediate patch-gate promotion can block unrelated PRs because current patch-coverage debt is already tracked. Start advisory and promote after clean CI proof.
- Hook installation can disable other tools or add unacceptable push latency. Opt-in installation, safe coexistence/refusal, removal, and profile disclosure are required.
- The existing unmerged `.context/backlog/todo.md` prevents safe queue registration and committing this plan. Do not resolve that unrelated conflict as part of this work.
