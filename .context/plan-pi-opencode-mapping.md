---
status: completed
date: 2026-04-16
subject: 2026-04-16.pi-opencode-mapping
topics: [pi-packages, opencode-mapping, buck-workflow, docs]
research: []
spec:
memory: [pi-opencode-mapping-2026-04-16.md]
---

# Plan: Pi ↔ OpenCode Buck Workflow Mapping Review

## Goal
Create a precise, reviewable translation of Buck workflow concepts from OpenCode to Pi, then align this package's documentation and structure to the correct Pi-native primitives.

## Scope
- **In scope**:
  - Map Buck workflow concepts from OpenCode to Pi primitives
  - Review this repo’s current package structure against that mapping
  - Identify mismatches, especially around prompts, skills, extensions, and slash-command semantics
  - Propose documentation updates so the package is described in Pi-native terms
- **Out of scope**:
  - Broad workflow redesign
  - New runtime features beyond what is needed for clarity
  - Refactoring working extension logic without a clear product/documentation need

## Affected Files
- `docs/buck-workflow.md` - Primary architecture and workflow reference; needs Pi-native framing review
- `README.md` - Install and package-positioning language may need clarification
- `package.json` - Verify manifest matches intended Pi package architecture
- `extensions/index.ts` - Confirm extension responsibilities vs template/skill responsibilities
- `prompts/b-*.md` - Confirm which Buck entrypoints are correctly modeled as prompt templates
- `skills/memory-manager/SKILL.md` - Review redundancy/deprecation posture
- `skills/spec-progress/SKILL.md` - Confirm this remains a true helper skill

## Implementation Steps
1. Reconfirm the Buck workflow artifact conventions from `docs/buck-workflow.md`, especially subject-folder planning and package component roles.
2. Build a canonical OpenCode → Pi translation table for:
   - custom commands
   - agents/subagents
   - skills
   - extensions
   - workflow conventions like memory/backlog/spec handling
3. Compare the canonical mapping against the current repo implementation:
   - `prompts/`
   - `skills/`
   - `extensions/index.ts`
   - package manifest and README positioning
4. Identify concrete documentation gaps where the repo still speaks in OpenCode-native terms instead of Pi-native terms.
5. Produce a minimal change recommendation set, prioritizing:
   - documenting `/b-save` as an extension-backed command
   - clarifying that most `/b-*` commands are prompt templates
   - deciding whether the deprecated `memory-manager` skill should remain
6. After review approval, implement only the smallest documentation/package changes necessary.

## Risks
- Over-translating OpenCode concepts too literally into Pi may make the docs more confusing instead of clearer.
- Removing or reframing deprecated pieces too aggressively could break user expectations.
- Pi’s slash-command surface mixes built-ins, prompt templates, skills, and extension commands; documentation must distinguish them carefully.

## Verification
- [ ] Mapping table clearly distinguishes prompt templates, skills, and extension commands
- [ ] `docs/buck-workflow.md` guidance is reflected in where planning artifacts are stored
- [ ] Proposed changes preserve current `/b-*` user experience
- [ ] Recommendations are limited to necessary docs/package-structure clarifications

## Recommended Next Step
Review this plan, then proceed with the documentation/package alignment work using `b-build` or `b-iterate` depending on desired scope.
