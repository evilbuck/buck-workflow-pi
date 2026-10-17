---
status: active
date: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [fix-pr, github, agent-tool, portable-skill]
research: []
memory: [fix-pr-native-tool-plan-2026-09-28.md, fix-pr-feedback-adapter-phase-1-2026-09-28.md]
---

# Plan: Use native PR reads and expose exhaustive fix-pr ingest as a tool

## User Goal
Engineers fixing review feedback should use OMP's native PR view where it helps, while still getting a complete, repeatable feedback inventory through an agent-callable tool instead of manually invoking a sibling script.

## Goal
Make native `pr://` a permitted convenience for orientation and targeted inspection, keep the deterministic TypeScript fetcher authoritative for exhaustive classification and settlement, and expose that fetcher as a thin agent tool when the extension is loaded. Preserve the script as the portable path on harnesses without the tool.

## Context used / assumptions
- User selected this direction after comparing the current skill with OMP's `pr://` resource and explicitly requested a plan.
- A live `pr://30` read exposed reviews, inline comments, conversation comments, and a diff index, but did not expose structured thread-resolution state, head OID, or CI job evidence. Do not treat its rendered text as a complete settlement feed.
- `skills/fix-pr/scripts/fetch-feedback.ts` already paginates GitHub reviews, inline/conversation comments, GraphQL threads, checks and job evidence; returns a compact JSON summary and writes a mode-0600 inventory. `--seen-ids-file` supports repeated polls. Preserve one canonical normalizer.
- `extensions/jev-tool/index.ts` and `extensions/index.ts` demonstrate `api.registerTool` and central wiring. The extension entry is shipped in both Pi and OMP package manifests; the skill must select the tool by *actual availability*, not by package metadata.
- `docs/buck-workflow.md:1345-1347` still describes a previous native-collector model and needs correction. The Codex plugin carries a physical copy of the `fix-pr` skill; `scripts/codex-plugin.test.ts` enforces byte parity. The companion `presentations/2026-09-12.fix-pr-skill-report/index.html` should track changed skill phases/surfaces.
- The user goal above is synthesized from the agreed recommendation; no new GitHub write permissions or PR workflow behavior is requested.

## Scope
- Add one typed, read-only-from-GitHub agent tool, e.g. `fix_pr_feedback`, whose thin adapter invokes the existing sibling TypeScript CLI and returns its compact summary/inventory reference. It does not reimplement GitHub API pagination, normalization, or verdicts.
- Accept explicit `<owner/repo>`, positive PR number, and optional previously-seen feedback IDs. Translate seen IDs into the CLI's `--seen-ids-file` using a private temporary file and clean only that adapter-owned file after the invocation; never send IDs via an interpolated shell command.
- Preserve CLI stderr progress for interactive calls via the host tool's progress mechanism where supported, with bounded output; keep raw review and job payloads out of the tool response. Propagate CLI exit/failure without a raw-`gh` reconstruction fallback. Honor tool cancellation by ending its child process.
- Update `fix-pr` skill to use `pr://` for optional PR orientation/targeted diff inspection on capable harnesses; tool when registered for exhaustive ingest and polls; sibling CLI otherwise. A native PR view is never sufficient evidence for completeness or settlement. One inventory is authoritative per pass; do not merge incomplete native projections with it. The direct `gh` worktree, commit, push, and issue paths remain as they are.
- Sync public docs, Codex skill copy, and companion walkthrough to the new three-layer contract (native view / tool or script / agent validation).

## Out of scope
- Replacing the fetcher with OMP's `pr://` renderer or creating a second GitHub ingestion backend.
- New GitHub mutations, changed fix/issue/settlement policy, a new skill slash wrapper, or changing wait/loop limits.
- Building a generic GitHub MCP server or making the tool mandatory for other harnesses.

## Affected files
- `extensions/fix-pr-feedback/index.ts` (new thin registration/CLI adapter) and `extensions/fix-pr-feedback/__tests__/index.test.ts` (new tests); `extensions/index.ts` (wire registration).
- `skills/fix-pr/SKILL.md`; `skills/fix-pr/scripts/fetch-feedback.ts` and its existing tests **only if** a minimal concurrency-safe inventory path contract is necessary for simultaneous tool calls. Otherwise leave the proven CLI unchanged.
- `plugins/buck-workflow/skills/fix-pr/` (byte-for-byte skill copy), `docs/buck-workflow.md`, and `presentations/2026-09-12.fix-pr-skill-report/index.html`.

