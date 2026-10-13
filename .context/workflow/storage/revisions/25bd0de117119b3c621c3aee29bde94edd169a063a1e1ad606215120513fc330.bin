---
status: completed
date: 2026-09-30
subject: 2026-09-30.state-machine-user-guide
research: []
memory: [state-machine-user-guide-2026-09-30.md]
---

# Plan: Runnable state-machine user guide

## User Goal

Create `site/guides/state-machine.html`: a recipe-style guide that enables a junior engineer to define and run a new machine without missing setup, file creation, execution, or verification steps. Code samples must execute against the current evaluator.

## Scope

- New self-contained static guide, matching the existing site's dark palette, typography, and inline HTML/CSS/JavaScript convention.
- Small navigation/footer links in `site/index.html` so the guide is discoverable.
- No evaluator, workflow, package, or existing documentation changes.

## Recipe

1. Check Git/Node/npm prerequisites, obtain a source checkout, install locked dependencies, and create `examples/`.
2. Sketch a four-state document workflow: draft → review → approved → published; rejection returns to draft.
3. Create a complete `examples/article-machine.ts`: five domain types; explicit event, choice, automatic, and terminal rules.
4. Create a complete `examples/run-article-machine.ts`: caller-owned facts; event dispatch; external choice selection; effect execution before committing the state; a real text-file publication.
5. Run with the repository's installed `tsx`, inspect exact output and the publication file, and stop at the terminal state.
6. Create/run consumer-visible safety checks for disabled events, now-illegal choices, rejection, event-only states, and terminal states.
7. Create a local strict TypeScript config and type-check all sample files plus the imported evaluator.
8. Verify the complete recipe; explain how to substitute another domain and troubleshoot expected errors.

## Implementation constraints

- Each file sample is complete, copyable, and explicitly labeled with its destination. No ellipses, omitted helpers, live-model calls, or fake publication effects.
- Relative `.js` imports are intentional and must be verified under `tsx`/NodeNext.
- Distinct choices may be enabled simultaneously. Automatic and choice rules cannot overlap.
- The evaluator remains synchronous and stateless. Callers own effects and current-state updates.
- Responsive readable code blocks, keyboard-visible focus, anchor navigation, and progressive-enhancement copy controls. Content remains usable without JavaScript.

## Acceptance and verification

- [x] Requested guide exists and is linked from the site.
- [x] Every file/command step is actionable from the documented checkout root.
- [x] Exact HTML-embedded samples are extracted, strictly type-checked, and run in an isolated workspace.
- [x] Publication contents and expected stdout match the displayed guide.
- [x] Desktop and mobile rendering, navigation, copy controls, and page errors checked in a real browser.
- [x] `npm run guardrails:check` passes all required gates; advisory/skipped gates reported.

## Evidence

- Four complete file samples and seven shell blocks were extracted from the rendered guide, not reconstructed separately. All shell blocks pass Bash syntax checks.
- A fresh clone of the documented repository branch completed the guide's setup, locked dependency installation, strict TypeScript compilation, safety assertions, and final verification commands. Runner stdout, safety-check stdout, and the real publication file match the displayed expectations exactly.
- Browser proof: desktop 1440px and mobile 390px; homepage link, mobile section navigation, keyboard copy, clipboard equality, and no page errors. The corrected mobile article remains within the viewport (document width 390px); long code scrolls inside its own block.
- With JavaScript disabled, all eight sections and four file samples remain present; unavailable copy buttons stay hidden.
- Final post-correction `npm run guardrails:check` verdict: durable v2 contract, status pass; required unit tests, coverage ratchet, and complexity pass; advisory patch coverage passes; lint and functional gates are disabled/skipped. No baselines changed.
- No evaluator, package, or permanent test changes. Temporary sample workspaces are removed after verification; the local site preview remains available on port 4322.
- Shared SQL memory is not callable in this ad-hoc session; durable intent and verification use portable file context. Unrelated backlog and workflow-session state are unchanged.
