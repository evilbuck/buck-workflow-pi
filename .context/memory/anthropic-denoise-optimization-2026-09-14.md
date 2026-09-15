---
date: 2026-09-14
domains: [skills, prompting, docs]
topics: [anthropic-svn, opus, sonnet, output-style, denoise]
related: [skills/anthropic-svn/SKILL.md, ANTHROPIC_DENOISE_SYSTEM_PROMPT.md]
priority: medium
status: completed
subject: 2026-09-14.anthropic-denoise
artifacts: [plan-prompt-optimization.md, smoke-results.json]
---
# Anthropic denoise optimization

Rewrote the canonical `skills/anthropic-svn/SKILL.md` contract for concise Opus/Sonnet responses while retaining Haiku model routing. Six rules specify answer-first output, a soft 1–3-sentence default for routine questions, material caveats, evidence-backed outcome reporting, exact requested formats, and stopping once answered. Requested depth and engineering/safety/approval requirements take precedence over brevity. Three examples demonstrate a direct causal answer, verified work with unrun integration tests, and a deployment blocked before changes.

Replaced the obsolete root installation copy with a canonical-source overview. Kept Contract-to-Surface extraction compatible with existing installation commands. Corrected install/reference/catalog claims: model-invoked discovery is not a guaranteed per-turn hook. No global harness settings or output-style exports were changed.

## Verification
- Ran three prompt iterations, each with five synthetic cases on both CLI aliases: cause, completed work with verification limits, blocked deployment, requested ~250-word explanation, and raw JSON.
- CLI result metadata identifies main models as `claude-opus-5` and `claude-sonnet-5`; auxiliary Haiku usage was also reported. Haiku itself was not an output-style test target.
- Final iteration: all 10 calls exited successfully. Both raw-JSON responses parsed with the requested fields and facts. Both retained failed-to-start integration-suite limitations, no-deployment status, and credential blockers. Requested long answers were 276 and 256 words.
- Initial/intermediate responses used JSON fences; explicitly requiring raw payloads without fences fixed both final samples.
- Opus final causal answer: 34 words. Sonnet final causal answer: 74 words, including unrequested remediation. Scope adherence remains imperfect; do not claim universal compliance or statistically established improvement.
- These were tool-free Claude Code safe-mode sessions with the exported contract supplied as a system prompt, not end-to-end skill routing or long-session tests. Technical accuracy of generated locking explanations was not the evaluation target; some outputs contain oversimplifications.
- Relative links in the root overview and skill resolve. Contract extraction includes the scope clause, six rules, and three examples, excluding metadata/Surface.
- Docs-only changes: deterministic code guardrails skipped. Raw synthetic cases, responses, model metadata, and limitations are recorded in `.context/2026-09-14.anthropic-denoise/smoke-results.json`.

## State
No active backlog item corresponds to this bounded rewrite, and no new implementation follow-up was introduced. Existing staged additions/catalog edits predated the session; they were preserved, not reset or committed. The rewritten source still needs re-exporting wherever a copied harness output style is installed.
