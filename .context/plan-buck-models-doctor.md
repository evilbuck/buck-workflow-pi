---
status: completed
date: 2026-09-25
subject: 2026-09-25.buck-models-doctor
topics: [buck-models, diagnostics, model-registry, extension-command]
research: []
iterations: []
memory: [buck-models-doctor-2026-09-30.md]
---

# Plan: Add `/buck-models --doctor`

## User Goal

Buck operators can run `/buck-models --doctor` to see whether every saved model is currently available before a mapped command fails.

## Goal

Add a read-only doctor mode to `/buck-models` that compares every model selected in project and user-global Buck profiles with the live OMP model registry, highlights the effective active profile, and presents a deterministic report in the command UI.

## Context used / assumptions

- User-provided context: add a `--doctor` flag that checks selected models against current availability and presents the result.
- User decision: audit all profiles in both config scopes; highlight the effective active profile.
- Session context: `/buck-models` already reads the live registry through `ctx.modelRegistry.getAvailable()`, edits project and user-global profiles, and warns about unavailable ids while saving.
- Code inspected: `extensions/buck-models/index.ts`, `extensions/buck-models/index.test.ts`, `extensions/omp-models.ts`, and `docs/howto/configure-buck-model-profiles.md`.
- Assumption: availability means exact `provider/id` membership in the live registry. The doctor does not probe provider credentials, quotas, network access, or model inference.
- Assumption: doctor output is read-only and uses the existing extension UI notification surface; it must not enter the editor flow.

## Scope

- Recognize the exact `--doctor` flag on `/buck-models`.
- Read both `<cwd>/.omp/config.yml` and `~/.omp/agent/config.yml`.
- Inventory every configured model occurrence across scope, profile, and Buck stage.
- Compare configured ids with `ctx.modelRegistry.getAvailable()` using exact `provider/id` matches.
- Identify and visibly mark the effective active profile using the same project-first, global-fallback, single-profile-default semantics as runtime routing.
- Present deterministic totals plus per-scope/profile/stage availability details.
- Report unreadable/invalid configuration or an unavailable registry as an error rather than claiming models are missing.
- Preserve the existing no-argument profile editor unchanged.

## Out of scope

- Editing, deleting, activating, or repairing profiles from doctor mode.
- Testing provider authentication, billing, rate limits, network connectivity, context windows, or actual inference.
- Changing runtime model-selection or Buck stage fallback semantics.
- Adding machine-readable JSON output or a standalone command.
- Treating unavailable saved ids as invalid configuration; portability across machines remains supported.

## Affected files

- `extensions/buck-models/index.ts` — parse command arguments, route doctor mode before interactive editing, and render the result.
- `extensions/buck-models/doctor.ts` — pure inventory, active-profile annotation, availability classification, sorting, and report formatting.
- `extensions/buck-models/doctor.test.ts` — unit coverage for cross-scope inventory, exact matching, active highlighting, ordering, and summary severity.
- `extensions/buck-models/index.test.ts` — command integration coverage proving `--doctor` reads both scopes, uses the live registry, presents output, and never prompts or writes.
- `docs/howto/configure-buck-model-profiles.md` — document the doctor invocation, report meaning, and observable success check.

## Implementation steps

1. Add strict argument routing in the `/buck-models` handler: blank arguments keep the current editor; exact `--doctor` invokes doctor mode; unsupported arguments return a usage error without prompting or writing.
2. Add a pure doctor module that accepts parsed project/global profile configs and a set of live registry ids, then emits a deterministic result containing counts, configured locations, availability, and active/effective annotations. Keep report construction separate from UI and filesystem access.
3. Resolve the effective active profile with runtime-equivalent precedence: nonblank project `active`, then nonblank global `active`, then the sole configured profile when exactly one exists. Surface blank or unknown active selections in the report instead of silently choosing another profile.
4. Load both config files for doctor mode with invalid-file awareness, normalize live registry entries to exact `provider/id` strings, and fail closed when the registry is absent. Missing config files are valid empty scopes.
5. Format one multiline UI report: summary counts first, effective active profile second, then stable scope/profile/stage rows marked available or unavailable. Use `info` when all configured ids are available, `warning` when any are unavailable or active selection is unhealthy, and `error` for invalid config or missing registry access.
6. Add focused pure and command-level tests, then update the Buck model profile how-to with `/buck-models --doctor` and its limits.

## Acceptance criteria

- [ ] `/buck-models --doctor` checks every configured model in project and user-global profiles against the command context's live model registry.
- [ ] The report identifies each checked model's scope, profile, and stage, and deterministically distinguishes available from unavailable exact ids.
- [ ] The report highlights the effective active profile and reports blank or unknown active selection without hiding other profile results.
- [ ] Repeated model ids remain traceable to every configured location; summary totals distinguish configured occurrences from unique ids.
- [ ] Doctor mode performs no profile picker calls, confirmations, or config writes.
- [ ] `/buck-models` with no arguments retains the existing interactive editor behavior.
- [ ] Unsupported arguments produce concise usage guidance and no side effects.
- [ ] Missing config files yield an empty-scope result; invalid config or missing registry access produces an error and never a false healthy report.
- [ ] Documentation states that availability is registry membership only, not a provider connectivity or inference test.

## Verification

- Run `npx vitest run extensions/buck-models/doctor.test.ts extensions/buck-models/index.test.ts --reporter=dot`.
- Run the repository guardrails contract with `npm run guardrails:check` after the complete edit batch.
- Smoke-test the actual extension command in OMP with a fixture containing one available and one unavailable id across project/global scopes; observe the active marker, both classifications, and unchanged config file checksums before and after `/buck-models --doctor`.
- Run `/buck-models` without arguments and confirm the existing scope picker still opens.

## Risks

- Active-profile logic could drift from runtime routing. Mitigation: encode the existing precedence explicitly and test parity cases (project active, global fallback, sole-profile default, blank/unknown active).
- Large profile sets may produce a long notification. Keep ordering stable and summary-first; do not hide unavailable rows.
- Registry absence can look like every model is unavailable. Treat unavailable registry access as an error before classification.
- Existing in-flight `/buck-models` changes are present in the working tree. Build work must preserve and integrate with them rather than replacing the editor implementation.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact for in-plan issues, run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` cycle. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, plan status, and review artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted, record the current plan or iterate artifact in session memory and resume from it.
