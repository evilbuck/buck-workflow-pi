## Plan Path Review: `/buck-models --doctor`

**Verdict: Needs work.** The live command reports both scopes correctly in a stable fixture, but its two-read config loader can produce a false healthy report if a file disappears between reads.

### Completion Matrix

| Plan step | Status | Evidence |
|---|---|---|
| 1. Route arguments | ✅ Complete | `extensions/buck-models/index.ts:409-423`; no-argument editor opened in the live OMP smoke. |
| 2. Inventory and format | ✅ Complete | `doctor.ts:230-263,277-375`; live report showed both scopes and occurrence totals. |
| 3. Resolve active profile | ✅ Complete | `doctor.ts:115-161`; live report marked `[project] work *active*`. |
| 4. Load configs and registry | 🔄 Partial | `index.ts:249-295` reads each config twice. A file removed after the first read produced `INFO: 0 configured` rather than an error. |
| 5. Present severity and details | 🔄 Partial | Live notification showed `[ok]` and `[MISSING]`, but the loader race can make that notification falsely healthy. |
| 6. Tests and how-to | 🔄 Partial | Guardrails unit gate passed; `docs/howto/configure-buck-model-profiles.md:25-27` says `WARN` where the UI says `WARNING`. Loader-race regression coverage is missing. |

**Review axes:** Spec worst finding: false-healthy config result, in-plan. Standards worst finding, sequential fallback: the redundant filesystem read creates a TOCTOU defect (`index.ts:260-275`). These are independent axis assessments, not a merged ranking.

**Verification:** Durable guardrails **pass**; unit, global ratchet, and complexity pass; functional and lint skipped; patch advisory. In OMP v18.3.2, an isolated fixture displayed one available project id, one missing user-global id, and the active marker. Config SHA-256 hashes were unchanged; plain `/buck-models` opened the scope picker.

**Documentation impact:** Correct `WARN` to `WARNING` in the existing how-to. No new how-to is needed.

**Issue classification:** One in-plan defect; no out-of-plan findings. Recorded and staged only `.context/2026-09-25.buck-models-doctor/iterate-buck-models-doctor-read-once.md`.

**Recommended next step:** `/b-iterate` on that artifact, then re-run `/b-review` against the plan.
