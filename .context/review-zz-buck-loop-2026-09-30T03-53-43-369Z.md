## Phase 5 review: Needs work

The staged implementation adds the hard-mode decision step and review matrix rows, but two in-plan gaps remain. I recorded them in the **staged** `.context/2026-09-16.decision-closure/iterate-build-and-review.md`; no pre-existing files were staged by this review.

| Acceptance area | Status | Evidence |
|---|---|---|
| Minimal-change sequence at dependency, abstraction, and broad-refactor decisions | ✅ Complete | `skills/b-build/SKILL.md:58-62` loads the shared protocol and requires the first safe option. |
| Preserve settled decisions and route reframing to planning | 🔄 Partial | `skills/b-build/SKILL.md:60-66` applies these rules only when one of those three escalation triggers occurs. A smaller hard-mode change can still depart from an accepted decision. |
| Leave routine build unchanged | ✅ Complete | The new condition is explicitly hard-mode-only (`skills/b-build/SKILL.md:58-66`). |
| Check assumptions and rollback evidence in review | 🔄 Partial | `skills/b-review/SKILL.md:113-121` adds the checks, but introduces them only for **plans** with a ledger or material risks. It does not explicitly cover a phase-scoped review and its relevant parent-plan entries. |
| Distinguish defects, warnings, and new scope; avoid plan-quality review | ✅ Complete | `skills/b-review/SKILL.md:117-121`. |
| Bundle parity and prohibited-word constraint | ✅ Complete | Both changed canonical directories match their Codex copies; the whole-word scan found no matches. |
| Donor originality | ⚠️ Not verifiable | The cited external donor discussion was unavailable at its recorded path. |

**Review axes:** Spec-axis worst finding: the phase-scoped review gap. Standards-axis worst finding: none in a separate sequential pass using the general review and quality guides plus relevant duplicate-code and comments smells. No cross-axis ranking.

**Verification:** The focused Codex packaging test passed, **7/7**. All reviewed changes are Markdown or `.context/` files, so the deterministic code guardrails gate was skipped under the docs-only rule. No how-to impact. The workflow-narrative documentation update belongs to Phase 6.

**Next:** Run `/b-iterate` on the two recorded defects, then re-review Phase 5.
