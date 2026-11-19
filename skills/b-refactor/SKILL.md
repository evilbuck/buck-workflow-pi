---
name: b-refactor
description: >
  Refactor existing code by removing one piece of accidental complexity,
  behavior preserved. Use when asked to refactor a path, symbol, or smell, or
  to find one small cleanup. One force per run. Not a feature, a bug hunt, a
  review nit, or a smell inventory.
---

# b-refactor

One invocation removes one force, or stops. A night of 1–4 PRs is 1–4 invocations. This skill does not run the night.

A count in the arguments is not a target. Several named paths: take the first. The rest wait.

## When

- **Targeted.** A path, symbol, or smell was named. That is the only scope. A directory is still one force inside it, not a walk of every file.
- **Find.** Nothing was named. Pick one candidate. Two looks. The first real force wins.
- **Not this skill.** New behavior is `b-build`. A bug is `b-diagnose`. A review nit, rename, or lint fix is `b-iterate`. A smell inventory is `code-smells`. A behavior change is a stop: name it and route. Do not smuggle it in as a refactor.

## Bound

- One target. One diff a reviewer can read as one PR.
- Finish the Acts on this target whose next step still deletes more than it adds and still fits that diff. The step that needs a second concept, a second target, or a rewrite-sized review is the stop. Name the unfinished Act.
- Do not commit, push, or open a PR. Do not reset, clean, stash, or force-checkout. Other work may be in the tree. Revert only the lines this step changed.
- In the method below, "keep the decision" is the design commit. It is not a git commit.

Write boundary:

- **Allowed:** the target code; a characterization test that pins what the code does now; a one-line decision comment when the next reader of that code would otherwise undo a Leave.
- **Blocked:** a new dependency, a new architecture file, an interface with one implementation, a second target, a log file this repo did not already have.

## Before the method

When this repo has the workflow adapter, follow `skills/_shared/recall-project-memories.md` first. A site a prior run Left is not a candidate unless the user names it. No adapter: continue from the written canon and the code. Do not invent a log file.

Find, only when no path, symbol, or smell was named:

1. **Look 1.** Code this session already touched that still has a broken window with a nameable force.
2. **Look 2,** only if look 1 has none. One recorded complexity hotspot above the project's ceiling, if the project records one. Otherwise run `git log -20 --name-only --pretty=format:` and take the first source path that is not a test and not generated. That one file is the look.
3. The first site you can label accidental and name a force for is the target. Both looks empty: report None and stop. Do not open a third area.

A named smell with no path uses the same two-look bound to find one instance, then the method. Do not inventory every instance.

## Authority

When two rules disagree, the higher one wins:

1. Behavior the tests pin.
2. The written project canon: AGENTS.md, ADRs, style guide, docs this repo points at.
3. The repeated shape already in this code.
4. The language and framework's ordinary way.
5. A named pattern from a book.

A book pattern loses to a helper three files away, a stdlib function, or the framework's ordinary form. If the written canon and the code disagree, follow the canon for this edit unless following it would be a rewrite. Do not invent a third style.

The method is Pragmatic Programmer, Mythical Man-Month, Design of Design, and Design Patterns. Apply it. Do not recite it.

## Method

You are changing existing code. Remove accidental complexity. Leave essential complexity alone. Match the system's conceptual integrity. A pattern answers a force that is already here. It is not a destination.

Do these in order. A step is done only when its check passes.

### 1. Read the whole path

Trace the code this change touches, and every caller of any function you might edit. Find how this project already solves the same kind of problem.

Check: you can point at a written rule or an existing exemplar, or you can say there is none and name the framework's ordinary way. A pattern recalled from memory is not done.

### 2. Split essential from accidental

Essential stays: domain rules, the framework contract, complexity that is the problem itself.

Accidental is a candidate: duplicated knowledge, a seam nobody varies, indirection that only hosts a pattern name, a style that fights the canon, dead code, a module that mixes two reasons to change.

Check: each target is labeled essential (leave) or accidental (candidate). An unlabeled gripe is not a target.

### 3. Scrutinize before you touch

