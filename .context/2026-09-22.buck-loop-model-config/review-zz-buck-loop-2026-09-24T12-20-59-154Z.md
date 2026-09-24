## Plan Path Review: Phase 5 `/buck-models` Command

### Plan Source
- File: `.context/2026-09-22.buck-loop-model-config/phase-5-buck-models-command.md`
- Goal: Let engineers create, edit, and activate portable model profiles without hand-editing YAML.
- Baseline: working tree versus `HEAD` (`3ea88f0`); Phase 5 remains uncommitted.

### Evidence Sources
- Modified implementation: `extensions/buck-models/index.ts`, `extensions/buck-models/index.test.ts`, `extensions/index.ts`, `extensions/buck-mode.test.ts`
- Recent baseline commit: `3ea88f0 feat(models): switch interactive Buck commands by stage profile`
- Host API contract: `ExtensionUIContext.input(title, placeholder, opts)` at `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:72-73`
- Real interactive input starts empty and ignores `_placeholder`: `node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/components/extension-input.js:25-39,45-49`

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| Register `wireBuckModels` | ✅ complete | `extensions/index.ts:10,25`; description at `extensions/buck-models/index.ts:227-231` |
| Choose scope and create/select/activate profiles | ✅ complete | `extensions/buck-models/index.ts:110-127,208-224` |
| Edit all twelve stages, ids, notes, and thinking | 🔄 partial | All stages are traversed at `extensions/buck-models/index.ts:129-152`, but existing rows are incorrectly passed as an input placeholder rather than an initial value. Existing thinking is not indicated or preserved by default. |
| Show project ownership/global fallthrough | ✅ complete | `extensions/buck-models/index.ts:79-94,138-145` |
| Warn without rejecting unavailable ids | ✅ complete | `extensions/buck-models/index.ts:155-163,200-204` |
| Preserve unrelated YAML and avoid writes after cancellation | 🔄 partial | Writer preserves unrelated top-level YAML and cancellation precedes writes. Existing profile stage values do not round-trip through the real UI because every input starts blank. |
| Test command interactions and registration | 🔄 partial | Focused tests pass, but the fake UI obscures the host contract mismatch by supplying all input values directly; no test exercises editing an existing non-empty stage through a host-faithful blank input. |

### Review Axes
- **Spec axis worst finding:** Existing model ids and notes are neither displayed nor prefilled by the actual host input. Submitting an existing stage without manually retyping every row replaces it with an empty model list.
- **Standards axis worst finding:** `BuckModelsUI.input` names its second parameter `initial`, contradicting the host API’s `placeholder` contract. The local abstraction and fake tests therefore model behavior the host does not provide. Sequential fallback standards pass used TypeScript, universal quality, long-method, duplicate-code, and primitive-obsession guides.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: **partial**
- User goal: profile creation and activation work; safe editing of existing profiles does not.
- Scope adhered: yes.
- Out-of-scope changes: none identified.
- Focused Vitest: **22/22 passed**
- Actual visual TUI verification: unavailable in the nested surface; focused fake-host command execution was used instead.

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=pass`, `complexity_gate=pass`
- Coverage: 87.2% versus 84% baseline
- New complexity violations: none

### User Goal Analysis
- Goal: create, edit, and activate named profiles in project or user-global scope.
- Met: scope selection, creation, activation-only switching, all twelve stage prompts, warnings, cancellation, lossless top-level YAML writing, registration.
- Missing: host-correct preservation and editing of existing stage models, notes, and thinking.
- Verdict: **partially met**

### Documentation Impact
- Documentation impact exists but is explicitly owned by Phase 6.
- Recommended for this phase: none.

### How-to Impact
- The new user-facing command needs a how-to, explicitly owned by Phase 6.
- Recommended for this phase: none.

### Issue Classification
- In-plan issues: **1**
  - Existing stage values are not visible or safely preserved through the real host input.
- Out-of-plan issues: none.

### Verdict
**Needs work** — one in-plan correctness defect.

### Iteration Artifact
Created:

`.context/2026-09-22.buck-loop-model-config/iterate-phase-5-buck-models-command.md`

It proposes an explicit keep/edit path, omission of unchanged stages from `BuckProfileWrite.stages`, preservation of current thinking, and a host-faithful regression test.

Supervisor controls the next loop transition; the review contract routes this finding to `/b-iterate`.
