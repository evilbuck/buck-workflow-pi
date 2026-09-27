## Plan Path Review: `/buck-models --doctor`

**Verdict: Needs work.** The command and focused tests exist, but the report can omit saved models, misidentify the active profile, and label an unhealthy selection `INFO`. In-plan defects are staged in `.context/2026-09-25.buck-models-doctor/iterate-buck-models-doctor.md`; no implementation files were staged by this review.

### Completion matrix

| Plan step | Status | Evidence |
|---|---|---|
| 1. Route arguments | ✅ complete | `index.ts:390-411` routes `--doctor`, blank arguments, and unsupported arguments; command tests cover each path. |
| 2. Inventory and format | 🔄 partial | `doctor.ts:227-245` collapses equal profile names across scopes, omitting saved model occurrences. |
| 3. Resolve active profile | 🔄 partial | `doctor.ts:124-147,335-339` disagrees with runtime for a global active name backed by a project-only profile; a shared name can lose its active marker. |
| 4. Load configs and registry | 🔄 partial | `index.ts:249-294,390-395` handles absent and invalid YAML fixtures, but unreadable files or registry exceptions are not reported as command errors. |
| 5. Severity and report | 🔄 partial | `doctor.ts:249-255` reports `INFO` for `active=ghost` with no profiles. |
| 6. Tests and how-to | 🔄 partial | 29 focused tests pass and `docs/howto/configure-buck-model-profiles.md:18-30` documents the limit of registry membership. The planned live OMP TUI smoke remains unverified. |

**Spec axis worst finding:** The all-profiles audit drops a global model when the same profile and stage exist in both scopes. A direct fixture produced **2 configured occurrences instead of 3**.  
**Standards axis worst finding:** `index.ts:393` discards the doctor promise, leaving read or registry failures unhandled. This was a separate sequential standards pass using the TypeScript and universal guides and relevant code-smell guidance; no cross-axis ranking was applied.

**Guardrails:** Durable v2, **fail**. Unit, patch, and global-ratchet gates pass; functional and lint are skipped. Required complexity fails on the already in-flight `model-picker.ts` `handleInput` (16). Attribution to this doctor build is not established, but the gate blocks acceptance. No live OMP UI result was observed.

**Issue classification:** Five in-plan defects, recorded in the staged iteration artifact. No out-of-plan finding. **Documentation impact:** none beyond the how-to already changed. **How-to impact:** covered by that how-to.

**Recommended next step:** Supervisor routes the staged artifact to `/b-iterate`, then repeats review and live OMP verification.
