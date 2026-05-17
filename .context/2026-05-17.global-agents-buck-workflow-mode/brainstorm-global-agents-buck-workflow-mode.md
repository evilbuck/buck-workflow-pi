# Plan: Global AGENTS vs Buck Workflow Mode

## What we might build
- Reduce the size and always-on scope of `~/.pi/agent/AGENTS.md`.
- Move some durable-artifact and workflow-routing guidance out of the global file.
- Introduce a `buck-workflow` mode, skill, extension behavior, or opt-in layer that turns on the heavier planning/documentation rules when desired.
- Preserve the good part of the current setup: ad-hoc work can still leave useful durable artifacts in `.context/`.

## Why it matters
- The global AGENTS file feels large and mixes baseline safety rules with workflow-specific behavior.
- Always-on workflow hints may be useful, but they may also make the global layer too broad.
- A clearer split could improve maintainability, portability, and reduce instruction sprawl.

## Constraints / preferences
- Keep ad-hoc work capable of leaving durable artifacts.
- Avoid losing the current “lightweight but documented” behavior.
- Prefer using buck-workflow package concepts where they fit naturally.
- Avoid forcing full formal workflow overhead for every session.
- Respect the existing three-layer model: skills, prompt wrappers, extensions/runtime automation.

## Open questions
- Which parts of global `AGENTS.md` are truly baseline and should remain always-on?
- Which parts should move into buck-workflow skills vs extension/runtime logic?
- Should `buck-workflow` be an explicit mode, an extension-managed session flag, or a set of opt-in commands?
- How should ad-hoc durable artifact creation work when the user does not explicitly invoke a Buck command?
- What should the activation boundary be: manual, inferred, or project-configured?

## Brainstorm notes
- Candidate movable sections seem to include: Project Bootstrap, Persistent Artifacts, Memory Rules, Backlog Rules, Plans/Specs/Research, Workflow Routing, and parts of Completion Checklist.
- Candidate global sections to keep: Operating Principles, Safe Change Policy, Web UI Verification, Dotfiles/Chezmoi Safety, Pi-specific guidance, Worktrees/QMD, User Feedback Protocol.
- This likely intersects with the existing buck-workflow portability model:
  - skills = portable workflow logic
  - prompts = thin invocation wrappers
  - extensions = runtime automation/session state
- A possible split is:
  - global AGENTS = minimal baseline operating rules
  - buck-workflow skill package = artifact conventions and workflow semantics
  - extension/mode = session-level activation for “durable artifacts by default” behavior
