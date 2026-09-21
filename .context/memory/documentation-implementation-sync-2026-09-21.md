---
date: 2026-09-21
domains: [documentation, workflow, harness-integration]
topics: [doc-honesty, eval-kernel, command-mirror, zcode, code-review-iteration]
related:
  - .context/2026-09-18.doc-honesty/plan-documentation-implementation-sync.md
  - docs/buck-workflow.md
  - docs/eval-kernel.md
  - docs/extension-loading.md
  - README.md
priority: high
status: completed
subject: 2026-09-18.doc-honesty
artifacts:
  - plan-documentation-implementation-sync.md
  - draft-commit.md
---

# Documentation–implementation sync

## Outcome

Audited the living documentation against the current checkout with five independent read-only scouts, reconciled every evidence-backed finding, and corrected the shipped docs and skill guidance without changing runtime behavior.

Key corrections:

- `README.md` and `docs/buck-workflow.md` now describe the all-symlink command mirror, ZCode installer support, the six wired runtime commands, `/code-review`'s dual portable/runtime surfaces, required `b-recap` branch inspection, and the shipped `thought-dump-writer` skill.
- `docs/eval-kernel.md`, `skills/b-plan/SKILL.md`, and `skills/code-smells/SKILL.md` now use current `agent()` handles, `wait()`, `completion()`, awaitable budget semantics, and the separate asynchronous `task`/`hub` contract. Curated plugin copies remain byte-identical.
- Extension, lifecycle, guardrail, review-loop, privacy, terms, research-tool, model-routing, and activity-renderer claims now match their implementation authorities.
- The resolved eval-kernel documentation gap and stale commands-mirror backlog duplicate were removed from the active queue.

## Verification

- Shipped Markdown links: 304 files, 317 repository-relative links, zero actionable broken targets. Template-only links and source-site-root links in the imported code-smells reference set were excluded.
- Embedded eval snippets: exact blocks extracted; Python syntax checks and mocked current-API execution passed. The b-plan cell also ran its plain-Python no-op branch successfully.
- `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts`: 11/11 passed.
- `npm run subject-lifecycle:check`: `{ "ok": true, "violations": [] }`.
- `git diff --check`: passed.
- `npm run guardrails:check`: durable v2 verdict `pass`; unit and global ratchet passed at 84% coverage, complexity passed, patch coverage remained advisory with no patch value.

`npm run context:validate` remains red on a pre-existing legacy memory status (`in-progress`) and reports historical-schema warnings. The current plan's missing `topics` warning was corrected; the lifecycle-generated subject index intentionally follows the lifecycle authority rather than the validator's legacy `date`/`subject` expectation.

## Lifecycle

The plan is completed. `close-verified` still refuses the subject because unphased plan closeout evidence is not defined; the subject remains authoritatively active under the existing backlog item for that lifecycle gap.
