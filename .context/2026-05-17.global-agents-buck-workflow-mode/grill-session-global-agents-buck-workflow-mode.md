---
type: grill-session
date: 2026-05-17
subject: 2026-05-17.global-agents-buck-workflow-mode
total_questions: 21
assessment_threshold: 20
boundary_assessment: cohesive
break_points: []
decision_domains:
  - name: Activation Model
    questions: [1-3]
    resolved: 3
    deferred: 0
  - name: Implicit Mechanics
    questions: [4]
    resolved: 1
    deferred: 0
  - name: Global vs Mode Responsibilities
    questions: [5-8,14-20]
    resolved: 10
    deferred: 0
  - name: Activation Triggers
    questions: [9,12-13]
    resolved: 2
    deferred: 1
  - name: Context Layout Interop
    questions: [10]
    resolved: 1
    deferred: 0
  - name: Mode UX Surface
    questions: [11]
    resolved: 1
    deferred: 0
  - name: Fallback Behavior
    questions: [21]
    resolved: 1
    deferred: 0
status: active
related:
  - brainstorm-global-agents-buck-workflow-mode.md
---

# Grill Session: Global AGENTS vs Buck Workflow Mode

## Decision Domains

### Domain: Activation Model
- Q1: If `buck-workflow mode` exists, should it be explicit opt-in, auto-enabled from intent, or project-configured by default? → resolved: user prefers auto-enabled from intent; assistant recommendation was explicit opt-in via extension-managed session flag to reduce surprise.
- Q2: When intent is inferred, should activation happen only for explicit Buck-style planning/research requests, or also for general ad-hoc implementation/investigation requests that appear meaningful enough to deserve durable artifacts? → resolved: user prefers narrow auto-enable, with manual toggle also available; assistant agrees this avoids recreating overly broad global behavior.
- Q3: Should `buck-workflow mode` be a single bundle of behavior, or should it enable specific features independently (for example: bootstrap context reading, durable artifact prompting, backlog discipline, memory save reminders)? → resolved: mode should perform lightweight implicit Buck actions itself, not just nudge into explicit commands.

### Domain: Implicit Mechanics
- Q4: When mode is active, which implicit actions are safe to perform automatically versus which must remain explicit skill invocations? → resolved: user accepted the recommendation to auto-activate session state immediately but delay file creation until a clear threshold is crossed.

### Domain: Global vs Mode Responsibilities
- Q5: Outside `buck-workflow mode`, should the global `~/.pi/agent/AGENTS.md` still instruct the agent to create durable `.context` artifacts for meaningful ad-hoc work, or should that structured behavior move almost entirely into Buck mode/package semantics? → resolved: user states durable artifacts are ALWAYS helpful, so a global durable-artifact principle should remain in place.
- Q6: If durable artifacts remain globally preferred, should the global AGENTS keep only the high-level principle (`prefer durable artifacts / leave useful state`), while Buck workflow owns the specific `.context` taxonomy and operational rules (subject folders, memory frontmatter, backlog layout, routing, save discipline)? → resolved: yes.
- Q7: Should `.context` remain a global cross-workflow convention, with Buck workflow specializing it rather than owning it exclusively? → resolved: yes.
- Q8: How much `.context` detail should remain in the global AGENTS: just the principle and top-level `.context/` home, or explicit substructures like `memory/`, `backlog/`, and subject folders? → resolved: mention `.context/` explicitly, but do not globally encode Buck substructures.
- Q14: Should auto-enabled Buck mode latch for the rest of the session unless manually turned off? → resolved: yes.
- Q15: Should the global AGENTS explicitly mention Buck workflow and when to use it? → resolved: yes; user wants a global hint that can name Buck directly and indicate when to use it.
- Q16: How prominent should the Buck hint be in the global AGENTS? → resolved: Buck will be used more often than not, so the global file may recommend it as the default stronger workflow for most non-trivial work, not merely as an occasional optional hint.
- Q17: What is the primary reason for this cleanup? → resolved: mostly to make Buck workflow more portable without depending on a heavy global `AGENTS.md`.
- Q18: Is it acceptable to mention Buck directly in global AGENTS, or rely on built-in skill discovery that points to Buck automatically? → resolved: either is acceptable, including direct Buck mention; built-in skill discovery that points to Buck is also acceptable, but not required.
- Q19: Which should be the primary entrypoint: global hint, built-in routing skill, or both? → resolved: both.
- Q20: Should the built-in auto-picked skill be Buck-branded or generic-but-Buck-aware? → resolved: generic but Buck-aware.