## Implementation steps
1. Define the tool input/output and failure contract around the existing CLI summary: explicit repository and PR, optional seen IDs, bounded progress, `inventoryPath` and candidates, and a structured nonzero failure. Keep the inventory as the sole exhaustive feed. Verify tool execution/cancellation/progress API against the installed extension typings before implementation.
2. Implement a minimal adapter in `extensions/fix-pr-feedback/`: resolve the script relative to the extension/package, spawn `bun` without a shell, use a private temporary seen-ID file when supplied, forward bounded stderr updates, parse only successful stdout, and dispose the temporary file/child on failure or cancellation. Do not parse review bodies in the adapter. If concurrent invocations can overwrite the CLI's fixed inventory filename, make inventory creation unique and private in the existing script without changing its JSON schema.
3. Register the tool in `extensions/index.ts`; test discovery and direct execution with a fake process/fixture. Assert exact argv, seen IDs, success summary, nonzero/invalid JSON fail-closed results, cancellation cleanup, and that raw feedback never enters the tool result. Keep the existing fetcher's pagination/CI fixture tests as the source of truth.
4. Update `SKILL.md` tool-preference and Phase 1/5c paths: optional `pr://` for orientation, tool if present, CLI if absent; both exhaustive paths produce the same inventory contract. Retain the explicit exit/failure policy and OID revalidation. Do not promote a rendered PR view to a completeness signal. Update the Codex physical skill copy verbatim.
5. Correct `docs/buck-workflow.md`'s stale collector language; sync the companion HTML walkthrough's affected surface, phases, and error handling to the canonical skill. No new agent invocation alias.
6. Verify the focused adapter and CLI tests, Codex bundle parity, extension/tool availability in a live OMP session, and an actual non-mutating PR fetch through the tool and CLI that produces equivalent head OID, counts, candidate IDs, and thread/check fields. Run the repository's durable guardrails check at the end of the implementation batch. Exercise a failed fetch and confirm neither path claims settlement.

## Acceptance criteria
- [ ] An OMP session can invoke the registered tool with repository + PR and obtain a compact, structured result plus a complete private inventory; its output does not dump raw review/CI payloads.
- [ ] The tool's inventory semantics match the CLI for the same PR and seen IDs; script remains directly usable without the extension.
- [ ] Missing tool falls back to the sibling CLI; CLI/tool failure stops classification and settlement without reconstructing raw GitHub requests. `pr://` remains usable for orientation but never substitutes for exhaustive ingest.
- [ ] Cancellation and invalid CLI output fail closed, clean adapter-owned resources, and do not return a success inventory. Concurrent calls cannot silently overwrite one another's inventory if supported.
- [ ] Skill, Codex copy, public docs, and companion walkthrough agree on each layer and on polling/exit behavior. Existing fix/issue/settlement rules remain unchanged.

## Verification
- Focused tests: `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts scripts/codex-plugin.test.ts` (adjust adapter filename to match actual implementation).
- Live read-only smoke: inspect an open `pr://<N>` for orientation, invoke `fix_pr_feedback` for that PR, read the returned inventory, then invoke the CLI against the same PR and compare head OID, counts, and item IDs; verify permissions and one failure path. No commit, push, issue, or review post in the smoke.
- `npm run guardrails:check` after code/doc edits; docs-only planning does not trigger the code-touch gate.

## Risks
- A wrapper that scrapes `pr://` would silently lose thread/check semantics. Keep CLI as the only exhaustive backend.
- Fixed `/tmp/fix-pr-<repo>-<N>.json` filenames can collide under parallel tool calls; resolve at the minimal shared CLI boundary if concurrent execution is allowed.
- Tool response/progress can leak untrusted review or CI text into the main agent context; cap output and treat all returned claims as untrusted evidence, not instructions.
- The script's head OID is captured before its multi-call fetch; existing mainline OID revalidation remains necessary before editing or declaring settlement.

## Recommended next step
Run `/skill:b-phase` before implementation: the contract is compact, but it crosses more than five files/dirs (extension, skill, Codex copy, docs, and walkthrough) and benefits from separate tool and documentation verification units. Then `/b-build` each phase, `/b-review`, `/b-save`, and `/b-commit`.
