---
status: completed
date: 2026-09-20
subject: 2026-09-18.doc-honesty
topics: [documentation, implementation-sync]
research: []
spec: null
memory: [documentation-implementation-sync-2026-09-21.md]
---

# Documentation–Implementation Sync Plan

## User Goal

Technical chore — keep the repository's living guidance reliable for operators and future agents by matching the shipped implementation.

## Goal

Make the repository's living documentation describe the current shipped implementation, without rewriting historical `.context/` records or changing runtime behavior.

## Scope

- Audit every living Markdown document under `docs/` plus `README.md` and the managed documentation claims in `AGENTS.md`.
- Verify claims against implementation, package metadata, install scripts, tests, skill frontmatter, prompt/command registration, and guardrail configuration.
- Classify findings as confirmed mismatch, stale reference, documentation overclaim, broken link, or ambiguous evidence.
- Correct only evidence-backed mismatches; preserve existing uncommitted user changes.

## Work

1. Build implementation and documentation inventories.
2. Run independent read-only scouts across runtime/extensions, skill catalogs, harness installation, workflow contracts, and residual docs.
3. Reconcile duplicate or conflicting scout findings against source.
4. Apply focused documentation corrections.
5. Validate links, command mirrors, documentation snippets, subject lifecycle policy, and repository guardrails.
6. Record the verified result in session memory and backlog state.

## Acceptance Criteria

- `docs/buck-workflow.md` matches the current command, skill, extension, lifecycle, and guardrail implementation.
- All other living docs contain no source-verified stale implementation claims or broken repository-relative references found by the audit.
- Existing staged source changes remain intact.
- Documentation checks and the repository's deterministic guardrail contract pass.
