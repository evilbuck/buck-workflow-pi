---
status: completed
date: 2026-09-04
domains: [research, skill, buck-workflow]
topics: [b-nasa-prd, nasa, requirements, prd, appendix-c, seh]
related: [plan-b-nasa-prd-skill.md]
informs: [plan-b-nasa-prd-skill.md]
priority: medium
---

# Research: NASA SEH Appendix C — How to Write a Good Requirement

## Source

- URL: https://www.nasa.gov/reference/appendix-c-how-to-write-a-good-requirement/
- Part of the NASA Systems Engineering Handbook web edition (`nasa.gov/seh/`)
- Page published 2019-10-01, last updated 2023-07-26 (per page metadata)
- Pulled 2026-09-04 via direct fetch; content complete — sidebar confirms exactly four sections (C.1–C.4)
- US government work (17 U.S.C. § 105) — faithful local copy with attribution is fine

## Structure captured

- **C.1 Use of Correct Terms** — `shall` = requirement, `will` = fact/purpose, `should` = goal
- **C.2 Editorial Checklist** — personnel vs product requirement forms, active voice, consistent terminology, tolerances on values, free of implementation (WHAT not HOW), free of operational description ("The operator shall…" is a red flag), four example product requirements
- **C.3 General Goodness Checklist** — grammar/spelling, template compliance, positive statements (avoid `shall not`), TBD→TBR protocol (rationale + owner + due date), intelligible rationale with assumptions, correct placement in document
- **C.4 Requirements Validation Checklist** — 13 named qualities: Clarity, Completeness (15-area coverage sweep), Compliance, Consistency, Traceability (incl. "worst that could happen if dropped" necessity test), Correctness, Functionality, Performance (incl. doubled-tolerance test), Interfaces, Maintainability, Reliability, Verifiability/Testability (explicit banned-word list), Data Usage

The banned-word lists (ambiguous: `as appropriate`, `etc.`, `and/or`, `but not limited to`; unverifiable: `user-friendly`, `fast`, `robust`, `maximize`, "ly"/"ize" words) are the most mechanically checkable part — ideal for agent-run audits.

## PRD adaptation decisions

- NASA vocabulary mapped to PRD vocabulary (mission need → problem statement, ConOps → user flows, SOW → delivery plan, baselining → accepting the PRD, verification → acceptance criteria). Vocabulary mapping lives at the top of the distilled checklist.
- Requirements carry: unique ID, shall-statement, rationale, verification method, trace-to-goal — this encodes NASA's traceability (TRA-3) and verifiability (VER-1) rules as PRD table columns.
- TBR register as a first-class PRD section (NASA's G-4 protocol), replacing scattered TBDs.

## Local copies

- Verbatim: `skills/b-nasa-prd/references/nasa-appendix-c.md` (provenance header + full C.1–C.4)
- Distilled: `skills/b-nasa-prd/references/requirement-quality-checklist.md` (citable rule IDs: TERM/ED/G/CLA/COM/CMP/CON/TRA/COR/FUN/PER/INT/MAI/REL/VER/DAT)

## Not pulled (out of scope)

Sibling SEH appendices (D — Requirements Verification Matrix, E — Validation Plan) referenced by the page; whole-handbook PDF. The appendix C content is the complete source for the skill's standard.
