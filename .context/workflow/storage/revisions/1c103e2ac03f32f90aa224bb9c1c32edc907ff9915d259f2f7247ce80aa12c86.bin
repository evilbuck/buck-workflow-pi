---
status: completed
date: 2026-05-13
subject: 2026-05-12.prompt-to-skill-portability
topics: [review, iteration, documentation]
from_review: b-review
---

# Iteration: Prompt-to-Skill Portability

## Source
- Reviewed after: `/b-build-hard`
- Plan: `plan-prompt-to-skill-portability.md`
- Spec: null

## Critical Issues

### 1. README.md not updated — stale architecture description
- **File**: `README.md`
- **Problem**: README still describes the old prompt-centric architecture. It says "Most `/b-*` commands → prompt templates in `prompts/`" without mentioning the new skill layer or thin-wrapper pattern. The skills table only lists `spec-progress`, missing all new skills (b-brainstorm, b-research, b-plan, b-build, b-iterate, b-review, git-commit, b-present). The prompt templates table is now misleading since prompts are thin wrappers, not full implementations.
- **Proposed fix**: Update README.md with a "Layered Architecture" section describing: (1) canonical skills as portable workflow logic, (2) prompts as Pi-native thin wrappers, (3) extensions for runtime automation. Update the skills table to include all skills. Update the prompt templates description to clarify they invoke skills.

### 2. AGENTS.md missing layered architecture guidance
- **File**: `AGENTS.md`
- **Problem**: The plan explicitly asked to "optionally add short guidance: 'use skills for portable workflow logic; use commands/prompts as wrappers; use plugins/extensions for runtime automation.'" This was not added. AGENTS.md only has documentation links and project structure — it doesn't explain the architectural intent to agents working on this repo.
- **Proposed fix**: Add a short "Architecture" section to AGENTS.md explaining the three-layer model and pointing to the plan for details.

## Warnings

### 3. b-build-hard is not a standalone skill
- **File**: `skills/b-build/SKILL.md`, `prompts/b-build-hard.md`
- **Problem**: The plan listed `skills/b-build-hard/SKILL.md` as a canonical skill to create. Instead, `b-build-hard` is handled as a difficulty mode within the `b-build` skill. This is a reasonable design choice (avoids duplication), but it means the prompt layer is responsible for selecting difficulty, and other agents would need to know this convention.
- **Suggested approach**: Either accept this design and document it explicitly ("b-build skill handles both standard and hard modes"), or create a minimal `skills/b-build-hard/SKILL.md` that loads b-build with hard mode pre-selected. Not blocking.

### 4. Pi-specific invocation syntax in skills
- **File**: Multiple skills
- **Problem**: Skills contain Pi-specific syntax like `/skill:b-phase` (b-plan), `/b-save` (b-build, b-iterate), `/git-commit` (b-iterate). Since skills are intended to be portable across Pi, Claude, OpenCode, and Codex, these references may not translate cleanly.
- **Suggested approach**: Add a note to AGENTS.md or a skill authoring guide that Pi-specific command syntax in skills is acceptable because each agent's wrapper/prompt layer will adapt it. Or, use more neutral phrasing like "invoke the b-phase skill" instead of `/skill:b-phase`. Minor issue.

## Recommended Workflow

Start with `/b-iterate` to fix the two critical documentation gaps (README.md and AGENTS.md). These are small, focused text changes that don't touch code.
