---
status: active
date: 2026-06-13
subject: 2026-06-13.context-format-research
topics: [context-format, hybrid-model, markdown, json, jq, validation]
research: [research-context-format.md]
iterations: []
spec: null
memory: [hybrid-context-artifact-model-build-2026-06-13.md]
---

# Plan: Hybrid Context Artifact Model

## User Goal
As the Buck workflow maintainer, I want durable context artifacts to stay rich and navigable for agents while also exposing explicit machine-queryable indexes, so future sessions can inspect, validate, and resume work without losing narrative context or forcing a repo-wide format migration.

## Goal
Implement the first slice of a hybrid `.context/` model: keep Markdown as the source of truth for narrative artifacts, add strict validation for their frontmatter contracts, and generate compact JSON indexes that make common queries trivial with `jq`.

## Context used / assumptions
- User question evolved from format choice (`Markdown` vs `JSONC`) into a design question about a hybrid model.
- Research in `research-context-format.md` found that Markdown already has useful live semantic tooling in this workspace via Marksman, while JSON currently has no active LSP here.
- Prototype JSON files proved that `jq` becomes dramatically easier once artifacts are represented as JSON, but also showed that faithfully preserving research/memory semantics requires a custom document schema.
- Existing repo code already relies on lightweight frontmatter parsing patterns rather than a full YAML dependency (`extensions/b-flow/reconciliation.ts`, `extensions/b-flow/verify-result.ts`, `extensions/index.ts`).
- Assumption: the first implementation slice should avoid converting canonical artifact files away from Markdown. The deliverable is tooling and policy, not a migration.

## Scope
In scope:
- Define explicit frontmatter contracts for the main Markdown artifact classes:
  - memory files
  - subject `index.md`
  - `research-*.md`
  - `plan-*.md`
  - backlog item files
- Add a scriptable scanner over `.context/**` Markdown artifacts.
- Generate compact JSON indexes under `.context/index/` for machine queries.
- Add validation that reports missing/invalid frontmatter fields per artifact class.
- Add tests covering both index generation and validation.
- Document the hybrid contract and the intended usage (`Markdown` source, generated `JSON` query views).

Out of scope:
- Rewriting existing memory/research/plan artifacts to JSON.
- Standardizing on JSONC anywhere in `.context/`.
- Adding a JSON language server or editor integration.
- Changing session/grill state storage, which already belongs in JSON.
- Full-text indexing, semantic search, or graph-database export.

## Affected files
| File | Change |
|---|---|
| `scripts/context-artifacts.mjs` | New shared implementation for scanning `.context/`, parsing frontmatter, validating artifact contracts, and generating JSON indexes. |
| `scripts/context-artifacts.test.mjs` | New Vitest coverage for representative Markdown fixtures, schema violations, and generated JSON views. |
| `package.json` | Add npm scripts for index generation and validation (for example `context:index` and `context:validate`). |
| `README.md` | Briefly document the hybrid model and how to run/query the generated indexes. |
| `docs/` (new or existing focused doc) | Add a concise contract doc for artifact classes, generated indexes, and regeneration rules. |
| `.context/index/` | New generated JSON outputs (`subjects.json`, `memory.json`, `backlog.json`, optionally `artifacts.json`). |
| `.context/2026-06-13.context-format-research/research-context-format.md` | Research already complete; cross-reference only. |

## Implementation steps
1. Create `scripts/context-artifacts.mjs` as the single implementation module. Export pure helpers for:
   - scanning `.context/` artifact paths
   - parsing frontmatter fields used by Buck
   - classifying artifact kind from path/name
   - validating required fields and enums
   - building JSON index payloads
2. Keep parsing intentionally narrow and boring. Reuse the repo's existing lightweight frontmatter style instead of adding a YAML parser dependency unless a concrete schema need proves the handwritten parser insufficient.
3. Define per-artifact validation rules for the current Buck contracts:
   - memory: `date`, `domains`, `topics`, `related`, `priority`, `status`
   - subject index: `status`, `date`, `subject`
   - research: `status`, `date`, `subject`, `topics`, `informs`
   - plan: `status`, `date`, `subject`, `topics`, `research`, `memory`
   - backlog item: `title`, `status`, `priority`, `created`, `updated`, `completed`, `related`
