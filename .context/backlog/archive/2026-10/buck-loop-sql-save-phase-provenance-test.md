---
title: "Repair buck-loop SQL-save phase-provenance test failure"
status: completed
priority: high
created: 2026-10-04
updated: 2026-10-04
completed: 2026-10-04
related:
  - .context/2026-10-03.review-severity-ranking/phase-2-jev-ranking-core.md
  - .context/backlog/items/buck-loop-save-commit-handoff.md
  - extensions/buck-loop/__tests__/sql-save.test.ts
  - extensions/buck-loop/sql-save.ts
---

# Repair buck-loop SQL-save phase-provenance test failure

The durable v2 contract's required unit gate fails on `extensions/buck-loop/__tests__/sql-save.test.ts`, case **"keeps phase provenance stable on retry but rotates a new phase's source key"** (`sql-save.test.ts:86`). The coverage command also exits 1, so no current coverage number exists to compare against the baseline. This is the only reported gate failure blocking review-severity-ranking Phase 2 closeout.

The case asserts that a same-phase retry keeps the projected attempt while a different phase rotates the run id and source key:

```
const first = attempt(cwd, `.context/${SUBJECT}/phase-1.md`);
expect(prepareSaveAttempt(cwd, SUBJECT, true, first.phase)).toEqual(first);
const next = prepareSaveAttempt(cwd, SUBJECT, true, `.context/${SUBJECT}/phase-2.md`);
expect(next.runId).not.toBe(first.runId);
```

Diagnosis, replay, and the fix belong to whoever owns `extensions/buck-loop/sql-save.ts`. Two constraints carry over from the Phase 2 review and must not be bypassed: do not delete or weaken the test, do not soften a `required` gate to `advisory`, and do not record `null` to silence the coverage command. A resolution needs a fresh `npm run guardrails:check` pass, or an explicit operator override recorded with the failing gate and the reason.

Reported from review `review-zz-buck-loop-2026-10-05T01-31-25-974Z.md`. Resolved by restoring the missing canonical subject line in `saveDirective()`, not by changing phase rotation. Fresh SQL-save tests: 11 passed, 1 skipped. Durable guardrails pass at 88.3% coverage against 84% baseline; live `verifySqlSave()` returned verified. No override, test deletion, or gate weakening.
