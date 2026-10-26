---
status: completed
date: 2026-10-10
subject: 2026-10-09.sql-memory-param-binding
topics: [diagnose, b-review, cwd]
---

# Diagnosis: b-review could not see this subject

## Symptom
`/b-review .context/2026-10-09.sql-memory-param-binding/` reported the subject folder missing.

## Red command
From `/home/buckleyrobinson/projects/Scout/marketing`:

```
test -d .context/2026-10-09.sql-memory-param-binding && echo present || echo absent
```

Result: `absent`.

## Cause
The review ran in Scout marketing. This subject and its implementation live only in buck-workflow-pi.

- Subject: `/home/buckleyrobinson/projects/development_tools/buck-workflow-pi/.context/2026-10-09.sql-memory-param-binding/`
- Plan: `plan-sql-memory-param-binding.md`
- Branch: `fix/sql-memory-param-binding`
- Dirty implementation: `extensions/sql-memory/{index,columns}.ts` and their tests, both `recall-project-memories.md` copies, `docs/sql-memory.md`

Scout has no copy of the folder. The buck-workflow-pi session pointer still names `2026-10-03.buck-loop-iterate-closeout`; that did not hide this subject. Wrong CWD did.

## Next
Re-run `/b-review` with CWD `buck-workflow-pi`.
