---
status: completed
date: 2026-10-04
subject: 2026-10-04.buck-loop-save-client
probe_source: system available-skills catalog
capability_state: full
research: [research-save-client.md]
review: review-save-client.md
sql_memory_ids: [01a10716-1130-704e-ae8f-34d5ba2665be]
---

# Buck-loop save-client repair

## User Goal

Make autonomous buck-loop saves reliably use their required tools and report actionable failures, without treating a file-mode manual save as a verified SQL checkpoint.

## Scope

Fix the client and SQL-tool boundary on `chore/cleanup-skills`. Audit the canonical b-save responsibilities against the restricted child capabilities. Preserve SQL receipt/readback verification and successful same-session recovery. Do not change, stage, resume, save, or commit anything in `../review-ranking.wt`, where the operator is manually running b-save.

## Evidence and assumptions

- Original Phase 1 stop: an active iteration artifact kept the iterating postcondition ambiguous although the phase was completed. Its diagnostic incorrectly said `completed, not completed`. Canonical source already contains that repair.
- Current incident: Phase 2 saving child attempts had five failed sql_memory calls each, while supervisor connectivity probes succeeded. Child reports say tool validation received `{}`; normalized logs omit original arguments, so the exact historical loss point is not proved by that log.
- Manual save reported no callable sql_memory and deliberately produced a file checkpoint; it cannot satisfy the loop's SQL receipt contract.
- Baseline SQL registration used a root TypeBox union. Actual supported OpenAI adapters preserve it; historical empty-argument origin is unproved. The repaired object-rooted schema retains operation-specific host validation.
- Baseline nested SQL tools omitted the child cwd; remember incorrectly derived supervisor provenance. The repaired tool uses the child checkout.
- Baseline save callbacks missed host validation failures. The repaired result retains their sanitized cause; final prose alone remains insufficient without verified receipt/readback.
- Native retain/learn are optional; missing optional mirrors do not explain required SQL failures. Open downstream phases correctly keep subject lifecycle active.

## Implementation

1. Reproduce the actual schema/validation and child-result boundaries with disposable fixtures and read-only harness calls.
2. Repair confirmed input-shape/tool-availability defects; keep operation-specific validation and least privilege.
3. Bind memory identity/provenance to the child cwd and align the supervisor directive with the existing remember/internal-readback contract.
4. Preserve precise unresolved save-tool failures through the child result and loop stop. A later successful save call clears a recovered failure; pool teardown cannot invalidate a verified receipt.
5. Add regression coverage at the real consumer boundary, run a save-path smoke, and run the durable guardrails contract.

## Acceptance Criteria

- [x] Save-tool arguments survive the actual supported OMP client boundary; invalid or incomplete operation arguments cannot reach the database.
- [x] Save client has the required core and SQL capabilities; optional memory mirrors remain optional.
- [x] Remember derives identity and provenance from the child worktree, not the supervisor cwd.
- [x] Unrecovered SQL execution/validation failures produce an actionable save failure, not only generic ambiguous completion.
- [x] Corrected calls can finish, and verified receipt plus pool-teardown noise remains successful.
- [x] Supervisor save instructions use remember/correct's internal readback without contradictory raw-memory SQL instructions.
- [x] Focused regressions, actual save-path smoke, and required guardrails pass.
- [x] Operator worktree and unrelated current-branch changes remain untouched.

## Risks and Verification

Do not weaken receipt verification, invent no-fact receipts, add a prompted model fallback, or make subject close-verified exit 2 a save failure when later phases remain open. Both unrecovered and recovered tool failures were exercised. The public schema retains operation-specific required fields and rejects invalid input before database access. Live save proof used a disposable git repository and local PostgreSQL container; production SQL was not written for smoke.

## Completion Evidence

`research-save-client.md` records the real OMP 18.6 save, SQL receipt/readback, child provenance, native xAI/Grok tool-emission proof, regression red/green evidence, 1,654 passing database-backed tests, and required guardrails pass at 89.5% coverage. Independent standards findings were resolved; mainline acceptance is Pass in `review-save-client.md`. No operator-worktree mutation or commit was performed.