4. Implement JSON index generation under `.context/index/` with compact, stable shapes:
   - `subjects.json` — one row per subject folder
   - `memory.json` — one row per memory file
   - `backlog.json` — active/completed backlog item summaries
   - `artifacts.json` (optional but likely useful) — normalized cross-artifact registry keyed by path/kind/subject
5. Add CLI entry points through npm scripts:
   - `npm run context:index` → regenerate JSON indexes
   - `npm run context:validate` → report schema violations and exit non-zero on failure
   If ergonomically cleaner, use one script with subcommands rather than multiple files.
6. Add `scripts/context-artifacts.test.mjs` with fixture coverage for:
   - valid memory/research/plan/index/backlog examples
   - missing required keys
   - bad enum values (`priority`, `status`)
   - index generation preserving subject and related-artifact linkage
7. Document the hybrid contract in repo docs:
   - Markdown is canonical for narrative artifacts
   - JSON is canonical for machine-owned state and generated query views
   - generated `.context/index/*.json` files are rebuildable artifacts, not hand-edited source
8. Verify manually against the real repo `.context/` tree:
   - generate indexes
   - run example `jq` queries for active subjects, latest memory by topic, and open backlog items
   - confirm validator output is empty or intentionally reports legacy drift to fix later

## Verification
- `npm test -- scripts/context-artifacts.test.mjs` or the repo's equivalent targeted Vitest invocation passes.
- `npm run context:validate` exits 0 on the normalized fixture set and on the repo tree once any intended legacy exceptions are handled.
- `npm run context:index` regenerates `.context/index/*.json` deterministically.
- Manual query checks succeed, for example:
  - active subjects by status
  - latest memory entries by topic/date
  - backlog items by `status` and `subject`
- No narrative Markdown artifact needs manual duplication into JSON for the query path to work.

## Ralph Instructions

<!-- OMP opt-in: this plan is recommended to run under goal mode. One persistent objective, bounded file set, and no natural phase boundary. -->

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit:
1. If using OMP goal mode, start with `/goal set` using this plan and an `omp_goal_budget` hint of `12k`.
2. Run `/b-build` against this plan.
3. Run `/b-review` against this plan.
4. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
5. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
6. Run `/b-commit` to checkpoint durable state before `ralph_done`.
7. If interrupted, resume from this active plan or the newest iterate artifact.

## Risks
- **R1 — Frontmatter parser drift**: the repo already has multiple lightweight parsers with slightly different assumptions. A new implementation could encode yet another variant. *Mitigation*: keep one shared parser module for the hybrid tooling and use representative real artifacts as fixtures.
- **R2 — Legacy artifact variance**: older `.context/` files may not satisfy the stricter contracts immediately. *Mitigation*: distinguish `error` (invalid current contract) from `warn` (legacy-but-readable), and decide whether to backfill in a follow-up.
- **R3 — Generated index churn**: committing `.context/index/*.json` may create noisy diffs if key order or output order is unstable. *Mitigation*: sort rows and object keys deterministically.
- **R4 — Scope creep into migration**: once indexes exist, it will be tempting to convert canonical Markdown files to JSON too. *Mitigation*: hold the boundary; this plan only adds validation + generated views.
- **R5 — Docs/tooling mismatch**: if the validator contract and written docs diverge, users will distrust both. *Mitigation*: generate docs examples from the same schemas where practical, or keep the schema table in one small source file consumed by both validator and docs.

## Open questions
1. Should `.context/index/*.json` be committed, or regenerated on demand and gitignored? Lean: commit them if Buck is using git as the handoff medium; otherwise the query surface disappears on a fresh machine.
2. Should `artifacts.json` include extracted headings and outbound links, or stay metadata-only in the first slice? Lean: metadata-only first; keep payloads compact.
3. Should the validator treat legacy missing fields as warnings for one release window? Lean: yes, to avoid forcing a one-shot backfill before the tooling is useful.

## Recommended next step
Run `/b-build` against this plan. After the first implementation pass, run `/b-review` specifically on the validator and generated-index contracts.
