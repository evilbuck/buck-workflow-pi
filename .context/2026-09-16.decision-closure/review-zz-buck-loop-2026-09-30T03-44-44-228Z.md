## Phase 4 review: Needs work

**Spec axis — blocking:** `skills/b-plan/SKILL.md:246` permits a plan to omit closure sections when a *triggered* decision is already settled. The phase contract requires the material decision record even when existing evidence removes the need for an interview. The wording at line 252 also makes those sections optional for triggered work. A settled migration decision could therefore leave no visible assumptions or recovery posture. The completion matrix is **7 complete, 1 partial**: the triggered-record criterion is missing an unambiguous inclusion rule; the other seven criteria have current-file or check evidence.

**Standards axis — warning:** `b-plan` repeats phase-assignment instructions at lines 256–260, while `b-phase` owns assignment at lines 126–135. That duplicates responsibility and risks drift. This was a sequential standards pass; no background `task` tool was available. The two findings were not reranked across axes.

**Verification:** Canonical and bundled `b-plan`/`b-phase` directories match; the prohibited-term scan found no matches; the focused Codex packaging test passed **7/7**. The changes reviewed are Markdown-only, so the deterministic guardrails gate was skipped under the docs-only rule. No documentation or how-to impact was identified for this phase; the methodology narrative belongs to Phase 6.

Both in-plan findings are recorded in the staged `.context/2026-09-16.decision-closure/iterate-plan-and-phase.md`. **Next:** `/b-iterate`, then re-run `/b-review` against Phase 4. I staged only the review artifact; pre-existing changes were left untouched.
