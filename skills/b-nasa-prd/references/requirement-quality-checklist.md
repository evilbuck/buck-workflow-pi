# NASA Requirement-Quality Checklist — PRD Adaptation

Distilled from NASA SEH Appendix C (`references/nasa-appendix-c.md`) into citable, checkable rules. Every rule keeps its NASA source section (`C.x`). Use it to draft or audit requirements; cite rule IDs in findings (e.g., `VER-3 violation: "user-friendly" is unverifiable`).

Vocabulary mapping — NASA term → PRD equivalent:

| NASA | PRD |
|---|---|
| Mission need / goals / objectives | Product problem statement / goals / success metrics |
| System-of-interest scope | Product scope (in/out) |
| ConOps | User stories, user flows, usage narratives |
| Parent requirement | PRD goal or epic the requirement traces to |
| SOW / Task Order | Delivery plan / team task tracker |
| Baselining the document | Marking the PRD `active`/accepted |
| Verification (test, analysis, inspection, demonstration) | Acceptance criteria and how each will be demoed/tested/inspected/measured |

## TERM — Use of Correct Terms (C.1)

- **TERM-1** `shall` marks a binding requirement. Exactly one per requirement statement.
- **TERM-2** `will` states facts or declarations of purpose (context, not requirements).
- **TERM-3** `should` marks a non-binding goal. Goals do not belong in the requirements table.
- **TERM-4** Do not mix levels: a goal written with `shall` is a fake requirement; a requirement written with `should` is unenforceable.

## ED — Editorial Form (C.2)

- **ED-1** Product requirement form: `The <product> shall <verb> <object> <qualifier with tolerance>.` Active voice, one subject, one predicate.
- **ED-2** Personnel/task requirement form: `<responsible party> shall <do/perform/provide> <what>.` Keep these separate from product requirements (NASA routes them to the SOW — route them to the delivery plan).
- **ED-3** Terminology is consistent: the same entity is called the same name everywhere; key terms appear in the glossary.
- **ED-4** Qualitative/performance values carry tolerances (`<`, `≥`, `±`, 3σ RSS). A value without a tolerance is a wish.
- **ED-5** Free of implementation: states WHAT is needed, not HOW to build it. Ask "why do you need this?" — the answer often points at the real requirement.
- **ED-6** Free of operational narration: "The operator shall…" / "the user will then…" describes operations, not product need. Move to user flows (ConOps).

## G — General Goodness (C.3)

- **G-1** Grammatically correct; no typos, misspellings, punctuation errors.
- **G-2** Complies with the project's template and style rules.
- **G-3** Stated positively. Avoid `shall not` — restate as the positive bound ("shall reject" not "shall not accept").
- **G-4** TBDs minimized. Prefer a best estimate marked **TBR** with: rationale, what resolves it, owner, due date. Maintain a TBR register.
- **G-5** Each requirement carries an intelligible rationale including assumptions. Assumptions are confirmed before the PRD is accepted.
- **G-6** Located in the proper section — requirements live in the requirements section, not in appendices, intros, or rationale prose.

## VAL — Validation (C.4)

### Clarity

- **CLA-1** Unambiguous: no indefinite pronouns (this, these) without a noun; no ambiguous terms: `as appropriate`, `etc.`, `and/or`, `but not limited to`.
- **CLA-2** Concise and simple.
- **CLA-3** One thought per requirement — no compound requirements ("shall do A and B"), no requirement-plus-rationale paragraphs.
- **CLA-4** One subject, one predicate.

### Completeness

- **COM-1** Incomplete values captured as TBD/TBR in a maintained register.
- **COM-2** No missing requirement areas. Sweep: functional, performance, interface, environment, facility, transportation, training, personnel, operability, safety, security, appearance/physical characteristics, design.
- **COM-3** All assumptions explicitly stated.

### Compliance

- **CMP-1** Each requirement sits at the correct level (product → subsystem → component); no component detail in product-level requirements.
- **CMP-2** Free of implementation specifics (WHAT, not HOW).
- **CMP-3** Free of operational descriptions (belongs in user flows).
- **CMP-4** Free of personnel/task assignments (belongs in the delivery plan).

### Consistency

- **CON-1** No requirement contradicts another or a related system's requirements.
- **CON-2** Terminology matches the user's/sponsor's vocabulary and the glossary.
- **CON-3** Terms used consistently across the whole document.

### Traceability

- **TRA-1** Every requirement is necessary — traces to a parent goal/scope item. Test: "What is the worst that could happen if this requirement were dropped?" If the answer is nothing, it is a want, not a requirement.
- **TRA-2** Bidirectional trace: parent → child and child → parent across goals, functions, constraints.
- **TRA-3** Uniquely referenced: every requirement has a stable unique ID (e.g., `REQ-014`).

### Correctness

- **COR-1** Each requirement is correct.
- **COR-2** Each stated assumption is correct — confirmed before accepting the PRD.
- **COR-3** Technically feasible with the expected constraints (budget, platform, timeline).

### Functionality

- **FUN-1** The function set is jointly sufficient and individually necessary to meet the goals. No orphan functions; no gaps.

### Performance

- **PER-1** Performance specs and margins listed: timing, throughput, storage, latency, accuracy, precision.
- **PER-2** Each performance requirement is realistic.
- **PER-3** Tolerances defensible and cost-effective. Test: "What is the worst that could happen if the tolerance were doubled or tripled?" If nothing, loosen it.

### Interfaces

- **INT-1** All external interfaces defined (users, upstream/downstream systems, APIs, data sources).
- **INT-2** All internal interfaces defined.
- **INT-3** Interfaces necessary, sufficient, mutually consistent.

### Maintainability

- **MAI-1** Maintainability requirements are measurable and verifiable.
- **MAI-2** Requirements are weakly coupled — a change to one does not ripple into many.

### Reliability

- **REL-1** Reliability requirements are defined, measurable, verifiable.
- **REL-2** Error detection, reporting, handling, and recovery are required.
- **REL-3** Undesired events (data loss, operator error, partial failure) considered, with required responses specified.
- **REL-4** Assumptions about function sequencing are stated (and are actually required).
- **REL-5** Survivability after a hardware/software fault addressed across hardware, software, operations, personnel, procedures.

### Verifiability / Testability

- **VER-1** Each requirement can be verified by test, demonstration, inspection, or analysis — at the level the requirement is stated. Verification criteria can be stated.
- **VER-2** Stated precisely enough to write test success criteria.
- **VER-3** Free of unverifiable terms: `flexible, easy, sufficient, safe, ad hoc, adequate, accommodate, user-friendly, usable, when required, if required, appropriate, fast, portable, light-weight, small, large, maximize, minimize, robust, quickly, easily, clearly`, other "ly" words, other "ize" words.

### Data Usage

- **DAT-1** "Don't care" conditions are genuinely don't-care and explicitly stated (irrelevant values flagged as such improve portability).

## Banned-word quick scan

Audit shortcut — flag on sight (CLA-1 / VER-3):

```
as appropriate · etc. · and/or · but not limited to · this/these (as bare pronouns)
flexible · easy · sufficient · safe · ad hoc · adequate · accommodate
user-friendly · usable · when required · if required · appropriate · fast
portable · light-weight · small · large · maximize · minimize · robust
quickly · easily · clearly · …ly · …ize
```
