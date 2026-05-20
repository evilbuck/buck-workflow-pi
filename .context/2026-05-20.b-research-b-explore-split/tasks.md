# Tasks: b-research / b-explore Split

**Created**: 2026-05-20
**Status**: completed

## Tasks

- [x] Finalize naming and compatibility rules for `b-explore`, `b-research`, `index.md`, and `research-*.md`
- [x] Create `skills/b-explore/SKILL.md` from the current codebase-investigation behavior
- [x] Rewrite `skills/b-research/SKILL.md` as the external/web research workflow
- [x] Create `skills/crawl4ai/SKILL.md` with install/bootstrap guidance and crawl recipes
- [x] Add/update `prompts/b-explore.md` and `prompts/b-research.md`
- [x] Update Buck consumers/docs to read or explain subject `index.md`
- [x] Update docs and, only if needed, minimal existing runtime/discoverability references (`extensions/index.ts`, README, docs)
- [x] Verify one `/b-explore` and one `/b-research` dry-run path

## Notes
- Keep `research-*.md` as the canonical summary artifact for compatibility.
- Use `index.md` as the subject entrypoint; let `research/` hold incremental notes/sources for web research.
- Recommended next workflow: `/skill:b-phase` before implementation because this spans multiple skills, wrappers, docs, and possibly a minimal existing-extension touch for command discoverability.