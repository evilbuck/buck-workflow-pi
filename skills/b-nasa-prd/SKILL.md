---
name: b-nasa-prd
description: Write or audit a PRD/spec whose requirements meet NASA's quality standard (SEH Appendix C — shall/will/should, active voice, tolerances, one thought per requirement, traceable, verifiable). Use when authoring a product requirements document from scratch, hardening a draft PRD/spec before b-plan, or reviewing an existing requirements document for clarity and testability.
---

# b-nasa-prd: NASA-Standard PRD Authoring and Audit

Distills NASA's Systems Engineering Handbook Appendix C ("How to Write a Good Requirement") into a working method for writing the clearest possible PRD. The full source is bundled locally — never refetch it:

- `references/nasa-appendix-c.md` — verbatim source (terms C.1, editorial C.2, goodness C.3, validation C.4)
- `references/requirement-quality-checklist.md` — PRD-adapted audit rules with citable IDs (TERM/ED/G/CLA/COM/CMP/CON/TRA/COR/FUN/PER/INT/MAI/REL/VER/DAT)

## When to use

- A new feature/product needs a PRD before implementation planning.
- A draft PRD, spec, or `spec-*.md` reads vague, untestable, or solution-locked.
- Reviewing requirements written by someone else (or another agent) for quality.

Not for: exploration (`b-research`), implementation planning (`b-plan`), or issue triage. `b-nasa-prd` produces/refines the requirements artifact that feeds them.

## The standard in five lines

1. `shall` = binding requirement. `will` = fact. `should` = goal. Never mix. (TERM-1..4)
2. Form: `The <product> shall <verb> <object> <qualifier with tolerance>.` Active voice, one subject, one predicate. (ED-1)
3. WHAT is needed, not HOW to build it, not how it will be operated. (ED-5, ED-6)
4. One thought per requirement, uniquely numbered, with rationale. (CLA-3, TRA-3, G-5)
5. Every requirement verifiable by test, demonstration, inspection, or analysis — or it does not belong. (VER-1)

## Author mode — from idea to PRD

### 1. Intake

Gather, in this order (ask only what is missing; do not interrogate for what context already answers):

1. **Need** — what problem, for whom, and what happens if nothing ships.
2. **Goals and success metrics** — measurable outcomes (these are `will`/`should` statements, not requirements).
3. **Scope** — in/out boundaries; users and external systems (interfaces).
4. **Constraints** — platform, budget, timeline, regulatory, environment.
5. **User flows** — how the product is operated (lives in its own section; never inside requirements).
6. **Assumptions** — each one explicit; they gate acceptance. (COM-3)

### 2. Draft requirements

Write each requirement as one row of the requirements table. Grammar:

```
The <product> shall <verb> <object> <qualifier with tolerance>.
```

Examples in NASA's own form:

- The system shall operate at a power level of …
- The software shall acquire data from the …
- The API shall respond to read requests within 300 ms at p95.
- The importer shall reject records failing schema validation with error code and row reference.

Sweep the requirement areas so nothing is missing (COM-2): functional, performance, interface, environment, operability, safety, security, training, personnel, physical characteristics. For software products the usual gaps are performance (PER-1), error handling (REL-2/3), and non-goal boundaries.

Rules enforced while drafting:

- Tolerance on every quantitative value (ED-4). A number without a bound is a wish.
- Positive statements (G-3): "shall reject", not "shall not accept".
- Unknown value → best estimate marked **TBR** + rationale + owner + due date (G-4). Maintain the TBR register; do not scatter TBDs.
- Goals do not wear `shall` (TERM-4). "The dashboard should load fast" is a goal → success metric, not a requirement.

### 3. Validate

Run every requirement through `references/requirement-quality-checklist.md`. The banned-word scan (CLA-1, VER-3) is the cheapest first pass; traceability (TRA-1: "worst that could happen if dropped?") is the strongest filter against requirement bloat.

### 4. Emit the PRD

Structure (NASA-flavored minimal PRD):

```markdown
---
status: draft          # draft | active — flip to active only after assumptions are confirmed (COR-2)
---

# <Product> PRD

## 1. Need and goals          → problem statement, goals, success metrics (will/should statements)
## 2. Scope                   → in/out; users; external systems
## 3. User flows              → operational narratives (never requirements)
## 4. Constraints             → platform, regulatory, timeline, environment
## 5. Assumptions             → numbered, each gating acceptance
## 6. Requirements            → the table below, grouped by area
## 7. TBR register            → value, rationale, owner, due date
## 8. Traceability            → requirement ID → goal/scope item
```

Requirements table columns:

| ID | Requirement (shall-statement) | Rationale | Verification | Traces to |
|---|---|---|---|---|
| REQ-001 | The <product> shall … | why this exists | test / demo / inspection / analysis | GOAL-2 |
| REQ-002 | … | … | … | … |

Verification is a single method per requirement (VER-1); if you cannot name one, the requirement is not a requirement.

## Review mode — audit an existing PRD

Given a PRD/spec path (or inline requirements):

1. Read the document; extract every requirement-bearing statement (any `shall`, plus fake requirements hiding behind `should`/`must`/`will`).
2. For each, run the checklist; record violations with rule IDs.
3. Check document-level rules: unique IDs (TRA-3), TBR register exists (G-4), assumptions stated (COM-3), requirements not mixed with flows/tasks (CMP-3/4), coverage sweep done (COM-2).
4. Output a findings table — `ID | Rule | Severity (blocker/warn) | Finding | Suggested rewrite` — then offer rewritten requirement text for each blocker. A blocker is anything failing TERM, ED-1/4/5, CLA-1/3, TRA-1/3, or VER-1/3; everything else warns.
5. Stop and report — do not silently rewrite the whole document unless asked.

## Workflow position

`b-brainstorm → b-research → b-nasa-prd → b-plan → b-build`

`b-nasa-prd` sits after research, before planning: it converts findings into a requirements artifact the plan can trace to. It can also harden any existing `spec-*.md` in a subject folder — audit first (review mode), then patch the spec in place.

## Files in this skill

- `SKILL.md` — this entry point
- `references/nasa-appendix-c.md` — verbatim NASA SEH Appendix C (local source of truth)
- `references/requirement-quality-checklist.md` — PRD-adapted audit rules with citable IDs
