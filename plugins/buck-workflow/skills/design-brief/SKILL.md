---
name: design-brief
description: Turn design context, screenshots, files, plain-language descriptions, and subject-folder artifacts into an implementation-ready UI design brief.
---

# design-brief: UI Brief Extraction

Extract a concrete UI design brief from whichever source material the user provides. The input may be:

- existing session context,
- one or more screenshots,
- a design-related file,
- a plain-language description,
- artifacts inside `.context/<subject>/`,
- or any combination of the above.

Your job is to normalize those inputs into one consistent brief.

## Source Handling

1. Accept mixed inputs. Merge them into one brief.
2. Prefer direct visual evidence over prose when they conflict on visible facts.
3. Use prose/context to explain intent, behavior, or hidden states that are not visible in the artifact.
4. If the source is a file rather than a screenshot, extract the design intent from whatever it contains: mockup, spec, HTML, PDF, note, canvas export, or similar artifact.
5. If only text/context exists, write the brief from explicit facts and mark missing visual details as unknown rather than inventing them.
6. If light mode or dark mode is missing from the source, provide the missing mode as a conservative extension and mark it as inferred.
7. If responsive behavior is not explicit, infer it from layout structure and map it to Tailwind default breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`.

## Subject Folder Awareness

If the task is part of a Buck workflow subject, inspect `.context/<subject>/` before finalizing the brief.

Use relevant artifacts there as additional context, especially:

- `brainstorm-*.md`
- `plan-*.md`
- `spec-*.md`
- existing `design-brief-*.md`
- related research or notes that define the UI goal or constraints

Use those files to understand:

- the user goal,
- planned scope,
- design constraints,
- open questions,
- and whether the brief should reference or refine an existing plan.

Do not treat subject-folder artifacts as mandatory. If `.context/<subject>/` does not exist or has nothing useful, proceed from the provided inputs.

## Artifact Behavior

If the task includes writing:

- write the brief as a durable artifact such as `design-brief-<topic>.md` inside `.context/<subject>/`,
- reference nearby plan/spec/brainstorm artifacts when they informed the brief,
- and, if requested, update an existing plan in that same subject folder to reference the new brief.

If the task does not include writing, still structure the output so it can be copied directly into a subject-folder artifact.

## Required Output

Output structured JSONC.

The brief must cover:

- source summary,
- related subject-folder artifacts consulted,
- page or surface purpose,
- layout structure and hierarchy,
- components and repeated patterns,
- typography,
- spacing and sizing rhythms,
- color system,
- imagery / illustrations / complex media,
- interaction states where visible or clearly implied,
- light mode,
- dark mode,
- responsive behavior at Tailwind default breakpoints,
- any impact on an existing brainstorm / plan / spec,
- ambiguities, assumptions, and inferred details.

## Color Rules

For colors, extract a rough palette and keep it implementation-oriented:

- define one **primary** palette,
- define one **secondary** palette,
- define any needed grays,
- define accent colors only when the UI clearly needs them for gradients, shadows, charts, SVGs, alerts, or other complex media.

Do not over-specify exact colors when the source does not justify it.

## Accuracy Rules

- Distinguish clearly between **observed** and **inferred** details.
- Do not fabricate hidden flows, extra screens, or component behavior.
- If something is unreadable, cropped, or absent, say so.
- When the user provides multiple sources, resolve contradictions explicitly in the `ambiguities` or `assumptions` fields.
- When asked to update an existing plan, only update the parts actually affected by the brief.

## Closing Handoff

End with a prompt for the developer describing the UI to implement.

Rules for that prompt:

- output it as a Markdown code block,
- describe the UI and token usage rules only,
- do not mention tech stack or implementation technology,
- keep it focused on what should be built, not how.