### Domain: Activation Triggers
- Q9: What exact user intents should trigger narrow auto-enable for `buck-workflow mode`? → deferred: user raised a more foundational interop question about `.context` layout specificity before defining trigger vocabulary.
- Q12: Which user asks should count as explicit workflow intent for auto-enable? → resolved: explicit planning, research/explore, write-up/documentation, PRD/spec/roadmap/design, backlog/issue breakdown, review/handoff/checkpoint, and implementation asks that explicitly include planning/handoff/documentation language.
- Q13: Should workflow intent be detected only from the latest user message, or also from accumulated session state once the conversation has clearly become workflow-shaped? → resolved: use both latest-message intent and accumulated session state; once auto-enabled, mode should latch until manually turned off or the session ends.

### Domain: Context Layout Interop
- Q10: Should the global `.context/` convention define a minimal shared layout contract to avoid cross-workflow conflicts? → resolved: yes; reserve exact common subpaths for memory, backlog, dated subject folders, and workflow-owned state under `.context/workflow/<name>`.

### Domain: Mode UX Surface
- Q11: How should users manually toggle `buck-workflow mode` when they want it on or off regardless of auto-detection? → resolved: use `/b-mode on|off|status` as canonical commands, with optional natural-language sugar.

### Domain: Fallback Behavior
- Q21: If the generic built-in routing skill is present but Buck workflow is not installed/available, should it gracefully fall back to the global `.context/` conventions rather than failing or nagging about missing Buck? → resolved: user controls the global `AGENTS.md` and states Buck workflow will always be available in this environment, so the design may assume Buck presence here rather than optimize for a missing-Buck path.

## Boundary Assessment

> Triggered at Q20 (assessment threshold: 20)

**Assessment**: cohesive

**No phase boundaries**: the questions all cluster around a single concern — making Buck workflow portable while shrinking the amount of Buck-specific behavior carried by the global `~/.pi/agent/AGENTS.md`. The session touched activation, layout, and routing, but all of those are sub-decisions inside one workflow-portability design.

## Documentation Decisions

### Terms Resolved
- "buck-workflow mode" currently treated as a session/runtime behavior, which points toward extension-owned state rather than a pure skill.
- Activation model is now hybrid: narrow auto-enable from explicit workflow intent, plus manual toggle.
- Mode should be the front-door/autopilot for Buck workflow and may perform lightweight implicit mechanics while leaving heavier reasoning to skills.
- Auto-activation should not immediately write files; file creation should wait until the conversation crosses a clear threshold.
- Durable artifacts remain a globally valuable principle even outside Buck mode.
- `.context` remains a global convention; Buck workflow specializes its structure and workflow semantics.
- Global AGENTS should mention `.context/` explicitly, but not hardcode Buck-specific substructures.
- The global `.context/` contract should reserve common subpaths to avoid cross-workflow collisions.
- Manual mode control should use `/b-mode on|off|status`, with optional syntactic sugar.
- Auto-enable should include implementation requests when they explicitly ask for planning, notes, documentation, or handoff behavior.
- Workflow intent detection should consider both the latest message and accumulated session state, and auto-enabled mode should latch for the session unless manually disabled.
- The global AGENTS may directly mention Buck workflow as a recommended stronger convention and say when to use it.
- Because Buck will be used more often than not, the global AGENTS can recommend it as the default workflow for most non-trivial work.
- The cleanup goal is portability: Buck should carry its own portable workflow behavior instead of relying on a large global AGENTS file.
- A built-in skill that points users into Buck is acceptable, but direct mention in global AGENTS is also acceptable.
- Preferred entrypoint pattern: both a short global hint and a built-in routing skill.
- The built-in routing skill should be generic in name but Buck-aware in behavior.
- In this controlled environment, Buck availability can be assumed; missing-Buck fallback behavior is not a primary design constraint.

### ADRs Created
- None.

### Conflicts Found
- No repo-level CONTEXT.md or ADRs were found, so decisions are currently being grounded in README architecture only.

## Deferred Questions
- Q9: exact trigger vocabulary for narrow auto-enable remains open.