A smell is a hypothesis. For each candidate, name the smell, the force, the canon fix, and the cost.

Force means a change, a bug, or duplicated knowledge that already hurts. "It might someday" is not a force.

Canon fix means the smallest move toward the exemplar from step 1.

Cost means what the fix adds: types, files, indirection, a new concept.

Act when the force is real and the fix deletes more accidental complexity than it adds.

Leave when you cannot name a force, when the "bad" form is the simpler encoding, or when the canon fix is a second system. A short switch, a straight-line function, a primitive, a boundary data holder, or a framework global can be the right design. Say so in one line, so the next reader sees a decision.

Most of the time the textbook bad form is actually bad. Scrutiny catches the rest. It is not permission to keep a broken window you are already touching, and it is not permission to import a pattern the file does not need.

The alternative you compare is the smaller fix against leaving it. Not a second architecture. Keep the winner. Delete the loser.

Check: every candidate is Act or Leave, with a force or an explicit "no force."

### 4. Pin behavior before any refactor

Refactoring preserves behavior. Before the first structural edit, the behavior under change has a test that fails if you break it.

If that test exists, run it. It is green on the current code.

If it does not, write a characterization test for what the code does now, not what you wish it did. Run it. Green on the current code. That test file is the pin. It is not a new pattern, module, or dependency.

If the only command you can run is already red for a reason you cannot tie to this behavior, stop. Do not refactor on an unexplained red.

If you cannot pin it cheaply, stop. Name the target and the missing seam. Do not refactor blind.

Check: a test command you ran, green before you edited.

### 5. One small change, then green

One mechanic per step: rename, extract, inline, move, delete, or replace a conditional with the canon shape you already found. Not a new architecture. Not a new dependency. Not an interface with one implementation.

Run the tests. Green before the next edit. If red, revert the step's lines only. Fix the pin only if you can show the test was wrong, not the code. Do not stack a second edit on red.

A broken window in code this change already touches is in scope when it is accidental and the force is real. It is not a license to tour.

Repeat until every Act on this target is done, or the next step would add more than it removes, or the diff would no longer be one reviewable PR. Then stop. Do not tour the file for more smells.

Check: the suite is green, and the diff is a sequence of small behavior-preserving steps.

## Names

Act when the force is present: duplicated knowledge, shotgun surgery, divergent change, dead code, speculative generality, feature envy where the behavior already has a home, a broken window in code this change already touches.

Scrutinize, and often leave: a switch with few stable cases, a long function that is a straight procedure, a primitive the domain does not name, a data holder at a boundary, a comment that records a non-obvious why, the framework's ordinary "bad" thing.

Anti-patterns, same Act/Leave rule: golden hammer, cargo cult, second system, silver bullet, middle man, god object, lava flow, poltergeist, coincidental DRY, an interface with nothing to vary.

A Leave the next reader of that code would "fix" gets the one-line decision in the code. Every other Leave lives in the report only.

## Done

All of these:

- Every candidate is Act or Leave with the reason.
- Every Act is fixed in a small green step, left for the next invocation with the reason, or stopped with the missing test named.
- The suite is green, or you stopped before editing.
- You added no pattern, file, or dependency the canon did not already have, except the characterization test step 4 required, and except the case where step 3 showed a force and step 1 found no exemplar and no framework ordinary way.

## Report

Lead with the result. No pattern tour. No book quotes.

- **Acted:** smell, force, mechanic, the test command that went green.
- **Left:** smell, and why the simple form won.
- **Stopped:** what you would not touch without a pin.
- **None:** no force in the two looks.

Then the changed files, if any.

## Closeout

Do not commit, push, or open a PR.

If the diff is non-empty, the next commands are `/b-review`, then `/b-save`, then `/b-commit`, then `/b-pr`. Inside a supervisor loop, return once the diff is green and this report is written. The supervisor owns review, save, and commit.

If nothing changed, do not suggest a PR.

When this repo uses the workflow adapter, hand the Leave and Stopped one-liners to `/b-save` so the next run's recall skips them. Do not write a second log.
