---
status: active
date: 2026-09-04
subject: 2026-09-04.b-recap
topics: [b-recap, session-recap, workflow-skills]
research: []
iterations: []
spec: null
memory: []
---

# Plan: Add `b-recap`

## User Goal

A developer can run `b-recap` at any point and get a one-page, scan-friendly account of the current conversation and relevant durable artifacts: its initial purpose, why it mattered, main work areas and direction changes, representative files changed, and the latest user request.

## Goal

Add a read-only Buck skill and `/b-recap` command that reconstructs the session's narrative from available evidence without becoming an exhaustive changelog or a replacement for `/b-save`.

## Context used / assumptions

- User-provided context defines the required content: initial purpose, why, major work areas, material direction changes, important files rather than every file, extra emphasis on the final area, and the last thing asked.
- The confirmed scope includes relevant durable artifacts in addition to the active conversation.
- The active conversation is primary evidence. Compaction summaries, explicit plan/subject/memory paths, tool results, and corroborated repository status/diff evidence may fill gaps or validate claims.
- Repository changes can predate the session. The skill must not attribute a file to this session unless conversation, tool activity, or a relevant session artifact corroborates it.
- `b-recap` is manually invoked, produces chat output only, and does not mutate source, `.context/`, memory, backlog, or session state.
- “One page” is enforced as at most 500 words. This is portable across terminal and chat surfaces and leaves room for legible headings.
- The `/b-recap` invocation itself is not the “latest request”; that field reports the latest substantive direct-user request before the recap command.
- Buck capability probe: `full`, based on the system available-skills catalog resolving `b-build`, `b-review`, and `b-save` in this active OMP session.

## Scope

- Define evidence precedence and graceful behavior when history is compacted, artifacts are stale, no files changed, or no material direction shift occurred.
- Group work by meaningful objective/area rather than narrating every turn or tool call.
- Give the final work area more detail and label it as the latest focus when the session covered multiple areas.
- Select a small representative set of important changed files and explain each file's significance.
- Ship the portable skill plus Pi/OMP slash-command surfaces.
- Add concise catalog documentation so users can discover the command and understand that it is read-only and distinct from `/b-save`.

## Out of scope

- Persisting the recap as a new artifact, memory entry, or changelog.
- Replacing `/b-save`, reconstructing sessions that have no reliable surviving evidence, or claiming certainty across missing transcript segments.
- Producing an exhaustive changed-file list, full chronological transcript, test log, token/accounting report, or next-session plan.
- Runtime extension code or changes to `package.json`; existing package manifests auto-discover the `skills/`, `prompts/`, and `commands/` directories.
- Automatically running `b-recap` at workflow completion.

## Affected files

- `skills/b-recap/SKILL.md` — canonical, agent-neutral recap behavior, evidence rules, length cap, and output template.
- `prompts/b-recap.md` — thin `/b-recap` wrapper that forwards optional arguments and loads the canonical skill.
- `commands/b-recap.md` — OMP command symlink to `../prompts/b-recap.md`.
- `README.md` — add `b-recap` to the command and skill catalogs.
- `docs/buck-workflow.md` — add the component reference and clarify its read-only, non-checkpoint role.

## Implementation steps

1. Create `skills/b-recap/SKILL.md` with explicit inputs and evidence precedence: direct user messages and active conversation first; compaction summaries and explicitly relevant Buck artifacts second; repository status/diff only as corroboration.
2. Specify the synthesis rules: recover the earliest substantive purpose and why, cluster the session into objective-level work areas, identify only material direction changes, emphasize the final area, and extract the latest substantive user request while excluding the recap invocation.
3. Define a fixed scan-friendly Markdown shape and a hard 500-word ceiling. Use: title/one-sentence overview, Initial purpose and why, Work covered, Direction changes, Important files, and Latest request/current state. Require concise fallback text for empty or uncertain sections rather than inventing details.
4. Define important-file selection as 3–6 representative paths when available, prioritizing behavior-bearing source, decisive configuration, proof-bearing tests, and user-facing documentation; group closely related paths and state why each matters. Emit “No session-attributable file changes found” when appropriate.
5. Add `prompts/b-recap.md` as a thin wrapper and `commands/b-recap.md` as the standard relative symlink so Pi and OMP expose the same slash command while other harnesses can invoke the skill by name.
6. Update `README.md` and `docs/buck-workflow.md` catalogs with the new command, its purpose, and the distinction: `/b-recap` summarizes for immediate orientation; `/b-save` persists durable session state.

## Acceptance criteria

- [x] `/b-recap` returns no more than 500 words in a stable, legible Markdown layout.
- [x] Every recap states the initial purpose and why it mattered.
- [x] Multi-topic sessions are grouped into meaningful work areas, with the final area clearly identified and given the most useful detail.
- [x] Material direction changes are summarized; a session with no material shift says so plainly.
- [x] Important files are limited to 3–6 representative, session-attributable paths with one short significance note each; no-file sessions are handled explicitly.
- [x] The latest substantive direct-user request before the recap invocation is reported separately, along with the evidence-grounded current state.
- [x] Conversation evidence wins over stale or conflicting artifacts; uncertainty and missing/compacted context are disclosed at the affected claim.
- [x] The skill never writes files, updates workflow state, or substitutes for `/b-save`.
- [x] Pi discovers `prompts/b-recap.md`, OMP discovers the matching `commands/b-recap.md` symlink, and skill-by-name loaders discover `skills/b-recap/SKILL.md`.
- [x] README and workflow documentation list the new capability consistently.

## Verification

- Invoke `/b-recap` in a real session that covered this plan and implementation. Confirm the output identifies the original `b-recap` goal, the final focus, the prior user request rather than the recap invocation, and only corroborated important files.
- Exercise three additional prompt scenarios: a single-topic session with no direction change; a multi-topic session with a genuine pivot; and a compacted/incomplete session with stale unrelated working-tree changes. Confirm uncertainty and attribution rules hold.
- Count the rendered recap words and verify the output is at most 500 words without dropping any required section.
- Verify `commands/b-recap.md` resolves to `../prompts/b-recap.md` and the wrapper loads `skills/b-recap/SKILL.md`.
- Run the repository's docs-only validation applicable to Markdown and symlink changes. No permanent source-text assertion test is planned; live invocation is the behavioral proof for a prompt skill.

## Risks

- Harnesses expose different amounts of conversation history. Mitigation: rely on injected conversation context without assuming a runtime transcript API, use explicit artifacts only as fallback, and mark gaps rather than infer.
- A dirty working tree can contain unrelated or older work. Mitigation: require session corroboration before attributing files and omit unverified paths.
- “One page” varies by renderer. Mitigation: enforce a measurable 500-word maximum and a compact fixed section order.
- Minor refinements could be misreported as pivots. Mitigation: record direction changes only when the user goal or primary work area materially changed.
- The latest visible message may be the recap command itself. Mitigation: explicitly skip invocation/wrapper text and select the preceding substantive user request.
