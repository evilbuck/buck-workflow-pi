# Session: 2026-05-09 - model cycle abort plan

## Context
- User asked for an implementation plan for the Pi model-switching bug where cycling models during a hung request leaves the session stuck in `working...`.
- Existing draft plan existed at `.context/2026-05-09.pi-agent-cycle-fix/plan-abort-on-cycle.md`, but it was not in the repo's usual frontmatter-based plan format.

## Decisions Made
- Treat the issue as an upstream Pi core bug centered on `AgentSession` model-cycling behavior.
- Create a clean Buck-style plan artifact rather than patching the workflow package.

## Implementation Notes
- Added `.context/2026-05-09.pi-agent-cycle-fix/plan-model-cycle-abort.md`.
- Plan scope focuses on abort-before-cycle in Pi core, plus regression coverage.
- Follow-up items captured separately:
  - interactive provider timeout
  - queued prompt semantics after abort
  - Buck workflow `/b-save` completion state honesty

## Next Steps
- [ ] Implement abort-before-cycle in Pi core.
- [ ] Add/locate regression tests for cycling during active requests.
- [ ] Validate against a real hanging provider scenario.
