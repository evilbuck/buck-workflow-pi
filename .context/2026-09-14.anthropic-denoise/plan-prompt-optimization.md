---
status: completed
memory: [anthropic-denoise-optimization-2026-09-14.md]
---
# Anthropic output-style optimization

## User Goal
Optimize the output-style prompt while preserving effectiveness for Opus and Sonnet.

## Scope
Optimize the active `skills/anthropic-svn/SKILL.md` output contract for Opus and Sonnet while retaining Haiku routing. Replace the obsolete root installation copy with a pointer to the canonical contract and installation reference. Preserve the Contract-to-Surface extraction boundary; align installation and catalog descriptions with model-invoked discovery rather than guaranteed loading.

## Decisions
- Explicit response-length default, with user-requested detail and completeness taking precedence.
- Positive, concrete output rules and three examples: question, completed change with verification, blocked work.
- Preserve engineering rigor, uncertainty, material risks, and required approvals; brevity only affects communication.
- No global harness configuration changes. Existing staged work is user-owned; do not commit or reset it.

## Verification
Exercise the exported prompt on available Opus and Sonnet models with synthetic cases covering routine answers, verification honesty, blocking, requested depth, and requested format. Check extraction boundaries and relative links locally. Record actual results and limitations; a smoke test is not a broad efficacy benchmark.

## Results
Completed the rewrite and aligned references/catalogs. Five synthetic scenarios were exercised on Opus 5 and Sonnet 5 for each of three revisions. Final samples preserve verification limits, blockers, requested depth, and raw JSON format. Sonnet still added unsolicited remediation in the causal-answer case; routing and long-session adherence were not tested. See `smoke-results.json` and the linked memory for evidence and limits. Docs-only; code guardrails skipped. No global installation changes or commits.
